import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { adminRequest } from '@/lib/admin/admin-route'
import { revokeAccess } from '@/lib/admin/delegation'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/ops/organizations/{orgId}/access/{grantId}/revoke — 05 §27 (A10).
 * ACTIVE → CLOSED now; the grantor, `access:delegate` on the unit or its parent,
 * or PLATFORM_ADMIN. Not active → 409.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'organizations', 'access')
  const [organizationId, grantId] = [ids[0]!, ids[1]!]
  const key = readIdempotencyKey(request.headers)
  if (!key) return revokeAccess(accountId, { organizationId, grantId }, requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'access.grant-or-revoke',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'revoke', organizationId, grantId }),
    run: async (exec) => ({
      status: 200,
      body: await revokeAccess(accountId, { organizationId, grantId }, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
