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
 * DEMO-HOME-ABOUT-01 — the new public shell, Homepage v2 (DM01) and About HUB
 * v2 (DM02, DM03 popup, DM04 / DM05 Humans tabs), design-reference/final/demo-0710.
 *
 * Behaviour: public for every visitor; the entry CTAs go to /auth or the
 * visitor's resolver route; every link is a real route, an in-page anchor or
 * an approved external site, the rest is plain or visual-only (no dead link);
 * counts are canonical (11 regional HUBs, 55 CLBs, Đà Nẵng 6); the S1-UAT-08A
 * people and activities are all shown.
 * Pixel: per-block comparison at 1440 × DPR1 (the DEC-H1-D5 method). Blocks
 * whose content is canonical data instead of the frame's samples are measured
 * and reported, not gated (DEMO-D8 INTENTIONAL-DATA).
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const REF = (file: string) => `design-reference/final/demo-0710/${file}`
const SHIFT = 2
const MAX_OUTSIDE = 0.015
const MAX_BEYOND = 0.02

let consoleErrors: string[] = []

test.beforeAll(async () => {
  // The deterministic demo ventures (DEMO_DATA_CONTRACT), idempotent.
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
})

test.afterAll(async () => {
  // Leave the shared visual-QA database as the other suites expect it (the
  // Library counts canonical public startups): remove the demo rows again.
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

async function login(page: Page, email: string) {
  expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

const hrefs = (page: Page, scope: string) =>
  page.locator(`${scope} a`).evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))

/** Every href is a route that answers, an in-page anchor or an approved external site. */
async function expectLiveLinks(page: Page, scope: string) {
  const all = [...new Set(await hrefs(page, scope))]
  for (const href of all) {
    expect(href, 'no empty or script link').not.toMatch(/^(#?$|javascript:)/)
    if (/^https:\/\//.test(href)) continue
    if (href.startsWith('#') || href.startsWith('mailto:')) continue
    const res = await page.request.get(href, { maxRedirects: 0 })
    expect(res.status(), href).toBeLessThan(400)
  }
}

test.describe('public shell', () => {
  for (const url of ['/', '/about']) {
    test(`${url}: header nav, dropdowns and footer; unbuilt screens are plain text`, async ({
      page,
    }) => {
      await page.goto(url, { waitUntil: 'networkidle' })
      const header = page.locator('header[data-shell="public"]')
      await expect(header).toHaveAttribute('data-viewer', 'GUEST')
      await expect(header.locator('[data-cta="logo"]')).toHaveAttribute('href', '/')
      await expect(header.locator('[data-nav="about"] a').first()).toHaveAttribute('href', '/about')
      // DEMO-DIR2-01: Sản phẩm is a link now; Nhân tài and Tin tức stay plain text.
      await expect(header.locator('[data-nav="products"] a')).toHaveAttribute('href', '/products')
      for (const name of ['talents', 'news'])
        await expect(header.locator(`[data-nav="${name}"] [data-nav-kind="LABEL"]`)).toHaveCount(1)
      await header.getByRole('button', { name: 'Mở menu Chương trình' }).click()
      const programmes = header.locator('[data-nav="programmes"] ul')
      await expect(programmes.getByText('Chương trình, cuộc thi')).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      await expect(programmes.getByText('Sự kiện')).toHaveAttribute('aria-disabled', 'true')
      await page.keyboard.press('Escape')
      await header.getByRole('button', { name: 'Mở menu Giới thiệu' }).click()
      await expect(header.locator('[data-nav="about"] ul a')).toHaveCount(4)
      await expect(header.locator('[data-cta="login"]')).toHaveAttribute('href', '/auth')
      await expect(header.locator('[data-cta="primary-bar"]')).toHaveText('Tạo tài khoản')
      await expect(header.locator('[data-cta="primary-bar"]')).toHaveAttribute('href', '/auth')
      const footer = page.locator('[data-shell="public-footer"]')
      await expect(footer.getByRole('link', { name: 'Giới thiệu' })).toHaveAttribute(
        'href',
        '/about',
      )
      await expect(footer.locator('[data-nav-kind="LABEL"]')).toHaveCount(3)
      await expect(footer.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute(
        'href',
        '/products',
      )
      await expect(footer.getByRole('link', { name: 'Điều khoản' })).toHaveCount(1)
      await expect(footer.getByRole('link', { name: 'Quyền riêng tư' })).toHaveCount(1)
      await expectLiveLinks(page, `[data-screen]`)
    })
  }

  test('signed in: "Việc của tôi", bell without a count, own initials; no sign-in controls', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    for (const url of ['/', '/about']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const header = page.locator('header[data-shell="public"]')
      await expect(header).toHaveAttribute('data-viewer', 'MEMBER')
      await expect(header.locator('[data-cta="primary-bar"]')).toHaveText('Việc của tôi')
      await expect(header.locator('[data-cta="primary-bar"]')).toHaveAttribute('href', '/me')
      await expect(header.locator('[data-cta="bell"]')).toHaveText('')
      await expect(header.locator('[data-cta="avatar"]')).toContainText('DM')
      await expect(header.locator('[data-cta="login"]')).toHaveCount(0)
    }
  })

  test('typography: Space Grotesk on the new public surfaces, approved mono, self-hosted', async ({
    page,
  }) => {
    for (const url of ['/', '/about']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await settle(page)
      const result = await assertTypography(page, REVISION_FACES)
      expect(result.violations, url).toEqual([])
      const fonts = await page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((n) => /\.woff2?($|\?)/.test(n)),
      )
      for (const f of fonts) expect(new URL(f).pathname.startsWith('/fonts/'), f).toBe(true)
    }
  })
})

test.describe('Homepage v2 (DM01)', () => {
  test('guest: / is public, no redirect; entry → /auth; search scopes; refresh stable', async ({
    page,
  }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page).toHaveURL('/')
    const home = page.locator('[data-screen="P0-LANDING"]')
    await expect(home).toHaveAttribute('data-revision', 'DM01')
    await expect(home).toHaveAttribute('data-entry', 'GUEST')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute('href', '/auth')
    for (const cta of ['organise', 'fundraise'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('aria-disabled', 'true')
    const search = page.locator('[data-search="hero"]')
    await expect(search.getByRole('radio', { name: 'Tất cả' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(search.locator('[data-scope-kind="INERT"]')).toHaveText([
      'Chương trình',
      'Nhân tài',
    ])
    await search.getByRole('radio', { name: 'Sản phẩm' }).click()
    await search.getByRole('searchbox').fill('logistics')
    await search.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL('/products?q=logistics')
    await page.goBack()
    await expect(page).toHaveURL('/')
    await page.reload()
    await expect(home).toBeVisible()
  })

  test('signed-in entry CTA → /me (completed) or the resolver step (incomplete)', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    await page.goto('/')
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute('href', '/me')
  })

  test('product blocks are the canonical published startups; counts live; no id leaks', async ({
    page,
  }) => {
    const [row] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM projects WHERE type = 'STARTUP' AND status = 'ACTIVE' AND visibility = 'PUBLIC'`,
    )
    const n = row!.n
    await page.goto('/', { waitUntil: 'networkidle' })
    const all = page.locator('[data-section="all-products"]')
    await expect(all.locator('h2')).toContainText(String(n))
    await expect(all.locator('li')).toHaveCount(n)
    await expect(all.getByText('Tracely', { exact: true })).toBeVisible()
    const sectors = page.locator('[data-block="sectors"]')
    await expect(sectors.getByRole('tab').first()).toHaveText('Logistics')
    await expect(sectors.locator('li').first()).toContainText('Tracely')
    await expect(sectors.locator('li').first()).toContainText('GỌI VỐN')
    const investors = page.locator('[data-section="investors"]')
    await expect(investors.locator('h3')).toHaveText('Tracely')
    await expect(investors).toContainText('1,2 triệu')
    const html = await page.content()
    expect(html).not.toMatch(/de710000-/)
    // DEMO-DIR2-01: each product opens its page in the directory.
    await expect(all.locator('a', { hasText: 'Tracely' })).toHaveAttribute(
      'href',
      '/products/tracely',
    )
  })

  test('programme, update and news blocks are read-only presentation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    for (const scope of [
      '[data-block="programme-updates"]',
      '[data-section="programmes"] ul',
      '[data-section="news"] ul',
    ])
      await expect(page.locator(`${scope} a`)).toHaveCount(0)
    await expect(page.locator('[data-section="programmes"] li')).toHaveCount(4)
    await expect(page.locator('[data-section="news"] li')).toHaveCount(3)
  })
})

test.describe('About HUB v2 (DM02–DM05)', () => {
  test('canonical counts: 11 regional HUBs, 55 CLBs; the frame samples are not drawn', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    const about = page.locator('[data-screen="PUBLIC-ABOUT"]')
    await expect(about).toHaveAttribute('data-revision', 'DM02')
    const stats = page.locator('[data-section="hero"] li')
    await expect(stats).toHaveCount(5)
    await expect(stats.nth(1)).toContainText('11')
    await expect(stats.nth(2)).toContainText('55')
    await expect(stats.nth(2)).not.toContainText('60+')
    await expect(page.locator('[data-section="scale"] h2')).toHaveText('11 HUB Khu vực')
    await expect(page.locator('[data-marker]')).toHaveCount(11)
    await expect(page.locator('[data-archipelago]')).toHaveText(['Hoàng Sa', 'Trường Sa'])
    await expect(page.locator('[data-section="hero"] [data-cta="facebook"]')).toHaveAttribute(
      'href',
      'https://www.facebook.com/1hubnetwork',
    )
  })

  test('map: Việt Nam view keeps Hoàng Sa and Trường Sa; a marker opens the HUB popup', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Việt Nam' }).click()
    await expect(page.locator('[data-map-view="vietnam"] [data-archipelago]')).toHaveCount(2)
    await expect(page.locator('[data-marker]')).toHaveCount(4)
    await page.getByRole('tab', { name: 'Thế giới' }).click()
    await page.locator('[data-marker="DN"]').click()
    const popup = page.getByRole('dialog', { name: 'HUB Đà Nẵng' })
    await expect(popup).toBeVisible()
    await expect(popup.locator('dl > div').first()).toContainText('6')
    await expect(popup.locator('dl > div').first()).toContainText('CLB trực thuộc')
    await expect(popup).toContainText('Phạm Khánh Vân')
    await expect(popup.locator('[data-cta="hub-detail"]')).toHaveAttribute(
      'href',
      '/organizations/hub-network-da-nang',
    )
    expect((await page.request.get('/organizations/hub-network-da-nang')).status()).toBe(200)
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    await page.getByRole('button', { name: 'Xem thêm' }).click()
    await expect(page.locator('#about-network-list section')).toHaveCount(13)
  })

  test('Humans of HUB: three tabs, workbook people, catalogue clubs', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    const humans = page.locator('[data-section="humans"]')
    await expect(humans.locator('[data-humans-tab="TONG"]')).toContainText('Trần Quang Hưng')
    await expect(humans.locator('[data-humans-tab="TONG"] li')).toHaveCount(8 + 1 + 2)
    await humans.getByRole('tab', { name: 'HUB Khu vực' }).click()
    await expect(humans.getByRole('tablist', { name: 'HUB Khu vực' }).getByRole('tab')).toHaveCount(
      11,
    )
    await humans.getByRole('tab', { name: 'HUB Đà Nẵng' }).click()
    const board = humans.locator('[data-region="hub-network-da-nang"]')
    await expect(board).toContainText('Ban điều hành HUB Network Đà Nẵng')
    await expect(board).toContainText('· 6 CLB')
    await expect(board).toContainText('Huỳnh Đăng Khoa')
    await humans.getByRole('tab', { name: 'Câu lạc bộ' }).click()
    await expect(humans).toContainText('55 câu lạc bộ trực thuộc các HUB Chapter')
    await expect(humans.locator('[data-humans-tab="CLB"] li')).toHaveCount(6)
    await humans.getByRole('button', { name: 'Xem tất cả câu lạc bộ' }).click()
    await expect(humans.locator('[data-humans-tab="CLB"] li')).toHaveCount(55)
  })

  test('S1-UAT-08A content kept: all 43 activities, all milestones, 7 ecosystem rows', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-section="activities"] li')).toHaveCount(43)
    await expect(page.locator('[data-milestone]')).toHaveCount(6)
    await expect(page.getByRole('tab', { name: '2024', selected: true })).toHaveCount(1)
    await expect(page.locator('[data-section="ecosystem"] li')).toHaveCount(7)
    await expect(page.locator('[data-section="partners"]')).toContainText('Dữ liệu minh hoạ')
  })
})

test.describe('responsive 768 / 390 (structural, no pixel reference)', () => {
  for (const width of [768, 390]) {
    test(`${width}: no horizontal overflow; primary CTAs visible and not covered; menu opens`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const url of ['/', '/about']) {
        await page.goto(url, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${url} at ${width}`).toBeLessThanOrEqual(0)
        const cta = page.locator(url === '/' ? '[data-cta="primary"]' : '[data-cta="about-join"]')
        await expect(cta).toBeInViewport()
        const box = (await cta.boundingBox())!
        const hit = await page.evaluate(
          ([x, y]) =>
            document.elementFromPoint(x!, y!)?.closest('[data-cta]')?.getAttribute('data-cta'),
          [box.x + box.width / 2, box.y + box.height / 2],
        )
        expect(hit, `${url} CTA is hittable`).toBe(url === '/' ? 'primary' : 'about-join')
        await page.getByRole('button', { name: 'Mở menu' }).click()
        await expect(
          page.locator('[data-shell="public"] [data-cta="primary-bar"]'),
        ).toBeInViewport()
        await page.getByRole('button', { name: 'Đóng menu' }).click()
        await page.screenshot({
          path: path.join(ACTUAL, `demo-${url === '/' ? 'home' : 'about'}-${width}.png`),
          fullPage: true,
        })
      }
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

/** Pictures that are the Hub's own photos where the frame draws gradients (INTENTIONAL). */
async function images(page: Page): Promise<Rect[]> {
  return page.locator('img:not([src$=".svg"])').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }
    }),
  )
}

type Block = { name: string; anchor: string; refTop: number; rect: Rect; gated: boolean }

async function compareBlocks(
  page: Page,
  id: string,
  reference: string,
  blocks: Block[],
  capture: string,
) {
  await settle(page)
  const full = await page.screenshot({ fullPage: true })
  await page.screenshot({ path: path.join(ACTUAL, capture), fullPage: true })
  const segments: Segment[] = []
  for (const b of blocks) {
    const top = await page
      .locator(b.anchor)
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
    segments.push({ name: b.name, reference: b.rect, dy: top - b.refTop })
  }
  const pictures = [
    ...(await images(page)),
    // Canonical values where the frame draws a sample (DEMO-D8 INTENTIONAL-DATA).
    ...(await page.locator('[data-pixel="data"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }
      }),
    )),
  ]
  const results = compareSegments(
    readPng(resolveReferencePath(reference)),
    decodePng(full),
    segments,
    [...(await textRects(page)), ...pictures],
    {
      diffPath: resolveOutputPath('diff', `${id}.segments.diff.png`),
      shiftTolerance: SHIFT,
      exclude: pictures,
    },
  )
  const report = results.map((r) => ({
    ...r,
    gated: blocks.find((b) => b.name === r.name)!.gated,
  }))
  writeJsonReport(`${id}.pixel.json`, {
    screen_id: id,
    reference,
    viewport: '1440x900',
    dpr: 1,
    shift_tolerance_px: SHIFT,
    thresholds: { outside_ratio: MAX_OUTSIDE, beyond_shift_ratio: MAX_BEYOND },
    segments: report,
  })
  for (const r of report.filter((x) => x.gated)) {
    expect.soft(r.outside_ratio, `${r.name} outside-text drift`).toBeLessThan(MAX_OUTSIDE)
    expect.soft(r.beyond_shift_ratio!, `${r.name} beyond ±${SHIFT}px`).toBeLessThan(MAX_BEYOND)
  }
}

const sec = (name: string) => `[data-section="${name}"]`
const FOOTER = '[data-shell="public-footer"]'

test.describe('pixel QA 1440 × DPR1', () => {
  test('DM01 Homepage v2', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await compareBlocks(
      page,
      'DEMO-HOME.DM01',
      REF('DM01__homepage-v2__SOURCE.png'),
      [
        {
          name: '01-header-hero',
          anchor: sec('hero'),
          refTop: 0,
          rect: { x: 0, y: 0, width: 1440, height: 811 },
          gated: true,
        },
        {
          name: '02-ticker',
          anchor: sec('ticker'),
          refTop: 812,
          rect: { x: 0, y: 812, width: 1440, height: 88 },
          gated: true,
        },
        {
          name: '03-highlights-head',
          anchor: sec('highlights'),
          refTop: 901,
          rect: { x: 0, y: 901, width: 1440, height: 290 },
          gated: true,
        },
        {
          name: '04-programme-updates',
          anchor: sec('highlights'),
          refTop: 901,
          rect: { x: 64, y: 1191, width: 636, height: 270 },
          gated: true,
        },
        {
          name: '05-sectors',
          anchor: sec('highlights'),
          refTop: 901,
          rect: { x: 740, y: 1191, width: 636, height: 270 },
          gated: false,
        },
        {
          name: '06-programmes',
          anchor: sec('programmes'),
          refTop: 1580,
          rect: { x: 0, y: 1580, width: 1440, height: 808 },
          gated: true,
        },
        {
          name: '07-ventures',
          anchor: sec('investors'),
          refTop: 2451,
          rect: { x: 0, y: 2420, width: 1440, height: 760 },
          gated: false,
        },
        {
          name: '08-news',
          anchor: sec('news'),
          refTop: 3198,
          rect: { x: 0, y: 3198, width: 1440, height: 876 },
          gated: true,
        },
        {
          name: '09-footer',
          anchor: FOOTER,
          refTop: 4074,
          rect: { x: 0, y: 4074, width: 1440, height: 587 },
          gated: true,
        },
      ],
      'demo-home-1440.png',
    )
  })

  test('DM02 About HUB v2', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    await compareBlocks(
      page,
      'DEMO-ABOUT.DM02',
      REF('DM02__about-hub-v2__SOURCE.png'),
      [
        {
          name: '01-header-hero',
          anchor: 'header[data-shell="public"]',
          refTop: 0,
          rect: { x: 0, y: 0, width: 1440, height: 840 },
          gated: true,
        },
        {
          name: '02-values',
          anchor: sec('values'),
          refTop: 800,
          rect: { x: 0, y: 900, width: 1440, height: 430 },
          gated: true,
        },
        {
          name: '03-scale-head',
          anchor: sec('scale'),
          refTop: 1301,
          rect: { x: 0, y: 1380, width: 1440, height: 170 },
          gated: true,
        },
        {
          name: '04-map',
          anchor: sec('scale'),
          refTop: 1301,
          rect: { x: 64, y: 1559, width: 1312, height: 642 },
          gated: false,
        },
        {
          name: '05-hub-chips',
          anchor: sec('scale'),
          refTop: 1301,
          rect: { x: 0, y: 2240, width: 1440, height: 210 },
          gated: false,
        },
        {
          name: '06-humans-head',
          anchor: sec('humans'),
          refTop: 2445,
          rect: { x: 0, y: 2540, width: 1440, height: 420 },
          gated: true,
        },
        {
          name: '07-humans-tree',
          anchor: sec('humans'),
          refTop: 2445,
          rect: { x: 0, y: 2960, width: 1440, height: 980 },
          gated: false,
        },
        {
          name: '08-ecosystem',
          anchor: sec('ecosystem'),
          refTop: 3949,
          rect: { x: 0, y: 3949, width: 1440, height: 1090 },
          gated: true,
        },
        {
          name: '09-milestones',
          anchor: sec('milestones'),
          refTop: 5038,
          rect: { x: 0, y: 5038, width: 1440, height: 920 },
          gated: false,
        },
        {
          name: '10-activities',
          anchor: sec('activities'),
          refTop: 5937,
          rect: { x: 0, y: 6020, width: 1440, height: 500 },
          gated: false,
        },
        {
          name: '11-partners',
          anchor: sec('partners'),
          refTop: 6494,
          rect: { x: 0, y: 6600, width: 1440, height: 470 },
          gated: false,
        },
        {
          name: '12-closing',
          anchor: sec('closing'),
          refTop: 7070,
          rect: { x: 0, y: 7070, width: 1440, height: 644 },
          gated: true,
        },
        {
          name: '13-footer',
          anchor: FOOTER,
          refTop: 7714,
          rect: { x: 0, y: 7714, width: 1440, height: 636 },
          gated: true,
        },
      ],
      'demo-about-1440.png',
    )
  })

  test('DM03 HUB popup, DM04 HUB Khu vực, DM05 Câu lạc bộ (states, reported)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.goto('/about', { waitUntil: 'networkidle' })
    await settle(page)
    await page.locator('[data-marker="DN"]').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: path.join(ACTUAL, 'demo-about-dm03-popup.png') })
    await page.keyboard.press('Escape')
    const humans = page.locator(sec('humans'))
    await humans.getByRole('tab', { name: 'HUB Khu vực' }).click()
    await humans.getByRole('tab', { name: 'HUB Đà Nẵng' }).click()
    await humans.screenshot({ path: path.join(ACTUAL, 'demo-about-dm04-khu-vuc.png') })
    await humans.getByRole('tab', { name: 'Câu lạc bộ' }).click()
    await humans.screenshot({ path: path.join(ACTUAL, 'demo-about-dm05-clb.png') })
    writeJsonReport('DEMO-ABOUT.states.json', {
      references: [
        REF('DM03__about-hub-popup__SOURCE.png'),
        REF('DM04__about-humans-khu-vuc__SOURCE.png'),
        REF('DM05__about-humans-clb__SOURCE.png'),
      ],
      captures: [
        'demo-about-dm03-popup.png',
        'demo-about-dm04-khu-vuc.png',
        'demo-about-dm05-clb.png',
      ],
      classification:
        'INTENTIONAL-DATA: canonical counts, workbook people and catalogue clubs replace the frame samples',
    })
  })
})
