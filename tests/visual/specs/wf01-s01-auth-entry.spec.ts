import { expect, test, type Page, type Route } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import { TEST_PASSWORD, ensurePassword, usernameFor } from '../support/auth'

/**
 * WF01-S01 — /auth after S1-UAT-01 (DEC-S1A): username/email + password
 * sign-in, create account, forgot password and Google, on the one canonical
 * route (BD-01). Functional QA drives the real APIs; only failures and the
 * Google provider are simulated. The pixel run compares the AUTH1 shell
 * (panel, canvas, title, Google control, divider); the password forms have no
 * approved reference (DEC-S1A-D13).
 */

const ROUTE = '/auth'
const LOGIN = '**/api/v1/auth/login'
const REGISTER = '**/api/v1/auth/register'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Refused credentials and simulated failures are logged by Chromium as
    // failed resources; they are the scenario under test, not an app error.
    if (m.type() === 'error' && !/status of (400|401|403|409|422|429|500)/.test(m.text())) {
      consoleErrors.push(m.text())
    }
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

const created: string[] = []
test.afterAll(async () => {
  if (created.length > 0) {
    const ids = `SELECT id FROM user_accounts WHERE email_normalized = ANY($1::text[])`
    await query(`DELETE FROM audit_events WHERE actor_account_id IN (${ids})`, [created])
    await query(`DELETE FROM analytics_events WHERE account_id IN (${ids})`, [created])
    await query(`DELETE FROM consent_records WHERE account_id IN (${ids})`, [created])
    await query(`DELETE FROM user_accounts WHERE email_normalized = ANY($1::text[])`, [created])
  }
  await closePool()
})

