import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { adminRequest } from '@/lib/admin/admin-route'
import { approveVentureReview, refuseOwnVentureReview } from '@/lib/admin/venture-review-queue'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/ops/venture-reviews/{reviewId}/approve — 05 §27 (A10).
 * `{ version }` on a PENDING review; not pending or a stale version → 409; the
 * reviewer's own venture → 403. Idempotency-Key honoured (optional).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId: auditRequestId }) => {
  const { accountId, ids } = await adminRequest(request, 'venture-reviews')
  const reviewId = ids[0]!
  const body: unknown = await request.json().catch(() => undefined)
  const key = readIdempotencyKey(request.headers)
  if (!key) return approveVentureReview(accountId, reviewId, body, auditRequestId)
  // Before the idempotent transaction, so the refusal's audit row survives it.
  await refuseOwnVentureReview(accountId, reviewId, 'APPROVE', auditRequestId)
  const outcome = await runIdempotent({
    key,
    operation: 'venture.review',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'approve', reviewId, body }),
    run: async (exec) => ({
      status: 200,
      body: await approveVentureReview(accountId, reviewId, body, auditRequestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
