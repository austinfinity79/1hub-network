import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { consumeMagicLink, requestMagicLink } from '../../../src/lib/auth/magic-link'
import { hashToken } from '../../../src/lib/auth/tokens'
import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { readPng } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF01-S03 — Auth Callback (/auth/callback?token=…). Production, state-board.
 *
 * Tokens are minted server-side with the real M0-T08 functions (the API never
 * returns a raw token), then expired or spent directly, so every state is
 * deterministic. Pixel QA compares each runtime state with ITS OWN approved
 * board panel (WF01_S03_STATE_BOARD_MAPPING.md), never with the whole board.
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
  test('SUCCESS with incomplete onboarding: one session, then /onboarding/purpose', async ({
    page,
  }) => {
    const before = await sessionsFor(NEWCOMER)
    await page.goto(callback(await mint(NEWCOMER)))
    await expect(page).toHaveURL('/onboarding/purpose')
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
    await page.route('**/onboarding/purpose**', () => new Promise(() => {}))
    await page.goto(callback(await mint(NEWCOMER)))
    const state = page.locator('[data-callback-state="success"]')
    await expect(state).toBeVisible()
    await expect(state.getByRole('heading', { level: 1 })).toHaveText('Đăng nhập được')
    await expect(state.getByRole('status')).toHaveText('Đang chuyển…')
  })

  test('EXPIRED: no session, the approved state, and a way back to /auth', async ({ page }) => {
    const token = await mint(MEMBER)
    await expire(token)
    const before = await sessionsFor(MEMBER)
    await page.goto(callback(token))

    await expect(page).toHaveURL('/auth/callback?status=expired')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Link đã hết hạn')
    await expect(page.getByText('Link chỉ sống 15 phút.', { exact: false })).toBeVisible()
    // DEC-WF01-S03-D6a: the copy sends the user back for a new link and no
    // longer promises an in-place resend (DEC-WF01-S03-D1).
    await expect(page.getByText('hãy quay lại nhập email để nhận', { exact: false })).toBeVisible()
    await expect(page.getByText('nút gửi lại phải ở ngay', { exact: false })).toHaveCount(0)
    expect(await sessionsFor(MEMBER)).toBe(before)

    await page.getByRole('link', { name: 'Gửi link mới' }).click()
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Link đã dùng rồi')
    expect(await sessionsFor(MEMBER)).toBe(before)
    await page.getByRole('link', { name: 'Gửi link mới' }).click()
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
    await page.getByRole('link', { name: 'Gửi link mới' }).click()
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Link đã dùng rồi')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Link đã dùng rồi')
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
    expect(finals).toEqual(['/auth/callback?status=used', '/onboarding/purpose'])
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
    const link = page.getByRole('link', { name: 'Gửi link mới' })
    await expect(link).toBeFocused()
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/auth')
  })
})

test.describe('WF01-S03 pixel QA (per-state panel)', () => {
  /**
   * Approved panel content regions on the AUTH3 board (mapping D5), and the
   * board y of each panel's icon disc top, used to align the runtime card.
   */
  const PANELS = {
    success: { x: 46, discTop: 344 },
    expired: { x: 504, discTop: 344 },
    used: { x: 961, discTop: 344 },
  } as const
  const CROP = { y: 330, width: 433, height: 290 }

  for (const state of Object.keys(PANELS) as (keyof typeof PANELS)[]) {
    test(`${state}: typography contract and panel comparison`, async ({ page }) => {
      let query: string
      if (state === 'success') {
        await page.route('**/onboarding/purpose**', () => new Promise(() => {}))
        query = `?token=${encodeURIComponent(await mint(NEWCOMER))}`
      } else {
        query = `?status=${state}`
      }

      const { screens } = loadManifest()
      const [viewport] = await runScreenQa(
        page,
        findScreen(screens, 'WF01-S03'),
        qaConfigFor('WF01-S03')!,
        {
          query,
          name: `WF01-S03.${state}`,
          waitUntil: state === 'success' ? 'load' : 'networkidle',
          afterLoad: async (p) => {
            await expect(p.locator(`[data-callback-state="${state}"]`)).toBeVisible()
          },
        },
      )

      expect(viewport!.conditions).toEqual({
        viewport: { width: 1440, height: 900 },
        dpr: 1,
        fonts: 'loaded',
      })
      expect(viewport!.typography!.violations).toEqual([])

      // Align the board panel to the runtime card by the disc's top-left.
      const disc = (await page
        .locator(`[data-callback-state="${state}"] > div`)
        .first()
        .boundingBox())!
      const panel = PANELS[state]
      const boardDiscX = panel.x + (CROP.width - 64) / 2
      const dx = Math.round(disc.x) - Math.round(boardDiscX)
      const dy = Math.round(disc.y) - panel.discTop

      // Text boxes are masked; for the action pill only its label glyphs are,
      // so the pill's fill and corners are still compared strictly.
      const mask: Rect[] = await page.evaluate(() => {
        const pad = (r: DOMRect) => ({
          x: r.x - 2,
          y: r.y - 2,
          width: r.width + 4,
          height: r.height + 4,
        })
        const rects = [...document.querySelectorAll('h1, p')].map((el) =>
          pad(el.getBoundingClientRect()),
        )
        for (const el of document.querySelectorAll(
          '[data-callback-state] a, [data-callback-state] [role="status"]',
        )) {
          const range = document.createRange()
          range.selectNodeContents(el)
          rects.push(pad(range.getBoundingClientRect()))
        }
        return rects
      })

      const reference = readPng(path.join(REPO_ROOT, viewport!.images.REFERENCE))
      const actual = readPng(path.join(REPO_ROOT, viewport!.images.ACTUAL))
      const diffPath = resolveOutputPath('diff', `WF01-S03.${state}.panel.diff.png`)
      const [result] = compareSegments(
        reference,
        actual,
        [{ name: `panel-${state}`, reference: { x: panel.x, ...CROP }, dy, dx }],
        mask,
        { diffPath },
      )

      writeJsonReport(`WF01-S03.${state}.panel.json`, {
        screen_id: 'WF01-S03',
        state,
        images: {
          REFERENCE: `${viewport!.images.REFERENCE} @ x${panel.x} y${CROP.y} ${CROP.width}x${CROP.height}`,
          ACTUAL: viewport!.images.ACTUAL,
          DIFF: path.relative(REPO_ROOT, diffPath),
        },
        excluded_annotations: [
          'board title (44,48)',
          'red outline on the EXPIRED panel (D2)',
          'other panels',
        ],
        intentional: [
          {
            class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
            reason:
              'Board raster predates the frozen APEC font stack; DOM typography contract passed',
          },
        ],
        segment: result,
        product_pixel_pass_claimed: false,
      })

      expect(result!.outside_ratio, `${state} geometry/surface drift`).toBeLessThan(0.002)
    })
  }
})
