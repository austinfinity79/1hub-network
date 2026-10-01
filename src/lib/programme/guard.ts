import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { requireOps } from '@/lib/ops/guard'
import { organizationScope } from '@/lib/ops/scope'

import { getProgramme } from './programme'
import type { ProgrammeDetailDTO } from './types'

/**
 * WF04-PROD-04 — server entry check for the WF04 operator pages (routes kept
 * at `/demo/programmes/*`, contract Q6). The existing ops entry first (no
 * session → /auth; onboarding not done → its step; no ops scope → 404), then
 * `programme:read` somewhere (HUB_COMMUNITY_LEADER of an organization, or
 * PLATFORM_ADMIN). A route is not a security boundary: every API call
 * re-authorizes on the server.
 */
export async function requireProgrammeArea(): Promise<{ accountId: string }> {
  const { accountId } = await requireOps()
  const scope = organizationScope(await resolveActor(accountId), 'programme:read')
  if (scope.kind === 'SOME' && scope.organizationIds.length === 0) notFound()
  return { accountId }
}

/**
 * The programme a `/demo/programmes/:id/*` page is about, read from the
 * canonical rows with the actor's scope. Unknown, malformed and out-of-scope
 * ids are the same 404; nothing falls back to a fixture.
 */
export async function requireProgrammeRoute(
  id: string,
): Promise<{ accountId: string; detail: ProgrammeDetailDTO }> {
  const { accountId } = await requireProgrammeArea()
  try {
    return { accountId, detail: await getProgramme(accountId, id) }
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 403)) notFound()
    throw error
  }
}
