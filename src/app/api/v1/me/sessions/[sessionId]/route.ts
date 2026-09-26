import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { revokeOwnSession } from '@/lib/account/settings'
import { readSessionToken, sessionClearCookie } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * DELETE /api/v1/me/sessions/{sessionId} — 05 §5.5, DEC-WF02-S07-G6. Own
 * session → 204 (idempotent when already revoked or expired); the current
 * session also clears the cookie. Foreign or unknown ids are the same 404.
 */
export const dynamic = 'force-dynamic'

export const DELETE = withApi(async ({ request, setCookie }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const sessionId = new URL(request.url).pathname.split('/').pop() ?? ''
  const { current } = await revokeOwnSession(
    session.accountId,
    decodeURIComponent(sessionId),
    session.sessionId,
  )
  if (current) {
    const cookie = sessionClearCookie()
    setCookie(cookie.name, cookie.value, cookie.options)
  }
  return undefined
})
