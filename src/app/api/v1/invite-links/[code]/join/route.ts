import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { joinInviteLink } from '@/lib/venture/invite-link'
import { inviteCodeOf } from '@/lib/venture/team-route'

/**
 * POST /api/v1/invite-links/{code}/join — S1-UAT-07 (US-02.12 "Tham gia";
 * DEC-S1I). Signed in, onboarding done, empty body: any field (a role, a level)
 * is refused. → `{ venture_id, joined }`; an existing member gets `joined: false`.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const text = await request.text()
  let body: unknown = null
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { body: 'invalid' }
    }
  }
  return joinInviteLink(session.accountId, inviteCodeOf(request), body, requestId)
})
