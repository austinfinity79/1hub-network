import { withApi, withStatus } from '@/lib/api/handler'
import { opsRequest } from '@/lib/ops/route-params'
import { createLeadership } from '@/lib/ops/review'

/**
 * POST /api/v1/ops/organizations/{orgId}/leadership — 05 §8.3.
 * `{ profile_id, title, valid_from?, valid_to: null }` → 201 ACTIVE
 * LeadershipRecord. Never mints a RoleAssignment (DEC-WF03-G6).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, orgId } = await opsRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return withStatus(201, await createLeadership(accountId, orgId, body, requestId))
})
