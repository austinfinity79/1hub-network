import { expect, test, type Page } from '@playwright/test'

import { consumeMagicLink, requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { REVISION_FACES, assertTypography, settle } from '../pixel-qa/capture'
import { writeJsonReport } from '../pixel-qa/report'
import { auditRevision } from '../pixel-qa/revision'
import type { Segment } from '../pixel-qa/segments'

/**
 * WF01-S04 — Auth Errors (/auth/error?reason=<public-code>). Production.
 * Decisions DEC-WF01-S04-D1..D8 (docs/decisions/DECISION_LOG.md).
 *
 * Runtime states: BLOCKED (board R2), SESSION_EXPIRED (board R3) and GENERIC
 * (no board panel: DESIGN-GAP-GENERIC). The board's horizontal rows become a
 * centred AuthCard (D6), so pixel QA compares the corrected AUTH4 board's
 * COMPONENTS (disc, title, body, action) at their own positions (TASK 22.2,
 * DEC-L1-D6). Text is compared for real: the revision is Space Grotesk.
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tài khoản tạm thời bị khóa')
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

  test('SESSION_EXPIRED: board copy, no unsaved-work claim, relogin to /auth', async ({ page }) => {
    await openError(page, '?reason=session_expired')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Phiên đăng nhập đã hết hạn')
    await expect(page.getByText('Vui lòng đăng nhập lại để tiếp tục.')).toBeVisible()
    // DEC-L1-D6: nothing saves unsent work, so the board's second sentence is not shown.
    await expect(page.getByText(/đã được lưu/)).toHaveCount(0)
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
    await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
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

test.describe('WF01-S04 pixel QA (corrected AUTH4 components)', () => {
  /**
   * Corrected AUTH4 board, measured once: the "!" disc, the title and body line
   * origins (text box left / top, fixed from each line's glyph ink) and R3's
   * action, for rows R2 and R3.
   */
  const BOARD = {
    blocked: { disc: { x: 67, y: 229 }, title: { x: 121, y: 229 } },
    session_expired: {
      disc: { x: 67, y: 343 },
      title: { x: 121, y: 343 },
      body: { x: 121, y: 374 },
      action: { x: 1245, y: 343 },
    },
  } as const
  const REFERENCE = 'design-reference/final/revision/L1/AUTH4__auth-errors__SOURCE.png'

  /** Page-space box of an element's text (its line box), not of the element. */
  const textBox = (page: Page, selector: string) =>
    page.locator(selector).evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.ceil(r.width) }
    })

  for (const reason of Object.keys(BOARD) as (keyof typeof BOARD)[]) {
    test(`${reason}: typography and component comparison`, async ({ page }) => {
      await openError(page, `?reason=${reason}`)
      const board = BOARD[reason]
      const disc = (await page.locator('[data-auth-error] > div').first().boundingBox())!
      const title = await textBox(page, '[data-auth-error] h1')
      const segments: Segment[] = [
        {
          name: 'disc',
          reference: { x: board.disc.x - 6, y: board.disc.y - 6, width: 46, height: 46 },
          dx: Math.round(disc.x) - board.disc.x,
          dy: Math.round(disc.y) - board.disc.y,
        },
        {
          name: 'title',
          reference: {
            x: board.title.x - 2,
            y: board.title.y - 2,
            width: title.width + 4,
            height: 28,
          },
          dx: title.x - board.title.x,
          dy: title.y - board.title.y,
        },
      ]
      if ('body' in board) {
        const body = await textBox(page, '[data-auth-error] h1 + p')
        const action = (await page.getByRole('link', { name: 'Đăng nhập lại' }).boundingBox())!
        segments.push(
          {
            // The board's body continues after this sentence; only the kept part is compared.
            name: 'body',
            reference: {
              x: board.body.x - 2,
              y: board.body.y - 2,
              width: body.width + 3,
              height: 26,
            },
            dx: body.x - board.body.x,
            dy: body.y - board.body.y,
          },
          {
            name: 'action',
            reference: { x: board.action.x - 5, y: board.action.y - 5, width: 138, height: 51 },
            dx: Math.round(action.x) - board.action.x,
            dy: Math.round(action.y) - board.action.y,
          },
        )
      }
      await auditRevision(page, {
        name: `WF01-S04.AUTH4.${reason}`,
        reference: REFERENCE,
        segments,
        intentional: [
          {
            class: 'INTENTIONAL-COMPOSITION',
            reason:
              'DEC-WF01-S04-D6: board rows become one centred AuthCard; components compared at their own positions',
          },
          ...(reason === 'blocked'
            ? [
                {
                  class: 'INTENTIONAL-DATA-ABSENCE',
                  reason:
                    'DEC-WF01-S04-D4/D5 + DEC-L1-D6: no email about a block and no support contact exist, so the board body and its "Liên hệ hỗ trợ" action are replaced by the kept truthful copy',
                },
              ]
            : [
                {
                  class: 'INTENTIONAL-DATA-ABSENCE',
                  reason:
                    'DEC-L1-D6: "Nội dung bạn đang thực hiện đã được lưu." is not shown; nothing saves unsent work',
                },
              ]),
        ],
      })
    })
  }

  test('generic: DESIGN-GAP-GENERIC, typography and geometry sanity only', async ({ page }) => {
    await openError(page, '?reason=generic')
    await settle(page)
    const typography = await assertTypography(page, REVISION_FACES)
    expect(typography.violations).toEqual([])
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
        'DEC-WF01-S04-D2: no board panel; functional fallback reusing the AUTH4 components. Manual PO review required.',
      product_pixel_pass_claimed: false,
    })
  })
})
