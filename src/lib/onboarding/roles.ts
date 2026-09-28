import { ApiError } from '@/lib/api/errors'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { REQUESTABLE_TYPES } from '@/lib/network/membership-request'
import type { OrganizationRef } from '@/lib/network/network'

/**
 * WF01 stage 3 (ACC-08) — what the member declares about themselves
 * (BA workbook row 58; DEC-L1R-D5).
 *
 * Two things are stored, and neither is a permission:
 *
 * - `roles`: the six self-declared ecosystem roles of ACC-08, multi-select.
 *   A profile attribute used for personalisation. It is not a RoleAssignment,
 *   a membership or a leadership record, and authorization never reads it.
 * - `hub_claims`: the HUB units the member names, with the position and period
 *   they state. While onboarding is open this is unsent form data on the
 *   profile. Completing onboarding files one ordinary membership request per
 *   unit (PENDING_APPROVAL, SELF_DECLARED; see `fileClaimedMemberships`), and
 *   the unit decides it in WF03 as any other request.
 *
 * The session's account is the only profile this module reads or writes.
 */

export const DECLARED_ROLES = [
  'HUB_MEMBER',
  'INNOVATOR',
  'STARTUP_FOUNDER',
  'ORGANIZATION_REPRESENTATIVE',
  'INVESTOR_REPRESENTATIVE',
  'INNOVATION_ENTHUSIAST',
] as const

export type DeclaredRole = (typeof DECLARED_ROLES)[number]

/** Provisional TECHNICAL bounds; the board names no limit. */
export const CLAIM_LIMITS = { claims: 5, position: 200, period: 100 } as const

export type HubClaimDTO = {
  organization: OrganizationRef
  position: string | null
  period: string | null
}

export type DeclaredRolesDTO = { roles: DeclaredRole[]; hub_claims: HubClaimDTO[] }

export type StoredClaim = {
  organization_id: string
  position: string | null
  period: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Role declaration is not valid.', {
    [field]: reason,
  })

const isDeclaredRole = (value: unknown): value is DeclaredRole =>
  typeof value === 'string' && (DECLARED_ROLES as readonly string[]).includes(value)

function claimText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw invalid('hub_claims', 'invalid')
  const text = value.trim()
  if (text.length > max) throw invalid('hub_claims', 'too_long')
  return text || null
}

/** Shape validation; no database access, so nothing can be half-written. */
export function parseDeclaration(body: unknown): { roles: DeclaredRole[]; claims: StoredClaim[] } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'invalid')
  }
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (key !== 'roles' && key !== 'hub_claims') throw invalid(key, 'not_supported')
  }
  if (!Array.isArray(input.roles) || !input.roles.every(isDeclaredRole)) {
    throw invalid('roles', 'unsupported')
  }
  const roles = [...new Set(input.roles)]

  const list = input.hub_claims ?? []
  if (!Array.isArray(list)) throw invalid('hub_claims', 'invalid')
  if (list.length > CLAIM_LIMITS.claims) throw invalid('hub_claims', 'too_many')
  const claims = list.map((item): StoredClaim => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw invalid('hub_claims', 'invalid')
    }
    const entry = item as Record<string, unknown>
    for (const key of Object.keys(entry)) {
      if (key !== 'organization_id' && key !== 'position' && key !== 'period') {
        throw invalid('hub_claims', 'invalid')
      }
    }
    if (typeof entry.organization_id !== 'string' || !UUID.test(entry.organization_id)) {
      throw invalid('hub_claims', 'organization_not_available')
    }
    return {
      organization_id: entry.organization_id.toLowerCase(),
      position: claimText(entry.position, CLAIM_LIMITS.position),
      period: claimText(entry.period, CLAIM_LIMITS.period),
    }
  })
  // One open membership per unit (uq_open_membership), so one claim per unit.
  if (new Set(claims.map((c) => c.organization_id)).size !== claims.length) {
    throw invalid('hub_claims', 'duplicate_organization')
  }
  if (claims.length > 0 && !roles.includes('HUB_MEMBER')) {
    throw invalid('hub_claims', 'requires_hub_member')
  }
  return { roles, claims }
}

