import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S07 — Settings / Sessions / Account Deletion Request (/me/settings).
 * Decisions DEC-WF02-H8, DEC-WF02-S07-G1..G6, DEC-WF02-S07-D1..D3.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SESSIONS = '/api/v1/me/sessions'
const DELETION = '/api/v1/me/account-deletion-request'
/** Seeded persona member@example.test (seed_p0_deterministic.sql). */
const MEMBER_ACCOUNT = '30000000-0000-0000-0000-000000000001'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (401|404|500)/.test(m.text()))
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

type Member = { email: string; accountId: string }

async function completedMember(request: APIRequestContext, label = 's07'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (await request.put('/api/v1/me/onboarding/intent', { data: { action: 'SKIP' } })).ok(),
  ).toBe(true)
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        data: {
          display_name: 'Đặng Kim Chi',
          headline: 'QA',
          region_id: REGION,
          domain_ids: [DOMAIN],
        },
      })
    ).status(),
  ).toBe(200)
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    expect(
      (
        await request.post('/api/v1/me/consents/accept', {
          data: { consent_type: doc.type, policy_version: doc.version },
        })
      ).ok(),
    ).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return { email, accountId: row!.id }
}

/** Another browser/device of the same member: a new context with its own session. */
type RequestFactory = {
  request: { newContext: (options: { baseURL?: string }) => Promise<APIRequestContext> }
}

async function otherDevice(playwright: RequestFactory, email: string) {
  const ctx = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
  expect((await ctx.post('/dev/login', { data: { email } })).ok()).toBe(true)
  return ctx
}

const sessionsCard = (page: Page) => page.locator('[data-card="sessions"]')

async function openSettings(page: Page) {
  await page.goto('/me/settings', { waitUntil: 'networkidle' })
  await expect(sessionsCard(page)).toHaveAttribute('aria-busy', 'false')
}

test.describe('WF02-S07 guards', () => {
  test('1. guest → /auth; every endpoint 401', async ({ page, request }) => {
    await page.goto('/me/settings')
    await expect(page).toHaveURL('/auth')
    for (const [method, url] of [
      ['GET', SESSIONS],
      ['DELETE', SESSIONS],
      ['DELETE', `${SESSIONS}/00000000-0000-0000-0000-000000000000`],
      ['POST', DELETION],
    ] as const) {
      expect((await request.fetch(url, { method })).status(), `${method} ${url}`).toBe(401)
    }
  })

  test('2. an account that has not finished onboarding → its resolver step', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s07-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/me/settings')
    await expect(page).toHaveURL('/onboarding/purpose')
  })
})

