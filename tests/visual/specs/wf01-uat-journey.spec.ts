import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { hashToken } from '../../../src/lib/auth/tokens'
import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * WF01-COMPLETION-AUDIT — happy-path UAT across S01 → S08 as ONE journey per
 * scenario (docs/implementation/WF01_UAT_MATRIX.md). The "mail" step reads the
 * link the way the inbox would receive it: requestMagicLink() returns the raw
 * token only to its caller, never to storage.
 *
 * The audit's expected-fail markers (test.fail) have all been removed as their
 * gaps closed: UAT-11 (GAP-ROSTER, WF01-REMEDIATION-01), UAT-12
 * (GAP-ANALYTICS-REG, WF01-REMEDIATION-02) and UAT-03b (DEFECT-RESUME,
 * WF01-REMEDIATION-03).
 */

const FIXTURE = path.join(REPO_ROOT, 'tests/visual/fixtures/wf01-s06-qa-vocabulary.sql')
const REGION = '20000000-0000-0000-0000-000000000002'

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await query(readFileSync(FIXTURE, 'utf8'))
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Spent/expired links (400/409), the stale-version race (409) and a
    // simulated completion failure (500) are scenarios.
    if (m.type() === 'error' && !/status of (400|409|422|500)/.test(m.text()))
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

const newEmail = (tag: string) =>
  `uat-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`

/** S01 → S02 in the UI, then open the emailed link (S03). Returns the raw token. */
async function signInThroughUi(page: Page, email: string): Promise<string> {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  await expect(page.getByRole('button', { name: /Gửi lại/ })).toBeVisible()
  // The inbox: the newest link for this address (a resend retires older ones).
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
  return token
}

async function accountId(email: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return row!.id
}

async function state(id: string) {
  const [row] = await query<{
    profiles: number
    status: string | null
    completed_at: Date | null
    intent: string | null
    consents: number
    activated: number
    consent_audits: number
    completed_events: number
  }>(
    `SELECT (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS profiles,
            (SELECT status::text FROM individual_profiles WHERE account_id = $1) AS status,
            (SELECT onboarding_completed_at FROM individual_profiles WHERE account_id = $1) AS completed_at,
            (SELECT primary_intent FROM individual_profiles WHERE account_id = $1) AS intent,
            (SELECT count(*)::int FROM consent_records WHERE account_id = $1) AS consents,
            (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED') AS activated,
            (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $1 AND action = 'CONSENT_ACCEPTED') AS consent_audits,
            (SELECT count(*)::int FROM analytics_events WHERE account_id = $1 AND event_name = 'onboarding_completed') AS completed_events`,
    [id],
  )
  return row!
}

async function s05(page: Page, choice: 'SUBMIT_SOLUTION' | 'skip') {
  await expect(page).toHaveURL('/onboarding/purpose')
  if (choice === 'skip') {
    await page.getByRole('button', { name: 'Bỏ qua, làm sau' }).click()
  } else {
    await page.locator(`[data-intent="${choice}"]`).click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
  }
  await expect(page).toHaveURL('/onboarding/profile')
}

async function s06(page: Page) {
  await page.getByLabel('Họ và tên').fill('Người Dùng UAT')
  await page.getByLabel('Chức danh hiện tại').fill('Kỹ sư')
  await page.getByLabel('Tỉnh / thành phố').selectOption(REGION)
  await page.getByRole('checkbox', { name: 'Logistics', exact: true }).check({ force: true })
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/privacy')
}

async function s07(page: Page) {
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Xong, vào HUB' }).click()
  await expect(page).toHaveURL('/onboarding/complete')
}

async function s08(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong. Giờ làm gì?')
  await expect(page.getByRole('link', { name: 'Vào 1hub.network' })).toBeVisible()
}

async function sessionOf(request: APIRequestContext) {
  return (await request.get('/api/v1/session')).json()
}

