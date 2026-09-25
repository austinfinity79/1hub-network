import { NextResponse } from 'next/server'

import { SESSION_TTL_SECONDS } from '@/lib/auth/config'
import { consumeMagicLink, requestMagicLink } from '@/lib/auth/magic-link'
import { sessionSetCookie } from '@/lib/auth/session-cookie'
import { devRoutesEnabled } from '@/lib/dev-routes'

/**
 * M0-T08 — deterministic login for browser tests. DEV/TEST ONLY.
 *
 * Gated by ENABLE_DEV_ROUTES, absent from the frozen route manifest, and served
 * outside /api/v1 so it can never be mistaken for a product endpoint. It 404s
 * on a production server.
 *
 * It does NOT fake a session. It drives the real magic-link flow end to end -
 * request, then consume - so the browser smoke exercises the same token
 * lifecycle, cookie attributes and session row that production uses. A shortcut
 * that minted a session directly would prove nothing about that path.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  if (!devRoutesEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  if (!body || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const { token } = await requestMagicLink(body.email, null)
  const { response, sessionToken } = await consumeMagicLink(token)

  const result = NextResponse.json(response, { status: 200 })
  const cookie = sessionSetCookie(sessionToken, SESSION_TTL_SECONDS)
  result.cookies.set(cookie.name, cookie.value, cookie.options)

  return result
}
