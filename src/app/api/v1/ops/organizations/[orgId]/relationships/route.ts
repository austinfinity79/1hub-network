import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { createRelationship, getOrganizationRelationships } from '@/lib/ops/relationships'
import { opsRequest } from '@/lib/ops/route-params'

/**
 * GET / POST /api/v1/ops/organizations/{orgId}/relationships — 05 §8.7, WF03-S08.
 * `org:manage_relationship` on every organization involved (exact scope).
 * POST `{ target_organization_id, relationship_type: 'PARENT', replaces_relationship_id? }`
 * makes the path organization the parent of the target (DEC-WF03-S08-RELATIONSHIP-CONTRACT).
 *
 * IDEMPOTENCY (05 §2.3, "organization relationship create/close"): with an
 * `Idempotency-Key` the call runs once per key through the durable store and a
 * retry replays the first response. Without one it is still processed — the
 * same PROVISIONAL leniency as the other listed operations
 * (docs/implementation/IDEMPOTENCY_STORE_P0.md).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, orgId } = await opsRequest(request)
  return getOrganizationRelationships(accountId, orgId)
})

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, orgId } = await opsRequest(request)
  const body: unknown = await request.json().catch(() => null)
  const key = readIdempotencyKey(request.headers)
  if (!key) return withStatus(201, await createRelationship(accountId, orgId, body, requestId))
  const outcome = await runIdempotent({
    key,
    operation: 'organization.relationship-create-or-close',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({ action: 'create', orgId, body }),
    run: async (exec) => ({
      status: 201,
      body: await createRelationship(accountId, orgId, body, requestId, exec),
    }),
  })
  return withStatus(outcome.status, outcome.body)
})
