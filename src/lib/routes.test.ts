import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FROZEN_ROUTES, ROUTE_GROUPS, routesInGroup } from './routes'

/**
 * Drift guard. The Screen Contract is the source of truth for routes; this test
 * fails if src/lib/routes.ts stops matching it.
 *
 * The contract is parsed with a regex rather than a YAML library so the project
 * takes no dependency just to read one frozen file.
 */
const CONTRACT = readFileSync(
  join(process.cwd(), 'docs', 'design', 'SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml'),
  'utf8',
)

/** Every `- id:` / `route:` pair in contract order, with `|` alternatives split out. */
function parseContractRoutes(): { screenId: string; route: string }[] {
  const pairs = [...CONTRACT.matchAll(/- id:\s*(\S+)[\s\S]*?route:\s*(.+)/g)]

  return pairs.flatMap((match) =>
    match[2]!
      .trim()
      .split('|')
      .map((route) => ({ screenId: match[1]!, route: route.trim() })),
  )
}

describe('M0-T03 frozen route manifest', () => {
  const contractRoutes = parseContractRoutes()

  it('parses the expected shape of the contract', () => {
    // 24 screens, 25 routes: WF02-S05 declares two.
    expect(new Set(contractRoutes.map((r) => r.screenId)).size).toBe(24)
    expect(contractRoutes).toHaveLength(25)
  })

  it('covers every contract route exactly once, with no extras', () => {
    const fromContract = contractRoutes.map((r) => `${r.screenId} ${r.route}`).sort()
    const fromManifest = FROZEN_ROUTES.map((r) => `${r.screenId} ${r.contractRoute}`).sort()

    expect(fromManifest).toEqual(fromContract)
  })

  it('assigns every route to a known group', () => {
    for (const route of FROZEN_ROUTES) {
      expect(ROUTE_GROUPS, `${route.contractRoute} has an unknown group`).toContain(route.group)
    }
  })

  it('routes the publicly scoped organisation page into the public group', () => {
    // WF03-S09 sits in the PRODUCTION_INTERNAL workflow, but the contract marks
    // its scope public_or_network_visibility. Scope wins over workflow mode.
    const publicRoutes = routesInGroup('public')

    expect(publicRoutes).toHaveLength(1)
    expect(publicRoutes[0]!.screenId).toBe('WF03-S09')
    expect(publicRoutes[0]!.contractRoute).toBe('/organizations/:slug')
    expect(CONTRACT).toMatch(/public_or_network_visibility/)
  })

  it('groups the remaining routes as the workflows require', () => {
    expect(routesInGroup('auth').map((r) => r.contractRoute)).toEqual([
      '/auth',
      '/auth/check-email',
      '/auth/callback',
      '/auth/error',
    ])
    expect(routesInGroup('onboarding')).toHaveLength(4)
    expect(routesInGroup('member')).toHaveLength(8)
    expect(routesInGroup('ops')).toHaveLength(8)
  })

  it('translates contract params into Next patterns and resolvable sample paths', () => {
    for (const route of FROZEN_ROUTES) {
      expect(route.pattern, `${route.contractRoute} kept a : param`).not.toMatch(/:/)
      expect(route.samplePath, `${route.contractRoute} kept a : param`).not.toMatch(/:/)
      expect(route.samplePath, `${route.contractRoute} kept a [ param`).not.toMatch(/[[\]]/)
      expect(route.samplePath.startsWith('/')).toBe(true)
    }

    expect(routesInGroup('ops').find((r) => r.screenId === 'WF03-S04')).toMatchObject({
      pattern: '/ops/org/[orgId]/members/[profileId]',
      samplePath: '/ops/org/sample-org/members/sample-profile',
    })
  })

  it('implements no route the architecture docs invented', () => {
    // Architecture doc 04 lists these; the Screen Contract does not.
    const notInContract = [
      '/login',
      '/register',
      '/verify-email',
      '/ops/members',
      '/me/memberships',
    ]
    const implemented = FROZEN_ROUTES.map((r) => r.contractRoute)

    for (const path of notInContract) {
      expect(implemented, `${path} comes from doc 04, not the contract`).not.toContain(path)
    }
  })
})
