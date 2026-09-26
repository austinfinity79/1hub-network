import { randomBytes } from 'node:crypto'

import { ApiError, notFound } from '@/lib/api/errors'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'
import { assertSelectable, type VocabularyStatus } from '@/lib/vocabulary/vocabulary'

/**
 * WF02-S05 — canonical Project/Startup ("Venture" in API 05 §5.3).
 *
 * One `projects` row per venture, reused later by WF05 (never copied per
 * programme). Write model (DEC-WF02-H6): type, name, summary, domain_ids,
 * region_id. The owner is the session's profile (`owner_profile_id`, DEC-WF02-
 * S05-G5); no `project_members` row is created for it. Relation capabilities
 * (DEC-WF02-H7, Matrix §E): `venture:read` = owner or an ACTIVE member,
 * `venture:manage` = owner only. `role_label` never grants anything. Status
 * starts DRAFT; DRAFT and ACTIVE are editable, ARCHIVED is read-only (G3);
 * `type` is fixed at creation (G4). Never serialised: slug, metadata, owner or
 * member profile ids.
 */

export const VENTURE_TYPES = ['PROJECT', 'STARTUP'] as const
export type VentureType = (typeof VENTURE_TYPES)[number]

export type VentureCapability = 'venture:read' | 'venture:manage' | 'venture:team_manage'

/** Provisional TECHNICAL bounds; not business rules (DEC-WF02-S05-D1). */
export const VENTURE_LIMITS = { name: 200, summary: 2000, domains: 10 } as const

type Ref = { id: string; label: string; status: VocabularyStatus }

export type VentureDTO = {
  id: string
  type: VentureType
  name: string
  summary: string | null
  status: string
  region: Ref | null
  domains: Ref[]
  relation: 'OWNER' | 'MEMBER'
  can_edit: boolean
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Venture validation failed.', { [field]: reason })

type Input = {
  type?: VentureType
  name?: string
  summary?: string | null
  region_id?: string | null
  domain_ids?: string[]
}

const WRITABLE = ['name', 'summary', 'region_id', 'domain_ids'] as const

/** Shape checks only; no database access, so nothing can be half-written. */
function parse(body: unknown, mode: 'create' | 'update'): Input {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  const allowed: readonly string[] = mode === 'create' ? ['type', ...WRITABLE] : WRITABLE
  for (const key of Object.keys(input)) {
    // G4: type is fixed; owner, status and system fields are never client-written.
    if (!allowed.includes(key)) throw invalid(key, key === 'type' ? 'immutable' : 'not_accepted')
  }
  const out: Input = {}
  if (mode === 'create') {
    if (!(VENTURE_TYPES as readonly unknown[]).includes(input.type))
      throw invalid('type', 'invalid')
    out.type = input.type as VentureType
  }
  if ('name' in input || mode === 'create') {
    if (typeof input.name !== 'string' || !input.name.trim()) throw invalid('name', 'required')
    if (input.name.trim().length > VENTURE_LIMITS.name) throw invalid('name', 'too_long')
    out.name = input.name.trim()
  }
  if ('summary' in input) {
    if (input.summary !== null && typeof input.summary !== 'string')
      throw invalid('summary', 'invalid')
    const text = (input.summary as string | null)?.trim() || null
    if (text && text.length > VENTURE_LIMITS.summary) throw invalid('summary', 'too_long')
    out.summary = text
  }
  if ('region_id' in input) {
    if (input.region_id !== null && typeof input.region_id !== 'string')
      throw invalid('region_id', 'invalid')
    out.region_id = (input.region_id as string | null)?.toLowerCase() || null
  }
  if ('domain_ids' in input) {
    const v = input.domain_ids
    if (!Array.isArray(v) || !v.every((id) => typeof id === 'string'))
      throw invalid('domain_ids', 'invalid')
    const ids = [...new Set(v.map((id) => id.toLowerCase()))]
    if (ids.length > VENTURE_LIMITS.domains) throw invalid('domain_ids', 'too_many')
    out.domain_ids = ids
  }
  return out
}

async function profileOf(exec: Executor, accountId: string): Promise<string | null> {
  const [row] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  return row?.id ?? null
}

type Row = {
  id: string
  type: VentureType
  name: string
  summary: string | null
  status: string
  region_id: string | null
  owner: boolean
  member: boolean
}

/** The venture as seen by `profileId`, or null when it holds no `venture:read`. */
async function readable(
  exec: Executor,
  ventureId: string,
  profileId: string,
  lock = false,
): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(ventureId)) return null
  const [row] = await exec<Row>(
    `SELECT p.id::text, p.type::text AS type, p.name, p.summary, p.status::text AS status,
            p.region_id::text, p.owner_profile_id = $2::uuid AS owner,
            EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id
                     AND m.profile_id = $2::uuid AND m.state = 'ACTIVE') AS member
       FROM projects p WHERE p.id = $1::uuid ${lock ? 'FOR UPDATE OF p' : ''}`,
    [ventureId, profileId],
  )
  return row && (row.owner || row.member) ? row : null
}

