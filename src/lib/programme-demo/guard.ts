import { notFound } from 'next/navigation'

import { requireOps } from '@/lib/ops/guard'

import { demoAccess } from './read-model'

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
