import { expect, test, type Page, type Route } from '@playwright/test'

import { auditRevision, topOf } from '../pixel-qa/revision'

/**
 * WF01-S01 — Auth Entry (/auth), presented as the corrected AUTH1 (TASK 22.2).
 *
 * Functional QA drives the real POST /api/v1/auth/magic-link; only the failure
 * cases are simulated with page.route. The pixel run compares the screen with
 * design-reference/final/revision/L1 in segments, so the disabled provider
 * control's "Sắp có" pill and the kept terms notice (DEC-L1-D9 / D3) cannot hide
 * drift anywhere else.
 */

const ROUTE = '/auth'
const MAGIC_LINK = '**/api/v1/auth/magic-link'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 429/500 responses and the invite-only 403 are logged by Chromium as
    // failed resources; they are the scenario under test, not an application error.
    if (m.type() === 'error' && !/status of (403|429|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

async function open(page: Page) {
  const response = await page.goto(ROUTE, { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
}

const emailField = (page: Page) => page.getByLabel('Email', { exact: true })
const submit = (page: Page) => page.getByRole('button', { name: 'Gửi liên kết đăng nhập' })

test.describe('WF01-S01 functional', () => {
  test('/auth resolves the implemented screen, not the placeholder', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible()
    await expect(page.locator('[data-route-group="auth"]')).toHaveCount(1)
    await expect(page.locator('[data-route-placeholder]')).toHaveCount(0)
    await expect(page.getByText('HUB NETWORK', { exact: true })).toBeVisible()
  })

  test('providers=[]: the drawn Google control is disabled, says "Sắp có" and starts nothing (DEC-L1-D9)', async ({
    page,
    request,
  }) => {
    const providers = await (await request.get('/api/v1/auth/providers')).json()
    expect(providers).toEqual({ providers: [] })

    await open(page)
    const google = page.locator('[data-provider="google"]')
    await expect(google).toBeVisible()
    await expect(google).toBeDisabled()
    await expect(google).toContainText('Tiếp tục với Google')
    await expect(google).toContainText('Sắp có')
    await expect(page.getByRole('button', { name: 'Tiếp tục với Google (sắp có)' })).toBeDisabled()
    await expect(page.getByText('hoặc tiếp tục bằng email', { exact: true })).toBeVisible()
    // A forced click on the disabled control sends nothing and stays on /auth.
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await google.click({ force: true })
    await page.waitForTimeout(300)
    expect(requests).toEqual([])
    await expect(page).toHaveURL(ROUTE)
    await expect(page.getByRole('button', { disabled: false })).toHaveCount(1)
    await expect(submit(page)).toBeVisible()
  })

  test('the email field is labelled, typed and described by its error', async ({ page }) => {
    await open(page)
    const field = emailField(page)
    await expect(field).toHaveAttribute('type', 'email')
    await expect(field).toHaveAttribute('autocomplete', 'email')
    await expect(field).toHaveAttribute('placeholder', 'ten@donvi.gov.vn')
    await expect(page.locator('form')).toHaveAttribute('novalidate', '')
  })

  for (const [label, value, message] of [
    ['empty', '', 'Vui lòng nhập email.'],
    ['invalid', 'ten-khong-hop-le', 'Email chưa đúng định dạng.'],
  ] as const) {
    test(`an ${label} email shows an inline error and sends nothing`, async ({ page }) => {
      let requests = 0
      await page.route(MAGIC_LINK, (route) => {
        requests++
        return route.continue()
      })
      await open(page)
      await emailField(page).fill(value)
      await submit(page).click()

      const alert = page.locator('form').getByRole('alert')
      await expect(alert).toHaveText(message)
      await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true')
      const describedBy = await emailField(page).getAttribute('aria-describedby')
      await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(message)
      await expect(emailField(page)).toBeFocused()
      expect(requests).toBe(0)
      await expect(page).toHaveURL(ROUTE)
    })
  }

  test('a valid email posts the contract body with an idempotency key, then goes to WF01-S02', async ({
    page,
  }) => {
    await open(page)
    await emailField(page).fill('newcomer@example.test')
    const [req] = await Promise.all([page.waitForRequest(MAGIC_LINK), submit(page).click()])
    const res = await req.response()

    expect(req.method()).toBe('POST')
    expect(req.postDataJSON()).toEqual({
      email: 'newcomer@example.test',
      return_to: '/auth/callback',
    })
    expect(req.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(res?.status()).toBe(202)

    await expect(page).toHaveURL('/auth/check-email')
    const stored = await page.evaluate(() => sessionStorage.getItem('1hub.auth.pending-request'))
    const pending = JSON.parse(stored!)
    expect(Object.keys(pending).sort()).toEqual([
      'email_masked',
      'expires_in_seconds',
      'request_id',
      'resend_after_seconds',
    ])
    expect(pending.email_masked).toBe('n***@example.test')
    expect(stored).not.toContain('newcomer@example.test')
  })

  test('invite-only (DEC-AUTH-EMAIL-D1): a known address moves on, an unknown one gets the neutral notice', async ({
    page,
  }) => {
    await open(page)
    await emailField(page).fill('member@example.test')
    const [known] = await Promise.all([page.waitForResponse(MAGIC_LINK), submit(page).click()])
    expect(known.status()).toBe(202)
    await expect(page).toHaveURL('/auth/check-email')

    await open(page)
    await emailField(page).fill(`nobody-${Date.now()}@not-provisioned.vn`)
    const [unknown] = await Promise.all([page.waitForResponse(MAGIC_LINK), submit(page).click()])
    expect(unknown.status()).toBe(403)
    await expect(page.locator('.ui-notice[role="alert"]')).toHaveText(
      'Email này chưa được cấp quyền truy cập Internal Alpha.',
    )
    await expect(page).toHaveURL(ROUTE)
    await expect(submit(page)).toBeEnabled()
  })

  test('a pending request disables the form and cannot be submitted twice', async ({ page }) => {
    let requests = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(MAGIC_LINK, async (route: Route) => {
      requests++
      await gate
      await route.continue()
    })
    await open(page)
    await emailField(page).fill('member@example.test')
    await submit(page).click()

    await expect(submit(page)).toBeDisabled()
    await expect(submit(page)).toHaveAttribute('aria-busy', 'true')
    await submit(page).click({ force: true })
    await emailField(page).press('Enter')
    expect(requests).toBe(1)

    release()
    await expect(page).toHaveURL('/auth/check-email')
    expect(requests).toBe(1)
  })

  test('an API failure is announced and the form recovers for a retry', async ({ page }) => {
    await page.route(MAGIC_LINK, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'req_x' },
        }),
      }),
    )
    await open(page)
    await emailField(page).fill('member@example.test')
    await submit(page).click()

    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Chưa gửi được liên kết. Vui lòng thử lại.',
    )
    await expect(submit(page)).toBeEnabled()
    await expect(emailField(page)).toHaveValue('member@example.test')

    await page.unroute(MAGIC_LINK)
    await submit(page).click()
    await expect(page).toHaveURL('/auth/check-email')
  })

  test('the contract rate-limit code gets its own message', async ({ page }) => {
    await page.route(MAGIC_LINK, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'AUTH_RATE_LIMITED', message: 'x', request_id: 'req_x' },
        }),
      }),
    )
    await open(page)
    await emailField(page).fill('member@example.test')
    await submit(page).click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Bạn đã yêu cầu liên kết quá nhiều lần. Vui lòng thử lại sau ít phút.',
    )
    await expect(submit(page)).toBeEnabled()
  })

  test('keyboard only: Tab reaches the field then a visibly focused button, Enter submits', async ({
    page,
  }) => {
    await open(page)
    // P0-SHELL (DEC-P0-SHELL-D1): the wordmark → / is the first Tab stop.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="home"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(emailField(page)).toBeFocused()
    await page.keyboard.type('member@example.test')
    await page.keyboard.press('Tab')
    await expect(submit(page)).toBeFocused()
    const outline = await submit(page).evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')

    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/auth/check-email')
  })
})

