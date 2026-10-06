import { createHash } from 'node:crypto'

import { ApiError } from '@/lib/api/errors'
import { query, type Executor } from '@/lib/db/client'

/**
 * Controlled vocabulary (Data Freeze D5; API 05 §7).
 *
 * Item lists are data, never code: this module reads `vocabulary_items` and
 * holds no literal taxonomy. P0 types are REGION, DOMAIN and SKILL; the
 * four-stage onboarding adds COUNTRY and SPECIALIZATION (migration 010,
 * DEC-L1R-D4), the venture its VENTURE_STAGE (migration 011, DEC-L2R-D5).
 * Items are ACTIVE or ARCHIVED; an archived item stays valid on
 * relations that already point at it, but can never be newly selected
 * (Freeze:209).
 */

export const VOCABULARY_TYPES = [
  'REGION',
  'DOMAIN',
  'SKILL',
  'COUNTRY',
  'SPECIALIZATION',
  'VENTURE_STAGE',
] as const
export type VocabularyType = (typeof VOCABULARY_TYPES)[number]

/**
 * UNNORMALIZED (migration 019, FB-09): a value a member typed that matched no
 * canonical item, kept with the "chưa chuẩn hóa" flag for HUB to consolidate.
 * Never listed, suggested or newly selectable by id; only linked by the member
 * who typed it (or anyone typing the same text) through `resolveTags`.
 */
export type VocabularyStatus = 'ACTIVE' | 'ARCHIVED' | 'UNNORMALIZED'

/** 05 §7 item shape. `code` is the stored canonical slug. */
export type VocabularyItemDTO = {
  id: string
  code: string
  label: string
  status: VocabularyStatus
}

export function isVocabularyType(value: unknown): value is VocabularyType {
  return typeof value === 'string' && (VOCABULARY_TYPES as readonly string[]).includes(value)
}

type ItemRow = {
  id: string
  type_code: string
  slug: string
  label: string
  status: VocabularyStatus
}

const toDTO = (row: ItemRow): VocabularyItemDTO => ({
  id: row.id,
  code: row.slug,
  label: row.label,
  status: row.status,
})

/** The cursor is an opaque offset; a malformed one restarts from the top. */
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const offset = Number(Buffer.from(cursor, 'base64url').toString('utf8'))
  return Number.isInteger(offset) && offset >= 0 ? offset : 0
}

const encodeCursor = (offset: number) => Buffer.from(String(offset), 'utf8').toString('base64url')

export async function listVocabularyItems(
  type: VocabularyType,
  options: { q?: string; status?: VocabularyStatus; cursor?: string; limit: number },
): Promise<{ items: VocabularyItemDTO[]; nextCursor: string | null }> {
  const offset = decodeCursor(options.cursor)
  const params: unknown[] = [type, options.status ?? 'ACTIVE']
  let where = 'type_code = $1 AND status = $2::vocab_status'
  const q = options.q?.trim()
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    where += ` AND (label ILIKE $${params.length} OR slug ILIKE $${params.length})`
  }
  params.push(options.limit + 1, offset)
  const rows = await query<ItemRow>(
    `SELECT id::text, type_code, slug, label, status::text AS status
       FROM vocabulary_items
      WHERE ${where}
      ORDER BY sort_order, label, id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  const more = rows.length > options.limit
  return {
    items: rows.slice(0, options.limit).map(toDTO),
    nextCursor: more ? encodeCursor(offset + options.limit) : null,
  }
}

/**
 * Every ACTIVE item of the given types, in canonical order (server-rendered
 * pickers). The slug is included for the pickers that branch on one item
 * (US-01.07: Việt Nam has a province list), not for the public DTO.
 */
export async function listActiveItems(
  types: readonly VocabularyType[],
): Promise<(VocabularyItemDTO & { type: VocabularyType; slug: string })[]> {
  const rows = await query<ItemRow>(
    `SELECT id::text, type_code, slug, label, status::text AS status
       FROM vocabulary_items
      WHERE type_code = ANY($1::text[]) AND status = 'ACTIVE'
      ORDER BY sort_order, label, id`,
    [types],
  )
  return rows.map((row) => ({
    ...toDTO(row),
    type: row.type_code as VocabularyType,
    slug: row.slug,
  }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Checks ids submitted for one canonical relation. Every id must exist, belong
 * to `type`, and be ACTIVE unless it is already linked (`keep`), in which case
 * an archived item may stay. Throws the frozen profile errors (05:337).
 */
export async function assertSelectable(
  exec: Executor,
  field: string,
  type: VocabularyType,
  ids: readonly string[],
  keep: ReadonlySet<string> = new Set(),
): Promise<void> {
  if (ids.length === 0) return
  if (!ids.every((id) => UUID.test(id))) {
    throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Unknown vocabulary item.', {
      [field]: 'unknown',
    })
  }
  const rows = await exec<{ id: string; type_code: string; status: VocabularyStatus }>(
    `SELECT id::text, type_code, status::text AS status
       FROM vocabulary_items WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  const byId = new Map(rows.map((row) => [row.id, row]))
  for (const id of ids) {
    const row = byId.get(id.toLowerCase())
    if (!row) {
      throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Unknown vocabulary item.', {
        [field]: 'unknown',
      })
    }
    if (row.type_code !== type) {
      throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Vocabulary item has the wrong type.', {
        [field]: 'wrong_type',
      })
    }
    if (row.status !== 'ACTIVE' && !keep.has(row.id)) {
      throw new ApiError('VOCABULARY_ITEM_INACTIVE', 422, 'Vocabulary item is not active.', {
        [field]: 'inactive',
      })
    }
  }
}

