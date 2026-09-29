import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { submitApplication, submitApplicationIn } from '@/lib/application/application'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/applications/{applicationId}/submit — 05 §21 (DEC-L5-D3). No
 * body. The owner submits a complete DRAFT once: SUBMITTED and the snapshot
 * are written together; a second submit is 409.
 *
 * Idempotency (`application.submit`): with an `Idempotency-Key` a repeated
 * request replays the first outcome instead of answering 409.
 */
export const dynamic = 'force-dynamic'

const idOf = (request: Request) => {
  const parts = new URL(request.url).pathname.split('/')
  return decodeURIComponent(parts[parts.length - 2] ?? '')
}

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const id = idOf(request)
  const key = readIdempotencyKey(request.headers)

  if (!key) return submitApplication(session.accountId, id, requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'application.submit',
    actorAccountId: session.accountId,
    fingerprint: fingerprintRequest({ id }),
    run: async (exec) => ({
      status: 200,
      body: await submitApplicationIn(exec, session.accountId, id, requestId),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
