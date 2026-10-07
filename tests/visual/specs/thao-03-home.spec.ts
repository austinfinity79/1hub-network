import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { settle } from '../pixel-qa/capture'
import { REPO_ROOT, resolveOutputPath, resolveReferencePath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * THAO-03 — Homepage v2 production closure against the PO's 07/10 16:9 frames
 * (design-reference/final/demo-0710/DM01H, DM01P; docs/demo-0710):
 *
 * - V1: the campaign hero fills the first screen (at least the 812 px frame),
 *   its search + intents cluster sits 73 px above the hero bottom, and the
 *   programme strip starts after the hero.
 * - V2: "Startup sẵn sàng gặp nhà đầu tư" — the primary pitch card (420 px,
 *   deeper shadow, metric row), the next card glimpsing at the right edge (the
 *   product directory while only one startup is fundraising), and "Tất cả sản
 *   phẩm trong mạng lưới" spanning the section (at least four columns).
 *
 * Data: canonical published startups + the deterministic demo fixture; the
 * frame's sample startups, counts and sectors are data (INTENTIONAL-DATA).
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const DM01H = 'design-reference/final/demo-0710/DM01H__homepage-hero-16x9__SOURCE.png'
const DM01P = 'design-reference/final/demo-0710/DM01P__homepage-products-16x9__SOURCE.png'
const MAX_OUTSIDE = 0.015
const MAX_BEYOND = 0.02

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

const sec = (name: string) => `[data-section="${name}"]`
const top = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
const bottom = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().bottom + window.scrollY))

test.describe('V1 hero', () => {
  // HOMEPAGE-HERO-SLIDER-01 (screen-1 composition, PO SOT): header, the stills
  // filling the canvas, the search and intents over its lower part, then the
  // ticker closes the first screen — hero clamp(560 px, 100svh − 88 px, 892 px).
  // The video mark is gone (video cancelled). Slider: hero-slider spec.
  for (const [width, height] of [
    [1440, 812],
    [1440, 900],
    [1728, 998],
  ] as const) {
    test(`${width}×${height}: header, hero and ticker make the first screen; the strip follows`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/', { waitUntil: 'networkidle' })
      await expect(page.locator(`${sec('hero')} header[data-shell="public"]`)).toHaveCount(1)
      const heroBottom = await bottom(page, sec('hero'))
      expect(heroBottom).toBe(Math.min(Math.max(560, height - 88), 892))
      const slide = (await page
        .locator('[data-section="hero-slider"] [data-slide]')
        .first()
        .boundingBox())!
      expect(Math.round(slide.y)).toBe(64)
      expect(Math.abs(slide.x + slide.width / 2 - width / 2)).toBeLessThanOrEqual(1)
      const searchTop = await top(page, '[data-search="hero"]')
      expect(searchTop).toBeGreaterThanOrEqual(slide.y + 0.72 * slide.height)
      expect(searchTop).toBeLessThan(heroBottom)
      expect(await bottom(page, '[data-cta="primary"]')).toBeLessThanOrEqual(heroBottom)
      expect(await top(page, sec('ticker'))).toBe(heroBottom)
      await expect(page.getByText('VIDEO · CHƯƠNG TRÌNH')).toHaveCount(0)
    })
  }

  test('search scopes and the three intents keep their behaviour', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const search = page.locator('[data-search="hero"]')
    await search.getByRole('searchbox').fill('Tracely')
    await search.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL(/\/library\?q=Tracely$/)
    await page.goto('/', { waitUntil: 'networkidle' })
    await search.getByRole('radio', { name: 'Sản phẩm' }).click()
    await search.getByRole('searchbox').fill('Tracely')
    await search.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL(/\/products\?q=Tracely$/)
    await page.goto('/', { waitUntil: 'networkidle' })
    for (const cta of ['organise', 'fundraise'])
      await expect(page.locator(`[data-cta="${cta}"]`)).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute('href', '/auth')
  })
})

