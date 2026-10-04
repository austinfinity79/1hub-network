import { withApi } from '@/lib/api/handler'
import { REMEMBER_ME_COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/config'
import { registerWithPassword, suggestUsername, type RegisterBody } from '@/lib/auth/credentials'
import { sessionSetCookie } from '@/lib/auth/session-cookie'
import { ApiError, isApiError } from '@/lib/api/errors'
import { requireJsonBody } from '@/lib/auth/require-json'

/**
 * POST /api/v1/auth/register — S1-UAT-01, US-01.02 "Tạo tài khoản".
 * Body: full_name, email, username, password, password_confirm, legal_versions.
 * Creates the account (password hashed), records Legal v1.0 through the
 * existing consent writer, signs in with a fresh session and answers like
 * consume: `{ result, account_created: true, onboarding }` (amendment A12).
 * A taken username answers 409 AUTH_USERNAME_TAKEN with `fields.suggestion`.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId, setCookie }) => {
  requireJsonBody(request)
  const body = ((await request.json().catch(() => null)) ?? {}) as RegisterBody

  try {
    const { response, sessionToken } = await registerWithPassword(body, requestId)
    // A new account stays signed in on this device, as the magic-link sign-up did.
    const cookie = sessionSetCookie(sessionToken, REMEMBER_ME_COOKIE_MAX_AGE_SECONDS)
    setCookie(cookie.name, cookie.value, cookie.options)
    return response
  } catch (error) {
    if (isApiError(error) && error.code === 'AUTH_USERNAME_TAKEN') {
      const suggestion = await suggestUsername(
        typeof body.username === 'string' ? body.username : '',
      )
      throw new ApiError('AUTH_USERNAME_TAKEN', 409, error.message, {
        username: 'taken',
        ...(suggestion ? { suggestion } : {}),
      })
    }
    throw error
  }
})
