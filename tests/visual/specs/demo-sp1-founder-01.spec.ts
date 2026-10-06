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
 * DEMO-SP1-FOUNDER-01 — startup profile Tổng quan (`/products/[slug]`, DM10)
 * → founder → public Founder Profile (`/talents/[handle]`, DM13) with the
 * DEMO-only "Đã xác thực danh tính qua 1Hub" state.
 *
 * The founder route renders the demo allow-list only; canonical fields pass
 * the discovery projection (a PRIVATE profile is not shown); no e-mail,
 * phone, id, application or owner-only control reaches either page.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const DM10 = 'design-reference/final/demo-0710/DM10__startup-overview__SOURCE.png'
const DM13 = 'design-reference/final/demo-0710/DM13__founder-profile__SOURCE.png'
const KIM_CHI = 'de710000-0000-0000-0000-0000000000b1'
const VERIFIED = 'Đã xác thực danh tính qua 1Hub'

let consoleErrors: string[] = []

test.beforeAll(async () => {
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

/** Nothing private or internal in a public page's markup. */
async function expectNoPrivateData(page: Page) {
  const html = await page.content()
  expect(html).not.toMatch(/de710000-|@example\.test|mailto:/)
  for (const text of ['Phiếu điểm', 'Vòng trong']) expect(html, text).not.toContain(text)
  // Contact / owner-only rows are looked for in the page's own content: the shared
  // public footer (THAO-02) draws a public newsletter field ("Email của bạn").
  const main = await page.locator('main').evaluate((el) => el.outerHTML)
  for (const text of ['Email', 'Điện thoại', 'LinkedIn', 'Tạo sản phẩm'])
    expect(main, text).not.toContain(text)
}

test.describe('startup profile (DM10 Tổng quan)', () => {
  test('guest: Tracely overview, canonical identity, tabs, team links only allow-listed founders', async ({
    page,
  }) => {
    const res = await page.goto('/products/tracely', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    const screen = page.locator('[data-screen="DEMO-STARTUP"]')
    await expect(screen).toHaveAttribute('data-revision', 'DM10')
    await expect(page.locator('h1')).toHaveText('Tracely')
    await expect(page.getByText('Đang pilot', { exact: true })).toBeVisible()
    await expect(page.getByText('Từ 2025 · Seed · Đà Nẵng')).toBeVisible()
    for (const label of ['Bài toán', 'Giải pháp', 'Thị trường', 'Đội ngũ', 'Tầm nhìn', 'Gọi vốn'])
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Hồ sơ sản phẩm' })
    await expect(tabs.locator('[aria-current="page"]')).toHaveText('Tổng quan')
    // Chỉ số / Cập nhật: labels, never a dead link (updated frames not supplied).
    await expect(tabs.locator('a')).toHaveCount(0)
    await expect(tabs.locator('[data-nav-kind="LABEL"]')).toHaveText(['Chỉ số', 'Cập nhật'])
    const founders = page.locator('[data-cta="founder"]')
    await expect(founders).toHaveCount(2)
    await expect(founders.filter({ hasText: 'Đặng Kim Chi' })).toHaveAttribute(
      'href',
      '/talents/dang-kim-chi',
    )
    await expect(founders.filter({ hasText: 'Nguyễn Minh Anh' })).toHaveAttribute(
      'href',
      '/talents/nguyen-minh-anh',
    )
    for (const name of ['Phạm Quốc Việt', 'Trần Hạnh'])
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    for (const cta of ['follow', 'connect', 'dataroom'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('href', '/auth')
    for (const name of ['Xem chỉ số →', 'Xem vị trí tuyển dụng →'])
      await expect(page.getByText(name, { exact: true })).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('a[href="#"], a[href^="javascript:"]')).toHaveCount(0)
    await expectNoPrivateData(page)
  })

  test('a published startup without fixture content still renders its canonical overview', async ({
    page,
  }) => {
    const res = await page.goto('/products/agritrace', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('AgriTrace')
    await expect(page.getByRole('heading', { name: 'Giới thiệu', exact: true })).toBeVisible()
    await expect(page.locator('[data-cta="founder"]')).toHaveAttribute(
      'href',
      '/talents/ly-gia-bao',
    )
  })
})

test.describe('journey and routing', () => {
  test('/products → Tracely → founder → public profile; refresh and back keep the route', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    await page.locator('[data-startup="tracely"]').getByRole('link', { name: 'Xem hồ sơ' }).click()
    await expect(page).toHaveURL('/products/tracely')
    await page.locator('[data-cta="founder"]', { hasText: 'Đặng Kim Chi' }).click()
    await expect(page).toHaveURL('/talents/dang-kim-chi')
    await expect(page.locator('h1')).toHaveText('Đặng Kim Chi')
    await expect(page.getByText(VERIFIED)).toBeVisible()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toHaveText('Đặng Kim Chi')
    await expect(page.getByText(VERIFIED)).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/products/tracely')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toHaveText('Tracely')
    // Founder → product → founder: the rail links resolve too.
    await page.goto('/talents/dang-kim-chi', { waitUntil: 'networkidle' })
    await page.locator('[data-cta="product"]', { hasText: 'Tracely' }).click()
    await expect(page).toHaveURL('/products/tracely')
  })

  test('every link on both pages resolves (no dead CTA); unknown, non-founder or id routes are 404', async ({
    page,
  }) => {
    for (const url of ['/products/tracely', '/talents/dang-kim-chi']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const hrefs = await page
        .locator('main a[href^="/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
      expect(hrefs.length, url).toBeGreaterThan(0)
      for (const href of new Set(hrefs))
        expect((await page.request.get(href)).status(), `${url} → ${href}`).toBe(200)
    }
    for (const handle of ['khong-ton-tai', 'pham-quoc-viet', 'tran-hanh', KIM_CHI, 'DANG-KIM-CHI'])
      expect((await page.request.get(`/talents/${handle}`)).status(), handle).toBe(404)
  })
})

test.describe('founder profile (DM13, PUBLIC VIEW)', () => {
  test('guest: canonical identity and bio, demo sections, the DEMO verified state, nothing private', async ({
    page,
  }) => {
    const res = await page.goto('/talents/dang-kim-chi', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    const screen = page.locator('[data-screen="DEMO-FOUNDER"]')
    await expect(screen).toHaveAttribute('data-revision', 'DM13')
    await expect(screen).toHaveAttribute('data-entry', 'GUEST')
    await expect(page.getByText('Đồng sáng lập · CEO @Tracely', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Tám năm làm vận hành chuỗi cung ứng/)).toBeVisible()
    await expect(
      page.locator('[data-founder] p', { hasText: 'Phó Chủ tịch chapter' }),
    ).toContainText('Đà Nẵng')
    const verified = page.locator('[data-verified="demo"]')
    await expect(verified).toHaveText(VERIFIED)
    await expect(verified).toHaveAttribute('data-demo', 'DEMO-0710')
    for (const title of [
      'Giới thiệu',
      'Kinh nghiệm',
      'Dự án/doanh nghiệp khởi nghiệp, đổi mới sáng tạo',
      'Học vấn',
      'Chuyên môn',
      'Chứng chỉ',
    ])
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.locator('[data-cta="venture"]')).toHaveAttribute('href', '/products/tracely')
    await expect(page.locator('[data-cta="other-founder"]')).toHaveText([
      /Nguyễn Minh Anh/,
      /Võ Thanh Hà/,
      /Lý Gia Bảo/,
    ])
    for (const cta of ['connect', 'follow'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('href', '/auth')
    await expect(page.locator('[data-cta="contact"]')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('header[data-shell="public"] [data-nav="talents"]')).toBeVisible()
    await expectNoPrivateData(page)
  })

  test('the verified state is the fixture flag only; the other founders render canonical data', async ({
    page,
  }) => {
    for (const [handle, verified] of [
      ['ly-gia-bao', true],
      ['vo-thanh-ha', false],
      ['nguyen-minh-anh', false],
    ] as const) {
      const res = await page.goto(`/talents/${handle}`, { waitUntil: 'networkidle' })
      expect(res?.status(), handle).toBe(200)
      await expect(page.locator('[data-verified="demo"]'), handle).toHaveCount(verified ? 1 : 0)
      await expect(page.locator('[data-cta="venture"]'), handle).toHaveCount(1)
      await expectNoPrivateData(page)
    }
    // Nothing is stored: the flag is not a profile column, role or record.
    const [cols] = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.columns
        WHERE table_name = 'individual_profiles' AND column_name ILIKE '%verif%'`,
    )
    expect(cols!.n).toBe('0')
  })

  test('privacy: a PRIVATE profile is not shown anywhere (founder page, team, other founders)', async ({
    page,
  }) => {
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, group_overrides)
       VALUES ($1, '{"PROFILE_DISCOVERY":"PRIVATE"}'::jsonb)
       ON CONFLICT (profile_id) DO UPDATE SET group_overrides = EXCLUDED.group_overrides`,
      [KIM_CHI],
    )
    try {
      expect((await page.request.get('/talents/dang-kim-chi')).status()).toBe(404)
      await page.goto('/products/tracely', { waitUntil: 'networkidle' })
      await expect(page.getByText('Đặng Kim Chi')).toHaveCount(0)
      await page.goto('/talents/nguyen-minh-anh', { waitUntil: 'networkidle' })
      await expect(page.getByText('Đặng Kim Chi')).toHaveCount(0)
    } finally {
      await query('DELETE FROM profile_visibility_settings WHERE profile_id = $1', [KIM_CHI])
    }
    expect((await page.request.get('/talents/dang-kim-chi')).status()).toBe(200)
  })

  test('member: same public view; connect / follow give no fake action', async ({ page }) => {
    expect(
      (await page.request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    await page.goto('/talents/dang-kim-chi', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-screen="DEMO-FOUNDER"]')).toHaveAttribute(
      'data-entry',
      'MEMBER',
    )
    await expect(page.getByText(VERIFIED)).toBeVisible()
    for (const cta of ['connect', 'follow']) {
      const el = page.locator(`[data-cta="${cta}"]`)
      await expect(el).toHaveAttribute('aria-disabled', 'true')
      await el.click()
      await expect(page).toHaveURL('/talents/dang-kim-chi')
    }
    await expectNoPrivateData(page)
  })
})

test.describe('responsive 768 / 390 (structural)', () => {
  for (const width of [768, 390]) {
    test(`${width}: no overflow, tabs and rail readable, founder link and CTAs reachable, avatars square`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/products/tracely', { waitUntil: 'networkidle' })
      await settle(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
      const tabs = page.getByRole('navigation', { name: 'Hồ sơ sản phẩm' })
      for (const t of await tabs.locator('span').all()) {
        const b = (await t.boundingBox())!
        expect(b.x + b.width).toBeLessThanOrEqual(width)
      }
      const rail = page.getByRole('complementary', { name: 'Tóm tắt' })
      const rb = (await rail.boundingBox())!
      expect(rb.width).toBeGreaterThanOrEqual(width - 64)
      const founder = page.locator('[data-cta="founder"]', { hasText: 'Đặng Kim Chi' })
      await founder.scrollIntoViewIfNeeded()
      const fb = (await founder.boundingBox())!
      expect(fb.x + fb.width).toBeLessThanOrEqual(width)
      const hit = await page.evaluate(
        ([x, y]) =>
          document.elementFromPoint(x!, y!)?.closest('[data-cta]')?.getAttribute('data-cta'),
        [fb.x + fb.width / 2, fb.y + fb.height / 2],
      )
      expect(hit).toBe('founder')
      await page.screenshot({
        path: path.join(ACTUAL, `demo-startup-${width}.png`),
        fullPage: true,
      })
      await founder.click()
      await expect(page).toHaveURL('/talents/dang-kim-chi')
      await settle(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
      for (const cta of ['connect', 'follow']) {
        const b = (await page.locator(`[data-cta="${cta}"]`).boundingBox())!
        expect(b.x + b.width, cta).toBeLessThanOrEqual(width)
        expect(b.height, cta).toBeGreaterThanOrEqual(40)
      }
      const avatar = (await page
        .locator('[data-founder] main section span[aria-hidden]')
        .first()
        .boundingBox())!
      expect(Math.abs(avatar.width - avatar.height)).toBeLessThan(1)
      await expect(page.locator('[data-verified="demo"]')).toBeVisible()
      await page.screenshot({
        path: path.join(ACTUAL, `demo-founder-${width}.png`),
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

/** Rects of `[data-pixel="data"]` (INTENTIONAL-DATA), page coordinates. */
async function dataRects(page: Page): Promise<Rect[]> {
  return page.locator('[data-pixel="data"]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }
    }),
  )
}

async function pixel(
  page: Page,
  url: string,
  screenId: string,
  reference: string,
  segments: Segment[],
  gated: string[],
) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await settle(page)
  const full = await page.screenshot({ fullPage: true })
  await page.screenshot({
    path: path.join(ACTUAL, `${screenId.toLowerCase()}-1440.png`),
    fullPage: true,
  })
  const data = await dataRects(page)
  const results = compareSegments(
    readPng(resolveReferencePath(reference)),
    decodePng(full),
    segments,
    [...(await textRects(page)), ...data],
    {
      diffPath: resolveOutputPath('diff', `${screenId}.segments.diff.png`),
      shiftTolerance: 2,
      exclude: data,
    },
  )
  writeJsonReport(`${screenId}.pixel.json`, {
    screen_id: screenId,
    reference,
    viewport: '1440x900',
    dpr: 1,
    thresholds: { outside_ratio: 0.015, beyond_shift_ratio: 0.02 },
    gated,
    segments: results,
  })
  for (const name of gated) {
    const r = results.find((s) => s.name === name)!
    expect.soft(r.outside_ratio, `${screenId} ${name} outside-text drift`).toBeLessThan(0.015)
    expect.soft(r.beyond_shift_ratio!, `${screenId} ${name} beyond ±2px`).toBeLessThan(0.02)
  }
}

test.describe('visual QA 1440 × DPR1 (DM10, DM13)', () => {
  test('typography: Space Grotesk on the startup and founder pages', async ({ page }) => {
    for (const url of ['/products/tracely', '/talents/dang-kim-chi']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await settle(page)
      expect((await assertTypography(page, REVISION_FACES)).violations, url).toEqual([])
    }
  })

  test('DM10: every block gated (canonical team names excluded as data)', async ({ page }) => {
    await pixel(
      page,
      '/products/tracely',
      'DEMO-STARTUP.DM10',
      DM10,
      [
        { name: '01-head-tabs', reference: { x: 0, y: 64, width: 1440, height: 480 }, dy: 0 },
        { name: '02-overview', reference: { x: 0, y: 544, width: 1440, height: 660 }, dy: 0 },
        { name: '03-market-quotes', reference: { x: 0, y: 1204, width: 1440, height: 510 }, dy: 0 },
        { name: '04-team-vision', reference: { x: 0, y: 1714, width: 1440, height: 360 }, dy: 0 },
      ],
      ['01-head-tabs', '02-overview', '03-market-quotes', '04-team-vision'],
    )
  })

  test('DM13: profile card, about, education / expertise / certificates gated; experience and rail reported', async ({
    page,
  }) => {
    // dy: the experience block is shorter (no challenge bullet, no "Xem tất cả"
    // counts) and "Dự án" lists the canonical venture instead of challenge
    // applications (privacy), so the blocks below sit higher than drawn.
    await pixel(
      page,
      '/talents/dang-kim-chi',
      'DEMO-FOUNDER.DM13',
      DM13,
      [
        { name: '01-profile-card', reference: { x: 0, y: 64, width: 960, height: 740 }, dy: 0 },
        { name: '02-about', reference: { x: 0, y: 804, width: 960, height: 162 }, dy: 0 },
        { name: '03-experience', reference: { x: 0, y: 966, width: 960, height: 468 }, dy: 0 },
        { name: '04-education', reference: { x: 0, y: 1755, width: 960, height: 262 }, dy: -144 },
        {
          name: '05-expertise-certificates',
          reference: { x: 0, y: 2018, width: 960, height: 572 },
          dy: -142,
        },
        { name: '06-rail', reference: { x: 960, y: 64, width: 480, height: 780 }, dy: 0 },
      ],
      ['01-profile-card', '02-about', '04-education', '05-expertise-certificates'],
    )
  })
})
