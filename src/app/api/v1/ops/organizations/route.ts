import { unauthenticated } from '@/lib/api/errors'
import { listEnvelope, parseListQuery } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listManagedOrganizations } from '@/lib/ops/organizations'

/**
 * GET /api/v1/ops/organizations — 05 §8.1, WF03-T00 (for WF03-S01).
 * Operational organizations (HUB/CHAPTER/CLB) the actor holds `network:read`
 * for, scoped on the server from ACTIVE RoleAssignments only (no inheritance).
 * Filters `?type=&q=&cursor=&limit=` (≤ 50 per page). No session → 401; no ops
 * scope at all → 403 SCOPE_FORBIDDEN.
 */
export const dynamic = 'force-dynamic'

const MAX_LIMIT = 50

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const params = new URL(request.url).searchParams
  const { cursor, limit } = parseListQuery(params)
  const bounded = Math.min(limit, MAX_LIMIT)
  const { items, nextCursor } = await listManagedOrganizations(session.accountId, {
    type: params.get('type') ?? undefined,
    q: params.get('q') ?? undefined,
    cursor,
    limit: bounded,
  })
  return listEnvelope(items, { nextCursor, limit: bounded })
})
