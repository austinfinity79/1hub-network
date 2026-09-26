import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { FROZEN_ROUTES, ROUTE_GROUPS, routesInGroup } from '../../../src/lib/routes'

/**
 * M0-T03 — route and shell smoke.
 *
 * Asserts that every route the frozen Screen Contract defines resolves, that the
 * shared shell renders around it, and that the M0-T02 typography foundation
 * still holds on a shell page.
 *
 * No approved production screen exists yet, so nothing here compares against
 * design-reference/final. Those baselines are read-only and belong to M1-M3.
 */

const ACTUAL_DIR = path.join(__dirname, '..', 'actual')

async function waitForFonts(page: Page) {
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15_000 })
}

/** Screens whose production implementation has replaced the M0-T03 placeholder. */
const IMPLEMENTED_SCREENS = new Set([
  'WF01-S01',
  'WF01-S02',
  'WF01-S03',
  'WF01-S04',
  'WF01-S05',
  'WF01-S06',
])

/** Implemented screens that send a guest to /auth (DEC-WF01-S05-D5, WF01-S06). */
const GUARDED_SCREENS = new Set(['WF01-S05', 'WF01-S06'])

test.describe('M0-T03 frozen routes', () => {
  test('the manifest covers 25 routes across all five groups', () => {
    expect(FROZEN_ROUTES).toHaveLength(25)
    for (const group of ROUTE_GROUPS) {
      expect(routesInGroup(group).length, `group ${group} is empty`).toBeGreaterThan(0)
    }
  })

  // One test per route so a failure names the exact route that broke.
  for (const route of FROZEN_ROUTES) {
    test(`${route.screenId} resolves at ${route.contractRoute}`, async ({ page }) => {
      const response = await page.goto(route.samplePath)

      expect(response?.status(), `${route.samplePath} did not return 200`).toBe(200)

      // An implemented screen replaces its placeholder and brings its own shell;
      // its behaviour is proven by that screen's own spec.
      if (IMPLEMENTED_SCREENS.has(route.screenId)) {
        if (GUARDED_SCREENS.has(route.screenId)) {
          await expect(page).toHaveURL('/auth')
          return
        }
        await expect(page.locator(`[data-route-group="${route.group}"]`).first()).toBeVisible()
        // Its own placeholder is gone. (WF01-S03 without a token redirects to
        // /auth/error, which is still WF01-S04's placeholder.)
        await expect(page.locator(`[data-route-placeholder="${route.screenId}"]`)).toHaveCount(0)
        return
      }

      const placeholder = page.locator(`[data-route-placeholder="${route.screenId}"]`)
      await expect(placeholder).toBeVisible()
      await expect(placeholder).toHaveAttribute('data-route-pattern', route.pattern)
      await expect(placeholder).toHaveAttribute('data-placeholder-group', route.group)
      await expect(placeholder).toHaveAttribute('data-workflow', route.workflow)

      // The shell must wrap every frozen route.
      await expect(page.locator(`[data-route-group="${route.group}"]`).first()).toBeVisible()
      await expect(page.locator('[data-shell="page-container"]').first()).toBeVisible()
    })
  }
})

test.describe('M0-T03 shared shell', () => {
  test('declares exactly one route-group boundary and one container', async ({ page }) => {
    await page.goto('/me')

    const groups = await page
      .locator('[data-route-group]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-route-group')))

    expect(groups).toEqual(['member'])
    await expect(page.locator('[data-shell="page-container"]')).toHaveCount(1)
  })

  test('keeps Be Vietnam Pro as the default UI font on a shell page', async ({ page }) => {
    await page.goto('/me')
    await waitForFonts(page)

    const typography = await page.evaluate(() => {
      const first = (stack: string) =>
        stack
          .split(',')[0]!
          .trim()
          .replace(/^["']|["']$/g, '')
      const body = getComputedStyle(document.body)
      const heading = document.querySelector('h1')

      return {
        bodyFamily: first(body.fontFamily),
        bodyBackground: body.backgroundColor,
        headingFamily: heading ? first(getComputedStyle(heading).fontFamily) : null,
        headingWeight: heading ? Number(getComputedStyle(heading).fontWeight) : null,
      }
    })

    expect(typography.bodyFamily).toBe('Be Vietnam Pro')
    expect(typography.headingFamily).toBe('Be Vietnam Pro')
    // .type-heading-2 is SemiBold per Design SOT 2.4.
    expect(typography.headingWeight).toBe(600)
    // --hub-canvas
    expect(typography.bodyBackground).toBe('rgb(239, 239, 239)')
  })

  test('captures under the frozen conditions: 1440x900 at DPR 1', async ({ page }) => {
    await page.goto('/me')

    const conditions = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    }))

    expect(conditions).toEqual({ width: 1440, height: 900, dpr: 1 })
  })
})

test.describe('M0-T03 route boundaries', () => {
  test('an unknown route returns 404 and renders the shell not-found boundary', async ({
    page,
  }) => {
    const response = await page.goto('/this-route-does-not-exist')

    expect(response?.status()).toBe(404)
    await expect(page.locator('[data-shell="not-found"]')).toBeVisible()
  })

  test('routes invented by architecture doc 04 are not implemented', async ({ page }) => {
    // The Screen Contract wins over doc 04, so these must not resolve.
    for (const orphan of ['/login', '/register', '/verify-email', '/ops/members']) {
      const response = await page.goto(orphan)
      expect(response?.status(), `${orphan} should not exist`).toBe(404)
    }
  })

  test('the typography harness is reachable only with dev routes enabled', async ({ page }) => {
    // The visual suite sets ENABLE_DEV_ROUTES=1, so it resolves here. The
    // production server does not set it, which is asserted separately by the
    // production-gating check in the M0-T03 report.
    const response = await page.goto('/dev/typography')

    expect(response?.status()).toBe(200)
    await expect(page.locator('[data-harness="typography"]')).toBeVisible()
    expect(FROZEN_ROUTES.map((r) => r.pattern)).not.toContain('/dev/typography')
  })
})

test.describe('M0-T03 shell evidence', () => {
  test('renders identically to the shell baseline', async ({ page }) => {
    await page.goto('/me')
    await waitForFonts(page)

    await page.screenshot({
      path: path.join(ACTUAL_DIR, 'shell-member-1440x900.png'),
      fullPage: true,
      animations: 'disabled',
    })

    await expect(page).toHaveScreenshot('shell-member.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    })
  })
})
