/**
 * M0-T03 — frozen route manifest for WF01-WF03.
 *
 * SOURCE OF TRUTH: docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml.
 * `routes.test.ts` parses that file and fails if this manifest drifts from it,
 * so the contract stays authoritative rather than this copy.
 *
 * Architecture doc 04 lists a different route table (/login, /register,
 * /ops/members, /me/memberships). The Screen Contracts win per the task's
 * precedence order, so doc 04's paths are deliberately NOT implemented.
 *
 * Route groups are Next.js parenthesised folders. They organise layouts and do
 * not appear in the URL, and per the frozen architecture they are NOT a
 * security boundary: the server re-authorises every request regardless.
 */

export const ROUTE_GROUPS = ['public', 'auth', 'onboarding', 'member', 'ops'] as const
export type RouteGroup = (typeof ROUTE_GROUPS)[number]

export type Workflow = 'WF01' | 'WF02' | 'WF03'

export type FrozenRoute = {
  /** Screen id from the contract. WF02-S05 maps to two routes. */
  screenId: string
  workflow: Workflow
  group: RouteGroup
  /** Exactly as written in the contract, with `:param` placeholders. */
  contractRoute: string
  /** Next.js pattern, with `[param]` segments. */
  pattern: string
  /** Concrete URL used by route-resolution tests. Params are placeholders. */
  samplePath: string
}

/**
 * Placeholder values for `:param` segments in route-resolution tests.
 * Declared before FROZEN_ROUTES because `r()` reads it during module init.
 */
const SAMPLE_PARAMS: Record<string, string> = {
  id: 'sample-project',
  orgId: 'sample-org',
  profileId: 'sample-profile',
  slug: 'sample-org',
}

export const FROZEN_ROUTES: readonly FrozenRoute[] = [
  // WF01 — Identity & Onboarding
  r('WF01-S01', 'WF01', 'auth', '/auth'),
  r('WF01-S02', 'WF01', 'auth', '/auth/check-email'),
  r('WF01-S03', 'WF01', 'auth', '/auth/callback'),
  r('WF01-S04', 'WF01', 'auth', '/auth/error'),
  r('WF01-S05', 'WF01', 'onboarding', '/onboarding/purpose'),
  r('WF01-S06', 'WF01', 'onboarding', '/onboarding/profile'),
  r('WF01-S07', 'WF01', 'onboarding', '/onboarding/privacy'),
  r('WF01-S08', 'WF01', 'onboarding', '/onboarding/complete'),

  // WF02 — Member Profile & Network Management
  r('WF02-S01', 'WF02', 'member', '/me'),
  r('WF02-S02', 'WF02', 'member', '/me/profile/edit'),
  r('WF02-S03', 'WF02', 'member', '/me/privacy'),
  r('WF02-S04', 'WF02', 'member', '/me/roles'),
  r('WF02-S05', 'WF02', 'member', '/projects/new'),
  r('WF02-S05', 'WF02', 'member', '/projects/:id/edit'),
  r('WF02-S06', 'WF02', 'member', '/projects/:id/team'),
  r('WF02-S07', 'WF02', 'member', '/me/settings'),

  // WF03 — HUB / Chapter / CLB Operations
  r('WF03-S01', 'WF03', 'ops', '/ops/network'),
  r('WF03-S02', 'WF03', 'ops', '/ops/org/:orgId'),
  r('WF03-S03', 'WF03', 'ops', '/ops/org/:orgId/members'),
  r('WF03-S04', 'WF03', 'ops', '/ops/org/:orgId/members/:profileId'),
  r('WF03-S05', 'WF03', 'ops', '/ops/org/:orgId/programmes'),
  r('WF03-S06', 'WF03', 'ops', '/ops/org/:orgId/profile'),
  r('WF03-S07', 'WF03', 'ops', '/ops/org/:orgId/events'),
  r('WF03-S08', 'WF03', 'ops', '/ops/org/:orgId/settings'),

  // WF03-S09 sits in the PRODUCTION_INTERNAL workflow but the contract gives it
  // `scope: public_or_network_visibility`, so it is routed as public.
  r('WF03-S09', 'WF03', 'public', '/organizations/:slug'),
]

function r(
  screenId: string,
  workflow: Workflow,
  group: RouteGroup,
  contractRoute: string,
): FrozenRoute {
  return {
    screenId,
    workflow,
    group,
    contractRoute,
    pattern: contractRoute.replace(/:(\w+)/g, '[$1]'),
    samplePath: contractRoute.replace(/:(\w+)/g, (_, name: string) => {
      const value = SAMPLE_PARAMS[name]
      if (!value) throw new Error(`no sample value for :${name} in ${contractRoute}`)
      return value
    }),
  }
}

export function routesInGroup(group: RouteGroup): FrozenRoute[] {
  return FROZEN_ROUTES.filter((route) => route.group === group)
}

export function routeByPattern(pattern: string): FrozenRoute | undefined {
  return FROZEN_ROUTES.find((route) => route.pattern === pattern)
}
