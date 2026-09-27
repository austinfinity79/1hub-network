import type { Metadata } from 'next'

import { AuthErrorScreen } from './auth-error-screen'

/**
 * WF01-S04 — /auth/error?reason=<public-code> (DEC-WF01-S04-D1). Next:
 * WF01-S01 (retry, relogin). Approved evidence: the AUTH4 state board,
 * design-reference/final/revision/L1/AUTH4__auth-errors__SOURCE.png (TASK 22.2)
 *
 * STATIC ON PURPOSE, like WF01-S03: a dynamic render would embed the request
 * query in the inline RSC payload; the allowlisted reason is read in the
 * browser instead.
 */
export const metadata: Metadata = { referrer: 'no-referrer' }

export const dynamic = 'force-static'

export default function Page() {
  return <AuthErrorScreen />
}
