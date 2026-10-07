import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * THAO-01 — Global Navigation v2 (Thảo §A, docs/demo-0710/SCREEN_ROUTE_MAP.md
 * "Navigation"): one shared public header on every page of the new public
 * shell (the Library included, THAO-01-FIX), the top-level order Giới thiệu ·
 * Chương trình ▾ · Sản phẩm · Nhân tài · Tin tức (only Chương trình is a
 * dropdown), a real route or a plain label for every entry (no dead
 * link), the Programme dropdown, the mobile panel, the HUB mark and the
 * VI | EN state (VI only; no EN content exists).
 */

const SHELL_PAGES = [
  '/',
  '/about',
  '/library',
  '/products',
  '/products/tracely',
  '/talents/dang-kim-chi',
]
const TOP = ['Giới thiệu', 'Chương trình', 'Sản phẩm', 'Nhân tài', 'Tin tức']

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

const header = (page: Page) => page.locator('header[data-shell="public"]')
const mainNav = (page: Page) => header(page).getByRole('navigation', { name: 'Điều hướng chính' })
const burger = (page: Page) => header(page).getByRole('button', { name: /^(Mở|Đóng) menu$/ })

test.describe('structure and route contract (1440)', () => {
  test('every page of the public shell renders the one shared header, labels in Thảo order', async ({
    page,
  }) => {
    for (const url of SHELL_PAGES) {
      expect((await page.goto(url, { waitUntil: 'networkidle' }))?.status(), url).toBe(200)
      await expect(page.locator('header[data-shell="public"]'), url).toHaveCount(1)
      const labels = await mainNav(page)
        .locator(':scope > [data-nav]')
        .evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim().split('\n')[0]))
      expect(labels, url).toEqual(TOP)
    }
  })

  test('route contract: real routes resolve, unbuilt destinations are plain labels, legacy entries gone', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    const nav = mainNav(page)
    // REAL_ROUTE
    await expect(nav.locator('[data-nav="about"] > a')).toHaveAttribute('href', '/about')
    await expect(nav.locator('[data-nav="products"] a')).toHaveAttribute('href', '/products')
    // THAO-05 (DEC-THAO-DIR-D3): Nhân tài has its screen.
    await expect(nav.locator('[data-nav="talents"] a')).toHaveAttribute('href', '/talents')
    for (const href of ['/about', '/products', '/talents'])
      expect((await page.request.get(href)).status(), href).toBe(200)
    // READ_ONLY_APPROVED: no screen yet (DEC-AIG-D1 / DEMO-D6) — text, never a link.
    await expect(nav.locator('[data-nav="news"] a')).toHaveCount(0)
    await expect(nav.locator('[data-nav="news"] [data-nav-kind="LABEL"]')).toHaveCount(1)
    await expect(nav.locator('[data-nav="programmes"] > a')).toHaveCount(0)
    // Superseded top-level entries and the old product dropdown.
    const top = await nav.locator(':scope > [data-nav]').allInnerTexts()
    for (const legacy of ['Thư viện', 'Sự kiện', 'Mạng lưới đổi mới sáng tạo'])
      expect(top.join('|'), legacy).not.toContain(legacy)
    await expect(nav.locator('[data-nav="products"] button')).toHaveCount(0)
    // No dead link anywhere in the header.
    await expect(
      header(page).locator('a[href="#"], a[href=""], a[href^="javascript:"]'),
    ).toHaveCount(0)
  })

  test('HUB mark: one brand link to the homepage with an accessible name', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    const logo = header(page).locator('[data-cta="logo"]')
    await expect(logo).toHaveCount(1)
    await expect(logo).toHaveAttribute('href', '/')
    await expect(logo).toHaveAttribute('aria-label', 'HUB Network — trang chủ')
    // HOME-LOGO-HOTFIX-01: the dark header draws the PO's approved logo image.
    await expect(logo.locator('img[data-logo="brand"]')).toHaveCount(1)
    await logo.click()
    await expect(page).toHaveURL('/')
  })

  test('VI | EN: VI is current, EN is shown unavailable and changes nothing', async ({ page }) => {
    await page.goto('/products?q=tracely', { waitUntil: 'networkidle' })
    const lang = header(page).getByRole('group', { name: 'Ngôn ngữ' })
    await expect(lang).toHaveText('VI | EN')
    await expect(lang.locator('[aria-current="true"]')).toHaveText('VI')
    const en = lang.locator('[aria-disabled="true"]')
    await expect(en).toHaveText('EN')
    await expect(en).toHaveAttribute('title', 'Bản tiếng Anh — sắp có')
    await expect(lang.locator('a, button')).toHaveCount(0)
    await en.click()
    await expect(page).toHaveURL('/products?q=tracely')
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  })
})

