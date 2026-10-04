import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { getFeedback, updateFeedback } from '@/lib/admin/feedback-ops'

/**
 * GET / PATCH /api/v1/ops/feedback/{feedbackId} — 05 §28 (A11). PATCH
 * `{ type?, priority?, owner_profile_id?, status?, resolution_note? }`; invalid
 * status moves 409. Non-managers and unknown or malformed ids: the same 404.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ids } = await adminRequest(request, 'feedback')
  return getFeedback(accountId, ids[0]!)
})

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'feedback')
  const body: unknown = await request.json().catch(() => undefined)
  return updateFeedback(accountId, ids[0]!, body, requestId)
})
