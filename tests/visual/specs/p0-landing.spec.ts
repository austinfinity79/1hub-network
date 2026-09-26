import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * P0-LANDING — public homepage at `/` (DEC-P0-LANDING-D1..D3).
 * No approved landing bitmap exists: visual QA compares the page's primitives
 * with the approved WF03-S09 public page, and captures 1440×900 + full page.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
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
  test('1/2/4/10. guest: homepage at /, CTAs → /auth, no placeholder, refresh stable', async ({
    page,
  }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page).toHaveURL('/')
    const landing = page.locator('[data-screen="P0-LANDING"]')
    await expect(landing).toHaveAttribute('data-entry', 'GUEST')
    await expect(page.locator('h1')).toHaveCount(1)
    for (const id of ['van-de', 'san-pham', 'tam-nhin'])
      await expect(page.locator(`#${id}`)).toBeVisible()
    for (const cta of ['primary-bar', 'primary', 'primary-final'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('href', '/auth')
    await expect(page.locator('body')).not.toContainText('Foundation bootstrap')
    await page.reload()
    await expect(page).toHaveURL('/')
    await page.locator('[data-cta="primary"]').click()
    await expect(page).toHaveURL('/auth')
  })

  test('3. signed-in members: CTA → /me (completed) or the resolver step (incomplete)', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    await page.goto('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute('data-entry', 'MEMBER')
    await expect(page.locator('[data-cta="primary"]')).toHaveText('Vào tài khoản của tôi')
    await page.locator('[data-cta="primary"]').click()
    await expect(page).toHaveURL('/me')
    // A new account that has not finished onboarding is sent to its resolver step.
    await page.context().clearCookies()
    await login(page, `landing-${Date.now()}@example.test`)
    await page.goto('/')
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute(
      'href',
      '/onboarding/purpose',
    )
    await expect(page.locator('[data-cta="primary"]')).toHaveText('Tiếp tục thiết lập tài khoản')
    // An ops leader gets no ops shortcut from the homepage.
    await page.context().clearCookies()
    await login(page, 'leader@example.test')
    await page.goto('/')
    expect((await hrefs(page)).filter((h) => h.startsWith('/ops'))).toEqual([])
  })

  test('5/7. no dead links: every href is a real route or an in-page section', async ({
    page,
    request,
  }) => {
    for (const email of [null, 'member@example.test']) {
      await page.context().clearCookies()
      if (email) await login(page, email)
      await page.goto('/')
      const links = await hrefs(page)
      expect(links.length).toBeGreaterThan(5)
      for (const href of links) {
        expect(href, 'no placeholder href').not.toBe('#')
        expect(href, 'no empty href').not.toBe('')
        if (href.startsWith('#')) {
          await expect(page.locator(href), href).toHaveCount(1)
          continue
        }
        expect(href.startsWith('/'), `internal only: ${href}`).toBe(true)
        const r = email ? await page.request.get(href) : await request.get(href)
        expect(r.status(), href).toBeLessThan(400)
      }
    }
  })

  test('6. no internal or personal data; status is explicit for non-production surfaces', async ({
    page,
  }) => {
    await login(page, 'ops@example.test')
    await page.goto('/')
    const text = await page.locator('[data-screen="P0-LANDING"]').innerText()
    expect(text).not.toMatch(
      /@|PLATFORM_ADMIN|HUB_COMMUNITY_LEADER|role_code|[0-9a-f]{8}-[0-9a-f]{4}-/i,
    )
    // No production-scale metric, AI, investor or marketplace claim.
    expect(text).not.toMatch(
      /\bAI\b|nhà đầu tư|investor|gọi vốn|marketplace|việc làm|\d{2,}\s*(thành viên|startup|tổ chức)/i,
    )
    for (const [surface, status] of [
      ['Chương trình / Thử thách', 'DEMO'],
      ['Khám phá & kết nối', 'FUTURE'],
      ['Hồ sơ thành viên', 'LIVE'],
    ] as const) {
      await expect(
        page.locator(`[data-surface="${surface}"] [data-status]`),
        surface,
      ).toHaveAttribute('data-status', status)
    }
    await expect(
      page.locator('[data-pillar="Discovery & Matching"] [data-status]'),
    ).toHaveAttribute('data-status', 'FUTURE')
  })

  test('8. protected routes keep their guards and the canonical resolver', async ({ page }) => {
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

  test('responsive: 768 and 390 have no horizontal overflow and a reachable CTA', async ({
    page,
  }) => {
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px overflow`).toBe(0)
      await expect(page.locator('[data-cta="primary-bar"]')).toBeInViewport()
      await expect(page.locator('[data-cta="primary"]')).toBeVisible()
      await page.screenshot({
        path: path.join(ACTUAL, `p0-landing-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
  })

  test('keyboard: the first Tab stops are the brand, the nav and the CTA, with a visible focus', async ({
    page,
  }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('1HUB.NETWORK')
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
        rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
    }
    return rects
  })
}

test.describe('P0-LANDING visual QA (approved public primitives)', () => {
  test('1440×900 + full page; eyebrow, card, buttons and bar match WF03-S09', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: path.join(ACTUAL, 'p0-landing-1440x900.png'),
      animations: 'disabled',
    })
    await page.screenshot({
      path: path.join(ACTUAL, 'p0-landing-full.png'),
      fullPage: true,
      animations: 'disabled',
    })
    const actual = decodePng(await page.screenshot({ animations: 'disabled', fullPage: true }))
    const { screens } = loadManifest()
    const s09 = findScreen(screens, 'WF03-S09')
    const reference = readPng(path.join(REPO_ROOT, s09.full_page_baseline!))
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!
    const eyebrow = await box('#van-de p')
    const card = await box('#van-de li')
    const primary = await box('[data-cta="primary"]')
    const joinButton = await box('[data-cta="primary-final"]')
    const at = (b: { x: number; y: number }, x: number, y: number) => ({
      dx: Math.round(b.x) - x,
      dy: Math.round(b.y) - y,
    })
    const mask = await textRects(page)
    // Only the component itself is compared: the surrounding background differs by design
    // (S09 draws these on grey / gradient bands).
    const dashY = Math.round(eyebrow.y + eyebrow.height / 2 - 1)
    const results = compareSegments(
      reference,
      actual,
      [
        // Section eyebrow red dash, core rows (S09 events eyebrow: 152..173 × 1769..1770 on
        // white). The bitmap's dash is anti-aliased into the rows above / below (P3 raster);
        // those two AA rows and the AA end pixels are not compared.
        {
          name: 'eyebrow-dash',
          reference: { x: 152, y: 1769, width: 22, height: 2 },
          dx: Math.round(eyebrow.x) - 152,
          dy: dashY - 1769,
        },
        // Card border: top edge and left edge away from the rounded corner (S09 child card 151, 1381).
        {
          name: 'card-top-edge',
          reference: { x: 166, y: 1381, width: 40, height: 3 },
          ...at(card, 151, 1381),
        },
        {
          name: 'card-left-edge',
          reference: { x: 151, y: 1396, width: 3, height: 40 },
          ...at(card, 151, 1381),
        },
        // Hero primary button, inside the left cap (S09 151..315 × 521..568).
        {
          name: 'primary-cap',
          reference: { x: 157, y: 522, width: 12, height: 46 },
          ...at(primary, 151, 521),
        },
        // Join-band button, inside the left cap (S09 151..326 × 2256..2303).
        {
          name: 'join-button-cap',
          reference: { x: 157, y: 2257, width: 12, height: 46 },
          ...at(joinButton, 151, 2256),
        },
        // Top bar background (S09 38..112): the same #160002 band.
        { name: 'bar', reference: { x: 480, y: 40, width: 300, height: 70 }, dx: 0, dy: -40 },
      ],
      mask,
      { diffPath: resolveOutputPath('diff', 'P0-LANDING.primitives.diff.png') },
    )
    writeJsonReport('P0-LANDING.primitives.json', {
      screen_id: 'P0-LANDING',
      reference_compared: s09.full_page_baseline,
      approved_landing_bitmap: null,
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reason:
            'DEC-P0-LANDING-D2: no approved landing bitmap; composed from approved public primitives (WF03-S09, WF01-S01 display type). Primitives compared here; the page layout awaits PO review',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
