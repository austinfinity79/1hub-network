import { NextResponse } from 'next/server'

import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { readAsset } from '@/lib/media/avatar-storage'

/**
 * GET /media/assets/:id — the served form of an uploaded asset, as the avatar
 * response's `url` names it (05:369-374). Private: only a signed-in session
 * receives bytes (provisional P0 rule, DEC-WF01-S06-D3), and responses are
 * never cached publicly. Unknown ids and guests get the same 404.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await resolveSession(readSessionToken(request.headers))
  const asset = session ? await readAsset((await params).id) : null
  if (!asset) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      'Content-Type': asset.meta.content_type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
