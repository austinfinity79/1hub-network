import { expect, test } from '@playwright/test'

import { authenticate, resetSeed, runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { MANIFEST_PATH, toRepoPath } from '../pixel-qa/paths'
import { dryRun, FIXTURES, QA_SCREENS, qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * M0-T11 — manifest-driven Pixel QA runner for WF01-WF03 production screens.
 *
 * Always runs the manifest audit and dry run. A screen's pixel run executes
 * only when named, because no production screen is implemented yet and a route
 * placeholder must never be compared against an approved design:
 *
 *   PIXEL_QA_SCREENS=WF01-S01 pnpm visual pixel-qa-screens
 *
 * A screen run fails on V0 conditions (wrong viewport/DPR, unloaded fonts,
 * dimension mismatch) and typography violations. Pixel differences do not fail
 * it: they are evidence for a reviewer applying the Pixel QA section 6
 * taxonomy, and the report says PENDING_REVIEW. No run claims a product pass.
 */

const requested = new Set(
  (process.env.PIXEL_QA_SCREENS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

test.describe('M0-T11 manifest audit and dry run', () => {
  test('every manifest entry resolves and every production screen has a dry-run status', () => {
    const { manifest, screens } = loadManifest()
    const entries = dryRun(screens)

    writeJsonReport('manifest-audit.json', {
      manifest: toRepoPath(MANIFEST_PATH),
      version: manifest.version,
      viewport: manifest.viewport,
      dpr: manifest.dpr,
      entries: screens.length,
      references_resolved: screens.filter((s) => s.viewportSize).length,
      full_page_references: screens.filter((s) => s.fullPageSize).length,
      screens: screens.map((s) => ({
        screen_id: s.screen_id,
        reference_mode: s.reference_mode,
        viewport_reference: s.viewport_baseline,
        viewport_size: s.viewportSize,
        full_page_reference: s.full_page_baseline,
        full_page_size: s.fullPageSize,
      })),
    })
    writeJsonReport('dry-run.json', {
      product_pixel_pass_claimed: false,
      ready: entries.filter((e) => e.status === 'READY_FOR_SCREEN_IMPLEMENTATION').length,
      gaps: entries.filter((e) => e.status === 'REFERENCE_CONFIGURATION_GAP').length,
      entries,
    })

    expect(screens).toHaveLength(24)
    expect(screens.every((s) => s.viewportSize?.width === 1440)).toBe(true)
    expect(entries.map((e) => e.screen_id)).toEqual(QA_SCREENS.map((c) => c.screen_id))
    for (const entry of entries) expect(entry.route, entry.screen_id).toMatch(/^\//)
  })

  test('only known screen ids can be requested', () => {
    const known = new Set(QA_SCREENS.map((c) => c.screen_id))
    for (const id of requested) expect(known.has(id), `unknown screen ${id}`).toBe(true)
  })
})

test.describe('M0-T11 deterministic state hooks', () => {
  test('re-applies the deterministic seed idempotently', () => {
    expect(() => {
      resetSeed()
      resetSeed()
    }).not.toThrow()
  })

  test('authenticates the mapped seeded persona through the real login flow', async ({ page }) => {
    await authenticate(page, qaConfigFor('WF03-S02')!)
    const leader = await (await page.request.get('/api/v1/session')).json()
    expect(leader.authenticated).toBe(true)
    expect(leader.managed_scopes).toEqual([
      {
        scope_type: 'ORGANIZATION',
        scope_id: FIXTURES.chapter01Id,
        role_code: 'HUB_COMMUNITY_LEADER',
      },
    ])

    // A guest mapping clears any previous session rather than inheriting it.
    await authenticate(page, qaConfigFor('WF01-S01')!)
    const guest = await (await page.request.get('/api/v1/session')).json()
    expect(guest.authenticated).toBe(false)
  })

  test('refuses to run a screen whose reference configuration has a gap', async ({ page }) => {
    const { screens } = loadManifest()
    await expect(
      runScreenQa(page, findScreen(screens, 'WF03-S01'), qaConfigFor('WF03-S01')!),
    ).rejects.toThrow(/shorter than the 900px viewport/)
  })
})

test.describe('M0-T11 screen pixel runs', () => {
  const { screens } = loadManifest()

  for (const config of QA_SCREENS) {
    test(`${config.screen_id} pixel run`, async ({ page }) => {
      test.skip(!requested.has(config.screen_id), 'run with PIXEL_QA_SCREENS to enable')

      const reports = await runScreenQa(page, findScreen(screens, config.screen_id), config)
      for (const report of reports) {
        await test.info().attach(`${report.screen_id}.${report.capture}`, {
          body: JSON.stringify(report, null, 2),
          contentType: 'application/json',
        })
        expect(report.comparison.status, 'dimension mismatch is a geometry failure').not.toBe(
          'DIMENSION_MISMATCH',
        )
        expect(report.typography?.violations ?? [], 'typography contract').toEqual([])
      }
    })
  }
})
