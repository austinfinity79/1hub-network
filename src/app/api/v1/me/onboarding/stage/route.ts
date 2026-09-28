import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { passStage } from '@/lib/onboarding/state'

/**
 * PUT /api/v1/me/onboarding/stage — DEC-L1R-D3. Maps ACC-07 and ACC-08.
 * `{ "completed": "CAPABILITY" | "ROLE" }` records that the stage was passed;
 * 200 returns the onboarding state with its next step. 422
 * ONBOARDING_REQUIREMENTS_MISSING when an earlier stage is not complete.
 */
export const dynamic = 'force-dynamic'

export const PUT = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  return passStage(session.accountId, body)
})
