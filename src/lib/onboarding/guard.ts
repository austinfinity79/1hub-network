import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'

import {
  canOpen,
  getOnboardingState,
  routeFor,
  type OnboardingState,
  type OnboardingStep,
} from './state'

/**
 * Server guard of the onboarding screens ACC-05 … ACC-09 (DEC-L1R-D3).
 *
 * No session → /auth. Onboarding complete → /me. A stage that lies ahead of
 * the account's current step → the current step: a stage opens only once the
 * stages before it are passed, and an earlier stage stays open for edits. The
 * guard is a convenience; every API call re-checks on the server.
 */
export async function requireOnboardingStage(
  step: OnboardingStep,
): Promise<{ accountId: string; state: OnboardingState }> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  if (state.completed) redirect('/me')
  if (!canOpen(state, step)) redirect(routeFor(state))
  return { accountId: session.accountId, state }
}
