import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getOwnNetwork } from '@/lib/network/network'

/**
 * GET /api/v1/me/network — 05 §5.1, WF02-T00. The session's own network read
 * model. The profile is derived from the session only: query parameters and
 * bodies are ignored, so no caller can read another member's network.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return getOwnNetwork(session.accountId)
})
