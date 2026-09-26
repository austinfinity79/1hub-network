import { withApi } from '@/lib/api/handler'
import { removeMember, updateMemberRole } from '@/lib/venture/team'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * PATCH/DELETE /api/v1/ventures/{ventureId}/team/{membershipId} — 05 §5.4.
 * Owner only (`venture:team_manage`). PATCH `{ role_label }` on an ACTIVE
 * member (display text only). DELETE closes a membership or a pending
 * invitation as REMOVED; the row and its history stay (DEC-WF02-S06-G6).
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId, membershipId } = await teamRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return updateMemberRole(accountId, ventureId, membershipId, body, requestId)
})

export const DELETE = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId, membershipId } = await teamRequest(request)
  return removeMember(accountId, ventureId, membershipId, requestId)
})
