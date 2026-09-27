import type { Metadata } from 'next'

import { MAGIC_LINK_EXPIRES_IN_SECONDS } from '@/lib/auth/config'

import { CallbackScreen } from './callback-screen'

/**
 * WF01-S03 — /auth/callback?token=<opaque> (decision D7). Next: WF01-S05
 * onboarding, WF02-S01 when onboarding is complete, or WF01-S04 on error.
 * Approved evidence: the AUTH3 state board,
 * design-reference/final/revision/L1/AUTH3__auth-callback-states__SOURCE.png (TASK 22.2)
 *
 * STATIC ON PURPOSE. The page must not read searchParams on the server: a
 * dynamic render embeds the request URL, token included, in the inline RSC
 * payload of the HTML. As a static page its HTML is built ahead of time and
 * cannot contain the token; the browser reads the query instead.
 */

// The URL carries a single-use credential: never leak it to another origin.
export const metadata: Metadata = { referrer: 'no-referrer' }

export const dynamic = 'force-static'

export default function Page() {
  return <CallbackScreen expiresInMinutes={MAGIC_LINK_EXPIRES_IN_SECONDS / 60} />
}
