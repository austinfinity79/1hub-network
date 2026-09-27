import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { APPROVED_FACES, REVISION_FACES, assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT, resolveOutputPath, resolveReferencePath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * P0-LANDING — the public homepage at `/`, restyled by TASK 22.1 to the
 * corrected Homepage reference (H1, design-reference/final/revision/H1).
 * Behaviour stays DEC-P0-LANDING-D1: public for every visitor, the entry CTA
 * goes to /auth or the onboarding resolver. Calls to action follow the Task 21
 * v2 audit: real destination or inert with a reason. Typography is Space
 * Grotesk where the reference uses it (DEC-HD-12) and a real defect otherwise.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const H1_REFERENCE = 'design-reference/final/revision/H1/H1__homepage__SOURCE.png'
let consoleErrors: string[] = []

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

const hrefs = (page: Page) =>
  page
    .locator('[data-screen="P0-LANDING"] a')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))

test.describe('P0-LANDING behaviour', () => {
  test('guest: homepage at /, entry CTAs → /auth, startup CTA through the guard, refresh stable', async ({
    page,
  }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page).toHaveURL('/')
    const landing = page.locator('[data-screen="P0-LANDING"]')
    await expect(landing).toHaveAttribute('data-entry', 'GUEST')
    await expect(landing).toHaveAttribute('data-revision', 'H1')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText('Nền tảng kết nối')
    for (const id of ['co-hoi', 'cong-dong']) await expect(page.locator(`#${id}`)).toHaveCount(1)
    for (const cta of ['primary-bar', 'login', 'join', 'primary'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('href', '/auth')
    await expect(page.locator('[data-cta="primary-bar"]')).toHaveText('Tạo tài khoản')
    await expect(page.locator('[data-cta="startup"]')).toHaveAttribute('href', '/projects/new')
    await expect(page.locator('[data-cta="opportunities"]')).toHaveAttribute('href', '#co-hoi')
    await expect(page.locator('body')).not.toContainText('Foundation bootstrap')
    await page.reload()
    await expect(page).toHaveURL('/')
    await page.locator('[data-cta="startup"]').click()
    await expect(page).toHaveURL('/auth')
    await page.goto('/')
    await page.locator('[data-cta="primary-bar"]').click()
    await expect(page).toHaveURL('/auth')
  })

  test('signed-in members: entry CTA → /me (completed) or the resolver step (incomplete)', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    await page.goto('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute('data-entry', 'MEMBER')
    await expect(page.locator('[data-cta="login"]')).toHaveCount(0)
    for (const cta of ['primary-bar', 'primary'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveText(/Vào tài khoản của tôi/)
    await page.locator('[data-cta="primary-bar"]').click()
    await expect(page).toHaveURL('/me')
    // A new account that has not finished onboarding is sent to its resolver step.
    await page.context().clearCookies()
    await login(page, `landing-${Date.now()}@example.test`)
    await page.goto('/')
    await expect(page.locator('[data-cta="primary-bar"]')).toHaveAttribute(
      'href',
      '/onboarding/purpose',
    )
    await expect(page.locator('[data-cta="primary-bar"]')).toHaveText(
      'Tiếp tục thiết lập tài khoản',
    )
    // An ops leader gets no ops shortcut from the homepage.
    await page.context().clearCookies()
    await login(page, 'leader@example.test')
    await page.goto('/')
    expect((await hrefs(page)).filter((h) => h.startsWith('/ops'))).toEqual([])
  })

  test('links: every href is a real route or an in-page section; the rest is inert with a reason', async ({
    page,
    request,
  }) => {
    for (const email of [null, 'member@example.test']) {
      await page.context().clearCookies()
      if (email) await login(page, email)
      await page.goto('/')
      const links = await hrefs(page)
      expect(links.length).toBeGreaterThan(8)
      for (const href of links) {
        expect(href, 'no placeholder href').not.toBe('#')
        expect(href, 'no empty href').not.toBe('')
        expect(href.toLowerCase(), 'no script URL').not.toContain('javascript:')
        if (href.startsWith('#')) {
          await expect(page.locator(href), href).toHaveCount(1)
          continue
        }
        expect(href.startsWith('/'), `internal only: ${href}`).toBe(true)
        const r = email ? await page.request.get(href) : await request.get(href)
        expect(r.status(), href).toBeLessThan(400)
      }
    }
    // The published HUB page is the network destination (Task 21 v2 audit).
    for (const cta of ['network-bar', 'network-investors', 'network-community', 'closing-network'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute(
        'href',
        /^\/organizations\/[a-z0-9-]+$/,
      )
    // Inert CTAs never navigate and always say why.
    const inert = page.locator('[data-screen="P0-LANDING"] [data-cta-kind="INERT"]')
    expect(await inert.count()).toBeGreaterThan(15)
    for (const el of await inert.all()) {
      await expect(el).toHaveAttribute('aria-disabled', 'true')
      await expect(el).toHaveAttribute('title', /chưa có trong phiên bản này/i)
      expect(await el.evaluate((n) => n.tagName)).not.toBe('A')
      expect(await el.locator('a').count()).toBe(0)
    }
    const search = page.locator('[role="search"] input')
    await expect(search).toBeDisabled()
  })

  test('content: approved copy only; no internal, personal, placeholder or unverified data', async ({
    page,
  }) => {
    await login(page, 'ops@example.test')
    await page.goto('/')
    const text = await page.locator('[data-screen="P0-LANDING"]').innerText()
    expect(text.replace('global@1hub.network', '')).not.toMatch(
      /@|PLATFORM_ADMIN|HUB_COMMUNITY_LEADER|role_code|[0-9a-f]{8}-[0-9a-f]{4}-/i,
    )
    // HD-01 omissions: metrics, the problem catalogue and its source note,
    // mock programmes / events / partners, iHUB placeholders, the unfinished quote.
    expect(text).not.toMatch(
      /\d[\d.]*\+|~60|13 chapter|QĐ 1193|30 bài toán|APEC|Honda|Ngân hàng Nhà nước|Demo Day|Doanh nghiệp A|Quỹ A|ihub\.ventures|chờ ảnh|chờ nội dung|chờ cập nhật|XEM HTML|\.{4,}/i,
    )
    for (const heading of [
      'Hệ sinh thái không thiếu hoạt động.',
      'Mỗi hoạt động đều để lại giá trị',
      'Hệ sinh thái cơ hội',
      'Sự kiện',
      'Mạng lưới đổi mới sáng tạo',
      'Được xây dựng bởi cộng đồng',
    ])
      await expect(page.locator('h2', { hasText: heading })).toHaveCount(1)
  })

  test('protected routes keep their guards and the canonical resolver', async ({ page }) => {
    for (const route of ['/me', '/ops/network', '/projects/new']) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/auth')
    }
    await login(page, `landing-guard-${Date.now()}@example.test`)
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/purpose')
    await page.goto('/')
    await expect(page).toHaveURL('/')
  })

  test('responsive: 1024, 768 and 390 have no horizontal overflow; every CTA is visible and not covered', async ({
    page,
  }) => {
    for (const [width, height] of [
      [1024, 768],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await page.evaluate(() => document.fonts.ready)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px overflow`).toBe(0)
      await expect(page.locator('[data-cta="primary-bar"]')).toBeInViewport()
      const report = await page.evaluate(async () => {
        const hidden: string[] = []
        const problems: string[] = []
        const nodes = document.querySelectorAll<HTMLElement>(
          '[data-screen="P0-LANDING"] a, [data-screen="P0-LANDING"] [data-cta-kind="INERT"]',
        )
        for (const node of nodes) {
          const label = node.innerText.trim() || node.getAttribute('aria-label') || node.tagName
          if (node.getClientRects().length === 0) {
            hidden.push(label)
            continue
          }
          node.scrollIntoView({ block: 'center' })
          await new Promise((done) => requestAnimationFrame(() => done(null)))
          const r = node.getBoundingClientRect()
          if (r.width < 1 || r.height < 1) problems.push(`${label}: zero size`)
          else if (r.left < -1 || r.right > window.innerWidth + 1)
            problems.push(`${label}: outside the viewport (${r.left}..${r.right})`)
          else {
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            if (!hit || !(hit === node || node.contains(hit)))
              problems.push(`${label}: covered by ${hit?.tagName}`)
          }
        }
        return { hidden, problems }
      })
      expect(report.problems, `${width}px`).toEqual([])
      // Only the inert language switch is dropped on phones.
      expect(report.hidden, `${width}px hidden`).toEqual(width < 768 ? ['VI | EN'] : [])
      await page.screenshot({
        path: path.join(ACTUAL, `p0-landing-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
  })

  test('keyboard: the first Tab stop is the brand, with a visible focus', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('HUB NETWORK')
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement!).outlineStyle,
    )
    expect(outline).not.toBe('none')
  })
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

/**
 * Kept blocks of the corrected reference. `refTop` is the reference y of the
 * anchor element's top edge; the capture offset of every segment comes from
 * that anchor, so blocks omitted above it (HD-01) do not shift the comparison.
 */
type SegmentSpec = { name: string; anchor: string; refTop: number; rect: Rect }
const section = (name: string) => `[data-section="${name}"]`
const anchor = (name: string) => `[data-anchor="${name}"]`
const H1_SEGMENTS: SegmentSpec[] = [
  {
    name: 'header-hero',
    anchor: section('hero'),
    refTop: 0,
    rect: { x: 0, y: 0, width: 1440, height: 900 },
  },
  {
    name: 'journey-strip',
    anchor: section('strip'),
    refTop: 900,
    rect: { x: 0, y: 900, width: 1440, height: 102 },
  },
  {
    name: 'pain',
    anchor: section('pain'),
    refTop: 1002,
    rect: { x: 0, y: 1002, width: 1440, height: 873 },
  },
  {
    name: 'solution',
    anchor: section('solution'),
    refTop: 1875,
    rect: { x: 0, y: 1875, width: 1440, height: 2514 },
  },
  {
    name: 'opportunities-head',
    anchor: section('opportunities'),
    refTop: 4389,
    rect: { x: 0, y: 4389, width: 1440, height: 434 },
  },
  {
    name: 'sub-1-bar-body',
    anchor: section('sub-1'),
    refTop: 4823,
    rect: { x: 0, y: 4823, width: 1440, height: 190 },
  },
  {
    name: 'sub-2-bar-body',
    anchor: section('sub-2'),
    refTop: 5853,
    rect: { x: 0, y: 5853, width: 1440, height: 270 },
  },
  {
    name: 'org-box-programmes',
    anchor: anchor('org-programme'),
    refTop: 6940,
    rect: { x: 50, y: 6932, width: 1340, height: 260 },
  },
  {
    name: 'sub-3-bar-body',
    anchor: section('sub-3'),
    refTop: 7281,
    rect: { x: 0, y: 7281, width: 1440, height: 235 },
  },
  {
    name: 'events-head',
    anchor: section('events'),
    refTop: 8355,
    rect: { x: 0, y: 8355, width: 1440, height: 125 },
  },
  {
    name: 'org-box-events',
    anchor: anchor('org-events'),
    refTop: 9061,
    rect: { x: 50, y: 9053, width: 1340, height: 225 },
  },
  {
    name: 'all-in-one',
    anchor: section('all-in-one'),
    refTop: 9399,
    rect: { x: 0, y: 9399, width: 1440, height: 880 },
  },
  {
    name: 'network-head',
    anchor: section('network'),
    refTop: 10349,
    rect: { x: 0, y: 10530, width: 1440, height: 260 },
  },
  {
    name: 'network-doors-notes',
    anchor: anchor('doors'),
    refTop: 10831,
    rect: { x: 40, y: 10825, width: 1360, height: 510 },
  },
  {
    name: 'organisers',
    anchor: section('organisers'),
    refTop: 11439,
    rect: { x: 0, y: 11560, width: 1440, height: 1339 },
  },
  {
    name: 'loop',
    anchor: section('loop'),
    refTop: 13000,
    rect: { x: 0, y: 13000, width: 1440, height: 1271 },
  },
  {
    name: 'community-head',
    anchor: section('community'),
    refTop: 14271,
    rect: { x: 0, y: 14271, width: 1440, height: 580 },
  },
  {
    name: 'community-card',
    anchor: anchor('community-card'),
    refTop: 15127,
    rect: { x: 50, y: 15120, width: 1340, height: 205 },
  },
  {
    name: 'partners-head',
    anchor: section('partners'),
    refTop: 15446,
    rect: { x: 0, y: 15446, width: 1440, height: 430 },
  },
  {
    name: 'partners-cta',
    anchor: anchor('partners-cta'),
    refTop: 16419,
    rect: { x: 1190, y: 16410, width: 200, height: 70 },
  },
  {
    name: 'closing',
    anchor: section('closing'),
    refTop: 16599,
    rect: { x: 0, y: 16599, width: 1440, height: 900 },
  },
  {
    name: 'footer',
    anchor: section('footer'),
    refTop: 17499,
    rect: { x: 0, y: 17499, width: 1440, height: 500 },
  },
]

/**
 * Pass rule. Raw pixel ratios cannot separate Figma's text rasterizer from a
 * real defect, so each segment also counts what still differs when either
 * image may match within ±2 px: a wrong face, size, weight or colour, or a
 * displaced block, stays; anti-aliasing and sub-pixel placement do not.
 */
const SHIFT_TOLERANCE = 2
const MAX_OUTSIDE = 0.015
const MAX_BEYOND_SHIFT = 0.02

/** Reference regions of omitted content inside a compared segment (HD-01), never compared. */
const OMITTED_INSIDE: Array<{ segment: string; rect: Rect; reason: string }> = [
  {
    segment: 'community-card',
    rect: { x: 86, y: 15205, width: 700, height: 32 },
    reason: 'HD-01: "13 chapter · 9 quốc gia …" metrics line omitted',
  },
]

test.describe('P0-LANDING visual QA (corrected Homepage reference H1)', () => {
  test('typography: Space Grotesk where the reference uses it, approved mono, no fallback', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await settle(page)
    const result = await assertTypography(page, REVISION_FACES)
    expect(result.violations).toEqual([])
    const families = await page.evaluate(() =>
      ['h1', 'h2', '[data-cta="primary-bar"]', '[class*="eyebrow"]'].map((sel) =>
        getComputedStyle(document.querySelector(sel)!).fontFamily.split(',')[0]!.replace(/"/g, ''),
      ),
    )
    expect(families).toEqual(['Space Grotesk', 'Space Grotesk', 'Space Grotesk', 'IBM Plex Mono'])
    // Fonts are self-hosted: no request leaves the origin.
    const fontUrls = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((n) => /\.woff2?($|\?)/.test(n)),
    )
    expect(fontUrls.length).toBeGreaterThan(0)
    for (const url of fontUrls) expect(new URL(url).pathname.startsWith('/fonts/'), url).toBe(true)
  })

  test('legacy screens keep the approved faces (DEC-HD-12 is scoped)', async ({ page }) => {
    // /auth is a revision screen since TASK 22.2 (DEC-L1-D1); WF01-S05 next to
    // it stays legacy until HD-02, so it proves the scope still holds.
    const email = `landing-scope-${Date.now()}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
    await settle(page)
    const result = await assertTypography(page, APPROVED_FACES)
    expect(result.violations).toEqual([])
    const loaded = await page.evaluate(
      () =>
        [...document.fonts].filter(
          (f) => f.family.includes('Space Grotesk') && f.status === 'loaded',
        ).length,
    )
    expect(loaded).toBe(0)
  })

  test('1440×900 DPR1: kept blocks match the corrected reference', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await settle(page)
    await page.screenshot({ path: path.join(ACTUAL, 'p0-landing-1440x900.png') })
    const full = await page.screenshot({ fullPage: true })
    await page.screenshot({ path: path.join(ACTUAL, 'p0-landing-full.png'), fullPage: true })
    const actual = decodePng(full)
    const reference = readPng(resolveReferencePath(H1_REFERENCE))
    expect(reference.width).toBe(1440)
    expect(reference.height).toBe(17999)

    const segments: Segment[] = []
    for (const s of H1_SEGMENTS) {
      const top = await page
        .locator(s.anchor)
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
      segments.push({ name: s.name, reference: s.rect, dy: top - s.refTop })
    }
    // Omitted regions are masked in capture coordinates, like text.
    const mask = await textRects(page)
    const omitted: Rect[] = OMITTED_INSIDE.map((o) => {
      const seg = segments.find((s) => s.name === o.segment)!
      return { ...o.rect, y: o.rect.y + seg.dy }
    })
    const results = compareSegments(reference, actual, segments, mask, {
      diffPath: resolveOutputPath('diff', 'P0-LANDING.H1.segments.diff.png'),
      shiftTolerance: SHIFT_TOLERANCE,
      exclude: omitted,
    })
    const report = results.map((r) => ({ ...r, in_text_ratio: r.diff_in_text / r.pixels }))
    writeJsonReport('P0-LANDING.H1.pixel.json', {
      screen_id: 'P0-LANDING',
      reference: H1_REFERENCE,
      viewport: '1440x900',
      dpr: 1,
      capture_height: actual.height,
      shift_tolerance_px: SHIFT_TOLERANCE,
      thresholds: { outside_ratio: MAX_OUTSIDE, beyond_shift_ratio: MAX_BEYOND_SHIFT },
      omitted_blocks_hd01: [
        'problem tabs, chips, carousel and source note (sub 01/03)',
        'programme heading and carousel (sub 02/03)',
        'iHUB Ventures, deck and data-room cards (sub 03/03)',
        'event rows and "Xem tất cả sự kiện"',
        'unfinished quote (network)',
        'community metrics and the "13 chapter · 9 quốc gia" line',
        'partner wall and the "200+ đối tác" line',
      ],
      segments: report,
    })
    for (const r of report) {
      // Surfaces, borders and colours outside text: raster noise only.
      expect(r.outside_ratio, `${r.name} outside-text drift`).toBeLessThan(MAX_OUTSIDE)
      // Everything, text included, once ±2 px placement and anti-aliasing are allowed.
      expect(r.beyond_shift_ratio!, `${r.name} beyond ±${SHIFT_TOLERANCE}px`).toBeLessThan(
        MAX_BEYOND_SHIFT,
      )
    }
  })
})
