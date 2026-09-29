import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { hashToken } from '../../../src/lib/auth/tokens'
import { closePool, query } from '../../../src/lib/db/client'
import { applyVocabularyFixture, IDS, memberships, stored } from '../support/onboarding'

/**
 * WF01 UAT — the four-stage journey AUTH → ACC-05 → ACC-06 → ACC-07 → ACC-08 →
 * ACC-09 → ACC-10 → /me, ONE journey per scenario (DEC-L1R; BA workbook sheet
 * "2. Actor", WF-01). The "mail" step reads the link the way the inbox would
 * receive it: requestMagicLink() returns the raw token only to its caller,
 * never to storage.
 *
 * Scenarios A–H are the L1 closure matrix; UAT-05, 06, 11, 12 and 13 are the
 * frozen P0 requirements the earlier audit closed, driven through the new
 * screens.
 */

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Spent/expired links (400/409), refused calls (403/404/422), the
    // stale-version race (409) and a simulated failure (500) are scenarios.
    if (m.type() === 'error' && !/status of (400|403|404|409|422|500)/.test(m.text()))
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

const NAME = 'Người Dùng UAT'

const newEmail = (tag: string) =>
  `uat-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`

/** AUTH1 → AUTH2 in the UI, then open the emailed link (AUTH3). Returns the raw token. */
async function signInThroughUi(page: Page, email: string): Promise<string> {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  await expect(page.getByRole('button', { name: /Gửi lại/ })).toBeVisible()
  // The inbox: the newest link for this address (a resend retires older ones).
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
  // AUTH3 consumes the link and moves on; the session exists only after that.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/callback'))
  return token
}

async function accountId(email: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return row!.id
}

async function state(id: string) {
  const [row] = await query<{
    accounts: number
    profiles: number
    status: string | null
    completed_at: Date | null
    consents: number
    activated: number
    consent_audits: number
    completed_events: number
  }>(
    `SELECT (SELECT count(*)::int FROM user_accounts a
              WHERE a.email_normalized = (SELECT email_normalized FROM user_accounts WHERE id = $1)) AS accounts,
            (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS profiles,
            (SELECT status::text FROM individual_profiles WHERE account_id = $1) AS status,
            (SELECT onboarding_completed_at FROM individual_profiles WHERE account_id = $1) AS completed_at,
            (SELECT count(*)::int FROM consent_records WHERE account_id = $1) AS consents,
            (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED') AS activated,
            (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $1 AND action = 'CONSENT_ACCEPTED') AS consent_audits,
            (SELECT count(*)::int FROM analytics_events WHERE account_id = $1 AND event_name = 'onboarding_completed') AS completed_events`,
    [id],
  )
  return row!
}

const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' })
const later = (page: Page) =>
  page.locator('[data-anchor="footer"]').getByRole('button', { name: 'Lưu và hoàn tất sau' })

/** ACC-05: the entry; "Bắt đầu" opens stage 1. */
async function intro(page: Page) {
  await expect(page).toHaveURL('/onboarding')
  await page.getByRole('link', { name: 'Bắt đầu' }).click()
  await expect(page).toHaveURL('/onboarding/profile')
}

/** ACC-06: the four required fields. */
async function basic(page: Page, name = NAME) {
  await page.getByLabel('Họ và tên').fill(name)
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
  await next(page).click()
  await expect(page).toHaveURL('/onboarding/capability')
}

/** ACC-07: one field, so the stage stores something to resume. */
async function capability(page: Page) {
  await page.getByRole('checkbox', { name: 'Logistics', exact: true }).check({ force: true })
  await next(page).click()
  await expect(page).toHaveURL('/onboarding/purpose')
}

