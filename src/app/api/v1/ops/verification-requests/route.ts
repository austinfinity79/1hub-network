import { listEnvelope } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { listVerificationRequests } from '@/lib/admin/verification-queue'
import { verificationRequest } from '@/lib/admin/verification-route'

/**
 * GET /api/v1/ops/verification-requests — 05 §26 (A9), ADMIN-PROD-03.
 * The viewer's role verification queue: requests routed to units where the
 * viewer holds `verification:review` (all for PLATFORM_ADMIN). `?status=`
 * (default PENDING) `&organization_id=&routed_to=&cursor=&limit=` (≤ 50, default
 * 20); `counts.pending` is the viewer's pending total. No grant anywhere →
 * 403 SCOPE_FORBIDDEN.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId } = await verificationRequest(request)
  const { items, nextCursor, limit, counts } = await listVerificationRequests(
    accountId,
    new URL(request.url).searchParams,
  )
  return { ...listEnvelope(items, { nextCursor, limit }), counts }
})
