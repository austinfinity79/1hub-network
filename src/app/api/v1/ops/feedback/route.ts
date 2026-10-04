import { listEnvelope } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { listFeedback } from '@/lib/admin/feedback-ops'

/**
 * GET /api/v1/ops/feedback — 05 §28 (A11), ADMIN-PROD-05. PLATFORM_ADMIN's
 * feedback queue (`feedback:manage`; anyone else 403), newest first:
 * `?status=&type=&priority=&owner=&created_from=&created_to=&cursor=&limit=`;
 * `counts.open`. Each read also runs the bounded 90-day screenshot retention.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId } = await adminRequest(request)
  const { items, nextCursor, limit, counts } = await listFeedback(
    accountId,
    new URL(request.url).searchParams,
  )
  return { ...listEnvelope(items, { nextCursor, limit }), counts }
})
