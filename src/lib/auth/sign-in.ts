import { getOnboardingState } from '@/lib/onboarding/state'
import { reconcileRoster } from '@/lib/roster/reconcile'

import { createSession } from './sessions'

/**
 * The one way every sign-in method ends (S1-UAT-01): magic link (compatibility),
 * password, registration and Google all converge here, so the session,
 * roster and onboarding rules cannot drift between methods.
 *
 * Callers have already checked the account is ACTIVE. This mints a BRAND-NEW
 * session token every time (session-fixation defence, sessions.ts), never
 * reuses one the browser presented.
 */
export type SignInResponse = {
  result: 'SUCCESS'
  account_created: boolean
  onboarding: { completed: boolean; next_step: string | null }
}

export async function completeSignIn(
  accountId: string,
  accountCreated: boolean,
): Promise<{ response: SignInResponse; sessionToken: string; sessionExpiresAt: Date }> {
  // Known launch-roster emails get their confirmed relationships (Freeze D2).
  // Idempotent; a failure must not block sign-in. Nothing personal is logged.
  try {
    await reconcileRoster(accountId)
  } catch (error) {
    console.error('roster reconciliation failed', (error as { code?: string }).code ?? 'unknown')
  }

  const { token: sessionToken, expiresAt } = await createSession(accountId)

  // The one onboarding resolver decides where the account resumes (DEC-L1R-D3).
  const onboarding = await getOnboardingState(accountId)

  return {
    response: {
      result: 'SUCCESS',
      account_created: accountCreated,
      onboarding: { completed: onboarding.completed, next_step: onboarding.current_step },
    },
    sessionToken,
    sessionExpiresAt: expiresAt,
  }
}
