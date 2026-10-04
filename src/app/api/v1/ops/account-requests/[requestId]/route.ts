import { withApi } from '@/lib/api/handler'
import { getAccountRequest } from '@/lib/admin/account-ops'
import { adminRequest } from '@/lib/admin/admin-route'

/** GET /api/v1/ops/account-requests/{requestId} — 05 §28 (A11); non-admins and unknown ids 404. */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ids } = await adminRequest(request, 'account-requests')
  return getAccountRequest(accountId, ids[0]!)
})
