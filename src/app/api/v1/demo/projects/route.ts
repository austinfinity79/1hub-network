import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listDemoVentures } from '@/lib/project-demo/read-model'

/**
 * GET /api/v1/demo/projects — WF05-T00 (architecture 04 "Demo later";
 * DEC-WF05-G2/G3, DEC-WF05-T00-D2). Read-only: the signed-in member's own
 * ventures (owner or ACTIVE member, canonical WF02 data) and the PUBLISHED demo
 * programmes. No session → 401; onboarding not done → 403 SCOPE_FORBIDDEN.
 * Query parameters and headers are not inputs. No other method exists (405).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return listDemoVentures(session.accountId)
})
