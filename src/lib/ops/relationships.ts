import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { resolveActor, type Actor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { can, require as requireCapability } from '@/lib/authz/authorize'
import { query, withTransaction, type Executor } from '@/lib/db/client'

import { PARENT_RELATIONSHIP } from './hierarchy'
import { ALLOWED_PARENT_PAIRS, RELATIONSHIP_LIMITS } from './relationship-rules'
import { OPS_ORGANIZATION_TYPES, type OrganizationRefDTO } from './organizations'

/**
 * WF03-S08 — organization settings / relationships (API 05 §8.7,
 * DEC-WF03-S08-RELATIONSHIP-CONTRACT, DEC-WF03-S08-D1..D4).
 *
 * Canonical store: `organization_relationships`, type PARENT only, directed
 * source = parent → target = child. `organizations.parent_id` is never read or
 * written. Valid pairs (Design SOT BR-FS03-09, narrower than the task list):
 * HUB → CHAPTER and CHAPTER → CLB. At most one ACTIVE PARENT per child
 * (migration 009 unique index); no self-parent, no cycle.
 *
 * Authority: `org:manage_relationship` on BOTH organizations of the
 * relationship (exact scope, no inheritance); membership, leadership and
 * `org:manage` grant nothing here. Every mutation runs in one transaction
 * behind a hierarchy-wide advisory lock, re-checks everything, and writes the
 * audit events in the same transaction. History is never deleted: closing sets
 * state CLOSED + ended_at; a parent change closes the current row and creates
 * the new one atomically.
 */

const CAPABILITY = 'org:manage_relationship'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Serializes hierarchy writes so the cycle check sees a stable tree. */
const HIERARCHY_LOCK = "SELECT pg_advisory_xact_lock(hashtext('organization_hierarchy'))"

type Org = OrganizationRefDTO & { status: string }

export type RelationshipDTO = {
  id: string
  relationship_type: 'PARENT'
  /** From the viewed organization: PARENT = the counterpart is its parent; CHILD = its child. */
  direction: 'PARENT' | 'CHILD'
  organization: Org
  state: string
  started_at: string
  ended_at: string | null
  close_reason: string | null
  /** Display only: the counterpart is in the actor's scope too (both ends required). */
  manageable: boolean
}

export type OrganizationRelationshipsDTO = {
  organization: Org
  parent: RelationshipDTO | null
  children: RelationshipDTO[]
  history: RelationshipDTO[]
  /** Server-filtered choices; every mutation re-validates. */
  candidates: { children: Org[]; parents: Org[] }
  permissions: Array<typeof CAPABILITY>
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)
const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this organization.')

/** Runs in the caller's transaction when given one, else in a new transaction. */
const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

const pairAllowed = (parentType: string, childType: string) =>
  ALLOWED_PARENT_PAIRS.some(([p, c]) => p === parentType && c === childType)

async function mayManage(actor: Actor, orgId: string) {
  return can(actor, CAPABILITY, { scopeType: 'ORGANIZATION', scopeId: orgId })
}

async function loadOrg(exec: Executor, id: string): Promise<Org | null> {
  if (!UUID.test(id)) return null
  const [org] = await exec<Org>(
    `SELECT id::text, slug, name, type::text AS type, status::text AS status
       FROM organizations WHERE id = $1 AND type::text = ANY($2::text[])`,
    [id, [...OPS_ORGANIZATION_TYPES]],
  )
  return org ?? null
}

type RelRow = {
  id: string
  source: string
  target: string
  state: string
  started_at: Date
  ended_at: Date | null
  close_reason: string | null
}

const REL_COLUMNS = `id::text, source_org_id::text AS source, target_org_id::text AS target,
  state::text AS state, started_at, ended_at, metadata->>'close_reason' AS close_reason`

async function activeParentOf(exec: Executor, childId: string): Promise<RelRow | null> {
  const [row] = await exec<RelRow>(
    `SELECT ${REL_COLUMNS} FROM organization_relationships
      WHERE relationship_type = $1 AND state = 'ACTIVE' AND target_org_id = $2`,
    [PARENT_RELATIONSHIP, childId],
  )
  return row ?? null
}

/** Ancestors of `orgId` along ACTIVE PARENT rows (bounded; the tree is shallow). */
async function ancestorsOf(exec: Executor, orgId: string): Promise<Set<string>> {
  const seen = new Set<string>()
  let current = orgId
  for (let depth = 0; depth < 32; depth++) {
    const parent = await activeParentOf(exec, current)
    if (!parent || seen.has(parent.source)) break
    seen.add(parent.source)
    current = parent.source
  }
  return seen
}

function toDTO(row: RelRow, viewed: string, orgs: Map<string, Org>): RelationshipDTO | null {
  const direction = row.target === viewed ? 'PARENT' : 'CHILD'
  const other = orgs.get(direction === 'PARENT' ? row.source : row.target)
  if (!other) return null
  return {
    id: row.id,
    relationship_type: 'PARENT',
    direction,
    organization: other,
    state: row.state,
    started_at: new Date(row.started_at).toISOString(),
    ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    close_reason: row.close_reason,
    manageable: false,
  }
}

async function readModel(
  exec: Executor,
  actor: Actor,
  org: Org,
): Promise<OrganizationRelationshipsDTO> {
  const rows = await exec<RelRow>(
    `SELECT ${REL_COLUMNS} FROM organization_relationships
      WHERE relationship_type = $1 AND (source_org_id = $2 OR target_org_id = $2)
      ORDER BY started_at DESC, id`,
    [PARENT_RELATIONSHIP, org.id],
  )
  const all = await exec<Org>(
    `SELECT id::text, slug, name, type::text AS type, status::text AS status
       FROM organizations WHERE type::text = ANY($1::text[]) ORDER BY name`,
    [[...OPS_ORGANIZATION_TYPES]],
  )
  const byId = new Map(all.map((o) => [o.id, o]))
  const dtos = rows
    .map((r) => toDTO(r, org.id, byId))
    .filter((r): r is RelationshipDTO => r !== null)
  for (const dto of dtos) {
    if (dto.state === 'ACTIVE') dto.manageable = await mayManage(actor, dto.organization.id)
  }
  const active = dtos.filter((r) => r.state === 'ACTIVE')
  const parent = active.find((r) => r.direction === 'PARENT') ?? null

  const candidates: OrganizationRelationshipsDTO['candidates'] = { children: [], parents: [] }
  if (org.status !== 'ARCHIVED') {
    const ancestors = await ancestorsOf(exec, org.id)
    const withParent = new Set(
      (
        await exec<{ child: string }>(
          `SELECT target_org_id::text AS child FROM organization_relationships
            WHERE relationship_type = $1 AND state = 'ACTIVE'`,
          [PARENT_RELATIONSHIP],
        )
      ).map((r) => r.child),
    )
    for (const other of all) {
      if (other.id === org.id || other.status === 'ARCHIVED') continue
      if (!(await mayManage(actor, other.id))) continue
      // This organization as the parent of `other` (other must be parentless).
      if (
        pairAllowed(org.type, other.type) &&
        !withParent.has(other.id) &&
        !ancestors.has(other.id)
      ) {
        candidates.children.push(other)
      }
      // `other` as the (new) parent of this organization.
      if (
        pairAllowed(other.type, org.type) &&
        other.id !== parent?.organization.id &&
        !(await ancestorsOf(exec, other.id)).has(org.id)
      ) {
        candidates.parents.push(other)
      }
    }
  }

  return {
    organization: org,
    parent,
    children: active.filter((r) => r.direction === 'CHILD'),
    history: dtos.filter((r) => r.state !== 'ACTIVE'),
    candidates,
    permissions: [CAPABILITY],
  }
}

/** GET /ops/organizations/{orgId}/relationships. */
export async function getOrganizationRelationships(
  accountId: string,
  orgId: string,
): Promise<OrganizationRelationshipsDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, CAPABILITY, { scopeType: 'ORGANIZATION', scopeId: orgId })
  const org = await loadOrg(query, orgId)
  if (!org) throw notFound()
  return readModel(query, actor, org)
}

