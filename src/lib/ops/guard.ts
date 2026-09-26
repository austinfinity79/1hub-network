import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { resolveActor } from '@/lib/authz/actor'
import type { Capability } from '@/lib/authz/matrix'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'

import { requireOpsOrganization, type OpsOrganizationContext } from './organizations'
import { hasOpsAccess } from './scope'

/**
 * WF03-T00 — server-side entry check for `/ops/*` pages (DEC-WF03-G11/G15).
 *
 * Same entry as the member area (canonical guard): no session → /auth; an
 * account whose onboarding is not DONE → the one resolver's step. Then the ops
 * scope, read from ACTIVE RoleAssignments on the server:
 * - `requireOps()` — the actor holds `network:read` somewhere (any organization,
 *   or PLATFORM). Otherwise the ops area does not exist for them (404).
 * - `requireOpsOrg(orgId, capability)` — the capability for exactly that
 *   organization. Malformed, unknown, non-operational or out-of-scope ids are
 *   the same 404.
 *
 * The organization in the URL is context only, never authority. This is page
 * routing: every API re-authorizes on its own, and each screen checks its own
 * capability rather than relying on a layout.
 */

async function signedInAccount(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')
  const state = await getOnboardingState(session.accountId)
  if (!state.completed) redirect(routeFor(state))
  return session.accountId
}

export async function requireOps(): Promise<{ accountId: string }> {
  const accountId = await signedInAccount()
  if (!hasOpsAccess(await resolveActor(accountId))) notFound()
  return { accountId }
}

export async function requireOpsOrg(
  orgId: string,
  capability: Capability,
): Promise<{ accountId: string } & OpsOrganizationContext> {
  const accountId = await signedInAccount()
  try {
    return { accountId, ...(await requireOpsOrganization(accountId, orgId, capability)) }
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
}
