import { withApi } from '@/lib/api/handler'
import { eventRequest } from '@/lib/ops/event-request'
import { cancelEvent } from '@/lib/ops/events'

/**
 * POST /api/v1/ops/events/{eventId}/cancel — 05 §8.6. PUBLISHED | LIVE →
 * CANCELLED (E1); the event is kept, never deleted. A repeat is 409.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, eventId } = await eventRequest(request)
  const body: unknown = await request.json().catch(() => undefined)
  return cancelEvent(accountId, eventId, body, requestId)
})