/** ACC-08: one role; with `unit`, the HUB role and its unit. */
async function role(page: Page, unit?: string) {
  await page.getByRole('checkbox', { name: /Innovator/ }).check({ force: true })
  if (unit) {
    await page.getByRole('checkbox', { name: /Thành viên HUB Network/ }).check({ force: true })
    const panel = page.locator('[data-anchor="hub"]')
    await panel.getByLabel('Đơn vị').selectOption(unit)
    await panel.getByLabel('Chức vụ').fill('Trưởng chapter')
    await panel.getByLabel('Thời gian').fill('2024 – nay')
  }
  await next(page).click()
  await expect(page).toHaveURL('/onboarding/privacy')
}

/** ACC-09: the required confirmation, then "Hoàn tất hồ sơ". */
async function review(page: Page) {
  await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check({ force: true })
  await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
  await expect(page).toHaveURL('/onboarding/complete')
}

/** ACC-10. */
async function done(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ của bạn đã sẵn sàng')
  await expect(page.getByRole('link', { name: 'Vào Tài khoản của tôi' })).toBeVisible()
}

async function journey(page: Page, unit?: string) {
  await intro(page)
  await basic(page)
  await capability(page)
  await role(page, unit)
  await review(page)
  await done(page)
}

async function sessionOf(request: APIRequestContext) {
  return (await request.get('/api/v1/session')).json()
}

async function logout(context: BrowserContext) {
  const response = await context.request.post('/api/v1/auth/logout')
  expect(response.status()).toBe(204)
  await context.clearCookies()
}

/** What no declaration may ever produce, for one account. */
async function granted(id: string) {
  const [row] = await query<{ leadership: number; assignments: number }>(
    `SELECT (SELECT count(*)::int FROM leadership_records l WHERE l.profile_id = p.id) AS leadership,
            (SELECT count(*)::int FROM role_assignments r
              WHERE r.individual_profile_id = p.id) AS assignments
       FROM individual_profiles p WHERE p.account_id = $1`,
    [id],
  )
  return row
}

