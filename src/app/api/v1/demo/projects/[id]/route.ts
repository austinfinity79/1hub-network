import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getDemoVenture } from '@/lib/project-demo/read-model'

/**
 * GET /api/v1/demo/projects/{id} — WF05-T00. One canonical venture for its
 * owner or an ACTIVE member (WF02 rule), its team without invitations, and the
 * PUBLISHED demo programmes with this actor's eligibility (DEC-WF05-G4/G5).
 * Malformed, unknown or unreadable ids are the same 404. Read-only (405 for
 * any other method).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '')
  return getDemoVenture(session.accountId, id)
})
