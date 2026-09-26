import { FROZEN_ROUTES } from '../../../src/lib/routes'

import { FROZEN_VIEWPORT, type ResolvedScreen } from './manifest'

/**
 * M0-T11 — tests-owned QA mapping: how to put the app into the state an
 * approved reference shows.
 *
 * design-reference/final/manifest.yaml is frozen Design SOT and defines the
 * reference image, mode and typography, but not the route, actor or fixture.
 * Those live here, owned by the test suite, so the frozen manifest keeps its
 * semantics (Pixel QA section 4 lists them as the fixture declaration).
 *
 * Routes come from FROZEN_ROUTES (the Screen Contract); this file only fills in
 * concrete fixture parameters. Every id below is a fixed UUID or slug from
 * db/seed/seed_p0_deterministic.sql and every actor is a seeded persona, so a
 * capture never depends on manually prepared state.
 */

/** Seeded personas (seed_p0_deterministic.sql, user_accounts). */
export const PERSONAS = {
  guest: null,
  newcomer: 'newcomer@example.test', // DRAFT profile, onboarding not complete
  member: 'member@example.test', // full profile, ACTIVE Chapter 01 member, project owner
  leader: 'leader@example.test', // HUB_COMMUNITY_LEADER scoped to Chapter 01
  ops: 'ops@example.test', // PLATFORM_ADMIN
  pending: 'pending@example.test', // PENDING_APPROVAL membership
} as const

export type Persona = keyof typeof PERSONAS

/** Fixed fixture ids from seed_p0_deterministic.sql. */
export const FIXTURES = {
  chapter01Id: '10000000-0000-0000-0000-000000000101',
  chapter01Slug: 'chapter-01',
  memberProfileId: '40000000-0000-0000-0000-000000000001',
  demoStartupId: '50000000-0000-0000-0000-000000000001',
} as const

export const SEED_FIXTURE = 'seed_p0_deterministic'

export type QaScreenConfig = {
  screen_id: string
  /** Contract route pattern chosen from FROZEN_ROUTES. */
  contract_route: string
  params: Record<string, string>
  actor: Persona
  fixture: typeof SEED_FIXTURE
  /** Short description of the state the reference shows. */
  state: string
  scroll_y: 0
  /**
   * Set when a capture cannot yet be configured deterministically. Stated as a
   * fact about missing configuration, never as a guess at intended behaviour.
   */
  gap?: string
}

/**
 * DEC-WF02-H12 — approved QA rule for full-page references shorter than the
 * 900px viewport (a browser full-page capture is never shorter than 900px):
 * 1. the 1440x900 DPR1 viewport comparison is authoritative;
 * 2. the reference is never scaled;
 * 3. the full-page capture is still produced;
 * 4. it is cropped to the reference height for the pixel comparison;
 * 5. everything below that height must be page/background continuation only.
 * Until WF02 this case was reported as a configuration gap.
 */
export const SHORT_FULL_PAGE_RULE = 'DEC-WF02-H12' as const

export type FullPageRule = 'EXACT' | 'CROP_TO_REFERENCE_HEIGHT'

/** How a screen's full-page reference is compared; null when it has none. */
export function fullPageRuleFor(screen: ResolvedScreen): FullPageRule | null {
  if (!screen.fullPageSize) return null
  return screen.fullPageSize.height < FROZEN_VIEWPORT.height ? 'CROP_TO_REFERENCE_HEIGHT' : 'EXACT'
}

const cfg = (
  screen_id: string,
  contract_route: string,
  actor: Persona,
  state: string,
  params: Record<string, string> = {},
  gap?: string,
): QaScreenConfig => ({
  screen_id,
  contract_route,
  params,
  actor,
  fixture: SEED_FIXTURE,
  state,
  scroll_y: 0,
  ...(gap ? { gap } : {}),
})

const ORG = { orgId: FIXTURES.chapter01Id }