test.describe('WF02-S07 sessions', () => {
  test('3/6/7. list: own active sessions only, current marked, no token or hash', async ({
    page,
    playwright,
  }) => {
    const m = await completedMember(page.request)
    await openSettings(page)
    await expect(sessionsCard(page).locator('li')).toHaveCount(1)
    await expect(sessionsCard(page).locator('[data-session="current"]')).toContainText('Hiện tại')
    await expect(page.locator('[data-email]')).toHaveText(m.email)
    // Only P0 controls: no email change, Google, notifications or transfer.
    const text = await page.locator('main').innerText()
    for (const banned of [
      'Đổi email',
      'Google',
      'THÔNG BÁO',
      'Chuyển giao',
      'Chrome',
      'Windows',
      'Safari',
    ]) {
      expect(text, banned).not.toContain(banned)
    }

    const a = await otherDevice(playwright, m.email)
    const b = await otherDevice(playwright, m.email)
    const stranger = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(stranger, 's07-stranger')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(sessionsCard(page).locator('li')).toHaveCount(3)
    await expect(sessionsCard(page).locator('li').first()).toHaveAttribute(
      'data-session',
      'current',
    )

    const res = await page.request.get(`${SESSIONS}?account_id=x&profile_id=y`)
    const body = await res.json()
    expect(body.items).toHaveLength(3)
    expect(body.items.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
    for (const item of body.items)
      expect(Object.keys(item).sort()).toEqual(['created_at', 'current', 'expires_at', 'id'])
    const cookie = (await page.context().cookies()).find((c) => c.httpOnly)!.value
    const hashes = await query<{ token_hash: string }>(
      'SELECT token_hash FROM user_sessions WHERE account_id = $1',
      [m.accountId],
    )
    const raw = JSON.stringify(body)
    expect(raw).not.toContain(cookie)
    for (const h of hashes) expect(raw).not.toContain(h.token_hash)
    for (const ctx of [a, b, stranger]) await ctx.dispose()
  })

  test('9/12/13. revoke another session: immediate, idempotent, concurrent-safe', async ({
    page,
    playwright,
  }) => {
    const m = await completedMember(page.request)
    const other = await otherDevice(playwright, m.email)
    expect((await other.get(SESSIONS)).status()).toBe(200)
    await openSettings(page)
    await sessionsCard(page)
      .locator('[data-session="other"]')
      .getByRole('button', { name: 'Đăng xuất' })
      .click()
    await expect(sessionsCard(page).locator('li')).toHaveCount(1)
    expect((await other.get(SESSIONS)).status()).toBe(401)

    const third = await otherDevice(playwright, m.email)
    const { items } = await (await page.request.get(SESSIONS)).json()
    const target = items.find((s: { current: boolean }) => !s.current).id
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => page.request.delete(`${SESSIONS}/${target}`)),
    )
    expect(burst.map((r) => r.status())).toEqual([204, 204, 204, 204, 204])
    expect((await third.get(SESSIONS)).status()).toBe(401)
    // Already revoked: still the same safe outcome.
    expect((await page.request.delete(`${SESSIONS}/${target}`)).status()).toBe(204)
    for (const ctx of [other, third]) await ctx.dispose()
  })

  test('8. a foreign, unknown or malformed session id is 404 and changes nothing', async ({
    page,
    playwright,
  }) => {
    await completedMember(page.request, 's07-a')
    const stranger = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(stranger, 's07-b')
    const foreign = (await (await stranger.get(SESSIONS)).json()).items[0].id
    for (const id of [foreign, '00000000-0000-0000-0000-000000000000', 'not-a-uuid']) {
      const r = await page.request.delete(`${SESSIONS}/${id}`)
      expect(r.status(), id).toBe(404)
      expect((await r.json()).error.code).toBe('UNCONTRACTED_NOT_FOUND')
    }
    expect((await stranger.get(SESSIONS)).status()).toBe(200)
    await stranger.dispose()
  })

  test('10. revoking the current session clears the cookie and signs this browser out', async ({
    page,
  }) => {
    await completedMember(page.request)
    const { items } = await (await page.request.get(SESSIONS)).json()
    const r = await page.request.delete(`${SESSIONS}/${items[0].id}`)
    expect(r.status()).toBe(204)
    expect(r.headers()['set-cookie']).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i)
    expect((await page.request.get(SESSIONS)).status()).toBe(401)
    await page.goto('/me/settings')
    await expect(page).toHaveURL('/auth')
  })

  test('11. logout all: every session ends, this browser goes to /auth; login works again', async ({
    page,
    playwright,
  }) => {
    const m = await completedMember(page.request)
    const devices = [await otherDevice(playwright, m.email), await otherDevice(playwright, m.email)]
    await openSettings(page)
    await sessionsCard(page).getByRole('button', { name: 'Đăng xuất khỏi mọi thiết bị' }).click()
    await expect(page).toHaveURL('/auth')
    for (const d of devices) expect((await d.get(SESSIONS)).status()).toBe(401)
    const live = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM user_sessions WHERE account_id = $1 AND revoked_at IS NULL`,
      [m.accountId],
    )
    expect(live[0]!.n).toBe(0)
    expect((await page.request.post('/dev/login', { data: { email: m.email } })).ok()).toBe(true)
    await openSettings(page)
    await expect(sessionsCard(page).locator('li')).toHaveCount(1)
    for (const d of devices) await d.dispose()
  })

  test('sessions API failure shows an error with retry', async ({ page }) => {
    await completedMember(page.request)
    await page.route('**/api/v1/me/sessions', (r) =>
      r.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
      }),
    )
    await page.goto('/me/settings', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="sessions-failed"]')).toBeVisible()
    await page.unroute('**/api/v1/me/sessions')
    await page
      .locator('[data-state="sessions-failed"]')
      .getByRole('button', { name: 'Thử lại' })
      .click()
    await expect(sessionsCard(page).locator('li')).toHaveCount(1)
  })
})

test.describe('WF02-S07 deletion request', () => {
  test('15/16/18. confirm → 201; repeat 200 same request; user stays signed in; one audit', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await openSettings(page)
    const danger = page.locator('[data-card="danger"]')
    await danger.getByRole('button', { name: 'Yêu cầu xoá tài khoản' }).click()
    // Cancel sends nothing.
    await danger.getByRole('button', { name: 'Huỷ' }).click()
    expect(
      await query('SELECT 1 FROM account_deletion_requests WHERE account_id = $1', [m.accountId]),
    ).toHaveLength(0)

    await danger.getByRole('button', { name: 'Yêu cầu xoá tài khoản' }).click()
    const res = page.waitForResponse((r) => r.url().endsWith(DELETION))
    await danger.getByRole('button', { name: 'Xác nhận gửi yêu cầu' }).click()
    const first = await res
    expect(first.status()).toBe(201)
    const created = await first.json()
    await expect(danger.locator('[data-state="deletion-requested"]')).toContainText(
      'Đã nhận yêu cầu xoá tài khoản lúc',
    )

    const again = await page.request.post(DELETION, {
      data: { account_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect(again.status()).toBe(200)
    expect(await again.json()).toEqual(created)
    const audits = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'ACCOUNT_DELETION_REQUESTED'`,
      [m.accountId],
    )
    expect(audits[0]!.n).toBe(1)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(danger.locator('[data-state="deletion-requested"]')).toBeVisible()
    // Not deleted, not deactivated, not logged out.
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL('/me')
    const [state] = await query<{ account: string; profile: string }>(
      `SELECT a.status::text AS account, p.status::text AS profile FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.id = $1`,
      [m.accountId],
    )
    expect(state).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
  })

  test('17. concurrent requests leave one row', async ({ page }) => {
    const m = await completedMember(page.request)
    const burst = await Promise.all(Array.from({ length: 6 }, () => page.request.post(DELETION)))
    expect(burst.filter((r) => r.status() === 201)).toHaveLength(1)
    expect(burst.filter((r) => r.status() === 200)).toHaveLength(5)
    expect(
      await query('SELECT 1 FROM account_deletion_requests WHERE account_id = $1', [m.accountId]),
    ).toHaveLength(1)
  })

  test('deletion API failure shows an error and keeps the confirmation', async ({ page }) => {
    await completedMember(page.request)
    await openSettings(page)
    await page.route('**/api/v1/me/account-deletion-request', (r) =>
      r.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
      }),
    )
    const danger = page.locator('[data-card="danger"]')
    await danger.getByRole('button', { name: 'Yêu cầu xoá tài khoản' }).click()
    await danger.getByRole('button', { name: 'Xác nhận gửi yêu cầu' }).click()
    await expect(danger.getByRole('alert')).toContainText('Chưa gửi được yêu cầu')
    await expect(danger.getByRole('button', { name: 'Xác nhận gửi yêu cầu' })).toBeVisible()
  })
})

