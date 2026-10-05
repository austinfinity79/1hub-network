import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import {
  applyVocabularyFixture,
  completedAccount,
  reach,
  signInFresh,
  watchConsole,
} from '../support/onboarding'

/**
 * S1-UAT-09 — Sprint 1 copy polish: FB-08 (onboarding stage 2 keeps only the
 * field titles and short placeholders) and FB-16 (under "Một dòng mô tả" only
 * "Dưới 20 từ." stays); nothing collapses or overflows at 1440 / 768 / 390.
 */

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** The element sits inside the viewport horizontally and is not zero-sized. */
async function fits(page: Page, selector: string, width: number) {
  const box = (await page.locator(selector).first().boundingBox())!
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
}

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: FB-08 stage 2 and FB-16 project wizard fit, nothing clipped`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await signInFresh(page.request, `s1u9-r${width}`)
      await reach(page.request, 'CAPABILITY')
      await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await expect(page.locator('[data-anchor="guide"]')).toHaveCount(0)
      for (const anchor of ['domains', 'specializations']) {
        await expect(page.locator(`[data-anchor="${anchor}"] > p`)).toHaveCount(0)
        await fits(page, `[data-anchor="${anchor}"] label`, width)
        await fits(page, `[data-anchor="${anchor}"] input`, width)
      }
      // The title row sits right above its tag control: no unexplained gap.
      const head = (await page.locator('[data-anchor="domains"] label').boundingBox())!
      const control = (await page.locator('[data-anchor="domains"] input').boundingBox())!
      expect(control.y - (head.y + head.height)).toBeLessThan(40)
      await fits(page, 'button:has-text("Tiếp tục")', width)
      await page.screenshot({ path: `tests/visual/diff/s1-uat-09/capability-${width}.png` })

      await completedAccount(page.request, `s1u9-p${width}`)
      await page.goto('/projects/new', { waitUntil: 'networkidle' })
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await expect(page.locator('#ve-summary-hint')).toHaveText('Dưới 20 từ.')
      await fits(page, '#ve-summary', width)
      await fits(page, '#ve-summary-hint', width)
      await fits(page, 'button:has-text("Tiếp tục · Mời đội ngũ")', width)
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-09/project-wizard-${width}.png`,
        fullPage: true,
      })
    })
  }
})
