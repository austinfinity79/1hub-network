import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { setPrimaryIntent } from '@/lib/onboarding/state'

/**
 * PUT /api/v1/me/onboarding/intent — 05 §4.2. Maps WF01-S05.
 * Body `{ "primary_intent": <code> }`; the code must be in the P0 allowlist
 * (DEC-WF01-S05-D1). 200 returns the onboarding state with its next step.
 */
export const dynamic = 'force-dynamic'

export const PUT = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body = (await request.json().catch(() => null)) as { primary_intent?: unknown } | null
  return setPrimaryIntent(session.accountId, body?.primary_intent)
})
