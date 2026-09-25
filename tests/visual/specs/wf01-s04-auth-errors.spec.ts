import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { SESSION_TTL_SECONDS } from '../../../src/lib/auth/config'
import { consumeMagicLink, requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { readPng } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S04 — Auth Errors (/auth/error?reason=<public-code>). Production.
 * Decisions DEC-WF01-S04-D1..D8 (docs/decisions/DECISION_LOG.md).
 *
 * Runtime states: BLOCKED (board R2), SESSION_EXPIRED (board R3) and GENERIC
 * (no board panel: DESIGN-GAP-GENERIC). The board's horizontal rows become a
 * centred AuthCard (D6), so pixel QA compares the approved COMPONENTS (disc,
 * action) at their own positions; text is masked and checked by the DOM
 * typography contract.
 */

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 429s and the blocked/invalid consume answers are the scenario.
    if (m.type() === 'error' && !/status of (400|403|429)/.test(m.text()))
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

const state = (page: Page) => page.locator('[data-auth-error]')

async function openError(page: Page, query = '') {
  await page.goto(`/auth/error${query}`)
  await expect(state(page)).toBeVisible()
}

test.describe('WF01-S04 functional', () => {
  test('missing reason renders GENERIC', async ({ page }) => {
    await openError(page)
    await expect(state(page)).toHaveAttribute('data-auth-error', 'generic')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chưa đăng nhập được')
  })

  for (const raw of [
    'unknown',
    'AUTH_ACCOUNT_BLOCKED',
    'rate_limited',
    'mail_blocked',
    '__proto__',
    'constructor',
    '<script>alert(1)</script>',
  ]) {
    test(`reason ${JSON.stringify(raw)} falls back to GENERIC and is never echoed`, async ({
      page,
    }) => {
      await openError(page, `?reason=${encodeURIComponent(raw)}`)
      await expect(state(page)).toHaveAttribute('data-auth-error', 'generic')
      expect(await page.content()).not.toContain(raw)
      expect(await page.locator('body').innerText()).not.toContain(raw)
    })
  }

  test('generic is explicit too: ?reason=generic', async ({ page }) => {
    await openError(page, '?reason=generic')
    await expect(state(page)).toHaveAttribute('data-auth-error', 'generic')
  })

  test('BLOCKED: approved meaning, no fabricated date, no invented support address', async ({
    page,
  }) => {
    await openError(page, '?reason=blocked')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tài khoản đang bị khoá')
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}/)
    expect(text).not.toMatch(/@/)
    // No email delivery exists in P0, so nothing may promise one.
    expect(text.toLowerCase()).not.toContain('mail')
    expect(text).toContain('Liên hệ ban điều hành HUB để được hỗ trợ.')
    // No action is invented without a configured support contact.
    await expect(page.getByRole('link')).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(0)
  })

  test('SESSION_EXPIRED: approved meaning, lifetime from config, relogin to /auth', async ({
    page,
  }) => {
    await openError(page, '?reason=session_expired')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Phiên đăng nhập đã hết')
    await expect(
      page.getByText(`${Math.round(SESSION_TTL_SECONDS / 86400)} ngày trước`),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Đăng nhập lại' }).click()
    await expect(page).toHaveURL('/auth')
  })

  test('GENERIC copy names no account, link state, provider or internal reason', async ({
    page,
  }) => {
    await openError(page)
    const text = (await page.locator('[data-auth-error]').innerText()).toLowerCase()
    for (const leak of [
      'tài khoản',
      'không tồn tại',
      'hết hạn',
      'đã dùng',
      'token',
      'google',
      'lỗi hệ thống',
    ]) {
      expect(text, leak).not.toContain(leak)
    }
    await page.getByRole('link', { name: 'Đăng nhập lại' }).click()
    await expect(page).toHaveURL('/auth')
  })

  test('a query token is never rendered or embedded in the HTML', async ({ page }) => {
    const secret = 'raw-token-9b1f2c4d5e6f'
    await openError(page, `?token=${secret}&reason=blocked`)
    expect(await page.content()).not.toContain(secret)
  })

  test('a blocked account reaching the callback lands on BLOCKED', async ({ page }) => {
    const email = `blocked-${Date.now()}@example.test`
    await consumeMagicLink((await requestMagicLink(email, null)).token)
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE email_normalized = $1`, [email])
    const { token } = await requestMagicLink(email, null)

    await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL('/auth/error?reason=blocked')
    await expect(state(page)).toHaveAttribute('data-auth-error', 'blocked')
  })

  test('an invalid callback link lands on GENERIC', async ({ page }) => {
    await page.goto('/auth/callback?token=not-a-real-token')
    await expect(page).toHaveURL('/auth/error')
    await expect(state(page)).toHaveAttribute('data-auth-error', 'generic')
  })

  test('rate limiting stays inline on WF01-S01 and never routes to S04', async ({ page }) => {
    await page.route('**/api/v1/auth/magic-link', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'AUTH_RATE_LIMITED', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.goto('/auth', { waitUntil: 'networkidle' })
    await page.getByLabel('Email', { exact: true }).fill('member@example.test')
    await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click()
    await expect(page.locator('form').getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL('/auth')
  })

  test('the mail-blocked-by-domain state does not exist in P0', async ({ page }) => {
    await openError(page, '?reason=mail_blocked')
    await expect(page.getByText(/chặn thư/)).toHaveCount(0)
  })

  test('keyboard: the action is reachable, visibly focused and activates', async ({ page }) => {
    await openError(page, '?reason=session_expired')
    await page.keyboard.press('Tab')
    const link = page.getByRole('link', { name: 'Đăng nhập lại' })
    await expect(link).toBeFocused()
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/auth')
  })

  test('each state is announced and has one level-1 heading', async ({ page }) => {
    for (const reason of ['blocked', 'session_expired', 'generic']) {
      await openError(page, `?reason=${reason}`)
      await expect(page.getByRole('alert').filter({ has: page.locator('h1') })).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    }
  })
})

test.describe('WF01-S04 pixel QA', () => {
  /** Board component positions (AUTH4, 1440x900): the "!" disc and R3's action. */
  const BOARD = {
    blocked: { disc: { x: 67, y: 257 } },
    session_expired: { disc: { x: 67, y: 399 }, action: { x: 1245, y: 399 } },
  } as const
  const DISC_PAD = 6

  async function capture(page: Page, reason: string) {
    const { screens } = loadManifest()
    const [viewport] = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S04'),
      qaConfigFor('WF01-S04')!,
      {
        query: `?reason=${reason}`,
        name: `WF01-S04.${reason}`,
        afterLoad: async (p) => {
          await expect(p.locator(`[data-auth-error="${reason}"]`)).toBeVisible()
        },
      },
    )
    expect(viewport!.conditions).toEqual({
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      fonts: 'loaded',
    })
    expect(viewport!.typography!.violations).toEqual([])
    return viewport!
  }

  for (const reason of ['blocked', 'session_expired'] as const) {
    test(`${reason}: typography contract and approved component comparison`, async ({ page }) => {
      const viewport = await capture(page, reason)
      const board = BOARD[reason]
      const disc = (await page.locator('[data-auth-error] > div').first().boundingBox())!

      const segments: Segment[] = [
        {
          name: 'disc',
          reference: {
            x: board.disc.x - DISC_PAD,
            y: board.disc.y - DISC_PAD,
            width: 34 + DISC_PAD * 2,
            height: 34 + DISC_PAD * 2,
          },
          dx: Math.round(disc.x) - board.disc.x,
          dy: Math.round(disc.y) - board.disc.y,
        },
      ]
      if ('action' in board) {
        const action = (await page.getByRole('link', { name: 'Đăng nhập lại' }).boundingBox())!
        segments.push({
          name: 'action',
          reference: {
            x: board.action.x - 5,
            y: board.action.y - 5,
            width: 128 + 10,
            height: 41 + 10,
          },
          dx: Math.round(action.x) - board.action.x,
          dy: Math.round(action.y) - board.action.y,
        })
      }
      // Only the action LABEL glyphs are masked; its border and fill are compared.
      const mask: Rect[] = await page.evaluate(() =>
        [...document.querySelectorAll('[data-auth-error] a')].map((el) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          const r = range.getBoundingClientRect()
          return { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 }
        }),
      )

      const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
      const actual = readPng(path.join(REPO_ROOT, viewport.images.ACTUAL))
      const diffPath = resolveOutputPath('diff', `WF01-S04.${reason}.components.diff.png`)
      const results = compareSegments(reference, actual, segments, mask, { diffPath })

      writeJsonReport(`WF01-S04.${reason}.components.json`, {
        screen_id: 'WF01-S04',
        state: reason,
        images: {
          REFERENCE: viewport.images.REFERENCE,
          ACTUAL: viewport.images.ACTUAL,
          DIFF: path.relative(REPO_ROOT, diffPath),
        },
        excluded_annotations: [
          'board title',
          '"Vì sao viết thế này" rationale lines',
          'rows R1 and R4',
        ],
        intentional: [
          {
            class: 'INTENTIONAL-COMPOSITION',
            reason:
              'DEC-WF01-S04-D6: board rows become one centred AuthCard; components compared at their own positions',
          },
          {
            class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
            reason: 'board raster predates the frozen font stack; DOM typography contract passed',
          },
          ...(reason === 'blocked'
            ? [
                {
                  class: 'INTENTIONAL-DATA-ABSENCE',
                  reason: 'DEC-WF01-S04-D4: board date "20/09" has no data source and is dropped',
                },
                {
                  class: 'INTENTIONAL-DATA-ABSENCE',
                  reason:
                    'DEC-WF01-S04-D5: no configured support contact; generic support copy instead of the board email button',
                },
              ]
            : []),
        ],
        segments: results,
        product_pixel_pass_claimed: false,
      })

      for (const r of results) {
        expect(r.outside_ratio, `${reason} ${r.name} drift`).toBeLessThan(0.002)
      }
    })
  }

  test('generic: DESIGN-GAP-GENERIC, typography and geometry sanity only', async ({ page }) => {
    const viewport = await capture(page, 'generic')
    const card = (await page.locator('[data-ui="surface"]').boundingBox())!
    // Same centred AuthCard as the other states: fully inside the viewport, centred.
    expect(Math.round(card.width)).toBe(440)
    expect(Math.abs(card.x + card.width / 2 - 720)).toBeLessThanOrEqual(1)
    expect(Math.abs(card.y + card.height / 2 - 450)).toBeLessThanOrEqual(1)
    const discWidth = await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-auth-error] > div')!).width,
    )
    expect(discWidth).toBe('34px')
    writeJsonReport('WF01-S04.generic.review.json', {
      screen_id: 'WF01-S04',
      state: 'generic',
      pixel_mode: 'DESIGN-GAP-GENERIC',
      reason:
        'DEC-WF01-S04-D2: no approved board panel; functional fallback reusing the S04 components. Manual PO review required.',
      images: { ACTUAL: viewport.images.ACTUAL },
      product_pixel_pass_claimed: false,
    })
  })
})
