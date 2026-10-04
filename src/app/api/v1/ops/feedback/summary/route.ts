import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { feedbackWeeklySummary } from '@/lib/admin/feedback-ops'

/**
 * GET /api/v1/ops/feedback/summary?week=YYYY-Www — 05 §28 (A11): the feedback
 * received in one ISO week by type × open / closed, priority and owner.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId } = await adminRequest(request)
  return feedbackWeeklySummary(accountId, new URL(request.url).searchParams)
})
