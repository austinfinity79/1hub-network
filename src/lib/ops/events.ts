import { randomBytes } from 'node:crypto'

import { ApiError, isApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { resolveActor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { require as requireCapability } from '@/lib/authz/authorize'
import { query, withTransaction, type Executor } from '@/lib/db/client'

import { EVENT_LIMITS, EVENT_TIMEZONE } from './event-rules'
import { OPS_ORGANIZATION_TYPES } from './organizations'

/**
 * WF03-S07 — standalone Event management (API 05 §8.6, DEC-WF03-G2/G10/G14,
 * DEC-WF03-S07-EVENT-LIFECYCLE, DEC-WF03-S07-D1..D4).
 *
 * The canonical `events` row, standalone only (`programme_id IS NULL`): events
 * linked to a Programme belong to WF04 and are invisible to every S07 call.
 * Ownership is the path organization, set by the server. Lifecycle:
 *   create  → DRAFT
 *   PATCH   DRAFT | PUBLISHED (name, summary, starts_at, ends_at, location_text)
 *   publish DRAFT → PUBLISHED when name + starts_at + ends_at, ends ≥ starts,
 *           start not in the past
 *   cancel  PUBLISHED | LIVE → CANCELLED (terminal here; never deleted)
 * LIVE / ENDED / ARCHIVED have no operation in P0 (E5).
 *
 * `event:manage` for exactly the owning organization. Event-id routes answer
 * 404 for an event the actor cannot manage, so ids cannot be probed. Every
 * mutation validates first, locks the row, re-checks the state in the
 * transaction and writes one audit event (ids + state / field names only).
 */

const CAPABILITY = 'event:manage'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/
const EDITABLE = ['name', 'summary', 'starts_at', 'ends_at', 'location_text'] as const
const EDITABLE_STATES = ['DRAFT', 'PUBLISHED']
const CANCELLABLE_STATES = ['PUBLISHED', 'LIVE']

export type EventDTO = {
  id: string
  organization_id: string
  slug: string
  name: string
  summary: string | null
  starts_at: string | null
  ends_at: string | null
  location_text: string | null
  status: string
  created_at: string
  updated_at: string
}

type Row = {
  id: string
  organization_id: string
  slug: string
  name: string
  summary: string | null
  starts_at: Date | null
  ends_at: Date | null
  location_text: string | null
  status: string
  created_at: Date
  updated_at: Date
}

const COLUMNS = `id::text, organization_id::text, slug, name, summary, starts_at, ends_at,
  location_text, status::text AS status, created_at, updated_at`

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null)
const toDTO = (r: Row): EventDTO => ({
  id: r.id,
  organization_id: r.organization_id,
  slug: r.slug,
  name: r.name,
  summary: r.summary,
  starts_at: iso(r.starts_at),
  ends_at: iso(r.ends_at),
  location_text: r.location_text,
  status: r.status,
  created_at: iso(r.created_at)!,
  updated_at: iso(r.updated_at)!,
})

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)

async function authorizeOrg(accountId: string, orgId: string) {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, CAPABILITY, { scopeType: 'ORGANIZATION', scopeId: orgId })
  if (!UUID.test(orgId)) throw notFound()
  const [org] = await query<{ id: string; status: string }>(
    `SELECT id::text, status::text AS status FROM organizations
      WHERE id = $1 AND type::text = ANY($2::text[])`,
    [orgId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!org) throw notFound()
  return org
}

/**
 * Loads a standalone event the actor may manage, or 404 — also when the event
 * exists in an organization outside the actor's scope.
 */
