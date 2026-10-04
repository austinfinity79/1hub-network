import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { rejectVerificationRequest, refuseOwnDecision } from '@/lib/admin/verification-queue'
import { verificationRequest } from '@/lib/admin/verification-route'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/ops/verification-requests/{requestId}/reject — 05 §26 (A9).
 * `{ version, reason? }` on a PENDING request routed to the handler's unit. Not pending or a
 * stale version → 409; own request → 403; Idempotency-Key honoured (optional).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId: auditRequestId }) => {
  const { accountId, requestId } = await verificationRequest(request)
  const body: unknown = await request.json().catch(() => undefined)
  const key = readIdempotencyKey(request.headers)
  if (!key) return rejectVerificationRequest(accountId, requestId, body, auditRequestId)
  // Before the idempotent transaction, so the refusal's audit row survives it.
  await refuseOwnDecision(accountId, requestId, 'REJECT', auditRequestId)
  const outcome = await runIdempotent({
    key,
    operation: 'verification.decide',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'reject', requestId, body }),
    run: async (exec) => ({
      status: 200,
      body: await rejectVerificationRequest(accountId, requestId, body, auditRequestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
