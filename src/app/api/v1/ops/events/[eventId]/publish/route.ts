import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { eventRequest } from '@/lib/ops/event-request'
import { publishEvent } from '@/lib/ops/events'

/**
 * POST /api/v1/ops/events/{eventId}/publish — 05 §8.6. DRAFT → PUBLISHED after
 * validation (E3). Idempotency-Key honoured (05 §2.3; optional).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, eventId } = await eventRequest(request)
  const body: unknown = await request.json().catch(() => undefined)
  const key = readIdempotencyKey(request.headers)
  if (!key) return publishEvent(accountId, eventId, body, requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'event.create-or-publish',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'publish', eventId }),
    run: async (exec) => ({
      status: 200,
      body: await publishEvent(accountId, eventId, body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