async function manageableEvent(
  exec: Executor,
  accountId: string,
  eventId: string,
  lock = false,
): Promise<Row> {
  if (!UUID.test(eventId)) throw notFound()
  const [row] = await exec<Row>(
    `SELECT ${COLUMNS} FROM events e
      WHERE e.id = $1 AND e.programme_id IS NULL
        AND EXISTS (SELECT 1 FROM organizations o
                     WHERE o.id = e.organization_id AND o.type::text = ANY($2::text[]))
      ${lock ? 'FOR UPDATE OF e' : ''}`,
    [eventId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!row) throw notFound()
  const actor = await resolveActor(accountId)
  try {
    await requireCapability(actor, CAPABILITY, {
      scopeType: 'ORGANIZATION',
      scopeId: row.organization_id,
    })
  } catch (error) {
    if (isApiError(error) && error.status === 403) throw notFound()
    throw error
  }
  return row
}

/** GET /ops/organizations/{orgId}/events — standalone events of this organization. */
export async function listOrganizationEvents(
  accountId: string,
  orgId: string,
): Promise<EventDTO[]> {
  const org = await authorizeOrg(accountId, orgId)
  const rows = await query<Row>(
    `SELECT ${COLUMNS} FROM events
      WHERE organization_id = $1 AND programme_id IS NULL
      ORDER BY starts_at DESC NULLS FIRST, created_at DESC, id
      LIMIT 200`,
    [org.id],
  )
  return rows.map(toDTO)
}

/** GET /events/{eventId} — P0: the manager's view only (public projection belongs to S09). */
export async function getManagedEvent(accountId: string, eventId: string): Promise<EventDTO> {
  return toDTO(await manageableEvent(query, accountId, eventId))
}

type Fields = {
  name?: string
  summary?: string | null
  starts_at?: string | null
  ends_at?: string | null
  location_text?: string | null
}

function text(input: unknown, field: string, max: number, required: boolean): string | null {
  if (input === null || input === undefined) {
    if (required) throw invalid(field, 'required')
    return null
  }
  if (typeof input !== 'string') throw invalid(field, 'invalid')
  const value = input.trim()
  if (!value) {
    if (required) throw invalid(field, 'required')
    return null
  }
  if (value.length > max) throw invalid(field, 'too_long')
  return value
}

function timestamp(input: unknown, field: string): string | null {
  if (input === null) return null
  if (typeof input !== 'string' || !ISO.test(input) || Number.isNaN(Date.parse(input)))
    throw invalid(field, 'invalid')
  return new Date(input).toISOString()
}

/**
 * Parses create / PATCH input (E4). `allowed` adds the create-only keys.
 * Server-owned and unsupported keys are refused by name.
 */
function parseFields(body: unknown, mode: 'create' | 'update'): Fields {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  const accepted = [...EDITABLE, 'timezone', ...(mode === 'create' ? ['programme_id'] : [])]
  for (const key of Object.keys(input)) {
    if (!accepted.includes(key)) throw invalid(key, 'not_accepted')
  }
  if (mode === 'create' && input.programme_id !== undefined && input.programme_id !== null)
    throw invalid('programme_id', 'not_supported')
  if (input.timezone !== undefined && input.timezone !== EVENT_TIMEZONE)
    throw invalid('timezone', 'not_supported')
  const fields: Fields = {}
  if (mode === 'create' || 'name' in input)
    fields.name = text(input.name, 'name', EVENT_LIMITS.name, true)!
  if ('summary' in input)
    fields.summary = text(input.summary, 'summary', EVENT_LIMITS.summary, false)
  if ('location_text' in input)
    fields.location_text = text(input.location_text, 'location_text', EVENT_LIMITS.location, false)
  if ('starts_at' in input) fields.starts_at = timestamp(input.starts_at, 'starts_at')
  if ('ends_at' in input) fields.ends_at = timestamp(input.ends_at, 'ends_at')
  if (mode === 'update' && Object.keys(fields).length === 0) throw invalid('body', 'empty')
  return fields
}

function checkTimes(starts: string | null, ends: string | null) {
  if (starts && ends && Date.parse(ends) < Date.parse(starts))
    throw invalid('ends_at', 'before_start')
}

function slugFor(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'su-kien'}-${randomBytes(4).toString('hex')}`
}

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

/** POST /ops/organizations/{orgId}/events → 201 DRAFT, `programme_id` NULL. */
export async function createEvent(
  accountId: string,
  orgId: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<EventDTO> {
  const org = await authorizeOrg(accountId, orgId)
  const fields = parseFields(body, 'create')
  checkTimes(fields.starts_at ?? null, fields.ends_at ?? null)
  if (org.status === 'ARCHIVED') throw conflict('An archived organization cannot create events.')

  return inTransaction(exec, async (tx) => {
    const [row] = await tx<Row>(
      `INSERT INTO events (organization_id, programme_id, slug, name, summary, starts_at, ends_at, location_text, status)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'DRAFT')
       RETURNING ${COLUMNS}`,
      [
        org.id,
        slugFor(fields.name!),
        fields.name,
        fields.summary ?? null,
        fields.starts_at ?? null,
        fields.ends_at ?? null,
        fields.location_text ?? null,
      ],
    )
    await writeAudit(tx, {
      actorAccountId: accountId,
      action: 'EVENT_CREATED',
      resourceType: 'event',
      resourceId: row!.id,
      before: null,
      after: { event_id: row!.id, organization_id: org.id, status: 'DRAFT' },
      requestId,
    })
    return toDTO(row!)
  })
}

/** PATCH /ops/events/{eventId} — DRAFT | PUBLISHED only (E2). */
export async function updateEvent(
  accountId: string,
  eventId: string,
  body: unknown,
  requestId: string,
): Promise<EventDTO> {
  const fields = parseFields(body, 'update')
  return withTransaction(async (tx) => {
    const row = await manageableEvent(tx, accountId, eventId, true)
    if (!EDITABLE_STATES.includes(row.status)) throw conflict('This event can no longer be edited.')
    const next = {
      name: fields.name ?? row.name,
      summary: fields.summary !== undefined ? fields.summary : row.summary,
      starts_at: fields.starts_at !== undefined ? fields.starts_at : iso(row.starts_at),
      ends_at: fields.ends_at !== undefined ? fields.ends_at : iso(row.ends_at),
      location_text: fields.location_text !== undefined ? fields.location_text : row.location_text,
    }
    checkTimes(next.starts_at, next.ends_at)
    if (row.status === 'PUBLISHED') {
      // A published event keeps the publish requirements (E3).
      if (!next.starts_at) throw invalid('starts_at', 'required')
      if (!next.ends_at) throw invalid('ends_at', 'required')
      if (next.starts_at !== iso(row.starts_at) && Date.parse(next.starts_at) < Date.now())
        throw invalid('starts_at', 'past')
    }
    const current = {
      name: row.name,
      summary: row.summary,
      starts_at: iso(row.starts_at),
      ends_at: iso(row.ends_at),
      location_text: row.location_text,
    }
    const changed = EDITABLE.filter((f) => next[f] !== current[f])
    if (changed.length === 0) return toDTO(row)
    const [updated] = await tx<Row>(
      `UPDATE events SET name = $2, summary = $3, starts_at = $4, ends_at = $5, location_text = $6,
              updated_at = now()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [row.id, next.name, next.summary, next.starts_at, next.ends_at, next.location_text],
    )
    await writeAudit(tx, {
      actorAccountId: accountId,
      action: 'EVENT_UPDATED',
      resourceType: 'event',
      resourceId: row.id,
      before: { event_id: row.id, organization_id: row.organization_id, status: row.status },
      after: {
        event_id: row.id,
        organization_id: row.organization_id,
        status: row.status,
        changed_fields: changed,
      },
      requestId,
    })
    return toDTO(updated!)
  })
}

