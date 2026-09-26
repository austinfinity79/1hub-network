import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { submitPurpose } from '@/lib/onboarding/state'

/**
 * PUT /api/v1/me/onboarding/intent — 05 §4.2. Maps WF01-S05.
 * `{ "primary_intent": <code> }` (optionally `"action": "SAVE"`) saves an
 * intent from the P0 allowlist (DEC-WF01-S05-D1); `{ "action": "SKIP" }`
 * records "Bỏ qua, làm sau" without an intent (DEC-WF01-RESUME-D1). 200
 * returns the onboarding state with its next step.
 */
export const dynamic = 'force-dynamic'

export const PUT = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  return submitPurpose(session.accountId, body)
})
