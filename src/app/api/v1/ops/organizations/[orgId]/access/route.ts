import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { listAccess, parseGrantBody } from '@/lib/admin/access-api'
import { adminRequest } from '@/lib/admin/admin-route'
import { grantAccess } from '@/lib/admin/delegation'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * GET /api/v1/ops/organizations/{orgId}/access — 05 §27 (A10): the unit's
 * delegated access (`?state=ACTIVE|CLOSED|ALL`). POST — grant `{ grantee_profile_id,
 * capability? }` → 201 (PD-6 checks on the server). Readers and grantors:
 * PLATFORM_ADMIN or `access:delegate` on the unit or its parent; others 403.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ids } = await adminRequest(request, 'organizations')
  return listAccess(accountId, ids[0]!, new URL(request.url).searchParams)
})

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'organizations')
  const organizationId = ids[0]!
  const body: unknown = await request.json().catch(() => undefined)
  const grant = parseGrantBody(body)
  const key = readIdempotencyKey(request.headers)
  if (!key)
    return withStatus(201, await grantAccess(accountId, { organizationId, ...grant }, requestId))
  const outcome = await runIdempotent({
    key,
    operation: 'access.grant-or-revoke',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'grant', organizationId, body }),
    run: async (exec) => ({
      status: 201,
      body: await grantAccess(accountId, { organizationId, ...grant }, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
