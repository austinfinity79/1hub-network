import { withApi } from '@/lib/api/handler'
import type { SessionDTO } from '@/lib/api/types'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { query } from '@/lib/db/client'
import { getProfileCompletion } from '@/lib/profile/completion'

/**
 * GET /api/v1/session — 05:113-149. App bootstrap.
 *
 * M0-T08 replaced the M0-T05 placeholder: this now resolves a real session.
 *
 * The contract permits 200 or 401 when unauthenticated and requires one
 * consistent choice; this keeps the contract's own recommendation of 200 with
 * authenticated=false, so bootstrap needs no error path.
 *
 * `capabilities` and `managed_scopes` are derived server-side by M0-T09 from
 * the actor's active RoleAssignments against the approved authorization matrix.
 * No raw RoleAssignment row is exposed, and nothing is read from the client.
 *
 * The capability list is a UI affordance only: holding a capability here means
 * the actor holds it in at least one scope, never in a particular one, so every
 * protected call still re-authorizes with the concrete resource (API:1094).
 *
 * UserAccount, IndividualProfile and IdentityVerification remain separate: only
 * account identity and profile status are surfaced here.
 */
export const dynamic = 'force-dynamic'

type AccountRow = {
  id: string
  email: string
  status: string
  profile_id: string | null
  profile_status: string | null
  onboarding_completed_at: Date | null
}

export const GET = withApi<SessionDTO>(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))

  if (!session) return { authenticated: false }

  const rows = await query<AccountRow>(
    `SELECT a.id::text, a.email, a.status::text AS status,
            p.id::text AS profile_id, p.status::text AS profile_status,
            p.onboarding_completed_at
     FROM user_accounts a
     LEFT JOIN individual_profiles p ON p.account_id = a.id
     WHERE a.id = $1`,
    [session.accountId],
  )

  const row = rows[0]
  // The session referenced an account that no longer exists.
  if (!row) return { authenticated: false }

  const actor = await resolveActor(session.accountId)
  const capabilities = deriveCapabilities(actor)

  return {
    authenticated: true,
    account: {
      id: row.id,
      email: row.email,
      // IdentityVerification is a separate lifecycle and is not required in P0
      // (Data SOT :186), so this reflects reaching the inbox, nothing more.
      email_verified: true,
      status: row.status,
    },
    profile: {
      id: row.profile_id ?? '',
      status: row.profile_status ?? 'NOT_CREATED',
      onboarding_completed: Boolean(row.onboarding_completed_at),
      // The single completion service (WF01-S06), shared with /me/profile and
      // /me/profile/completion; never accepted from the client.
      completion_percent: (await getProfileCompletion(row.id)).percent,
    },
    capabilities,
    managed_scopes: deriveManagedScopes(actor),
  }
})
