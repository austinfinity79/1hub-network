import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import {
  assertConditions,
  assertTypography,
  captureActual,
  captureAndCompare,
  readConditions,
  settle,
} from '../pixel-qa/capture'
import { compareImages } from '../pixel-qa/compare'
import { DESIGN_FINAL_DIR, harnessBaselinePath, REPO_ROOT } from '../pixel-qa/paths'
import { decodePng, readPng, writeBuffer } from '../pixel-qa/png'
import type { CaptureKind, ScreenReport } from '../pixel-qa/report'

/**
 * M0-T11 — proves the Pixel QA engine in a real browser against the dev-only
 * harness at /dev/pixel-qa.
 *
 * The harness is NOT a product screen. Its reference is a HARNESS-OWNED
 * regression baseline under tests/visual/baseline, never an approved design
 * reference, and nothing here compares a product route to design-reference/final.
 *
 * Harness baselines are created only on explicit request:
 *   PIXEL_QA_UPDATE_HARNESS=1 pnpm visual pixel-qa-harness
 */

const HARNESS = '/dev/pixel-qa'

function hashTree(dir: string): string {
  const hash = createHash('sha256')
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else hash.update(p).update(readFileSync(p))
    }
  }
  walk(dir)
  return hash.digest('hex')
}

async function open(page: Page, query = '') {
  await page.goto(`${HARNESS}${query}`, { waitUntil: 'networkidle' })
  await settle(page)
}

/** Harness baseline for a capture kind, created only when explicitly asked. */
async function harnessBaseline(page: Page, capture: CaptureKind): Promise<string> {
  const file = harnessBaselinePath(`pixel-qa-harness.${capture}.png`)
  if (!existsSync(file)) {
    if (process.env.PIXEL_QA_UPDATE_HARNESS !== '1') {
      throw new Error(
        `missing harness baseline ${file}; set PIXEL_QA_UPDATE_HARNESS=1 to create it`,
      )
    }
    writeBuffer(file, await page.screenshot({ fullPage: capture === 'full_page' }))
  }
  return file
}

async function compareHarness(
  page: Page,
  name: string,
  capture: CaptureKind,
): Promise<ScreenReport> {
  const conditions = await readConditions(page)
  assertConditions(conditions)
  return captureAndCompare(page, {
    name,
    capture,
    referencePath: await harnessBaseline(page, capture),
    referenceKind: 'HARNESS_REGRESSION',
    route: HARNESS,
    actor: null,
    conditions,
    typography: await assertTypography(page),
  })
}

const abs = (repoPath: string) => path.join(REPO_ROOT, repoPath)

