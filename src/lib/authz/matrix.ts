/**
 * M0-T09 — the approved P0 authorization matrix, in code.
 *
 * Mirrors docs/implementation/AUTHORIZATION_CAPABILITY_MATRIX_P0.md section C,
 * frozen by DECISION-AUTHZ-01B, and its Admin Portal addendum
 * (AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md, DEC-ADM). `authz.db-test.ts`
 * fails if code and documents drift.
 *
 * This table is the ONLY source of grants. There is no wildcard, no implicit
 * inheritance and no "admin gets everything" branch: PLATFORM_ADMIN appears here
 * because the approved matrix lists it, capability by capability.
 */

export const P0_ROLES = [
  'INDIVIDUAL_USER',
  'HUB_MEMBER',
  'HUB_COMMUNITY_LEADER',
  'PLATFORM_ADMIN',
] as const

export type RoleCode = (typeof P0_ROLES)[number]

/** Frozen convention: resource:action (D5). No second convention. */
export const CAPABILITIES = [
  'network:read',
  'org:read',
  'member:read',
  'programme:read',
  'org:manage',
  'event:manage',
  'org:manage_relationship',
  'membership:confirm',
  'leadership:manage',
  // WF04 production (DEC-W4P-D02, contract §5): create, edit, publish, close.
  'programme:manage',
  // Admin Portal P0 (DEC-ADM, ADMIN-PROD-01 RBAC matrix). Organization-scoped:
  'verification:review',
  'access:delegate',
  // `account:escalate` was withdrawn by ADMIN-DECISION-04: no leader-facing
  // account escalation in P0; account operations are PLATFORM_ADMIN's alone.
  // Platform-scoped only:
  'venture:review',
  'org:lifecycle',
  'feedback:manage',
  'vocabulary:manage',
  'account:administer',
] as const

export type Capability = (typeof CAPABILITIES)[number]

export type ScopeType = 'PLATFORM' | 'ORGANIZATION'

/**
 * Which roles hold a capability, and at which scope.
 *
 * Every M0-T09 capability has the same shape: denied to the two individual
 * roles, allowed to a Leader only inside their assigned organization, allowed to
 * a Platform Admin platform-wide. The Admin Portal adds platform-only ones (no
 * organization role). It is written out per capability rather than collapsed,
 * so a future divergence is a data edit rather than a refactor, and so the table
 * reads like the approved documents.
 */
export type CapabilityRule = {
  capability: Capability
  /** Roles that may hold it at ORGANIZATION scope, bounded to their assignment. */
  organizationRoles: readonly RoleCode[]
  /** Roles that may hold it platform-wide. */
  platformRoles: readonly RoleCode[]
  /**
   * PD-6: whether a holder may grant this capability alone to someone else on
   * the same or a child organization (`role_assignments.capability`). Never for
   * `org:manage_relationship`, `leadership:manage`, `access:delegate` or any
   * platform-only capability (ADMIN-PROD-01 RBAC matrix).
   */
  delegable: boolean
}

const ORG_LEADER: readonly RoleCode[] = ['HUB_COMMUNITY_LEADER']
const PLATFORM_ADMIN: readonly RoleCode[] = ['PLATFORM_ADMIN']

export const CAPABILITY_MATRIX: readonly CapabilityRule[] = [
  {
    capability: 'network:read',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'org:read',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'member:read',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'programme:read',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'org:manage',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'event:manage',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'org:manage_relationship',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'membership:confirm',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'leadership:manage',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'programme:manage',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'verification:review',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: true,
  },
  {
    capability: 'access:delegate',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'venture:review',
    organizationRoles: [],
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'org:lifecycle',
    organizationRoles: [],
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'feedback:manage',
    organizationRoles: [],
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'vocabulary:manage',
    organizationRoles: [],
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
  {
    capability: 'account:administer',
    organizationRoles: [],
    platformRoles: PLATFORM_ADMIN,
    delegable: false,
  },
]

export function ruleFor(capability: Capability): CapabilityRule | undefined {
  return CAPABILITY_MATRIX.find((rule) => rule.capability === capability)
}

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value)
}

/** PD-6: true only for a capability the matrix marks delegable. */
export function isDelegable(capability: Capability): boolean {
  return ruleFor(capability)?.delegable === true
}

/**
 * The one grant predicate: does this assignment carry `rule.capability`?
 *
 * The role must hold the capability at the assignment's scope type, and a
 * capability-only grant (`role_assignments.capability`, PD-6) carries that one
 * capability and nothing else of its role. Every authorization path goes
 * through this, so a delegated grant can never act as the whole role.
 */
export function assignmentGrants(
  assignment: { roleCode: RoleCode; scopeType: ScopeType; capability: Capability | null },
  rule: CapabilityRule,
): boolean {
  if (assignment.capability !== null && assignment.capability !== rule.capability) return false
  return assignment.scopeType === 'PLATFORM'
    ? rule.platformRoles.includes(assignment.roleCode)
    : rule.organizationRoles.includes(assignment.roleCode)
}

export function isRoleCode(value: string): value is RoleCode {
  return (P0_ROLES as readonly string[]).includes(value)
}

/**
 * Constraint D3: no capability in P0 permits editing another user's canonical
 * IndividualProfile, and no impersonation exists. Declared here so the rule is
 * greppable and testable rather than merely absent.
 */
export const ADMIN_MAY_EDIT_OTHER_PROFILE = false
