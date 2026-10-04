import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { TEST_PASSWORD, logInThroughUi, signUpThroughUi, usernameFor } from '../support/auth'
import { onboardThroughUi } from '../support/onboarding'

/**
 * S1-UAT-01 — the Sprint1 auth flows end to end in the browser (task sections
 * 8, 11, 12, 13, 20, 21): forgot → e-mail → reset (US-01.04), the new-account
 * journey to /me with Legal v1.0 (US-01.02 → US-01.12), session fixation,
 * logout + Back, and the WF01-S11 screen at 1440 / 768 / 390.
 */

let consoleErrors: string[] = []
const created: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (400|401|409|422|429)/.test(m.text())) {
      consoleErrors.push(m.text())
    }
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  if (created.length > 0) {
    const ids = `SELECT id FROM user_accounts WHERE email_normalized = ANY($1::text[])`
    await query(`DELETE FROM audit_events WHERE actor_account_id IN (${ids})`, [created])
    await query(`DELETE FROM analytics_events WHERE account_id IN (${ids})`, [created])
    await query(`DELETE FROM consent_records WHERE account_id IN (${ids})`, [created])
    await query(
      `DELETE FROM community_memberships WHERE profile_id IN
         (SELECT p.id FROM individual_profiles p WHERE p.account_id IN (${ids}))`,
      [created],
    )
    await query(`DELETE FROM user_accounts WHERE email_normalized = ANY($1::text[])`, [created])
  }
  await closePool()
})

const fresh = (tag: string) => {
  const email = `s1-flow-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
  created.push(email)
  return email
}

async function resetLink(page: Page, email: string): Promise<string> {
  const res = await page.request.get(`/dev/outbox?kind=reset&email=${encodeURIComponent(email)}`)
  expect(res.status(), `a reset e-mail for ${email}`).toBe(200)
  // Opened on THIS server whatever origin the e-mail names (never a real site).
  const link = new URL(((await res.json()) as { link: string }).link)
  return `${link.pathname}${link.search}${link.hash}`
}

async function forgot(page: Page, identifier: string) {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click()
  const form = page.getByRole('form', { name: 'Quên mật khẩu' })
  await form.getByLabel('Tên tài khoản hoặc email').fill(identifier)
  await form.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()
  await expect(page).toHaveURL('/auth/check-email')
}

async function setNewPassword(page: Page, password: string) {
  const form = page.getByRole('form', { name: 'Đặt mật khẩu mới' })
  await form.getByLabel('Mật khẩu mới', { exact: true }).fill(password)
  await form.getByRole('textbox', { name: 'Nhập lại mật khẩu' }).fill(password)
  await form.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
}

test.describe('US-01.04 forgot / reset password', () => {
  test('forgot → check mail → link → new password; other devices signed out; old password dead', async ({
    page,
    browser,
  }) => {
    const email = fresh('reset')
    // Device B: signed in before the reset.
    const deviceB = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const pageB = deviceB.newPage()
    await signUpThroughUi(await pageB, email)
    expect((await (await pageB).request.get('/api/v1/me/profile')).status()).toBe(200)

    await forgot(page, usernameFor(email))
    await expect(page.getByText(/liên kết đặt lại mật khẩu/)).toBeVisible()
    // A username was typed: the address is never echoed.
    await expect(page.getByTestId('email-masked')).toHaveText('email gắn với tài khoản của bạn')
    await expect(page.getByRole('button', { name: /Gửi lại sau 0:4\d/ })).toBeDisabled()

    const link = await resetLink(page, email)
    expect(link).toMatch(/^\/auth\/reset-password#token=[A-Za-z0-9_-]{20,}$/)
    await page.goto(link)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đặt mật khẩu mới')
    // The token leaves the address bar before anything is sent.
    expect(page.url()).toMatch(/\/auth\/reset-password$/)

    await setNewPassword(page, 'Moi2026pass')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đã đổi mật khẩu')
    expect((await (await pageB).request.get('/api/v1/me/profile')).status()).toBe(401)
    await deviceB.close()

    await page.getByRole('link', { name: 'Đăng nhập' }).click()
    const form = page.getByRole('form', { name: 'Đăng nhập' })
    await form.getByLabel('Tên tài khoản hoặc email').fill(email)
    await form.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD)
    await form.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(form.getByRole('alert')).toHaveText('Sai tên tài khoản hoặc mật khẩu.')
    await logInThroughUi(page, email, 'Moi2026pass')
    await expect(page).toHaveURL('/onboarding')

    // The same link again: "đã hết hạn", and a new one starts from the forgot view.
    await page.context().clearCookies()
    await page.goto(link)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Liên kết đặt lại mật khẩu đã hết hạn',
    )
    await page.getByRole('link', { name: 'Gửi liên kết mới' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quên mật khẩu')
  })

  test('an unknown account sees the identical screen; an expired or bare link is refused', async ({
    page,
  }) => {
    const nobody = `nobody-${Date.now()}@example.test`
    await forgot(page, nobody)
    await expect(page.getByTestId('email-masked')).toHaveText(/^n\*\*\*@example\.test$/)
    const sent = await page.request.get(
      `/dev/outbox?kind=reset&email=${encodeURIComponent(nobody)}`,
    )
    expect(sent.status()).toBe(404)

    const email = fresh('expired')
    await signUpThroughUi(page, email)
    await page.context().clearCookies()
    await forgot(page, email)
    const link = await resetLink(page, email)
    await query(
      `UPDATE password_reset_requests SET expires_at = now() - interval '1 second'
        WHERE account_id = (SELECT id FROM user_accounts WHERE email_normalized = $1)`,
      [email],
    )
    await page.goto(link)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Liên kết đặt lại mật khẩu đã hết hạn',
    )
    await page.goto('/auth/reset-password')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Liên kết đặt lại mật khẩu đã hết hạn',
    )
  })

  for (const width of [1440, 768, 390]) {
    test(`WF01-S11 at ${width}: no overflow, password fields and CTA intact`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.route('**/api/v1/auth/password/reset/check', (route) =>
        route.fulfill({ status: 204 }),
      )
      await page.goto('/auth/reset-password#token=layout-only')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đặt mật khẩu mới')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      const surface = (await page.locator('[data-ui="surface"]').boundingBox())!
      for (const control of await page
        .locator('[data-ui="surface"] button, [data-ui="surface"] input')
        .all()) {
        const box = (await control.boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(surface.x + surface.width + 0.5)
      }
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-01/reset-${width}.png`,
        fullPage: true,
      })
    })
  }
})

