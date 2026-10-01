/**
 * M0-T09 — the approved P0 authorization matrix, in code.
 *
 * Mirrors docs/implementation/AUTHORIZATION_CAPABILITY_MATRIX_P0.md section C,
 * frozen by DECISION-AUTHZ-01B. `matrix.test.ts` fails if the two drift.
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
] as const

export type Capability = (typeof CAPABILITIES)[number]

export type ScopeType = 'PLATFORM' | 'ORGANIZATION'

/**
 * Which roles hold a capability, and at which scope.
 *
 * Every capability in the approved matrix has the same shape: denied to the two
 * individual roles, allowed to a Leader only inside their assigned organization,
 * allowed to a Platform Admin platform-wide. It is written out per capability
 * rather than collapsed, so a future divergence is a data edit rather than a
 * refactor, and so the table reads like the approved document.
 */
export type CapabilityRule = {
  capability: Capability
  /** Roles that may hold it at ORGANIZATION scope, bounded to their assignment. */
  organizationRoles: readonly RoleCode[]
  /** Roles that may hold it platform-wide. */
  platformRoles: readonly RoleCode[]
}

const ORG_LEADER: readonly RoleCode[] = ['HUB_COMMUNITY_LEADER']
const PLATFORM_ADMIN: readonly RoleCode[] = ['PLATFORM_ADMIN']

export const CAPABILITY_MATRIX: readonly CapabilityRule[] = [
  { capability: 'network:read', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  { capability: 'org:read', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  { capability: 'member:read', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  { capability: 'programme:read', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  { capability: 'org:manage', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  { capability: 'event:manage', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  {
    capability: 'org:manage_relationship',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
  },
  {
    capability: 'membership:confirm',
    organizationRoles: ORG_LEADER,
    platformRoles: PLATFORM_ADMIN,
  },
  { capability: 'leadership:manage', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
  { capability: 'programme:manage', organizationRoles: ORG_LEADER, platformRoles: PLATFORM_ADMIN },
]

export function ruleFor(capability: Capability): CapabilityRule | undefined {
  return CAPABILITY_MATRIX.find((rule) => rule.capability === capability)
}

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value)
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
