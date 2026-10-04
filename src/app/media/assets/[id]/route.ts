import { NextResponse } from 'next/server'

import { isFeedbackScreenshot, managerMayFetchScreenshot } from '@/lib/admin/feedback-ops'
import { reviewerMayFetchLogo } from '@/lib/admin/venture-review-queue'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { query } from '@/lib/db/client'
import { readAsset } from '@/lib/media/avatar-storage'
import { discoveryLevelOf } from '@/lib/profile/visibility'

/**
 * GET /media/assets/:id — the served form of an uploaded avatar, as the
 * avatar response's `url` names it (05:369-374).
 *
 * Authorised here, at the serving boundary, not by hiding URLs
 * (DEC-WF01-S07-D5; avatar belongs to PROFILE_DISCOVERY):
 * - the owner may always fetch it;
 * - another signed-in account only while it is the owner's current avatar
 *   and the owner's PROFILE_DISCOVERY is NETWORK_ONLY (or wider);
 * - PRIVATE discovery, guests, unknown ids: the same 404, so nothing reveals
 *   that an asset exists. Never cached publicly.
 * - ADMIN-PROD-04: a venture reviewer (`venture:review`) may fetch an asset that
 *   is a venture's logo or a review's proposed logo; avatars are unaffected.
 * - ADMIN-PROD-05: a feedback screenshot is served only to a feedback manager
 *   (`feedback:manage`) during its 90 days (PD-5) — never after, never to anyone
 *   else, its uploader included.
 */
export const dynamic = 'force-dynamic'

const VISIBLE_TO_NETWORK = new Set(['NETWORK_ONLY', 'PUBLIC'])

/** The avatar rule: the owner's current avatar, with PROFILE_DISCOVERY NETWORK_ONLY or wider. */
async function avatarVisible(owner: string, id: string): Promise<boolean> {
  const [current] = await query<{ avatar_asset_id: string | null }>(
    'SELECT avatar_asset_id FROM individual_profiles WHERE account_id = $1',
    [owner],
  )
  return current?.avatar_asset_id === id && VISIBLE_TO_NETWORK.has(await discoveryLevelOf(owner))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const denied = new NextResponse(null, { status: 404 })
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) return denied
  const id = (await params).id
  const asset = await readAsset(id)
  if (!asset) return denied

  const owner = asset.meta.owner_account_id
  // A feedback screenshot: managers only, within 90 days — not even its uploader (PD-5).
  if (await isFeedbackScreenshot(id)) {
    if (!(await managerMayFetchScreenshot(session.accountId, id))) return denied
  } else if (owner !== session.accountId && !(await avatarVisible(owner, id))) {
    // Only then the operator rules, so avatar views pay nothing for them.
    const operator =
      (await reviewerMayFetchLogo(session.accountId, id)) ||
      (await managerMayFetchScreenshot(session.accountId, id))
    if (!operator) return denied
  }

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      'Content-Type': asset.meta.content_type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
