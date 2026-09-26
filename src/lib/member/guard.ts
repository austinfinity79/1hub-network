import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { resolveActor } from '@/lib/authz/actor'
import { query } from '@/lib/db/client'
import { assetUrl, isAssetId, readAssetMeta } from '@/lib/media/avatar-storage'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'
import { hasOpsAccess } from '@/lib/ops/scope'

/**
 * WF02-T00 — server-side entry check for member-shell pages (DEC-WF02-T00-D1).
 *
 * No session → /auth, as the WF01 page guards do. An account whose onboarding
 * is not DONE is sent where the one resolver says it belongs (DEC-WF01-RESUME-D1:
 * `/me` is the DONE destination), so the member area never renders for a
 * half-onboarded account. This is page routing only; every API re-authorizes.
 *
 * Returns only what the shell header shows about the signed-in member, plus
 * whether the account holds an ops scope (P0-SHELL, DEC-P0-SHELL-D3): read from
 * ACTIVE RoleAssignments on the server, never from membership, leadership or
 * titles. It only decides whether the shell shows the "Vận hành tổ chức" entry;
 * /ops re-authorizes on every request.
 */
export type MemberIdentity = {
  accountId: string
  displayName: string
  /** Set only when the owner's avatar file is actually stored. */
  avatarUrl: string | null
  /** Display only: the account may enter /ops (an ops RoleAssignment scope). */
  opsAccess: boolean
}

export async function requireMember(): Promise<MemberIdentity> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  if (!state.completed) redirect(routeFor(state))

  const [row] = await query<{ display_name: string | null; avatar_asset_id: string | null }>(
    'SELECT display_name, avatar_asset_id FROM individual_profiles WHERE account_id = $1',
    [session.accountId],
  )
  const assetId = row?.avatar_asset_id
  // A stale id (e.g. seeded demo data) must not render a broken image.
  let avatarUrl: string | null = null
  if (isAssetId(assetId)) {
    const meta = await readAssetMeta(assetId)
    if (meta?.owner_account_id === session.accountId) avatarUrl = assetUrl(assetId)
  }

  const opsAccess = hasOpsAccess(await resolveActor(session.accountId))
  return {
    accountId: session.accountId,
    displayName: row?.display_name ?? '',
    avatarUrl,
    opsAccess,
  }
}
