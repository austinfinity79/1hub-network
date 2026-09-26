import { withApi } from '@/lib/api/handler'
import { getTeam } from '@/lib/venture/team'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * GET /api/v1/ventures/{ventureId}/team — 05 §5.4, WF02-S06.
 * Owner or ACTIVE member (`venture:read`); anyone else 404. Pending
 * invitations and their emails are returned to the owner only (DEC-WF02-S06-G8).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ventureId } = await teamRequest(request)
  return getTeam(accountId, ventureId)
})
