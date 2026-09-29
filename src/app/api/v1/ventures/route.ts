import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { createVenture, createVentureIn } from '@/lib/venture/venture'

/**
 * POST /api/v1/ventures — 05 §5.3 and §19 (amendment A2), WF02-S05. Body
 * `{ type, name, summary, domain_ids, stage_id, owner_role_label, region_id }`
 * (DEC-L2R-D4). 201 with the new DRAFT venture; the owner is the session's
 * profile (DEC-WF02-S05-G2/G5).
 *
 * Idempotency (`venture.create`, DEC-L2R-D9): with an `Idempotency-Key` a
 * repeated request replays the first outcome and creates nothing.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)

  if (!key) return withStatus(201, await createVenture(session.accountId, body, requestId))
  const outcome = await runIdempotent({
    key,
    operation: 'venture.create',
    actorAccountId: session.accountId,
    fingerprint: fingerprintRequest({ body }),
    run: async (exec) => ({
      status: 201,
      body: await createVentureIn(exec, session.accountId, body, requestId),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
