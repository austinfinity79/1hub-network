import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { isCapability, isDelegable, ruleFor, type Capability } from '@/lib/authz/matrix'
import { withTransaction, type Executor } from '@/lib/db/client'
import { OPS_ORGANIZATION_TYPES } from '@/lib/ops/organizations'

import { writeAdminAudit } from './admin-audit'
import { isUuid, parentOf } from './hierarchy'
import { holdsAt, holdsPlatform, holdsRoleAt } from './scope'

/**
 * ADMIN-PROD-02 — scoped delegation (PD-6; ADMIN-PROD-01 delegation contract).
 *
 * The grant record is the existing `role_assignments` row: grantee =
 * `individual_profile_id`, scope_org = `scope_id` (ORGANIZATION), grantor =
 * `assigned_by`, created_at = `valid_from`, revoked_at = `valid_to` with state
 * CLOSED, and the new `capability`: null grants the whole role, a value grants
 * only that capability of it. The only organization role with capabilities is
 * HUB_COMMUNITY_LEADER, so it is the only grantable role; nothing
 * platform-scoped is ever granted here.
 *
 * Grant, all checked on the server, in one transaction, the target unit locked:
 *   authority  PLATFORM_ADMIN, or `access:delegate` on the target unit or on its
 *              canonical parent — own unit or a direct child: HUB Tổng →
 *              Chapter, Chapter → CLB, CLB → itself. Never a parent, a sibling,
 *              another branch or a grandchild.
 *   ceiling    a capability must be delegable and held by the grantor on that
 *              source unit; the whole role only by a holder of the whole role
 *              there. `access:delegate` is not delegable, so a capability-only
 *              grantee can never pass anything on.
 *   self       a grantor never grants to itself (422): self-grants on a child
 *              would chain authority down to a grandchild.
 *   lifecycle  the target is a community unit and not ARCHIVED, nor is the
 *              source unit (409); the grantee an ACTIVE profile of an ACTIVE
 *              account (422); no live identical grant exists (409).
 *   race       the grantor's source assignment is re-read FOR SHARE inside the
 *              transaction, so a revocation committed first refuses the grant.
 * Revoke (ADMIN-DECISION-02): only a CURRENT holder of `access:delegate` on
 * exactly the grant's unit (a same-unit co-leader), or PLATFORM_ADMIN. Never
 * from a parent, child or sibling unit, and never on historical grantorship
 * alone: a grantor who no longer holds `access:delegate` there is refused. The
 * revoker's assignment is re-read FOR SHARE after the unit is locked, so a
 * concurrent loss of authority wins. ACTIVE → CLOSED with `valid_to` now. Only the
 * grantable role's rows (HUB_COMMUNITY_LEADER, whole or capability) are revocable
 * here; other role rows of the unit (e.g. HUB_MEMBER from the roster) are not access.
 * Every grant and revoke writes ACCESS_GRANTED / ACCESS_REVOKED with grantor,
 * grantee, role / capability and scope. A refused call writes nothing.
 */

export const DELEGABLE_ROLE = 'HUB_COMMUNITY_LEADER' as const

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

export type AccessGrantRecord = {
  id: string
  organization_id: string
  grantee_profile_id: string
  role_code: string
  capability: Capability | null
  granted_by_profile_id: string | null
  state: 'ACTIVE' | 'CLOSED'
  created_at: string
  revoked_at: string | null
}

type GrantRow = {
  id: string
  scope_id: string
  individual_profile_id: string
  role_code: string
  capability: string | null
  assigned_by: string | null
  state: string
  valid_from: Date
  valid_to: Date | null
}

const GRANT_COLUMNS = `id::text, scope_id::text, individual_profile_id::text, role_code, capability,
  assigned_by::text, state::text AS state, valid_from, valid_to`

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)

function toRecord(row: GrantRow): AccessGrantRecord {
  return {
    id: row.id,
    organization_id: row.scope_id,
    grantee_profile_id: row.individual_profile_id,
    role_code: row.role_code,
    capability: row.capability as Capability | null,
    granted_by_profile_id: row.assigned_by,
    state: row.state === 'ACTIVE' ? 'ACTIVE' : 'CLOSED',
    created_at: new Date(row.valid_from).toISOString(),
    revoked_at: row.valid_to ? new Date(row.valid_to).toISOString() : null,
  }
}

