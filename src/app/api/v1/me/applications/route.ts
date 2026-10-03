import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { listMyApplications } from '@/lib/application/application'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * GET /api/v1/me/applications — 05 §21 (DEC-L5-D3, amendment A6). The
 * applications of the ventures the session's profile owns, in every programme
 * state, newest change first, in the §2.4 list envelope `{items}`.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return { items: await listMyApplications(session.accountId) }
})
