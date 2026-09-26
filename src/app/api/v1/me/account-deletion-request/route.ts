import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { requestAccountDeletion } from '@/lib/account/settings'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * POST /api/v1/me/account-deletion-request — 05 §5.5, DEC-WF02-S07-G1..G4.
 * A request only: 201 the first time, 200 with the same request afterwards.
 * Nothing is deleted, deactivated or logged out. The body is ignored; the
 * account is the session's.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const outcome = await requestAccountDeletion(session.accountId, requestId)
  return withStatus(outcome.status, outcome.body)
})