test.describe('WF02-S07 pixel QA', () => {
  test('viewport against the approved reference (shell, login card top, sessions card head)', async ({
    page,
  }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S07')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S07')!, {
      // Test-only state: the seeded member keeps sessions from earlier specs;
      // leave only the one this run just created, and no deletion request.
      beforeNavigate: async () => {
        await query(
          `UPDATE user_sessions SET revoked_at = now()
            WHERE account_id = $1 AND revoked_at IS NULL
              AND id <> (SELECT id FROM user_sessions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1)`,
          [MEMBER_ACCOUNT],
        )
        await query('DELETE FROM account_deletion_requests WHERE account_id = $1', [MEMBER_ACCOUNT])
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-card="sessions"] li')).toHaveCount(1)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.typography?.violations).toEqual([])

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const r of range.getClientRects())
          rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
      }
      for (const svg of document.querySelectorAll('header svg')) {
        const r = svg.getBoundingClientRect()
        rects.push({ x: r.x - 1, y: r.y - 1, width: r.width + 2, height: r.height + 2 })
      }
      return rects
    })
    const sessionsTop = Math.round(
      (await page.locator('[data-card="sessions"] section').boundingBox())!.y,
    )
    const dy = sessionsTop - 405
    const REF_TEXT: Rect[] = [
      { x: 60, y: 18, width: 400, height: 24 },
      { x: 1236, y: 18, width: 100, height: 24 },
      { x: 60, y: 88, width: 110, height: 18 },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      { x: 336, y: 94, width: 230, height: 36 },
      { x: 362, y: 168, width: 320, height: 70 },
      ...[
        { x: 362, y: 429, width: 100, height: 20 },
        { x: 1178, y: 428, width: 176, height: 22 },
        { x: 362, y: 457, width: 320, height: 44 },
        { x: 1296, y: 470, width: 48, height: 16 },
      ].map((r) => ({ ...r, y: r.y + dy })),
    ]
    // INTENTIONAL-P0-SCOPE: "Đổi email" (email change) and the bell.
    const OMITTED: Rect[] = [
      { x: 1254, y: 192, width: 102, height: 46 },
      { x: 1196, y: 16, width: 36, height: 28 },
    ]
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S07.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      [
        {
          name: 'shell+title+login-top',
          reference: { x: 0, y: 0, width: 1440, height: 262 },
          dy: 0,
        },
        { name: 'sessions-head', reference: { x: 330, y: 396, width: 1060, height: 128 }, dy },
        { name: 'sidebar-rest', reference: { x: 0, y: 262, width: 330, height: 638 }, dy: 0 },
      ],
      [...textMask, ...REF_TEXT, ...OMITTED],
      { diffPath },
    )
    writeJsonReport('WF02-S07.segments.json', {
      screen_id: 'WF02-S07',
      state: qaConfigFor('WF02-S07')!.state,
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: OMITTED[0],
          reason: 'DEC-WF02-H8: "Đổi email" not rendered',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 340, y: 262, width: 1036, height: 70 },
          reason:
            'DEC-WF02-H8: Google linking row not rendered; login card shorter (sessions card dy)',
          vertical_effect_px: dy,
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 340, y: 715, width: 1036, height: 355 },
          reason: 'DEC-WF02-H8: email notification preferences not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-H8 / S07-D1: session rows show stored start/expiry only, never browser/OS/city; one session in the fixture',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S07-G3: deletion request enabled with confirmation; transfer button and owner warning omitted (P0 scope); request-only wording',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: OMITTED[1],
          reason: 'DEC-WF02-H9/H10: bell counter omitted; SVG bell',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'text glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
