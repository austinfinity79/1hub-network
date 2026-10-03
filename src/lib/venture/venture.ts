import { randomBytes } from 'node:crypto'

import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'
import { assertSelectable, type VocabularyStatus } from '@/lib/vocabulary/vocabulary'

/**
 * WF02-S05 — canonical Project/Startup ("Venture" in API 05 §5.3).
 *
 * One `projects` row per venture, reused later by WF05 (never copied per
 * programme). Write model (DEC-L2R-D4..D6): type, name, summary, domain_ids,
 * stage_id, owner_role_label, region_id. Name, summary, one field and the
 * stage are required when a venture is created, and none of them can be
 * cleared later. The owner is the session's profile (`owner_profile_id`,
 * DEC-WF02-S05-G5); no `project_members` row is created for it.
 *
 * Levels (DEC-L2R-D7): OWNER is ownership; EDIT and VIEW belong to an ACTIVE
 * member. `venture:read` = any of the three, `venture:manage` = OWNER or EDIT,
 * `venture:team_manage` = OWNER. A role label, the creator's included, is
 * display text and grants nothing, here or on the platform. Status starts
 * DRAFT and visibility PRIVATE; only the owner's "Công khai" makes a complete
 * venture ACTIVE and PUBLIC (DEC-PDF-D1). DRAFT and ACTIVE are editable,
 * ARCHIVED is read-only (G3); `type` is fixed at creation (G4). Never
 * serialised: slug, metadata, owner or member profile ids.
 */

export const VENTURE_TYPES = ['PROJECT', 'STARTUP'] as const
export type VentureType = (typeof VENTURE_TYPES)[number]

export type VentureCapability = 'venture:read' | 'venture:manage' | 'venture:team_manage'

export type VenturePermission = 'OWNER' | 'EDIT' | 'VIEW'

/** Provisional TECHNICAL bounds; not business rules (DEC-WF02-S05-D1). */
export const VENTURE_LIMITS = { name: 200, summary: 2000, domains: 10, roleLabel: 100 } as const

type Ref = { id: string; label: string; status: VocabularyStatus }

/** A stage carries its stable code (IDEA, MVP, PILOT, SELLING, GROWTH; DEC-PDF-D5). */
type StageRef = Ref & { code: string }

export type VentureVisibility = 'PRIVATE' | 'PUBLIC'

/**
 * What "Công khai" needs (DEC-PDF-D1), in the order the editor names them:
 * name, field, description, stage and the creator's role.
 */
export const PUBLISH_REQUIRED = [
  'name',
  'domain_ids',
  'summary',
  'stage_id',
  'owner_role_label',
] as const

export type VentureDTO = {
  id: string
  type: VentureType
  name: string
  summary: string | null
  status: string
  visibility: VentureVisibility
  stage: StageRef | null
  region: Ref | null
  domains: Ref[]
  relation: 'OWNER' | 'MEMBER'
  /** The viewer's level in this venture. */
  permission: VenturePermission
  /** The role the viewer states in this venture; display text. */
  role_label: string | null
  can_edit: boolean
}