test.describe('V2 startup showcase and product directory', () => {
  test('pitch card, metric row, arrows and the directory glimpse; every link resolves', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const section = page.locator(sec('investors'))
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      /Startup sẵn sàng\s*gặp nhà đầu tư/,
    )
    const pitch = section.locator('article').first()
    await expect(pitch.getByRole('heading', { level: 3 })).toHaveText('Tracely')
    await expect(pitch.locator('dl > div')).toHaveCount(3)
    // The metric values never run into each other.
    const values = await pitch
      .locator('dl dt')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]))
    for (let i = 1; i < values.length; i++)
      expect(values[i]![0]!, `metric ${i}`).toBeGreaterThan(values[i - 1]![1]! + 8)
    await expect(pitch.getByRole('link', { name: /Xem sản phẩm/ })).toHaveAttribute(
      'href',
      '/products/tracely',
    )
    // One fundraising startup: arrows have nothing to page through; the glimpse is
    // the directory, a real route — no pitch is invented.
    for (const name of ['Startup trước', 'Startup tiếp theo'])
      await expect(section.getByRole('button', { name })).toBeDisabled()
    const more = section.locator('[data-cta="investors-more"]')
    await expect(more).toHaveAttribute('href', '/products')
    const box = (await more.boundingBox())!
    expect(box.x).toBeLessThan(1440)
    expect(box.x + box.width).toBeGreaterThan(1440)
    for (const href of ['/products', '/products/tracely'])
      expect((await page.request.get(href)).status(), href).toBe(200)
  })

  test('directory: live count, canonical filters narrow in place, view-all CTA, at least four columns', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const block = page.locator(sec('all-products'))
    const tiles = block.locator('ul[role="list"] > li')
    const all = await tiles.count()
    // The count beside the heading is the live number of published startups.
    expect(all).toBeGreaterThan(0)
    await expect(block.locator('h2 span')).toHaveText(String(all))
    const columns = await block
      .locator('ul[role="list"]')
      .evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(' ').length)
    expect(columns).toBeGreaterThanOrEqual(4)
    const filters = block.getByRole('tab')
    expect(await filters.count()).toBeGreaterThan(1)
    await filters.nth(1).click()
    await expect(filters.nth(1)).toHaveAttribute('aria-selected', 'true')
    const narrowed = await tiles.count()
    expect(narrowed).toBeGreaterThan(0)
    expect(narrowed).toBeLessThanOrEqual(all)
    await block.getByRole('tab', { name: 'Tất cả' }).click()
    await expect(tiles).toHaveCount(all)
    await expect(block.locator('[data-cta="all-products"]')).toHaveAttribute('href', '/products')
  })
})

test.describe('no dead CTA on the Homepage', () => {
  test('every link resolves; every visual-only action is inert and says so', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('a[href="#"], a[href=""], a[href^="javascript:"]')).toHaveCount(0)
    const internal = await page
      .locator('a[href^="/"]')
      .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))])
    for (const href of internal)
      expect((await page.request.get(href)).status(), href).toBeLessThan(400)
    const inert = page.locator('[data-cta-kind="INERT"]')
    for (const el of await inert.all()) await expect(el).toHaveAttribute('aria-disabled', 'true')
  })
})

test.describe('responsive 1440 / 1280 / 1024 / 768 / 390', () => {
  for (const width of [1440, 1280, 1024, 768, 390]) {
    test(`${width}: no overflow, primary CTAs inside, carousel and filters usable, no distorted image`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/', { waitUntil: 'networkidle' })
      await settle(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
      for (const sel of ['[data-cta="primary"]', '[data-search="hero"] button[type="submit"]']) {
        const b = (await page.locator(sel).first().boundingBox())!
        expect(b.x, sel).toBeGreaterThanOrEqual(0)
        expect(b.x + b.width, sel).toBeLessThanOrEqual(width)
      }
      const pitch = page.locator(`${sec('investors')} article`).first()
      await pitch.scrollIntoViewIfNeeded()
      const p = (await pitch.boundingBox())!
      expect(p.x, 'pitch left').toBeGreaterThanOrEqual(0)
      expect(p.width, 'pitch width').toBeGreaterThan(Math.min(300, width - 40))
      const view = page.locator(`${sec('investors')} a`, { hasText: 'Xem sản phẩm' })
      const v = (await view.boundingBox())!
      expect(v.x + v.width, 'pitch CTA').toBeLessThanOrEqual(width)
      const tab = page.locator(sec('all-products')).getByRole('tab').nth(1)
      await tab.scrollIntoViewIfNeeded()
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      const distorted = await page.evaluate(
        () =>
          [...document.images].filter((i) => {
            if (!i.naturalWidth || !i.clientWidth) return false
            const fit = getComputedStyle(i).objectFit
            if (fit === 'cover' || fit === 'contain') return false
            return (
              Math.abs(i.clientWidth / i.clientHeight - i.naturalWidth / i.naturalHeight) > 0.05
            )
          }).length,
      )
      expect(distorted).toBe(0)
      await expect(page.locator('header[data-shell="public"]')).toHaveCount(1)
      await expect(page.locator('[data-shell="public-footer"]')).toHaveCount(1)
      await page.screenshot({
        path: path.join(ACTUAL, `thao-03-home-${width}.png`),
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
    for (const input of document.querySelectorAll('input')) {
      const r = input.getBoundingClientRect()
      rects.push({ x: r.x + 8, y: r.y + scrollY + 6, width: r.width - 16, height: r.height - 12 })
    }
    return rects
  })
}

const rectOf = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }
    }),
  )

