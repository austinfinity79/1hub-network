import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { decideAccountRequest, refuseOwnRequestDecision } from '@/lib/admin/account-ops'
import { adminRequest } from '@/lib/admin/admin-route'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/ops/account-requests/{requestId}/decline — 05 §28 (A11): `{ reason? }`;
 * PENDING only (409 otherwise); processing executes the requested action.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'account-requests')
  const id = ids[0]!
  const body: unknown = await request.json().catch(() => undefined)
  const key = readIdempotencyKey(request.headers)
  if (!key) return decideAccountRequest(accountId, id, 'DECLINE', body, requestId)
  // Before the idempotent transaction, so the refusal's audit row survives it.
  await refuseOwnRequestDecision(accountId, id, 'DECLINE', requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'account.action',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'decline', id, body }),
    run: async (exec) => ({
      status: 200,
      body: await decideAccountRequest(accountId, id, 'DECLINE', body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