/** One row of "Dự án & startup của tôi" (ME7). `pending_invitations` is the owner's to know. */
export type VentureSummaryDTO = VentureDTO & {
  members: number
  pending_invitations: number | null
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Venture validation failed.', { [field]: reason })

type Input = {
  type?: VentureType
  name?: string
  summary?: string | null
  region_id?: string | null
  domain_ids?: string[]
  stage_id?: string | null
  owner_role_label?: string | null
}

const WRITABLE = [
  'name',
  'summary',
  'region_id',
  'domain_ids',
  'stage_id',
  'owner_role_label',
] as const

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
  if ('summary' in input || mode === 'create') {
    if (input.summary !== undefined && input.summary !== null && typeof input.summary !== 'string')
      throw invalid('summary', 'invalid')
    const text = (input.summary as string | null | undefined)?.trim() || null
    if (!text && mode === 'create') throw invalid('summary', 'required')
    if (text && text.length > VENTURE_LIMITS.summary) throw invalid('summary', 'too_long')
    out.summary = text
  }
  if ('region_id' in input) {
    if (input.region_id !== null && typeof input.region_id !== 'string')
      throw invalid('region_id', 'invalid')
    out.region_id = (input.region_id as string | null)?.toLowerCase() || null
  }
  if ('domain_ids' in input || mode === 'create') {
    const v = input.domain_ids ?? []
    if (!Array.isArray(v) || !v.every((id) => typeof id === 'string'))
      throw invalid('domain_ids', 'invalid')
    const ids = [...new Set(v.map((id) => id.toLowerCase()))]
    if (ids.length === 0 && mode === 'create') throw invalid('domain_ids', 'required')
    if (ids.length > VENTURE_LIMITS.domains) throw invalid('domain_ids', 'too_many')
    out.domain_ids = ids
  }
  if ('stage_id' in input || mode === 'create') {
    if (
      input.stage_id !== undefined &&
      input.stage_id !== null &&
      typeof input.stage_id !== 'string'
    )
      throw invalid('stage_id', 'invalid')
    const id = (input.stage_id as string | null | undefined)?.toLowerCase() || null
    if (!id && mode === 'create') throw invalid('stage_id', 'required')
    out.stage_id = id
  }
  if ('owner_role_label' in input) {
    const value = input.owner_role_label
    if (value !== null && typeof value !== 'string') throw invalid('owner_role_label', 'invalid')
    const text = (value as string | null)?.trim() || null
    if (text && text.length > VENTURE_LIMITS.roleLabel)
      throw invalid('owner_role_label', 'too_long')
    out.owner_role_label = text
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
  visibility: VentureVisibility
  region_id: string | null
  stage_id: string | null
  owner_role_label: string | null
  owner: boolean
  member: boolean
  member_permission: 'EDIT' | 'VIEW' | null
  member_role_label: string | null
}

const COLUMNS = `p.id::text, p.type::text AS type, p.name, p.summary, p.status::text AS status,
            p.visibility::text AS visibility, p.region_id::text, p.stage_id::text, p.owner_role_label,
            p.owner_profile_id = $1::uuid AS owner, m.id IS NOT NULL AS member,
            m.permission AS member_permission, m.role_label AS member_role_label`

/** The viewer's own ACTIVE row, if any; the partial unique index allows one at most. */
const VIEWER_JOIN = `LEFT JOIN project_members m
              ON m.project_id = p.id AND m.profile_id = $1::uuid AND m.state = 'ACTIVE'`

/** The venture as seen by `profileId`, or null when it holds no `venture:read`. */
async function readable(
  exec: Executor,
  ventureId: string,
  profileId: string,
  lock = false,
): Promise<Row | null> {
  // A strict UUID (WF05-PROD-03, G06): a 36-character non-UUID used to reach the
  // ::uuid cast and fail as a 500; it is now the same 404 as an unknown id.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ventureId))
    return null
  const [row] = await exec<Row>(
    `SELECT ${COLUMNS}
       FROM projects p ${VIEWER_JOIN}
      WHERE p.id = $2::uuid ${lock ? 'FOR UPDATE OF p' : ''}`,
    [profileId, ventureId],
  )
  return row && (row.owner || row.member) ? row : null
}

const permissionOf = (row: Row): VenturePermission =>
  row.owner ? 'OWNER' : (row.member_permission ?? 'VIEW')

async function item(exec: Executor, id: string | null): Promise<Ref | null> {
  if (!id) return null
  const [row] = await exec<Ref>(
    'SELECT id::text, label, status::text AS status FROM vocabulary_items WHERE id = $1',
    [id],
  )
  return row ?? null
}

async function stageItem(exec: Executor, id: string | null): Promise<StageRef | null> {
  if (!id) return null
  const [row] = await exec<StageRef>(
    `SELECT id::text, slug AS code, label, status::text AS status
       FROM vocabulary_items WHERE id = $1`,
    [id],
  )
  return row ?? null
}

async function toDTO(exec: Executor, row: Row): Promise<VentureDTO> {
  const region = await item(exec, row.region_id)
  const stage = await stageItem(exec, row.stage_id)
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
    visibility: row.visibility,
    stage,
    region,
    domains,
    relation: row.owner ? 'OWNER' : 'MEMBER',
    permission: permissionOf(row),
    role_label: row.owner ? row.owner_role_label : row.member_role_label,
    can_edit: permissionOf(row) !== 'VIEW' && row.status !== 'ARCHIVED',
  }
}

