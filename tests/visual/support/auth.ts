import { createHash } from 'node:crypto'

import { expect, type Page } from '@playwright/test'

import { hashPassword } from '../../../src/lib/auth/password'
import { query } from '../../../src/lib/db/client'

/**
 * S1-UAT-01 — the primary sign-in as the browser specs drive it: /auth with a
 * username/e-mail and password (DEC-S1A-D1). Replaces the magic-link form
 * steps of the journey specs; the magic link itself stays covered as
 * compatibility (WF01-S02 / S03 specs and the DB tests).
 */

/** The one test password; it satisfies the Sprint1 rule (≥ 8, letters + digits). */
export const TEST_PASSWORD = 'Uat2026pass'

/** A deterministic valid username for an address (4–30, a-z 0-9 dot). */
export const usernameFor = (email: string) =>
  `u.${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)}`

/**
 * Gives an existing account (a seeded persona, a dev-login account) the test
 * password so it can sign in through the form. Test data only.
 */
export async function ensurePassword(email: string): Promise<void> {
  await query(
    `UPDATE user_accounts SET password_hash = $2, failed_password_attempts = 0,
            password_locked_until = NULL
      WHERE email_normalized = $1`,
    [email.toLowerCase(), await hashPassword(TEST_PASSWORD)],
  )
}

async function accountExists(email: string): Promise<boolean> {
  const rows = await query(`SELECT 1 FROM user_accounts WHERE email_normalized = $1`, [
    email.toLowerCase(),
  ])
  return rows.length > 0
}

/** US-01.02 through the screen: a new account, signed in, on its way to onboarding. */
export async function signUpThroughUi(
  page: Page,
  email: string,
  fullName = 'Người Dùng UAT',
  entry = '/auth',
) {
  await page.goto(entry, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  const form = page.getByRole('form', { name: 'Tạo tài khoản' })
  await form.getByLabel('Họ và tên').fill(fullName)
  await form.getByLabel('Email', { exact: true }).fill(email)
  await form.getByLabel('Tên tài khoản').fill(usernameFor(email))
  await form.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD)
  await form.getByRole('textbox', { name: 'Nhập lại mật khẩu' }).fill(TEST_PASSWORD)
  await form.getByRole('checkbox', { name: /Tôi đồng ý/ }).check()
  await form.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

/** US-01.03 through the screen, by e-mail or username. */
export async function logInThroughUi(
  page: Page,
  identifier: string,
  password = TEST_PASSWORD,
  entry = '/auth',
) {
  await page.goto(entry, { waitUntil: 'networkidle' })
  const form = page.getByRole('form', { name: 'Đăng nhập' })
  await form.getByLabel('Tên tài khoản hoặc email').fill(identifier)
  await form.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await form.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

/**
 * The journey specs' sign-in: a new address signs up, an existing one (with
 * its password set for the test) signs in. Either way through /auth.
 */
export async function signInThroughUi(page: Page, email: string, fullName?: string) {
  if (await accountExists(email)) {
    await ensurePassword(email)
    await logInThroughUi(page, email)
  } else {
    await signUpThroughUi(page, email, fullName)
  }
  await expect(page).not.toHaveURL(/\/auth/)
}