/** FB-09: a tag is 2–40 characters; each field holds at most five. */
export const TAG_LIMITS = { min: 2, max: 40, count: 5 } as const

/** A typed tag as stored: Unicode NFC, trimmed, inner whitespace collapsed. */
export const cleanTag = (label: string) => label.normalize('NFC').trim().replace(/\s+/g, ' ')

/** FB-09 duplicate rule: case-insensitive, extra whitespace ignored. */
export const tagKey = (label: string) => cleanTag(label).toLocaleLowerCase('vi')

/**
 * FB-09 — the vocabulary ids for the tags a member submitted, in order.
 *
 * A tag whose text is a canonical ACTIVE label (same key) links that item:
 * canonical normalisation where the catalogue already has the value. Else an
 * existing UNNORMALIZED item with the same key is reused, so equal free text
 * from many members is one value for HUB to consolidate. Else a new
 * UNNORMALIZED item is created (2–40 characters). An ARCHIVED item is reused
 * only where the profile already links it (`keep`), as for ids.
 *
 * S1-UAT-03 (DEC-S1O) reuses it for typed locations: `length` sets the bounds
 * of a new value, and `canonical: false` never links an ACTIVE item (a town
 * typed for Singapore is not a Vietnamese province of the same name).
 */
export async function resolveTags(
  exec: Executor,
  field: string,
  type: VocabularyType,
  labels: readonly string[],
  keep: ReadonlySet<string> = new Set(),
  options: { length?: { min: number; max: number }; canonical?: boolean } = {},
): Promise<string[]> {
  const length = options.length ?? { min: TAG_LIMITS.min, max: TAG_LIMITS.max }
  const canonical = options.canonical ?? true
  if (labels.length === 0) return []
  const rows = await exec<{ id: string; label: string; status: VocabularyStatus }>(
    `SELECT id::text, label, status::text AS status FROM vocabulary_items
      WHERE type_code = $1 ORDER BY sort_order, label, id`,
    [type],
  )
  const rank = (row: { id: string; status: VocabularyStatus }) =>
    row.status === 'ACTIVE'
      ? canonical
        ? 0
        : 9
      : row.status === 'UNNORMALIZED'
        ? 1
        : keep.has(row.id)
          ? 2
          : 9
  const byKey = new Map<string, { id: string; status: VocabularyStatus }>()
  for (const row of rows) {
    const key = tagKey(row.label)
    const seen = byKey.get(key)
    if (rank(row) < 9 && (!seen || rank(row) < rank(seen))) byKey.set(key, row)
  }

  const ids: string[] = []
  for (const raw of labels) {
    const label = cleanTag(raw)
    const key = tagKey(label)
    const found = byKey.get(key)
    if (found) {
      ids.push(found.id)
      continue
    }
    if (label.length < length.min || label.length > length.max) {
      throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Tag length is not valid.', {
        [field]: 'tag_length',
      })
    }
    const slug = `u-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
    // Two members typing the same new value at once both end on the one row.
    const [created] = await exec<{ id: string }>(
      `INSERT INTO vocabulary_items (type_code, slug, label, sort_order, status, metadata)
       VALUES ($1, $2, $3, 0, 'UNNORMALIZED', '{"source":"MEMBER"}'::jsonb)
       ON CONFLICT (type_code, slug) DO UPDATE SET updated_at = vocabulary_items.updated_at
       RETURNING id::text`,
      [type, slug, label],
    )
    byKey.set(key, { id: created!.id, status: 'UNNORMALIZED' })
    ids.push(created!.id)
  }
  return ids
}
