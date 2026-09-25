import path from 'node:path'

import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test'

import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { readPng } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S02 — Check Email (/auth/check-email). Production screen, strict.
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
  test('S01 → S02: submitting an email lands on check-email with the masked address', async ({
    page,
  }) => {
    await page.goto('/auth', { waitUntil: 'networkidle' })
    await page.getByLabel('Email', { exact: true }).fill('newcomer@example.test')
    await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click()

    await expect(page).toHaveURL(ROUTE)
    await expect(page.getByRole('heading', { level: 1, name: 'Mở hộp thư của bạn' })).toBeVisible()
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
    await expect(resendButton(page)).toHaveText('Gửi lại link')
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
      'Đã gửi lại link. Hãy kiểm tra hộp thư của bạn.',
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
      'Chưa gửi lại được link. Vui lòng thử lại.',
    ],
    [
      'rate limiting has its own message',
      429,
      'AUTH_RATE_LIMITED',
      'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.',
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

  test('"Đổi email khác" returns to /auth', async ({ page, request }) => {
    await withPending(page, await requestLink(request, 'member@example.test'))
    await openAt(page)
    await page.getByRole('link', { name: 'Đổi email khác' }).click()
    await expect(page).toHaveURL('/auth')
    await expect(page.getByRole('heading', { level: 1, name: 'Vào HUB NETWORK' })).toBeVisible()
  })

  test('direct entry without a pending request returns to /auth', async ({ page }) => {
    await page.goto(ROUTE)
    await expect(page).toHaveURL('/auth')
    await expect(page.getByRole('heading', { level: 1, name: 'Vào HUB NETWORK' })).toBeVisible()
  })

  test('keyboard: Tab reaches resend then the change-email link, both visibly focused', async ({
    page,
    request,
  }) => {
    await withPending(page, await requestLink(request, 'member@example.test'))
    await openAt(page, 60)
    // The countdown re-evaluates on its next one-second tick.
    await expect(resendButton(page)).toBeEnabled()
    await page.keyboard.press('Tab')
    await expect(resendButton(page)).toBeFocused()
    expect(await resendButton(page).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
      'none',
    )
    await page.keyboard.press('Tab')
    const link = page.getByRole('link', { name: 'Đổi email khác' })
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

test.describe('WF01-S02 pixel QA', () => {
  /** Measured once from the frozen reference, not from the implementation. */
  const REF = { cardTop: 160, dividerTop: 452 } as const

  test('manifest-driven capture, typography contract and segment comparison', async ({
    page,
    request,
  }) => {
    const { screens } = loadManifest()
    // The reference address, as QA data only; a request creates no account.
    const accepted = await requestLink(request, 'chi.dang@tracely.vn')
    const reports = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S02'),
      qaConfigFor('WF01-S02')!,
      {
        beforeNavigate: async (p) => {
          await withPending(p, accepted)
          await p.clock.setFixedTime(T0)
        },
        afterLoad: async (p) => {
          await p.clock.setFixedTime(T0 + 15_000)
          await expect(resendButton(p)).toHaveText('Gửi lại sau 0:45')
        },
      },
    )
    const viewport = reports.find((r) => r.capture === 'viewport')!

    expect(viewport.conditions).toEqual({
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      fonts: 'loaded',
    })
    expect(viewport.comparison.status).not.toBe('DIMENSION_MISMATCH')
    expect(viewport.typography!.violations).toEqual([])
    expect(viewport.typography!.checked).toBeGreaterThan(10)

    const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!
    const card = await box('[data-ui="surface"]')
    const divider = await box('hr')
    const upperDy = Math.round(card.y) - REF.cardTop
    const lowerDy = Math.round(divider.y) - REF.dividerTop

    const textMask: Rect[] = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, p, li, a, button')].map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 }
      }),
    )

    const segments: Segment[] = [
      { name: 'brand-panel', reference: { x: 0, y: 0, width: 560, height: 900 }, dy: 0 },
      { name: 'canvas-left', reference: { x: 560, y: 0, width: 200, height: 900 }, dy: 0 },
      { name: 'canvas-right', reference: { x: 1240, y: 0, width: 200, height: 900 }, dy: 0 },
      { name: 'card-upper', reference: { x: 760, y: 130, width: 480, height: 240 }, dy: upperDy },
      { name: 'card-lower', reference: { x: 760, y: 440, width: 480, height: 345 }, dy: lowerDy },
    ]
    const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
    const actual = readPng(path.join(REPO_ROOT, viewport.images.ACTUAL))
    const diffPath = resolveOutputPath('diff', 'WF01-S02.segments.diff.png')
    const results = compareSegments(reference, actual, segments, textMask, { diffPath })

    writeJsonReport('WF01-S02.segments.json', {
      screen_id: 'WF01-S02',
      images: {
        REFERENCE: viewport.images.REFERENCE,
        ACTUAL: viewport.images.ACTUAL,
        DIFF_FULL: viewport.images.DIFF,
        DIFF_SEGMENTS: path.relative(REPO_ROOT, diffPath),
      },
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS-CONTRACT',
          reference_region: { x: 760, y: 370, width: 480, height: 70 },
          reason:
            '"Mở Gmail" button omitted: WF01-S02 Screen Contract actions are resend and change_email only',
          vertical_effect_px: { card_upper_dy: upperDy, card_lower_dy: lowerDy },
        },
        {
          class: 'INTENTIONAL-BUSINESS-CONTRACT',
          reason:
            'Address shown as the API email_masked field (c***@tracely.vn), not the full address in the bitmap',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason:
            'Reference raster predates the frozen APEC font stack; DOM typography contract passed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })

    for (const r of results) {
      expect(r.outside_ratio, `${r.name} geometry/surface drift`).toBeLessThan(0.002)
    }
  })
})
