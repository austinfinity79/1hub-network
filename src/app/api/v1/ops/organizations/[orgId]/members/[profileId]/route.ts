import { withApi } from '@/lib/api/handler'
import { getMemberDetail } from '@/lib/ops/member-detail'
import { opsRequest } from '@/lib/ops/route-params'

/**
 * GET /api/v1/ops/organizations/{orgId}/members/{profileId} — 05 §8.3, WF03-S04.
 * `member:read` for exactly this organization; the person must be related to it
 * (otherwise the same 404). Identity through PROFILE_DISCOVERY only (G4).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, orgId, rest } = await opsRequest(request)
  return getMemberDetail(accountId, orgId, rest[1] ?? '')
})
