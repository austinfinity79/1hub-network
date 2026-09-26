import { listEnvelope } from '@/lib/api/envelope'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { createEvent, listOrganizationEvents } from '@/lib/ops/events'
import { opsRequest } from '@/lib/ops/route-params'

/**
 * GET / POST /api/v1/ops/organizations/{orgId}/events — 05 §8.6, WF03-S07.
 * `event:manage` for exactly this organization. Standalone events only; POST
 * creates a DRAFT with `programme_id` NULL (DEC-WF03-S07-EVENT-LIFECYCLE).
 * Idempotency-Key honoured on create (05 §2.3; optional, provisional leniency).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, orgId } = await opsRequest(request)
  const items = await listOrganizationEvents(accountId, orgId)
  return listEnvelope(items, { nextCursor: null, limit: 200 })
})

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, orgId } = await opsRequest(request)
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)
  if (!key) return withStatus(201, await createEvent(accountId, orgId, body, requestId))
  const outcome = await runIdempotent({
    key,
    operation: 'event.create-or-publish',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'create', orgId, body }),
    run: async (exec) => ({
      status: 201,
      body: await createEvent(accountId, orgId, body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
