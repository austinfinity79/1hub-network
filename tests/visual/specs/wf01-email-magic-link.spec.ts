import { createHash } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'

/**
 * TASK 22-PREVIEW-AUTH — real e-mail magic link, invite-only (DEC-AUTH-EMAIL-D1…D4).
 *
 * The test server runs without a Resend key and with dev routes on, so the
 * e-mail lands in /dev/outbox, read here like an inbox; every sign-in opens the
 * link the e-mail carries. Case A uses an account provisioned on a non-test
 * domain, so the invite-only rule (not the @example.test seam) admits it.
 */

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (400|403|409|410)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

const emailField = (page: Page) => page.getByLabel('Email', { exact: true })
const submit = (page: Page) => page.getByRole('button', { name: 'Gửi liên kết đăng nhập' })

async function requestLink(page: Page, email: string) {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await emailField(page).fill(email)
  const [res] = await Promise.all([
    page.waitForResponse('**/api/v1/auth/magic-link'),
    submit(page).click(),
  ])
  return res
}

async function inbox(page: Page, email: string): Promise<string> {
  const res = await page.request.get(`/dev/outbox?email=${encodeURIComponent(email)}`)
  expect(res.status(), `an e-mail for ${email}`).toBe(200)
  return ((await res.json()) as { link: string }).link
}

const tokenOf = (link: string) => new URL(link).searchParams.get('token')!
const hash = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')

test.describe('TASK 22-PREVIEW-AUTH e-mail magic link', () => {
  test('A. a provisioned account with onboarding to do: e-mailed link → session → onboarding', async ({
    page,
    context,
  }) => {
    const email = `alpha-a-${stamp}@alpha-provisioned.test`
    await query(
      `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE')`,
      [email],
    )
    const res = await requestLink(page, email)
    expect(res.status()).toBe(202)
    await expect(page).toHaveURL('/auth/check-email')
    const link = await inbox(page, email)
    expect(new URL(link).pathname).toBe('/auth/callback')
    expect(tokenOf(link)).toMatch(/^[A-Za-z0-9_-]{20,}$/)
    await page.goto(link)
    await expect(page).toHaveURL('/onboarding/purpose')
    expect(page.url()).not.toContain(tokenOf(link))
    const cookie = (await context.cookies()).find((c) => c.httpOnly)
    expect(cookie?.secure && cookie.sameSite).toBeTruthy()
    const accounts = await query('SELECT 1 FROM user_accounts WHERE email_normalized = $1', [email])
    expect(accounts).toHaveLength(1)
  })

  test('B. an onboarded member: e-mailed link → session → /me', async ({ page }) => {
    const res = await requestLink(page, 'member@example.test')
    expect(res.status()).toBe(202)
    await page.goto(await inbox(page, 'member@example.test'))
    await expect(page).toHaveURL('/me')
  })

  test('C. an unknown address: neutral notice, no link, no token row, no account', async ({
    page,
  }) => {
    const email = `stranger-${stamp}@not-provisioned.vn`
    const res = await requestLink(page, email)
    expect(res.status()).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'AUTH_ACCOUNT_NOT_PROVISIONED',
    )
    await expect(page.locator('.ui-notice[role="alert"]')).toContainText(
      'Email này chưa được cấp quyền truy cập Internal Alpha.',
    )
    await expect(page).toHaveURL('/auth')
    expect(
      await query('SELECT 1 FROM user_accounts WHERE email_normalized = $1', [email]),
    ).toHaveLength(0)
    expect(
      await query('SELECT 1 FROM auth_magic_link_requests WHERE email_normalized = $1', [email]),
    ).toHaveLength(0)
    const outbox = await page.request.get(`/dev/outbox?email=${encodeURIComponent(email)}`)
    expect(outbox.status()).toBe(404)
  })

  test('D. the e-mailed link works once; reopening it is refused', async ({ page, browser }) => {
    await requestLink(page, 'member@example.test')
    const link = await inbox(page, 'member@example.test')
    await page.goto(link)
    await expect(page).toHaveURL('/me')
    const other = await browser.newContext()
    const again = await other.newPage()
    await again.goto(link)
    await expect(again).toHaveURL('/auth/callback?status=used')
    await expect(again.getByRole('heading', { level: 1 })).toHaveText('Liên kết không còn hiệu lực')
    await other.close()
  })

  test('E. an expired e-mailed link and a malformed token are refused', async ({ page }) => {
    await requestLink(page, 'member@example.test')
    const link = await inbox(page, 'member@example.test')
    await query(
      `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 minute' WHERE token_hash = $1`,
      [hash(tokenOf(link))],
    )
    await page.goto(link)
    await expect(page).toHaveURL('/auth/callback?status=expired')
    await page.goto('/auth/callback?token=not-a-real-token')
    await expect(page).toHaveURL('/auth/error')
  })
})
