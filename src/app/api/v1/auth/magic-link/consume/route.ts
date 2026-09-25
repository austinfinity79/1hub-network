import { withApi } from '@/lib/api/handler'
import { SESSION_TTL_SECONDS } from '@/lib/auth/config'
import { consumeMagicLink } from '@/lib/auth/magic-link'
import { sessionSetCookie } from '@/lib/auth/session-cookie'

/**
 * POST /api/v1/auth/magic-link/consume — 05:199-228. Maps WF01-S03.
 * Sets the secure HTTP-only session cookie, as the contract requires.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, setCookie }) => {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null

  const { response, sessionToken } = await consumeMagicLink(body?.token)

  const cookie = sessionSetCookie(sessionToken, SESSION_TTL_SECONDS)
  setCookie(cookie.name, cookie.value, cookie.options)

  return response
})
