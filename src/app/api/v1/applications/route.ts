import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { createApplication, createApplicationIn } from '@/lib/application/application'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/applications — 05 §21 (DEC-L5-D3). Body `{ venture_id,
 * programme_id }`; 201 with the new DRAFT. The venture's owner only; the
 * programme must be PUBLISHED with an application form.
 *
 * Idempotency (`application.create`): with an `Idempotency-Key` a repeated
 * request replays the first outcome and creates nothing.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)

  if (!key) return withStatus(201, await createApplication(session.accountId, body, requestId))
  const outcome = await runIdempotent({
    key,
    operation: 'application.create',
    actorAccountId: session.accountId,
    fingerprint: fingerprintRequest({ body }),
    run: async (exec) => ({
      status: 201,
      body: await createApplicationIn(exec, session.accountId, body, requestId),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
