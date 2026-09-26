import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getDemoProgramme } from '@/lib/programme-demo/read-model'

/**
 * GET /api/v1/demo/programmes/{id} — WF04-T00. One DEMO fixture with its
 * stages, Challenge problem statements, programme-linked events, team display
 * rows, registration configuration and application counts. Unknown, malformed
 * or out-of-scope ids are the same 404. Read-only.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '')
  return getDemoProgramme(session.accountId, id)
})
