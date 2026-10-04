import { withApi } from '@/lib/api/handler'
import { getVerificationRequest } from '@/lib/admin/verification-queue'
import { verificationRequest } from '@/lib/admin/verification-route'

/**
 * GET /api/v1/ops/verification-requests/{requestId} — 05 §26 (A9). One request
 * with the requester's discovery identity, the unit context and the history.
 * Unknown, malformed and out-of-scope ids are the same 404.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, requestId } = await verificationRequest(request)
  return getVerificationRequest(accountId, requestId)
})