async function validateTaxonomy(
  exec: Executor,
  input: Input,
  keepRegion: string | null,
  keepDomains: string[],
  keepStage: string | null = null,
): Promise<void> {
  if (input.stage_id) {
    await assertSelectable(
      exec,
      'stage_id',
      'VENTURE_STAGE',
      [input.stage_id],
      new Set(keepStage ? [keepStage] : []),
    )
  }
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

/**
 * POST /ventures inside the caller's transaction (G2): onboarding DONE
 * required; owner = session profile; DRAFT. The idempotent route runs it under
 * its claim, so a repeated request creates nothing new (DEC-L2R-D9).
 */
export async function createVentureIn(
  exec: Executor,
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<VentureDTO> {
  const input = parse(body, 'create')
  // On the caller's connection: it holds the transaction (and the claim).
  const state = await getOnboardingState(accountId, exec)
  if (!state.completed) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Complete onboarding before creating a venture.')
  }
  const profileId = await profileOf(exec, accountId)
  if (!profileId) throw new ApiError('SCOPE_FORBIDDEN', 403, 'No profile.')
  await validateTaxonomy(exec, input, null, [])
  const [created] = await exec<{ id: string }>(
    `INSERT INTO projects
       (type, owner_profile_id, slug, name, summary, region_id, stage_id, owner_role_label, status)
     VALUES ($1::project_type, $2, $3, $4, $5, $6, $7, $8, 'DRAFT') RETURNING id::text`,
    [
      input.type,
      profileId,
      `v-${randomBytes(9).toString('hex')}`,
      input.name,
      input.summary ?? null,
      input.region_id ?? null,
      input.stage_id ?? null,
      input.owner_role_label ?? null,
    ],
  )
  if (input.domain_ids?.length) await replaceDomains(exec, created!.id, input.domain_ids)
  // Ids, type and status only; no free text (audit.ts).
  await writeAudit(exec, {
    actorAccountId: accountId,
    action: 'VENTURE_CREATED',
    resourceType: 'project',
    resourceId: created!.id,
    before: null,
    after: { type: input.type, status: 'DRAFT' },
    requestId,
  })
  return toDTO(exec, (await readable(exec, created!.id, profileId))!)
}

export async function createVenture(
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<VentureDTO> {
  return withTransaction((exec) => createVentureIn(exec, accountId, body, requestId))
}

/**
 * GET /ventures/{id}: owner or ACTIVE member; anyone else gets the same 404.
 * `exec` lets a caller's transaction read on its own connection (WF05-PROD-03).
 */
export async function getVenture(
  accountId: string,
  ventureId: string,
  exec: Executor = query,
): Promise<VentureDTO> {
  const profileId = await profileOf(exec, accountId)
  const row = profileId ? await readable(exec, ventureId, profileId) : null
  if (!row) throw notFound()
  return toDTO(exec, row)
}

/**
 * PATCH /ventures/{id}: `venture:manage` = the owner or a member with EDIT;
 * the creator's own role is the owner's to state; ARCHIVED read-only (G3).
 */
export async function updateVenture(
  accountId: string,
  ventureId: string,
  body: unknown,
  requestId: string,
): Promise<VentureDTO> {
  const input = parse(body, 'update')
  return withTransaction(async (exec) => {
    const profileId = await profileOf(exec, accountId)
    const row = profileId ? await readable(exec, ventureId, profileId, true) : null
    if (!row) throw notFound()
    if (permissionOf(row) === 'VIEW') {
      throw new ApiError('SCOPE_FORBIDDEN', 403, 'This venture is read-only for you.')
    }
    if ('owner_role_label' in input && !row.owner) {
      throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner states the owner role.')
    }
    if (row.status === 'ARCHIVED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')
    }
    const linked = (
      await exec<{ id: string }>(
        'SELECT vocabulary_item_id::text AS id FROM project_domains WHERE project_id = $1',
        [row.id],
      )
    ).map((r) => r.id)
    // A required value stays once it exists; older ventures keep what they have.
    if ('summary' in input && !input.summary && row.summary) throw invalid('summary', 'required')
    if ('stage_id' in input && !input.stage_id && row.stage_id)
      throw invalid('stage_id', 'required')
    if (input.domain_ids?.length === 0 && linked.length > 0) throw invalid('domain_ids', 'required')
    // A public venture keeps what made it eligible (DEC-PDF-D1).
    if (row.visibility === 'PUBLIC' && 'owner_role_label' in input && !input.owner_role_label)
      throw invalid('owner_role_label', 'required')
    await validateTaxonomy(exec, input, row.region_id, linked, row.stage_id)

    const sets: string[] = []
    const values: unknown[] = [row.id]
    const set = (column: string, value: unknown) => {
      values.push(value)
      sets.push(`${column} = $${values.length}`)
    }
    if ('name' in input) set('name', input.name)
    if ('summary' in input) set('summary', input.summary)
    if ('region_id' in input) set('region_id', input.region_id)
    if ('stage_id' in input) set('stage_id', input.stage_id)
    if ('owner_role_label' in input) set('owner_role_label', input.owner_role_label)
    // Nothing named, nothing written: no update and no audit event.
    if (sets.length === 0 && !input.domain_ids)
      return toDTO(exec, (await readable(exec, row.id, profileId!))!)
    await exec(
      `UPDATE projects SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1`,
      values,
    )
    if (input.domain_ids) await replaceDomains(exec, row.id, input.domain_ids)
    // Field names only; no value is copied into the audit trail.
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'VENTURE_UPDATED',
      resourceType: 'project',
      resourceId: row.id,
      before: { status: row.status },
      after: { status: row.status, fields: Object.keys(input).sort() },
      requestId,
    })
    return toDTO(exec, (await readable(exec, row.id, profileId!))!)
  })
}

