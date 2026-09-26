import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { closeRelationship } from '@/lib/ops/relationships'
import { opsRequest } from '@/lib/ops/route-params'

/**
 * POST /api/v1/ops/organizations/{orgId}/relationships/{relationshipId}/close — 05 §8.7.
 * `{ ended_at?, reason? }`; closes an ACTIVE relationship and keeps it as history.
 * Idempotency as for create (05 §2.3; key optional, provisional leniency).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, orgId, rest } = await opsRequest(request)
  const relationshipId = rest[1] ?? ''
  const body: unknown = await request.json().catch(() => ({}))
  const key = readIdempotencyKey(request.headers)
  if (!key) return closeRelationship(accountId, orgId, relationshipId, body, requestId)
  const outcome = await runIdempotent({
    key,
    operation: 'organization.relationship-create-or-close',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'close', orgId, relationshipId, body }),
    run: async (exec) => ({
      status: 200,
      body: await closeRelationship(accountId, orgId, relationshipId, body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
