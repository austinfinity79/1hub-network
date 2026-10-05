import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { previewInviteLink } from '@/lib/venture/invite-link'
import { inviteCodeOf } from '@/lib/venture/team-route'

/**
 * GET /api/v1/invite-links/{code} — S1-UAT-07 (US-02.12; DEC-S1I). Signed in.
 * What the link offers: the venture's name and type, role "Thành viên", level
 * VIEW, its expiry, and the receiver's membership if any. Every unusable link
 * is the same 404 INVITE_LINK_INVALID.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return previewInviteLink(session.accountId, inviteCodeOf(request))
})
