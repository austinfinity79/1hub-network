import { expect, test, type Page, type Route } from '@playwright/test'

import { auditRevision, topOf } from '../pixel-qa/revision'

/**
 * WF01-S01 — Auth Entry (/auth), presented as the corrected AUTH1 (TASK 22.2).
 *
 * Functional QA drives the real POST /api/v1/auth/magic-link; only the failure
 * cases are simulated with page.route. The pixel run compares the screen with
 * design-reference/final/revision/L1 in segments. Sign-up is open
 * (DEC-L1R-D1) and the Google control is drawn without a provider (D-G1).
 */

const ROUTE = '/auth'
const MAGIC_LINK = '**/api/v1/auth/magic-link'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 429/500 responses are logged by Chromium as failed resources;
    // they are the scenario under test, not an application error.
    if (m.type() === 'error' && !/status of (429|500)/.test(m.text())) consoleErrors.push(m.text())
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

  test('H. providers=[]: the Google control is drawn, signs nobody in and says why (D-G1)', async ({
    page,
    request,
    context,
  }) => {
    const providers = await (await request.get('/api/v1/auth/providers')).json()
    expect(providers).toEqual({ providers: [] })

    await open(page)
    const google = page.getByRole('button', { name: 'Tiếp tục với Google' })
    await expect(google).toBeVisible()
    await expect(google).toBeEnabled()
    await expect(page.locator('[data-provider="google"]')).not.toContainText('Sắp có')
    await expect(page.getByText('hoặc tiếp tục bằng email', { exact: true })).toBeVisible()
    // Pressing it starts no request and no provider flow, and creates no session.
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await google.click()
    await expect(page.getByRole('status')).toHaveText(
      'Đăng nhập bằng Google chưa được bật. Vui lòng tiếp tục bằng email.',
    )
    await expect(emailField(page)).toBeFocused()
    await page.waitForTimeout(300)
    expect(requests).toEqual([])
    await expect(page).toHaveURL(ROUTE)
    expect(await context.cookies()).toEqual([])
    expect((await (await request.get('/api/v1/session')).json()).authenticated).toBe(false)
  })

  test('D. open sign-up (DEC-L1R-D1): a known and a new address both move on', async ({ page }) => {
    await open(page)
    await emailField(page).fill('member@example.test')
    const [known] = await Promise.all([page.waitForResponse(MAGIC_LINK), submit(page).click()])
    expect(known.status()).toBe(202)
    await expect(page).toHaveURL('/auth/check-email')

    await open(page)
    await emailField(page).fill(`nobody-${Date.now()}@open-signup.vn`)
    const [unknown] = await Promise.all([page.waitForResponse(MAGIC_LINK), submit(page).click()])
    expect(unknown.status()).toBe(202)
    await expect(page.locator('.ui-notice[role="alert"]')).toHaveCount(0)
    await expect(page).toHaveURL('/auth/check-email')
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
    // The Google control is a real button since D-G1, so it takes its place in the order.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-provider="google"]')).toBeFocused()
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
  test('no terms line under the button: acceptance is recorded in onboarding stage 4', async ({
    page,
  }) => {
    await open(page)
    await expect(page.locator('[data-ui="surface"]')).not.toContainText(/đồng ý|Điều khoản/)
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
          // Interior rows only: AUTH1 draws the top / bottom edges on a half pixel (P3).
          name: 'card-google',
          reference: { x: 810, y: 354, width: 380, height: 46 },
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
        {
          name: 'card-bottom',
          reference: { x: 770, y: 604, width: 460, height: 80 },
          dy: input - REF.inputTop,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS-CONFIG',
          reason:
            'D-G1: no OAuth client is configured (GET /api/v1/auth/providers = []), so the Google control is drawn as in AUTH1 and signs nobody in; pressing it shows a note under it',
        },
      ],
    })
  })
})
