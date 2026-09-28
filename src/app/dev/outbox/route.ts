import { NextResponse } from 'next/server'

import { readDevOutbox } from '@/lib/auth/magic-link-email'
import { normalizeEmail } from '@/lib/auth/tokens'
import { devRoutesEnabled } from '@/lib/dev-routes'

/**
 * TASK 22-PREVIEW-AUTH — the local / CI "inbox". DEV/TEST ONLY.
 *
 * Gated by ENABLE_DEV_ROUTES (404 on a server) and outside /api/v1. Returns the
 * last magic link the dev transport "sent" to an address, so browser tests open
 * the real e-mailed link instead of minting a token themselves. With a Resend
 * key configured nothing lands here.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  if (!devRoutesEnabled()) return new NextResponse(null, { status: 404 })
  const email = new URL(request.url).searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  const message = readDevOutbox(normalizeEmail(email))
  if (!message) return NextResponse.json({ error: 'no message' }, { status: 404 })
  return NextResponse.json(message, { status: 200 })
}