async function logout(context: BrowserContext) {
  const response = await context.request.post('/api/v1/auth/logout')
  expect(response.status()).toBe(204)
  await context.clearCookies()
}

test.describe('WF01 UAT journeys', () => {
  test('UAT-01 new member completes S01 → S08 as one journey', async ({ page, context }) => {
    const email = newEmail('01')
    const token = await signInThroughUi(page, email)
    // S03: session established, token stripped from the URL.
    await expect(page).toHaveURL('/onboarding/purpose')
    expect(page.url()).not.toContain(token)
    const cookie = (await context.cookies()).find((c) => c.httpOnly)
    expect(cookie, 'HttpOnly session cookie').toBeTruthy()
    const id = await accountId(email)
    expect(await state(id)).toMatchObject({ profiles: 0 })

    await s05(page, 'SUBMIT_SOLUTION')
    expect(await state(id)).toMatchObject({
      profiles: 1,
      status: 'DRAFT',
      intent: 'SUBMIT_SOLUTION',
    })
    await s06(page)
    expect(await state(id)).toMatchObject({ profiles: 1, status: 'DRAFT', completed_at: null })
    await s07(page)
    await s08(page)

    const final = await state(id)
    expect(final).toMatchObject({
      profiles: 1,
      status: 'ACTIVE',
      consents: 2,
      activated: 1,
      consent_audits: 2,
      completed_events: 1,
    })
    expect(final.completed_at).toBeInstanceOf(Date)
    const session = await sessionOf(page.request)
    const completion = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(session.profile).toMatchObject({
      status: 'ACTIVE',
      onboarding_completed: true,
      completion_percent: completion.percent,
    })
    await expect(page.locator('[data-completion]')).toContainText(`${completion.percent}%`)

    // The raw token is stored nowhere: only its hash, and never in audit or analytics.
    const leaks = await query<{ n: number }>(
      `SELECT (SELECT count(*) FROM auth_magic_link_requests WHERE token_hash = $1)::int
            + (SELECT count(*) FROM audit_events
                WHERE coalesce(before_data::text, '') || coalesce(after_data::text, '') LIKE '%' || $1 || '%')::int
            + (SELECT count(*) FROM analytics_events WHERE properties::text LIKE '%' || $1 || '%')::int AS n`,
      [token],
    )
    expect(leaks[0]!.n).toBe(0)
    const hashed = await query('SELECT 1 FROM auth_magic_link_requests WHERE token_hash = $1', [
      hashToken(token),
    ])
    expect(hashed).toHaveLength(1)

    await page.getByRole('link', { name: 'Vào 1hub.network' }).click()
    await expect(page).toHaveURL('/me')
  })

  test('UAT-02 skipping the intent still completes (intent NULL)', async ({ page }) => {
    const email = newEmail('02')
    await signInThroughUi(page, email)
    await s05(page, 'skip')
    await s06(page)
    await s07(page)
    await s08(page)
    expect(await state(await accountId(email))).toMatchObject({ status: 'ACTIVE', intent: null })
  })

  test('UAT-03a resuming partial onboarding is safe: data kept, continuing completes', async ({
    page,
    context,
  }) => {
    const email = newEmail('03')
    await signInThroughUi(page, email)
    await s05(page, 'SUBMIT_SOLUTION')
    await s06(page)
    await logout(context)
    await page.goto('/onboarding/privacy')
    await expect(page).toHaveURL('/auth')

    await signInThroughUi(page, email)
    await expect(page).toHaveURL(/\/onboarding\//)
    // Wherever it lands, earlier answers are kept and the journey finishes.
    await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
    await expect(page.getByLabel('Họ và tên')).toHaveValue('Người Dùng UAT')
    await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
    await s07(page)
    await s08(page)
    expect(await state(await accountId(email))).toMatchObject({ profiles: 1, status: 'ACTIVE' })
  })

  test('UAT-03b sign-in resumes at the first incomplete step (DEFECT-RESUME closed)', async ({
    page,
    context,
  }) => {
    // WF01 state rule: "Existing account + incomplete onboarding resumes at first
    // incomplete onboarding step" — one server resolver (DEC-WF01-RESUME-D1).
    const email = newEmail('03b')
    const relogin = async (expected: string) => {
      await logout(context)
      await signInThroughUi(page, email)
      await expect(page).toHaveURL(expected)
    }
    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/onboarding/purpose')
    await s05(page, 'skip')
    await relogin('/onboarding/profile') // skipped S05 → S06
    await s06(page)
    await relogin('/onboarding/privacy') // S06 done → S07
    // S08 completes on entry: fail that call once so the account stays
    // "S07 done, not finalised" — a real state, not a database edit.
    await page.route('**/api/v1/me/onboarding/complete', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
      }),
    )
    await s07(page)
    await expect(page.getByText('Chưa hoàn tất được. Vui lòng thử lại.')).toBeVisible()
    await page.unroute('**/api/v1/me/onboarding/complete')
    const id = await accountId(email)
    await relogin('/onboarding/complete') // S07 done, not finalised → S08
    await s08(page)
    await relogin('/me') // completed → /me
    expect(await state(id)).toMatchObject({ profiles: 1, status: 'ACTIVE', intent: null })
  })

  test('UAT-04 expired and used links never sign in; invalid goes to S04', async ({ page }) => {
    const email = newEmail('04')
    const { token } = await requestMagicLink(email, null)
    await query(
      `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashToken(token)],
    )
    await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL('/auth/callback?status=expired')
    expect((await sessionOf(page.request)).authenticated).toBe(false)

    const fresh = (await requestMagicLink(email, null)).token
    await page.goto(`/auth/callback?token=${encodeURIComponent(fresh)}`)
    await expect(page).toHaveURL('/onboarding/purpose')
    await page.context().clearCookies()
    await page.goto(`/auth/callback?token=${encodeURIComponent(fresh)}`)
    await expect(page).toHaveURL('/auth/callback?status=used')
    expect((await sessionOf(page.request)).authenticated).toBe(false)

    await page.goto('/auth/callback?token=not-a-token')
    await expect(page).toHaveURL('/auth/error')
  })

  test('UAT-05 required profile fields block S06 and nothing is saved', async ({ page }) => {
    const email = newEmail('05')
    await signInThroughUi(page, email)
    await s05(page, 'skip')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/profile')
    const [row] = await query<{ display_name: string | null }>(
      'SELECT display_name FROM individual_profiles WHERE account_id = $1',
      [await accountId(email)],
    )
    expect(row?.display_name ?? null).toBeNull()
  })

  test('UAT-06 a legal version published mid-journey must be accepted in its new version', async ({
    page,
  }) => {
    const email = newEmail('06')
    await signInThroughUi(page, email)
    await s05(page, 'skip')
    await s06(page)
    const version = `uat-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('PRIVACY_DATA_PROCESSING', $1, 'Chính sách quyền riêng tư', $2, now())`,
      [version, `/legal/privacy/${version}`],
    )
    try {
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Xong, vào HUB' }).click()
      await expect(page.getByText(/Văn bản vừa được cập nhật/)).toBeVisible()
      await s07(page)
      await s08(page)
      const [row] = await query<{ version: string }>(
        `SELECT d.version FROM consent_records c JOIN legal_documents d ON d.id = c.legal_document_id
          WHERE c.account_id = $1 AND c.consent_type = 'PRIVACY_DATA_PROCESSING'`,
        [await accountId(email)],
      )
      expect(row!.version).toBe(version)
    } finally {
      await query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version])
    }
  })

  test('UAT-07 PRIVATE discovery hides the avatar from other members; NETWORK_ONLY shows it', async ({
    page,
    browser,
  }) => {
    const email = newEmail('07')
    await signInThroughUi(page, email)
    await s05(page, 'skip')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const upload = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/profile/avatar'))
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png })
    const { url } = await (await upload).json()
    await s06(page)
    await page.getByRole('switch').click() // OFF → PRIVATE
    await s07(page)
    await s08(page)

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    await other.request.post('/dev/login', { data: { email: newEmail('07-other') } })
    expect((await other.request.get(url)).status()).toBe(404)
    await page.request.put('/api/v1/me/visibility', {
      data: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }] },
    })
    expect((await other.request.get(url)).status()).toBe(200)
    const guest = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    expect((await guest.request.get(url)).status()).toBe(404)
    await other.close()
    await guest.close()
  })

  test('UAT-08 a profile below 80% completes onboarding', async ({ page }) => {
    const email = newEmail('08')
    await signInThroughUi(page, email)
    await s05(page, 'skip')
    await s06(page)
    await s07(page)
    await s08(page)
    const completion = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(completion.percent).toBeLessThan(80)
    expect(completion.groups.map((g: { code: string }) => g.code)).not.toContain('NETWORK_CONTEXT')
    expect(await state(await accountId(email))).toMatchObject({ status: 'ACTIVE' })
  })

  test('UAT-09 retried and concurrent completion make one transition', async ({ page }) => {
    const email = newEmail('09')
    await signInThroughUi(page, email)
    await s05(page, 'skip')
    await s06(page)
    await s07(page)
    await s08(page)
    const id = await accountId(email)
    const before = await state(id)
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => page.request.post('/api/v1/me/onboarding/complete')),
    )
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200, 200])
    await page.reload({ waitUntil: 'networkidle' })
    await s08(page)
    const after = await state(id)
    expect(after).toEqual(before)
  })

  test('UAT-10 a returning completed member goes to /me; nothing is rewritten', async ({
    page,
    context,
  }) => {
    const email = newEmail('10')
    await signInThroughUi(page, email)
    await s05(page, 'SUBMIT_SOLUTION')
    await s06(page)
    await s07(page)
    await s08(page)
    const id = await accountId(email)
    const before = await state(id)
    await logout(context)

    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/me')
    for (const step of ['/onboarding/purpose', '/onboarding/profile', '/onboarding/privacy']) {
      await page.goto(step)
      await expect(page).toHaveURL('/me')
    }
    await page.goto('/onboarding/complete', { waitUntil: 'networkidle' })
    await s08(page)
    expect(await state(id)).toEqual(before)
  })
})

test.describe('WF01 frozen P0 requirements (audit follow-up)', () => {
  test('UAT-11 launch-roster members get confirmed relationships at sign-up (GAP-ROSTER closed)', async ({
    page,
    context,
  }) => {
    // Freeze D2: known roster → normalized email match → ACTIVE membership;
    // leadership only when the roster row states it. Rows are inserted as the
    // importer (pnpm roster:import) stores them.
    const member = newEmail('roster-member')
    const leader = newEmail('roster-leader')
    const [org] = await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE slug = 'chapter-01'`,
    )
    await query(
      `INSERT INTO membership_bootstrap
         (email_normalized, organization_id, membership_state, leadership_role_label, source_batch)
       VALUES ($1, $3, 'ACTIVE', NULL, 'uat-audit'), ($2, $3, 'ACTIVE', 'Chapter Leader', 'uat-audit')`,
      [member, leader, org!.id],
    )
    const relations = async (email: string) =>
      query<{ kind: string; state: string; label: string | null }>(
        `SELECT 'membership' AS kind, m.state::text AS state, NULL AS label
           FROM community_memberships m JOIN individual_profiles p ON p.id = m.profile_id
           JOIN user_accounts a ON a.id = p.account_id WHERE a.email_normalized = $1
         UNION ALL
         SELECT 'leadership', l.state::text, l.role_label
           FROM leadership_records l JOIN individual_profiles p ON p.id = l.profile_id
           JOIN user_accounts a ON a.id = p.account_id WHERE a.email_normalized = $1
         ORDER BY 1`,
        [email],
      )

    // Member: ACTIVE membership, no leadership, one profile; onboarding proceeds.
    await signInThroughUi(page, member)
    await expect(page).toHaveURL('/onboarding/purpose')
    expect(await relations(member)).toEqual([{ kind: 'membership', state: 'ACTIVE', label: null }])
    const id = await accountId(member)
    await s05(page, 'skip')
    await s06(page)
    await s07(page)
    await s08(page)
    expect(await state(id)).toMatchObject({ profiles: 1, status: 'ACTIVE' })
    // Signing in again attaches nothing new.
    await logout(context)
    await signInThroughUi(page, member)
    await expect(page).toHaveURL('/me')
    expect(await relations(member)).toHaveLength(1)

    // Leader: membership AND leadership, no permission-bearing role.
    await logout(context)
    await signInThroughUi(page, leader)
    await expect(page).toHaveURL('/onboarding/purpose')
    expect(await relations(leader)).toEqual([
      { kind: 'leadership', state: 'ACTIVE', label: 'Chapter Leader' },
      { kind: 'membership', state: 'ACTIVE', label: null },
    ])
    const session = await sessionOf(page.request)
    expect(session.capabilities).toEqual([])
    expect(session.managed_scopes).toEqual([])
  })

  test('UAT-12 account creation records account_created exactly once (GAP-ANALYTICS-REG closed)', async ({
    page,
    context,
  }) => {
    // API 05 §10 P0 minimum events; Data SOT: "at minimum registration".
    const email = newEmail('reg')
    const token = await signInThroughUi(page, email)
    await expect(page).toHaveURL('/onboarding/purpose')
    const id = await accountId(email)
    const count = async () =>
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM analytics_events WHERE account_id = $1 AND event_name = 'account_created'`,
          [id],
        )
      )[0]!.n
    expect(await count()).toBe(1)
    // Retrying the same link: USED, no new event.
    await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL('/auth/callback?status=used')
    // Signing out and in again: no new event.
    await logout(context)
    await signInThroughUi(page, email)
    await expect(page).toHaveURL('/onboarding/purpose')
    expect(await count()).toBe(1)
  })

  test('UAT-13 the WF01 funnel reads account_created → completion changes → onboarding_completed', async ({
    page,
  }) => {
    const email = newEmail('funnel')
    const token = await signInThroughUi(page, email)
    await s05(page, 'SUBMIT_SOLUTION')
    await s06(page)
    await s07(page)
    await s08(page)
    const id = await accountId(email)
    const rows = await query<{ event_name: string; properties: Record<string, unknown> }>(
      `SELECT event_name, properties FROM analytics_events WHERE account_id = $1 ORDER BY occurred_at, id`,
      [id],
    )
    const names = rows.map((r) => r.event_name)
    expect(names[0]).toBe('account_created')
    expect(names.at(-1)).toBe('onboarding_completed')
    expect(names.filter((n) => n === 'account_created')).toHaveLength(1)
    expect(names.filter((n) => n === 'onboarding_completed')).toHaveLength(1)
    expect(new Set(names.slice(1, -1))).toEqual(new Set(['profile_completion_changed']))
    // Every change is a real move of the authoritative percent.
    for (const r of rows.filter((x) => x.event_name === 'profile_completion_changed')) {
      expect(r.properties.from_percent).not.toBe(r.properties.to_percent)
    }
    // One account correlates the funnel; no personal or secret content.
    expect(rows.every((r) => r.properties.account_id === id)).toBe(true)
    const text = JSON.stringify(rows)
    for (const secret of [email, token, 'Người Dùng UAT', 'Kỹ sư', 'TERMS', 'PRIVACY', '@']) {
      expect(text, secret).not.toContain(secret)
    }
  })
})
