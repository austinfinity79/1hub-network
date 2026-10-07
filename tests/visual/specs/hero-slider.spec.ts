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

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`${width}: whole artwork in a stable 16:9 frame, controls usable, no overflow`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.clock.install()
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/', { waitUntil: 'networkidle' })
    const frame = (await page.locator('[data-section="hero-slider"] > div').first().boundingBox())!
    expect(Math.round(frame.width)).toBe(width)
    expect(Math.abs(frame.height - (width * 9) / 16)).toBeLessThanOrEqual(1)
    // Below the header, never under it.
    expect(Math.round(frame.y)).toBe(64)
    for (let i = 0; i < 6; i++) {
      const slide = page.locator(`[data-slide="0${i + 1}"] img`)
      const box = (await slide.boundingBox())!
      // The image box is the frame and the artwork has the frame's ratio: shown whole.
      expect(Math.abs(box.width - frame.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(box.height - frame.height)).toBeLessThanOrEqual(1)
      expect(await slide.evaluate((el: HTMLImageElement) => getComputedStyle(el).objectFit)).toBe(
        'contain',
      )
      await expect
        .poll(() => slide.evaluate((el: HTMLImageElement) => el.naturalWidth / el.naturalHeight))
        .toBeCloseTo(16 / 9, 2)
    }
    for (const name of ['Previous slide', 'Next slide']) {
      const b = (await page.getByRole('button', { name }).boundingBox())!
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(width)
      expect(b.y).toBeGreaterThan(frame.y + frame.height)
    }
    await expect(page.locator(INDICATOR)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    // The approved header logo stays (HOME-LOGO-HOTFIX-01).
    await expect(
      page.locator('header[data-shell="public"] a[data-cta="logo"] img[data-logo="brand"]'),
    ).toHaveCount(1)
    // A slide change does not move the page below the frame (no layout shift):
    // document positions, so a scroll to reach the button is not counted.
    const docTop = () =>
      page
        .locator('[data-search="hero"]')
        .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
    const before = await docTop()
    await page.getByRole('button', { name: 'Next slide' }).click()
    expect(await docTop()).toBe(before)
    expect(errors).toEqual([])
  })
}
