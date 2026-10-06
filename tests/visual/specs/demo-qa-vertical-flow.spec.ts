import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page, type Response } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * DEMO-QA-PREP-B / DEMO-QA-B-SYNC — the 07/10 review journey as one guest flow
 * (docs/demo-0710/DEMO_SOT_v1.md "Review journey", docs/demo-0710/qa/).
 *
 *   / → "Sản phẩm" → /products → /products/tracely → Đặng Kim Chi →
 *   /talents/dang-kim-chi ("Đã xác thực danh tính qua 1Hub", DEMO) →
 *   "Giới thiệu" → /about → logo → /
 *
 * The founder route is the fixed handle of DEC-DEMO-SP1-D1 (it narrows
 * DEMO-D2's `[profileId]`): a profile UUID is 404 and no internal id reaches
 * a page. Steps owned by DEMO-DIR2-01 / DEMO-SP1-FOUNDER-01 run by default
 * since both are on main (OPS-WORKTREE-INTEGRATE-CLEANUP-01); DEMO_QA_SYNC=0
 * turns them back into `fixme` (AWAITING_A_IMPLEMENTATION) on an older base.
 * A missing screen fails; nothing skips silently.
 */

const SYNC = process.env.DEMO_QA_SYNC !== '0'
const AWAITING = 'AWAITING_A_IMPLEMENTATION: set DEMO_QA_SYNC=1 at DEMO-QA-B-SYNC'

/** Demo data (docs/demo-0710/DEMO_DATA_CONTRACT.md, src/lib/demo-0710/founders.ts). */
const DEMO = {
  startups: ['Tracely', 'AgriTrace', 'Kho Lạnh Miền Tây'],
  tracely: '/products/tracely',
  founder: { name: 'Đặng Kim Chi', path: '/talents/dang-kim-chi' },
  founderUuid: 'de710000-0000-0000-0000-0000000000b1',
  verifiedToo: '/talents/ly-gia-bao',
  unverified: ['/talents/vo-thanh-ha', '/talents/nguyen-minh-anh'],
  nonFounderMember: 'Phạm Quốc Việt',
  verifiedCopy: 'Đã xác thực danh tính qua 1Hub',
} as const

/** OUT_OF_SCOPE_POST_DEMO "Wording guard": none of these actions exists. */
const BANNED = /đã xác minh|đã kết nối|đã theo dõi|đã gửi yêu cầu/i

let problems: string[] = []

test.beforeAll(async () => {
  // The deterministic demo ventures, idempotent (as demo-home-about-01).
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
})

test.afterAll(async () => {
  // Leave the visual-QA database as the other suites expect it.
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
  problems = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('response', (r: Response) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    if (/\.(png|jpe?g|webp|svg|woff2?)($|\?)/.test(r.url())) problems.push(`asset: ${r.url()}`)
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(problems, 'console / hydration errors, 5xx, missing assets').toEqual([])
})

const header = (page: Page) => page.locator('header[data-shell="public"]')

/** No dead link, no fake success (DEMO-D6) on the visible page. */
async function expectCleanPage(page: Page) {
  await expect(page.locator('a[href="#"], a[href=""], a[href^="javascript:"]')).toHaveCount(0)
  expect(await page.locator('main, [data-screen]').first().innerText()).not.toMatch(BANNED)
  const broken = await page
    .locator('img')
    .evaluateAll((imgs) =>
      imgs
        .filter(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0,
        )
        .map((i) => (i as HTMLImageElement).currentSrc),
    )
  expect(broken, 'broken images').toEqual([])
}

/** Public privacy: no internal id, e-mail address or phone link in the page. */
async function expectNoPrivateData(page: Page) {
  const html = await page.content()
  expect(html, 'internal demo id').not.toMatch(/de710000-/)
  expect(html, 'e-mail address').not.toMatch(/[\w.+-]+@example\.test/)
  expect(html, 'phone link').not.toMatch(/href="tel:/)
}

/** Every internal link answers < 400; external ones are https (no dead CTA). */
async function expectLiveLinks(page: Page) {
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('href') ?? ''))])
  for (const href of hrefs) {
    if (/^https:\/\//.test(href) || href.startsWith('#') || href.startsWith('mailto:')) continue
    expect(href, 'internal link').toMatch(/^\//)
    expect((await page.request.get(href, { maxRedirects: 0 })).status(), href).toBeLessThan(400)
  }
}

test.describe('vertical flow — base (DEMO-HOME-ABOUT-01)', () => {
  test('1–2 · Homepage loads as guest; public nav renders', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute(
      'data-revision',
      'DM01',
    )
    await expect(header(page)).toHaveAttribute('data-viewer', 'GUEST')
    await expect(header(page).locator('[data-cta="logo"]')).toHaveAttribute('href', '/')
    await expect(header(page).locator('[data-nav="about"] a').first()).toHaveAttribute(
      'href',
      '/about',
    )
    await expectCleanPage(page)
  })

  test('10–11 · "Giới thiệu" opens About; the logo returns Home; refresh and Back hold', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await header(page).locator('[data-nav="about"] a').first().click()
    await expect(page).toHaveURL('/about')
    await expect(page.locator('[data-screen="PUBLIC-ABOUT"]')).toHaveAttribute(
      'data-revision',
      'DM02',
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-screen="PUBLIC-ABOUT"]')).toBeVisible()
    await expectCleanPage(page)
    await header(page).locator('[data-cta="logo"]').click()
    await expect(page).toHaveURL('/')
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL('/about')
  })
})