async function toDTO(exec: Executor, row: Row): Promise<VentureDTO> {
  const [region] = row.region_id
    ? await exec<Ref>(
        'SELECT id::text, label, status::text AS status FROM vocabulary_items WHERE id = $1',
        [row.region_id],
      )
    : []
  const domains = await exec<Ref>(
    `SELECT v.id::text, v.label, v.status::text AS status
       FROM project_domains d JOIN vocabulary_items v ON v.id = d.vocabulary_item_id
      WHERE d.project_id = $1 ORDER BY v.sort_order, v.label`,
    [row.id],
  )
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    summary: row.summary,
    status: row.status,
    region: region ?? null,
    domains,
    relation: row.owner ? 'OWNER' : 'MEMBER',
    can_edit: row.owner && row.status !== 'ARCHIVED',
  }
}

async function validateTaxonomy(
  exec: Executor,
  input: Input,
  keepRegion: string | null,
  keepDomains: string[],
): Promise<void> {
  if (input.region_id) {
    await assertSelectable(
      exec,
      'region_id',
      'REGION',
      [input.region_id],
      new Set(keepRegion ? [keepRegion] : []),
    )
  }
  if (input.domain_ids) {
    await assertSelectable(exec, 'domain_ids', 'DOMAIN', input.domain_ids, new Set(keepDomains))
  }
}

async function replaceDomains(exec: Executor, ventureId: string, ids: string[]) {
  await exec(
    'DELETE FROM project_domains WHERE project_id = $1 AND NOT (vocabulary_item_id = ANY($2::uuid[]))',
    [ventureId, ids],
  )
  await exec(
    `INSERT INTO project_domains (project_id, vocabulary_item_id)
     SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
    [ventureId, ids],
  )
}

/** POST /ventures (G2): onboarding DONE required; owner = session profile; DRAFT. */
export async function createVenture(accountId: string, body: unknown): Promise<VentureDTO> {
  const input = parse(body, 'create')
  const state = await getOnboardingState(accountId)
  if (!state.completed) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Complete onboarding before creating a venture.')
  }
  return withTransaction(async (exec) => {
    const profileId = await profileOf(exec, accountId)
    if (!profileId) throw new ApiError('SCOPE_FORBIDDEN', 403, 'No profile.')
    await validateTaxonomy(exec, input, null, [])
    const [created] = await exec<{ id: string }>(
      `INSERT INTO projects (type, owner_profile_id, slug, name, summary, region_id, status)
       VALUES ($1::project_type, $2, $3, $4, $5, $6, 'DRAFT') RETURNING id::text`,
      [
        input.type,
        profileId,
        `v-${randomBytes(9).toString('hex')}`,
        input.name,
        input.summary ?? null,
        input.region_id ?? null,
      ],
    )
    if (input.domain_ids?.length) await replaceDomains(exec, created!.id, input.domain_ids)
    return toDTO(exec, (await readable(exec, created!.id, profileId))!)
  })
}

/** GET /ventures/{id}: owner or ACTIVE member; anyone else gets the same 404. */
export async function getVenture(accountId: string, ventureId: string): Promise<VentureDTO> {
  const profileId = await profileOf(query, accountId)
  const row = profileId ? await readable(query, ventureId, profileId) : null
  if (!row) throw notFound()
  return toDTO(query, row)
}

/** PATCH /ventures/{id}: owner only (`venture:manage`); ARCHIVED read-only (G3). */
export async function updateVenture(
  accountId: string,
  ventureId: string,
  body: unknown,
): Promise<VentureDTO> {
  const input = parse(body, 'update')
  return withTransaction(async (exec) => {
    const profileId = await profileOf(exec, accountId)
    const row = profileId ? await readable(exec, ventureId, profileId, true) : null
    if (!row) throw notFound()
    if (!row.owner)
      throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner can edit this venture.')
    if (row.status === 'ARCHIVED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')
    }
    const linked = (
      await exec<{ id: string }>(
        'SELECT vocabulary_item_id::text AS id FROM project_domains WHERE project_id = $1',
        [row.id],
      )
    ).map((r) => r.id)
    await validateTaxonomy(exec, input, row.region_id, linked)

    const sets: string[] = []
    const values: unknown[] = [row.id]
    const set = (column: string, value: unknown) => {
      values.push(value)
      sets.push(`${column} = $${values.length}`)
    }
    if ('name' in input) set('name', input.name)
    if ('summary' in input) set('summary', input.summary)
    if ('region_id' in input) set('region_id', input.region_id)
    await exec(
      `UPDATE projects SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1`,
      values,
    )
    if (input.domain_ids) await replaceDomains(exec, row.id, input.domain_ids)
    return toDTO(exec, (await readable(exec, row.id, profileId!))!)
  })
}