test.describe('US-01.02 → onboarding → /me (sections 11, 12)', () => {
  test('a new password account completes onboarding once; Legal v1.0 is recorded once, not twice', async ({
    page,
  }) => {
    const email = fresh('journey')
    await signUpThroughUi(page, email, 'Người Dùng S1')
    await onboardThroughUi(page, 'Người Dùng S1')
    const [row] = await query<{ consents: number; audits: number; status: string }>(
      `SELECT (SELECT count(*)::int FROM consent_records c WHERE c.account_id = a.id) AS consents,
              (SELECT count(*)::int FROM audit_events e
                WHERE e.actor_account_id = a.id AND e.action = 'CONSENT_ACCEPTED') AS audits,
              p.status::text AS status
         FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
        WHERE a.email_normalized = $1`,
      [email],
    )
    expect(row).toEqual({ consents: 2, audits: 2, status: 'ACTIVE' })

    // A returning, completed account signs in straight to /me.
    await page.context().clearCookies()
    await logInThroughUi(page, email)
    await expect(page).toHaveURL('/me')
  })
})

test.describe('session security (section 13)', () => {
  test('a pre-set session cookie is never adopted: sign-in issues a new token', async ({
    page,
    context,
    baseURL,
  }) => {
    const email = fresh('fixation')
    await signUpThroughUi(page, email)
    await context.clearCookies()
    await context.addCookies([{ name: '1hub_session', value: 'attacker-chosen', url: baseURL! }])
    await logInThroughUi(page, email)
    const cookie = (await context.cookies()).find((c) => c.name === '1hub_session')!
    expect(cookie.value).not.toBe('attacker-chosen')
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Lax')
  })

  test('logout revokes the session; Back does not show the private page', async ({ page }) => {
    const email = fresh('logout')
    await signUpThroughUi(page, email)
    await onboardThroughUi(page, 'Người Đăng Xuất')
    const res = await page.request.post('/api/v1/auth/logout')
    expect(res.status()).toBe(204)
    await page.goto('/auth')
    await page.goBack()
    await page.reload()
    await expect(page).not.toHaveURL('/me')
    expect((await page.request.get('/api/v1/me/profile')).status()).toBe(401)
  })
})
