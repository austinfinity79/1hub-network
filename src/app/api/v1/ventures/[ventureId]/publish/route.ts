import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { publishVenture } from '@/lib/venture/venture'

/**
 * POST /api/v1/ventures/{ventureId}/publish — "Công khai" (DEC-PDF-D1, API 05
 * §20). The owner makes a complete venture PUBLIC; the server checks the
 * owner, the lifecycle and the five required fields. No body is read.
 */
export const dynamic = 'force-dynamic'

const idOf = (request: Request) => {
  const parts = new URL(request.url).pathname.split('/')
  return decodeURIComponent(parts[parts.length - 2] ?? '')
}

export const POST = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return publishVenture(session.accountId, idOf(request), requestId)
})
