import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { withTransaction } from '@/lib/db/client'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { acceptConsent } from '@/lib/legal/legal'

/**
 * POST /api/v1/me/consents/accept — 05 §4.5. Maps WF01-S07 (DEC-WF01-S07-D1).
 * Body `{ consent_type, policy_version }`; 201 with ConsentRecordDTO when
 * created, 200 when this document was already accepted.
 *
 * Idempotency (05:48-63): with an `Idempotency-Key` a retry replays the first
 * outcome. Without one the request is still processed (the provisional
 * lenient policy of IDEMPOTENCY_STORE_P0 I5); the UNIQUE
 * (account, type, document) constraint still prevents a duplicate record.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)

  if (!key) {
    const outcome = await withTransaction((exec) =>
      acceptConsent(exec, session.accountId, body, requestId),
    )
    return withStatus(outcome.status, outcome.body)
  }
  const outcome = await runIdempotent({
    key,
    operation: 'consent.accept-or-revoke',
    actorAccountId: session.accountId,
    fingerprint: fingerprintRequest({ action: 'accept', body }),
    run: (exec) => acceptConsent(exec, session.accountId, body, requestId),
  })
  return withStatus(outcome.status, outcome.body)
})
