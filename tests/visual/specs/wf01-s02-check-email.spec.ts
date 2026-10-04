import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test'

import { auditRevision, topOf } from '../pixel-qa/revision'

/**
 * WF01-S02 — Check Email (/auth/check-email), presented as the corrected AUTH2
 * (TASK 22.2, DEC-L1-D4).
 *
 * State comes from a REAL POST /api/v1/auth/magic-link; the 202 DTO is placed
 * where WF01-S01 puts it. Time is pinned with page.clock.setFixedTime so the
 * server's resend_after_seconds countdown is deterministic without faking
 * animation frames.
 */

const ROUTE = '/auth/check-email'
const STORAGE_KEY = '1hub.auth.pending-request'
const RESEND = '**/api/v1/auth/magic-link/resend'
const T0 = new Date('2026-09-26T09:00:00+07:00').getTime()

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 409/429/500 responses are the scenario, not application errors.
    if (m.type() === 'error' && !/status of (409|429|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

type Accepted = {
  request_id: string
  email_masked: string
  resend_after_seconds: number
  expires_in_seconds: number
}

async function requestLink(request: APIRequestContext, email: string): Promise<Accepted> {
  const res = await request.post('/api/v1/auth/magic-link', { data: { email } })
  expect(res.status()).toBe(202)
  return (await res.json()) as Accepted
}

/** Places the 202 DTO exactly where WF01-S01 stores it, before any page script runs. */
async function withPending(page: Page, accepted: Accepted) {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem(key!)) sessionStorage.setItem(key!, value!)
    },
    [STORAGE_KEY, JSON.stringify(accepted)],
  )
}

/** Opens S02 at T0 and moves the fixed clock by `seconds`. */
async function openAt(page: Page, seconds = 0) {
  await page.clock.setFixedTime(T0)
  await page.goto(ROUTE, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (seconds > 0) {
    await page.clock.setFixedTime(T0 + seconds * 1000)
  }
}

const resendButton = (page: Page) => page.locator('button', { hasText: /Gửi lại/ })

test.describe('WF01-S02 functional', () => {
  test('S01 → S02 (S1-UAT-01, US-01.04): "Quên mật khẩu?" lands on check-email, masked', async ({
    page,
  }) => {
    await page.goto('/auth', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Quên mật khẩu?' }).click()
    const form = page.getByRole('form', { name: 'Quên mật khẩu' })
    await form.getByLabel('Tên tài khoản hoặc email').fill('newcomer@example.test')
    await form.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()

    await expect(page).toHaveURL(ROUTE)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Kiểm tra hòm thư của bạn' }),
    ).toBeVisible()
    await expect(page.getByText(/liên kết đặt lại mật khẩu/)).toBeVisible()
    await expect(page.getByTestId('email-masked')).toHaveText('n***@example.test')
    await expect(page.getByText('newcomer@example.test')).toHaveCount(0)
  })

  test('shows no token, no raw address and no account-existence signal', async ({
    page,
    request,
  }) => {
    const accepted = await requestLink(request, 'member@example.test')
    await withPending(page, accepted)
    await openAt(page)

    const html = await page.content()
    expect(html).not.toContain('member@example.test')
    expect(html).not.toMatch(/token/i)
    const stored = await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)
    expect(Object.keys(JSON.parse(stored!)).sort()).toEqual([
      'email_masked',
      'expires_in_seconds',
      'request_id',
      'resend_after_seconds',
    ])
  })

  test('anti-enumeration: a known and an unknown address render the same screen', async ({
    browser,
    request,
  }) => {
    const render = async (email: string) => {
      const context = await browser.newContext()
      const page = await context.newPage()
      await withPending(page, await requestLink(request, email))
      await openAt(page)
      const text = (
        await page.locator('section[aria-labelledby], h1, p, button, a').allTextContents()
      )
        .join('|')
        .replace(/\S+\*\*\*@\S+/, 'MASKED')
      await context.close()
      return text
    }
    expect(await render(`nobody-${Date.now()}@example.test`)).toBe(
      await render('member@example.test'),
    )
  })

  test('the resend countdown comes from the server value and gates the button', async ({
    page,
    request,
  }) => {
    const accepted = await requestLink(request, 'member@example.test')
    expect(accepted.resend_after_seconds).toBe(60)
    await withPending(page, accepted)
    await openAt(page)

    await expect(resendButton(page)).toHaveText('Gửi lại sau 1:00')
    await expect(resendButton(page)).toBeDisabled()
    await page.clock.setFixedTime(T0 + 15_000)
    await expect(resendButton(page)).toHaveText('Gửi lại sau 0:45')
    await page.clock.setFixedTime(T0 + 60_000)
    await expect(resendButton(page)).toHaveText('Gửi lại liên kết')
    await expect(resendButton(page)).toBeEnabled()
  })

  test('resend posts the current request id, rotates it and restarts the countdown', async ({
    page,
    request,
  }) => {
    const accepted = await requestLink(request, 'member@example.test')
    await withPending(page, accepted)
    await openAt(page, 60)

    const [req] = await Promise.all([page.waitForRequest(RESEND), resendButton(page).click()])
    expect(req.postDataJSON()).toEqual({ auth_request_id: accepted.request_id })
    expect((await req.response())!.status()).toBe(202)

    await expect(page.getByRole('status')).toHaveText(
      'Đã gửi lại liên kết. Hãy kiểm tra hộp thư của bạn.',
    )
    await expect(resendButton(page)).toHaveText('Gửi lại sau 1:00')
    const stored = JSON.parse(
      (await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY))!,
    ) as Accepted
    expect(stored.request_id).not.toBe(accepted.request_id)
    expect(stored.email_masked).toBe(accepted.email_masked)
  })

  test('a pending resend is busy and cannot be sent twice', async ({ page, request }) => {
    let requests = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(RESEND, async (route: Route) => {
      requests++
      await gate
      await route.continue()
    })
    await withPending(page, await requestLink(request, 'member@example.test'))
    await openAt(page, 60)

    await resendButton(page).click()
    await expect(resendButton(page)).toBeDisabled()
    await expect(resendButton(page)).toHaveAttribute('aria-busy', 'true')
    await resendButton(page).click({ force: true })
    expect(requests).toBe(1)
    release()
    await expect(page.getByRole('status')).toBeVisible()
    expect(requests).toBe(1)
  })

  for (const [label, status, code, message] of [
    [
      'a failure is recoverable',
      500,
      'UNCONTRACTED_INTERNAL',
      'Chưa gửi lại được liên kết. Vui lòng thử lại.',
    ],
    [
      'rate limiting has its own message',
      429,
      'AUTH_RATE_LIMITED',
      'Bạn đã yêu cầu liên kết quá nhiều lần. Vui lòng thử lại sau ít phút.',
    ],
    [
      'a stale request asks for the email again',
      409,
      'AUTH_LINK_ALREADY_USED',
      'Yêu cầu này không còn hiệu lực. Hãy nhập lại email.',
    ],
  ] as const) {
    test(`resend: ${label}`, async ({ page, request }) => {
      await page.route(RESEND, (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code, message: 'x', request_id: 'req_x' } }),
        }),
      )
      await withPending(page, await requestLink(request, 'member@example.test'))
      await openAt(page, 60)
      await resendButton(page).click()
      await expect(page.getByText(message)).toBeVisible()
      await expect(page.getByText(message)).toHaveAttribute('role', 'alert')
      await expect(resendButton(page)).toBeEnabled()
    })
  }

  test('"Dùng email khác" returns to /auth', async ({ page, request }) => {
    await withPending(page, await requestLink(request, 'member@example.test'))
    await openAt(page)
    await page.getByRole('link', { name: 'Dùng email khác' }).click()
    await expect(page).toHaveURL('/auth')
    await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible()
  })

  test('direct entry without a pending request returns to /auth', async ({ page }) => {
    await page.goto(ROUTE)
    await expect(page).toHaveURL('/auth')
    await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible()
  })

  test('keyboard: Tab reaches resend then the change-email link, both visibly focused', async ({
    page,
    request,
  }) => {
    await withPending(page, await requestLink(request, 'member@example.test'))
    await openAt(page, 60)
    // The countdown re-evaluates on its next one-second tick.
    await expect(resendButton(page)).toBeEnabled()
    // P0-SHELL (DEC-P0-SHELL-D1): the wordmark → / is the first Tab stop.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="home"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(resendButton(page)).toBeFocused()
    expect(await resendButton(page).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
      'none',
    )
    await page.keyboard.press('Tab')
    const link = page.getByRole('link', { name: 'Dùng email khác' })
    await expect(link).toBeFocused()
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/auth')
  })

  test('renders no "Mở Gmail" action, which is not a WF01-S02 contract action', async ({
    page,
    request,
  }) => {
    await withPending(page, await requestLink(request, 'member@example.test'))
    await openAt(page)
    await expect(page.getByText(/Gmail/)).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(1)
  })
})

