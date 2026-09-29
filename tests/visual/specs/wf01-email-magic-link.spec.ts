import { createHash } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'

/**
 * Real e-mail magic link with open sign-up (DEC-L1R-D1, which supersedes the
 * invite-only DEC-AUTH-EMAIL-D1; D2 … D4 still hold).
 *
 * The test server runs without a Resend key and with dev routes on, so the
 * e-mail lands in /dev/outbox, read here like an inbox; every sign-in opens the
 * link the e-mail carries. Cases A and C use addresses outside the reserved
 * test domain, so nothing but the open rule admits them.
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

test.describe('e-mail magic link, open sign-up', () => {
  test('A. an existing account with onboarding to do: e-mailed link → session → onboarding', async ({
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
    await expect(page).toHaveURL('/onboarding')
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

  test('C. a new address signs up: 202, no account until its link is used, then onboarding', async ({
    page,
    context,
  }) => {
    const email = `new-${stamp}@open-signup.vn`
    const accounts = () =>
      query<{ status: string }>(
        'SELECT status::text AS status FROM user_accounts WHERE email_normalized = $1',
        [email],
      )
    expect(
      await query('SELECT 1 FROM membership_bootstrap WHERE email_normalized = $1', [email]),
    ).toHaveLength(0)

    const res = await requestLink(page, email)
    expect(res.status()).toBe(202)
    const body = JSON.stringify(await res.json())
    // The answer is the same as for a known address and carries no token.
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(
      ['email_masked', 'expires_in_seconds', 'request_id', 'resend_after_seconds'].sort(),
    )
    await expect(page).toHaveURL('/auth/check-email')
    await expect(page.locator('.ui-notice[role="alert"]')).toHaveCount(0)
    // Asking for a link creates nothing: the account exists only once the address is verified.
    expect(await accounts()).toHaveLength(0)
    expect(await context.cookies()).toEqual([])

    const link = await inbox(page, email)
    expect(body).not.toContain(tokenOf(link))
    await page.goto(link)
    await expect(page).toHaveURL('/onboarding')
    expect(page.url()).not.toContain(tokenOf(link))
    expect(await accounts()).toEqual([{ status: 'ACTIVE' }])
    const cookie = (await context.cookies()).find((c) => c.httpOnly)
    expect(cookie?.secure && cookie.sameSite).toBeTruthy()
    expect(
      await query(
        `SELECT 1 FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
          WHERE a.email_normalized = $1`,
        [email],
      ),
    ).toHaveLength(0)
  })

  test('C2. a known and an unknown address get the same answer', async ({ page }) => {
    const known = await requestLink(page, 'member@example.test')
    const unknown = await requestLink(page, `never-seen-${stamp}@open-signup.vn`)
    expect([known.status(), unknown.status()]).toEqual([202, 202])
    const shape = async (res: typeof known) => {
      const json = (await res.json()) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, typeof v === 'number' ? v : typeof v]),
      )
    }
    expect(await shape(unknown)).toEqual(await shape(known))
  })

  test('C3. a malformed address is refused and nothing is sent', async ({ page }) => {
    for (const email of ['not-an-email', 'a@b', 'two@@signs.vn', ' ']) {
      const res = await page.request.post('/api/v1/auth/magic-link', { data: { email } })
      expect(res.status(), email).toBe(400)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'AUTH_EMAIL_INVALID',
      )
    }
    await page.goto('/auth', { waitUntil: 'networkidle' })
    await emailField(page).fill('not-an-email')
    await submit(page).click()
    await expect(page.getByText('Email chưa đúng định dạng.')).toBeVisible()
    await expect(page).toHaveURL('/auth')
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
