import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { readPng } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S05 — Onboarding Purpose (/onboarding/purpose). Production.
 * Decisions DEC-WF01-S05-D1..D6 (docs/decisions/DECISION_LOG.md).
 *
 * Functional tests use a fresh account each, so no test depends on another's
 * writes. Pixel QA uses the seeded newcomer (reset by runScreenQa) with the
 * first option selected, the state the approved reference shows; nothing is
 * submitted.
 */

const INTENT_API = '/api/v1/me/onboarding/intent'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 422/500 answers are the scenario under test.
    if (m.type() === 'error' && !/status of (422|500)/.test(m.text())) consoleErrors.push(m.text())
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

/** Signs a brand-new account in through the real magic-link flow; returns its id. */
async function signInFresh(page: Page): Promise<string> {
  const email = `s05-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const response = await page.request.post('/dev/login', { data: { email } })
  expect(response.ok()).toBe(true)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return row!.id
}

async function storedIntent(accountId: string): Promise<string | null | undefined> {
  const rows = await query<{ primary_intent: string | null }>(
    'SELECT primary_intent FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  return rows[0]?.primary_intent
}

const radio = (page: Page, code: string) => page.locator(`input[value="${code}"]`)
const continueButton = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' })

async function openPurpose(page: Page) {
  await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bạn đến HUB để làm gì?')
}

test.describe('WF01-S05 functional', () => {
  test('D5: a guest is sent to /auth by the server', async ({ page }) => {
    await page.goto('/onboarding/purpose')
    await expect(page).toHaveURL('/auth')
  })

  test('D1: exactly the four P0 options with approved copy; no investor option', async ({
    page,
  }) => {
    await signInFresh(page)
    await openPurpose(page)
    const values = await page
      .locator('input[name="primary_intent"]')
      .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
    expect(values).toEqual([
      'SUBMIT_SOLUTION',
      'POST_CHALLENGE',
      'ORGANIZE_COMMUNITY',
      'EXPLORE_NETWORK',
    ])
    await expect(page.getByText('Tôi có giải pháp và muốn nộp cho bài toán')).toBeVisible()
    await expect(page.getByText('Đơn vị tôi có bài toán cần giải')).toBeVisible()
    await expect(page.getByText('Tôi tổ chức cộng đồng ở địa phương')).toBeVisible()
    await expect(page.getByText('Tôi chỉ muốn xem trước đã')).toBeVisible()
    const text = (await page.locator('body').innerText()).toLowerCase()
    expect(text).not.toContain('nhà đầu tư')
    expect(text).not.toContain('dataroom')
  })

  test('D4: nothing is selected by default and Continue is disabled', async ({ page }) => {
    await signInFresh(page)
    await openPurpose(page)
    await expect(page.locator('input[name="primary_intent"]:checked')).toHaveCount(0)
    await expect(continueButton(page)).toBeDisabled()
  })

  test('selecting, then changing, keeps exactly one choice', async ({ page }) => {
    await signInFresh(page)
    await openPurpose(page)
    await page.getByText('Tôi có giải pháp và muốn nộp cho bài toán').click()
    await expect(radio(page, 'SUBMIT_SOLUTION')).toBeChecked()
    await page.getByText('Tôi tổ chức cộng đồng ở địa phương').click()
    await expect(radio(page, 'ORGANIZE_COMMUNITY')).toBeChecked()
    await expect(page.locator('input[name="primary_intent"]:checked')).toHaveCount(1)
    await expect(continueButton(page)).toBeEnabled()
  })

  test('D2: Continue persists only the code, then moves to /onboarding/profile', async ({
    page,
  }) => {
    const accountId = await signInFresh(page)
    await openPurpose(page)
    await page.getByText('Đơn vị tôi có bài toán cần giải').click()
    await continueButton(page).click()
    await expect(page).toHaveURL('/onboarding/profile')
    const rows = await query<{
      primary_intent: string
      status: string
      onboarding_completed_at: Date | null
    }>(
      `SELECT primary_intent, status::text, onboarding_completed_at
         FROM individual_profiles WHERE account_id = $1`,
      [accountId],
    )
    expect(rows).toEqual([
      { primary_intent: 'POST_CHALLENGE', status: 'DRAFT', onboarding_completed_at: null },
    ])
  })

  test('D3 (amended by DEC-WF01-RESUME-D1): skip records the step, never an intent, and moves to S06', async ({
    page,
  }) => {
    const accountId = await signInFresh(page)
    const bodies: unknown[] = []
    page.on('request', (r) => {
      if (r.url().includes(INTENT_API)) bodies.push(r.postDataJSON())
    })
    await openPurpose(page)
    await page.getByRole('button', { name: 'Bỏ qua, làm sau' }).click()
    await expect(page).toHaveURL('/onboarding/profile')
    expect(bodies).toEqual([{ action: 'SKIP' }])
    expect(await storedIntent(accountId)).toBeNull()
    const [row] = await query<{ recorded: boolean }>(
      'SELECT purpose_step_completed_at IS NOT NULL AS recorded FROM individual_profiles WHERE account_id = $1',
      [accountId],
    )
    expect(row!.recorded).toBe(true)
    // The Purpose step is done; onboarding is not.
    const state = await page.request.get('/api/v1/me/onboarding')
    expect(await state.json()).toEqual({ completed: false, current_step: 'PROFILE', intent: null })
  })

  test('D1: the server rejects INVESTOR and unknown values with 422, writing nothing', async ({
    page,
  }) => {
    const accountId = await signInFresh(page)
    for (const value of ['INVESTOR', 'UNKNOWN', 'explore_network', '', null]) {
      const response = await page.request.put(INTENT_API, { data: { primary_intent: value } })
      expect(response.status(), JSON.stringify(value)).toBe(422)
      expect((await response.json()).error.code).toBe('PROFILE_VALIDATION_FAILED')
    }
    expect(await storedIntent(accountId)).toBeUndefined()
  })

  test('the intent endpoints refuse a guest', async ({ page }) => {
    const put = await page.request.put(INTENT_API, { data: { primary_intent: 'EXPLORE_NETWORK' } })
    expect(put.status()).toBe(401)
    expect((await page.request.get('/api/v1/me/onboarding')).status()).toBe(401)
  })

  test('a rejected value surfaces inline and the user can choose again', async ({ page }) => {
    await signInFresh(page)
    await openPurpose(page)
    await page.route(`**${INTENT_API}`, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'PROFILE_VALIDATION_FAILED', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.getByText('Tôi chỉ muốn xem trước đã').click()
    await continueButton(page).click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Lựa chọn này chưa được hỗ trợ. Vui lòng chọn lại.',
    )
    await expect(page).toHaveURL('/onboarding/purpose')
  })

  test('an API failure is recoverable: error shown, retry succeeds', async ({ page }) => {
    const accountId = await signInFresh(page)
    await openPurpose(page)
    await page.route(`**${INTENT_API}`, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.getByText('Tôi chỉ muốn xem trước đã').click()
    await continueButton(page).click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Chưa lưu được lựa chọn. Vui lòng thử lại.',
    )
    await expect(radio(page, 'EXPLORE_NETWORK')).toBeChecked()
    await expect(continueButton(page)).toBeEnabled()
    expect(await storedIntent(accountId)).toBeUndefined()

    await page.unroute(`**${INTENT_API}`)
    await continueButton(page).click()
    await expect(page).toHaveURL('/onboarding/profile')
    expect(await storedIntent(accountId)).toBe('EXPLORE_NETWORK')
  })

  test('repeated submits send one request', async ({ page }) => {
    await signInFresh(page)
    await openPurpose(page)
    let writes = 0
    await page.route(`**${INTENT_API}`, async (route) => {
      writes++
      await new Promise((done) => setTimeout(done, 400))
      await route.continue()
    })
    await page.getByText('Tôi có giải pháp và muốn nộp cho bài toán').click()
    await page.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
      form.requestSubmit()
      form.requestSubmit()
    })
    await expect(page).toHaveURL('/onboarding/profile')
    expect(writes).toBe(1)
  })

  test('D4/D6: a saved intent is preselected and can be edited before completion', async ({
    page,
  }) => {
    const accountId = await signInFresh(page)
    const put = await page.request.put(INTENT_API, { data: { primary_intent: 'POST_CHALLENGE' } })
    expect(put.status()).toBe(200)

    await openPurpose(page)
    await expect(radio(page, 'POST_CHALLENGE')).toBeChecked()
    await expect(continueButton(page)).toBeEnabled()

    await page.getByText('Tôi tổ chức cộng đồng ở địa phương').click()
    await continueButton(page).click()
    await expect(page).toHaveURL('/onboarding/profile')
    expect(await storedIntent(accountId)).toBe('ORGANIZE_COMMUNITY')
  })

  test('D6: completed onboarding follows the existing rule to /me', async ({ page }) => {
    const accountId = await signInFresh(page)
    await page.request.put(INTENT_API, { data: { primary_intent: 'EXPLORE_NETWORK' } })
    await query(
      `UPDATE individual_profiles SET status = 'ACTIVE', onboarding_completed_at = now() WHERE account_id = $1`,
      [accountId],
    )
    await page.goto('/onboarding/purpose')
    await expect(page).toHaveURL('/me')
  })

  test('keyboard: radios by arrow keys, visible focus, Enter submits', async ({ page }) => {
    const accountId = await signInFresh(page)
    await openPurpose(page)
    // P0-SHELL (DEC-P0-SHELL-D1): the wordmark → / is the first Tab stop.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="home"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Bỏ qua, làm sau' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(radio(page, 'SUBMIT_SOLUTION')).toBeFocused()
    expect(
      await radio(page, 'SUBMIT_SOLUTION').evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none')
    await page.keyboard.press('Space')
    await expect(radio(page, 'SUBMIT_SOLUTION')).toBeChecked()
    await page.keyboard.press('ArrowDown')
    await expect(radio(page, 'POST_CHALLENGE')).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(continueButton(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/onboarding/profile')
    expect(await storedIntent(accountId)).toBe('POST_CHALLENGE')
  })

  test('a11y: one h1, a named radio group, named radios, current step marked', async ({ page }) => {
    await signInFresh(page)
    await openPurpose(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    const group = page.getByRole('group', { name: 'Mục đích chính của bạn' })
    await expect(group.getByRole('radio')).toHaveCount(4)
    await expect(
      page.getByRole('radio', { name: /Tôi có giải pháp và muốn nộp cho bài toán/ }),
    ).toBeVisible()
    await expect(page.locator('[aria-current="step"]')).toHaveText(/Vai trò/)
  })

  test('key text colours match the approved inks', async ({ page }) => {
    await signInFresh(page)
    await openPurpose(page)
    await page.getByText('Tôi có giải pháp và muốn nộp cho bài toán').click()
    const colours = await page.evaluate(() => {
      // Resolves any computed colour syntax to sRGB 0-255 through a canvas.
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const rgb = (el: Element | null) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = getComputedStyle(el!).color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const title = (code: string) => document.querySelector(`[data-intent="${code}"] span span`)
      return {
        title: rgb(document.querySelector('h1')),
        lede: rgb(document.querySelector('h1 + p')),
        option: rgb(title('POST_CHALLENGE')),
        selected: rgb(title('SUBMIT_SOLUTION')),
        cta: rgb(document.querySelector('button[type="submit"]')),
      }
    })
    // Inks read from the approved WF01-S05 bitmap; +-3 per channel for raster rounding.
    const APPROVED: Record<keyof typeof colours, [number, number, number]> = {
      title: [0x17, 0x00, 0x02],
      lede: [0x53, 0x40, 0x41],
      option: [0x17, 0x00, 0x02],
      selected: [0x17, 0x00, 0x02],
      cta: [0x16, 0x00, 0x02],
    }
    for (const key of Object.keys(APPROVED) as (keyof typeof colours)[]) {
      colours[key].forEach((channel, i) => {
        expect(Math.abs(channel - APPROVED[key][i]!), `${key} channel ${i}`).toBeLessThanOrEqual(3)
      })
    }
  })
})

test.describe('WF01-S05 pixel QA', () => {
  /**
   * Measured once from the frozen reference, not from the implementation.
   * The investor option (reference y 547-631) is INTENTIONAL-P0-SCOPE; below
   * it everything moves up by its height plus one gap.
   */
  const REF = {
    investor: { x: 340, y: 541, width: 760, height: 95 },
    dividerTop: 749,
    discs: [544, 661, 798],
    connectors: [625, 762],
  } as const

  test('manifest-driven capture, typography contract and segment comparison', async ({ page }) => {
    const { screens } = loadManifest()
    const reports = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S05'),
      qaConfigFor('WF01-S05')!,
      {
        afterLoad: async (p) => {
          // The reference shows the first option selected; selecting submits nothing.
          await p.getByText('Tôi có giải pháp và muốn nộp cho bài toán').click()
          await p.mouse.move(0, 0)
          await expect(radio(p, 'SUBMIT_SOLUTION')).toBeChecked()
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

    const divider = (await page.locator('hr').boundingBox())!
    const lowerDy = Math.round(divider.y) - REF.dividerTop
    // Stepper labels are wider in the frozen font, so later discs sit further
    // right; each disc and connector is compared at its own position.
    const discs = await page
      .locator('ol li > span')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)))
    const steps = await page
      .locator('ol li')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)))

    // Text glyphs only (per text node), so fills, borders and discs stay compared.
    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (!node.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of range.getClientRects()) {
          rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
        }
      }
      return rects
    })

    const segments: Segment[] = [
      { name: 'header-left', reference: { x: 0, y: 0, width: 530, height: 64 }, dy: 0 },
      { name: 'header-right', reference: { x: 940, y: 0, width: 500, height: 64 }, dy: 0 },
      ...REF.discs.map((x, i) => ({
        name: `step-${i + 1}-disc`,
        reference: { x: x - 4, y: 16, width: 30, height: 30 },
        dy: 0,
        dx: discs[i]! - x,
      })),
      ...REF.connectors.map((x, i) => ({
        name: `connector-${i + 1}`,
        reference: { x: x - 2, y: 27, width: 30, height: 8 },
        dy: 0,
        // The connector is the step's ::before, 12px into the <li>.
        dx: steps[i + 1]! + 12 - x,
      })),
      { name: 'canvas-left', reference: { x: 0, y: 64, width: 300, height: 836 }, dy: 0 },
      { name: 'canvas-right', reference: { x: 1140, y: 64, width: 300, height: 836 }, dy: 0 },
      {
        name: 'card-upper',
        reference: { x: 300, y: 64, width: 840, height: REF.investor.y - 64 },
        dy: 0,
      },
      {
        name: 'card-lower',
        reference: { x: 300, y: 636, width: 840, height: 900 - 636 },
        dy: lowerDy,
      },
    ]

    const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
    const actual = readPng(path.join(REPO_ROOT, viewport.images.ACTUAL))
    const diffPath = resolveOutputPath('diff', 'WF01-S05.segments.diff.png')
    const results = compareSegments(reference, actual, segments, textMask, { diffPath })

    writeJsonReport('WF01-S05.segments.json', {
      screen_id: 'WF01-S05',
      state: 'first option selected (reference example state), nothing submitted',
      images: {
        REFERENCE: viewport.images.REFERENCE,
        ACTUAL: viewport.images.ACTUAL,
        DIFF_FULL: viewport.images.DIFF,
        DIFF_SEGMENTS: path.relative(REPO_ROOT, diffPath),
      },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: REF.investor,
          reason:
            'DEC-WF01-S05-D1: investor option not rendered (Investor/VC/Dataroom is Future scope); content below moves up',
          vertical_effect_px: { card_lower_dy: lowerDy },
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason:
            'reference raster predates the frozen font stack; text glyphs masked and checked by the DOM typography contract; wider stepper labels move discs 2-3 and connectors right, compared at their own positions',
          step_dx: segments.filter((s) => s.name.startsWith('step-')).map((s) => s.dx),
        },
      ],
      not_compared: [
        'stepper label glyphs (text mask)',
        'canvas below the shortened card (actual y > 805), plain canvas',
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })

    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