test.describe('WF01-S02 pixel QA (corrected AUTH2)', () => {
  test('1440×900: panel, card head and resend block match AUTH2', async ({ page }) => {
    // The reference address, as QA data only: the 202 DTO is built as WF01-S01
    // stores it, so no e-mail is sent to an address the suite does not own.
    await withPending(page, {
      request_id: `authreq_${crypto.randomUUID()}`,
      email_masked: 'c***@tracely.vn',
      resend_after_seconds: 60,
      expires_in_seconds: 900,
    })
    await openAt(page, 15)
    await expect(resendButton(page)).toHaveText('Gửi lại sau 0:45')
    // Reference geometry, measured once from the frozen AUTH2 raster.
    const REF = { cardTop: 237, dividerTop: 554 } as const
    const card = await topOf(page, '[data-ui="surface"]')
    const divider = await topOf(page, 'hr')
    const address = (await page.getByTestId('email-masked').boundingBox())!
    await auditRevision(page, {
      name: 'WF01-S02.AUTH2',
      reference: 'design-reference/final/revision/L1/AUTH2__check-email__SOURCE.png',
      segments: [
        { name: 'brand-panel', reference: { x: 0, y: 0, width: 560, height: 900 }, dy: 0 },
        { name: 'canvas-left', reference: { x: 560, y: 0, width: 200, height: 900 }, dy: 0 },
        { name: 'canvas-right', reference: { x: 1240, y: 0, width: 200, height: 900 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 770, y: 229, width: 460, height: 243 },
          dy: card - REF.cardTop,
        },
        {
          name: 'card-resend',
          reference: { x: 770, y: 548, width: 460, height: 125 },
          dy: divider - REF.dividerTop,
        },
      ],
      // The masked address differs from the reference's full address by contract.
      exclude: [{ x: address.x - 2, y: address.y - 2, width: 400, height: address.height + 4 }],
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS-CONTRACT',
          reason:
            '"Mở Gmail" is not rendered: WF01-S02 contract actions are resend and change_email only; the card is shorter and centred',
        },
        {
          class: 'INTENTIONAL-BUSINESS-CONTRACT',
          reason: 'The address is the API email_masked field, not the full address in the bitmap',
        },
        {
          class: 'INTENTIONAL-A11Y',
          reason:
            'DEC-L1-D4: the spam reminder is plain text; the reference underlines it but it leads nowhere',
        },
      ],
    })
  })
})
