import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { resolveOutputPath } from '../pixel-qa/paths'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * TASK 24 FINAL — representative responsive smoke of the Internal Alpha RC at
 * 1440 / 1024 / 768 / 390: homepage, Library, L2 workspace, L3 public and
 * operator pages, L5 application form. Use only, never pixels: no horizontal
 * overflow, every control inside the width, the key control reachable and not
 * covered. The flow closures keep their own pixel evidence.
 */

const SEED_VENTURE = '50000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'

type Screen = { name: string; who: string | null; url: string; keys: string[] }

const SCREENS: Screen[] = [
  { name: 'homepage', who: null, url: '/', keys: ['[data-cta="primary"]'] },
  {
    name: 'library',
    who: null,
    url: '/library',
    keys: ['input[type="search"]', '[role="tab"]'],
  },
  {
    name: 'l2-workspace',
    who: 'member@example.test',
    url: '/projects',
    keys: ['[data-nav="create-project"]'],
  },
  { name: 'l3-public', who: null, url: '/organizations/chapter-01', keys: ['h1'] },
  {
    name: 'l3-members',
    who: 'leader@example.test',
    url: `/ops/org/${CHAPTER_01}/members`,
    keys: ['h1', '[role="tab"]'],
  },
  {
    name: 'l5-application',
    who: 'member@example.test',
    url: `/projects/${SEED_VENTURE}/applications/${PROGRAMME}`,
    keys: ['textarea', '[data-action="next"]'],
  },
]

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** Controls that leave the viewport's width, as "tag text [left, right]". */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="file"]), textarea, select',
    )) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).opacity === '0') continue
      let frame = el.parentElement
      while (frame && !/auto|scroll/.test(getComputedStyle(frame).overflowX))
        frame = frame.parentElement
      if (frame) {
        const f = frame.getBoundingClientRect()
        if (f.left >= -0.5 && f.right <= width + 0.5) continue
      }
      if (r.left < -0.5 || r.right > width + 0.5)
        out.push(`${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)}`)
    }
    return out
  })
}

for (const width of [1440, 1024, 768, 390] as const) {
  test(`RC responsive ${width}px: homepage, Library, L2 workspace, L3 public and members, L5 application`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const results: Record<string, unknown>[] = []
    for (const s of SCREENS) {
      await page.context().clearCookies()
      if (s.who) await login(page.request, s.who)
      const response = await page.goto(s.url, { waitUntil: 'networkidle' })
      expect(response?.status(), `${s.name} ${width}`).toBe(200)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${s.name} ${width} overflow`).toBeLessThanOrEqual(0)
      expect(await clipped(page), `${s.name} ${width} controls outside`).toEqual([])
      for (const key of s.keys) {
        const control = page.locator(key).first()
        await control.evaluate((el) => el.scrollIntoView({ block: 'center' }))
        await expect(control, `${s.name} ${width} ${key}`).toBeVisible()
        const box = (await control.boundingBox())!
        expect(box.x + box.width, `${s.name} ${width} ${key}`).toBeLessThanOrEqual(width)
        const hit = await control.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return Boolean(at && (el === at || el.contains(at) || at.contains(el)))
        })
        expect(hit, `${s.name} ${width} ${key} covered`).toBe(true)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: resolveOutputPath('actual', `RC.${s.name}.${width}.png`),
        fullPage: true,
      })
      results.push({ screen: s.name, width, overflow })
    }
    writeJsonReport(`RC.responsive.${width}.json`, { results })
  })
}