const fresh = (tag: string) => {
  const email = `s1-ui-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
  created.push(email)
  return email
}

async function open(page: Page) {
  const response = await page.goto(ROUTE, { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
}

async function legalVersions(page: Page): Promise<Record<string, string>> {
  const { documents } = (await (await page.request.get('/api/v1/legal/current')).json()) as {
    documents: { type: string; version: string }[]
  }
  return Object.fromEntries(documents.map((d) => [d.type, d.version]))
}

/** A password account made through the API, then signed out. */
async function apiAccount(page: Page, email: string) {
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      full_name: 'Tài Khoản',
      email,
      username: usernameFor(email),
      password: TEST_PASSWORD,
      password_confirm: TEST_PASSWORD,
      legal_versions: await legalVersions(page),
    },
  })
  expect(res.status()).toBe(200)
  await page.context().clearCookies()
}

const loginForm = (page: Page) => page.getByRole('form', { name: 'Đăng nhập' })
const registerForm = (page: Page) => page.getByRole('form', { name: 'Tạo tài khoản' })
const identifier = (page: Page) => loginForm(page).getByLabel('Tên tài khoản hoặc email')
const password = (page: Page) => loginForm(page).getByLabel('Mật khẩu', { exact: true })
const signInButton = (page: Page) => loginForm(page).getByRole('button', { name: 'Đăng nhập' })

async function fillRegister(page: Page, email: string, overrides: Record<string, string> = {}) {
  const form = registerForm(page)
  await form.getByLabel('Họ và tên').fill(overrides.name ?? 'Nguyễn Văn Chi')
  await form.getByLabel('Email', { exact: true }).fill(email)
  await form.getByLabel('Tên tài khoản').fill(overrides.username ?? usernameFor(email))
  await form.getByLabel('Mật khẩu', { exact: true }).fill(overrides.password ?? TEST_PASSWORD)
  await form
    .getByRole('textbox', { name: 'Nhập lại mật khẩu' })
    .fill(overrides.confirm ?? TEST_PASSWORD)
}

test.describe('WF01-S01 canonical surface', () => {
  test('/auth is the one entry: heading, no magic-link form, no sign-up alias routes', async ({
    page,
  }) => {
    await open(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đăng nhập & đăng ký')
    await expect(page.locator('[data-route-group="auth"]')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Gửi liên kết đăng nhập' })).toHaveCount(0)
    await expect(identifier(page)).toBeVisible()
    await expect(password(page)).toHaveAttribute('type', 'password')
    for (const alias of ['/login', '/signup', '/dang-ky', '/register']) {
      expect((await page.request.get(alias)).status(), alias).toBe(404)
    }
  })

  test('views are client state of /auth, never a route or a mode parameter', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(registerForm(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Đăng ký với Google' })).toBeVisible()
    await expect(page).toHaveURL(ROUTE)
    await registerForm(page).getByRole('button', { name: 'Đăng nhập' }).click()
    await loginForm(page).getByRole('button', { name: 'Quên mật khẩu?' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quên mật khẩu')
    await expect(page).toHaveURL(ROUTE)
  })
})

test.describe('US-01.03 password sign-in', () => {
  test('e-mail and username both sign in, case-insensitively; "Ghi nhớ" sets a 30-day cookie', async ({
    page,
    context,
  }) => {
    await ensurePassword('member@example.test')
    await open(page)
    await identifier(page).fill('MEMBER@example.test')
    await password(page).fill(TEST_PASSWORD)
    await signInButton(page).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
    const sessionOnly = (await context.cookies()).find((c) => c.name === '1hub_session')!
    expect(sessionOnly.expires).toBe(-1)
    expect(sessionOnly.httpOnly).toBe(true)

    await context.clearCookies()
    const email = fresh('login')
    await apiAccount(page, email)
    await open(page)
    await identifier(page).fill(usernameFor(email).toUpperCase())
    await password(page).fill(TEST_PASSWORD)
    await loginForm(page)
      .getByRole('checkbox', { name: /Ghi nhớ/ })
      .check()
    await signInButton(page).click()
    await expect(page).toHaveURL('/onboarding')
    const remembered = (await context.cookies()).find((c) => c.name === '1hub_session')!
    expect((remembered.expires * 1000 - Date.now()) / 86_400_000).toBeGreaterThan(29)
  })

  test('wrong password and unknown account read the same; the password field is cleared', async ({
    page,
  }) => {
    await ensurePassword('member@example.test')
    for (const who of ['member@example.test', `nobody-${Date.now()}@example.test`]) {
      await open(page)
      await identifier(page).fill(who)
      await password(page).fill('Sai12345x')
      await signInButton(page).click()
      await expect(loginForm(page).getByRole('alert')).toHaveText(
        'Sai tên tài khoản hoặc mật khẩu.',
      )
      await expect(password(page)).toHaveValue('')
    }
  })

  test('5 wrong passwords: the lock message, the reset way out, Google still offered', async ({
    page,
  }) => {
    const email = fresh('lock')
    await apiAccount(page, email)
    await open(page)
    for (let i = 0; i < 5; i++) {
      await identifier(page).fill(email)
      await password(page).fill(`Sai${i}2345x`)
      await signInButton(page).click()
      await expect(loginForm(page).getByRole('alert')).toBeVisible()
    }
    await expect(loginForm(page).getByRole('alert')).toContainText(
      'Bạn đã nhập sai mật khẩu quá nhiều lần',
    )
    // The right password is refused too: the lock is the server's.
    await password(page).fill(TEST_PASSWORD)
    await signInButton(page).click()
    await expect(loginForm(page).getByRole('alert')).toContainText('tạm dừng 15 phút')
    await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toBeEnabled()
    await loginForm(page).getByRole('button', { name: 'Đặt lại mật khẩu' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quên mật khẩu')
  })

  test('a blocked account goes to the AUTH4 blocked state', async ({ page }) => {
    const email = fresh('blocked')
    await apiAccount(page, email)
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE email_normalized = $1`, [email])
    await open(page)
    await identifier(page).fill(email)
    await password(page).fill(TEST_PASSWORD)
    await signInButton(page).click()
    await expect(page).toHaveURL('/auth/error?reason=blocked')
    await expect(page.locator('[data-auth-error="blocked"]')).toBeVisible()
  })

  test('a pending sign-in disables the form and cannot be submitted twice', async ({ page }) => {
    await ensurePassword('member@example.test')
    let requests = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(LOGIN, async (route: Route) => {
      requests++
      await gate
      await route.continue()
    })
    await open(page)
    await identifier(page).fill('member@example.test')
    await password(page).fill(TEST_PASSWORD)
    await signInButton(page).click()
    await expect(signInButton(page)).toBeDisabled()
    await expect(signInButton(page)).toHaveAttribute('aria-busy', 'true')
    await signInButton(page).click({ force: true })
    expect(requests).toBe(1)
    release()
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
    expect(requests).toBe(1)
  })

  test('rate limit and server failure get their own message and the form recovers', async ({
    page,
  }) => {
    const cases = [
      [429, 'AUTH_RATE_LIMITED', 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.'],
      [500, 'UNCONTRACTED_INTERNAL', 'Chưa thực hiện được. Vui lòng thử lại.'],
    ] as const
    for (const [status, code, text] of cases) {
      await page.route(LOGIN, (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code, message: 'x', request_id: 'req_x' } }),
        }),
      )
      await open(page)
      await identifier(page).fill('member@example.test')
      await password(page).fill(TEST_PASSWORD)
      await signInButton(page).click()
      await expect(loginForm(page).getByRole('alert')).toHaveText(text)
      await expect(signInButton(page)).toBeEnabled()
      await page.unroute(LOGIN)
    }
  })

  test('"Hiện" reveals the password and announces its state', async ({ page }) => {
    await open(page)
    await password(page).fill('abc12345')
    await loginForm(page).getByRole('button', { name: 'Hiện mật khẩu' }).click()
    await expect(password(page)).toHaveAttribute('type', 'text')
    await expect(loginForm(page).getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('keyboard only: wordmark, Google, identifier, password, Enter submits', async ({ page }) => {
    await ensurePassword('member@example.test')
    await open(page)
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="home"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-provider="google"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(identifier(page)).toBeFocused()
    await page.keyboard.type('member@example.test')
    await page.keyboard.press('Tab')
    await expect(password(page)).toBeFocused()
    await page.keyboard.type(TEST_PASSWORD)
    await page.keyboard.press('Enter')
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
  })
})

test.describe('US-01.02 create account', () => {
  test('valid → signed in on the onboarding intro, consents recorded, name kept for stage 1', async ({
    page,
  }) => {
    const email = fresh('reg')
    await open(page)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await fillRegister(page, email)
    await expect(registerForm(page).getByText(/Độ mạnh:/)).toBeVisible()
    await registerForm(page)
      .getByRole('checkbox', { name: /Tôi đồng ý/ })
      .check()
    await registerForm(page).getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(page).toHaveURL('/onboarding')

    const [row] = await query<{ consents: number; name: string; hash: string }>(
      `SELECT (SELECT count(*)::int FROM consent_records c WHERE c.account_id = a.id) AS consents,
              a.signup_full_name AS name, a.password_hash AS hash
         FROM user_accounts a WHERE a.email_normalized = $1`,
      [email],
    )
    expect(row).toMatchObject({ consents: 2, name: 'Nguyễn Văn Chi' })
    expect(row!.hash).toMatch(/^scrypt:/)
    await page.goto('/onboarding/profile')
    await expect(page).toHaveURL('/onboarding/profile')
    await expect(page.getByLabel('Họ và tên')).toHaveValue('Nguyễn Văn Chi')
  })

  test('the field rules block before sending: accents, weak password, mismatch, no consent', async ({
    page,
  }) => {
    let sent = 0
    await page.route(REGISTER, (route) => {
      sent++
      return route.continue()
    })
    await open(page)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await fillRegister(page, 'not-an-email', {
      username: 'chí nguyễn',
      password: 'abcdefgh',
      confirm: 'abcdefgx',
    })
    await registerForm(page).getByRole('button', { name: 'Tạo tài khoản' }).click()
    const form = registerForm(page)
    await expect(form.getByText('Email chưa đúng định dạng.')).toBeVisible()
    await expect(form.getByText(/^Tên tài khoản gồm 4–30 ký tự/)).toBeVisible()
    await expect(form.getByText('Mật khẩu tối thiểu 8 ký tự, có cả chữ và số.')).toBeVisible()
    await expect(form.getByText('Mật khẩu nhập lại không khớp.')).toBeVisible()
    await expect(form.getByText(/Vui lòng đồng ý với Điều khoản/)).toBeVisible()
    await expect(form.getByLabel('Email', { exact: true })).toBeFocused()
    expect(sent).toBe(0)
  })

  test('an e-mail with an account (any case) gets the neutral refusal; a taken username a suggestion', async ({
    page,
  }) => {
    const email = fresh('taken')
    await apiAccount(page, email)
    await open(page)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await fillRegister(page, email.toUpperCase(), { username: `x${Date.now()}` })
    await registerForm(page)
      .getByRole('checkbox', { name: /Tôi đồng ý/ })
      .check()
    await registerForm(page).getByRole('button', { name: 'Tạo tài khoản' }).click()
    // PO decision 3 (DEC-S1A-D11): never says that the e-mail has an account.
    await expect(registerForm(page).getByRole('alert')).toContainText(
      'Không thể tạo tài khoản với thông tin này.',
    )
    await expect(page.getByText(/đã gắn với|đã có tài khoản với email|already/i)).toHaveCount(0)
    await expect(registerForm(page).getByLabel('Email', { exact: true })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )

    const other = fresh('taken2')
    await registerForm(page).getByLabel('Email', { exact: true }).fill(other)
    await registerForm(page).getByLabel('Tên tài khoản').fill(usernameFor(email).toUpperCase())
    await registerForm(page).getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(registerForm(page).getByText('Tên tài khoản đã có người dùng.')).toBeVisible()
    await registerForm(page)
      .getByRole('button', { name: new RegExp(`^${usernameFor(email).replace('.', '\\.')}\\d+$`) })
      .click()
    await registerForm(page).getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(page).toHaveURL('/onboarding')

    // The refusal's "Đăng nhập" action opens sign-in with the typed e-mail filled in.
    await page.context().clearCookies()
    await open(page)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await fillRegister(page, email, { username: `y${Date.now()}` })
    await registerForm(page)
      .getByRole('checkbox', { name: /Tôi đồng ý/ })
      .check()
    await registerForm(page).getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(registerForm(page).getByRole('alert')).toContainText(
      'Không thể tạo tài khoản với thông tin này.',
    )
    await registerForm(page).getByRole('alert').getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(identifier(page)).toHaveValue(email)
  })
})

test.describe('direct API abuse (task sections 13, 14, 21)', () => {
  test('a cross-site style text/plain or form POST cannot sign in or sign up (login CSRF)', async ({
    request,
  }) => {
    await ensurePassword('member@example.test')
    const body = JSON.stringify({ identifier: 'member@example.test', password: TEST_PASSWORD })
    for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
      for (const path of ['/api/v1/auth/login', '/api/v1/auth/register']) {
        const res = await request.post(path, { headers: { 'content-type': type }, data: body })
        expect(res.status(), `${path} ${type}`).toBe(400)
        expect((await res.json()).error.code).toBe('AUTH_VALIDATION_FAILED')
        expect(res.headers()['set-cookie'] ?? '').not.toContain('1hub_session=')
      }
    }
  })

  test('error answers carry the envelope only: no stack, SQL, hash or token', async ({
    request,
  }) => {
    const cases = [
      request.post('/api/v1/auth/login', {
        data: { identifier: "x' OR 1=1 --", password: 'a1b2c3d4' },
      }),
      request.post('/api/v1/auth/register', { data: { email: 'x' } }),
      request.post('/api/v1/auth/password/reset', {
        data: { token: 'forged', password: 'abcd1234', password_confirm: 'abcd1234' },
      }),
      request.post('/api/v1/auth/password/forgot', { data: { identifier: 'member@example.test' } }),
    ]
    for (const res of await Promise.all(cases)) {
      expect([202, 400, 401, 422]).toContain(res.status())
      const text = await res.text()
      expect(text).not.toMatch(/stack|at \/|SELECT|INSERT|scrypt:|token_hash|password_hash/i)
    }
  })
})

