import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { resolveActor } from '@/lib/authz/actor'
import type { Capability } from '@/lib/authz/matrix'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'

import { requireOpsOrganization, type OpsOrganizationContext } from './organizations'
import { hasOpsAccess, organizationScope } from './scope'

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

/**
 * ADMIN-PROD-06 — the six platform-admin queues (05 §26–28) have no single
 * organization context, so they get their own entry check rather than
 * `requireOps` (`network:read`): any of the six (platform-wide, or on at least
 * one organization) admits the actor to `/ops/admin/*`; holding none is the
 * same 404 as having no ops access at all. Each page's own API call is still
 * the authority for that one capability.
 */
export async function requireOpsAdmin(): Promise<{
  accountId: string
  capabilities: Capability[]
}> {
  const accountId = await signedInAccount()
  const actor = await resolveActor(accountId)
  const capabilities = (
    [
      'verification:review',
      'access:delegate',
      'venture:review',
      'feedback:manage',
      'vocabulary:manage',
      'account:administer',
    ] as const
  ).filter((c) => {
    const scope = organizationScope(actor, c)
    return scope.kind === 'ALL' || scope.organizationIds.length > 0
  })
  if (capabilities.length === 0) notFound()
  return { accountId, capabilities }
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
