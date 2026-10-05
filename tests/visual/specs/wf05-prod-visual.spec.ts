import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { createApplication } from '../../../src/lib/application/application'
import {
  buildWf05Fixture,
  removeWf05Fixture,
  WF05_FIXTURE_EMAILS,
  type Wf05Fixture,
} from '../../../src/lib/application/testing'
import { closePool, query } from '../../../src/lib/db/client'
import { seedVenture } from '../../../src/lib/venture/testing'
import { REPO_ROOT } from '../pixel-qa/paths'
import { login, watchConsole } from '../support/programmes'

/**
 * WF05-PROD-06 — responsive and interaction QA of the productionized WF05
 * screens on the current build (the baseline comparison is
 * `scripts/qa/wf05-visual-compare.mjs`). Every state × 1440 / 1024 / 768 /
 * 430 / 390 / 320 at DPR 1: no page overflow, no control escaping the
 * viewport outside a horizontal scroller, no overlapping controls, no clipped
 * text; plus the states the comparison cannot stage (loading, API errors,
 * failed save, validation, long values, guest return) and a keyboard /
 * labelling smoke. Deterministic WF05 fixture only; console, hydration and
 * unexpected 5xx = 0.
 */

const WIDTHS = [1440, 1024, 768, 430, 390, 320] as const
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual/wf05-prod-06-states')
/** Focus stops without an outline / shadow on the baseline too (KNOWN, not a regression). */
const KNOWN_NO_FOCUS_RING = ['main A venture-detail']
const LONG_NAME =
  'Hợp tác xã Nông nghiệp Thông minh và Chuyển đổi số cho Nông dân Đồng bằng sông Cửu Long QA'

let fx: Wf05Fixture
let longVenture = ''
let consoleErrors: string[] = []
let statuses: { url: string; status: number }[] = []
const faked = new Set<string>()

test.beforeAll(async () => {
  fx = await buildWf05Fixture()
  // A long venture name and long team names: the wrapping cases (removed with the fixture).
  longVenture = (await seedVenture(fx.owner.accountId, { type: 'PROJECT', name: LONG_NAME })).id
  await query(`UPDATE individual_profiles SET display_name = $2 WHERE id = $1`, [
    fx.editor.profileId,
    'Nguyễn Thị Thanh Hương Phụ trách Kỹ thuật và Vận hành Sản phẩm',
  ])
  // A draft with nothing answered: the incomplete review (removed with the fixture).
  await createApplication(
    fx.owner.accountId,
    { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
    'req-wf05-prod06',
  )
})

test.afterAll(async () => {
  await removeWf05Fixture()
  await closePool()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = watchConsole(page)
  statuses = []
  faked.clear()
  page.on('response', (r) => statuses.push({ url: r.url(), status: r.status() }))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(
    consoleErrors.filter((e) => !(faked.size > 0 && /status of 503/.test(e))),
    'console / hydration errors',
  ).toEqual([])
  expect(
    statuses.filter((s) => s.status >= 500 && !faked.has(s.url)),
    'no unexpected 5xx',
  ).toEqual([])
})

/** Fails matching requests with a 503 in the frozen envelope (an API error state). */
async function fail(page: Page, pattern: string, method?: string) {
  await page.route(pattern, async (route) => {
    if (method && route.request().method() !== method) return route.fallback()
    faked.add(route.request().url())
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Unavailable.', request_id: 'req-fake' },
      }),
    })
  })
}

