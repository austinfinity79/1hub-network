import { listEnvelope } from '@/lib/api/envelope'
import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listConsents } from '@/lib/legal/legal'

/** GET /api/v1/me/consents — 05 §4.5. The session account's consent history. */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const items = await listConsents(session.accountId)
  return listEnvelope(items, { limit: items.length })
})