test.describe('US-01.05 Google control', () => {
  test('not configured: the control explains itself and starts no provider flow', async ({
    page,
    request,
    context,
  }) => {
    expect(await (await request.get('/api/v1/auth/providers')).json()).toEqual({ providers: [] })
    await open(page)
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await page.getByRole('button', { name: 'Tiếp tục với Google' }).click()
    await expect(page.getByRole('status')).toHaveText(
      'Đăng nhập bằng Google chưa được bật. Vui lòng dùng tên tài khoản hoặc email.',
    )
    await page.waitForTimeout(300)
    expect(requests).toEqual([])
    expect(await context.cookies()).toEqual([])
    const start = await request.get('/api/v1/auth/google/start', { maxRedirects: 0 })
    expect(start.status()).toBe(302)
    expect(start.headers().location).toMatch(/\/auth\?google=unavailable$/)
  })

  test("a callback without this browser's state is refused and signs nobody in", async ({
    request,
  }) => {
    const res = await request.post('/api/v1/auth/google/callback', {
      data: { code: 'forged', state: 'forged' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error.code).toBe('AUTH_GOOGLE_STATE_MISMATCH')
    expect((await (await request.get('/api/v1/session')).json()).authenticated).toBe(false)
  })

  test('cancel on Google returns to sign-in with no red error; a failure explains itself', async ({
    page,
  }) => {
    await page.goto('/auth/callback?error=access_denied&state=x')
    await expect(page).toHaveURL(ROUTE)
    await expect(page.locator('[data-ui="surface"] [role="alert"]')).toHaveCount(0)

    await page.goto('/auth/callback?code=c&state=s')
    await expect(page).toHaveURL('/auth?google=failed')
    await expect(page.getByRole('status')).toHaveText(
      'Chưa đăng nhập được bằng Google. Vui lòng thử lại hoặc đăng nhập bằng tên tài khoản/email.',
    )
  })
})

test.describe('WF01-S01 responsive (1440 / 768 / 390)', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: no overflow, every view keeps its CTA, password and Google controls`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await open(page)
      for (const view of ['login', 'register', 'forgot'] as const) {
        if (view === 'register') await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
        if (view === 'forgot') {
          await registerForm(page).getByRole('button', { name: 'Đăng nhập' }).click()
          await loginForm(page).getByRole('button', { name: 'Quên mật khẩu?' }).click()
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${view} horizontal overflow`).toBeLessThanOrEqual(0)
        const surface = (await page.locator('[data-ui="surface"]').boundingBox())!
        expect(surface.x).toBeGreaterThanOrEqual(0)
        expect(surface.x + surface.width).toBeLessThanOrEqual(width)
        for (const control of await page
          .locator('[data-ui="surface"] button, [data-ui="surface"] input')
          .all()) {
          if (!(await control.isVisible())) continue
          const box = (await control.boundingBox())!
          expect(box.x, `${view} control clipped left`).toBeGreaterThanOrEqual(surface.x - 0.5)
          expect(box.x + box.width, `${view} control clipped`).toBeLessThanOrEqual(
            surface.x + surface.width + 0.5,
          )
        }
        await page.screenshot({
          path: `tests/visual/diff/s1-uat-01/auth-${view}-${width}.png`,
          fullPage: true,
        })
      }
    })
  }
})

