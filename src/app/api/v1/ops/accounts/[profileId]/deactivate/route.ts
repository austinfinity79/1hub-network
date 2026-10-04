import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { refuseOwnAccountAction, runAccountOperation } from '@/lib/admin/account-ops'
import { adminRequest } from '@/lib/admin/admin-route'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/ops/accounts/{profileId}/deactivate — 05 §28 (A11), PD-7.
 * PLATFORM_ADMIN only (`account:administer`); `{ reason? }`; never one's own
 * account (403); the same state again is no change. Idempotency-Key optional.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'accounts')
  const profileId = ids[0]!
  const body: unknown = await request.json().catch(() => undefined)
  const key = readIdempotencyKey(request.headers)
  if (!key) return runAccountOperation(accountId, profileId, 'DEACTIVATE', body, requestId)
  await refuseOwnAccountAction(accountId, profileId, 'DEACTIVATE', requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'account.action',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'deactivate', profileId, body }),
    run: async (exec) => ({
      status: 200,
      body: await runAccountOperation(accountId, profileId, 'DEACTIVATE', body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