function onlyKeys(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
  }
  return input
}

/**
 * POST /ops/organizations/{orgId}/relationships
 * `{ target_organization_id, relationship_type: 'PARENT', replaces_relationship_id? }`.
 * The path organization is the parent, the target the child (source → target,
 * as stored). `replaces_relationship_id` makes it an explicit parent change:
 * it must name the child's current ACTIVE PARENT, which is closed in the same
 * transaction.
 */
export async function createRelationship(
  accountId: string,
  orgId: string,
  body: unknown,
  requestId: string,
  /** The idempotency claim's transaction, when the call runs under an Idempotency-Key. */
  exec?: Executor,
): Promise<RelationshipDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, CAPABILITY, { scopeType: 'ORGANIZATION', scopeId: orgId })
  const input = onlyKeys(body, [
    'target_organization_id',
    'relationship_type',
    'replaces_relationship_id',
  ])
  if (input.relationship_type !== PARENT_RELATIONSHIP)
    throw invalid('relationship_type', 'not_supported')
  const childId = input.target_organization_id
  if (typeof childId !== 'string' || !UUID.test(childId))
    throw invalid('target_organization_id', 'invalid')
  const replaces = input.replaces_relationship_id
  if (replaces !== undefined && (typeof replaces !== 'string' || !UUID.test(replaces)))
    throw invalid('replaces_relationship_id', 'invalid')
  if (childId === orgId) throw invalid('target_organization_id', 'self')
  // Both ends of the relationship must be in the actor's exact scope.
  if (!(await mayManage(actor, childId))) throw forbidden()

  return inTransaction(exec, async (exec) => {
    await exec(HIERARCHY_LOCK)
    const parent = await loadOrg(exec, orgId)
    const child = await loadOrg(exec, childId)
    if (!parent || !child) throw notFound()
    if (parent.status === 'ARCHIVED' || child.status === 'ARCHIVED')
      throw conflict('An archived organization cannot receive a new relationship.')
    if (!pairAllowed(parent.type, child.type))
      throw invalid('target_organization_id', 'type_not_allowed')

    const current = await activeParentOf(exec, child.id)
    if (current?.source === parent.id) throw conflict('This relationship already exists.')
    if (replaces === undefined && current)
      throw conflict('This organization already has an active parent.')
    if (replaces !== undefined && current?.id !== replaces)
      throw conflict('The parent relationship to replace is no longer current.')
    if ((await ancestorsOf(exec, parent.id)).has(child.id))
      throw invalid('target_organization_id', 'cycle')

    if (current) {
      // The previous parent's side of a change must be in scope as well.
      if (!(await mayManage(actor, current.source))) throw forbidden()
      await exec(
        `UPDATE organization_relationships SET state = 'CLOSED', ended_at = now() WHERE id = $1`,
        [current.id],
      )
      await writeAudit(exec, {
        actorAccountId: accountId,
        action: 'ORGANIZATION_RELATIONSHIP_ENDED',
        resourceType: 'organization_relationship',
        resourceId: current.id,
        before: auditState(current.id, current.source, current.target, 'ACTIVE'),
        after: auditState(current.id, current.source, current.target, 'CLOSED'),
        requestId,
      })
    }

    let created: RelRow | undefined
    try {
      ;[created] = await exec<RelRow>(
        `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type, state)
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING ${REL_COLUMNS}`,
        [parent.id, child.id, PARENT_RELATIONSHIP],
      )
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw conflict('This organization already has an active parent.')
      throw error
    }
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'ORGANIZATION_RELATIONSHIP_CREATED',
      resourceType: 'organization_relationship',
      resourceId: created!.id,
      before: null,
      after: {
        ...auditState(created!.id, parent.id, child.id, 'ACTIVE'),
        ...(current ? { replaces_relationship_id: current.id } : {}),
      },
      requestId,
    })
    return toDTO(created!, parent.id, new Map([[child.id, child]]))!
  })
}