test.describe('M0-T11 Pixel QA harness', () => {
  let designHashBefore = ''

  test.beforeAll(() => {
    designHashBefore = hashTree(DESIGN_FINAL_DIR)
  })

  test.afterAll(() => {
    // Nothing in the run may touch the approved design baseline.
    expect(hashTree(DESIGN_FINAL_DIR)).toBe(designHashBefore)
  })

  test('captures under the frozen conditions: 1440x900, DPR 1, fonts loaded', async ({ page }) => {
    await open(page)
    const conditions = await readConditions(page)
    expect(conditions).toEqual({ viewport: { width: 1440, height: 900 }, dpr: 1, fonts: 'loaded' })
    expect(() => assertConditions(conditions)).not.toThrow()
  })

  test('rejects a capture taken under the wrong conditions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await open(page)
    const wrong = await readConditions(page)
    expect(wrong.viewport).toEqual({ width: 1280, height: 800 })
    expect(() => assertConditions(wrong)).toThrow(/1440x900/)
    expect(() =>
      assertConditions({ viewport: { width: 1440, height: 900 }, dpr: 2, fonts: 'loaded' }),
    ).toThrow(/DPR/)
    expect(() =>
      assertConditions({ viewport: { width: 1440, height: 900 }, dpr: 1, fonts: 'loading' }),
    ).toThrow(/fonts not loaded/)
  })

  test('typography assertion passes on approved faces and finds no fallback', async ({ page }) => {
    await open(page)
    const typography = await assertTypography(page)
    expect(typography.checked).toBeGreaterThan(5)
    expect(typography.violations).toEqual([])
  })

  test('typography assertion flags an unapproved family and weight', async ({ page }) => {
    await open(page)
    await page.addStyleTag({ content: 'h1 { font-family: Georgia, serif !important; }' })
    await page.addStyleTag({ content: 'p { font-weight: 700 !important; }' })
    const { violations } = await assertTypography(page)
    expect(violations.join('\n')).toMatch(/<h1> uses unapproved family Georgia/)
    expect(violations.join('\n')).toMatch(/Be Vietnam Pro 700, not an approved weight/)
  })

  test('writes an actual capture at exactly 1440x900', async ({ page }) => {
    await open(page)
    const actual = await captureActual(page, 'pixel-qa-harness-probe', 'viewport')
    expect(existsSync(actual.path)).toBe(true)
    expect(readPng(actual.path)).toMatchObject({ width: 1440, height: 900 })
  })

  test('two captures of the same state are pixel-identical', async ({ page }) => {
    await open(page)
    const a = decodePng(await page.screenshot())
    await open(page)
    const b = decodePng(await page.screenshot())
    expect(compareImages(a, b).status).toBe('IDENTICAL')
  })

  test('identical state compares IDENTICAL and produces reference, actual, diff and report', async ({
    page,
  }) => {
    await open(page)
    const report = await compareHarness(page, 'pixel-qa-harness-identical', 'viewport')

    expect(report.reference_kind).toBe('HARNESS_REGRESSION')
    expect(report.comparison.status).toBe('IDENTICAL')
    expect(report.comparison.diff_pixels).toBe(0)
    expect(report.images.REFERENCE).toBe('tests/visual/baseline/pixel-qa-harness.viewport.png')
    expect(report.images.ACTUAL).toBe(
      'tests/visual/actual/pixel-qa/pixel-qa-harness-identical.viewport.png',
    )
    expect(report.images.DIFF).toBe(
      'tests/visual/diff/pixel-qa/pixel-qa-harness-identical.viewport.diff.png',
    )
    for (const file of Object.values(report.images)) expect(existsSync(abs(file!))).toBe(true)
    expect(
      existsSync(abs('tests/visual/reports/pixel-qa/pixel-qa-harness-identical.viewport.json')),
    ).toBe(true)
    expect(report.product_pixel_pass_claimed).toBe(false)
  })

  test('an intentional change is detected, located and diffed', async ({ page }) => {
    await open(page)
    const before = await page.locator('[data-pixel-qa-target]').boundingBox()
    await open(page, '?variant=changed')
    const after = await page.locator('[data-pixel-qa-target]').boundingBox()
    const report = await compareHarness(page, 'pixel-qa-harness-changed', 'viewport')

    expect(report.comparison.status).toBe('DIFFERENT')
    expect(report.comparison.diff_pixels).toBeGreaterThan(1000)
    expect(report.classification.status).toBe('PENDING_REVIEW')
    expect(existsSync(abs(report.images.DIFF!))).toBe(true)

    // The diff box must cover where the block was and where it moved to.
    const box = report.comparison.diff_bbox!
    for (const b of [before!, after!]) {
      expect(box.x).toBeLessThanOrEqual(Math.floor(b.x))
      expect(box.y).toBeLessThanOrEqual(Math.floor(b.y))
      expect(box.x + box.width).toBeGreaterThanOrEqual(Math.floor(b.x + b.width))
      expect(box.y + box.height).toBeGreaterThanOrEqual(Math.floor(b.y + b.height))
    }
  })

  test('long page: full-page capture keeps 1440 width and exceeds 900 without squashing', async ({
    page,
  }) => {
    await open(page, '?long=1')
    const conditions = await readConditions(page)
    expect(conditions.viewport).toEqual({ width: 1440, height: 900 })

    const viewport = await captureActual(page, 'pixel-qa-harness-long', 'viewport')
    const full = await captureActual(page, 'pixel-qa-harness-long', 'full_page')
    expect(readPng(viewport.path)).toMatchObject({ width: 1440, height: 900 })
    const fullPng = readPng(full.path)
    expect(fullPng.width).toBe(1440)
    expect(fullPng.height).toBeGreaterThan(1500)

    const report = await compareHarness(page, 'pixel-qa-harness-long', 'full_page')
    expect(report.comparison.status).toBe('IDENTICAL')
  })

  test('long page: a change below the fold is caught only by the full-page capture', async ({
    page,
  }) => {
    await open(page, '?long=1')
    const viewportBefore = decodePng(await page.screenshot())
    // A block placed wholly below the 900px fold, inside the existing page height.
    await page.evaluate(() => {
      const el = document.createElement('div')
      el.style.cssText =
        'position:absolute;left:64px;top:1500px;width:200px;height:80px;background:var(--color-fg-default)'
      document.body.appendChild(el)
    })
    const viewportAfter = decodePng(await page.screenshot())
    expect(compareImages(viewportBefore, viewportAfter).status).toBe('IDENTICAL')

    const report = await compareHarness(page, 'pixel-qa-harness-long-changed', 'full_page')
    expect(report.comparison.status).toBe('DIFFERENT')
    expect(report.comparison.diff_bbox).toEqual({ x: 64, y: 1500, width: 200, height: 80 })
  })
})
