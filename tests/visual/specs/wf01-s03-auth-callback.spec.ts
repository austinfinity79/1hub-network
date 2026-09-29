import { expect, test, type Page } from '@playwright/test'

import { consumeMagicLink, requestMagicLink } from '../../../src/lib/auth/magic-link'
import { hashToken } from '../../../src/lib/auth/tokens'
import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF01-S03 — Auth Callback (/auth/callback?token=…). Production, state-board.
 *
 * Tokens are minted server-side with the real M0-T08 functions (the API never
 * returns a raw token), then expired or spent directly, so every state is
 * deterministic. Pixel QA compares each runtime state with ITS OWN panel of
 * the corrected AUTH3 board (TASK 22.2, DEC-L1-D5), never with the whole board.
 */

const MEMBER = 'member@example.test' // onboarding complete
const NEWCOMER = 'newcomer@example.test' // onboarding incomplete

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // The spent/expired consume answers 400/409 by design.
    if (m.type() === 'error' && !/status of (400|409)/.test(m.text())) consoleErrors.push(m.text())
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

async function mint(email: string): Promise<string> {
  return (await requestMagicLink(email, null)).token
}

async function expire(token: string) {
  await query(
    `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
    [hashToken(token)],
  )
}

async function sessionsFor(email: string): Promise<number> {
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM user_sessions s JOIN user_accounts a ON a.id = s.account_id
     WHERE a.email_normalized = $1`,
    [email],
  )
  return row!.n
}

const callback = (token: string) => `/auth/callback?token=${encodeURIComponent(token)}`

/** Records every URL the page's own frame navigates to. */
function trackUrls(page: Page): string[] {
  const urls: string[] = []
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) urls.push(f.url())
  })
  return urls
}

test.describe('WF01-S03 functional', () => {
  test('SUCCESS with incomplete onboarding: one session, then /onboarding', async ({ page }) => {
    const before = await sessionsFor(NEWCOMER)
    await page.goto(callback(await mint(NEWCOMER)))
    await expect(page).toHaveURL('/onboarding')
    expect(await sessionsFor(NEWCOMER)).toBe(before + 1)
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.authenticated).toBe(true)
    expect(session.profile.onboarding_completed).toBe(false)
  })

  test('SUCCESS with complete onboarding goes to /me', async ({ page }) => {
    await page.goto(callback(await mint(MEMBER)))
    await expect(page).toHaveURL('/me')
  })

  test('SUCCESS renders the approved success state while navigating', async ({ page }) => {
    // Hold the destination so the transient state stays on screen.
    await page.route(/\/onboarding(\?.*)?$/, () => new Promise(() => {}))
    await page.goto(callback(await mint(NEWCOMER)))
    const state = page.locator('[data-callback-state="success"]')
    await expect(state).toBeVisible()
    await expect(state.getByRole('heading', { level: 1 })).toHaveText('Đăng nhập thành công')
    // DEC-L1-D5: the body names the real destination of an unfinished account.
    await expect(state).toContainText('Bạn sẽ được chuyển đến bước hoàn thiện hồ sơ cá nhân')
    await expect(state.getByRole('status')).toHaveText('Đang chuyển hướng...')
  })

  test('EXPIRED: no session, the approved state, and a way back to /auth', async ({ page }) => {
    const token = await mint(MEMBER)
    await expire(token)
    const before = await sessionsFor(MEMBER)
    await page.goto(callback(token))

    await expect(page).toHaveURL('/auth/callback?status=expired')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liên kết đã hết hạn')
    await expect(
      page.getByText('Liên kết đăng nhập chỉ có hiệu lực trong 15 phút.', { exact: false }),
    ).toBeVisible()
    // The copy asks for a new link and promises no in-place resend (DEC-WF01-S03-D1).
    await expect(
      page.getByText('Vui lòng yêu cầu liên kết mới để tiếp tục.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByText('nút gửi lại phải ở ngay', { exact: false })).toHaveCount(0)
    expect(await sessionsFor(MEMBER)).toBe(before)

    await page.getByRole('link', { name: 'Gửi liên kết mới' }).click()
    await expect(page).toHaveURL('/auth')
  })

  test('USED: a second visit creates no second session and shows the used state', async ({
    page,
  }) => {
    const token = await mint(MEMBER)
    await consumeMagicLink(token)
    const before = await sessionsFor(MEMBER)
    await page.goto(callback(token))

    await expect(page).toHaveURL('/auth/callback?status=used')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liên kết không còn hiệu lực')
    expect(await sessionsFor(MEMBER)).toBe(before)
    await page.getByRole('link', { name: 'Gửi liên kết mới' }).click()
    await expect(page).toHaveURL('/auth')
  })

  test('the new-link action never calls resend from a spent token', async ({ page }) => {
    let resends = 0
    await page.route('**/api/v1/auth/magic-link/resend', (route) => {
      resends++
      return route.continue()
    })
    const token = await mint(MEMBER)
    await expire(token)
    await page.goto(callback(token))
    await page.getByRole('link', { name: 'Gửi liên kết mới' }).click()
    await expect(page).toHaveURL('/auth')
    expect(resends).toBe(0)
  })

  test('INVALID token goes to /auth/error (WF01-S04) without a reason in the URL', async ({
    page,
  }) => {
    await page.goto(callback('not-a-real-token'))
    await expect(page).toHaveURL('/auth/error')
  })

  test('direct entry without a token goes to /auth/error', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page).toHaveURL('/auth/error')
  })

  test('a refreshed terminal state stays, with no token needed', async ({ page }) => {
    await page.goto('/auth/callback?status=used')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liên kết không còn hiệu lực')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liên kết không còn hiệu lực')
  })

  test('two tabs opening the same link: exactly one session, the other sees USED', async ({
    browser,
  }) => {
    const token = await mint(NEWCOMER)
    const before = await sessionsFor(NEWCOMER)
    const [a, b] = await Promise.all([browser.newContext(), browser.newContext()])
    const [pa, pb] = await Promise.all([a.newPage(), b.newPage()])
    await Promise.all([pa.goto(callback(token)), pb.goto(callback(token))])
    await Promise.all([
      pa.waitForURL(/onboarding|status=used/),
      pb.waitForURL(/onboarding|status=used/),
    ])
    const finals = [pa.url(), pb.url()].map((u) => new URL(u).pathname + new URL(u).search).sort()
    expect(finals).toEqual(['/auth/callback?status=used', '/onboarding'])
    expect(await sessionsFor(NEWCOMER)).toBe(before + 1)
    await Promise.all([a.close(), b.close()])
  })

  test('the token leaves no trace: URL, history, requests, storage, DOM, referrer', async ({
    page,
  }) => {
    const token = await mint(MEMBER)
    await expire(token)
    const urls = trackUrls(page)
    const carriers: string[] = []
    page.on('request', (r) => {
      if (r.url().includes(token)) carriers.push(r.resourceType())
    })
    await page.goto(callback(token))
    const historyAtLoad = await page.evaluate(() => history.length)
    await expect(page).toHaveURL('/auth/callback?status=expired')

    // Only the email click itself carried the token; no fetch, asset or RSC call.
    expect(carriers).toEqual(['document'])
    // Once the address bar was cleaned, the token never came back. (Next.js
    // re-records the SAME entry on hydration, before the cleanup; that is not
    // a new history entry.)
    const cleaned = urls.findIndex((u) => !u.includes(token))
    expect(cleaned).toBeGreaterThan(0)
    expect(urls.slice(cleaned).some((u) => u.includes(token))).toBe(false)
    expect(await page.evaluate(() => history.length)).toBe(historyAtLoad)

    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    )
    expect(storage).not.toContain(token)
    expect(await page.content()).not.toContain(token)
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')

    // Back must not restore the token-bearing URL.
    await page.goBack().catch(() => undefined)
    expect(page.url()).not.toContain(token)
  })

  test('keyboard: the new-link action is focusable, visibly focused and activates', async ({
    page,
  }) => {
    await page.goto('/auth/callback?status=expired')
    await page.keyboard.press('Tab')
    const link = page.getByRole('link', { name: 'Gửi liên kết mới' })
    await expect(link).toBeFocused()
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/auth')
  })
})

