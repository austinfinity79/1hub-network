import { NextResponse } from 'next/server'

import { normalizeEmail } from '@/lib/auth/email'
import { devRoutesEnabled } from '@/lib/dev-routes'
import { readDevInvitationOutbox } from '@/lib/venture/invitation-email'

/**
 * WF02 team invitations — the local / CI "inbox". DEV/TEST ONLY.
 *
 * Gated by ENABLE_DEV_ROUTES (404 on a server) and outside /api/v1. Returns the
 * last invitation notice the dev transport "sent" to an address, so tests read
 * the real message. With a Resend key configured nothing lands here.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  if (!devRoutesEnabled()) return new NextResponse(null, { status: 404 })
  const email = new URL(request.url).searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  const message = readDevInvitationOutbox(normalizeEmail(email))
  if (!message) return NextResponse.json({ error: 'no message' }, { status: 404 })
  return NextResponse.json(message, { status: 200 })
}
