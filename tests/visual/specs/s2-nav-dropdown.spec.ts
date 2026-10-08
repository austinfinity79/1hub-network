import { expect, test, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { query } from '../../../src/lib/db/client'
import { loadAboutNetwork } from '../../../src/lib/public/about-network'

/**
 * S2-NAV-DROPDOWN-V2-01 — Feedback Sprint 2 lần 3, NAV-DD-01 → 16: the two
 * menus (Giới thiệu, Chương trình) of nav N1, their 11 entries, timing,
 * single-open, keyboard, anchors, same-page scroll, ☰ groups, analytics, and
 * no menu on N0 / N2.
 */

const header = (page: Page) => page.locator('header[data-shell="public"]')
const nav = (page: Page) => header(page).getByRole('navigation', { name: 'Điều hướng chính' })
const trigger = (page: Page, label: string) =>
  nav(page).getByRole('button', { name: `Mở menu ${label}` })
const menu = (page: Page, name: string) => page.locator(`[data-menu="${name}"]`)

async function recordEvents(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __nav: unknown[]; __navOn?: boolean }
    w.__nav = []
    if (w.__navOn) return
    w.__navOn = true
    window.addEventListener('hub:analytics', (e) => w.__nav.push((e as CustomEvent).detail))
  })
}
const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __nav: Array<Record<string, string>> }).__nav)

let errors: string[] = []
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
})
test.afterEach(() => expect(errors).toEqual([]))

test('top level: two menu triggers, three direct entries; a trigger never navigates', async ({
  page,
}) => {
  await page.goto('/products', { waitUntil: 'networkidle' })
  for (const [name, label] of [
    ['about', 'Giới thiệu'],
    ['programmes', 'Chương trình'],
  ] as const) {
    const t = trigger(page, label)
    await expect(t).toHaveAttribute('aria-expanded', 'false')
    await expect(nav(page).locator(`[data-nav="${name}"] > a`)).toHaveCount(0)
    await t.click()
    await expect(t).toHaveAttribute('aria-expanded', 'true')
    await expect(menu(page, name)).toBeVisible()
    await expect(page).toHaveURL('/products')
    await t.click()
    await expect(menu(page, name)).toHaveCount(0)
  }
  await expect(nav(page).locator('[data-nav="products"] a')).toHaveAttribute('href', '/products')
  await expect(nav(page).locator('[data-nav="talents"] a')).toHaveAttribute('href', '/talents')
  // Tin tức: a direct entry; no screen yet, so a plain label (no menu, no dead link).
  await expect(
    nav(page).locator('[data-nav="news"] button, [data-nav="news"] [data-menu]'),
  ).toHaveCount(0)
  for (const n of ['products', 'talents', 'news'])
    await expect(nav(page).locator(`[data-nav="${n}"] button`)).toHaveCount(0)
})

test('the 11 entries: kinds, destinations, iHUB Incubator hidden, "Hơn {n} CLB" from the real count', async ({
  page,
}) => {
  const { clubCount } = await loadAboutNetwork()
  await page.goto('/', { waitUntil: 'networkidle' })
  await trigger(page, 'Giới thiệu').click()
  const about = menu(page, 'about')
  expect(
    await about
      .locator('[data-nav-item]')
      .evaluateAll((n) => n.map((x) => x.getAttribute('data-nav-item'))),
  ).toEqual(['G.02a', 'G.02b', 'G.02c', 'G.02d', 'G.02e', 'G.02g', 'G.02i', 'G.02j'])
  await expect(about).not.toContainText('iHUB Incubator')
  await expect(about.locator('[data-nav-item="G.02a"]')).toHaveAttribute('href', '/about')
  await expect(about.locator('[data-nav-item="G.02b"]')).toHaveAttribute('href', '/about#ban-do')
  await expect(about.locator('[data-nav-item="G.02c"]')).toHaveAttribute(
    'href',
    '/about#humans-of-hub',
  )
  for (const code of ['G.02d', 'G.02j']) {
    const row = about.locator(`[data-nav-item="${code}"]`)
    await expect(row).toHaveAttribute('aria-disabled', 'true')
    await expect(row).not.toHaveAttribute('href')
  }
  const clubs = about.locator('[data-nav-item="G.02d"]')
  if (clubCount >= 10)
    await expect(clubs).toContainText(`Hơn ${Math.floor(clubCount / 10) * 10} CLB trong mạng lưới`)
  for (const code of ['G.02e', 'G.02g', 'G.02i']) {
    const a = about.locator(`[data-nav-item="${code}"]`)
    await expect(a).toHaveAttribute('target', '_blank')
    await expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(a).toHaveAttribute('href', /^https:\/\//)
    await expect(a).toContainText('(mở tab mới)')
  }
  // VI only: no English copy next to the Vietnamese.
  for (const en of ['About HUB Network', 'Regional HUBs map', 'Clubs', 'Portfolio', 'Ecosystem'])
    await expect(about).not.toContainText(en)
  await trigger(page, 'Chương trình').click()
  await expect(about).toHaveCount(0)
  const prog = menu(page, 'programmes')
  await expect(prog.locator('[data-nav-item="G.03a"]')).toHaveAttribute('href', '/programmes')
  await expect(prog.locator('[data-nav-item="G.03b"]')).toHaveAttribute('href', '/events')
})

test('pointer: opens after ~150 ms, closes ~250 ms after leaving, no flicker trigger → menu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.clock.install()
  await page.goto('/', { waitUntil: 'networkidle' })
  await recordEvents(page)
  await trigger(page, 'Giới thiệu').hover()
  await page.clock.runFor(120)
  await expect(menu(page, 'about')).toHaveCount(0)
  await page.clock.runFor(60)
  await expect(menu(page, 'about')).toBeVisible()
  // A click right after the hover keeps it open (no open → close flash).
  await trigger(page, 'Giới thiệu').click()
  await expect(menu(page, 'about')).toBeVisible()
  // Down into the menu: it stays.
  await menu(page, 'about').locator('[data-nav-item="G.02c"]').hover()
  await page.clock.runFor(600)
  await expect(menu(page, 'about')).toBeVisible()
  // Over the other trigger: it takes over (one menu at a time).
  await trigger(page, 'Chương trình').hover()
  await page.clock.runFor(400)
  await expect(menu(page, 'programmes')).toBeVisible()
  await expect(menu(page, 'about')).toHaveCount(0)
  // Leave: still open at 200 ms, closed after 250 ms.
  await page.mouse.move(700, 600)
  await page.clock.runFor(200)
  await expect(menu(page, 'programmes')).toBeVisible()
  await page.clock.runFor(80)
  await expect(menu(page, 'programmes')).toHaveCount(0)
  const opened = (await events(page)).filter((e) => e.name === 'nav_menu_open')
  expect(opened.map((e) => [e.menu, e.via])).toEqual([
    ['about', 'hover'],
    ['programmes', 'hover'],
  ])
})

