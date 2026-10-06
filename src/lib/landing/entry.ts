import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'

/**
 * P0-LANDING — the only data the public homepage reads (DEC-P0-LANDING-D1..D3).
 *
 * - The visitor's own entry point: a guest goes to /auth; a signed-in account
 *   goes wherever the ONE onboarding resolver sends it (the first incomplete
 *   WF01 step, or /me). No role, scope or ops shortcut is read or shown.
 * No member, count or private data.
 */

export type LandingEntry =
  { kind: 'GUEST'; href: '/auth' } | { kind: 'MEMBER'; href: string; onboarded: boolean }

export async function landingEntry(sessionToken: string | undefined): Promise<LandingEntry> {
  const session = await resolveSession(sessionToken)
  if (!session) return { kind: 'GUEST', href: '/auth' }
  const state = await getOnboardingState(session.accountId)
  return { kind: 'MEMBER', href: routeFor(state), onboarded: state.completed }
}

export { SESSION_COOKIE_NAME }