test.describe('vertical flow — products and founder (DIR2 / SP1-FOUNDER)', () => {
  test.fixme(!SYNC, AWAITING)

  test('3–5 · "Sản phẩm" → /products lists the three demo startups', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await header(page).getByRole('link', { name: 'Sản phẩm', exact: true }).click()
    await expect(page).toHaveURL(/\/products(\?.*)?$/)
    for (const name of DEMO.startups)
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
    await expectCleanPage(page)
    await expectNoPrivateData(page)
  })

  test('6–11 · Tracely → founder → DEMO verified profile → About → Home, Back holds', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    const card = page.locator('li, article').filter({ hasText: 'Tracely' }).first()
    await card.getByRole('link', { name: /Xem hồ sơ/ }).click()
    await expect(page).toHaveURL(DEMO.tracely)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tracely')
    await expectCleanPage(page)
    await expectNoPrivateData(page)
    // DEMO-D5: only allow-listed founders link; another team member is plain text.
    await expect(page.getByRole('link', { name: new RegExp(DEMO.nonFounderMember) })).toHaveCount(0)
    await page
      .getByRole('link', { name: new RegExp(DEMO.founder.name) })
      .first()
      .click()
    await expect(page).toHaveURL(DEMO.founder.path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(DEMO.founder.name)
    const verified = page.locator('[data-verified="demo"]')
    await expect(verified).toHaveText(DEMO.verifiedCopy)
    await expect(verified).toHaveAttribute('data-demo', 'DEMO-0710')
    await expectCleanPage(page)
    await expectNoPrivateData(page)
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(DEMO.tracely)
    await page.goForward({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(DEMO.founder.path)
    await header(page).locator('[data-nav="about"] a').first().click()
    await expect(page).toHaveURL('/about')
    await header(page).locator('[data-cta="logo"]').click()
    await expect(page).toHaveURL('/')
  })

  test('direct URLs and refresh answer 200; the allow-list, the flag and 404s hold', async ({
    page,
  }) => {
    for (const url of ['/products', DEMO.tracely, DEMO.founder.path]) {
      expect((await page.goto(url, { waitUntil: 'networkidle' }))?.status(), url).toBe(200)
      await page.reload({ waitUntil: 'networkidle' })
      await expectCleanPage(page)
      await expectNoPrivateData(page)
    }
    // DEC-DEMO-SP1-D1: UUID, unknown handle and unknown startup are 404.
    for (const url of [
      `/talents/${DEMO.founderUuid}`,
      '/talents/not-a-founder',
      '/talents/pham-quoc-viet',
      '/products/not-a-demo-startup',
    ])
      expect((await page.request.get(url)).status(), url).toBe(404)
    // DEMO-D10: the flag is per profile.
    await page.goto(DEMO.verifiedToo, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-verified="demo"]')).toHaveText(DEMO.verifiedCopy)
    for (const url of DEMO.unverified) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await expect(page.locator('[data-verified="demo"]')).toHaveCount(0)
      await expect(page.getByText(DEMO.verifiedCopy)).toHaveCount(0)
    }
  })
})

test.describe('CTA / route matrix (DEMO_ROUTE_CTA_MATRIX)', () => {
  test.fixme(!SYNC, AWAITING)

  test('every link on the five surfaces is live; visual-only CTAs never fake an action', async ({
    page,
  }) => {
    for (const url of ['/', '/about', '/products', DEMO.tracely, DEMO.founder.path]) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await expectLiveLinks(page)
      await expectCleanPage(page)
    }
    // Startup page: back, tabs, visual-only actions.
    await page.goto(DEMO.tracely, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-cta="back"]')).toHaveAttribute('href', '/products')
    for (const tab of ['Chỉ số', 'Cập nhật'])
      await expect(page.getByRole('link', { name: tab, exact: true })).toHaveCount(0)
    for (const cta of ['follow', 'connect', 'dataroom']) {
      const href = await page.locator(`[data-cta="${cta}"]`).first().getAttribute('href')
      expect([null, '/auth'], `startup ${cta}`).toContain(href)
    }
    // Founder page: product rows go to products, visual-only actions, owner-only hidden.
    await page.goto(DEMO.founder.path, { waitUntil: 'networkidle' })
    for (const href of await page
      .locator('[data-cta="product"], [data-cta="venture"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href'))))
      expect(href ?? '').toMatch(/^\/products\/[a-z0-9-]+$/)
    expect(await page.locator('[data-cta="contact"]').getAttribute('href')).toBeNull()
    for (const cta of ['connect', 'follow'])
      expect(await page.locator(`[data-cta="${cta}"]`).getAttribute('href')).toBe('/auth')
    await expect(page.getByText('+ Tạo sản phẩm')).toHaveCount(0)
    // Directory: the SOT search hand-off and the filter region.
    await page.goto('/products?q=AgriTrace', { waitUntil: 'networkidle' })
    await expect(page.getByText('AgriTrace', { exact: true }).first()).toBeVisible()
    await expect(page.locator('[data-cta="view-startup"][href="/products/tracely"]')).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Bộ lọc' }).or(page.locator('[aria-label="Bộ lọc"]')),
    ).toHaveCount(1)
  })
})