test.describe('WF01-S03 pixel QA (corrected AUTH3, per-state panel)', () => {
  /**
   * Corrected AUTH3 board: each panel's content column (inside its frame and
   * the EXPIRED panel's annotation outline, D2) and its icon disc's top-left.
   */
  const PANELS = {
    success: { x: 52, discX: 231 },
    expired: { x: 509, discX: 688 },
    used: { x: 966, discX: 1145 },
  } as const
  const CROP = { y: 346, width: 422, height: 254 }
  const DISC_TOP = 356

  for (const state of Object.keys(PANELS) as (keyof typeof PANELS)[]) {
    test(`${state}: typography and panel comparison`, async ({ page }) => {
      if (state === 'success') {
        await page.route(/\/onboarding(\?.*)?$/, () => new Promise(() => {}))
        await page.goto(callback(await mint(NEWCOMER)), { waitUntil: 'load' })
      } else {
        await page.goto(`/auth/callback?status=${state}`, { waitUntil: 'networkidle' })
      }
      await expect(page.locator(`[data-callback-state="${state}"]`)).toBeVisible()

      // Align the board panel to the runtime card by the disc's top-left.
      const disc = (await page
        .locator(`[data-callback-state="${state}"] > div`)
        .first()
        .boundingBox())!
      const panel = PANELS[state]
      await auditRevision(page, {
        name: `WF01-S03.AUTH3.${state}`,
        reference: 'design-reference/final/revision/L1/AUTH3__auth-callback-states__SOURCE.png',
        segments: [
          {
            name: `panel-${state}`,
            reference: { x: panel.x, ...CROP },
            dx: Math.round(disc.x) - panel.discX,
            dy: Math.round(disc.y) - DISC_TOP,
          },
        ],
        intentional: [
          {
            class: 'INTENTIONAL-COMPOSITION',
            reason:
              'DEC-WF01-S03-D5: one state in one centred AuthCard; the board, its title, the other panels and the EXPIRED outline (D2) are not compared',
          },
        ],
      })
    })
  }
})
