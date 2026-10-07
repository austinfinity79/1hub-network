import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * HOMEPAGE-HERO-SLIDER-01 — the six approved stills (01 … 06, 1920 × 1080) as
 * the hero's canvas: 01 first, 10 s each, 06 → 01, previous / next restart the
 * 10 s, one timer at a time. The clock is driven, not waited for.
 */

const INDICATOR = '[data-hero-indicator]'
const active = (page: Page) =>
  page.locator('[data-section="hero-slider"] [data-active="true"]').getAttribute('data-slide')
const indicator = (page: Page) => page.locator(INDICATOR).innerText()

test('the six files are the approved stills, unmodified', async ({ request }) => {
  for (let i = 1; i <= 6; i++) {
    const file = `hero-still-0${i}.png`
    const res = await request.get(`/home/hero/${file}`)
    expect(res.status(), file).toBe(200)
    const expected = createHash('sha256')
      .update(readFileSync(path.join(REPO_ROOT, 'public/home/hero', file)))
      .digest('hex')
    expect(
      createHash('sha256')
        .update(await res.body())
        .digest('hex'),
      file,
    ).toBe(expected)
  }
})

test('order, loop, previous / next, indicator, 10 s rotation and timer reset', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install()
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-section="hero-slider"] [data-slide]')).toHaveCount(6)
  expect(await active(page)).toBe('01')
  expect((await indicator(page)).replace(/\s/g, '')).toBe('01/06')

  // Next: 01 → 02 → … → 06 → 01.
  const next = page.getByRole('button', { name: 'Next slide' })
  for (const n of ['02', '03', '04', '05', '06', '01']) {
    await next.click()
    expect(await active(page)).toBe(n)
    expect((await indicator(page)).replace(/\s/g, '')).toBe(`${n}/06`)
  }
  // Previous: 01 → 06.
  await page.getByRole('button', { name: 'Previous slide' }).click()
  expect(await active(page)).toBe('06')

  // Auto: 10 s per slide, 06 loops to 01.
  await page.clock.runFor(9_900)
  expect(await active(page)).toBe('06')
  await page.clock.runFor(200)
  await expect.poll(() => active(page)).toBe('01')
  await page.clock.runFor(10_000)
  await expect.poll(() => active(page)).toBe('02')

  // A manual change restarts the 10 s; several clicks never stack timers.
  await page.clock.runFor(8_000)
  for (let k = 0; k < 4; k++) await next.click()
  expect(await active(page)).toBe('06')
  await page.clock.runFor(9_000)
  expect(await active(page)).toBe('06')
  await page.clock.runFor(1_100)
  await expect.poll(() => active(page)).toBe('01')
  await page.clock.runFor(9_000)
  expect(await active(page)).toBe('01')
  expect(errors).toEqual([])
})

test('the first slide is prioritised; the others load without a broken state', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const imgs = page.locator('[data-section="hero-slider"] img')
  await expect(imgs).toHaveCount(6)
  // next/image `priority`: preloaded in <head>, never lazy; the others are lazy.
  await expect(
    page.locator('head link[rel="preload"][as="image"][imagesrcset*="hero-still-01"]'),
  ).toHaveCount(1)
  await expect(imgs.first()).not.toHaveAttribute('loading', 'lazy')
  await expect(imgs.nth(1)).toHaveAttribute('loading', 'lazy')
  for (let i = 0; i < 6; i++)
    await expect
      .poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBeGreaterThan(0)
})

// Screen-1 composition (PO SOT): header, the hero — the stills filling its
// canvas (no card, no side crop, no distortion), the arrows on its sides, the
// counter, search and intents over its lower part — then the ticker, which
// ends the first desktop screen; "Nổi bật tuần này" starts below the fold.
const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height }
    })

