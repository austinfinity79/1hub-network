import { unauthenticated } from '@/lib/api/errors'
import { listEnvelope } from '@/lib/api/envelope'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listDemoProgrammes } from '@/lib/programme-demo/read-model'

/**
 * GET /api/v1/demo/programmes — WF04-T00 (architecture 04 "Demo later";
 * DEC-WF04-H2, DEC-WF04-T00-D2). Read-only DEMO fixture: the Programmes /
 * Challenges whose owning organization the actor holds `programme:read` for.
 * No session → 401; no scope at all → 403 SCOPE_FORBIDDEN. Query parameters
 * are ignored (no client-supplied scope). There is no mutation endpoint.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const items = await listDemoProgrammes(session.accountId)
  return listEnvelope(items)
})
