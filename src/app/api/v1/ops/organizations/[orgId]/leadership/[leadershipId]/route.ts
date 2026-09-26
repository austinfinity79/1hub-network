import { withApi } from '@/lib/api/handler'
import { opsRequest } from '@/lib/ops/route-params'
import { endLeadership } from '@/lib/ops/review'

/**
 * PATCH /api/v1/ops/organizations/{orgId}/leadership/{leadershipId} — 05 §8.3.
 * Closes an ACTIVE leadership as ALUMNI or REVOKED, keeping the row (history).
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, orgId, rest } = await opsRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return endLeadership(accountId, orgId, rest[1] ?? '', body, requestId)
})
