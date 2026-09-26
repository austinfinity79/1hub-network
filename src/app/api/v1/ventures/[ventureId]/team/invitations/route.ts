import { withApi, withStatus } from '@/lib/api/handler'
import { inviteMember } from '@/lib/venture/team'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * POST /api/v1/ventures/{ventureId}/team/invitations — 05 §5.4, WF02-S06.
 * Owner only (`venture:team_manage`). Body `{ email, role_label }` → 201 with a
 * PENDING_CONFIRMATION invitation; nothing is activated and no email is sent
 * (DEC-WF02-S06-G2/G3). 409 MEMBERSHIP_INVALID_TRANSITION for a duplicate
 * pending invitation.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId } = await teamRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return withStatus(201, await inviteMember(accountId, ventureId, body, requestId))
})
