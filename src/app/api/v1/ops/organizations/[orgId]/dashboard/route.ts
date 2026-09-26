import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getOrganizationDashboard } from '@/lib/ops/dashboard'

/**
 * GET /api/v1/ops/organizations/{orgId}/dashboard — 05 §8.2, WF03-S02.
 * Aggregate read model for one organization (DEC-WF03-G1). `org:read` for
 * exactly that organization: no session → 401; out of scope → 403
 * SCOPE_FORBIDDEN; an in-scope id that is not an operational organization → 404.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/')
  const orgId = decodeURIComponent(parts[parts.indexOf('organizations') + 1] ?? '')
  return getOrganizationDashboard(session.accountId, orgId)
})