test.describe('pixel QA 1440 × 812 against the 07/10 frames (DM01H, DM01P)', () => {
  test('hero and startup showcase gated; the directory rows reported (data)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 812 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await settle(page)
    const full = decodePng(await page.screenshot({ fullPage: true }))
    await page.screenshot({ path: path.join(ACTUAL, 'thao-03-home-1440x812.png'), fullPage: true })
    // DEC-THAO-NAV-D1: the frame draws "Giới thiệu ▾"; the nav row is left out.
    const exclude = await rectOf(
      page,
      'header[data-shell="public"] nav[aria-label="Điều hướng chính"]',
    )
    // DM01P draws the pitch card from y 64 of the frame.
    const ventures = (await top(page, sec('investors'))) - 64
    const texts = await textRects(page)
    const run = (id: string, reference: string, segments: Segment[], gated: string[]) => {
      const results = compareSegments(
        readPng(resolveReferencePath(reference)),
        full,
        segments,
        texts,
        {
          diffPath: resolveOutputPath('diff', `${id}.segments.diff.png`),
          shiftTolerance: 2,
          exclude,
        },
      )
      writeJsonReport(`${id}.pixel.json`, {
        screen_id: id,
        reference,
        viewport: '1440x812',
        dpr: 1,
        thresholds: { outside_ratio: MAX_OUTSIDE, beyond_shift_ratio: MAX_BEYOND },
        gated,
        segments: results,
      })
      for (const r of results.filter((x) => gated.includes(x.name))) {
        expect.soft(r.outside_ratio, `${id} ${r.name} outside-text`).toBeLessThan(MAX_OUTSIDE)
        expect.soft(r.beyond_shift_ratio!, `${id} ${r.name} beyond ±2px`).toBeLessThan(MAX_BEYOND)
      }
    }
    run(
      'THAO-03.DM01H',
      DM01H,
      [
        { name: '01-hero-top', reference: { x: 0, y: 0, width: 1440, height: 590 }, dy: 0 },
        { name: '02-hero-cluster', reference: { x: 200, y: 590, width: 1040, height: 170 }, dy: 0 },
        { name: '03-hero-base', reference: { x: 0, y: 760, width: 1440, height: 50 }, dy: 0 },
      ],
      // HOMEPAGE-HERO-SLIDER-01: the DM01H hero is superseded by the PO's slide
      // stills; its segments are reported only (the hero-slider spec gates it).
      [],
    )
    run(
      'THAO-03.DM01P',
      DM01P,
      [
        {
          name: '01-heading-arrows',
          reference: { x: 0, y: 0, width: 520, height: 500 },
          dy: ventures,
        },
        {
          name: '02-pitch-card',
          reference: { x: 520, y: 30, width: 800, height: 490 },
          dy: ventures,
        },
        {
          name: '03-next-glimpse',
          reference: { x: 1320, y: 30, width: 120, height: 490 },
          dy: ventures,
        },
        {
          name: '04-directory-head',
          reference: { x: 0, y: 515, width: 1440, height: 65 },
          dy: ventures,
        },
        {
          name: '05-directory-rows',
          reference: { x: 0, y: 580, width: 1440, height: 230 },
          dy: ventures,
        },
      ],
      ['01-heading-arrows', '02-pitch-card'],
    )
  })
})