test.describe('WF01-S01 pixel QA (AUTH1 shell)', () => {
  test('1440×900: panel, card title, Google control and divider match AUTH1', async ({ page }) => {
    await open(page)
    const REF = { cardTop: 260, googleTop: 352 } as const
    const card = await topOf(page, '[data-ui="surface"]')
    const google = await topOf(page, '[data-provider="google"]')
    const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    await auditRevision(page, {
      name: 'WF01-S01.AUTH1',
      reference: 'design-reference/final/revision/L1/AUTH1__auth-entry__SOURCE.png',
      segments: [
        { name: 'brand-panel', reference: { x: 0, y: 0, width: 560, height: 900 }, dy: 0 },
        { name: 'canvas-left', reference: { x: 560, y: 0, width: 200, height: 900 }, dy: 0 },
        { name: 'canvas-right', reference: { x: 1240, y: 0, width: 200, height: 900 }, dy: 0 },
        {
          name: 'card-top-title',
          reference: { x: 770, y: 252, width: 460, height: 84 },
          dy: card - REF.cardTop,
        },
        {
          name: 'card-google',
          reference: { x: 810, y: 354, width: 380, height: 46 },
          dy: google - REF.googleTop,
        },
        {
          name: 'card-divider',
          reference: { x: 810, y: 418, width: 380, height: 26 },
          dy: google - REF.googleTop,
        },
      ],
      exclude: [
        {
          x: heading.x - 4,
          y: heading.y - 4,
          width: heading.width + 8,
          height: heading.height + 8,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-COPY',
          reason:
            'BD-01 (PO 01/10): the heading reads "Đăng nhập & đăng ký" where AUTH1 draws "Đăng nhập"; its text box is excluded',
        },
        {
          class: 'INTENTIONAL-BUSINESS-CHANGE',
          reason:
            "DEC-S1A-D13 (S1-UAT-01): below the divider the card is the Sprint1 username/email + password form, not AUTH1's e-mail field; no approved reference exists for it, so it is not compared (PO design review pending)",
        },
      ],
    })
  })
})