/**
 * POST /ops/organizations/{orgId}/relationships/{relationshipId}/close
 * `{ ended_at?, reason? }` — closes an ACTIVE relationship of this
 * organization, keeping the row (history).
 */
export async function closeRelationship(
  accountId: string,
  orgId: string,
  relationshipId: string,
  body: unknown,
  requestId: string,
  /** The idempotency claim's transaction, when the call runs under an Idempotency-Key. */
  exec?: Executor,
): Promise<RelationshipDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, CAPABILITY, { scopeType: 'ORGANIZATION', scopeId: orgId })
  const input = onlyKeys(body ?? {}, ['ended_at', 'reason'])
  let endedAt: Date | null = null
  if (input.ended_at !== undefined && input.ended_at !== null) {
    if (typeof input.ended_at !== 'string' || Number.isNaN(Date.parse(input.ended_at)))
      throw invalid('ended_at', 'invalid')
    endedAt = new Date(input.ended_at)
    if (endedAt.getTime() > Date.now()) throw invalid('ended_at', 'future')
  }
  let reason: string | null = null
  if (input.reason !== undefined && input.reason !== null) {
    if (typeof input.reason !== 'string') throw invalid('reason', 'invalid')
    reason = input.reason.trim() || null
    if (reason && reason.length > RELATIONSHIP_LIMITS.reason) throw invalid('reason', 'too_long')
  }
  if (!UUID.test(relationshipId)) throw notFound()

  return inTransaction(exec, async (exec) => {
    await exec(HIERARCHY_LOCK)
    const [row] = await exec<RelRow>(
      `SELECT ${REL_COLUMNS} FROM organization_relationships
        WHERE id = $1 AND relationship_type = $2 AND (source_org_id = $3 OR target_org_id = $3)
        FOR UPDATE`,
      [relationshipId, PARENT_RELATIONSHIP, orgId],
    )
    if (!row) throw notFound()
    const otherId = row.source === orgId ? row.target : row.source
    if (!(await mayManage(actor, otherId))) throw forbidden()
    if (row.state !== 'ACTIVE') throw conflict('This relationship is already closed.')
    if (endedAt && endedAt.getTime() < new Date(row.started_at).getTime())
      throw invalid('ended_at', 'before_start')

    const [closed] = await exec<RelRow>(
      `UPDATE organization_relationships
          SET state = 'CLOSED', ended_at = COALESCE($2::timestamptz, now()),
              metadata = CASE WHEN $3::text IS NULL THEN metadata
                              ELSE metadata || jsonb_build_object('close_reason', $3::text) END
        WHERE id = $1
        RETURNING ${REL_COLUMNS}`,
      [row.id, endedAt?.toISOString() ?? null, reason],
    )
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'ORGANIZATION_RELATIONSHIP_ENDED',
      resourceType: 'organization_relationship',
      resourceId: row.id,
      before: auditState(row.id, row.source, row.target, 'ACTIVE'),
      after: auditState(row.id, row.source, row.target, 'CLOSED'),
      requestId,
    })
    const other = await loadOrg(exec, otherId)
    return toDTO(closed!, orgId, new Map(other ? [[other.id, other]] : []))!
  })
}

/** Audit payload: ids, type and state only (no reason text, no names). */
function auditState(id: string, parent: string, child: string, state: string) {
  return {
    relationship_id: id,
    parent_organization_id: parent,
    child_organization_id: child,
    relationship_type: PARENT_RELATIONSHIP,
    state,
  }
}
