import { execFileSync } from 'node:child_process'

import type { Page } from '@playwright/test'

import { compareImages, type CompareOptions } from './compare'
import { FROZEN_DPR, FROZEN_VIEWPORT, type ResolvedScreen } from './manifest'
import { REPO_ROOT, resolveOutputPath } from './paths'
import { decodePng, readPng, writeBuffer } from './png'
import { dryRun, PERSONAS, resolveRoute, type QaScreenConfig } from './qa-screens'
import {
  buildReport,
  reportFileName,
  writeJsonReport,
  type CaptureKind,
  type ReferenceKind,
  type ScreenReport,
  type TypographyResult,
} from './report'

/**
 * M0-T11 — browser side of the Pixel QA runner, following the Pixel QA
 * architecture section 5 capture sequence: seed, authenticate, navigate, fonts,
 * stabilise, assert typography, capture viewport, capture full page, diff.
 */

/** Pixel QA section 5 stabilisation CSS. */
export const STABILIZE_CSS = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}`

/** Design SOT section 2.3: the only family/weight pairs allowed in UI text. */
export const APPROVED_FACES: Record<string, readonly number[]> = {
  'Be Vietnam Pro': [400, 500, 600],
  Archivo: [700],
  'IBM Plex Mono': [500],
}

export type CaptureConditions = {
  viewport: { width: number; height: number }
  dpr: number
  fonts: string
}

/** Re-applies the idempotent deterministic seed (M0-T07). */
export function resetSeed(): void {
  execFileSync('node', ['scripts/db.mjs', 'seed'], { cwd: REPO_ROOT, stdio: 'pipe' })
}

/** Authenticates the page's browser context as a seeded persona, via the real magic-link flow. */
export async function authenticate(page: Page, config: QaScreenConfig): Promise<void> {
  const email = PERSONAS[config.actor]
  await page.context().clearCookies()
  if (!email) return
  const response = await page.request.post('/dev/login', { data: { email } })
  if (!response.ok()) throw new Error(`login as ${config.actor} failed: ${response.status()}`)
}

/** Waits until every declared face has settled, then for layout to settle. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15_000 })
  await page.addStyleTag({ content: STABILIZE_CSS })
  // Two animation frames so the stabilisation CSS has applied before capture.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )
}

export async function readConditions(page: Page): Promise<CaptureConditions> {
  return page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    dpr: window.devicePixelRatio,
    fonts: document.fonts.status,
  }))
}

/** Fails fast on V0 conditions: wrong viewport, DPR or unloaded fonts. */
export function assertConditions(conditions: CaptureConditions): void {
  const { viewport, dpr, fonts } = conditions
  if (viewport.width !== FROZEN_VIEWPORT.width || viewport.height !== FROZEN_VIEWPORT.height) {
    throw new Error(`capture viewport ${viewport.width}x${viewport.height}, expected 1440x900`)
  }
  if (dpr !== FROZEN_DPR) throw new Error(`capture DPR ${dpr}, expected 1`)
  if (fonts !== 'loaded') throw new Error(`fonts not loaded before capture: ${fonts}`)
}

/**
 * DOM typography contract (Design SOT section 5, Pixel QA section 3B). Checks
 * every element that renders its own text: first family, weight pairing, the
 * face is loaded, and the browser did not fall back to another font.
 */
export async function assertTypography(page: Page): Promise<TypographyResult> {
  const readings = await page.evaluate(() => {
    const firstFamily = (stack: string) =>
      stack
        .split(',')[0]!
        .trim()
        .replace(/^["']|["']$/g, '')
    const ctx = document.createElement('canvas').getContext('2d')!
    const PROBE = 'Kết nối hệ sinh thái đổi mới sáng tạo ABCxyz 0123'
    const widthIn = (spec: string) => {
      ctx.font = spec
      return ctx.measureText(PROBE).width
    }
    const hasOwnText = (el: Element) =>
      [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '')

    const bodyFamily = firstFamily(getComputedStyle(document.body).fontFamily)
    const texts = [...document.body.querySelectorAll('*')].filter(
      (el) => hasOwnText(el) && (el as HTMLElement).offsetParent !== null,
    )
    return {
      bodyFamily,
      samples: texts.map((el) => {
        const cs = getComputedStyle(el)
        const family = firstFamily(cs.fontFamily)
        const weight = Number(cs.fontWeight)
        return {
          tag: el.tagName.toLowerCase(),
          family,
          weight,
          loaded: document.fonts.check(`${weight} 16px "${family}"`),
          substituted:
            Math.abs(
              widthIn(`${weight} 16px "${family}"`) - widthIn(`${weight} 16px "NoSuchFace___1hub"`),
            ) < 0.5,
        }
      }),
    }
  })

  const violations: string[] = []
  if (readings.bodyFamily !== 'Be Vietnam Pro') {
    violations.push(`body font-family is ${readings.bodyFamily}, expected Be Vietnam Pro`)
  }
  for (const s of readings.samples) {
    const weights = APPROVED_FACES[s.family]
    if (!weights) violations.push(`<${s.tag}> uses unapproved family ${s.family}`)
    else if (!weights.includes(s.weight)) {
      violations.push(`<${s.tag}> uses ${s.family} ${s.weight}, not an approved weight`)
    }
    if (!s.loaded) violations.push(`<${s.tag}> ${s.family} ${s.weight} face not loaded`)
    if (s.substituted)
      violations.push(`<${s.tag}> ${s.family} ${s.weight} fell back to another font`)
  }
  return { checked: readings.samples.length, violations: [...new Set(violations)] }
}

/** Captures the page and writes it as an ACTUAL output. */
export async function captureActual(
  page: Page,
  name: string,
  capture: CaptureKind,
): Promise<{ path: string; buffer: Buffer }> {
  const file = resolveOutputPath('actual', `${name}.${capture}.png`)
  const buffer = await page.screenshot({
    fullPage: capture === 'full_page',
    animations: 'disabled',
  })
  const png = decodePng(buffer)
  if (png.width !== FROZEN_VIEWPORT.width) {
    throw new Error(`${name} ${capture} capture is ${png.width}px wide, expected 1440`)
  }
  if (capture === 'viewport' && png.height !== FROZEN_VIEWPORT.height) {
    throw new Error(`${name} viewport capture is ${png.height}px tall, expected 900`)
  }
  writeBuffer(file, buffer)
  return { path: file, buffer }
}

export type CompareRun = {
  name: string
  capture: CaptureKind
  referencePath: string
  referenceKind: ReferenceKind
  route: string | null
  actor: string | null
  conditions: CaptureConditions
  typography: TypographyResult | null
  compare?: CompareOptions
}

/** Captures, compares against a reference, writes the diff and the report. */
export async function captureAndCompare(page: Page, run: CompareRun): Promise<ScreenReport> {
  const actual = await captureActual(page, run.name, run.capture)
  const diffPath = resolveOutputPath('diff', `${run.name}.${run.capture}.diff.png`)
  const comparison = compareImages(readPng(run.referencePath), decodePng(actual.buffer), {
    ...run.compare,
    diffPath,
  })
  const report = buildReport({
    screen_id: run.name,
    capture: run.capture,
    route: run.route,
    actor: run.actor,
    reference_kind: run.referenceKind,
    conditions: run.conditions,
    comparison,
    typography: run.typography,
    referencePath: run.referencePath,
    actualPath: actual.path,
    diffPath: comparison.status === 'DIMENSION_MISMATCH' ? null : diffPath,
  })
  writeJsonReport(reportFileName(run.name, run.capture), report)
  return report
}

/**
 * Full screen run for a future WF task: seed, authenticate, navigate, settle,
 * assert conditions and typography, then viewport and (when the manifest has
 * one) full-page comparison against the APPROVED design reference.
 */
export async function runScreenQa(
  page: Page,
  screen: ResolvedScreen,
  config: QaScreenConfig,
): Promise<ScreenReport[]> {
  // Refuse any screen the dry run marks as a configuration gap, whether the gap
  // is declared in the mapping or derived from the reference itself.
  const [status] = dryRun([screen])
  if (status!.status !== 'READY_FOR_SCREEN_IMPLEMENTATION') {
    throw new Error(`${screen.screen_id}: ${status!.reasons.join('; ')}`)
  }
  resetSeed()
  await authenticate(page, config)
  const route = resolveRoute(config)
  await page.goto(route, { waitUntil: 'networkidle' })
  await settle(page)
  const conditions = await readConditions(page)
  assertConditions(conditions)
  const typography = await assertTypography(page)

  const common = {
    name: screen.screen_id,
    referenceKind: 'APPROVED_DESIGN' as const,
    route,
    actor: config.actor,
    conditions,
    typography,
  }
  const reports = [
    await captureAndCompare(page, {
      ...common,
      capture: 'viewport',
      referencePath: screen.viewportPath,
    }),
  ]
  if (screen.fullPagePath) {
    reports.push(
      await captureAndCompare(page, {
        ...common,
        capture: 'full_page',
        referencePath: screen.fullPagePath,
      }),
    )
  }
  return reports
}
