import { withApi } from '@/lib/api/handler'
import { reviewMembership } from '@/lib/ops/review'
import { opsRequest } from '@/lib/ops/route-params'

/**
 * PATCH /api/v1/ops/organizations/{orgId}/memberships/{membershipId} — 05 §8.3.
 * `{ status: ACTIVE | REJECTED }` on a PENDING_APPROVAL membership of this
 * organization (DEC-WF03-G5); any other transition 409 MEMBERSHIP_INVALID_TRANSITION;
 * out of scope 403 SCOPE_FORBIDDEN.
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, orgId, rest } = await opsRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return reviewMembership(accountId, orgId, rest[1] ?? '', body, requestId)
})
