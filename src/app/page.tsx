import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'

/**
 * M0-ENTRY-01 — `/` is routing infrastructure, not a screen.
 *
 * Replaces the M0-T01 bootstrap placeholder. Server-side only, so nothing
 * renders before the redirect:
 * - no valid session (missing, expired or revoked) → /auth;
 * - otherwise the ONE onboarding resolver decides (DEC-WF01-RESUME-D1):
 *   the first incomplete WF01 step, or /me once onboarding is DONE.
 */
export const dynamic = 'force-dynamic'

export default async function RootEntry(): Promise<never> {
  const session = await resolveSession((await cookies()).get(SESSION_COOKIE_NAME)?.value)
  if (!session) redirect('/auth')
  redirect(routeFor(await getOnboardingState(session.accountId)))
}
