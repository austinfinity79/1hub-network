import { ApiError } from '@/lib/api/errors'

import type { Actor } from './actor'
import { assignmentGrants, ruleFor, type Capability, type ScopeType } from './matrix'

/**
 * M0-T09 — the single server-side authorization entry point.
 *
 * Implements the frozen decision rule (03_AUTH_RBAC:36-42):
 *   authenticated AND role permits capability AND assignment active
 *   AND scope contains resource AND lifecycle/policy predicate passes
 *
 * Assignment validity is already enforced by resolveActor, which only returns
 * ACTIVE assignments inside their valid_from/valid_to window.
 */

export type ResourceScope = {
  scopeType: ScopeType
  /** Required for ORGANIZATION; ignored for PLATFORM. */
  scopeId?: string | null
}

/**
 * A lifecycle or policy check run only after the permission check passes.
 * Returning false denies with 409, because the contract requires a lifecycle
 * conflict to surface as a conflict rather than a permission error (API:1096).
 */
export type LifecyclePredicate = () => boolean | Promise<boolean>

export type AuthorizationDecision =
  { allowed: true } | { allowed: false; reason: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'LIFECYCLE' }

export async function authorize(
  actor: Actor | null,
  capability: Capability,
  resource: ResourceScope,
  lifecycle?: LifecyclePredicate,
): Promise<AuthorizationDecision> {
  if (!actor || !actor.profileId) {
    return { allowed: false, reason: 'UNAUTHENTICATED' }
  }

  const rule = ruleFor(capability)
  // An unknown capability is denied rather than defaulted. Nothing is granted
  // that the approved matrix does not list.
  if (!rule) return { allowed: false, reason: 'FORBIDDEN' }

  const platformGrant = actor.assignments.some(
    (a) => a.scopeType === 'PLATFORM' && assignmentGrants(a, rule),
  )

  // An organization grant must match the requested organization exactly. This
  // is constraint D1: a Leader scoped to A has no authority over B.
  const organizationGrant =
    resource.scopeType === 'ORGANIZATION' &&
    Boolean(resource.scopeId) &&
    actor.assignments.some(
      (a) =>
        a.scopeType === 'ORGANIZATION' &&
        a.scopeId === resource.scopeId &&
        assignmentGrants(a, rule),
    )

  if (!platformGrant && !organizationGrant) {
    return { allowed: false, reason: 'FORBIDDEN' }
  }

  if (lifecycle) {
    const ok = await lifecycle()
    if (!ok) return { allowed: false, reason: 'LIFECYCLE' }
  }

  return { allowed: true }
}

/** Boolean form, for deriving display state rather than guarding an action. */
export async function can(
  actor: Actor | null,
  capability: Capability,
  resource: ResourceScope,
): Promise<boolean> {
  return (await authorize(actor, capability, resource)).allowed
}

/**
 * Guard form: throws the frozen error for the failure mode.
 *
 * FORBIDDEN maps to SCOPE_FORBIDDEN (API:812), the contract's own code for an
 * authenticated actor outside their scope. LIFECYCLE maps to 409, because
 * API:1096 requires a lifecycle conflict to be a conflict, not a coercion.
 */
export async function require(
  actor: Actor | null,
  capability: Capability,
  resource: ResourceScope,
  lifecycle?: LifecyclePredicate,
): Promise<void> {
  const decision = await authorize(actor, capability, resource, lifecycle)
  if (decision.allowed) return

  if (decision.reason === 'UNAUTHENTICATED') {
    throw new ApiError('UNCONTRACTED_UNAUTHENTICATED', 401, 'Authentication is required.')
  }
  if (decision.reason === 'LIFECYCLE') {
    throw new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, 'This transition is not allowed.')
  }
  // Deliberately identical for "no permission" and "resource not in your scope",
  // so a caller cannot probe which organizations exist.
  throw new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
}