export const QA_SCREENS: readonly QaScreenConfig[] = [
  // WF01 — Identity & Onboarding
  cfg('WF01-S01', '/auth', 'guest', 'auth entry, empty form'),
  cfg('WF01-S02', '/auth/check-email', 'guest', 'after a magic-link request'),
  // State-board mapping approved (D1-D7, WF01_S03_STATE_BOARD_MAPPING.md):
  // each state is compared against its own board panel, not the whole board.
  cfg('WF01-S03', '/auth/callback', 'guest', 'one callback state per run; panel crops'),
  // State-board mapping approved (DEC-WF01-S04-D1..D8, WF01_S04_STATE_BOARD_MAPPING.md).
  cfg('WF01-S04', '/auth/error', 'guest', 'one error state per run; component crops'),
  cfg('WF01-S05', '/onboarding/purpose', 'newcomer', 'onboarding step 1, DRAFT profile'),
  cfg('WF01-S06', '/onboarding/profile', 'newcomer', 'onboarding step 2, DRAFT profile'),
  cfg('WF01-S07', '/onboarding/privacy', 'newcomer', 'onboarding step 3, DRAFT profile'),
  cfg('WF01-S08', '/onboarding/complete', 'newcomer', 'reached by completing WF01-S05..S07'),

  // WF02 — Member Profile & Network Management
  cfg(
    'WF02-S01',
    '/me',
    'member',
    'account home: 60% profile, owned startup, ACTIVE Chapter 01 (test hook)',
  ),
  cfg('WF02-S02', '/me/profile/edit', 'member', 'edit own seeded profile (discovery NETWORK_ONLY)'),
  cfg(
    'WF02-S03',
    '/me/privacy',
    'member',
    'privacy: discovery NETWORK_ONLY, both current documents accepted',
  ),
  cfg(
    'WF02-S04',
    '/me/roles',
    'member',
    'roles: owned startup, ACTIVE Chapter 01, Chapter 01 leadership (test hook)',
  ),
  cfg('WF02-S05', '/projects/:id/edit', 'member', 'owner edits the seeded ACTIVE startup', {
    id: FIXTURES.demoStartupId,
  }),
  cfg(
    'WF02-S06',
    '/projects/:id/team',
    'member',
    'owner views the seeded startup team: owner row, three ACTIVE members (test hook), the seeded pending invitation',
    {
      id: FIXTURES.demoStartupId,
    },
  ),
  cfg('WF02-S07', '/me/settings', 'member', 'settings: one current session, no deletion request'),

  // WF03 — HUB / Chapter / CLB Operations
  cfg(
    'WF03-S01',
    '/ops/network',
    'ops',
    'platform admin: the seeded HUB / Chapter / CLB list plus one test-hook CLB (5 rows, as drawn)',
  ),
  cfg('WF03-S02', '/ops/org/:orgId', 'leader', 'Chapter 01 dashboard', ORG),
  cfg(
    'WF03-S03',
    '/ops/org/:orgId/members',
    'ops',
    'platform admin: a test-hook CLB with five relationships (two pending, one leader), as drawn',
    { orgId: 'e8000000-0000-0000-0000-000000000001' },
  ),
  cfg('WF03-S04', '/ops/org/:orgId/members/:profileId', 'leader', 'member detail', {
    ...ORG,
    profileId: FIXTURES.memberProfileId,
  }),
  cfg('WF03-S05', '/ops/org/:orgId/programmes', 'leader', 'Chapter 01 programmes', ORG),
  cfg('WF03-S06', '/ops/org/:orgId/profile', 'leader', 'Chapter 01 content/profile', ORG),
  cfg('WF03-S07', '/ops/org/:orgId/events', 'leader', 'Chapter 01 events', ORG),
  cfg('WF03-S08', '/ops/org/:orgId/settings', 'leader', 'Chapter 01 settings/relationships', ORG),
  cfg('WF03-S09', '/organizations/:slug', 'guest', 'public Chapter 01 page', {
    slug: FIXTURES.chapter01Slug,
  }),
]

export function qaConfigFor(screenId: string): QaScreenConfig | undefined {
  return QA_SCREENS.find((c) => c.screen_id === screenId)
}

/** Fills route params, refusing any param that is missing or unsafe. */
export function resolveRoute(config: QaScreenConfig): string {
  return config.contract_route.replace(/:(\w+)/g, (_, name: string) => {
    const value = config.params[name]
    if (!value) throw new Error(`${config.screen_id}: no fixture value for :${name}`)
    if (!/^[A-Za-z0-9-]+$/.test(value)) throw new Error(`${config.screen_id}: unsafe :${name}`)
    return value
  })
}

export type DryRunStatus = 'READY_FOR_SCREEN_IMPLEMENTATION' | 'REFERENCE_CONFIGURATION_GAP'

export type DryRunEntry = {
  screen_id: string
  status: DryRunStatus
  reference_mode: string
  route: string | null
  actor: Persona | null
  viewport_reference: string
  full_page_reference: string | null
  full_page_rule: FullPageRule | null
  reasons: string[]
}

/**
 * Checks, per manifest entry, that everything a future screen task needs is
 * configured: reference resolved at the frozen size, a contract route, concrete
 * fixture params and a seeded actor. It does not look at product content.
 */
export function dryRun(screens: ResolvedScreen[]): DryRunEntry[] {
  return screens.map((screen) => {
    const reasons: string[] = []
    const config = qaConfigFor(screen.screen_id)
    let route: string | null = null

    if (!config) {
      reasons.push('no tests-owned QA mapping entry')
    } else {
      const frozen = FROZEN_ROUTES.filter((r) => r.screenId === screen.screen_id)
      if (!frozen.some((r) => r.contractRoute === config.contract_route)) {
        reasons.push(
          `route ${config.contract_route} is not a frozen contract route for this screen`,
        )
      }
      try {
        route = resolveRoute(config)
      } catch (error) {
        reasons.push((error as Error).message)
      }
      if (!(config.actor in PERSONAS)) reasons.push(`unknown actor ${config.actor}`)
      if (config.gap) reasons.push(config.gap)
    }

    if (!screen.viewportSize) reasons.push('viewport reference not resolved')
    if (screen.full_page_baseline && !screen.fullPageSize) {
      reasons.push('full-page reference not resolved')
    }

    return {
      screen_id: screen.screen_id,
      status:
        reasons.length === 0 ? 'READY_FOR_SCREEN_IMPLEMENTATION' : 'REFERENCE_CONFIGURATION_GAP',
      reference_mode: screen.reference_mode,
      route,
      actor: config?.actor ?? null,
      viewport_reference: screen.viewport_baseline,
      full_page_reference: screen.full_page_baseline,
      full_page_rule: fullPageRuleFor(screen),
      reasons,
    }
  })
}