test.describe('Chương trình dropdown', () => {
  test('desktop: opens on click, entries follow the route contract, Escape / outside click close it; keyboard reaches it', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const prog = mainNav(page).locator('[data-nav="programmes"]')
    const toggle = prog.getByRole('button', { name: 'Mở menu Chương trình' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const entries = prog.locator('ul li')
    await expect(entries).toHaveText(['Chương trình, cuộc thi', 'Sự kiện'])
    // THAO-05 (DEC-THAO-DIR-D1): the programme list exists; no event screen yet,
    // so Sự kiện stays visual-only, never a dead link.
    await expect(prog.locator('ul a')).toHaveCount(1)
    await expect(prog.getByRole('link', { name: 'Chương trình, cuộc thi' })).toHaveAttribute(
      'href',
      '/programmes',
    )
    await expect(prog.locator('ul [data-cta-kind="INERT"]')).toHaveText(['Sự kiện'])
    await page.keyboard.press('Escape')
    await expect(prog.locator('ul')).toHaveCount(0)
    await toggle.click()
    await page.mouse.click(5, 880)
    await expect(prog.locator('ul')).toHaveCount(0)
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(prog.locator('ul')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(prog.locator('ul')).toHaveCount(0)
  })

  test('only Chương trình is a dropdown: Giới thiệu is a direct link to /about', async ({
    page,
  }) => {
    for (const url of SHELL_PAGES) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const nav = mainNav(page)
      await expect(nav.locator('button'), url).toHaveCount(1)
      await expect(nav.getByRole('button', { name: 'Mở menu Chương trình' }), url).toHaveCount(1)
      await expect(nav.locator('[data-nav="about"] > a'), url).toHaveAttribute('href', '/about')
    }
    await mainNav(page).locator('[data-nav="about"] > a').click()
    await expect(page).toHaveURL('/about')
    await expect(page.locator('[data-nav="about"] a')).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: no overflow on any shell page; the menu works and closes after a route choice`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const url of SHELL_PAGES) {
        await page.goto(url, { waitUntil: 'networkidle' })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${url} overflow`,
        ).toBeLessThanOrEqual(width)
        const logo = (await header(page).locator('[data-cta="logo"]').boundingBox())!
        expect(logo.x, `${url} logo`).toBeGreaterThanOrEqual(0)
      }
      if (width >= 1024) {
        await expect(burger(page)).toBeHidden()
        await expect(mainNav(page)).toBeVisible()
        return
      }
      await page.goto('/products', { waitUntil: 'networkidle' })
      const toggle = burger(page)
      await expect(mainNav(page)).toBeHidden()
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(mainNav(page)).toBeVisible()
      // Everything in the open panel stays inside the viewport and is readable.
      for (const name of ['about', 'programmes', 'products', 'talents', 'news']) {
        const box = (await mainNav(page).locator(`[data-nav="${name}"]`).boundingBox())!
        expect(box.x + box.width, name).toBeLessThanOrEqual(width)
        expect(box.height, name).toBeGreaterThanOrEqual(44)
      }
      await expect(header(page).getByRole('group', { name: 'Ngôn ngữ' })).toBeVisible()
      // The Programme dropdown opens inside the panel.
      await mainNav(page).getByRole('button', { name: 'Mở menu Chương trình' }).click()
      await expect(mainNav(page).locator('[data-nav="programmes"] ul')).toBeVisible()
      // The current page's own link closes the panel (no navigation happens).
      await mainNav(page).locator('[data-nav="products"] a').click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(mainNav(page)).toBeHidden()
      // A route choice navigates and leaves the menu closed.
      await toggle.click()
      await mainNav(page).locator('[data-nav="about"] > a').click()
      await expect(page).toHaveURL('/about')
      await expect(burger(page)).toHaveAttribute('aria-expanded', 'false')
      // Escape closes the panel.
      await burger(page).click()
      await expect(mainNav(page)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(burger(page)).toHaveAttribute('aria-expanded', 'false')
    })
  }
})