test.describe('responsive interactions (DEMO_RESPONSIVE_MATRIX)', () => {
  test.fixme(!SYNC, AWAITING)

  /** The element's centre is the element itself: inside the viewport, not covered. */
  async function expectHittable(page: Page, selector: string, width: number) {
    const el = page.locator(selector).first()
    await el.scrollIntoViewIfNeeded()
    const box = (await el.boundingBox())!
    expect(box.x, selector).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, selector).toBeLessThanOrEqual(width)
    const hit = await el.evaluate((node) => {
      const r = node.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !!top && (node === top || node.contains(top))
    })
    expect(hit, `${selector} covered`).toBe(true)
  }

  for (const width of [1440, 768, 390]) {
    test(`${width}: filter, card CTA, tabs, founder link and HUB popup are usable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      // Directory: a sector filter narrows the cards (Logistics: Tracely, Kho Lạnh Miền Tây).
      await page.goto('/products', { waitUntil: 'networkidle' })
      await expect(page.locator('[data-cta="view-startup"]')).toHaveCount(3)
      await page
        .getByRole('checkbox', { name: /Logistics/ })
        .first()
        .check()
      await expect(page.locator('[data-cta="view-startup"]')).toHaveCount(2)
      await expectHittable(page, '[data-cta="view-startup"]', width)
      // Startup: Tổng quan is the current tab; the founder link is reachable.
      await page.goto(DEMO.tracely, { waitUntil: 'networkidle' })
      await expect(page.getByText('Tổng quan', { exact: true }).first()).toBeVisible()
      await expectHittable(page, '[data-cta="founder"]', width)
      await expectHittable(page, '[data-cta="back"]', width)
      // Founder: the DEMO mark and the visual-only actions are visible.
      await page.goto(DEMO.founder.path, { waitUntil: 'networkidle' })
      await expect(page.locator('[data-verified="demo"]')).toBeVisible()
      await expectHittable(page, '[data-cta="connect"]', width)
      // About: from the Việt Nam view the HUB popup opens inside the viewport
      // and closes with Escape (the Thế giới view below 1024 px: QA-B-04).
      await page.goto('/about', { waitUntil: 'networkidle' })
      await page.getByRole('tab', { name: 'Việt Nam' }).click()
      await page.locator('[data-marker="DN"]').scrollIntoViewIfNeeded()
      await page.locator('[data-marker="DN"]').click()
      const popup = page.getByRole('dialog', { name: 'HUB Đà Nẵng' })
      await expect(popup).toBeVisible()
      const box = (await popup.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      await page.keyboard.press('Escape')
      await expect(popup).toHaveCount(0)
    })
  }

  for (const width of [1440, 768, 390]) {
    test(`${width}: Thế giới map — the HUB Đà Nẵng marker can be clicked`, async ({ page }) => {
      // QA-B-04 (P2, ACCEPTED_P2_DEMO_DEBT, DEMO-QA-01): the 12 px markers of
      // 58da5d1 keep HUB Đà Nẵng clickable down to 768 px. THAO-04 lifts a
      // marker above an overlapping later HUB, so Đà Nẵng is clickable at phone
      // width too and the expected-failure mark is gone. At 390 the Thế giới
      // view still stacks Hà Nội, TP.HCM and Quảng Ninh under it; the Việt Nam
      // view and the HUB chips open each of them (thao-04-about).
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/about', { waitUntil: 'networkidle' })
      await page.locator('[data-marker="DN"]').scrollIntoViewIfNeeded()
      await page.locator('[data-marker="DN"]').click({ timeout: 5000 })
      await expect(page.getByRole('dialog', { name: 'HUB Đà Nẵng' })).toBeVisible()
    })
  }
})

test.describe('containment 1440 / 768 / 390', () => {
  const BASE = ['/', '/about']
  const AWAITED = ['/products', DEMO.tracely, DEMO.founder.path]
  for (const width of [1440, 768, 390]) {
    for (const url of [...BASE, ...AWAITED]) {
      test(`${width} ${url}: no horizontal overflow, header visible`, async ({ page }) => {
        test.fixme(AWAITED.includes(url) && !SYNC, AWAITING)
        await page.setViewportSize({ width, height: 900 })
        await page.goto(url, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0)
        const box = (await header(page).boundingBox())!
        expect(box.width).toBeLessThanOrEqual(width)
        await expectCleanPage(page)
        await page.screenshot({
          path: `tests/visual/actual/demo-qa-sync/${width}${url.replace(/\//g, '_') || '_home'}.png`,
          fullPage: true,
        })
      })
    }
  }
})
