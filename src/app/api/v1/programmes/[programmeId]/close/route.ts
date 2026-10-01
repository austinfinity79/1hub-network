import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { closeProgramme } from '@/lib/programme/programme'
import { programmeRequest } from '@/lib/programme/request'

/**
 * POST /api/v1/programmes/{programmeId}/close — 05 §22 (amendment A5). No body.
 * PUBLISHED → CLOSED (DEC-W4P-D12); a second close is 409.
 * Idempotency-Key honoured (`programme.close`; optional, 05 §2.3 I5): a repeat
 * replays the first outcome instead of answering 409.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, programmeId } = await programmeRequest(request)
  const body: unknown = await request.json().catch(() => undefined)
  const key = readIdempotencyKey(request.headers)
  if (!key) return closeProgramme(accountId, programmeId, body, requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'programme.close',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'close', programmeId }),
    run: async (exec) => ({
      status: 200,
      body: await closeProgramme(accountId, programmeId, body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
