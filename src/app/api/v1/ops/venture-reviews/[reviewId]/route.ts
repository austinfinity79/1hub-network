import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { getVentureReview } from '@/lib/admin/venture-review-queue'

/**
 * GET /api/v1/ops/venture-reviews/{reviewId} — 05 §27 (A10). The public
 * version, the candidate, their core-field diff, the owner's discovery identity
 * and the history. Non-reviewers and unknown or malformed ids: the same 404.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ids } = await adminRequest(request, 'venture-reviews')
  return getVentureReview(accountId, ids[0]!)
})
