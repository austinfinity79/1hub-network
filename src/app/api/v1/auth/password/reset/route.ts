import { withApi } from '@/lib/api/handler'
import { completePasswordReset } from '@/lib/auth/credentials'
import { readSessionToken, sessionClearCookie } from '@/lib/auth/session-cookie'
import { requireJsonBody } from '@/lib/auth/require-json'

/**
 * POST /api/v1/auth/password/reset — US-01.04 steps 4-5.
 * Body: token (from the link fragment), password, password_confirm. 204.
 * The link is single use; every session of the account is revoked in the same
 * transaction as the new hash, and no new session is created: the user signs
 * in again (US-01.04 "Đã đổi mật khẩu → Đăng nhập"). Any session cookie this
 * browser holds is cleared too.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request, requestId, setCookie }) => {
  requireJsonBody(request)
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    token?: unknown
    password?: unknown
    password_confirm?: unknown
  }
  await completePasswordReset(body, requestId)
  if (readSessionToken(request.headers)) {
    const cookie = sessionClearCookie()
    setCookie(cookie.name, cookie.value, cookie.options)
  }
  return undefined
})
