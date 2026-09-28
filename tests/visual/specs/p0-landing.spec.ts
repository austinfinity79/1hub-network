import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { APPROVED_FACES, REVISION_FACES, assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT, resolveOutputPath, resolveReferencePath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * P0-LANDING — the public homepage at `/`, aligned by TASK
 * 22-HOMEPAGE-FINAL-ALIGN to the latest Homepage export (H1 revision 2,
 * design-reference/final/revision/H1, DEC-H1-R2). Behaviour stays
 * DEC-P0-LANDING-D1: public for every visitor, the entry CTA goes to /auth or
 * the onboarding resolver. Calls to action are a real destination or inert
 * with a reason. Typography is Space Grotesk where the reference uses it
 * (DEC-HD-12) and a real defect otherwise.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const H1_REFERENCE = 'design-reference/final/revision/H1/H1__homepage-r2__SOURCE.png'
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
    for (const cta of ['primary-bar', 'login', 'primary'])
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
    // The bar's "Mạng lưới đổi mới sáng tạo" opens the public Library (DEC-L15-D4).
    await expect(page.locator('[data-cta="network-bar"]')).toHaveAttribute('href', '/library')
    // "Tìm hiểu về HUB Network" opens the About page (DEC-H1-R2-D4).
    await expect(page.locator('[data-cta="about-community"]')).toHaveAttribute('href', '/about')
    // The published HUB page stays the other network destinations (Task 21 v2 audit).
    for (const cta of ['closing-network', 'network-footer'])
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

  test('content: approved copy only; PO removals gone; illustrative blocks labelled', async ({
    page,
  }) => {
    await login(page, 'ops@example.test')
    await page.goto('/')
    const text = await page.locator('[data-screen="P0-LANDING"]').innerText()
    expect(text.replace('global@1hub.network', '')).not.toMatch(
      /@|PLATFORM_ADMIN|HUB_COMMUNITY_LEADER|role_code|[0-9a-f]{8}-[0-9a-f]{4}-/i,
    )
    // PO removals (TASK 22-HOMEPAGE-FINAL-ALIGN): none of these may come back.
    expect(text).not.toMatch(
      /được phát triển bởi|thành dữ liệu, dữ liệu thành cơ hội|dành cho đơn vị tổ chức|dành cho các tổ chức|dự định tổ chức chương trình|tạo chương trình|bạn muốn tổ chức một sự kiện|từ dữ liệu đến những kết nối|HUB Network đóng góp|cùng kết nối nguồn lực|QĐ 1193|XEM HTML|\.{4,}/i,
    )
    for (const heading of [
      'Hệ sinh thái không thiếu hoạt động. Điều còn thiếu là sự kết nối.',
      'Mỗi hoạt động đều để lại giá trị',
      'Hệ sinh thái cơ hội',
      'Khám phá hoạt động — Sự kiện',
      'Chương trình đổi mới sáng tạo',
      'Tiếp cận trực tiếp Pipeline đầu tư',
      'Mạng lưới đổi mới sáng tạo',
      'Được xây dựng bởi cộng đồng',
    ])
      await expect(page.locator('h2', { hasText: heading })).toHaveCount(1)
    // Section order follows the reference.
    expect(
      await page
        .locator('[data-screen="P0-LANDING"] > [data-section]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-section'))),
    ).toEqual([
      'hero',
      'strip',
      'pain',
      'solution',
      'opportunities',
      'events',
      'programmes',
      'pipeline',
      'all-in-one',
      'network',
      'community',
      'closing',
      'footer',
    ])
    // Illustrative cards and the partner matrix are labelled, never shown as verified.
    const demo = page.locator('[data-demo="true"]')
    await expect(demo).toHaveCount(4)
    for (const label of await demo.all()) {
      await expect(label).toBeVisible()
      await expect(label).toHaveText('DỮ LIỆU MINH HOẠ')
    }
    for (const name of ['events', 'programmes', 'pipeline', 'partners'])
      await expect(page.locator(`[data-section="${name}"] [data-demo="true"]`)).toHaveCount(1)
    await expect(page.locator('[data-section="partners"] a')).toHaveCount(0)
    await expect(page.locator('[data-section="partners"] img')).toHaveCount(0)
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
    name: '01-header-hero',
    anchor: section('hero'),
    refTop: 0,
    rect: { x: 0, y: 0, width: 1440, height: 900 },
  },
  {
    name: '02-journey-strip',
    anchor: section('strip'),
    refTop: 900,
    rect: { x: 0, y: 900, width: 1440, height: 102 },
  },
  {
    name: '03-pain',
    anchor: section('pain'),
    refTop: 1002,
    rect: { x: 0, y: 1002, width: 1440, height: 873 },
  },
  {
    name: '04-solution',
    anchor: section('solution'),
    refTop: 1875,
    rect: { x: 0, y: 1875, width: 1440, height: 2455 },
  },
  {
    name: '05-opportunities',
    anchor: section('opportunities'),
    refTop: 4330,
    rect: { x: 0, y: 4330, width: 1440, height: 434 },
  },
  {
    name: '06-events',
    anchor: section('events'),
    refTop: 4764,
    rect: { x: 0, y: 4764, width: 1440, height: 973 },
  },
  {
    // Ends above the organiser block, which the PO removed (DEC-H1-R2-D1).
    name: '07-programmes',
    anchor: section('programmes'),
    refTop: 5738,
    rect: { x: 0, y: 5737, width: 1440, height: 903 },
  },
  {
    name: '08-pipeline',
    anchor: section('pipeline'),
    refTop: 6926,
    rect: { x: 0, y: 6926, width: 1440, height: 977 },
  },
  {
    name: '09-one-profile',
    anchor: section('all-in-one'),
    refTop: 7904,
    rect: { x: 0, y: 7904, width: 1440, height: 949 },
  },
  {
    name: '10-network',
    anchor: section('network'),
    refTop: 8854,
    rect: { x: 0, y: 8854, width: 1440, height: 1074 },
  },
  {
    name: '11-community-head',
    anchor: section('community'),
    refTop: 9928,
    rect: { x: 0, y: 9928, width: 1440, height: 470 },
  },
  {
    name: '11-community-metrics',
    anchor: anchor('metrics'),
    refTop: 10408,
    rect: { x: 0, y: 10400, width: 1440, height: 190 },
  },
  {
    name: '11-community-card',
    anchor: anchor('community-card'),
    refTop: 10620,
    rect: { x: 0, y: 10600, width: 1440, height: 200 },
  },
  {
    name: '12-partner-matrix',
    anchor: anchor('matrix'),
    refTop: 10828,
    rect: { x: 0, y: 10810, width: 1440, height: 643 },
  },
  {
    name: '13-closing',
    anchor: section('closing'),
    refTop: 11453,
    rect: { x: 0, y: 11453, width: 1440, height: 900 },
  },
  {
    name: '14-footer',
    anchor: section('footer'),
    refTop: 12353,
    rect: { x: 0, y: 12353, width: 1440, height: 500 },
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

/** Intentional additions to the reference (DEC-H1-R2-D2): the "Dữ liệu minh hoạ" labels. */
async function demoLabels(page: Page): Promise<Rect[]> {
  return page.locator('[data-demo="true"]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x - 3, y: r.y + window.scrollY - 3, width: r.width + 6, height: r.height + 6 }
    }),
  )
}

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
    expect(reference.height).toBe(12853)

    const segments: Segment[] = []
    for (const s of H1_SEGMENTS) {
      const top = await page
        .locator(s.anchor)
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
      segments.push({ name: s.name, reference: s.rect, dy: top - s.refTop })
    }
    // The added labels are masked in capture coordinates, like text.
    const labels = await demoLabels(page)
    const mask = [...(await textRects(page)), ...labels]
    const results = compareSegments(reference, actual, segments, mask, {
      diffPath: resolveOutputPath('diff', 'P0-LANDING.H1.segments.diff.png'),
      shiftTolerance: SHIFT_TOLERANCE,
      exclude: labels,
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
      intentional_differences: [
        'organiser block after the programme cards removed (PO override, DEC-H1-R2-D1)',
        '"Dữ liệu minh hoạ" labels on events, programmes, pipeline and the partner matrix (DEC-H1-R2-D2)',
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
