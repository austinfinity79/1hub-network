import { listEnvelope } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { listVentureReviews } from '@/lib/admin/venture-review-queue'

/**
 * GET /api/v1/ops/venture-reviews — 05 §27 (A10), ADMIN-PROD-04. PLATFORM_ADMIN's
 * venture review queue (`venture:review`; anyone else 403). `?status=` (default
 * PENDING) `&kind=&venture_id=&cursor=&limit=` (1–50, default 20; keyset);
 * `counts.pending`.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId } = await adminRequest(request)
  const { items, nextCursor, limit, counts } = await listVentureReviews(
    accountId,
    new URL(request.url).searchParams,
  )
  return { ...listEnvelope(items, { nextCursor, limit }), counts }
})