test('keyboard: Enter / Space toggle, ArrowDown enters, Tab walks out and closes, Escape returns focus', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const t = trigger(page, 'Giới thiệu')
  await t.focus()
  await page.keyboard.press('Enter')
  await expect(t).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Space')
  await expect(t).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('ArrowDown')
  await expect(menu(page, 'about').locator('[data-nav-item="G.02a"]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu(page, 'about').locator('[data-nav-item="G.02b"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu(page, 'about')).toHaveCount(0)
  await expect(t).toBeFocused()
  // Tab out of the last entry closes it; focus goes on to Chương trình.
  await page.keyboard.press('Enter')
  const last = menu(page, 'about').locator('a[data-nav-item]').last()
  await last.focus()
  await page.keyboard.press('Tab')
  await expect(menu(page, 'about')).toHaveCount(0)
  await expect(trigger(page, 'Chương trình')).toBeFocused()
  // Outside click closes.
  await page.keyboard.press('Enter')
  await expect(menu(page, 'programmes')).toBeVisible()
  await page.mouse.click(5, 880)
  await expect(menu(page, 'programmes')).toHaveCount(0)
})

test('anchors: #ban-do from another page; #humans-of-hub and the top on /about without a reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await recordEvents(page)
  await trigger(page, 'Giới thiệu').click()
  await menu(page, 'about').locator('[data-nav-item="G.02b"]').click()
  await expect(page).toHaveURL('/about#ban-do')
  await expect(page.locator('#ban-do')).toBeInViewport()
  // Same page now: mark the document, then move within it.
  await page.evaluate(() => ((window as unknown as { __same: number }).__same = 1))
  await recordEvents(page)
  await trigger(page, 'Giới thiệu').click()
  await menu(page, 'about').locator('[data-nav-item="G.02c"]').click()
  await expect(page).toHaveURL('/about#humans-of-hub')
  await expect(page.locator('#humans-of-hub')).toBeInViewport()
  await trigger(page, 'Giới thiệu').click()
  await menu(page, 'about').locator('[data-nav-item="G.02a"]').click()
  await expect(page).toHaveURL('/about')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5)
  expect(await page.evaluate(() => (window as unknown as { __same?: number }).__same)).toBe(1)
  const picked = (await events(page)).filter((e) => e.name === 'nav_menu_select')
  expect(picked.map((e) => [e.menu, e.item, e.type, e.href])).toEqual([
    ['about', 'G.02c', 'anchor', '/about#humans-of-hub'],
    ['about', 'G.02a', 'page', '/about'],
  ])
})

test('390: the menus are expandable groups of the ☰ panel, one open at a time; no overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await header(page).getByRole('button', { name: 'Mở menu', exact: true }).click()
  await trigger(page, 'Giới thiệu').click()
  await expect(menu(page, 'about')).toBeVisible()
  await trigger(page, 'Chương trình').click()
  await expect(menu(page, 'about')).toHaveCount(0)
  await expect(menu(page, 'programmes')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await menu(page, 'programmes').locator('[data-nav-item="G.03b"]').click()
  await expect(page).toHaveURL('/events')
  await expect(header(page).getByRole('button', { name: 'Mở menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('N0 (/auth) and N2 (/onboarding) have no menu', async ({ page, baseURL }) => {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await expect(page.locator('header[data-shell="public"], [data-menu]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /^Mở menu (Giới thiệu|Chương trình)$/ }),
  ).toHaveCount(0)
  const account = '5e000000-0000-4000-8000-0000000000a1'
  await query(`DELETE FROM user_sessions WHERE account_id = $1`, [account])
  await query(`DELETE FROM user_accounts WHERE id = $1`, [account])
  await query(
    `INSERT INTO user_accounts (id, email, email_normalized, status)
     VALUES ($1, 'nav-n2@example.test', 'nav-n2@example.test', 'ACTIVE')`,
    [account],
  )
  try {
    const { token } = await createSession(account)
    await page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: token, url: baseURL! }])
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-shell="onboarding"]')).toHaveCount(1)
    await expect(page.locator('header[data-shell="public"], [data-menu]')).toHaveCount(0)
  } finally {
    await query(`DELETE FROM user_sessions WHERE account_id = $1`, [account])
    await query(`DELETE FROM individual_profiles WHERE account_id = $1`, [account])
    await query(`DELETE FROM user_accounts WHERE id = $1`, [account])
  }
})
