import { listEnvelope } from '@/lib/api/envelope'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { createProgramme, listProgrammes } from '@/lib/programme/programme'
import { programmeRequest } from '@/lib/programme/request'

/**
 * GET / POST /api/v1/programmes — 05 §22 (amendment A5, WF04-PROD-03).
 * GET: the programmes of every organization the actor holds `programme:read`
 * for (no public list in v1, DEC-W4P-D10). POST: a DRAFT owned by an
 * organization the actor holds `programme:manage` for → 201.
 * Idempotency-Key honoured on create (`programme.create`; optional, 05 §2.3 I5).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId } = await programmeRequest(request)
  return listEnvelope(await listProgrammes(accountId), { nextCursor: null, limit: 200 })
})

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId } = await programmeRequest(request)
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)
  if (!key) return withStatus(201, await createProgramme(accountId, body, requestId))
  const outcome = await runIdempotent({
    key,
    operation: 'programme.create',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'create', body }),
    run: async (exec) => ({
      status: 201,
      body: await createProgramme(accountId, body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
