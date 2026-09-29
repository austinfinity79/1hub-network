import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { EmailDeliveryError } from '@/lib/email/resend'
import { deliverInvitation, type InvitationNotice } from '@/lib/venture/invitation-email'
import { inviteMember } from '@/lib/venture/team'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * POST /api/v1/ventures/{ventureId}/team/invitations — 05 §5.4 and §19
 * (amendment A2), WF02-S06. Owner only (`venture:team_manage`). Body
 * `{ email, role_label, permission }` → 201 with a PENDING_CONFIRMATION
 * invitation; nothing is activated. The notice is e-mailed inside the same
 * transaction: when it cannot be sent, no invitation is created and the answer
 * is INVITATION_EMAIL_DELIVERY_FAILED (DEC-L2R-D8). 409
 * MEMBERSHIP_INVALID_TRANSITION for a duplicate pending invitation.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId } = await teamRequest(request)
  const body: unknown = await request.json().catch(() => null)
  const origin = new URL(request.url).origin

  const deliver = async (notice: InvitationNotice) => {
    try {
      await deliverInvitation(notice, origin)
    } catch (error) {
      if (!(error instanceof EmailDeliveryError)) throw error
      console.error('invitation e-mail not sent', { reason: error.reason })
      throw new ApiError(
        'INVITATION_EMAIL_DELIVERY_FAILED',
        500,
        'The invitation e-mail could not be sent.',
      )
    }
  }
  return withStatus(201, await inviteMember(accountId, ventureId, body, requestId, deliver))
})
