import { listEnvelope } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { listAccountRequests } from '@/lib/admin/account-ops'
import { adminRequest } from '@/lib/admin/admin-route'

/**
 * GET /api/v1/ops/account-requests — 05 §28 (A11): leader escalations and
 * users' own deletion requests, oldest first (`?status=&kind=&cursor=&limit=`);
 * PLATFORM_ADMIN only.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId } = await adminRequest(request)
  const { items, nextCursor, limit, counts } = await listAccountRequests(
    accountId,
    new URL(request.url).searchParams,
  )
  return { ...listEnvelope(items, { nextCursor, limit }), counts }
})
