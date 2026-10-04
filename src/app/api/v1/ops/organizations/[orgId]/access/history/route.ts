import { withApi } from '@/lib/api/handler'
import { accessHistory } from '@/lib/admin/access-api'
import { adminRequest } from '@/lib/admin/admin-route'

/**
 * GET /api/v1/ops/organizations/{orgId}/access/history — 05 §27 (A10): every
 * grant and revocation of the unit (ids, role, capability, actor), oldest first.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ids } = await adminRequest(request, 'organizations')
  return accessHistory(accountId, ids[0]!)
})
