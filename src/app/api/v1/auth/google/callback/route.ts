import { withApi } from '@/lib/api/handler'
import { ApiError } from '@/lib/api/errors'
import { sessionCookieSecure, REMEMBER_ME_COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/config'
import {
  GOOGLE_STATE_COOKIE,
  fetchGoogleProfile,
  googleConfig,
  signInWithGoogle,
  verifyGoogleState,
} from '@/lib/auth/google'
import { publicBaseUrl } from '@/lib/auth/magic-link-email'
import { sessionSetCookie } from '@/lib/auth/session-cookie'
import { requireJsonBody } from '@/lib/auth/require-json'

/**
 * POST /api/v1/auth/google/callback — S1-UAT-01, US-01.05. Maps WF01-S03.
 * Body: code, state, as Google appended them to /auth/callback. The state
 * cookie is cleared on EVERY outcome before anything else can fail, so one
 * started flow completes at most once (replay) and only in the browser that
 * started it (state mismatch → 400 AUTH_GOOGLE_STATE_MISMATCH). Success
 * answers like consume and sets a fresh session cookie.
 */
export const dynamic = 'force-dynamic'

function readCookie(headers: Headers, name: string): string | undefined {
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export const POST = withApi(async ({ request, requestId, setCookie }) => {
  requireJsonBody(request)
  const held = readCookie(request.headers, GOOGLE_STATE_COOKIE)
  setCookie(GOOGLE_STATE_COOKIE, '', {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  const body = (await request.json().catch(() => null)) as {
    code?: unknown
    state?: unknown
  } | null
  const verifier = verifyGoogleState(held, body?.state)

  const config = googleConfig()
  if (!config) throw new ApiError('AUTH_GOOGLE_FAILED', 400, 'Google sign-in is not available.')
  let base: string
  try {
    base = publicBaseUrl(new URL(request.url).origin)
  } catch {
    throw new ApiError('AUTH_GOOGLE_FAILED', 400, 'Google sign-in is not available.')
  }

  const profile = await fetchGoogleProfile(config, base, body?.code, verifier)
  const { response, sessionToken } = await signInWithGoogle(profile, requestId)
  const cookie = sessionSetCookie(sessionToken, REMEMBER_ME_COOKIE_MAX_AGE_SECONDS)
  setCookie(cookie.name, cookie.value, cookie.options)
  return response
})
