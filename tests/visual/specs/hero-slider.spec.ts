import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * HOMEPAGE-HERO-SLIDER-01 — the six approved stills (01 … 06, 1920 × 1080) in
 * one 16:9 frame: shown whole, 01 first, 10 s each, 06 → 01, previous / next
 * restart the 10 s, one timer at a time. The clock is driven, not waited for.
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

// Frame correction (PO reference): the artwork sits in a bounded frame inside
// one composed hero; the PNG never sets the hero's height.
const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height }
    })

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`${width}: bounded frame inside the hero, arrows, counter, search and intents`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.clock.install()
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/', { waitUntil: 'networkidle' })
    const hero = await box(page, '[data-section="hero"]')
    const frame = await box(page, '[data-section="hero-slider"] [data-slide]')
    // Bounded: never the full width, 16:9, under the header.
    expect(frame.w).toBeLessThan(width - 24)
    expect(Math.abs(frame.h - (frame.w * 9) / 16)).toBeLessThanOrEqual(1.5)
    expect(frame.y).toBeGreaterThanOrEqual(64)
    if (width >= 1280) {
      // One first screen: the hero is the viewport (bounded), the frame well within it.
      expect(Math.round(hero.h)).toBe(900)
      expect(frame.h).toBeLessThan(0.7 * 900)
    }
    for (let i = 0; i < 6; i++) {
      const img = await box(page, `[data-slide="0${i + 1}"] img`)
      expect(Math.abs(img.w - frame.w)).toBeLessThanOrEqual(1)
      expect(Math.abs(img.h - frame.h)).toBeLessThanOrEqual(1)
      expect(
        await page
          .locator(`[data-slide="0${i + 1}"] img`)
          .evaluate((el: HTMLImageElement) => getComputedStyle(el).objectFit),
      ).toBe('contain')
    }
    const prev = await box(page, '[aria-label="Previous slide"]')
    const next = await box(page, '[aria-label="Next slide"]')
    const count = await box(page, '[data-hero-indicator]')
    if (width >= 1024) {
      // Arrows flank the frame, vertically on its centre.
      expect(prev.x + prev.w).toBeLessThanOrEqual(frame.x)
      expect(next.x).toBeGreaterThanOrEqual(frame.x + frame.w)
      for (const a of [prev, next])
        expect(Math.abs(a.y + a.h / 2 - (frame.y + frame.h / 2))).toBeLessThanOrEqual(12)
      // Counter under the frame, at its left edge.
      expect(Math.abs(count.x - frame.x)).toBeLessThanOrEqual(2)
    } else {
      for (const a of [prev, next]) expect(a.y).toBeGreaterThan(frame.y + frame.h)
    }
    expect(count.y).toBeGreaterThan(frame.y + frame.h)
    // Search, then the intents, inside the hero below the counter; then the ticker.
    const search = await box(page, '[data-search="hero"]')
    const primary = await box(page, '[data-cta="primary"]')
    expect(search.y).toBeGreaterThan(count.y + count.h)
    expect(primary.y).toBeGreaterThan(search.y)
    expect(primary.y + primary.h).toBeLessThanOrEqual(hero.y + hero.h)
    expect(Math.round((await box(page, '[data-section="ticker"]')).y)).toBe(
      Math.round(hero.y + hero.h),
    )
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
