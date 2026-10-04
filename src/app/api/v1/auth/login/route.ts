import { withApi } from '@/lib/api/handler'
import { REMEMBER_ME_COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/config'
import { loginWithPassword } from '@/lib/auth/credentials'
import { sessionSetCookie } from '@/lib/auth/session-cookie'
import { requireJsonBody } from '@/lib/auth/require-json'

/**
 * POST /api/v1/auth/login — S1-UAT-01, US-01.03.
 * Body: identifier (username or e-mail), password, remember.
 * 401 AUTH_INVALID_CREDENTIALS never says which part was wrong; the 5th wrong
 * password answers 429 AUTH_PASSWORD_LOGIN_LOCKED (`fields.locked_until`).
 * "remember" sets a 30-day cookie; otherwise a browser-session cookie.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId, setCookie }) => {
  requireJsonBody(request)
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    identifier?: unknown
    password?: unknown
    remember?: unknown
  }

  const { response, sessionToken } = await loginWithPassword(body, requestId)
  const cookie = sessionSetCookie(
    sessionToken,
    body.remember === true ? REMEMBER_ME_COOKIE_MAX_AGE_SECONDS : undefined,
  )
  setCookie(cookie.name, cookie.value, cookie.options)
  return response
})
