import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { REVISION_FACES, assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT, resolveOutputPath, resolveReferencePath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * DEMO-DIR2-01 — the Product / Startup directory `/products` (DM08) and the
 * startup page `/products/[slug]` it opens.
 *
 * Data: the canonical published startups only (STARTUP · ACTIVE · PUBLIC),
 * the deterministic demo ventures included; nothing private, draft, owned or
 * internal reaches the page. Guests browse everything public.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const DM08 = 'design-reference/final/demo-0710/DM08__product-directory__SOURCE.png'

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
})

test.afterAll(async () => {
  // Leave the shared visual-QA database as the other suites expect it.
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

const cards = (page: Page) => page.locator('[data-startup]')

async function publicStartups() {
  return query<{ slug: string; name: string }>(
    `SELECT slug, name FROM projects WHERE type = 'STARTUP' AND status = 'ACTIVE' AND visibility = 'PUBLIC'`,
  )
}

test.describe('directory: guest browse and visibility', () => {
  test('guest: /products is public; every published startup and nothing else; no id or owner leaks', async ({
    page,
  }) => {
    const res = await page.goto('/products', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    const dir = page.locator('[data-screen="DEMO-PRODUCTS"]')
    await expect(dir).toHaveAttribute('data-entry', 'GUEST')
    const published = await publicStartups()
    await expect(page.locator('h1')).toContainText(`${published.length} sản phẩm trong mạng lưới`)
    const shown = Math.min(published.length, 9)
    await expect(cards(page)).toHaveCount(shown)
    // Unpublished ventures (draft, private, projects) never reach the page: their
    // canonical slugs are unique (names may repeat across ventures).
    const hidden = await query<{ slug: string }>(
      `SELECT slug FROM projects WHERE NOT (type = 'STARTUP' AND status = 'ACTIVE' AND visibility = 'PUBLIC')`,
    )
    const html = await page.content()
    for (const h of hidden) expect(html, h.slug).not.toContain(h.slug)
    expect(html).not.toMatch(/de710000-|@example\.test/)
    // Owners and members are not listed by the directory.
    for (const owner of ['Đặng Kim Chi', 'Lý Gia Bảo', 'Võ Thanh Hà'])
      expect(html).not.toContain(owner)
    await expect(
      page.locator('header[data-shell="public"] [data-nav="products"] a'),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('startup page: a published startup by slug; private, draft, project or unknown is 404', async ({
    page,
  }) => {
    const res = await page.goto('/products/tracely', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Tracely')
    await expect(page.locator('[data-screen="DEMO-STARTUP"]')).toHaveAttribute(
      'data-startup',
      'tracely',
    )
    for (const name of ['Đặng Kim Chi', 'Nguyễn Minh Anh', 'Phạm Quốc Việt', 'Trần Hạnh'])
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    const hidden = await query<{ slug: string }>(
      `SELECT slug FROM projects WHERE NOT (type = 'STARTUP' AND status = 'ACTIVE' AND visibility = 'PUBLIC') LIMIT 5`,
    )
    for (const slug of [...hidden.map((h) => h.slug), 'khong-ton-tai'])
      expect((await page.request.get(`/products/${slug}`)).status(), slug).toBe(404)
    await page.locator('[data-cta="back"]').click()
    await expect(page).toHaveURL('/products')
  })

  test('follow / connect: a guest is sent to /auth; a member gets no fake action', async ({
    page,
  }) => {
    await page.goto('/products?q=tracely', { waitUntil: 'networkidle' })
    await expect(cards(page).first().locator('[data-cta="follow"]')).toHaveAttribute(
      'href',
      '/auth',
    )
    expect(
      (await page.request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    await page.goto('/products?q=tracely', { waitUntil: 'networkidle' })
    const follow = cards(page).first().locator('[data-cta="follow"]')
    await expect(follow).toHaveAttribute('aria-disabled', 'true')
    await follow.click()
    await expect(page).toHaveURL('/products?q=tracely')
    await page.goto('/products/tracely', { waitUntil: 'networkidle' })
    for (const cta of ['follow', 'connect'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('aria-disabled', 'true')
  })
})

test.describe('directory: search, filters, sort', () => {
  test('search, quick chips, domain and stage filters, address sync, clear; deterministic', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    const search = page.getByRole('search', { name: 'Tìm sản phẩm' })
    await search.getByRole('searchbox').fill('kho lạnh')
    await search.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL(/\/products\?q=kho\+l%E1%BA%A1nh$/)
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toHaveAttribute('data-startup', 'kho-lanh-mien-tay')

    await page.getByRole('button', { name: 'Xoá tất cả' }).click()
    await expect(page).toHaveURL('/products')
    await page.getByRole('button', { name: 'Đang gọi vốn' }).click()
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toHaveAttribute('data-startup', 'tracely')
    await page.getByRole('button', { name: 'Tìm pilot' }).click()
    const pilots = await cards(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-startup')),
    )
    expect(pilots).toEqual(expect.arrayContaining(['tracely', 'agritrace']))
    expect(pilots).not.toContain('kho-lanh-mien-tay')

    await page.getByRole('button', { name: 'Xoá tất cả' }).click()
    const rail = page.getByRole('complementary', { name: 'Bộ lọc' })
    await rail.getByLabel(/^Logistics/).check()
    await expect(page).toHaveURL('/products?linh-vuc=Logistics')
    const logistics = await cards(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-startup')),
    )
    expect(logistics).toEqual(expect.arrayContaining(['tracely', 'kho-lanh-mien-tay']))
    expect(logistics).not.toContain('agritrace')
    await rail.getByLabel(/^Đang bán/).check()
    await expect(cards(page)).toHaveCount(1)
    await expect(page).toHaveURL('/products?linh-vuc=Logistics&giai-doan=SELLING')

    // Deep link: the same address gives the same list.
    await page.goto('/products?linh-vuc=Logistics&giai-doan=SELLING', { waitUntil: 'networkidle' })
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toHaveAttribute('data-startup', 'kho-lanh-mien-tay')

    await page.goto('/products?q=khong-co-gi-ca', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
  })

  test('location: Việt Nam and a province filter canonical places; sort by name', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    const rail = page.getByRole('complementary', { name: 'Bộ lọc' })
    await rail.getByLabel(/^Việt Nam/).check()
    await rail.getByLabel('Tỉnh/thành:').selectOption({ label: 'Đồng Tháp' })
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toHaveAttribute('data-startup', 'agritrace')
    await expect(page).toHaveURL(/tinh=%C4%90%E1%BB%93ng\+Th%C3%A1p/)
    await page.getByRole('button', { name: 'Xoá tất cả' }).click()
    await page.getByLabel('Sắp xếp:').selectOption('name')
    const names = await cards(page).locator('h2').allInnerTexts()
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'vi')))
  })
})

test.describe('journey: Homepage → Sản phẩm → directory → startup', () => {
  test('header "Sản phẩm", homepage "Xem tất cả" and product rows lead here; cards open the startup', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('header[data-shell="public"] [data-nav="products"] a').click()
    await expect(page).toHaveURL('/products')
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('[data-cta="all-products"]').click()
    await expect(page).toHaveURL('/products')
    await page.goto('/', { waitUntil: 'networkidle' })
    const hero = page.locator('[data-search="hero"]')
    await hero.getByRole('radio', { name: 'Sản phẩm' }).click()
    await hero.getByRole('searchbox').fill('Tracely')
    await hero.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL('/products?q=Tracely')
    await expect(cards(page)).toHaveCount(1)
    await cards(page).first().locator('[data-cta="view-startup"]').click()
    await expect(page).toHaveURL('/products/tracely')
    await expect(page.locator('h1')).toHaveText('Tracely')
    // Every published startup card opens its page.
    await page.goto('/products', { waitUntil: 'networkidle' })
    for (const href of await cards(page)
      .locator('[data-cta="view-startup"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')!)))
      expect((await page.request.get(href)).status(), href).toBe(200)
    // The homepage product rows link to the same pages.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(
      page.locator('[data-section="all-products"] a', { hasText: 'Tracely' }),
    ).toHaveAttribute('href', '/products/tracely')
  })
})

test.describe('responsive 768 / 390 (structural)', () => {
  for (const width of [768, 390]) {
    test(`${width}: no overflow; filters usable; card actions visible and hittable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const url of ['/products', '/products/tracely']) {
        await page.goto(url, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${url} at ${width}`).toBeLessThanOrEqual(0)
      }
      await page.goto('/products?q=tracely', { waitUntil: 'networkidle' })
      const view = cards(page).first().locator('[data-cta="view-startup"]')
      await view.scrollIntoViewIfNeeded()
      const box = (await view.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      const hit = await page.evaluate(
        ([x, y]) =>
          document.elementFromPoint(x!, y!)?.closest('[data-cta]')?.getAttribute('data-cta'),
        [box.x + box.width / 2, box.y + box.height / 2],
      )
      expect(hit).toBe('view-startup')
      await page
        .getByRole('complementary', { name: 'Bộ lọc' })
        .getByLabel(/^Logistics/)
        .check()
      await expect(page).toHaveURL(/linh-vuc=Logistics/)
      await page.screenshot({
        path: path.join(ACTUAL, `demo-products-${width}.png`),
        fullPage: true,
      })
    })
  }
})

async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent!.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const r of range.getClientRects())
        rects.push({
          x: r.x - 2,
          y: r.y + window.scrollY - 2,
          width: r.width + 4,
          height: r.height + 4,
        })
    }
    return rects
  })
}