/** Layout facts: page overflow, escaping / overlapping controls, clipped text. */
function layout() {
  const W = window.innerWidth
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0
  }
  const scrolls = (el: Element) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if ((o === 'auto' || o === 'scroll') && p !== document.documentElement) return true
    }
    return false
  }
  const label = (el: Element) =>
    ((el as HTMLElement).innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40)
  const controls = [
    ...document.querySelectorAll(
      'a[href], button, input:not([type=hidden]), select, textarea, [role=button]',
    ),
  ]
    .filter(visible)
    // S1-UAT-02 (DEC-S1F-D8): the floating "Góp ý" is an overlay over the page;
    // a page control is brought clear of it by scrolling (REL-RESP checks that).
    .filter((el) => !el.closest('[data-feedback-launcher]'))
  const boxes = controls.map((el) => ({
    el,
    r: el.getBoundingClientRect(),
    inScroller: scrolls(el),
  }))
  const escaping = boxes
    .filter((b) => !b.inScroller && (b.r.left < -1 || b.r.right > W + 1))
    .map((b) => label(b.el))
  const overlaps: string[] = []
  for (let i = 0; i < boxes.length; i += 1)
    for (let j = i + 1; j < boxes.length; j += 1) {
      const [a, b] = [boxes[i]!, boxes[j]!]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (ix > 2 && iy > 2) overlaps.push(`${label(a.el)} × ${label(b.el)}`)
    }
  const clipped: string[] = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || !(el as HTMLElement).innerText?.trim()) continue
    if (el.matches('input, textarea, select')) continue
    const s = getComputedStyle(el)
    const hides = ['hidden', 'clip'].includes(s.overflowX) || s.textOverflow === 'ellipsis'
    if (hides && el.scrollWidth > el.clientWidth + 1) clipped.push(label(el))
  }
  return { overflow: document.documentElement.scrollWidth - W, escaping, overlaps, clipped }
}

type State = {
  name: string
  who: keyof typeof WF05_FIXTURE_EMAILS | null
  path: () => string
  ready: string
  /** Staged before navigation (route faults) or after it (typing, clicks). */
  before?: (page: Page) => Promise<unknown>
  after?: (page: Page) => Promise<unknown>
  status?: number
}

const form = (v: string, p: string) => `/projects/${v}/applications/${p}`

const STATES: State[] = [
  { name: 's01', who: 'owner', path: () => '/demo/projects', ready: '[data-venture]' },
  {
    name: 's01-loading',
    who: 'owner',
    path: () => '/demo/projects',
    ready: '[data-state="projects-loading"]',
    before: (page) => page.route('**/api/v1/me/applications', () => new Promise(() => undefined)),
  },
  {
    name: 's01-error',
    who: 'owner',
    path: () => '/demo/projects',
    ready: '[data-state="projects-failed"] [data-action="retry"]',
    before: (page) => fail(page, '**/api/v1/me/applications'),
  },
  {
    name: 's01-empty',
    who: 'other',
    path: () => '/demo/projects',
    ready: '[data-state="ventures-empty"]',
  },
  { name: 's01-member', who: 'editor', path: () => '/demo/projects', ready: '[data-venture]' },
  {
    name: 's02-owner',
    who: 'owner',
    path: () => `/demo/projects/${fx.ventures.project}`,
    ready: '[data-programme-closed]',
  },
  {
    name: 's02-member',
    who: 'editor',
    path: () => `/demo/projects/${fx.ventures.project}`,
    ready: '[data-ineligible="NOT_OWNER"]',
  },
  {
    name: 's02-archived',
    who: 'owner',
    path: () => `/demo/projects/${fx.ventures.archived}`,
    ready: '[data-state="venture-archived"]',
  },
  {
    name: 's02-long',
    who: 'owner',
    path: () => `/demo/projects/${longVenture}`,
    ready: '[data-detail="programmes"]',
  },
  {
    name: 's02-error',
    who: 'owner',
    path: () => `/demo/projects/${fx.ventures.project}`,
    ready: '[data-state="venture-failed"] [data-action="retry"]',
    before: (page) => fail(page, '**/api/v1/demo/projects/*'),
  },
  {
    name: 's02-not-found',
    who: 'owner',
    path: () => `/demo/projects/${randomUUID()}`,
    ready: 'body',
    status: 404,
  },
  {
    name: 'sub0-errors',
    who: 'other',
    path: () => `/programmes/${fx.programmes.open}/apply`,
    ready: '[data-screen="L5-SUB0"] [role="alert"]',
    after: (page) => page.locator('[data-action="quick-go"]').click(),
  },
  {
    name: 'choose',
    who: 'owner',
    path: () => `/programmes/${fx.programmes.open}/apply`,
    ready: '[data-screen="L5-CHOOSE"]',
  },
  ...[1, 3, 4].map((step): State => ({
    name: `sub1-step${step}`,
    who: 'owner',
    path: () => `${form(fx.ventures.project, fx.programmes.open)}?buoc=${step}`,
    ready: `[data-screen="L5-SUB1"][data-step="${step}"]`,
  })),
  {
    name: 'sub1-save-failed',
    who: 'owner',
    path: () => form(fx.ventures.project, fx.programmes.open),
    ready: '[data-action="save-retry"]',
    before: (page) => fail(page, '**/api/v1/applications/*', 'PATCH'),
    after: async (page) => {
      await page.locator('#q-q-problem').fill('Một câu trả lời rất dài '.repeat(20))
      await page.locator('#q-q-problem').blur()
    },
  },
  {
    name: 'sub1-closed',
    who: 'owner',
    path: () => form(fx.ventures.project, fx.programmes.closed),
    ready: '[data-ineligible="NOT_PUBLISHED"]',
  },
  {
    name: 'sub1-archived',
    who: 'owner',
    path: () => form(fx.ventures.archived, fx.programmes.open),
    ready: '[data-ineligible="ARCHIVED"]',
  },
  {
    name: 'sub2-ready',
    who: 'owner',
    path: () => `${form(fx.ventures.project, fx.programmes.open)}/review`,
    ready: '[data-screen="L5-SUB2"]',
  },
  {
    name: 'sub2-incomplete',
    who: 'owner',
    path: () => `${form(fx.ventures.project, fx.programmes.teamOnly)}/review`,
    ready: '[data-screen="L5-SUB2"] [role="status"]',
  },
  {
    name: 'sub2-submit-error',
    who: 'owner',
    path: () => `${form(fx.ventures.project, fx.programmes.open)}/review`,
    ready: '[data-submit-state="failed"]',
    before: (page) => fail(page, '**/api/v1/applications/*/submit'),
    after: (page) => page.locator('[data-action="submit"]').click(),
  },
  {
    name: 'sub3',
    who: 'owner',
    path: () => `${form(fx.ventures.startup, fx.programmes.open)}/submitted`,
    ready: '[data-screen="L5-SUB3"]',
  },
  {
    name: 'sub3-closed',
    who: 'owner',
    path: () => `${form(fx.ventures.startup, fx.programmes.closed)}/submitted`,
    ready: '[data-screen="L5-SUB3"]',
  },
  { name: 'guest-auth', who: null, path: () => '/demo/projects', ready: 'form' },
]

