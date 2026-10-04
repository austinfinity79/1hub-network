import { withApi, withStatus } from '@/lib/api/handler'
import { fileAccountRequest } from '@/lib/admin/account-ops'
import { adminRequest } from '@/lib/admin/admin-route'

/**
 * POST /api/v1/ops/organizations/{orgId}/members/{profileId}/account-requests —
 * 05 §28 (A11): a leader (`account:escalate` on exactly this unit) files
 * `{ action: LOCK | DEACTIVATE | SOFT_DELETE, reason? }` for an ACTIVE member of
 * the unit → 201. Leaders never execute (PD-7).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'organizations', 'members')
  const body: unknown = await request.json().catch(() => undefined)
  return withStatus(201, await fileAccountRequest(accountId, ids[0]!, ids[1]!, body, requestId))
})
