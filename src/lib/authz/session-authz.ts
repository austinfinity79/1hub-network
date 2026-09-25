import type { ManagedScope } from '@/lib/api/types'

import type { Actor } from './actor'
import { CAPABILITY_MATRIX, type Capability } from './matrix'

/**
 * M0-T09 — derives the contract's session authorization fields.
 *
 * Both are computed from the actor's active assignments against the approved
 * matrix. Nothing is read from the client, and no raw RoleAssignment row is
 * exposed: managed_scopes carries only the three fields the contract names
 * (API:139-145).
 */

/**
 * Every capability the actor holds anywhere, deduplicated and sorted.
 *
 * This list is for UI affordances only. Holding `event:manage` here says the
 * actor can manage events in at least one scope, never that they can manage a
 * particular one, so every protected call still re-authorizes with the concrete
 * resource (API:1094).
 */
export function deriveCapabilities(actor: Actor | null): Capability[] {
  if (!actor || !actor.profileId) return []

  const held = new Set<Capability>()

  for (const rule of CAPABILITY_MATRIX) {
    const granted = actor.assignments.some(
      (a) =>
        (a.scopeType === 'PLATFORM' && rule.platformRoles.includes(a.roleCode)) ||
        (a.scopeType === 'ORGANIZATION' && rule.organizationRoles.includes(a.roleCode)),
    )
    if (granted) held.add(rule.capability)
  }

  return [...held].sort()
}

/**
 * The scopes the actor administers, in the contract's shape.
 *
 * Only assignments that actually grant something in the matrix are listed, so a
 * role carrying no ops capability does not appear as a managed scope.
 */
export function deriveManagedScopes(actor: Actor | null): ManagedScope[] {
  if (!actor || !actor.profileId) return []

  const scopes: ManagedScope[] = []
  const seen = new Set<string>()

  for (const assignment of actor.assignments) {
    const grantsSomething = CAPABILITY_MATRIX.some((rule) =>
      assignment.scopeType === 'PLATFORM'
        ? rule.platformRoles.includes(assignment.roleCode)
        : rule.organizationRoles.includes(assignment.roleCode),
    )
    if (!grantsSomething) continue

    const key = `${assignment.scopeType}:${assignment.scopeId ?? ''}:${assignment.roleCode}`
    if (seen.has(key)) continue
    seen.add(key)

    scopes.push({
      scope_type: assignment.scopeType,
      scope_id: assignment.scopeId ?? '',
      role_code: assignment.roleCode,
    })
  }

  return scopes
}
