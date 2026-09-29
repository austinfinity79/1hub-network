import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF02-S07 — Settings / Sessions / Account Deletion Request (/me/settings).
 * Decisions DEC-WF02-H8, DEC-WF02-S07-G1..G6, DEC-WF02-S07-D1..D3; the page is
 * the corrected L11 ME0 overview subset (TASK 22.3, DEC-L2-D1).
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SESSIONS = '/api/v1/me/sessions'
const DELETION = '/api/v1/me/account-deletion-request'

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
    (
      await request.patch('/api/v1/me/profile', {
        data: {
          full_name: 'Đặng Kim Chi',
          display_name: 'Đặng Kim Chi',
          country_id: COUNTRY,
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
  for (const completed of ['CAPABILITY', 'ROLE']) {
    const stage = await request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect(stage.ok()).toBe(true)
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

/** L11 (TASK 22.3): the session list opens in place from the sessions row. */
async function openSettings(page: Page) {
  await page.goto('/me/settings', { waitUntil: 'networkidle' })
  await expect(sessionsCard(page)).toHaveAttribute('aria-busy', 'false')
  await sessionsCard(page).getByRole('button', { name: 'Xem' }).click()
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
    await expect(page).toHaveURL('/onboarding')
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
    await openSettings(page)
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
    await sessionsCard(page).getByRole('button', { name: 'Xem' }).click()
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
    await danger.getByRole('button', { name: 'Gửi yêu cầu' }).click()
    // Cancel sends nothing.
    await danger.getByRole('button', { name: 'Huỷ' }).click()
    expect(
      await query('SELECT 1 FROM account_deletion_requests WHERE account_id = $1', [m.accountId]),
    ).toHaveLength(0)

    await danger.getByRole('button', { name: 'Gửi yêu cầu' }).click()
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
    await danger.getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await danger.getByRole('button', { name: 'Xác nhận gửi yêu cầu' }).click()
    await expect(danger.getByRole('alert')).toContainText('Chưa gửi được yêu cầu')
    await expect(danger.getByRole('button', { name: 'Xác nhận gửi yêu cầu' })).toBeVisible()
  })
})

test.describe('WF02-S07 pixel QA (corrected L11 ME0 subset)', () => {
  const REFERENCE = 'design-reference/final/revision/L2/L11__me-settings__SOURCE.png'
  /** L11, measured once: title box, card tops, the sessions row top (row 3). */
  const REF = {
    title: { x: 406, y: 88 },
    account: 171,
    sessions: 349,
    visibility: 444,
    danger: 1803,
  }
  const RIGHT = 1320

  test('1440×900 full page: head, account card, sessions row, visibility, closing card', async ({
    page,
  }) => {
    await completedMember(page.request, 's07-px')
    await page.goto('/me/settings', { waitUntil: 'networkidle' })
    await expect(sessionsCard(page)).toHaveAttribute('aria-busy', 'false')
    await expect(page.locator('[data-visibility]')).toBeVisible()
    const box = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const r = el.getBoundingClientRect()
          return { x: Math.round(r.x), y: Math.round(r.y + scrollY), right: Math.round(r.right) }
        })
    const title = await box('main h1')
    const account = await box('[data-card="account"]')
    const sessions = await box('[data-card="sessions"]')
    const visibility = await box('[data-card="visibility"]')
    const danger = await box('[data-card="danger"]')
    const dx = account.x - REF.title.x
    await auditRevision(page, {
      name: 'WF02-S07.L11',
      reference: REFERENCE,
      full: true,
      segments: [
        {
          name: 'head',
          reference: { x: 400, y: 84, width: 340, height: 72 },
          dx: title.x - REF.title.x,
          dy: title.y - REF.title.y,
        },
        {
          name: 'account-head',
          reference: { x: 400, y: 165, width: 470, height: 80 },
          dx,
          dy: account.y - REF.account,
        },
        {
          name: 'sessions-title',
          reference: { x: 420, y: 352, width: 260, height: 36 },
          dx,
          dy: sessions.y - REF.sessions,
        },
        {
          name: 'sessions-action',
          reference: { x: 1230, y: 352, width: 96, height: 52 },
          dx: account.right - RIGHT,
          dy: sessions.y - REF.sessions,
        },
        {
          name: 'visibility-head',
          reference: { x: 400, y: 438, width: 470, height: 77 },
          dx,
          dy: visibility.y - REF.visibility,
        },
        {
          name: 'visibility-action',
          reference: { x: 1230, y: 490, width: 96, height: 50 },
          dx: visibility.right - RIGHT,
          dy: visibility.y - REF.visibility,
        },
        {
          name: 'closing-head',
          reference: { x: 400, y: 1797, width: 470, height: 79 },
          dx,
          dy: danger.y - REF.danger,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SHELL',
          reason:
            'HD-11 / DEC-L2-D1: the member shell (header, "Tài khoản của tôi" sidebar) stays; the reference settings sidebar is a shell change',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'DEC-L2-D1: Bucket B / Future rows omitted (email change, Google, HUB tags, public URL, view-as, purpose consents, viewer stats, personal log, export, email preferences, invitations, organisations, transfer)',
        },
        {
          class: 'INTENTIONAL-DATA',
          reason:
            "summaries show this account's own data (email, session count, visibility, consent)",
        },
        { class: 'INTENTIONAL-SCOPE', reason: 'HD-11: no floating "Góp ý" button' },
      ],
    })
  })
})
