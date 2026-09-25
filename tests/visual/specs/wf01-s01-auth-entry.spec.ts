import path from 'node:path'

import { expect, test, type Page, type Route } from '@playwright/test'

import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { readPng } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S01 — Auth Entry (/auth). Production screen, strict reference.
 *
 * Functional QA drives the real POST /api/v1/auth/magic-link; only the failure
 * cases are simulated with page.route. The pixel run uses the M0-T11 manifest
 * runner, then compares the screen in segments so the approved omission of the
 * unconfigured provider block cannot hide drift anywhere else.
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
const submit = (page: Page) => page.getByRole('button', { name: 'Gửi link đăng nhập' })

test.describe('WF01-S01 functional', () => {
  test('/auth resolves the implemented screen, not the placeholder', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Vào HUB NETWORK' })).toBeVisible()
    await expect(page.locator('[data-route-group="auth"]')).toHaveCount(1)
    await expect(page.locator('[data-route-placeholder]')).toHaveCount(0)
    await expect(page.getByText('HUB NETWORK', { exact: true })).toBeVisible()
  })

  test('providers=[] renders the email-only path with no provider UI', async ({
    page,
    request,
  }) => {
    const providers = await (await request.get('/api/v1/auth/providers')).json()
    expect(providers).toEqual({ providers: [] })

    await open(page)
    await expect(page.getByText(/Google/i)).toHaveCount(0)
    await expect(page.getByText('hoặc dùng email')).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(1)
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

  test('anti-enumeration: a known and an unknown address get the same outcome', async ({
    page,
  }) => {
    const outcome = async (email: string) => {
      await page.context().clearCookies()
      await open(page)
      await emailField(page).fill(email)
      const [req] = await Promise.all([page.waitForRequest(MAGIC_LINK), submit(page).click()])
      const res = await req.response()
      await expect(page).toHaveURL('/auth/check-email')
      return { status: res!.status(), keys: Object.keys(await res!.json()).sort() }
    }
    const known = await outcome('member@example.test')
    const unknown = await outcome(`nobody-${Date.now()}@example.test`)
    expect(unknown).toEqual(known)
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
      'Chưa gửi được link. Vui lòng thử lại.',
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
      'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.',
    )
    await expect(submit(page)).toBeEnabled()
  })

  test('keyboard only: Tab reaches the field then a visibly focused button, Enter submits', async ({
    page,
  }) => {
    await open(page)
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

test.describe('WF01-S01 pixel QA', () => {
  /** Measured once from the frozen reference, not from the implementation. */
  const REF = { cardTop: 146, inputTop: 426 } as const

  test('manifest-driven capture, typography contract and segment comparison', async ({ page }) => {
    const { screens } = loadManifest()
    const reports = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S01'),
      qaConfigFor('WF01-S01')!,
    )
    const viewport = reports.find((r) => r.capture === 'viewport')!

    // V0 conditions and the DOM typography contract are hard gates.
    expect(viewport.conditions).toEqual({
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      fonts: 'loaded',
    })
    expect(viewport.comparison.status).not.toBe('DIMENSION_MISMATCH')
    expect(viewport.typography!.violations).toEqual([])
    expect(viewport.typography!.checked).toBeGreaterThan(10)

    // The text mask absorbs glyph differences, so line structure is asserted on
    // its own: blocks the approved reference breaks deliberately must render the
    // same number of lines (measured from the reference raster).
    const lines = (selector: string) =>
      page.locator(selector).evaluate((el) => {
        const cs = getComputedStyle(el)
        return Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight))
      })
    expect(await lines('[data-shell="auth-split"] aside > p')).toBe(1) // wordmark
    expect(await lines('[data-shell="auth-split"] aside .type-display')).toBe(3) // headline
    expect(await lines('[data-shell="auth-split"] aside .type-body-sm')).toBe(2) // pitch note
    for (const p of await page.locator('[data-shell="auth-split"] aside .type-meta-xs p').all()) {
      expect(await p.evaluate((el) => el.getBoundingClientRect().height)).toBe(18) // footnotes
    }
    expect(await lines('h1')).toBe(1)
    await expect(
      page.locator('[data-shell="auth-split"] aside .type-body-sm span').first(),
    ).toHaveText('12 bài toán đang mở · 9 doanh nghiệp và 3 sở ngành ·')

    // Geometry from the live DOM, to align the segments.
    const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!
    const card = await box('[data-ui="surface"]')
    const input = await box('input[type="email"]')
    const upperDy = Math.round(card.y) - REF.cardTop
    const lowerDy = Math.round(input.y) - REF.inputTop

    // Every element that renders text, as capture-space rectangles.
    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const push = (r: DOMRect, pad = 2) =>
        rects.push({
          x: r.x - pad,
          y: r.y - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        })
      for (const el of document.querySelectorAll(
        'h1, p, label, .ui-button > span, .ui-notice span span, [role="alert"]',
      )) {
        push(el.getBoundingClientRect())
      }
      // Placeholder glyphs sit inside the field's padding box, not on its border.
      const field = document.querySelector('input[type="email"]')!.getBoundingClientRect()
      rects.push({
        x: field.x + 8,
        y: field.y + 6,
        width: field.width - 16,
        height: field.height - 12,
      })
      return rects
    })

    const segments: Segment[] = [
      { name: 'brand-panel', reference: { x: 0, y: 0, width: 560, height: 900 }, dy: 0 },
      { name: 'canvas-left', reference: { x: 560, y: 0, width: 200, height: 900 }, dy: 0 },
      { name: 'canvas-right', reference: { x: 1240, y: 0, width: 200, height: 900 }, dy: 0 },
      { name: 'card-upper', reference: { x: 760, y: 120, width: 480, height: 165 }, dy: upperDy },
      { name: 'card-lower', reference: { x: 760, y: 395, width: 480, height: 405 }, dy: lowerDy },
    ]
    const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
    const actual = readPng(path.join(REPO_ROOT, viewport.images.ACTUAL))
    const diffPath = resolveOutputPath('diff', 'WF01-S01.segments.diff.png')
    const results = compareSegments(reference, actual, segments, textMask, { diffPath })

    writeJsonReport('WF01-S01.segments.json', {
      screen_id: 'WF01-S01',
      images: {
        REFERENCE: viewport.images.REFERENCE,
        ACTUAL: viewport.images.ACTUAL,
        DIFF_FULL: viewport.images.DIFF,
        DIFF_SEGMENTS: path.relative(REPO_ROOT, diffPath),
      },
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS-CONFIG',
          reference_region: { x: 760, y: 285, width: 480, height: 110 },
          reason:
            'Provider CTA and "hoặc dùng email" divider omitted: WF01 contract renders a provider entry only if configured, and GET /api/v1/auth/providers returns []',
          vertical_effect_px: { card_upper_dy: upperDy, card_lower_dy: lowerDy },
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

    // Outside text, every compared region must be at raster-noise level.
    for (const r of results) {
      expect(r.outside_ratio, `${r.name} geometry/surface drift`).toBeLessThan(0.002)
    }
  })
})
