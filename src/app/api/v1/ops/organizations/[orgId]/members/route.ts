import { unauthenticated } from '@/lib/api/errors'
import { listEnvelope, parseListQuery } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listOrganizationMembers } from '@/lib/ops/members'

/**
 * GET /api/v1/ops/organizations/{orgId}/members — 05 §8.3, WF03-S03.
 * Read-only relationship view (DEC-WF03-G3/G4): `member:read` for exactly this
 * organization (403 SCOPE_FORBIDDEN otherwise), items in OpsMemberSummaryDTO,
 * identity only through PROFILE_DISCOVERY. Filters `?q=&membership_status=&
 * leadership_status=&cursor=&limit=` (≤ 50 per page).
 */
export const dynamic = 'force-dynamic'

const MAX_LIMIT = 50

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const url = new URL(request.url)
  const parts = url.pathname.split('/')
  const orgId = decodeURIComponent(parts[parts.indexOf('organizations') + 1] ?? '')
  const { cursor, limit } = parseListQuery(url.searchParams)
  const bounded = Math.min(limit, MAX_LIMIT)
  const { items, nextCursor } = await listOrganizationMembers(session.accountId, orgId, {
    q: url.searchParams.get('q') ?? undefined,
    membership_status: url.searchParams.get('membership_status') ?? undefined,
    leadership_status: url.searchParams.get('leadership_status') ?? undefined,
    cursor,
    limit: bounded,
  })
  return listEnvelope(items, { nextCursor, limit: bounded })
})
