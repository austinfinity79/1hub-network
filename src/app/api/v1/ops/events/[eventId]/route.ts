import { withApi } from '@/lib/api/handler'
import { eventRequest } from '@/lib/ops/event-request'
import { updateEvent } from '@/lib/ops/events'

/**
 * PATCH /api/v1/ops/events/{eventId} — 05 §8.6. DRAFT | PUBLISHED only; name,
 * summary, starts_at, ends_at, location_text (DEC-WF03-S07-EVENT-LIFECYCLE E2/E4).
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, eventId } = await eventRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return updateEvent(accountId, eventId, body, requestId)
})
