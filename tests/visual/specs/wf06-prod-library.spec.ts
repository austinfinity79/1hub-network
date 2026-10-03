import { expect, test, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { closePool, query } from '../../../src/lib/db/client'
import {
  addVisibleFounder,
  clearLibraryFixture,
  FX_EXCLUDED,
  FX_LISTED,
  FX_OWNERS,
  FX_PRIVATE,
  LIBRARY_FX,
  seedLibraryFixture,
  type LibraryFixture,
} from '../../../src/lib/library/testing'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * WF06-PROD-04 — `/library` on the Library APIs (API §25, DEC-W6P), on the built
 * server: the session decides the founder tab, filters / sort / pages are API
 * requests (ids, cursor), loading / error / retry / empty states, what is
 * rendered versus what the answer holds, the organization page bound, and a
 * targeted responsive and accessibility smoke. Data: the WF06 fixture.
 */

let fx: LibraryFixture
let memberToken = ''
let consoleErrors: string[] = []
let serverErrors: string[] = []
/** Set by a test that makes the browser see a failing answer on purpose. */
let injectedFailures = false

test.beforeAll(async () => {
  fx = await seedLibraryFixture()
  await addVisibleFounder('Minh')
  memberToken = (await createSession(fx.accounts.stranger)).token
})

test.afterAll(async () => {
  await clearLibraryFixture()
  await closePool()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  serverErrors = []
  injectedFailures = false
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => {
    if (r.status() >= 500 && !r.request().url().includes('/__injected')) serverErrors.push(r.url())
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  const errors = injectedFailures
    ? consoleErrors.filter((e) => !/Failed to load resource/.test(e))
    : consoleErrors
  expect(errors, 'browser console errors').toEqual([])
  if (!injectedFailures) expect(serverErrors, 'server 5xx').toEqual([])
})

const asMember = (page: Page, baseURL: string | undefined, token = memberToken) =>
  page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: token, url: baseURL! }])
const directory = (page: Page) => page.locator('[data-section="directory"]')
const cards = (page: Page) => page.locator('[data-anchor="grid"] > li')
const count = (page: Page) => page.locator('[data-section="directory"] [aria-live="polite"]')
const settled = (page: Page) => expect(directory(page)).not.toHaveAttribute('data-state', 'loading')
const openTab = (page: Page, name: RegExp) => page.getByRole('tab', { name }).click()
async function searchFor(page: Page, q: string) {
  const form = page.getByRole('search', { name: 'Tìm trong thư viện' })
  await form.getByRole('searchbox').fill(q)
  await form.getByRole('button', { name: 'Tìm kiếm' }).click()
}
const LISTED = FX_LISTED.length + 1 // + "WF06 Minh Startup"
const VISIBLE = ['WF06 Founder Hải', 'WF06 Founder Lan', 'WF06 Founder Minh']
const HIDDEN_PEOPLE = (['hidden', 'deactivated', 'blocked', 'privateOnly'] as const).map(
  (k) => FX_OWNERS[k].displayName!,
)

