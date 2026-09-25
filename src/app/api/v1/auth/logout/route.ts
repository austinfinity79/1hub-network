import { withApi } from '@/lib/api/handler'
import { readSessionToken, sessionClearCookie } from '@/lib/auth/session-cookie'
import { revokeSession } from '@/lib/auth/sessions'

/**
 * POST /api/v1/auth/logout — 05:230-232. Responds 204 and revokes the session.
 *
 * Revocation is server-side, so clearing the cookie is a convenience rather
 * than the security boundary: a copied token stops working regardless.
 * Idempotent, so logging out twice is not an error.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, setCookie }) => {
  await revokeSession(readSessionToken(request.headers))

  const cookie = sessionClearCookie()
  setCookie(cookie.name, cookie.value, cookie.options)

  return undefined
})