test.describe('WF01 UAT — L1 closure matrix', () => {
  test('A. a new valid e-mail completes AUTH → four stages → /me as one journey', async ({
    page,
    context,
  }) => {
    const email = newEmail('a')
    const token = await signInThroughUi(page, email)
    // AUTH3: session established, token stripped from the URL.
    await expect(page).toHaveURL('/onboarding')
    expect(page.url()).not.toContain(token)
    const cookie = (await context.cookies()).find((c) => c.httpOnly)
    expect(cookie, 'HttpOnly session cookie').toBeTruthy()
    expect(cookie!.secure).toBe(true)
    expect(['Lax', 'Strict']).toContain(cookie!.sameSite)
    const id = await accountId(email)
    expect(await state(id)).toMatchObject({ accounts: 1, profiles: 0 })

    await intro(page)
    // Opening a stage writes nothing.
    expect(await state(id)).toMatchObject({ profiles: 0 })
    await basic(page)
    expect(await state(id)).toMatchObject({ profiles: 1, status: 'DRAFT', completed_at: null })
    await capability(page)
    await role(page)
    expect(await state(id)).toMatchObject({ profiles: 1, status: 'DRAFT', consents: 0 })
    await review(page)
    await done(page)

    const final = await state(id)
    expect(final).toMatchObject({
      accounts: 1,
      profiles: 1,
      status: 'ACTIVE',
      consents: 2,
      activated: 1,
      consent_audits: 2,
      completed_events: 1,
    })
    expect(final.completed_at).toBeInstanceOf(Date)
    expect(await stored(id)).toMatchObject({
      full_name: NAME,
      display_name: NAME,
      country: IDS.country,
      region: IDS.danang,
      roles: ['INNOVATOR'],
    })
    const session = await sessionOf(page.request)
    const completion = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(session.profile).toMatchObject({
      status: 'ACTIVE',
      onboarding_completed: true,
      completion_percent: completion.percent,
    })
    await expect(page.locator('[data-completion]')).toContainText(`${completion.percent}%`)

    // The raw token is stored nowhere: only its hash, and never in audit or analytics.
    const leaks = await query<{ n: number }>(
      `SELECT (SELECT count(*) FROM auth_magic_link_requests WHERE token_hash = $1)::int
            + (SELECT count(*) FROM audit_events
                WHERE coalesce(before_data::text, '') || coalesce(after_data::text, '') LIKE '%' || $1 || '%')::int
            + (SELECT count(*) FROM analytics_events WHERE properties::text LIKE '%' || $1 || '%')::int AS n`,
      [token],
    )
    expect(leaks[0]!.n).toBe(0)
    const hashed = await query('SELECT 1 FROM auth_magic_link_requests WHERE token_hash = $1', [
      hashToken(token),
    ])
    expect(hashed).toHaveLength(1)

    await page.getByRole('link', { name: 'Vào Tài khoản của tôi' }).click()
    await expect(page).toHaveURL('/me')
  })

  test('B. an existing incomplete member resumes at the first incomplete stage', async ({
    page,
    context,
  }) => {
    const email = newEmail('b')
    const relogin = async (expected: string) => {
      await logout(context)
      await signInThroughUi(page, email)
      await expect(page).toHaveURL(expected)
    }
    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/onboarding')
    await relogin('/onboarding') // nothing saved yet → the intro again
    const id = await accountId(email)

    await intro(page)
    await page.getByLabel('Họ và tên').fill(NAME)
    await later(page).click()
    await expect(page).toHaveURL('/')
    await relogin('/onboarding/profile') // stage 1 has a required field missing
    await expect(page.getByLabel('Họ và tên')).toHaveValue(NAME)

    await basic(page)
    await relogin('/onboarding/capability') // stage 1 done → stage 2
    await capability(page)
    await relogin('/onboarding/purpose') // stage 2 passed → stage 3
    await role(page)
    await relogin('/onboarding/privacy') // stage 3 passed → stage 4

    // A failed completion leaves the account at the review, not half-finished.
    await page.route('**/api/v1/me/onboarding/complete', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
      }),
    )
    await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check({ force: true })
    await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
    await expect(page.getByText('Chưa hoàn tất được. Vui lòng thử lại.')).toBeVisible()
    await page.unroute('**/api/v1/me/onboarding/complete')
    expect(await state(id)).toMatchObject({ status: 'DRAFT', completed_at: null })
    await relogin('/onboarding/privacy')
    // The acceptance of the first attempt stands; the confirmation shows it.
    await expect(page.getByRole('checkbox', { name: /Tôi đồng ý/ })).toBeChecked()
    await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
    await expect(page).toHaveURL('/onboarding/complete')
    await done(page)
    await relogin('/me') // completed → /me
    expect(await state(id)).toMatchObject({
      accounts: 1,
      profiles: 1,
      status: 'ACTIVE',
      consents: 2,
      activated: 1,
    })
  })

  test('C. an existing completed member goes to /me; nothing is rewritten', async ({
    page,
    context,
  }) => {
    const email = newEmail('c')
    await signInThroughUi(page, email)
    await journey(page)
    const id = await accountId(email)
    const before = await state(id)
    const profile = await stored(id)
    await logout(context)

    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/me')
    for (const step of [
      '/onboarding',
      '/onboarding/profile',
      '/onboarding/capability',
      '/onboarding/purpose',
      '/onboarding/privacy',
    ]) {
      await page.goto(step)
      await expect(page, step).toHaveURL('/me')
    }
    await page.goto('/onboarding/complete', { waitUntil: 'networkidle' })
    await done(page)
    expect(await state(id)).toEqual(before)
    expect(await stored(id)).toEqual(profile)

    // The seeded member, completed before the four stages existed, is untouched by them.
    await logout(context)
    await signInThroughUi(page, 'member@example.test')
    await expect(page).toHaveURL('/me')
  })

  test('D. refresh keeps every stage: its route, its saved data and the progress', async ({
    page,
  }) => {
    const email = newEmail('d')
    await signInThroughUi(page, email)
    const refresh = async (route: string, current: number) => {
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page).toHaveURL(route)
      await expect(page.locator('header ol li[aria-current="step"]')).toHaveCount(1)
      await expect(page.locator('header ol li').nth(current - 1)).toHaveAttribute(
        'aria-current',
        'step',
      )
    }
    await expect(page).toHaveURL('/onboarding')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL('/onboarding')

    await intro(page)
    await refresh('/onboarding/profile', 1)
    await basic(page)
    await refresh('/onboarding/capability', 2)
    await capability(page)
    await refresh('/onboarding/purpose', 3)
    await role(page, IDS.chapter02)
    await refresh('/onboarding/privacy', 4)

    // Going back shows what each stage stored.
    await page.getByRole('link', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    await expect(page.getByRole('checkbox', { name: /Innovator/ })).toBeChecked()
    await expect(page.locator('[data-anchor="hub"]').getByLabel('Chức vụ')).toHaveValue(
      'Trưởng chapter',
    )
    await page.getByRole('link', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL('/onboarding/capability')
    await expect(page.getByRole('checkbox', { name: 'Logistics', exact: true })).toBeChecked()
    await page.getByRole('link', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL('/onboarding/profile')
    await expect(page.getByLabel('Họ và tên')).toHaveValue(NAME)
    await expect(page.getByLabel('Tỉnh/Thành phố')).toHaveValue(IDS.danang)

    // Editing an earlier stage does not throw the later ones away.
    await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.hanoi)
    await next(page).click()
    await next(page).click()
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    await expect(page.locator('[data-anchor="part-1"]')).toContainText('Hà Nội, Việt Nam')
    await review(page)
    await done(page)
    await page.reload({ waitUntil: 'networkidle' })
    await done(page)
  })

  test('E. repeated sign-ins, saves and completions keep one account and one profile', async ({
    page,
    context,
    browser,
  }) => {
    const email = newEmail('e')
    // The same mailbox, written three ways, from two browsers at once.
    const second = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const tokens = await Promise.all(
      [email, email.toUpperCase(), ` ${email} `].map((e) => requestMagicLink(e.trim(), null)),
    )
    await Promise.all([
      page.goto(`/auth/callback?token=${encodeURIComponent(tokens[1]!.token)}`),
      second.request.post('/dev/login', { data: { email } }),
    ])
    await signInThroughUi(page, email)
    const id = await accountId(email)
    expect(await state(id)).toMatchObject({ accounts: 1, profiles: 0 })

    // Concurrent first writes from both sessions create one profile.
    const writes = await Promise.all([
      page.request.patch('/api/v1/me/profile', { data: { full_name: 'Một' } }),
      second.request.patch('/api/v1/me/profile', { data: { full_name: 'Hai' } }),
      page.request.put('/api/v1/me/onboarding/roles', { data: { roles: ['INNOVATOR'] } }),
      second.request.put('/api/v1/me/onboarding/roles', { data: { roles: ['STARTUP_FOUNDER'] } }),
    ])
    expect(writes.map((r) => r.status())).toEqual([200, 200, 200, 200])
    expect(await state(id)).toMatchObject({ accounts: 1, profiles: 1 })

    await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
    await basic(page)
    await capability(page)
    await role(page)
    await review(page)
    const before = await state(id)
    const responses = await Promise.all([
      ...Array.from({ length: 3 }, () => page.request.post('/api/v1/me/onboarding/complete')),
      second.request.post('/api/v1/me/onboarding/complete'),
    ])
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200, 200])
    await logout(context)
    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/me')
    expect(await state(id)).toEqual(before)
    expect(before).toMatchObject({ accounts: 1, profiles: 1, activated: 1, completed_events: 1 })
    await second.close()
  })

  test('F. a HUB declaration stays pending and self-declared, and grants no privilege', async ({
    page,
  }) => {
    const email = newEmail('f')
    await signInThroughUi(page, email)
    await intro(page)
    await basic(page)
    await capability(page)
    await role(page, IDS.chapter01)
    const id = await accountId(email)

    const closed = async (when: string) => {
      const session = await sessionOf(page.request)
      expect(session.capabilities ?? [], when).toEqual([])
      expect(session.managed_scopes ?? [], when).toEqual([])
      expect(await granted(id), when).toEqual({ leadership: 0, assignments: 0 })
      const ops = `/api/v1/ops/organizations/${IDS.chapter01}`
      // Headers and query naming a role or a unit are not authority.
      for (const path of [
        '/api/v1/ops/organizations',
        `${ops}/members`,
        `${ops}/dashboard?role=PLATFORM_ADMIN`,
      ]) {
        const response = await page.request.get(path, {
          headers: {
            'x-role': 'PLATFORM_ADMIN',
            'x-org-id': IDS.chapter01,
            'x-capabilities': 'membership:confirm',
          },
        })
        expect([403, 404], `${when} ${path}`).toContain(response.status())
      }
      const approve = await page.request.patch(`${ops}/memberships/${id}`, {
        data: { status: 'ACTIVE' },
      })
      expect([403, 404], when).toContain(approve.status())
    }

    // Before completion: a draft, no membership at all.
    expect(await memberships(id)).toEqual([])
    await closed('before completion')

    await review(page)
    await done(page)
    expect(await memberships(id)).toEqual([
      {
        organization_id: IDS.chapter01,
        state: 'PENDING_APPROVAL',
        source: 'SELF_DECLARED',
        claimed_position: 'Trưởng chapter',
        claimed_period: '2024 – nay',
      },
    ])
    await closed('after completion')
    for (const route of ['/ops/network', `/ops/org/${IDS.chapter01}`]) {
      expect((await page.goto(route))?.status(), route).toBe(404)
    }

    // The member sees the request as pending, never as a confirmed position.
    await page.goto('/onboarding/complete', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Xem trạng thái' }).click()
    await expect(page).toHaveURL('/me/roles')
    await expect(page.locator('main')).toContainText('Chapter 01')
    await expect(page.locator('main')).not.toContainText(/Đã xác minh|Trưởng chapter/)
  })

  test('G. the visibility chosen at the review persists and filters what others can read', async ({
    page,
    context,
    browser,
  }) => {
    const email = newEmail('g')
    await signInThroughUi(page, email)
    await intro(page)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const upload = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/profile/avatar'))
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png })
    const { url } = await (await upload).json()
    await basic(page)
    await capability(page)
    await role(page)
    await page.getByRole('switch', { name: 'Hiển thị hồ sơ trong Mạng lưới' }).click() // → PRIVATE
    await review(page)
    await done(page)

    const level = async () =>
      (await (await page.request.get('/api/v1/me/visibility')).json()).groups[0].level
    expect(await level()).toBe('PRIVATE')
    await logout(context)
    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/me')
    expect(await level()).toBe('PRIVATE')

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    await other.request.post('/dev/login', { data: { email: newEmail('g-other') } })
    expect((await other.request.get(url)).status()).toBe(404)
    await page.request.put('/api/v1/me/visibility', {
      data: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }] },
    })
    expect((await other.request.get(url)).status()).toBe(200)
    const guest = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    expect((await guest.request.get(url)).status()).toBe(404)
    // Visibility is not consent: both acceptances stand whatever the level.
    expect(await state(await accountId(email))).toMatchObject({ consents: 2 })
    await other.close()
    await guest.close()
  })

  test('H. expired, reused and invalid links never sign in', async ({ page }) => {
    const email = newEmail('h')
    const { token } = await requestMagicLink(email, null)
    await query(
      `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashToken(token)],
    )
    await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL('/auth/callback?status=expired')
    expect((await sessionOf(page.request)).authenticated).toBe(false)
    // A link that never worked creates no account.
    expect(
      await query('SELECT 1 FROM user_accounts WHERE email_normalized = $1', [email]),
    ).toHaveLength(0)

    const fresh = (await requestMagicLink(email, null)).token
    await page.goto(`/auth/callback?token=${encodeURIComponent(fresh)}`)
    await expect(page).toHaveURL('/onboarding')
    await page.context().clearCookies()
    await page.goto(`/auth/callback?token=${encodeURIComponent(fresh)}`)
    await expect(page).toHaveURL('/auth/callback?status=used')
    expect((await sessionOf(page.request)).authenticated).toBe(false)
    for (const path of ['/onboarding', '/onboarding/profile', '/me']) {
      await page.goto(path)
      await expect(page, path).toHaveURL('/auth')
    }

    await page.goto('/auth/callback?token=not-a-token')
    await expect(page).toHaveURL('/auth/error')
    expect((await sessionOf(page.request)).authenticated).toBe(false)
    expect(await state(await accountId(email))).toMatchObject({ accounts: 1, profiles: 0 })
  })
})

test.describe('WF01 frozen P0 requirements (audit follow-up)', () => {
  test('UAT-05 required fields block stage 1 and nothing is saved', async ({ page }) => {
    const email = newEmail('05')
    await signInThroughUi(page, email)
    await intro(page)
    await next(page).click()
    await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/profile')
    expect(await stored(await accountId(email))).toBeUndefined()
    // A later stage cannot be opened around it.
    for (const route of ['/onboarding/capability', '/onboarding/purpose', '/onboarding/privacy']) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/onboarding')
    }
    await page.goto('/onboarding/complete')
    await expect(page).toHaveURL('/onboarding')
  })

  test('UAT-06 a legal version published mid-journey must be accepted in its new version', async ({
    page,
  }) => {
    const email = newEmail('06')
    await signInThroughUi(page, email)
    await intro(page)
    await basic(page)
    await capability(page)
    await role(page)
    const version = `uat-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('PRIVACY_DATA_PROCESSING', $1, 'Chính sách quyền riêng tư', $2, now())`,
      [version, `/legal/privacy/${version}`],
    )
    try {
      await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check({ force: true })
      await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
      await expect(page.getByText(/Văn bản vừa được cập nhật/)).toBeVisible()
      await review(page)
      await done(page)
      const [row] = await query<{ version: string }>(
        `SELECT d.version FROM consent_records c JOIN legal_documents d ON d.id = c.legal_document_id
          WHERE c.account_id = $1 AND c.consent_type = 'PRIVACY_DATA_PROCESSING'`,
        [await accountId(email)],
      )
      expect(row!.version).toBe(version)
    } finally {
      await query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version])
    }
  })

  test('UAT-08 a profile below 80% completes onboarding', async ({ page }) => {
    const email = newEmail('08')
    await signInThroughUi(page, email)
    await journey(page)
    const completion = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(completion.percent).toBeLessThan(80)
    expect(completion.groups.map((g: { code: string }) => g.code)).not.toContain('NETWORK_CONTEXT')
    expect(await state(await accountId(email))).toMatchObject({ status: 'ACTIVE' })
  })

  test('UAT-11 launch-roster members keep their confirmed relationships through onboarding', async ({
    page,
    context,
  }) => {
    // Freeze D2: known roster → normalized email match → ACTIVE membership;
    // leadership only when the roster row states it. Rows are inserted as the
    // importer (pnpm roster:import) stores them.
    const member = newEmail('roster-member')
    const leader = newEmail('roster-leader')
    await query(
      `INSERT INTO membership_bootstrap
         (email_normalized, organization_id, membership_state, leadership_role_label, source_batch)
       VALUES ($1, $3, 'ACTIVE', NULL, 'uat-audit'), ($2, $3, 'ACTIVE', 'Chapter Leader', 'uat-audit')`,
      [member, leader, IDS.chapter01],
    )
    const relations = async (email: string) =>
      query<{ kind: string; state: string; label: string | null }>(
        `SELECT 'membership' AS kind, m.state::text AS state, NULL AS label
           FROM community_memberships m JOIN individual_profiles p ON p.id = m.profile_id
           JOIN user_accounts a ON a.id = p.account_id WHERE a.email_normalized = $1
         UNION ALL
         SELECT 'leadership', l.state::text, l.role_label
           FROM leadership_records l JOIN individual_profiles p ON p.id = l.profile_id
           JOIN user_accounts a ON a.id = p.account_id WHERE a.email_normalized = $1
         ORDER BY 1`,
        [email],
      )

    // Member: ACTIVE membership, no leadership, one profile; onboarding starts at the intro.
    await signInThroughUi(page, member)
    await expect(page).toHaveURL('/onboarding')
    expect(await relations(member)).toEqual([{ kind: 'membership', state: 'ACTIVE', label: null }])
    const id = await accountId(member)
    // Naming the unit the roster already confirmed files no second request.
    await journey(page, IDS.chapter01)
    expect(await state(id)).toMatchObject({ profiles: 1, status: 'ACTIVE' })
    expect(await memberships(id)).toMatchObject([
      { organization_id: IDS.chapter01, state: 'ACTIVE', claimed_position: null },
    ])
    // Signing in again attaches nothing new.
    await logout(context)
    await signInThroughUi(page, member)
    await expect(page).toHaveURL('/me')
    expect(await relations(member)).toHaveLength(1)

    // Leader: membership AND leadership, no permission-bearing role.
    await logout(context)
    await signInThroughUi(page, leader)
    await expect(page).toHaveURL('/onboarding')
    expect(await relations(leader)).toEqual([
      { kind: 'leadership', state: 'ACTIVE', label: 'Chapter Leader' },
      { kind: 'membership', state: 'ACTIVE', label: null },
    ])
    const session = await sessionOf(page.request)
    expect(session.capabilities).toEqual([])
    expect(session.managed_scopes).toEqual([])
  })

  test('UAT-12 account creation records account_created exactly once', async ({
    page,
    context,
  }) => {
    // API 05 §10 P0 minimum events; Data SOT: "at minimum registration".
    const email = newEmail('reg')
    const token = await signInThroughUi(page, email)
    await expect(page).toHaveURL('/onboarding')
    const id = await accountId(email)
    const count = async () =>
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM analytics_events WHERE account_id = $1 AND event_name = 'account_created'`,
          [id],
        )
      )[0]!.n
    expect(await count()).toBe(1)
    // Retrying the same link: USED, no new event.
    await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL('/auth/callback?status=used')
    // Signing out and in again: no new event.
    await logout(context)
    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/onboarding')
    expect(await count()).toBe(1)
  })

  test('UAT-13 the WF01 funnel reads account_created → completion changes → onboarding_completed', async ({
    page,
  }) => {
    const email = newEmail('funnel')
    const token = await signInThroughUi(page, email)
    await journey(page, IDS.chapter02)
    const id = await accountId(email)
    const rows = await query<{ event_name: string; properties: Record<string, unknown> }>(
      `SELECT event_name, properties FROM analytics_events WHERE account_id = $1 ORDER BY occurred_at, id`,
      [id],
    )
    const names = rows.map((r) => r.event_name)
    expect(names[0]).toBe('account_created')
    expect(names.at(-1)).toBe('onboarding_completed')
    expect(names.filter((n) => n === 'account_created')).toHaveLength(1)
    expect(names.filter((n) => n === 'onboarding_completed')).toHaveLength(1)
    expect(new Set(names.slice(1, -1))).toEqual(new Set(['profile_completion_changed']))
    // Every change is a real move of the authoritative percent.
    for (const r of rows.filter((x) => x.event_name === 'profile_completion_changed')) {
      expect(r.properties.from_percent).not.toBe(r.properties.to_percent)
    }
    // One account correlates the funnel; no personal or secret content.
    expect(rows.every((r) => r.properties.account_id === id)).toBe(true)
    const text = JSON.stringify(rows)
    for (const secret of [email, token, NAME, 'Trưởng chapter', 'INNOVATOR', 'TERMS', '@']) {
      expect(text, secret).not.toContain(secret)
    }
  })
})
