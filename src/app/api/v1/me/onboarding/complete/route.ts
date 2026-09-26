import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { completeOnboarding } from '@/lib/onboarding/complete'

/**
 * POST /api/v1/me/onboarding/complete — 05 §4.6. Maps WF01-S08.
 * Takes no body: nothing the client sends (a completion_percent included)
 * is read. 200 `{completed, profile_status, completion_percent, next}`, also
 * when already completed; 422 ONBOARDING_REQUIREMENTS_MISSING with the
 * missing requirements (DEC-WF01-S08-D1/D8).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return completeOnboarding(session.accountId, requestId)
})