/**
 * POST /ventures/{id}/publish — "Công khai" (DEC-PDF-D1). The owner only: a
 * member gets 403 and anyone else the same 404. The venture must hold a name,
 * a field, a description, a stage and the creator's role; otherwise 422 names
 * what is missing and nothing changes. Publishing makes a DRAFT ACTIVE and the
 * venture PUBLIC in one step; a PUBLIC venture answers as it is. ARCHIVED is
 * read-only. No review or approval exists in Alpha.
 */
export async function publishVenture(
  accountId: string,
  ventureId: string,
  requestId: string,
): Promise<VentureDTO> {
  return withTransaction(async (exec) => {
    const profileId = await profileOf(exec, accountId)
    const row = profileId ? await readable(exec, ventureId, profileId, true) : null
    if (!row) throw notFound()
    if (!row.owner) {
      throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner makes this venture public.')
    }
    if (row.status === 'ARCHIVED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')
    }
    if (row.visibility === 'PUBLIC') return toDTO(exec, row)
    const [{ domains } = { domains: 0 }] = await exec<{ domains: number }>(
      'SELECT count(*)::int AS domains FROM project_domains WHERE project_id = $1',
      [row.id],
    )
    const present: Record<(typeof PUBLISH_REQUIRED)[number], boolean> = {
      name: Boolean(row.name?.trim()),
      domain_ids: domains > 0,
      summary: Boolean(row.summary?.trim()),
      stage_id: Boolean(row.stage_id),
      owner_role_label: Boolean(row.owner_role_label?.trim()),
    }
    const missing = PUBLISH_REQUIRED.filter((field) => !present[field])
    if (missing.length > 0) {
      throw new ApiError(
        'PROFILE_VALIDATION_FAILED',
        422,
        'This venture is not complete enough to be public.',
        Object.fromEntries(missing.map((field) => [field, 'required'])),
      )
    }
    const status = row.status === 'DRAFT' ? 'ACTIVE' : row.status
    await exec(
      `UPDATE projects SET status = $2::project_status, visibility = 'PUBLIC', updated_at = now()
        WHERE id = $1`,
      [row.id, status],
    )
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'VENTURE_PUBLISHED',
      resourceType: 'project',
      resourceId: row.id,
      before: { status: row.status, visibility: row.visibility },
      after: { status, visibility: 'PUBLIC' },
      requestId,
    })
    return toDTO(exec, (await readable(exec, row.id, profileId!))!)
  })
}

/**
 * GET /me/ventures (05 §5.3): the ventures the account owns or belongs to as
 * an ACTIVE member, owned ones first, then by name. A pending invitation is
 * not a relation and is not listed here.
 */
export async function listOwnVentures(accountId: string): Promise<VentureSummaryDTO[]> {
  const profileId = await profileOf(query, accountId)
  if (!profileId) return []
  const rows = await query<Row & { members: number; pending: number }>(
    `SELECT ${COLUMNS},
            1 + (SELECT count(*)::int FROM project_members x
                  WHERE x.project_id = p.id AND x.state = 'ACTIVE'
                    AND x.profile_id <> p.owner_profile_id) AS members,
            (SELECT count(*)::int FROM project_members x
              WHERE x.project_id = p.id AND x.state = 'PENDING_CONFIRMATION') AS pending
       FROM projects p ${VIEWER_JOIN}
      WHERE p.owner_profile_id = $1::uuid OR m.id IS NOT NULL
      ORDER BY (p.owner_profile_id = $1::uuid) DESC, p.name, p.id`,
    [profileId],
  )
  return Promise.all(
    rows.map(async (row) => ({
      ...(await toDTO(query, row)),
      members: row.members,
      pending_invitations: row.owner ? row.pending : null,
    })),
  )
}