test.describe('WF01-S01 pixel QA (corrected AUTH1)', () => {
  test('the terms notice stays under the button until HD-03 is decided', async ({ page }) => {
    await open(page)
    await expect(
      page.getByText(
        'Tiếp tục nghĩa là bạn đồng ý Điều khoản sử dụng và Chính sách quyền riêng tư.',
      ),
    ).toBeVisible()
    // The previous panel's figures are gone with the revision.
    await expect(page.locator('[data-shell="auth-split"] aside')).not.toContainText('bài toán')
  })

  test('1440×900: panel, card title and form match AUTH1', async ({ page }) => {
    await open(page)
    // Reference geometry, measured once from the frozen AUTH1 raster.
    const REF = { cardTop: 260, googleTop: 352, inputTop: 485 } as const
    const card = await topOf(page, '[data-ui="surface"]')
    const google = await topOf(page, '[data-provider="google"]')
    const input = await topOf(page, 'input[type="email"]')
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
          // Mark, label and left edge of the Google control; the "Sắp có" pill (right) is not in AUTH1.
          // Interior rows only: AUTH1 draws the top / bottom edges on a half pixel (P3).
          name: 'card-google',
          reference: { x: 810, y: 354, width: 295, height: 46 },
          dy: google - REF.googleTop,
        },
        {
          name: 'card-google-right-edge',
          reference: { x: 1176, y: 354, width: 14, height: 46 },
          dy: google - REF.googleTop,
        },
        {
          name: 'card-divider',
          reference: { x: 810, y: 418, width: 380, height: 26 },
          dy: google - REF.googleTop,
        },
        {
          name: 'card-form',
          reference: { x: 770, y: 454, width: 460, height: 155 },
          dy: input - REF.inputTop,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS-CONFIG',
          reason:
            'DEC-L1-D9: no provider is configured (GET /api/v1/auth/providers = []), so the drawn Google control is disabled and carries a "Sắp có" pill (not compared); the card is taller by the terms notice and centred',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'DEC-L1-D3: the terms notice the revision drops stays under the button until HD-03 decides where consent notice lives',
        },
      ],
    })
  })
})