/** POST /ops/events/{eventId}/publish — DRAFT → PUBLISHED after validation (E3). */
export async function publishEvent(
  accountId: string,
  eventId: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<EventDTO> {
  if (body !== null && body !== undefined) {
    if (typeof body !== 'object' || Array.isArray(body)) throw invalid('body', 'invalid')
    const key = Object.keys(body)[0]
    if (key) throw invalid(key, 'not_accepted')
  }
  return inTransaction(exec, async (tx) => {
    const row = await manageableEvent(tx, accountId, eventId, true)
    if (row.status !== 'DRAFT') throw conflict('Only a draft event can be published.')
    if (!row.starts_at) throw invalid('starts_at', 'required')
    if (!row.ends_at) throw invalid('ends_at', 'required')
    checkTimes(iso(row.starts_at), iso(row.ends_at))
    if (new Date(row.starts_at).getTime() < Date.now()) throw invalid('starts_at', 'past')
    const [updated] = await tx<Row>(
      `UPDATE events SET status = 'PUBLISHED', updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
      [row.id],
    )
    await writeAudit(tx, {
      actorAccountId: accountId,
      action: 'EVENT_PUBLISHED',
      resourceType: 'event',
      resourceId: row.id,
      before: { event_id: row.id, organization_id: row.organization_id, status: 'DRAFT' },
      after: { event_id: row.id, organization_id: row.organization_id, status: 'PUBLISHED' },
      requestId,
    })
    return toDTO(updated!)
  })
}

/** POST /ops/events/{eventId}/cancel — PUBLISHED | LIVE → CANCELLED (E1). */
export async function cancelEvent(
  accountId: string,
  eventId: string,
  body: unknown,
  requestId: string,
): Promise<EventDTO> {
  if (body !== null && body !== undefined) {
    if (typeof body !== 'object' || Array.isArray(body)) throw invalid('body', 'invalid')
    const key = Object.keys(body)[0]
    if (key) throw invalid(key, 'not_accepted')
  }
  return withTransaction(async (tx) => {
    const row = await manageableEvent(tx, accountId, eventId, true)
    if (!CANCELLABLE_STATES.includes(row.status))
      throw conflict('This event cannot be cancelled in its current state.')
    const [updated] = await tx<Row>(
      `UPDATE events SET status = 'CANCELLED', updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
      [row.id],
    )
    await writeAudit(tx, {
      actorAccountId: accountId,
      action: 'EVENT_CANCELLED',
      resourceType: 'event',
      resourceId: row.id,
      before: { event_id: row.id, organization_id: row.organization_id, status: row.status },
      after: { event_id: row.id, organization_id: row.organization_id, status: 'CANCELLED' },
      requestId,
    })
    return toDTO(updated!)
  })
}
