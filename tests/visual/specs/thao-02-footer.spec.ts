import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { ECOSYSTEM_LINKS } from '../../../src/lib/public/routes'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * THAO-02 — Footer v2 (Thảo §A "Footer"): one shared footer on every public
 * page, exactly two link columns — column 1 Giới thiệu and the external pages
 * (iHUB Ventures, VNV, 1Hub), column 2 Chương trình · Sản phẩm · Nhân tài ·
 * Tin tức — each entry a canonical route, an approved external URL or a plain
 * label (READ_ONLY_APPROVED); no dead link, no button, no menu.
 */

const PAGES = ['/', '/about', '/library', '/products', '/products/tracely', '/talents/dang-kim-chi']
const COLUMN_1 = ['Giới thiệu', 'iHUB Ventures', 'VNV', '1Hub']
const COLUMN_2 = ['Chương trình', 'Sản phẩm', 'Nhân tài', 'Tin tức']
const EXTERNAL: Record<string, string | null> = {
  'iHUB Ventures': ECOSYSTEM_LINKS.ihubVentures,
  VNV: ECOSYSTEM_LINKS.vnv,
  '1Hub': ECOSYSTEM_LINKS.oneHub,
}

let consoleErrors: string[] = []

test.beforeAll(async () => {
  // The startup and founder pages render the deterministic demo data.
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
})

test.afterAll(async () => {
  // Leave the shared visual-QA database as the other suites expect it.
  await query(`DELETE FROM profile_visibility_settings WHERE profile_id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM project_members WHERE id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM project_domains WHERE project_id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM projects WHERE id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM individual_profiles WHERE id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM user_accounts WHERE id::text LIKE 'de710000-%'`)
  await query(
    `DELETE FROM vocabulary_items v WHERE v.id::text LIKE 'de710000-%'
        AND NOT EXISTS (SELECT 1 FROM project_domains d WHERE d.vocabulary_item_id = v.id)`,
  )
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

const footer = (page: Page) => page.locator('[data-shell="public-footer"]')
const columns = (page: Page) => footer(page).locator('ul[role="list"]')

test.describe('contract and coverage', () => {
  test('every public page ends with the one shared footer, exactly two link columns', async ({
    page,
  }) => {
    for (const url of PAGES) {
      expect((await page.goto(url, { waitUntil: 'networkidle' }))?.status(), url).toBe(200)
      await expect(footer(page), url).toHaveCount(1)
      await expect(columns(page), url).toHaveCount(2)
      await expect(columns(page).nth(0).locator('li'), url).toHaveText(COLUMN_1)
      await expect(columns(page).nth(1).locator('li'), url).toHaveText(COLUMN_2)
      // Only one footer navigation group set: no button, no menu, no dead link.
      await expect(footer(page).locator('button, [aria-expanded]'), url).toHaveCount(0)
      await expect(
        footer(page).locator('a[href="#"], a[href=""], a[href^="javascript:"]'),
        url,
      ).toHaveCount(0)
    }
  })

  test('route contract: canonical routes, approved external URLs, plain labels for unbuilt screens', async ({
    page,
  }) => {
    await page.goto('/library', { waitUntil: 'networkidle' })
    const [one, two] = [columns(page).nth(0), columns(page).nth(1)]
    await expect(one.getByRole('link', { name: 'Giới thiệu' })).toHaveAttribute('href', '/about')
    for (const [label, href] of Object.entries(EXTERNAL)) {
      const link = one.getByRole('link', { name: label })
      await expect(link, label).toHaveAttribute('href', href!)
      await expect(link, label).toHaveAttribute('target', '_blank')
      await expect(link, label).toHaveAttribute('rel', 'noopener noreferrer')
    }
    await expect(two.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/products')
    // READ_ONLY_APPROVED: no public screen yet (DEC-AIG-D1 / DEMO-D6).
    for (const label of ['Chương trình', 'Nhân tài', 'Tin tức']) {
      await expect(two.getByRole('link', { name: label }), label).toHaveCount(0)
      await expect(two.getByText(label, { exact: true }), label).toHaveAttribute(
        'data-nav-kind',
        'LABEL',
      )
    }
    // Every internal footer link (legal included) resolves.
    const internal = await footer(page)
      .locator('a[href^="/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
    expect(internal.length).toBeGreaterThanOrEqual(2)
    for (const href of new Set(internal))
      expect((await page.request.get(href)).status(), href).toBe(200)
    // The newsletter has no backend: drawn, inert, never a fake success.
    await expect(footer(page).getByRole('textbox', { name: 'Email của bạn' })).toBeDisabled()
    await expect(footer(page).getByText('Nhận bản tin', { exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  test('keyboard: Tab walks every footer link in reading order; labels and the inert form are skipped', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    const expected = await footer(page)
      .locator('a')
      .evaluateAll((as) => as.map((a) => (a as HTMLElement).innerText.trim()))
    await footer(page).locator('a').first().focus()
    const seen: string[] = []
    for (let i = 0; i < expected.length; i++) {
      seen.push(await page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim()))
      await page.keyboard.press('Tab')
    }
    expect(seen).toEqual(expected)
    expect(seen.slice(0, 5)).toEqual(['Giới thiệu', 'iHUB Ventures', 'VNV', '1Hub', 'Sản phẩm'])
  })
})

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: two columns side by side (stacked on a phone), nothing clipped, no overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const url of PAGES) {
        await page.goto(url, { waitUntil: 'networkidle' })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${url} overflow`,
        ).toBeLessThanOrEqual(width)
        await footer(page).scrollIntoViewIfNeeded()
        const a = (await columns(page).nth(0).boundingBox())!
        const b = (await columns(page).nth(1).boundingBox())!
        if (width > 480) {
          expect(Math.round(a.y), `${url} columns share a row`).toBe(Math.round(b.y))
          expect(b.x, `${url} column 2 right of column 1`).toBeGreaterThan(a.x + a.width - 1)
        } else {
          expect(b.y, `${url} column 2 below column 1`).toBeGreaterThanOrEqual(a.y + a.height - 1)
        }
        for (const link of await footer(page).locator('a, [data-nav-kind="LABEL"]').all()) {
          const box = (await link.boundingBox())!
          expect(box.x, `${url} link left`).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, `${url} link right`).toBeLessThanOrEqual(width)
          expect(box.height, `${url} link height`).toBeGreaterThan(10)
        }
      }
    })
  }
})
