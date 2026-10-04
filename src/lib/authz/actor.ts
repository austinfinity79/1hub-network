import { query } from '@/lib/db/client'

import {
  isCapability,
  isDelegable,
  isRoleCode,
  type Capability,
  type RoleCode,
  type ScopeType,
} from './matrix'

/**
 * M0-T09 — actor resolution.
 *
 * Everything an authorization decision needs is read from the database using
 * only the authenticated account id from the session cookie. Nothing is read
 * from the request body, the URL or any client-supplied header, so a forged
 * role or scope has nowhere to enter.
 */

export type ActiveAssignment = {
  roleCode: RoleCode
  scopeType: ScopeType
  /** Null for PLATFORM scope. */
  scopeId: string | null
  /**
   * PD-6 delegation: null = the whole role; set = only this capability of the
   * role, on this organization (`role_assignments.capability`).
   */
  capability: Capability | null
}

export type Actor = {
  accountId: string
  /** Null when the account has no profile yet, e.g. mid-onboarding. */
  profileId: string | null
  assignments: ActiveAssignment[]
}

/**
 * Loads the actor with only ACTIVE, currently-valid assignments.
 *
 * Validity is filtered in SQL so an expired or not-yet-started assignment never
 * reaches the decision logic: `valid_from <= now()` and `valid_to` null or in
 * the future, with `state = 'ACTIVE'`.
 *
 * Rows whose role_code is not in the P0 catalogue are discarded. `role_code` is
 * still an untyped text column, so this is the boundary that stops a stray value
 * from becoming authority. The same holds for `capability`: a capability-only
 * row naming an unknown or non-delegable capability, or one that is not
 * organization-scoped, is discarded rather than read as anything (fail closed).
 */
export async function resolveActor(accountId: string): Promise<Actor> {
  const profiles = await query<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  const profileId = profiles[0]?.id ?? null

  if (!profileId) {
    return { accountId, profileId: null, assignments: [] }
  }

  const rows = await query<{
    role_code: string
    scope_type: string
    scope_id: string | null
    capability: string | null
  }>(
    `SELECT role_code, scope_type, scope_id::text, capability
     FROM role_assignments
     WHERE individual_profile_id = $1
       AND state = 'ACTIVE'
       AND valid_from <= now()
       AND (valid_to IS NULL OR valid_to > now())`,
    [profileId],
  )

  const assignments: ActiveAssignment[] = []
  for (const row of rows) {
    if (!isRoleCode(row.role_code)) continue
    if (row.scope_type !== 'PLATFORM' && row.scope_type !== 'ORGANIZATION') continue
    let capability: Capability | null = null
    if (row.capability !== null) {
      if (!isCapability(row.capability) || !isDelegable(row.capability)) continue
      if (row.scope_type !== 'ORGANIZATION' || !row.scope_id) continue
      capability = row.capability
    }

    assignments.push({
      roleCode: row.role_code,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      capability,
    })
  }

  return { accountId, profileId, assignments }
}
