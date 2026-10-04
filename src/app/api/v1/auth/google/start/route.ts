import { NextResponse } from 'next/server'

import { sessionCookieSecure } from '@/lib/auth/config'
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE_SECONDS,
  googleConfig,
  startGoogleFlow,
} from '@/lib/auth/google'
import { publicBaseUrl } from '@/lib/auth/magic-link-email'

/**
 * GET /api/v1/auth/google/start — S1-UAT-01, US-01.05 "Tiếp tục với Google".
 * A top-level navigation, not a fetch: it answers 302 to Google's consent
 * screen and sets the HttpOnly state + PKCE cookie that binds the callback to
 * this browser (10 minutes). Not configured: 302 back to /auth with a
 * non-secret `?google=` note, never a provider flow.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const origin = new URL(request.url).origin
  const back = (note: string) => NextResponse.redirect(new URL(`/auth?google=${note}`, origin), 302)

  const config = googleConfig()
  if (!config) return back('unavailable')
  let base: string
  try {
    base = publicBaseUrl(origin)
  } catch {
    return back('unavailable')
  }
  const { url, cookieValue } = startGoogleFlow(config, base)
  const response = NextResponse.redirect(url, 302)
  response.cookies.set(GOOGLE_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: sessionCookieSecure(),
    // lax: the cookie must ride Google's top-level redirect back to /auth/callback.
    sameSite: 'lax',
    path: '/',
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
  })
  return response
}
