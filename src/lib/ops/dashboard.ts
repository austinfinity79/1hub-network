import { notFound } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { can, require as requireCapability } from '@/lib/authz/authorize'
import type { Capability } from '@/lib/authz/matrix'
import { query } from '@/lib/db/client'

import { childrenOf } from './hierarchy'
import { OPS_ORGANIZATION_TYPES, type OrganizationRefDTO } from './organizations'

/**
 * WF03-S02 — organization dashboard read model (API 05 §8.2, DEC-WF03-G1).
 *
 * Aggregates only, each from one canonical query on the selected organization:
 * - active_members        community_memberships  state = ACTIVE
 * - pending_memberships   community_memberships  state = PENDING_APPROVAL
 * - active_leaders        leadership_records     state = ACTIVE
 * - standalone_events     events                 programme_id IS NULL (WF03 Event scope, G10)
 * - published_events      events                 programme_id IS NULL AND status = PUBLISHED
 * - child_organizations   organization_relationships ACTIVE PARENT rows (hierarchy reader, G9)
 *
 * Not returned (G1): programme/challenge counts (`linked_programmes` in the
 * §8.2 example is WF04), "upcoming" events (no frozen time semantics), and any
 * funnel, growth or startup/investor figure. No identities: no member,
 * requester or leader appears, so no visibility rule is bypassed.
 *
 * Authorization is `org:read` for exactly this organization (M0-T09 `require`:
 * out of scope → 403 SCOPE_FORBIDDEN, the same answer for every foreign id).
 */

export type OrganizationDashboardDTO = {
  organization: OrganizationRefDTO
  summary: {
    active_members: number
    pending_memberships: number
    active_leaders: number
    standalone_events: number
    published_events: number
    child_organizations: number
  }
  /** The actor's capabilities for this organization, display only (API §8.2). */
  permissions: Capability[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PERMISSIONS: readonly Capability[] = [
  'org:read',
  'member:read',
  'membership:confirm',
  'leadership:manage',
  'org:manage',
  'event:manage',
  'org:manage_relationship',
]

export async function getOrganizationDashboard(
  accountId: string,
  orgId: string,
): Promise<OrganizationDashboardDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'org:read', { scopeType: 'ORGANIZATION', scopeId: orgId })
  if (!UUID.test(orgId)) throw notFound()
  const [org] = await query<OrganizationRefDTO>(
    `SELECT id::text, slug, name, type::text AS type FROM organizations
      WHERE id = $1 AND type::text = ANY($2::text[])`,
    [orgId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!org) throw notFound()

  const [counts] = await query<Omit<OrganizationDashboardDTO['summary'], 'child_organizations'>>(
    `SELECT
       (SELECT count(*)::int FROM community_memberships
         WHERE organization_id = $1 AND state = 'ACTIVE') AS active_members,
       (SELECT count(*)::int FROM community_memberships
         WHERE organization_id = $1 AND state = 'PENDING_APPROVAL') AS pending_memberships,
       (SELECT count(*)::int FROM leadership_records
         WHERE organization_id = $1 AND state = 'ACTIVE') AS active_leaders,
       (SELECT count(*)::int FROM events
         WHERE organization_id = $1 AND programme_id IS NULL) AS standalone_events,
       (SELECT count(*)::int FROM events
         WHERE organization_id = $1 AND programme_id IS NULL AND status = 'PUBLISHED') AS published_events`,
    [org.id],
  )
  const children = await childrenOf(query, org.id)

  const permissions: Capability[] = []
  for (const capability of PERMISSIONS) {
    if (await can(actor, capability, { scopeType: 'ORGANIZATION', scopeId: org.id })) {
      permissions.push(capability)
    }
  }
  return {
    organization: org,
    summary: { ...counts!, child_organizations: children.length },
    permissions,
  }
}
