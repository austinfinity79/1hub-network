import type { Metadata } from 'next'

import { SESSION_TTL_SECONDS } from '@/lib/auth/config'

import { AuthErrorScreen } from './auth-error-screen'

/**
 * WF01-S04 — /auth/error?reason=<public-code> (DEC-WF01-S04-D1). Next:
 * WF01-S01 (retry, relogin). Approved evidence: the AUTH4 state board,
 * design-reference/final/WF01/WF01-S04__auth-errors__1440x900.png
 *
 * STATIC ON PURPOSE, like WF01-S03: a dynamic render would embed the request
 * query in the inline RSC payload; the allowlisted reason is read in the
 * browser instead.
 */
export const metadata: Metadata = { referrer: 'no-referrer' }

export const dynamic = 'force-static'

export default function Page() {
  return <AuthErrorScreen sessionDays={Math.round(SESSION_TTL_SECONDS / 86400)} />
}
