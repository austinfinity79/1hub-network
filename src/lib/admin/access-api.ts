import { ApiError, unauthenticated } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { query } from '@/lib/db/client'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { DELEGABLE_ROLE, delegationSourceFor } from './delegation'
import { isUuid } from './hierarchy'

/**
 * ADMIN-PROD-04 — reading a unit's delegated access (PD-6). Grant and revoke are
 * `grantAccess` / `revokeAccess` (ADMIN-PROD-02). Who may read = who may grant
 * there: PLATFORM_ADMIN, or `access:delegate` on the unit or on its canonical
 * parent (own unit / direct child). Anyone else, and an unknown or malformed
 * unit, gets the same 403. Rows are the unit's grantable-role assignments
 * (HUB_COMMUNITY_LEADER, whole or capability-only); grantees appear through
 * PROFILE_DISCOVERY; no e-mail or account id. Grant notices are deferred: the
 * notification contract has no such type (§22).
 */

const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })

export type AccessGrantDTO = {
  id: string
  role_code: string
  /** Null = the whole role. */
  capability: string | null
  grantee: { profile_id: string; display_name: string | null }
  granted_by_profile_id: string | null
  created_at: string
  revoked_at: string | null
  state: 'ACTIVE' | 'CLOSED'
  /** ACTIVE and inside its validity window now. */
  effective: boolean
  can_revoke: boolean
}

async function authorizedFor(accountId: string, orgId: string): Promise<Actor> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  if (!isUuid(orgId) || !(await delegationSourceFor(query, actor, orgId))) throw forbidden()
  const [org] = await query<{ id: string }>(
    `SELECT id::text FROM organizations WHERE id = $1 AND type::text IN ('HUB', 'CHAPTER', 'CLB')`,
    [orgId],
  )
  if (!org) throw forbidden()
  return actor
}

async function names(profileIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(profileIds)]
  const rows = await query<{ id: string; display_name: string | null }>(
    `SELECT id::text, display_name FROM individual_profiles WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  const levels = await discoveryLevelsOf(query, ids)
  return new Map(
    rows.map((r) => [
      r.id,
      projectDiscovery(
        {
          profile_id: r.id,
          display_name: r.display_name,
          avatar_asset_id: null,
          headline: null,
          bio: null,
          domain_ids: [],
          region_id: null,
        },
        levels.get(r.id) ?? 'NETWORK_ONLY',
        'NETWORK',
      )?.display_name ?? null,
    ]),
  )
}

/** POST …/access body: `{ grantee_profile_id, capability? }` (null or absent = the whole role). */
export function parseGrantBody(body: unknown): {
  granteeProfileId: string
  capability: string | null
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (key !== 'grantee_profile_id' && key !== 'capability') throw invalid(key, 'not_accepted')
  }
  if (typeof input.grantee_profile_id !== 'string') throw invalid('grantee_profile_id', 'invalid')
  if (
    input.capability !== undefined &&
    input.capability !== null &&
    typeof input.capability !== 'string'
  )
    throw invalid('capability', 'invalid')
  return {
    granteeProfileId: input.grantee_profile_id,
    capability: (input.capability as string | null | undefined) ?? null,
  }
}

const STATES = ['ACTIVE', 'CLOSED', 'ALL'] as const

/** GET /ops/organizations/{orgId}/access `?state=ACTIVE|CLOSED|ALL` (default ACTIVE). */
export async function listAccess(
  accountId: string,
  orgId: string,
  params: URLSearchParams,
): Promise<{ items: AccessGrantDTO[] }> {
  const actor = await authorizedFor(accountId, orgId)
  for (const key of new Set(params.keys())) {
    if (key !== 'state') throw invalid(key, 'not_accepted')
    if (params.getAll(key).length > 1) throw invalid(key, 'duplicate')
  }
  const state = params.get('state') ?? 'ACTIVE'
  if (!(STATES as readonly string[]).includes(state)) throw invalid('state', 'invalid')
  const rows = await query<{
    id: string
    role_code: string
    capability: string | null
    grantee: string
    granted_by: string | null
    valid_from: Date
    valid_to: Date | null
    state: string
    effective: boolean
  }>(
    `SELECT id::text, role_code, capability, individual_profile_id::text AS grantee,
            assigned_by::text AS granted_by, valid_from, valid_to, state::text AS state,
            (state = 'ACTIVE' AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())) AS effective
       FROM role_assignments
      WHERE scope_type = 'ORGANIZATION' AND scope_id = $1 AND role_code = $2
        AND ($3 = 'ALL' OR ($3 = 'ACTIVE') = (state = 'ACTIVE'))
      ORDER BY valid_from, id`,
    [orgId, DELEGABLE_ROLE, state],
  )
  const display = await names(rows.map((r) => r.grantee))
  const manager = (await delegationSourceFor(query, actor, orgId)) !== null
  return {
    items: rows.map((r) => ({
      id: r.id,
      role_code: r.role_code,
      capability: r.capability,
      grantee: { profile_id: r.grantee, display_name: display.get(r.grantee) ?? null },
      granted_by_profile_id: r.granted_by,
      created_at: new Date(r.valid_from).toISOString(),
      revoked_at: r.valid_to ? new Date(r.valid_to).toISOString() : null,
      state: r.state === 'ACTIVE' ? 'ACTIVE' : 'CLOSED',
      effective: r.effective,
      can_revoke: r.state === 'ACTIVE' && (manager || r.granted_by === actor.profileId),
    })),
  }
}

export type AccessHistoryEntry = {
  event: 'GRANTED' | 'REVOKED'
  at: string
  grant_id: string
  actor_profile_id: string | null
  grantee_profile_id: string | null
  role_code: string | null
  capability: string | null
}

/** GET /ops/organizations/{orgId}/access/history — every grant and revocation of the unit, oldest first. */
export async function accessHistory(
  accountId: string,
  orgId: string,
): Promise<{ items: AccessHistoryEntry[] }> {
  await authorizedFor(accountId, orgId)
  const rows = await query<{
    action: string
    created_at: Date
    resource_id: string
    actor_profile_id: string | null
    after_data: Record<string, unknown>
  }>(
    `SELECT e.action, e.created_at, e.resource_id::text, p.id::text AS actor_profile_id, e.after_data
       FROM audit_events e
       LEFT JOIN individual_profiles p ON p.account_id = e.actor_account_id
      WHERE e.action IN ('ACCESS_GRANTED', 'ACCESS_REVOKED') AND e.resource_type = 'role_assignment'
        AND e.after_data->>'organization_id' = $1
      ORDER BY e.created_at, e.id`,
    [orgId.toLowerCase()],
  )
  const text = (value: unknown) => (typeof value === 'string' ? value : null)
  return {
    items: rows.map((r) => ({
      event: r.action === 'ACCESS_GRANTED' ? 'GRANTED' : 'REVOKED',
      at: new Date(r.created_at).toISOString(),
      grant_id: r.resource_id,
      actor_profile_id: r.actor_profile_id,
      grantee_profile_id: text(r.after_data.grantee_profile_id),
      role_code: text(r.after_data.role_code),
      capability: text(r.after_data.capability),
    })),
  }
}
