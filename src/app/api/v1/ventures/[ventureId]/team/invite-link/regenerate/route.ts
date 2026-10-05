import { withApi } from '@/lib/api/handler'
import { regenerateInviteLink } from '@/lib/venture/invite-link'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * POST /api/v1/ventures/{ventureId}/team/invite-link/regenerate — US-02.12
 * "Tạo lại link → link cũ mất hiệu lực" (DEC-S1I). Owner only. The open link is
 * revoked at once and a new one returned: `{ link: { path, expires_at } }`.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId } = await teamRequest(request)
  return regenerateInviteLink(accountId, ventureId, requestId)
})