test.describe('WF06 Library on the API', () => {
  test('guest → member → sign-out: the founder tab follows the session, nothing stale', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/library')
    await openTab(page, /Nhà sáng lập/)
    await expect(page.locator('[data-anchor="sign-in"]')).toBeVisible()
    let html = await page.content()
    for (const name of [...VISIBLE, ...HIDDEN_PEOPLE]) expect(html).not.toContain(name)

    // A session of its own, so signing out here leaves the shared one alive.
    const own = (await createSession(fx.accounts.stranger)).token
    await asMember(page, baseURL, own)
    await page.reload()
    await openTab(page, /Nhà sáng lập/)
    await searchFor(page, 'WF06')
    await expect(cards(page).locator('h2')).toHaveText(VISIBLE)

    await page.goto('/')
    expect((await page.request.post('/api/v1/auth/logout')).status()).toBe(204)
    await page.goBack()
    await expect(page).toHaveURL(/\/library$/)
    await openTab(page, /Nhà sáng lập/)
    await expect(page.locator('[data-anchor="sign-in"]')).toBeVisible()
    html = await page.content()
    for (const name of VISIBLE) expect(html, name).not.toContain(name)
    // The founder API agrees: the revoked session is a guest.
    const answer = await (await page.request.get('/api/v1/library/founders?q=WF06')).json()
    expect(answer).toMatchObject({ items: [], restricted: true })
  })

  test('filters, sort and pages are API requests: vocabulary ids, a cursor, no duplicate card', async ({
    page,
  }) => {
    const requests: URL[] = []
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (url.pathname.startsWith('/api/v1/library/')) requests.push(url)
    })
    await page.goto(`/library?q=WF06`)
    await openTab(page, /^Startup/)
    await expect(count(page)).toHaveText(`${LISTED} startup`)
    await expect(cards(page)).toHaveCount(9)
    // The first page came with the page: no request yet.
    expect(requests).toEqual([])

    await page.getByRole('button', { name: `Xem thêm ${LISTED - 9} startup` }).click()
    await expect(cards(page)).toHaveCount(LISTED)
    const titles = await cards(page).locator('h2').allInnerTexts()
    expect(new Set(titles).size).toBe(LISTED)
    expect(titles).not.toEqual(expect.arrayContaining(FX_EXCLUDED.map((v) => v.name)))
    await expect(page.locator('[data-anchor="more"]')).toHaveCount(0)
    expect(requests.at(-1)!.searchParams.get('cursor')).toMatch(/^[A-Za-z0-9_-]+$/)

    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await facets.getByRole('checkbox', { name: /^Tăng trưởng/ }).check()
    await expect(count(page)).toHaveText('4 startup')
    expect(requests.at(-1)!.searchParams.getAll('stage_id')).toEqual([LIBRARY_FX.stage.GROWTH])
    await facets.getByRole('checkbox', { name: /^Giáo dục/ }).check()
    await expect(count(page)).toHaveText('1 startup')
    expect(requests.at(-1)!.searchParams.getAll('domain_id')).toEqual([LIBRARY_FX.domain.edtech])
    await expect(cards(page).locator('h2')).toHaveText(['WF06 Sao Mai'])

    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    await settled(page)
    await expect(page.getByRole('search').getByRole('searchbox')).toHaveValue('')
    await searchFor(page, 'WF06')
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('NAME')
    await expect(cards(page).first().locator('h2')).toHaveText('WF06 An Khang')
    expect(requests.at(-1)!.searchParams.get('sort')).toBe('NAME')
    // Only the page's own parameters were ever sent; no record id.
    for (const url of requests) {
      for (const key of url.searchParams.keys())
        expect(['q', 'domain_id', 'stage_id', 'sort', 'cursor', 'limit']).toContain(key)
      for (const id of [...Object.values(fx.ventures), ...Object.values(fx.owners)])
        expect(url.search).not.toContain(id)
    }
  })

  test('loading, error, retry and empty: controlled states, no raw answer, no blank', async ({
    page,
  }) => {
    injectedFailures = true
    await page.goto('/library?q=WF06')
    await openTab(page, /^Startup/)
    await expect(cards(page)).toHaveCount(9)

    // Loading: the grid stays, dimmed and busy, until the answer arrives.
    await page.route('**/api/v1/library/startups?*', async (route) => {
      await new Promise((r) => setTimeout(r, 700))
      await route.continue()
    })
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('NAME')
    await expect(directory(page)).toHaveAttribute('data-state', 'loading')
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(1)
    await expect(page.locator('[data-anchor="grid"]')).toHaveAttribute('data-loading', 'true')
    await expect(count(page)).toHaveText('Đang tải…')
    await settled(page)
    await expect(count(page)).toHaveText(`${LISTED} startup`)
    await page.unroute('**/api/v1/library/startups?*')

    // A failed answer: the error state with a retry; the envelope is never shown.
    await page.route('**/api/v1/library/startups?*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"X","message":"boom","request_id":"req_x"}}',
      }),
    )
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('STAGE')
    await expect(page.locator('[data-anchor="source-error"]')).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(/req_x|boom|"error"|\{/)
    await page.unroute('**/api/v1/library/startups?*')
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(cards(page)).toHaveCount(9)

    // A refused next page (e.g. a stale cursor): the cards stay, the button offers a retry.
    await page.route('**/api/v1/library/startups?*cursor=*', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: '{"error":{"code":"PROFILE_VALIDATION_FAILED","fields":{"cursor":"invalid"}}}',
      }),
    )
    await page.locator('[data-anchor="more"]').click()
    await expect(page.locator('[data-anchor="more"]')).toHaveText(/^Chưa tải được, thử lại/)
    await expect(cards(page)).toHaveCount(9)
    await page.unroute('**/api/v1/library/startups?*cursor=*')
    await page.locator('[data-anchor="more"]').click()
    await expect(cards(page)).toHaveCount(LISTED)

    // Empty.
    await searchFor(page, 'WF06 khongcogi')
    await expect(page.locator('[data-anchor="empty"]')).toContainText(
      'Không có startup nào khớp bộ lọc.',
    )
    await page.getByRole('button', { name: 'Xoá tất cả bộ lọc' }).click()
    await settled(page)
    await expect(cards(page).first()).toBeVisible()
  })

  test('privacy: the page renders a subset of the answer; no key, id or private field', async ({
    page,
    baseURL,
  }) => {
    await asMember(page, baseURL)
    const answers: unknown[] = []
    page.on('response', async (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/v1/library/')) answers.push(await r.json())
    })
    await page.goto('/library')
    for (const tab of [/^Startup/, /Nhà sáng lập/]) {
      await openTab(page, tab)
      await searchFor(page, 'WF06')
      await settled(page)
    }
    expect(answers.length).toBeGreaterThan(0)
    const keys = JSON.stringify(answers).match(/"key":"([0-9a-f]{16})"/g) ?? []
    expect(keys.length).toBeGreaterThan(0)
    // Visible text and every attribute of the rendered page (scripts excluded).
    const rendered = await page.evaluate(() => {
      const parts: string[] = [document.body.innerText]
      for (const el of document.body.querySelectorAll('*')) {
        if (el.tagName === 'SCRIPT') continue
        for (const a of el.attributes) parts.push(a.value)
      }
      return parts.join('\n')
    })
    for (const k of keys) expect(rendered).not.toContain(k.slice(7, 23))
    expect(rendered).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
    for (const value of Object.values(FX_PRIVATE)) expect(rendered).not.toContain(value)
    for (const name of HIDDEN_PEOPLE) expect(rendered).not.toContain(name)
    expect(rendered).not.toMatch(/@example|wf06-fx-|\/media\/assets\//)
    // The rendered founders are exactly the visible ones.
    await expect(cards(page).locator('h2')).toHaveText(VISIBLE)
  })

  test('cross-WF identity: cards show the canonical venture and profile records', async ({
    page,
    baseURL,
  }) => {
    await asMember(page, baseURL)
    const [venture] = await query<{ name: string; stage: string }>(
      `SELECT p.name, s.label AS stage FROM projects p JOIN vocabulary_items s ON s.id = p.stage_id WHERE p.id = $1`,
      [fx.ventures['WF06 Sao Mai']],
    )
    const [owner] = await query<{ display_name: string }>(
      `SELECT display_name FROM individual_profiles WHERE id = $1`,
      [fx.owners.hai],
    )
    await page.goto('/library')
    await openTab(page, /^Startup/)
    await searchFor(page, venture!.name)
    await expect(cards(page).locator('h2')).toHaveText([venture!.name])
    await expect(cards(page).first().locator('[class*="pcardStage"]')).toHaveText(venture!.stage)
    await openTab(page, /Nhà sáng lập/)
    await searchFor(page, owner!.display_name)
    await expect(cards(page).locator('h2')).toHaveText([owner!.display_name])
    await expect(cards(page).first().locator('[class*="pcardRowName"]')).toHaveText(venture!.name)
  })

  test('organization page: the children total and the first 200 by name', async ({ page }) => {
    const [parent] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CHAPTER', 'wf06-fx-org-parent', 'WF06 Cha', 'PUBLISHED') RETURNING id::text`,
    )
    const children = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status)
       SELECT 'CLB', 'wf06-fx-org-child-' || lpad(g::text, 3, '0'), 'WF06 Con ' || lpad(g::text, 3, '0'),
              CASE WHEN g = 202 THEN 'DRAFT' ELSE 'PUBLISHED' END::publication_status
         FROM generate_series(1, 202) g RETURNING id::text`,
    )
    await query(
      `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type)
       SELECT $1::uuid, unnest($2::uuid[]), 'PARENT'`,
      [parent!.id, children.map((c) => c.id)],
    )
    await page.goto('/organizations/wf06-fx-org-parent')
    await expect(page.locator('[data-stat="children"]')).toHaveText('201')
    await expect(page.locator('#truc-thuoc h2')).toHaveText(/^201 CLB trực thuộc WF06 Cha$/)
    await expect(page.locator('[data-child]')).toHaveCount(200)
    await expect(page.locator('[data-child]').first()).toContainText('WF06 Con 001')
    await expect(page.locator('[data-child="wf06-fx-org-child-202"]')).toHaveCount(0)
  })

  test('responsive smoke at 1440, 768 and 390: states fit, nothing overflows', async ({
    page,
    baseURL,
    browser,
  }) => {
    const report: Array<{ width: number; state: string; overflow: number }> = []
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
    await asMember(page, baseURL)
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/library?q=WF06')
      await openTab(page, /^Startup/)
      await expect(cards(page).first()).toBeVisible()
      await expect(page.locator('[data-anchor="more"]')).toBeVisible()
      report.push({ width, state: 'startup + more', overflow: await overflow() })
      await openTab(page, /Nhà sáng lập/)
      await expect(cards(page).first().locator('[class*="pcardSub"]')).toHaveText(/ · /)
      report.push({ width, state: 'founders', overflow: await overflow() })
      await searchFor(page, 'WF06 khongcogi')
      await expect(page.locator('[data-anchor="empty"]')).toBeVisible()
      report.push({ width, state: 'empty', overflow: await overflow() })
      if (width < 1024) {
        await page.getByRole('button', { name: /^Bộ lọc/ }).click()
        await expect(page.getByRole('complementary', { name: 'Bộ lọc' })).toBeVisible()
      }
    }
    const guest = await browser.newPage({ baseURL })
    for (const width of [1440, 768, 390]) {
      await guest.setViewportSize({ width, height: 900 })
      await guest.goto('/library')
      await guest.getByRole('tab', { name: /Nhà sáng lập/ }).click()
      await expect(guest.locator('[data-anchor="sign-in"]')).toBeVisible()
      const over = await guest.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      report.push({ width, state: 'guest sign-in', overflow: over })
    }
    await guest.close()
    writeJsonReport('WF06-PROD-04.responsive.json', { report })
    expect(report.filter((r) => r.overflow !== 0)).toEqual([])
  })

  test('accessibility smoke: names, keyboard, focus, live count', async ({ page }) => {
    await page.goto('/library?q=WF06')
    await openTab(page, /^Startup/)
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    for (const box of await facets.getByRole('checkbox').all()) {
      expect((await box.evaluate((el) => el.closest('label')?.textContent ?? '')).trim()).not.toBe(
        '',
      )
    }
    for (const button of await page.getByRole('button').all()) {
      if (!(await button.isVisible())) continue
      expect(
        (await button.innerText()).trim() || (await button.getAttribute('aria-label')),
      ).toBeTruthy()
    }
    await expect(count(page)).toHaveAttribute('aria-live', 'polite')
    // Keyboard: the tab list moves with the arrows; "Xem thêm" works from the keyboard.
    await page.getByRole('tab', { name: /^Startup/ }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /Nhà sáng lập/ })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: /^Startup/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const more = page.locator('[data-anchor="more"]')
    await more.focus()
    await expect(more).toBeFocused()
    const outline = await more.evaluate((el) => getComputedStyle(el).outlineStyle)
    await page.keyboard.press('Enter')
    await expect(cards(page)).toHaveCount(LISTED)
    writeJsonReport('WF06-PROD-04.a11y.json', { moreFocusOutline: outline })
  })

  test('external directory down (server started with an unreachable feed): canonical rows stay', async ({
    page,
  }) => {
    test.skip(!process.env.WF06_FEED_DOWN, 'run with the server feed URL unreachable')
    await page.goto('/library?q=WF06')
    await openTab(page, /^Startup/)
    await expect(count(page)).toHaveText(`${LISTED} startup`)
    await expect(page.locator('[data-anchor="source-error"]')).toHaveCount(0)
    await page.goto('/library')
    await openTab(page, /^Startup/)
    await expect(cards(page).first()).toBeVisible()
    const external = await page.locator('[data-anchor="grid"] a[target="_blank"]').count()
    expect(external, 'no external record while the feed is down').toBe(0)
  })
})
