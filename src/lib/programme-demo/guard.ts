import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { requireOps } from '@/lib/ops/guard'

import { isDemoFixtureId } from './fixtures'
import { demoAccess, getDemoProgramme } from './read-model'
import type { ProgrammeDemoDetailDTO } from './types'

/**
 * WF04-T00 — server entry check for `/demo/programmes/*` pages (DEC-WF04-H2).
 *
 * The existing ops entry first (no session → /auth; onboarding not done → its
 * resolver step; no ops scope → 404), then `programme:read` somewhere
 * (PLATFORM_ADMIN, or HUB_COMMUNITY_LEADER of an organization). Per-programme
 * scope is checked by the read model on every read. A route is not a security
 * boundary: the demo API re-authorizes on its own.
 */
export async function requireProgrammeDemo() {
  const { accountId } = await requireOps()
  const access = await demoAccess(accountId)
  if (!access) notFound()
  return { accountId, ...access }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * WF04-S03 (DEC-WF04-S03-D2): the programme a `/demo/programmes/:id/*` page is
 * about. A malformed id → 404. An id in the fixture range → the fixture, read
 * with the actor's server-side scope (unknown or out of scope → the same
 * 404). Any other UUID can only be a draft of this browser session: the page
 * looks it up in the actor's own store and shows "not found" when it is not
 * there or not in the actor's allowance. Nothing from the request is trusted.
 */
export async function requireDemoProgrammeRoute(id: string): Promise<
  Awaited<ReturnType<typeof requireProgrammeDemo>> & {
    server: ProgrammeDemoDetailDTO | null
  }
> {
  const access = await requireProgrammeDemo()
  if (!UUID.test(id)) notFound()
  if (!isDemoFixtureId(id)) return { ...access, server: null }
  try {
    return { ...access, server: await getDemoProgramme(access.accountId, id) }
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
}