async function read(exec: Executor, profileId: string): Promise<DeclaredRolesDTO> {
  const roles = await exec<{ role_code: DeclaredRole }>(
    `SELECT role_code FROM profile_declared_roles WHERE profile_id = $1`,
    [profileId],
  )
  // Units that stopped being requestable since the draft was saved are left out.
  const claims = await exec<{
    id: string
    name: string
    type: string
    position: string | null
    period: string | null
  }>(
    `SELECT o.id::text, o.name, o.type::text AS type, c.item->>'position' AS position,
            c.item->>'period' AS period
       FROM individual_profiles p
       CROSS JOIN LATERAL jsonb_array_elements(p.onboarding_hub_claims) WITH ORDINALITY AS c(item, n)
       JOIN organizations o ON o.id = (c.item->>'organization_id')::uuid
      WHERE p.id = $1 AND o.type::text = ANY($2::text[]) AND o.status = 'PUBLISHED'
      ORDER BY c.n`,
    [profileId, REQUESTABLE_TYPES],
  )
  const declared = new Set(roles.map((r) => r.role_code))
  return {
    // The order of ACC-08, not the order of selection.
    roles: DECLARED_ROLES.filter((role) => declared.has(role)),
    hub_claims: claims.map((c) => ({
      organization: { id: c.id, name: c.name, type: c.type },
      position: c.position,
      period: c.period,
    })),
  }
}

/** GET /me/onboarding/roles. An account without a profile has declared nothing. */
export async function getDeclaredRoles(
  accountId: string,
  exec: Executor = query,
): Promise<DeclaredRolesDTO> {
  const [profile] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  return profile ? read(exec, profile.id) : { roles: [], hub_claims: [] }
}

/**
 * PUT /me/onboarding/roles — replaces the declaration as a whole.
 *
 * Works only while onboarding is open: afterwards the claims have become
 * membership requests, which this endpoint must not rewrite. Every named unit
 * must be requestable (HUB, CHAPTER or CLB, PUBLISHED); an id that is unknown,
 * unpublished or of another type is refused alike, so nothing is disclosed.
 * Creates no membership, leadership, RoleAssignment or capability.
 */
export async function saveDeclaredRoles(
  accountId: string,
  body: unknown,
): Promise<DeclaredRolesDTO> {
  const { roles, claims } = parseDeclaration(body)

  return withTransaction(async (exec) => {
    // The first write creates the DRAFT profile; UNIQUE account_id keeps it one per account.
    const [profile] = await exec<{ id: string; status: string; done: boolean }>(
      `INSERT INTO individual_profiles (account_id) VALUES ($1)
       ON CONFLICT (account_id) DO UPDATE SET updated_at = now()
       RETURNING id::text, status::text AS status,
                 (status = 'ACTIVE' AND onboarding_completed_at IS NOT NULL) AS done`,
      [accountId],
    )
    if (profile!.status === 'DEACTIVATED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'Profile is deactivated.')
    }
    if (profile!.done) throw invalid('onboarding', 'completed')

    if (claims.length > 0) {
      const found = await exec<{ id: string }>(
        `SELECT id::text FROM organizations
          WHERE id = ANY($1::uuid[]) AND type::text = ANY($2::text[]) AND status = 'PUBLISHED'`,
        [claims.map((c) => c.organization_id), REQUESTABLE_TYPES],
      )
      if (found.length !== claims.length) throw invalid('hub_claims', 'organization_not_available')
    }

    await exec(
      `DELETE FROM profile_declared_roles
        WHERE profile_id = $1 AND NOT (role_code = ANY($2::text[]))`,
      [profile!.id, roles],
    )
    await exec(
      `INSERT INTO profile_declared_roles (profile_id, role_code)
       SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
      [profile!.id, roles],
    )
    await exec(
      `UPDATE individual_profiles SET onboarding_hub_claims = $2::jsonb, updated_at = now()
        WHERE id = $1`,
      [profile!.id, JSON.stringify(claims)],
    )
    return read(exec, profile!.id)
  })
}
