import { withApi } from '@/lib/api/handler'
import { acceptInvitation } from '@/lib/venture/team'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * POST /api/v1/ventures/{ventureId}/team/invitations/{membershipId}/accept —
 * DEC-WF02-S06-G2. Only the signed-in recipient whose normalised account
 * email equals the invitation email may accept; anyone else gets 404.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId, membershipId } = await teamRequest(request)
  return acceptInvitation(accountId, ventureId, membershipId, requestId)
})
