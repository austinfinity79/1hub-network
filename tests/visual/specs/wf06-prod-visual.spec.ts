import { expect, test, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { closePool, query } from '../../../src/lib/db/client'
import {
  addVisibleFounder,
  clearLibraryFixture,
  FX_OWNERS,
  seedLibraryFixture,
} from '../../../src/lib/library/testing'
import { resolveOutputPath } from '../pixel-qa/paths'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * WF06-PROD-06 — responsive / visual closure of the WF06 P0 surfaces (no
 * redesign): every Library and organization-page state at 1440 / 1024 / 768 /
 * 430 / 390 / 320 (DPR 1), each captured as evidence and measured for
 * horizontal overflow, controls outside the viewport, clipped text, overlapping
 * controls, card layout, the founder label and state blocks; the guest →
 * member → guest transition; URL state; a focus / contrast smoke. The 1440
 * pixel comparison against L15 / L15b / L15c stays in `public-library`.
 */

const WIDTHS = [1440, 1024, 768, 430, 390, 320] as const
/**
 * Pre-existing, measured the same on the pre-WF06 build (`5199e07`): at 320 px the
 * Library tab bar (L15, CSS unchanged by WF06) is wider than the viewport, so the tab at
 * either end lies partly outside it. KNOWN_BASELINE_DEBT, pinned to the tab bar only:
 * any other control outside the viewport fails.
 */
const KNOWN_OFFSCREEN: Partial<Record<number, string[]>> = { 320: ['tab:'] }
const LONG = `WF06 Dài ${'Đổi mới sáng tạo vùng 🚀 '.repeat(6)}`.trim()

let member = ''
let consoleErrors: string[] = []
let serverErrors: string[] = []
let injected = false
const results: Array<Record<string, unknown>> = []

test.beforeAll(async () => {
  const fx = await seedLibraryFixture()
  await addVisibleFounder('Minh')
  await addVisibleFounder('Quân')
  await query(
    `INSERT INTO projects (type, owner_profile_id, slug, name, summary, status, visibility)
     VALUES ('STARTUP', $1, 'wf06-fx-visual-long', $2, $3, 'ACTIVE', 'PUBLIC')`,
    [
      fx.owners.lan,
      LONG,
      `${'Mô tả rất dài không có dấu cách '.repeat(4)}Supercalifragilisticexpialidocious`,
    ],
  )
  member = (await createSession(fx.accounts.stranger)).token
})

test.afterAll(async () => {
  writeJsonReport('WF06-PROD-06.responsive.json', { states: results.length, results })
  await clearLibraryFixture()
  await closePool()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  serverErrors = []
  injected = false
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => {
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`)
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  const errors = injected
    ? consoleErrors.filter((e) => !/Failed to load resource/.test(e))
    : consoleErrors
  expect(errors, 'console errors').toEqual([])
  if (!injected) expect(serverErrors, 'unexpected 5xx').toEqual([])
})

const asMember = (page: Page, baseURL: string | undefined) =>
  page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: member, url: baseURL! }])
const cards = (page: Page) => page.locator('[data-anchor="grid"] > li')
const settled = (page: Page) =>
  expect(page.locator('[data-section="directory"]')).not.toHaveAttribute('data-state', 'loading')
async function searchFor(page: Page, q: string) {
  const form = page.getByRole('search', { name: 'Tìm trong thư viện' })
  await form.getByRole('searchbox').fill(q)
  await form.getByRole('button', { name: 'Tìm kiếm' }).click()
}
const tab = (page: Page, name: RegExp) => page.getByRole('tab', { name }).click()
async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: /^Bộ lọc/ })
  if (await toggle.isVisible()) await toggle.click()
}

/** Layout measurements of the current page (main content; the browser's own UI excluded). */
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    }
    const label = (el: Element) =>
      `${el.getAttribute('role') === 'tab' ? 'tab' : el.tagName.toLowerCase()}${el.getAttribute('data-anchor') ? `[${el.getAttribute('data-anchor')}]` : ''}:${(el.textContent ?? '').trim().slice(0, 30)}`
    const controls = [
      ...document.querySelectorAll(
        'main a, main button, main input, main select, [data-screen] a, [data-screen] button, [data-screen] input, [data-screen] select',
      ),
    ].filter(visible)
    const offscreen = controls
      .filter((el) => {
        const r = el.getBoundingClientRect()
        // A native select is drawn by its visible label wrapper; skip zero-opacity overlays.
        if (getComputedStyle(el).opacity === '0') return false
        return r.left < -1 || r.right > vw + 1
      })
      .map(label)
    const cut = [
      ...document.querySelectorAll(
        '[data-screen] h1, [data-screen] h2, [data-screen] h3, [data-screen] p, [data-screen] button, [data-screen] a, [data-screen] label, [data-screen] dd, [data-screen] dt',
      ),
    ]
      .filter(visible)
      .filter((el) => {
        const s = getComputedStyle(el)
        const clips = ['hidden', 'clip'].includes(s.overflowX)
        // Screen-reader-only text (the live count) is clipped on purpose.
        const srOnly = s.clipPath !== 'none' || el.getBoundingClientRect().width <= 1
        return (
          clips && !srOnly && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1
        )
      })
      .map(label)
    const free = controls.filter(
      (el) => !el.closest('[data-anchor="grid"] > li') && getComputedStyle(el).opacity !== '0',
    )
    const overlaps: string[] = []
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i]!
        const b = free[j]!
        if (a.contains(b) || b.contains(a)) continue
        const r = a.getBoundingClientRect()
        const q = b.getBoundingClientRect()
        const w = Math.min(r.right, q.right) - Math.max(r.left, q.left)
        const h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top)
        if (w > 2 && h > 2) overlaps.push(`${label(a)} × ${label(b)}`)
      }
    const cardBoxes = [...document.querySelectorAll('[data-anchor="grid"] > li')].map((c) =>
      c.getBoundingClientRect(),
    )
    const cardOverlap = cardBoxes.some((r, i) =>
      cardBoxes.some(
        (q, j) =>
          j > i &&
          Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 &&
          Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1,
      ),
    )
    const subs = [...document.querySelectorAll('[class*="pcardSub"]')].filter(
      (el) =>
        getComputedStyle(el).textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1,
    ).length
    const blocks = [
      ...document.querySelectorAll(
        '[data-anchor="empty"], [data-anchor="source-error"], [data-anchor="sign-in"], [data-anchor="loading"]',
      ),
    ]
      .filter(visible)
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.left < -1 || r.right > vw + 1
      }).length
    return {
      overflow: document.documentElement.scrollWidth - vw,
      offscreen,
      cut,
      overlaps,
      cardWidths: [...new Set(cardBoxes.map((r) => Math.round(r.width)))],
      cardOverlap,
      founderLabelClipped: subs,
      blocksOutside: blocks,
    }
  })
}

/** Evidence file name: `WF06-PROD-06.<width>.<state>.png`. */
const shot = (width: number, state: string) =>
  `WF06-PROD-06.${width}.${state.replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/, '')}.png`

async function capture(page: Page, width: number, state: string, full = false) {
  const m = await measure(page)
  const file = resolveOutputPath('actual', shot(width, state))
  await page.screenshot({ path: file, fullPage: full })
  results.push({ width, state, ...m })
  expect(m.overflow, `${width} ${state} overflow`).toBe(0)
  const known = KNOWN_OFFSCREEN[width] ?? []
  expect(
    m.offscreen.filter((c) => !known.some((k) => c.startsWith(k))),
    `${width} ${state} controls outside the viewport`,
  ).toEqual([])
  expect(m.cut, `${width} ${state} clipped text`).toEqual([])
  expect(m.overlaps, `${width} ${state} overlapping controls`).toEqual([])
  expect(m.cardWidths.length, `${width} ${state} card widths`).toBeLessThanOrEqual(1)
  expect(m.cardOverlap, `${width} ${state} cards overlap`).toBe(false)
  expect(m.founderLabelClipped, `${width} ${state} founder label`).toBe(0)
  expect(m.blocksOutside, `${width} ${state} state block`).toBe(0)
}

for (const width of WIDTHS) {
  test(`${width}: every Library and organization state fits`, async ({ page, baseURL }) => {
    injected = true
    await page.setViewportSize({ width, height: 900 })
    // Guest: Bài toán default and filtered; Startup default; founder sign-in state.
    await page.goto('/library')
    await capture(page, width, 'library-guest-default', true)
    await openFilters(page)
    await page
      .getByRole('complementary', { name: 'Bộ lọc' })
      .getByRole('checkbox', { name: /^Logistics/ })
      .check()
    await settled(page)
    await capture(page, width, 'library-problems-filtered')
    await page.goto('/library')
    await tab(page, /^Startup/)
    await expect(cards(page).first()).toBeVisible()
    await capture(page, width, 'library-startup-default (canonical + external)')
    await tab(page, /Nhà sáng lập/)
    await expect(page.locator('[data-anchor="sign-in"]')).toBeVisible()
    await capture(page, width, 'library-founder-guest (hidden: sign-in)')

    // Member: canonical startups with a long Unicode title, page 2, founders.
    await asMember(page, baseURL)
    await page.goto('/library?q=WF06')
    await tab(page, /^Startup/)
    await expect(cards(page)).toHaveCount(9)
    await capture(page, width, 'library-startup-canonical')
    await page.locator('[data-anchor="more"]').click()
    await expect(cards(page)).not.toHaveCount(9)
    await expect(cards(page).filter({ hasText: 'WF06 Dài' })).toHaveCount(1)
    await capture(page, width, 'library-startup-page2-long-title', true)
    await tab(page, /Nhà sáng lập/)
    await expect(cards(page).first()).toBeVisible()
    await capture(page, width, 'library-founder-member (visible)')

    // Loading, error + retry, refused next page, empty.
    await tab(page, /^Startup/)
    await page.route('**/api/v1/library/startups?*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500))
      await route.continue()
    })
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('NAME')
    await expect(page.locator('[data-section="directory"]')).toHaveAttribute(
      'data-state',
      'loading',
    )
    await capture(page, width, 'library-loading')
    await settled(page)
    await page.unroute('**/api/v1/library/startups?*')
    await page.route('**/api/v1/library/startups?*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"X"}}',
      }),
    )
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('STAGE')
    await expect(page.locator('[data-anchor="source-error"]')).toBeVisible()
    await capture(page, width, 'library-error')
    await page.unroute('**/api/v1/library/startups?*')
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(cards(page)).toHaveCount(9)
    await capture(page, width, 'library-retried')
    await page.route('**/api/v1/library/startups?*cursor=*', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: '{"error":{"code":"PROFILE_VALIDATION_FAILED"}}',
      }),
    )
    await page.locator('[data-anchor="more"]').click()
    await expect(page.locator('[data-anchor="more"]')).toHaveText(/^Chưa tải được, thử lại/)
    await page.locator('[data-anchor="more"]').scrollIntoViewIfNeeded()
    await capture(page, width, 'library-invalid-cursor (refused next page)')
    await page.unroute('**/api/v1/library/startups?*cursor=*')
    await searchFor(page, 'WF06 khongcogi')
    await expect(page.locator('[data-anchor="empty"]')).toBeVisible()
    await capture(page, width, 'library-empty')

    // Organization page: children grid, no-children state, hidden (404) state.
    await page.goto('/organizations/chapter-01')
    await capture(page, width, 'organization-chapter-children', true)
    await page.goto('/organizations/wf06-fx-org-published')
    await expect(page.locator('[data-state="no-children"]')).toBeVisible()
    await capture(page, width, 'organization-no-children')
    const hidden = await page.goto('/organizations/wf06-fx-org-draft')
    expect(hidden!.status()).toBe(404)
    expect(await page.locator('body').innerText()).not.toContain('WF06 wf06-fx-org-draft')
    results.push({ width, state: 'organization-draft (404)', status: 404 })
  })
}

test('guest → login → member → logout → guest: identity, no stale UI, no layout jump', async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.context().clearCookies()
    await page.setViewportSize({ width, height: 900 })
    const states: Array<{ step: string; tabsTop: number; names: string[] }> = []
    const step = async (name: string) => {
      await page.goto('/library?q=WF06')
      await tab(page, /Nhà sáng lập/)
      await settled(page)
      const tabsTop = await page
        .locator('[data-anchor="tabs"]')
        .evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY))
      const names = await cards(page).locator('h2').allInnerTexts()
      expect(new Set(names).size, name).toBe(names.length)
      await page.screenshot({
        path: resolveOutputPath('actual', shot(width, `transition-${name}`)),
      })
      states.push({ step: name, tabsTop, names })
    }
    await step('guest')
    const email = `wf06-vis-${width}-${Date.now().toString(36)}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await step('member')
    expect((await page.request.post('/api/v1/auth/logout')).status()).toBe(204)
    await step('guest-again')
    expect(states[0]!.names).toEqual([])
    expect(states[1]!.names).toEqual([
      'WF06 Founder Hải',
      'WF06 Founder Lan',
      'WF06 Founder Minh',
      'WF06 Founder Quân',
    ])
    expect(states[2]!.names).toEqual([])
    expect(new Set(states.map((s) => s.tabsTop)).size, `${width} tab bar position`).toBe(1)
    for (const owner of Object.values(FX_OWNERS))
      if (owner.displayName) expect(await page.content()).not.toContain(owner.displayName)
    results.push({ width, state: 'transition', states })
  }
})