/**
 * The unit the actor delegates FROM for a target: 'PLATFORM', the target itself,
 * or its canonical parent; null when the actor has no reach there. Authority
 * comes from the actor's database assignments only.
 */
export async function delegationSourceFor(
  exec: Executor,
  actor: Actor | null,
  targetOrgId: string,
): Promise<'PLATFORM' | string | null> {
  if (!isUuid(targetOrgId)) return null
  if (holdsPlatform(actor, 'access:delegate')) return 'PLATFORM'
  if (holdsAt(actor, 'access:delegate', targetOrgId)) return targetOrgId.toLowerCase()
  const parent = await parentOf(exec, targetOrgId)
  return parent && holdsAt(actor, 'access:delegate', parent) ? parent : null
}

/**
 * ADMIN-DECISION-02 — the scope a revocation on `orgId` is authorized from:
 * 'PLATFORM', or `orgId` itself when the actor currently holds
 * `access:delegate` on exactly that unit; null otherwise. Unlike a grant, a
 * parent unit never qualifies, and neither does having made the grant.
 */
export function revocationSourceFor(
  actor: Actor | null,
  orgId: string,
): 'PLATFORM' | string | null {
  if (!isUuid(orgId)) return null
  if (holdsPlatform(actor, 'access:delegate')) return 'PLATFORM'
  return holdsAt(actor, 'access:delegate', orgId) ? orgId.toLowerCase() : null
}

/**
 * Re-reads, locked FOR SHARE in the caller's transaction, the whole-role
 * assignment that gives the grantor (or revoker) `access:delegate` at its source. A
 * concurrent revocation either commits first (and this finds nothing) or waits
 * for this transaction.
 */
async function grantorStillHolds(
  exec: Executor,
  profileId: string,
  source: 'PLATFORM' | string,
): Promise<boolean> {
  const rule = ruleFor('access:delegate')!
  const platform = source === 'PLATFORM'
  const rows = await exec<{ id: string }>(
    `SELECT id::text FROM role_assignments
      WHERE individual_profile_id = $1 AND capability IS NULL
        AND role_code = ANY($2::text[])
        AND scope_type = $3 AND scope_id IS NOT DISTINCT FROM $4::uuid
        AND state = 'ACTIVE' AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
      FOR SHARE`,
    [
      profileId,
      platform ? rule.platformRoles : rule.organizationRoles,
      platform ? 'PLATFORM' : 'ORGANIZATION',
      platform ? null : source,
    ],
  )
  return rows.length > 0
}

