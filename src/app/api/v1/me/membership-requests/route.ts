import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { withTransaction } from '@/lib/db/client'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { requestMembership } from '@/lib/network/membership-request'

/**
 * POST /api/v1/me/membership-requests — 05 §5.1. Maps WF02-S04
 * (DEC-WF02-H11, DEC-WF02-S04-G1..G5). Body `{ organization_id }` → 201 with
 * a PENDING_APPROVAL MembershipDTO; 409 MEMBERSHIP_INVALID_TRANSITION when a
 * membership in a blocking state exists; 404 for an organisation that is not
 * requestable. The member is the session's own profile.
 *
 * Idempotency (05:48-63, `membership.request`): with an `Idempotency-Key` a
 * retry replays the first outcome; without one the request is still processed
 * and the database uniqueness prevents a duplicate open membership.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)

  if (!key) {
    const outcome = await withTransaction((exec) =>
      requestMembership(exec, session.accountId, body, requestId),
    )
    return withStatus(outcome.status, outcome.body)
  }
  const outcome = await runIdempotent({
    key,
    operation: 'membership.request',
    actorAccountId: session.accountId,
    fingerprint: fingerprintRequest({ body }),
    run: (exec) => requestMembership(exec, session.accountId, body, requestId),
  })
  return withStatus(outcome.status, outcome.body)
})
