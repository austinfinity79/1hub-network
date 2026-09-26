import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getVisibility, putVisibility } from '@/lib/profile/visibility'

/**
 * GET/PUT /api/v1/me/visibility — 05 §4.5. Maps WF01-S07 (DEC-WF01-S07-D2/D4).
 * Always the session's own profile; P0 group PROFILE_DISCOVERY only.
 */
export const dynamic = 'force-dynamic'

async function accountId(request: Request): Promise<string> {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return session.accountId
}

export const GET = withApi(async ({ request }) => getVisibility(await accountId(request)))

export const PUT = withApi(async ({ request, requestId }) => {
  const id = await accountId(request)
  const body: unknown = await request.json().catch(() => null)
  return putVisibility(id, body, requestId)
})
