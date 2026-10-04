import type { Actor } from '@/lib/authz/actor'
import { assignmentGrants, ruleFor, type Capability } from '@/lib/authz/matrix'

/**
 * WF03-T00 — which organizations an actor holds a capability for.
 *
 * Derived only from the actor's ACTIVE RoleAssignments and the approved matrix
 * (DECISION-AUTHZ-01B): a PLATFORM grant covers every organization; an
 * ORGANIZATION grant covers exactly that organization, never its children
 * (no inheritance, DEC-WF03-G11); a capability-only grant covers its one
 * capability there (PD-6). Membership, LeadershipRecord, titles and
 * organization type are not inputs, so none of them can grant anything
 * (DEC-WF03-G6).
 */

export type OrganizationScope = { kind: 'ALL' } | { kind: 'SOME'; organizationIds: string[] }

export function organizationScope(actor: Actor | null, capability: Capability): OrganizationScope {
  const rule = ruleFor(capability)
  if (!actor || !actor.profileId || !rule) return { kind: 'SOME', organizationIds: [] }
  if (actor.assignments.some((a) => a.scopeType === 'PLATFORM' && assignmentGrants(a, rule))) {
    return { kind: 'ALL' }
  }
  const ids = new Set<string>()
  for (const a of actor.assignments) {
    if (a.scopeType === 'ORGANIZATION' && a.scopeId && assignmentGrants(a, rule)) ids.add(a.scopeId)
  }
  return { kind: 'SOME', organizationIds: [...ids].sort() }
}

/** True when the actor may use the ops area at all (any organization in scope). */
export function hasOpsAccess(actor: Actor | null): boolean {
  const scope = organizationScope(actor, 'network:read')
  return scope.kind === 'ALL' || scope.organizationIds.length > 0
}
