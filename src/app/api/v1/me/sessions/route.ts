import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { listOwnSessions, revokeAllOwnSessions } from '@/lib/account/settings'
import { readSessionToken, sessionClearCookie } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * GET /api/v1/me/sessions — 05 §5.5: the caller's active sessions, safe DTO
 * (id, created_at, expires_at, current; no token, hash or device data).
 * DELETE /api/v1/me/sessions — DEC-WF02-S07-G5: revoke every session of the
 * account, including this one; 204 and the cookie is cleared.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return { items: await listOwnSessions(session.accountId, session.sessionId) }
})

export const DELETE = withApi(async ({ request, setCookie }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  await revokeAllOwnSessions(session.accountId)
  const cookie = sessionClearCookie()
  setCookie(cookie.name, cookie.value, cookie.options)
  return undefined
})
