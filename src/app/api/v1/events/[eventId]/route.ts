import { withApi } from '@/lib/api/handler'
import { eventRequest } from '@/lib/ops/event-request'
import { getManagedEvent } from '@/lib/ops/events'

/**
 * GET /api/v1/events/{eventId} — 05 §8.6 "permission-filtered detail".
 * P0 / WF03-S07: returned to an actor with `event:manage` on the owning
 * organization; every other caller gets the same 404. The public / network
 * projection of published events belongs to WF03-S09 (DEC-WF03-S07-D2).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, eventId } = await eventRequest(request)
  return getManagedEvent(accountId, eventId)
})
