import type { Actor } from '@/lib/authz/actor'
import { assignmentGrants, ruleFor, type Capability, type RoleCode } from '@/lib/authz/matrix'
import type { Executor } from '@/lib/db/client'
import { childrenOf } from '@/lib/ops/hierarchy'
import type { OrganizationScope } from '@/lib/ops/scope'

import { isSameScope } from './hierarchy'

/**
 * ADMIN-PROD-02 — the server-side scope model of the Admin Portal.
 *
 * Every input is the actor resolved from the session (`resolveActor`: ACTIVE,
 * currently valid assignments read from the database) and canonical ids loaded
 * on the server. Nothing here accepts a role, a scope or an organization list
 * from the client; a client-named organization is only ever the RESOURCE being
 * checked, never the authority.
 *
 * Two notions, kept apart (ADMIN-PROD-01 RBAC matrix, DL:764):
 *
 *   authority  where a capability is exercised: exactly the assigned
 *              organization, or everywhere for a PLATFORM grant. No inheritance:
 *              a HUB Tổng leader does not act on a Chapter unless granted there.
 *   reach      where an organization leader may hand access on (PD-6) — its own
 *              unit and its direct children: HUB Tổng → its Chapters, Chapter →
 *              its CLBs, CLB → itself — and where verification requests fall back
 *              to it (PD-1). Reach moves requests and grants, never authority.
 *
 *   PLATFORM_ADMIN  authority and reach everywhere.
 *   HUB leader      authority: HUB Tổng; reach: HUB Tổng + its Chapters.
 *   Chapter leader  authority: the Chapter; reach: the Chapter + its CLBs.
 *   CLB leader      authority and reach: the CLB only.
 */

/** Holds `capability` platform-wide. */
export function holdsPlatform(actor: Actor | null, capability: Capability): boolean {
  const rule = ruleFor(capability)
  if (!actor?.profileId || !rule) return false
  return actor.assignments.some((a) => a.scopeType === 'PLATFORM' && assignmentGrants(a, rule))
}

/** Holds `capability` on exactly `orgId`, or platform-wide. Never via a parent. */
export function holdsAt(actor: Actor | null, capability: Capability, orgId: string): boolean {
  const rule = ruleFor(capability)
  if (!actor?.profileId || !rule) return false
  if (holdsPlatform(actor, capability)) return true
  return actor.assignments.some(
    (a) =>
      a.scopeType === 'ORGANIZATION' && isSameScope(a.scopeId, orgId) && assignmentGrants(a, rule),
  )
}

/** Holds the WHOLE role on exactly `orgId` (not a capability-only grant of it). */
export function holdsRoleAt(actor: Actor | null, role: RoleCode, orgId: string): boolean {
  if (!actor?.profileId) return false
  return actor.assignments.some(
    (a) =>
      a.scopeType === 'ORGANIZATION' &&
      a.capability === null &&
      a.roleCode === role &&
      isSameScope(a.scopeId, orgId),
  )
}

/** The organizations where the actor holds `access:delegate` (its delegation sources). */
export function delegationSources(actor: Actor | null): OrganizationScope {
  if (holdsPlatform(actor, 'access:delegate')) return { kind: 'ALL' }
  const rule = ruleFor('access:delegate')!
  const ids = new Set<string>()
  for (const a of actor?.profileId ? actor.assignments : []) {
    if (a.scopeType === 'ORGANIZATION' && a.scopeId && assignmentGrants(a, rule)) ids.add(a.scopeId)
  }
  return { kind: 'SOME', organizationIds: [...ids].sort() }
}

/** PD-6 reach: every delegation source and its direct canonical children. */
export async function delegationReach(
  exec: Executor,
  actor: Actor | null,
): Promise<OrganizationScope> {
  const sources = delegationSources(actor)
  if (sources.kind === 'ALL') return sources
  const ids = new Set(sources.organizationIds)
  for (const source of sources.organizationIds) {
    for (const child of await childrenOf(exec, source)) ids.add(child)
  }
  return { kind: 'SOME', organizationIds: [...ids].sort() }
}

/** True when `orgId` is inside an organization scope. */
export function inScope(scope: OrganizationScope, orgId: string): boolean {
  return scope.kind === 'ALL' || scope.organizationIds.some((id) => isSameScope(id, orgId))
}
