import { query } from '../../../src/lib/db/client'
import { IDS } from '../../visual/support/onboarding'
import {
  expect,
  identity,
  NO_PRIVILEGE,
  privilege,
  requestLink,
  test,
  tokenHash,
  uatHooks,
  unique,
} from './uat'

/**
 * UC01 — New user đăng ký bằng email. Guest → e-mailed one-time link →
 * four-stage onboarding → /me; one Account, one IndividualProfile; a HUB role
 * declaration is self-declared and pending and grants nothing.
 */
uatHooks()

test('UC01 · UI+API+DB · a new address signs up, onboards and lands on /me; 1 account, 1 profile, zero privilege', async ({
  page,
  browser,
}) => {
  const email = unique('uc01')
  const link = await requestLink(page, email)
  // Asking for a link creates nothing yet.
  expect(await identity(email)).toMatchObject({ accounts: 0, profiles: 0 })

  await page.goto(link)
  await expect(page).toHaveURL('/onboarding')
  expect(page.url()).not.toContain('token=')
  const { account_id } = await identity(email)
  expect(await identity(email)).toMatchObject({ accounts: 1 })

  // ACC-05 → ACC-06 → ACC-07 → ACC-08 (HUB role declared) → ACC-09 → ACC-10 → /me.
  await page.getByRole('link', { name: 'Bắt đầu' }).click()
  await page.getByLabel('Họ và tên').fill('Người Dùng UC01')
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/capability')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/purpose')
  await page.getByRole('checkbox', { name: /Thành viên HUB Network/ }).check({ force: true })
  const hub = page.locator('[data-anchor="hub"]')
  await hub.getByLabel('Đơn vị').selectOption(IDS.chapter01)
  await hub.getByLabel('Chức vụ').fill('Trưởng chapter')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/privacy')
  await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check({ force: true })
  await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
  await expect(page).toHaveURL('/onboarding/complete')
  await page.getByRole('link', { name: 'Vào Tài khoản của tôi' }).click()
  await expect(page).toHaveURL('/me')
  await expect(page.locator('[data-screen="FP1-OWN"]')).toContainText('Người Dùng UC01')

  // API: the session is the new account, onboarding done.
  const session = await (await page.request.get('/api/v1/session')).json()
  expect(session).toMatchObject({ authenticated: true })
  const state = await (await page.request.get('/api/v1/me/onboarding')).json()
  expect(state).toMatchObject({ completed: true })

  // DB: exactly one account and one profile; the HUB role is a pending, self-declared request.
  expect(await identity(email)).toEqual({ accounts: 1, profiles: 1, account_id })
  const claims = await query<{ state: string; source: string; hub_declaration: boolean }>(
    `SELECT m.state::text AS state, m.source, m.hub_declaration
       FROM community_memberships m JOIN individual_profiles p ON p.id = m.profile_id
      WHERE p.account_id = $1`,
    [account_id],
  )
  expect(claims).toEqual([
    { state: 'PENDING_APPROVAL', source: 'SELF_DECLARED', hub_declaration: true },
  ])
  expect(await privilege(page.request, account_id!)).toEqual(NO_PRIVILEGE)

  // The link was one-time: opened again elsewhere, it signs nobody in.
  const other = await browser.newContext()
  const again = await other.newPage()
  await again.goto(link)
  await expect(again).toHaveURL('/auth/callback?status=used')
  expect((await other.request.get('/api/v1/session').then((r) => r.json())).authenticated).toBe(
    false,
  )
  await other.close()
})

test('UC01 · exceptions · invalid e-mail, expired link, abandoned onboarding', async ({
  page,
  browser,
}) => {
  // Email sai: refused on the screen and by the API; nothing stored, nothing sent.
  for (const bad of ['not-an-email', 'a@b', 'two@@signs.vn']) {
    const res = await page.request.post('/api/v1/auth/magic-link', { data: { email: bad } })
    expect(res.status(), bad).toBe(400)
    expect((await res.json()).error.code).toBe('AUTH_EMAIL_INVALID')
  }
  // S1-UAT-01: the address is now typed on the create-account view of /auth.
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await page
    .getByRole('form', { name: 'Tạo tài khoản' })
    .getByLabel('Email', { exact: true })
    .fill('not-an-email')
  await page
    .getByRole('form', { name: 'Tạo tài khoản' })
    .getByRole('button', { name: 'Tạo tài khoản' })
    .click()
  await expect(page.getByText('Email chưa đúng định dạng.')).toBeVisible()
  await expect(page).toHaveURL('/auth')

  // Link hết hạn: refused; no account is created from it.
  const late = unique('uc01-expired')
  const expired = await requestLink(page, late)
  await query(
    `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 minute' WHERE token_hash = $1`,
    [tokenHash(expired)],
  )
  await page.goto(expired)
  await expect(page).toHaveURL('/auth/callback?status=expired')
  expect(await identity(late)).toMatchObject({ accounts: 0, profiles: 0 })

  // Bỏ dở onboarding: stage 1 saved, then the browser is closed. /me stays closed,
  // a new sign-in resumes the next stage, and still one account and one profile.
  const email = unique('uc01-abandon')
  const first = await browser.newContext()
  const p1 = await first.newPage()
  await p1.goto(await requestLink(p1, email))
  await p1.getByRole('link', { name: 'Bắt đầu' }).click()
  await p1.getByLabel('Họ và tên').fill('Người Bỏ Dở')
  await p1.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await p1.getByLabel('Tỉnh/Thành phố').selectOption(IDS.hanoi)
  await p1.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(p1).toHaveURL('/onboarding/capability')
  await first.close()

  await page.context().clearCookies()
  await page.goto(await requestLink(page, email))
  await expect(page).toHaveURL('/onboarding/capability')
  await page.goto('/me')
  await expect(page).toHaveURL('/onboarding/capability')
  expect(await identity(email)).toMatchObject({ accounts: 1, profiles: 1 })
})