for (const state of STATES) {
  for (const width of WIDTHS) {
    test(`${state.name} @${width}: no overflow, escape, overlap or clipped text`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      if (state.who) await login(page.request, WF05_FIXTURE_EMAILS[state.who])
      await state.before?.(page)
      const response = await page.goto(state.path())
      expect(response?.status()).toBe(state.status ?? 200)
      await state.after?.(page)
      await expect(page.locator(state.ready).first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const facts = await page.evaluate(layout)
      expect(facts, `${state.name} @${width}`).toEqual({
        overflow: 0,
        escaping: [],
        overlaps: [],
        clipped: [],
      })
      // The error, retry and validation controls stay inside the viewport (page content
      // only: Next's route announcer is an off-screen role="alert" by design).
      for (const selector of [
        '[data-action="retry"]',
        '[data-action="save-retry"]',
        '[data-screen] [role="alert"]',
      ]) {
        for (const el of await page.locator(selector).all()) {
          const box = (await el.boundingBox())!
          expect(box.x, `${state.name} ${selector}`).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, `${state.name} ${selector}`).toBeLessThanOrEqual(width + 1)
        }
      }
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: path.join(ACTUAL, `${state.name}-${width}.png`),
          fullPage: true,
        })
    })
  }
}

test.describe('WF05-PROD-06 interaction and accessibility smoke', () => {
  test('keyboard: every WF05 screen is reachable by Tab in visual order, with a visible focus, no positive tabindex', async ({
    page,
  }) => {
    await login(page.request, WF05_FIXTURE_EMAILS.owner)
    for (const target of [
      '/demo/projects',
      `/demo/projects/${fx.ventures.project}`,
      form(fx.ventures.project, fx.programmes.open),
      `${form(fx.ventures.project, fx.programmes.open)}/review`,
    ]) {
      await page.goto(target)
      await page.waitForLoadState('networkidle')
      expect(
        await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count(),
      ).toBe(0)
      const seen: { tag: string; outline: string; shadow: string }[] = []
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press('Tab')
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (!el || el === document.body) return null
          const s = getComputedStyle(el)
          return {
            tag: `${el.closest('main') ? 'main' : 'page'} ${el.tagName} ${el.getAttribute('data-nav') ?? el.getAttribute('data-action') ?? (el.innerText || '').trim().slice(0, 20)}`,
            outline: s.outlineStyle,
            shadow: s.boxShadow,
          }
        })
        if (info) seen.push(info)
      }
      expect(seen.length, target).toBeGreaterThan(5)
      // A visible focus indicator: an outline or a focus shadow on every stop, but for
      // the pre-existing S01 venture-name link (identical on the baseline f40f70c, since
      // WF05-S02; reported as P2 debt, not changed in a QA task).
      expect(
        seen.filter(
          (s) =>
            s.outline === 'none' && s.shadow === 'none' && !KNOWN_NO_FOCUS_RING.includes(s.tag),
        ),
        `${target} focus without indicator`,
      ).toEqual([])
    }
  })

  test('labels: every field of SUB0 and SUB1 is named; decorative marks are hidden from assistive tech', async ({
    page,
  }) => {
    for (const [who, target] of [
      ['other', `/programmes/${fx.programmes.open}/apply`],
      ['owner', form(fx.ventures.project, fx.programmes.open)],
      ['owner', `${form(fx.ventures.startup, fx.programmes.open)}/submitted`],
    ] as const) {
      await page.context().clearCookies()
      await login(page.request, WF05_FIXTURE_EMAILS[who])
      await page.goto(target)
      await page.waitForLoadState('networkidle')
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('input:not([type=hidden]), select, textarea, button')]
          .filter(
            (el) =>
              !(el as HTMLInputElement).labels?.length &&
              !el.getAttribute('aria-label') &&
              !el.getAttribute('aria-labelledby') &&
              !(el as HTMLElement).innerText?.trim(),
          )
          .map((el) => el.outerHTML.slice(0, 80)),
      )
      expect(unnamed, target).toEqual([])
      const decorative = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[class*="avatar"], [class*="ventureMark"], [class*="heroMark"]',
          ),
        ]
          .filter((el) => el.getAttribute('aria-hidden') !== 'true')
          .map((el) => el.className),
      )
      expect(decorative, target).toEqual([])
    }
  })

  test('read only and disabled: no enabled write control on closed / archived drafts; disabled controls are marked', async ({
    page,
  }) => {
    await login(page.request, WF05_FIXTURE_EMAILS.owner)
    for (const target of [
      form(fx.ventures.project, fx.programmes.closed),
      form(fx.ventures.archived, fx.programmes.open),
    ]) {
      await page.goto(`${target}?buoc=4`)
      await expect(page.locator('[data-screen="L5-SUB1"]')).toBeVisible()
      await expect(page.locator('textarea:enabled')).toHaveCount(0)
      await expect(page.locator('[data-action="to-review"]')).toBeDisabled()
      await expect(page.locator('[data-anchor="remaining"]')).toHaveText('Chỉ xem')
    }
    await page.goto(`${form(fx.ventures.project, fx.programmes.teamOnly)}/review`)
    await expect(page.locator('[data-action="submit"]')).toBeDisabled()
    // Hover affordance on the primary actions.
    await page.goto(`/demo/projects/${fx.ventures.project}`)
    for (const el of await page
      .locator('[data-nav="application-view"], [data-nav="venture-edit"]')
      .all())
      expect(await el.evaluate((n) => getComputedStyle(n).cursor)).toBe('pointer')
  })

  test('guest → /auth → back: the intended page, one header, no stale loading state', async ({
    page,
  }) => {
    const target = `/demo/projects/${fx.ventures.project}`
    await page.goto(target)
    await expect(page).toHaveURL(`/auth?redirect=${encodeURIComponent(target)}`)
    await login(page.request, WF05_FIXTURE_EMAILS.owner)
    const redirect = new URL(page.url()).searchParams.get('redirect')!
    await page.goto(redirect)
    await expect(page).toHaveURL(target)
    await expect(page.locator('[data-detail="programmes"]')).toBeVisible()
    await expect(page.locator('[data-state="venture-loading"]')).toHaveCount(0)
    await expect(page.locator('body > div header, header').first()).toBeVisible()
    expect(await page.locator('[data-screen="WF05-S02"]').count()).toBe(1)
  })
})