export async function grantAccess(
  accountId: string,
  input: { organizationId: string; granteeProfileId: string; capability: string | null },
  requestId: string,
  exec?: Executor,
): Promise<AccessGrantRecord> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  if (input.capability !== null) {
    if (!isCapability(input.capability) || !isDelegable(input.capability)) {
      throw invalid('capability', 'not_delegable')
    }
  }
  const capability = input.capability as Capability | null
  if (!isUuid(input.granteeProfileId)) throw invalid('grantee_profile_id', 'invalid')
  if (input.granteeProfileId.toLowerCase() === actor.profileId) {
    throw invalid('grantee_profile_id', 'self')
  }

  return inTransaction(exec, async (exec) => {
    const source = await delegationSourceFor(exec, actor, input.organizationId)
    if (!source) throw forbidden()

    const [org] = await exec<{ id: string; status: string }>(
      `SELECT id::text, status::text AS status FROM organizations
        WHERE id = $1 AND type::text = ANY($2::text[]) FOR UPDATE`,
      [input.organizationId, [...OPS_ORGANIZATION_TYPES]],
    )
    if (!org) throw source === 'PLATFORM' ? notFound() : forbidden()
    if (org.status === 'ARCHIVED') throw conflict('This organization is archived.')

    if (source !== 'PLATFORM') {
      const held =
        capability === null
          ? holdsRoleAt(actor, DELEGABLE_ROLE, source)
          : holdsAt(actor, capability, source)
      if (!held) throw forbidden()
      if (source !== org.id) {
        const [from] = await exec<{ status: string }>(
          `SELECT status::text AS status FROM organizations WHERE id = $1`,
          [source],
        )
        if (from?.status === 'ARCHIVED') throw conflict('This organization is archived.')
      }
    }
    if (!(await grantorStillHolds(exec, actor.profileId!, source))) throw forbidden()

    const [grantee] = await exec<{ id: string; account_id: string }>(
      `SELECT p.id::text, p.account_id::text FROM individual_profiles p
         JOIN user_accounts a ON a.id = p.account_id
        WHERE p.id = $1 AND p.status = 'ACTIVE' AND a.status = 'ACTIVE'`,
      [input.granteeProfileId],
    )
    if (!grantee) throw invalid('grantee_profile_id', 'not_available')

    const live = await exec<{ id: string }>(
      `SELECT id::text FROM role_assignments
        WHERE individual_profile_id = $1 AND scope_type = 'ORGANIZATION' AND scope_id = $2
          AND role_code = $3 AND capability IS NOT DISTINCT FROM $4::text
          AND state = 'ACTIVE' AND (valid_to IS NULL OR valid_to > now())`,
      [grantee.id, org.id, DELEGABLE_ROLE, capability],
    )
    if (live.length > 0) throw conflict('This access is already granted.')

    const [row] = await exec<GrantRow>(
      `INSERT INTO role_assignments
         (account_id, individual_profile_id, role_code, scope_type, scope_id, capability, assigned_by)
       VALUES ($1, $2, $3, 'ORGANIZATION', $4, $5, $6)
       RETURNING ${GRANT_COLUMNS}`,
      [grantee.account_id, grantee.id, DELEGABLE_ROLE, org.id, capability, actor.profileId],
    )
    await writeAdminAudit(exec, {
      actorAccountId: accountId,
      action: 'ACCESS_GRANTED',
      target: { type: 'role_assignment', id: row!.id },
      organizationId: org.id,
      after: {
        state: 'ACTIVE',
        grantee_profile_id: grantee.id,
        grantor_profile_id: actor.profileId,
        role_code: DELEGABLE_ROLE,
        capability,
        source: source === 'PLATFORM' ? 'PLATFORM' : source,
      },
      requestId,
    })
    return toRecord(row!)
  })
}

export async function revokeAccess(
  accountId: string,
  input: { organizationId: string; grantId: string },
  requestId: string,
  exec?: Executor,
): Promise<AccessGrantRecord> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  if (!isUuid(input.organizationId) || !isUuid(input.grantId)) throw forbidden()

  return inTransaction(exec, async (exec) => {
    const source = revocationSourceFor(actor, input.organizationId)
    // A foreign unit and an unknown grant answer alike, so nothing is enumerable.
    if (!source) throw forbidden()
    // Unit first, as grantAccess does: grants and revocations on one unit
    // serialize, so two co-leaders revoking each other cannot deadlock.
    const [org] = await exec<{ id: string }>(
      `SELECT id::text FROM organizations WHERE id = $1 AND type::text = ANY($2::text[]) FOR UPDATE`,
      [input.organizationId, [...OPS_ORGANIZATION_TYPES]],
    )
    if (!org) throw source === 'PLATFORM' ? notFound() : forbidden()
    const [row] = await exec<GrantRow>(
      `SELECT ${GRANT_COLUMNS} FROM role_assignments
        WHERE id = $1 AND scope_type = 'ORGANIZATION' AND scope_id = $2 AND role_code = $3
        FOR UPDATE`,
      [input.grantId, input.organizationId, DELEGABLE_ROLE],
    )
    if (!row) throw notFound()
    if (!(await grantorStillHolds(exec, actor.profileId!, source))) throw forbidden()
    if (row.state !== 'ACTIVE' || (row.valid_to && new Date(row.valid_to) <= new Date())) {
      throw conflict('This access is not active.')
    }

    const [updated] = await exec<GrantRow>(
      `UPDATE role_assignments SET state = 'CLOSED', valid_to = now()
        WHERE id = $1 RETURNING ${GRANT_COLUMNS}`,
      [row.id],
    )
    await writeAdminAudit(exec, {
      actorAccountId: accountId,
      action: 'ACCESS_REVOKED',
      target: { type: 'role_assignment', id: row.id },
      organizationId: row.scope_id,
      before: { state: 'ACTIVE' },
      after: {
        state: 'CLOSED',
        grantee_profile_id: row.individual_profile_id,
        grantor_profile_id: row.assigned_by,
        role_code: row.role_code,
        capability: row.capability,
      },
      requestId,
    })
    return toRecord(updated!)
  })
}
