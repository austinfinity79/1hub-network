import { rememberReturnPath } from './return-path'

/**
 * Where a browser goes after ANY sign-in (S1-UAT-01: password, sign-up, Google,
 * and the compatibility magic link). Moved from the WF01-S03 callback so every
 * method follows the one rule (US-01.03 step 5: "Về redirect, hoặc /me, hoặc
 * onboarding nếu chưa hoàn tất"; BD-02 return-to rule): onboarding first,
 * carrying a safe return path in this tab; a finished account goes straight
 * back to that path, otherwise to /me. Browser-safe, no imports beyond storage.
 */

export type SignInResult = {
  result: 'SUCCESS'
  account_created: boolean
  onboarding: { completed: boolean; next_step: string | null }
}

export type Destination = 'onboarding' | 'account' | 'return'

/** The four-stage onboarding steps as the sign-in response names them (DEC-L1R-D3). */
const ONBOARDING_ROUTES: Record<string, string> = {
  INTRO: '/onboarding',
  BASIC: '/onboarding/profile',
  CAPABILITY: '/onboarding/capability',
  ROLE: '/onboarding/purpose',
  REVIEW: '/onboarding/privacy',
}

export function nextRoute(onboarding: SignInResult['onboarding']): string {
  if (onboarding.completed) return '/me'
  return ONBOARDING_ROUTES[onboarding.next_step ?? ''] ?? '/onboarding'
}

/**
 * Resolves the destination for `result`, given an already-validated return
 * path (or null). An unfinished account keeps the path in `tabStorage` for the
 * onboarding exit (ACC-10) and resumes onboarding first.
 */
export function afterSignIn(
  result: SignInResult,
  back: string | null,
  tabStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): { path: string; destination: Destination } {
  if (back && !result.onboarding.completed) rememberReturnPath(tabStorage, back)
  if (back && result.onboarding.completed) return { path: back, destination: 'return' }
  return {
    path: nextRoute(result.onboarding),
    destination: result.onboarding.completed ? 'account' : 'onboarding',
  }
}
