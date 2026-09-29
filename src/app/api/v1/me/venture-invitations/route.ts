import { listEnvelope } from '@/lib/api/envelope'
import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listOwnInvitations } from '@/lib/venture/team'

/**
 * GET /api/v1/me/venture-invitations — 05 §19 (amendment A2), WF02-S08 (ME7).
 * The pending team invitations sent to the session account's own address
 * (DEC-L2R-D8). Each names its venture, role and level and nothing of the
 * team. The address is read from the session's account only.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const items = await listOwnInvitations(session.accountId)
  return listEnvelope(items, { nextCursor: null, limit: items.length })
})