// The stills' key content (text, cards) ends by 72 % of their height.
const CONTENT_END = 0.72

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 900],
  [390, 844],
] as const) {
  test(`${width}×${height}: screen 1 — artwork, arrows, counter, search, intents, ticker`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.clock.install()
    await page.setViewportSize({ width, height })
    await page.goto('/', { waitUntil: 'networkidle' })
    const hero = await box(page, '[data-section="hero"]')
    const canvas = await box(page, '[data-section="hero-slider"]')
    const ticker = await box(page, '[data-section="ticker"]')
    expect([Math.round(canvas.x), Math.round(canvas.w), Math.round(canvas.y)]).toEqual([
      0,
      width,
      64,
    ])
    expect(Math.round(ticker.y)).toBe(Math.round(hero.y + hero.h))
    if (width >= 1024) {
      // Desktop: the ticker is the last element of the first screen.
      expect(Math.round(ticker.y + ticker.h)).toBe(height)
      expect((await box(page, '#home-week')).y).toBeGreaterThanOrEqual(height)
    } else {
      expect(hero.h).toBeLessThanOrEqual(height)
    }
    // No card: the canvas wears the stills' own edge colour, nothing framed.
    const look = await page
      .locator('[data-section="hero-slider"]')
      .evaluate((el) => [
        getComputedStyle(el).backgroundColor,
        getComputedStyle(el.querySelector('[data-slide]')!.parentElement!).borderRadius,
        getComputedStyle(el.querySelector('[data-slide]')!.parentElement!).boxShadow,
      ])
    expect(look).toEqual(['rgb(238, 238, 238)', '0px', 'none'])
    const art = await box(page, '[data-slide="01"] img')
    for (let i = 0; i < 6; i++) {
      // 16:9 from the canvas top, centred, never wider than the canvas: no
      // distortion, no side crop; at most a narrow #eeeeee margin each side.
      expect(await box(page, `[data-slide="0${i + 1}"] img`)).toEqual(art)
    }
    expect(Math.abs(art.h - (art.w * 9) / 16)).toBeLessThanOrEqual(1)
    expect(Math.round(art.y)).toBe(64)
    expect(Math.abs(art.x + art.w / 2 - width / 2)).toBeLessThanOrEqual(1)
    expect(art.w).toBeLessThanOrEqual(width)
    expect(art.w).toBeGreaterThanOrEqual(0.9 * width)
    const prev = await box(page, '[aria-label="Previous slide"]')
    const next = await box(page, '[aria-label="Next slide"]')
    const count = await box(page, '[data-hero-indicator]')
    const search = await box(page, '[data-search="hero"]')
    const primary = await box(page, '[data-cta="primary"]')
    if (width > 720) {
      // Arrows float on the canvas sides, on its vertical centre.
      expect(prev.x).toBeLessThanOrEqual(32)
      expect(width - (next.x + next.w)).toBeLessThanOrEqual(32)
      for (const a of [prev, next])
        expect(Math.abs(a.y + a.h / 2 - (canvas.y + canvas.h / 2))).toBeLessThanOrEqual(2)
      // Counter, search and intents over the artwork's lower part, below its key content.
      expect(search.y).toBeLessThan(art.y + art.h)
      expect(search.y).toBeGreaterThanOrEqual(art.y + CONTENT_END * art.h)
      // The counter sits on the stills' text column.
      expect(Math.abs(count.x - (art.x + 0.078 * art.w))).toBeLessThanOrEqual(2)
    } else {
      // Phones: the arrows join the counter row under the artwork.
      for (const a of [prev, next])
        expect(Math.abs(a.y + a.h / 2 - (count.y + count.h / 2))).toBeLessThanOrEqual(2)
      expect(count.y).toBeGreaterThanOrEqual(art.y + art.h)
    }
    expect(search.y).toBeGreaterThan(count.y + count.h)
    expect(primary.y).toBeGreaterThan(search.y)
    // Everything inside the canvas, before the hero ends.
    expect(primary.y + primary.h).toBeLessThanOrEqual(canvas.y + canvas.h)
    for (const a of [prev, next]) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.x + a.w).toBeLessThanOrEqual(width)
    }
    await expect(page.locator(INDICATOR)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    // The approved header logo stays (HOME-LOGO-HOTFIX-01).
    await expect(
      page.locator('header[data-shell="public"] a[data-cta="logo"] img[data-logo="brand"]'),
    ).toHaveCount(1)
    // A slide change does not move anything (no layout shift).
    const before = (await box(page, '[data-search="hero"]')).y
    await page.getByRole('button', { name: 'Next slide' }).click()
    expect((await box(page, '[data-search="hero"]')).y).toBe(before)
    expect(errors).toEqual([])
  })
}
