import { NextResponse } from 'next/server'

import { listEnvelope } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { withApi, type ApiHandler } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { query } from '@/lib/db/client'

import type { LibraryViewer } from './canonical-source'
import {
  LibraryQueryError,
  PAGE_DEFAULT,
  PAGE_MAX,
  type LibraryFounderItem,
  type LibraryStartupItem,
} from './library-data'
import { LIBRARY_QUERY_MAX } from './query'

/**
 * WF06-PROD-03 — the HTTP edge of `GET /api/v1/library/*` (API §25, DEC-W6P):
 * query parsing, the viewer, DTOs and response headers. Visibility itself is
 * decided below this layer (SQL predicate, discovery projection); nothing here
 * widens it.
 *
 * - Query: only the listed parameters (anything else → `not_accepted`); single
 *   ones at most once; at most 10 values per filter; `q` NFC-normalised,
 *   whitespace collapsed, ≤ 120 characters, no control character; ids are
 *   UUIDs; `limit` 1 – 50; the cursor is opaque. Every failing field is
 *   reported at once as `422 PROFILE_VALIDATION_FAILED` (the repo's validation
 *   answer; the contract has no generic 400 code).
 * - Viewer: NETWORK for a live session of an ACTIVE account, else GUEST; never
 *   from a header, query or body.
 * - DTOs: snake_case whitelists; no UUID of a record, slug, owner, account or
 *   source internals. Every response is `Cache-Control: private, no-store`.
 */

export const MAX_FILTER_VALUES = 10
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CURSOR = /^[A-Za-z0-9_-]{1,16}$/
const CONTROL = /[\u0000-\u001f\u007f]/
const PARAM_NAME = /^[a-z_]{1,32}$/

type Fields = Record<string, string>

export function validationFailed(fields: Fields): ApiError {
  return new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Invalid Library query.', fields)
}

/** Reads a query string against the parameters a route accepts; collects failures in `fields`. */
export function libraryParams(
  url: string,
  accepted: { single: readonly string[]; multi: readonly string[] },
) {
  const params = new URL(url).searchParams
  const fields: Fields = {}
  for (const key of new Set(params.keys())) {
    if (accepted.single.includes(key)) {
      if (params.getAll(key).length > 1) fields[key] = 'duplicate'
    } else if (accepted.multi.includes(key)) {
      if (params.getAll(key).length > MAX_FILTER_VALUES) fields[key] = 'too_many'
    } else {
      // Unknown names are not echoed beyond a plain identifier.
      fields[PARAM_NAME.test(key) ? key : 'query'] = 'not_accepted'
    }
  }
  const one = (key: string) => (fields[key] ? null : params.get(key))
  const all = (key: string) => (fields[key] ? [] : params.getAll(key))

  return {
    fields,
    /** The keyword: trimmed, NFC, single spaces; undefined when empty. */
    keyword(key = 'q'): string | undefined {
      const raw = one(key)
      if (raw === null) return undefined
      const text = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
      if (CONTROL.test(text)) fields[key] = 'invalid'
      else if (text.length > LIBRARY_QUERY_MAX) fields[key] = 'too_long'
      return text || undefined
    },
    /** Vocabulary ids: UUIDs, lower-cased, deduplicated. */
    ids(key: string): string[] {
      const values = [...new Set(all(key).map((v) => v.trim().toLowerCase()))]
      if (values.some((v) => !UUID.test(v))) fields[key] = 'invalid'
      return values
    },
    /** Plain text values (the problem file's facets): trimmed, NFC, deduplicated. */
    texts(key: string): string[] {
      const values = [...new Set(all(key).map((v) => v.normalize('NFC').trim()))]
      if (values.some((v) => !v || CONTROL.test(v))) fields[key] = 'invalid'
      else if (values.some((v) => v.length > LIBRARY_QUERY_MAX)) fields[key] = 'too_long'
      return values
    },
    choice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
      const raw = one(key)
      if (raw === null) return fallback
      if (!(allowed as readonly string[]).includes(raw)) fields[key] = 'invalid'
      return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
    },
    page(): { cursor?: string; limit: number } {
      const cursor = one('cursor') ?? undefined
      if (cursor !== undefined && !CURSOR.test(cursor)) fields.cursor = 'invalid'
      const raw = one('limit')
      let limit = PAGE_DEFAULT
      if (raw !== null) {
        if (!/^\d{1,3}$/.test(raw) || Number(raw) < 1) fields.limit = 'invalid'
        else if (Number(raw) > PAGE_MAX) fields.limit = 'too_many'
        else limit = Number(raw)
      }
      return { cursor, limit }
    },
    /** Throws the collected failures, if any. */
    check(): void {
      if (Object.keys(fields).length) throw validationFailed(fields)
    },
  }
}

/** Maps a data-layer refusal (forged cursor, unknown vocabulary id) to the 422 answer. */
export async function asQueryError<T>(run: () => Promise<T> | T): Promise<T> {
  try {
    return await run()
  } catch (caught) {
    if (caught instanceof LibraryQueryError) {
      throw validationFailed({ [caught.field]: caught.reason })
    }
    throw caught
  }
}

/** NETWORK for a live session of an ACTIVE account (DEC-W6P-D03); everyone else is a GUEST. */
export async function libraryViewer(headers: Headers): Promise<LibraryViewer> {
  const session = await resolveSession(readSessionToken(headers))
  if (!session) return 'GUEST'
  const [account] = await query<{ status: string }>(
    'SELECT status::text AS status FROM user_accounts WHERE id = $1',
    [session.accountId],
  )
  return account?.status === 'ACTIVE' ? 'NETWORK' : 'GUEST'
}

/** `withApi`, plus headers that keep every Library answer out of shared caches. */
export function libraryRoute<T>(handler: ApiHandler<T>) {
  const run = withApi(handler)
  return async (request: Request): Promise<NextResponse> => {
    const response = await run(request)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Vary', 'Cookie')
    return response
  }
}

export function libraryList<T, E extends object>(
  items: T[],
  page: { nextCursor: string | null; limit: number },
  extra: E,
) {
  return { ...listEnvelope(items, page), ...extra }
}

export type StartupDTO = {
  key: string
  name: string
  summary: string | null
  stage: { code: string; label: string } | null
  domains: Array<{ id: string; label: string }>
  domain_labels: string[]
  region: string | null
  website: string | null
  member_count: number | null
}

export function startupDTO(item: LibraryStartupItem): StartupDTO {
  return {
    key: item.key,
    name: item.name,
    summary: item.summary,
    stage: item.stage ? { code: item.stage.code, label: item.stage.label } : null,
    domains: item.domains.map((d) => ({ id: d.id, label: d.label })),
    domain_labels: [...item.domainLabels],
    region: item.region,
    website: item.website,
    member_count: item.memberCount,
  }
}

export type FounderDTO = {
  key: string
  display_name: string
  avatar_url: string | null
  ventures: Array<{
    name: string
    role_label: string | null
    stage: { code: string; label: string } | null
  }>
  domain_ids: string[]
}

export function founderDTO(item: LibraryFounderItem): FounderDTO {
  return {
    key: item.key,
    display_name: item.displayName,
    avatar_url: item.avatarUrl,
    ventures: item.ventures.map((v) => ({
      name: v.name,
      role_label: v.roleLabel,
      stage: v.stage ? { code: v.stage.code, label: v.stage.label } : null,
    })),
    domain_ids: [...item.domainIds],
  }
}
