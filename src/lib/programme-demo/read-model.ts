import { createHash } from 'node:crypto'

import { ApiError, notFound } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { query } from '@/lib/db/client'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'
import { organizationScope } from '@/lib/ops/scope'

import { DEMO_PROGRAMMES, demoFixture } from './fixtures'
import type { OrganizationAllowance } from './readiness'
import type { ProgrammeDemoDetailDTO, ProgrammeDemoSummaryDTO } from './types'
import { toSummary } from './session-store'

/**
 * WF04-T00 — server read model of the Programme demo (DEC-WF04-H2, T00-D2).
 *
 * Authority comes only from the session account's ACTIVE RoleAssignments and
 * the approved matrix: `programme:read` for PLATFORM (every programme) or for
 * exactly the owning organization (HUB_COMMUNITY_LEADER, no inheritance).
 * Membership, LeadershipRecord, `role_label`, the PROGRAMME_ORGANIZER display
 * label and any client-supplied organization id are not inputs.
 *
 * Reads the frozen fixture plus one SELECT on `organizations` for the owner's
 * public reference; it never writes. A fixture whose owning organization does
 * not exist is not listed (every Programme has a responsible Organization).
 */

type OrgRow = OrganizationRefDTO

function allowanceOf(actor: Actor): OrganizationAllowance | null {
  const scope = organizationScope(actor, 'programme:read')
  if (scope.kind === 'ALL') return 'ALL'
  return scope.organizationIds.length > 0 ? scope.organizationIds : null
}

async function organizationsById(ids: string[]): Promise<Map<string, OrgRow>> {
  if (ids.length === 0) return new Map()
  const rows = await query<OrgRow>(
    `SELECT id::text, slug, name, type::text AS type FROM organizations WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, r]))
}

/** What the demo shell needs about the actor; null when the demo does not exist for them. */
export async function demoAccess(
  accountId: string,
): Promise<{ allowance: OrganizationAllowance; actorKey: string } | null> {
  const allowance = allowanceOf(await resolveActor(accountId))
  if (!allowance) return null
  // Namespaces the browser session store per actor; not reversible, not a secret.
  const actorKey = createHash('sha256').update(`wf04-demo:${accountId}`).digest('hex').slice(0, 16)
  return { allowance, actorKey }
}

async function visibleDetails(allowance: OrganizationAllowance): Promise<ProgrammeDemoDetailDTO[]> {
  const candidates = DEMO_PROGRAMMES.filter(
    (d) => allowance === 'ALL' || allowance.includes(d.programme.organization_id),
  )
  const orgs = await organizationsById([
    ...new Set(candidates.map((d) => d.programme.organization_id)),
  ])
  const details: ProgrammeDemoDetailDTO[] = []
  for (const d of candidates) {
    const organization = orgs.get(d.programme.organization_id)
    if (organization) details.push({ ...structuredClone(d), organization, demo: true })
  }
  return details
}

/** GET /demo/programmes. 403 SCOPE_FORBIDDEN without `programme:read` anywhere. */
export async function listDemoProgrammes(accountId: string): Promise<ProgrammeDemoSummaryDTO[]> {
  const allowance = allowanceOf(await resolveActor(accountId))
  if (!allowance)
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
  return (await visibleDetails(allowance)).map(toSummary)
}

/** GET /demo/programmes/{id}. Unknown, malformed or out-of-scope ids are the same 404. */
export async function getDemoProgramme(
  accountId: string,
  id: string,
): Promise<ProgrammeDemoDetailDTO> {
  if (!demoFixture(id)) throw notFound()
  const allowance = allowanceOf(await resolveActor(accountId))
  if (!allowance) throw notFound()
  const detail = (await visibleDetails(allowance)).find((d) => d.programme.id === id)
  if (!detail) throw notFound()
  return detail
}
