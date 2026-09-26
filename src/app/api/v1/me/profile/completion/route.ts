import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getProfileCompletion } from '@/lib/profile/completion'

/**
 * GET /api/v1/me/profile/completion — 05 §4.3. The ten frozen groups from the
 * single completion service; group 3 is HEADLINE, not the stale
 * NETWORK_CONTEXT of the example (RESOLVED_BY_PRECEDENCE).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const { percent, groups } = await getProfileCompletion(session.accountId)
  return { percent, groups }
})