test.describe('visual QA 1440 × DPR1 (DM08)', () => {
  test('typography: Space Grotesk on the directory and the startup page', async ({ page }) => {
    for (const url of ['/products', '/products/tracely']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await settle(page)
      expect((await assertTypography(page, REVISION_FACES)).violations, url).toEqual([])
    }
  })

  test('DM08: header and hero gated; the result area reported (canonical data, unfiltered state)', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    await settle(page)
    const full = await page.screenshot({ fullPage: true })
    await page.screenshot({ path: path.join(ACTUAL, 'demo-products-1440.png'), fullPage: true })
    await page.goto('/products/tracely', { waitUntil: 'networkidle' })
    await settle(page)
    await page.screenshot({
      path: path.join(ACTUAL, 'demo-startup-tracely-1440.png'),
      fullPage: true,
    })
    const segments: Segment[] = [
      { name: '01-header-hero', reference: { x: 0, y: 0, width: 1440, height: 810 }, dy: 0 },
      { name: '02-results', reference: { x: 0, y: 810, width: 1440, height: 560 }, dy: 0 },
    ]
    await page.goto('/products', { waitUntil: 'networkidle' })
    await settle(page)
    // The title count and the hero counters are live (INTENTIONAL-DATA): excluded.
    const data = await page.locator('[data-pixel="data"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }
      }),
    )
    const results = compareSegments(
      readPng(resolveReferencePath(DM08)),
      decodePng(full),
      segments,
      [...(await textRects(page)), ...data],
      {
        diffPath: resolveOutputPath('diff', 'DEMO-PRODUCTS.DM08.segments.diff.png'),
        shiftTolerance: 2,
        exclude: data,
      },
    )
    writeJsonReport('DEMO-PRODUCTS.DM08.pixel.json', {
      screen_id: 'DEMO-PRODUCTS',
      reference: DM08,
      viewport: '1440x900',
      dpr: 1,
      thresholds: { outside_ratio: 0.015, beyond_shift_ratio: 0.02 },
      gated: ['01-header-hero'],
      segments: results,
    })
    const hero = results.find((r) => r.name === '01-header-hero')!
    expect.soft(hero.outside_ratio, 'hero outside-text drift').toBeLessThan(0.015)
    expect.soft(hero.beyond_shift_ratio!, 'hero beyond ±2px').toBeLessThan(0.02)
  })
})
