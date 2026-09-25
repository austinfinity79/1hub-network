import path from 'node:path'

import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * M0-T02b — Playwright re-verification of the M0-T02 typography foundation.
 *
 * Replaces the Chrome-extension verification, which the browser-testing rule no
 * longer accepts as evidence. Unlike the extension, Playwright can force the
 * frozen capture conditions: 1440x900 at deviceScaleFactor 1.
 *
 * The harness route is NOT a product screen and has no baseline in
 * design-reference/final, so nothing here performs a design pixel comparison.
 */

// Specs are loaded as CommonJS by Playwright, so import.meta is unavailable.
const ACTUAL_DIR = path.join(__dirname, '..', 'actual')
const HARNESS = '/dev/typography'

/** Type scale frozen by Design SOT section 2.4, keyed by the base type class. */
const SCALE: Record<string, { size: string; line: string }> = {
  'type-display': { size: '34px', line: '44px' },
  'type-heading-2': { size: '26px', line: '36px' },
  'type-subtitle': { size: '20px', line: '30px' },
  'type-section-sm': { size: '17px', line: '26px' },
  'type-body-md': { size: '16px', line: '28px' },
  'type-body-sm': { size: '14px', line: '24px' },
  'type-meta-xs': { size: '13px', line: '18px' },
  'type-button': { size: '16px', line: '20px' },
  'type-mono-meta': { size: '13px', line: '18px' },
}

/** Every face pinned by Design SOT section 2.3. */
const PINNED_FACES = [
  { family: 'Be Vietnam Pro', weight: 400 },
  { family: 'Be Vietnam Pro', weight: 500 },
  { family: 'Be Vietnam Pro', weight: 600 },
  { family: 'Archivo', weight: 700 },
  { family: 'IBM Plex Mono', weight: 500 },
]

type SampleReading = {
  sample: string
  family: string
  weight: number
  size: string
  line: string
  faceLoaded: boolean
  substituted: boolean
  expectFamily: string
  expectWeight: number
}

/** Waits until every declared face has settled, not merely the first batch. */
async function waitForFonts(page: Page) {
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15_000 })
}

async function readSamples(page: Page): Promise<SampleReading[]> {
  return page.evaluate(() => {
    const firstFamily = (stack: string) =>
      stack
        .split(',')[0]!
        .trim()
        .replace(/^["']|["']$/g, '')

    // Substitution probe: measure the same string in the target family and in a
    // family that cannot exist. Equal widths mean the browser fell back.
    const ctx = document.createElement('canvas').getContext('2d')!
    const PROBE = 'Kết nối hệ sinh thái đổi mới sáng tạo ABCxyz 0123'
    const widthIn = (spec: string) => {
      ctx.font = spec
      return ctx.measureText(PROBE).width
    }

    return [...document.querySelectorAll<HTMLElement>('[data-type-sample]')].map((el) => {
      const cs = getComputedStyle(el)
      const expectFamily = el.dataset.expectFamily!
      const weight = Number(cs.fontWeight)

      return {
        sample: el.dataset.typeSample!,
        family: firstFamily(cs.fontFamily),
        weight,
        size: cs.fontSize,
        line: cs.lineHeight,
        faceLoaded: document.fonts.check(`${weight} 16px "${expectFamily}"`),
        substituted:
          Math.abs(
            widthIn(`${weight} 16px "${expectFamily}"`) -
              widthIn(`${weight} 16px "NoSuchFace___1hub"`),
          ) < 0.5,
        expectFamily,
        expectWeight: Number(el.dataset.expectWeight),
      }
    })
  })
}

test.describe('M0-T02 typography foundation', () => {
  let fontRequests: string[] = []

  test.beforeEach(async ({ page }) => {
    fontRequests = []
    page.on('request', (req: Request) => {
      if (req.resourceType() === 'font') fontRequests.push(req.url())
    })
    await page.goto(HARNESS, { waitUntil: 'networkidle' })
    await waitForFonts(page)
  })

  test('captures under the frozen conditions: 1440x900 at DPR 1', async ({ page }) => {
    const conditions = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
      fonts: document.fonts.status,
    }))

    expect(conditions).toEqual({ width: 1440, height: 900, dpr: 1, fonts: 'loaded' })
  })

  test('every sample matches the family, weight and scale the SOT freezes', async ({ page }) => {
    const samples = await readSamples(page)
    expect(samples.length).toBeGreaterThanOrEqual(10)

    for (const s of samples) {
      const baseClass = s.sample.split(' ')[0]!
      const expected = SCALE[baseClass]
      expect(expected, `no frozen scale for ${baseClass}`).toBeDefined()

      expect(s.family, `${s.sample} family`).toBe(s.expectFamily)
      expect(s.weight, `${s.sample} weight`).toBe(s.expectWeight)
      expect(s.size, `${s.sample} font-size`).toBe(expected!.size)
      expect(s.line, `${s.sample} line-height`).toBe(expected!.line)
    }
  })

  test('resolves the real face for every sample, with no fallback substitution', async ({
    page,
  }) => {
    const samples = await readSamples(page)

    for (const s of samples) {
      expect(s.faceLoaded, `${s.sample} face not loaded`).toBe(true)
      expect(s.substituted, `${s.sample} fell back to a substitute face`).toBe(false)
    }
  })

  test('loads all five pinned faces and registers all fifteen declarations', async ({ page }) => {
    const report = await page.evaluate((faces) => {
      const loaded = [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => `${f.family} ${f.weight}`)

      return {
        declaredRules: document.fonts.size,
        missing: faces
          .filter((f) => !document.fonts.check(`${f.weight} 16px "${f.family}"`))
          .map((f) => `${f.family} ${f.weight}`),
        distinctLoaded: [...new Set(loaded)].sort(),
      }
    }, PINNED_FACES)

    expect(report.missing).toEqual([])
    expect(report.declaredRules).toBe(15)
    expect(report.distinctLoaded).toEqual([
      'Archivo 700',
      'Be Vietnam Pro 400',
      'Be Vietnam Pro 500',
      'Be Vietnam Pro 600',
      'IBM Plex Mono 500',
    ])
  })

  test('serves every font from our own origin, never a CDN', async () => {
    expect(fontRequests.length).toBeGreaterThan(0)

    for (const url of fontRequests) {
      expect(url, `font not served from our origin: ${url}`).toMatch(
        /^http:\/\/localhost:\d+\/fonts\//,
      )
    }
  })

  test('applies the frozen colour anchors to the document', async ({ page }) => {
    const doc = await page.evaluate(() => {
      const cs = getComputedStyle(document.body)
      return { background: cs.backgroundColor, color: cs.fontFamily ? cs.color : '' }
    })

    // --hub-canvas #EFEFEF and --hub-burgundy #160002
    expect(doc.background).toBe('rgb(239, 239, 239)')
    expect(doc.color).toBe('rgb(22, 0, 2)')
  })

  test('renders identically to the harness baseline', async ({ page }) => {
    await page.screenshot({
      path: path.join(ACTUAL_DIR, 'typography-foundation-1440x900.png'),
      fullPage: true,
      animations: 'disabled',
    })

    await expect(page).toHaveScreenshot('typography-foundation.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    })
  })
})