test('URL state: refresh, copied link, homepage search, back and forward', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/library?q=WF06')
  await tab(page, /^Startup/)
  const first = await cards(page).locator('h2').allInnerTexts()
  await page.reload()
  await tab(page, /^Startup/)
  await expect(page.getByRole('searchbox')).toHaveValue('WF06')
  await expect(cards(page).locator('h2')).toHaveText(first)
  const other = await browser.newPage({ baseURL })
  await other.goto('/library?q=WF06')
  await other.getByRole('tab', { name: /^Startup/ }).click()
  await expect(other.locator('[data-anchor="grid"] > li h2')).toHaveText(first)
  await other.close()
  await page.goto('/', { waitUntil: 'networkidle' })
  // DM01 homepage (DEMO-HOME-ABOUT-01): the hero search, scope "Tất cả", opens the Library.
  const hero = page.locator('[data-search="hero"]')
  await hero.getByRole('searchbox').fill('WF06')
  await hero.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL('/library?q=WF06')
  await page.goBack()
  await expect(page).toHaveURL('/')
  await page.goForward()
  await expect(page).toHaveURL('/library?q=WF06')
  await expect(page.getByRole('searchbox')).toHaveValue('WF06')
  // Filters, sort and pages are page state, not URL state (unchanged): a refresh starts at page 1.
  await tab(page, /^Startup/)
  await page.locator('[data-anchor="more"]').click()
  await expect(cards(page)).not.toHaveCount(9)
  await page.reload()
  await tab(page, /^Startup/)
  await expect(cards(page)).toHaveCount(9)
  results.push({
    state: 'url',
    keyword: 'kept on refresh, copy, back / forward',
    page: 'resets to 1 on refresh',
  })
})

