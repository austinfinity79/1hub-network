import { withApi } from '@/lib/api/handler'
import { updateOrganizationProfile } from '@/lib/ops/organization-profile'
import { opsRequest } from '@/lib/ops/route-params'

/**
 * PATCH /api/v1/ops/organizations/{orgId}/profile — 05 §8.5, WF03-S06.
 * `org:manage` for exactly this organization; `{ name?, description? }` only
 * (DEC-WF03-S06-D1). Hierarchy is not editable here (DEC-WF03-C1).
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, orgId } = await opsRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return updateOrganizationProfile(accountId, orgId, body, requestId)
})
