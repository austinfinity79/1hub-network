import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { requireMember, type MemberIdentity } from '@/lib/member/guard'

import { getDemoVenture, projectDemoActorKey } from './read-model'
import type { DemoVentureDetailDTO } from './types'

/**
 * WF05-T00 — server entry checks for `/demo/projects/*` pages (DEC-WF05-G2).
 *
 * The member entry (no session → /auth; onboarding not done → its resolver
 * step), then an opaque per-actor key for the browser application store. No
 * capability, RoleAssignment, membership or leadership is involved; a route is
 * not a security boundary and the demo API re-authorizes on its own.
 */
export async function requireProjectDemo(): Promise<{
  member: MemberIdentity
  actorKey: string
}> {
  const member = await requireMember()
  return { member, actorKey: projectDemoActorKey(member.accountId) }
}

/**
 * The venture a `/demo/projects/:id/*` page is about, read with the WF02 rule
 * (owner or ACTIVE member). Malformed, unknown or unreadable ids — including
 * another member's venture for a PLATFORM_ADMIN or a HUB leader — are the same
 * 404. Nothing from the request other than the id is used.
 */
export async function requireDemoVentureRoute(
  ventureId: string,
): Promise<Awaited<ReturnType<typeof requireProjectDemo>> & { detail: DemoVentureDetailDTO }> {
  const access = await requireProjectDemo()
  try {
    return { ...access, detail: await getDemoVenture(access.member.accountId, ventureId) }
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
}