test('focus and contrast smoke', async ({ page }) => {
  injected = true
  await page.goto('/library')
  const focusStyle = async (locator: ReturnType<Page['locator']>) => {
    await locator.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    return locator.evaluate((el) => {
      const s = getComputedStyle(el)
      return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow }
    })
  }
  const focus: Record<string, unknown> = {}
  focus.search = await focusStyle(page.getByRole('searchbox'))
  focus.tab = await focusStyle(page.getByRole('tab', { selected: true }))
  focus.more = await focusStyle(page.locator('[data-anchor="more"]'))
  await page.getByRole('tab', { name: /Nhà sáng lập/ }).click()
  focus.signIn = await focusStyle(page.locator('[data-anchor="sign-in"] a'))
  for (const [name, f] of Object.entries(focus)) {
    const v = f as { outline: string; shadow: string }
    expect(v.outline !== 'none' || v.shadow !== 'none', `${name} focus visible`).toBe(true)
  }
  const ratio = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
        const lum = ([r, g, b]: number[]) =>
          [r!, g!, b!]
            .map((v) => {
              const c = v / 255
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
            })
            .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i]!, 0)
        let node: Element | null = el
        let bg = 'rgba(0, 0, 0, 0)'
        while (node && /rgba\(.*, 0\)|transparent/.test(bg)) {
          bg = getComputedStyle(node).backgroundColor
          node = node.parentElement
        }
        if (/rgba\(.*, 0\)|transparent/.test(bg)) bg = 'rgb(255, 255, 255)'
        const a = lum(rgb(getComputedStyle(el).color))
        const b = lum(rgb(bg))
        return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100
      })
  const contrast: Record<string, number> = {
    signInTitle: await ratio('[data-anchor="sign-in"] p:first-child'),
    signInText: await ratio('[data-anchor="sign-in"] p:nth-child(2)'),
    signInLink: await ratio('[data-anchor="sign-in"] a'),
  }
  await page.getByRole('tab', { name: /^Startup/ }).click()
  await page.route('**/api/v1/library/startups?*', (route) =>
    route.fulfill({ status: 500, body: '{}' }),
  )
  await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('NAME')
  await expect(page.locator('[data-anchor="source-error"]')).toBeVisible()
  contrast.errorText = await ratio('[data-anchor="source-error"] p:nth-child(2)')
  contrast.retry = await ratio('[data-anchor="source-error"] button')
  // The muted token (#8e7677 on white, Library since 28/09, unchanged by WF06) is below AA
  // for 14 px text wherever it is used: KNOWN_BASELINE_DEBT. Texts in that token keep exactly
  // its ratio (no regression); every other text of the states reaches AA.
  const mutedTexts = ['signInText', 'errorText']
  for (const [name, value] of Object.entries(contrast)) {
    if (mutedTexts.includes(name)) expect(value, name).toBe(3.65)
    else expect(value, name).toBeGreaterThanOrEqual(4.5)
  }
  results.push({ state: 'a11y', focus, contrast, mutedToken: '#8e7677 on #ffffff = 3.65' })
})
