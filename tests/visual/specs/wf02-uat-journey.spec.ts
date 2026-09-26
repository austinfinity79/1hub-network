import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * WF02-COMPLETION-AUDIT — happy-path UAT across S01 → S07 as ONE journey
 * (docs/implementation/WF02_UAT_MATRIX.md, HC-WF02-01..12), plus alternate
 * and negative paths. Sign-in is the real magic-link path (WF01): the "mail"
 * step reads the newest link the way the inbox would receive it. The data is
 * checked after every transition, and the single completion service must
 * agree across /session, /me/profile and /me/profile/completion.
 */

const FIXTURE = path.join(REPO_ROOT, 'tests/visual/fixtures/wf01-s06-qa-vocabulary.sql')
const REGION = '20000000-0000-0000-0000-000000000002'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const MEMBER_ROUTES = [
  '/me',
  '/me/profile/edit',
  '/me/privacy',
  '/me/roles',
  '/me/settings',
  '/projects/new',
  '/projects/00000000-0000-0000-0000-000000000000/edit',
  '/projects/00000000-0000-0000-0000-000000000000/team',
]

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await query(readFileSync(FIXTURE, 'utf8'))
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
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
  `uat2-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`

async function signIn(page: Page, email: string) {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
  return token
}

/** WF01 S05 → S08 through the UI. */
async function onboard(page: Page, name: string) {
  await expect(page).toHaveURL('/onboarding/purpose')
  await page.getByRole('button', { name: 'Bỏ qua, làm sau' }).click()
  await expect(page).toHaveURL('/onboarding/profile')
  await page.getByLabel('Họ và tên').fill(name)
  await page.getByLabel('Chức danh hiện tại').fill('Kỹ sư')
  await page.getByLabel('Tỉnh / thành phố').selectOption(REGION)
  await page.getByRole('checkbox', { name: 'Logistics', exact: true }).check({ force: true })
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/privacy')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Xong, vào HUB' }).click()
  await expect(page).toHaveURL('/onboarding/complete')
  await page.getByRole('link', { name: 'Vào 1hub.network' }).click()
  await expect(page).toHaveURL('/me')
}

async function ids(email: string) {
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
      WHERE a.email_normalized = $1`,
    [email],
  )
  return row!
}

/** The one completion service, read through all three endpoints (Audit 3). */
async function completion(request: APIRequestContext): Promise<number> {
  const session = await (await request.get('/api/v1/session')).json()
  const profile = await (await request.get('/api/v1/me/profile')).json()
  const own = await (await request.get('/api/v1/me/profile/completion')).json()
  const values = [session.profile.completion_percent, profile.completion.percent, own.percent]
  expect(new Set(values).size, `completion disagrees: ${values.join('/')}`).toBe(1)
  return values[0]
}

/** Everything a deletion REQUEST must leave untouched (Audit 8). */
async function footprint(accountId: string, profileId: string) {
  const [row] = await query<Record<string, unknown>>(
    `SELECT (SELECT status::text FROM user_accounts WHERE id = $1) AS account,
            (SELECT status::text FROM individual_profiles WHERE id = $2) AS profile,
            (SELECT avatar_asset_id::text FROM individual_profiles WHERE id = $2) AS avatar,
            (SELECT string_agg(state::text, ',' ORDER BY id) FROM community_memberships WHERE profile_id = $2) AS memberships,
            (SELECT count(*)::int FROM leadership_records WHERE profile_id = $2) AS leadership,
            (SELECT string_agg(status::text || ':' || type::text, ',' ORDER BY id) FROM projects WHERE owner_profile_id = $2) AS ventures,
            (SELECT string_agg(m.state::text, ',' ORDER BY m.id) FROM project_members m JOIN projects p ON p.id = m.project_id WHERE p.owner_profile_id = $2) AS team,
            (SELECT count(*)::int FROM consent_records WHERE account_id = $1) AS consents,
            (SELECT count(*)::int FROM user_sessions WHERE account_id = $1 AND revoked_at IS NULL) AS sessions`,
    [accountId, profileId],
  )
  return row!
}

async function persona(browser: Browser, tag: string, name: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  const email = newEmail(tag)
  await signIn(page, email)
  return { context, page, email, name }
}

async function relations(request: APIRequestContext) {
  const net = await (await request.get('/api/v1/me/network')).json()
  return net.roles.map((r: { venture: { name: string }; relation: string }) => ({
    name: r.venture.name,
    relation: r.relation,
  }))
}

test.describe('WF02 UAT — canonical member journey', () => {
  test('HC-WF02-01..12 one journey from a new account, data checked after every step', async ({
    page,
    browser,
    context,
  }) => {
    test.setTimeout(180_000)
    const ownerEmail = newEmail('owner')
    await signIn(page, ownerEmail)
    await onboard(page, 'Chủ Dự Án UAT')
    const owner = await ids(ownerEmail)
    const programmesBefore = await query<{ n: number }>(
      'SELECT (SELECT count(*) FROM programmes)::int + (SELECT count(*) FROM events)::int AS n',
    )

    // HC-WF02-01: account home, with the server completion.
    let percent = await completion(page.request)
    await expect(page.locator('[data-completion]')).toContainText(`${percent}%`)
    await expect(page.locator('main')).toContainText('Chủ Dự Án UAT')
    const [acct] = await query<{ profiles: number; ivs: number }>(
      `SELECT (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS profiles,
              (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $2) AS ivs`,
      [owner.account_id, owner.profile_id],
    )
    expect(acct).toEqual({ profiles: 1, ivs: 0 })

    // HC-WF02-02: profile edit (goal + avatar) → S01 reflects it.
    await page.goto('/me/profile/edit', { waitUntil: 'networkidle' })
    await page.getByLabel('Mục tiêu phát triển').fill('Mở rộng dự án ra ba tỉnh.')
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/me/profile') && r.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    expect((await saved).status()).toBe(200)
    const afterGoal = await completion(page.request)
    expect(afterGoal).toBeGreaterThan(percent)
    const upload = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/profile/avatar'))
    await page
      .getByLabel('Ảnh đại diện', { exact: true })
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 })
    expect((await upload).ok()).toBe(true)
    percent = await completion(page.request)
    expect(percent).toBe(afterGoal + 10)
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-completion]')).toContainText(`${percent}%`)
    const avatarUrl = (await (await page.request.get('/api/v1/me/profile')).json()).avatar.url

    // HC-WF02-03: visibility PRIVATE; consent untouched; completion untouched.
    const [consentsBefore] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM consent_records WHERE account_id = $1',
      [owner.account_id],
    )
    await page.goto('/me/privacy', { waitUntil: 'networkidle' })
    const toggle = page.getByRole('switch', { name: 'Hiện thẻ của tôi trong Thư viện' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    const vis = await (await page.request.get('/api/v1/me/visibility')).json()
    expect(JSON.stringify(vis)).toContain('PRIVATE')
    expect(await completion(page.request)).toBe(percent)
    const [consentsAfter] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM consent_records WHERE account_id = $1',
      [owner.account_id],
    )
    expect(consentsAfter!.n).toBe(consentsBefore!.n)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    // HC-WF02-04: roles/network; a membership request stays PENDING_APPROVAL.
    await page.goto('/me/roles', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-card="roles"] [data-state="network-empty"]')).toBeVisible()
    await page.getByRole('combobox').selectOption({ label: 'Chapter 02' })
    await page.locator('[data-card="request"]').getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await expect(page.locator('[data-state="request-sent"]')).toBeVisible()
    await expect(page.locator('li[data-pending]')).toHaveCount(1)
    const [net] = await query<{ state: string; leaders: number; roles: number }>(
      `SELECT (SELECT string_agg(state::text, ',') FROM community_memberships WHERE profile_id = $1 AND organization_id = $2) AS state,
              (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS leaders,
              (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $1) AS roles`,
      [owner.profile_id, CHAPTER_02],
    )
    expect(net).toEqual({ state: 'PENDING_APPROVAL', leaders: 0, roles: 0 })
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities).toEqual([])
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page.locator('main')).toContainText('Chapter 02')

    // HC-WF02-05 / 06: PROJECT and STARTUP through the S05 form.
    const created: Record<string, string> = {}
    for (const [label, name] of [
      ['Dự án', 'Dự Án UAT'],
      ['Startup', 'Startup UAT'],
    ] as const) {
      await page.goto('/projects/new', { waitUntil: 'networkidle' })
      await page.getByRole('radio', { name: label }).check()
      await page.locator('#ve-name').fill(name)
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}\/edit$/)
      created[name] = page.url().split('/').slice(-2)[0]!
    }
    const ventures = await query<{ type: string; status: string; members: number }>(
      `SELECT p.type::text AS type, p.status::text AS status,
              (SELECT count(*)::int FROM project_members m WHERE m.project_id = p.id) AS members
         FROM projects p WHERE p.owner_profile_id = $1 ORDER BY p.type`,
      [owner.profile_id],
    )
    expect(ventures).toEqual([
      { type: 'PROJECT', status: 'DRAFT', members: 0 },
      { type: 'STARTUP', status: 'DRAFT', members: 0 },
    ])
    expect(await completion(page.request)).toBe(percent)
    // Canonical edit; type stays fixed.
    const startup = created['Startup UAT']!
    await page.locator('#ve-name').fill('Startup UAT 2')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('[data-status]')).toContainText('đã lưu lúc')
    const typeChange = await page.request.patch(`/api/v1/ventures/${startup}`, {
      data: { type: 'PROJECT' },
    })
    expect(typeChange.status()).toBe(422)
    expect(await relations(page.request)).toEqual(
      expect.arrayContaining([
        { name: 'Dự Án UAT', relation: 'OWNER' },
        { name: 'Startup UAT 2', relation: 'OWNER' },
      ]),
    )
    await page.goto('/me/roles', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-card="roles"] [data-kind="venture"]')).toHaveCount(2)

    // HC-WF02-07: owner invites (no email is sent, none claimed).
    const mate = await persona(browser, 'mate', 'Thành Viên UAT')
    await onboard(mate.page, mate.name)
    const mateIds = await ids(mate.email)
    const matePercent = await completion(mate.page.request)
    await page.goto(`/projects/${startup}/team`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Mời thành viên' }).click()
    await page.locator('#team-invite-email').fill(mate.email)
    await page.locator('#team-invite-role').fill('CTO')
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.locator('[data-state="invite-created"]')).toContainText('Chưa có email')
    const [invite] = await query<{ id: string; state: string; profile_id: string | null }>(
      `SELECT id::text, state::text AS state, profile_id::text FROM project_members WHERE project_id = $1`,
      [startup],
    )
    expect(invite).toMatchObject({ state: 'PENDING_CONFIRMATION', profile_id: null })

    // HC-WF02-08: the invitee signs in again → still pending; explicit accept.
    await mate.context.clearCookies()
    await signIn(mate.page, mate.email)
    await expect(mate.page).toHaveURL('/me')
    const [still] = await query<{ state: string }>(
      'SELECT state::text AS state FROM project_members WHERE id = $1',
      [invite!.id],
    )
    expect(still!.state).toBe('PENDING_CONFIRMATION')
    await mate.page.goto(`/projects/${startup}/team`, { waitUntil: 'networkidle' })
    await mate.page.getByRole('button', { name: 'Nhận lời mời' }).click()
    await expect(mate.page.locator('[data-team-view]')).toHaveAttribute('data-viewer', 'MEMBER')
    await expect(mate.page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(0)
    expect(await relations(mate.page.request)).toEqual([
      { name: 'Startup UAT 2', relation: 'MEMBER' },
    ])
    expect(await completion(mate.page.request)).toBe(matePercent)
    const [mateRoles] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id = $1',
      [mateIds.profile_id],
    )
    expect(mateRoles!.n).toBe(0)
    // The member sees a read-only team and cannot edit the venture.
    await expect(mate.page.getByRole('button', { name: 'Mời thành viên' })).toHaveCount(0)
    expect(
      (
        await mate.page.request.patch(`/api/v1/ventures/${startup}`, { data: { name: 'x' } })
      ).status(),
    ).toBe(403)
    // PRIVATE: another member cannot fetch the owner's avatar.
    expect((await mate.page.request.get(avatarUrl)).status()).not.toBe(200)

    // HC-WF02-09 / 10: role edit, then removal (history kept).
    await page.reload({ waitUntil: 'networkidle' })
    const row = page.locator('[data-row-kind="ACTIVE_MEMBER"]')
    await expect(row).toContainText('Thành Viên UAT')
    await row.getByRole('button', { name: 'Tuỳ chọn' }).click()
    await page.getByRole('menuitem', { name: 'Sửa vai trò' }).click()
    await row.locator('input').fill('Cố vấn')
    await row.getByRole('button', { name: 'Lưu' }).click()
    await expect(row).toContainText('Cố vấn')
    await row.getByRole('button', { name: 'Tuỳ chọn' }).click()
    await page.getByRole('menuitem', { name: 'Gỡ khỏi đội' }).click()
    await row.getByRole('button', { name: 'Gỡ', exact: true }).click()
    await expect(page.locator('[data-row-kind="ACTIVE_MEMBER"]')).toHaveCount(0)
    const [removed] = await query<{ state: string; ended: boolean; label: string }>(
      `SELECT state::text AS state, ended_at IS NOT NULL AS ended, role_label AS label FROM project_members WHERE id = $1`,
      [invite!.id],
    )
    expect(removed).toEqual({ state: 'REMOVED', ended: true, label: 'Cố vấn' })
    expect(await relations(mate.page.request)).toEqual([])
    expect((await mate.page.goto(`/projects/${startup}/team`))?.status()).toBe(404)
    expect(await completion(page.request)).toBe(percent)

    // HC-WF02-11: sessions; revoke another session → enforced at once.
    const second = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const secondPage = await second.newPage()
    await signIn(secondPage, ownerEmail)
    await expect(secondPage).toHaveURL('/me')
    await page.goto('/me/settings', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-session="current"]')).toHaveCount(1)
    await expect(page.locator('[data-session="other"]')).toHaveCount(1)
    const listed = await (await page.request.get('/api/v1/me/sessions')).json()
    expect(JSON.stringify(listed)).not.toMatch(/token|hash/i)
    await page.locator('[data-session="other"]').getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page.locator('[data-session="other"]')).toHaveCount(0)
    await secondPage.goto('/me/settings')
    await expect(secondPage).toHaveURL('/auth')
    expect((await secondPage.request.get('/api/v1/me/profile')).status()).toBe(401)

    // HC-WF02-12: deletion REQUEST only; nothing else changes; duplicate is canonical.
    const before = await footprint(owner.account_id, owner.profile_id)
    const danger = page.locator('[data-card="danger"]')
    await danger.getByRole('button', { name: 'Yêu cầu xoá tài khoản' }).click()
    await danger.getByRole('button', { name: 'Xác nhận gửi yêu cầu' }).click()
    await expect(page.locator('[data-state="deletion-requested"]')).toBeVisible()
    const again = await page.request.post('/api/v1/me/account-deletion-request')
    expect(again.status()).toBe(200)
    const [requests] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM account_deletion_requests WHERE account_id = $1',
      [owner.account_id],
    )
    expect(requests!.n).toBe(1)
    expect(await footprint(owner.account_id, owner.profile_id)).toEqual(before)
    expect(await completion(page.request)).toBe(percent)
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL('/me')

    // Entity invariants for this journey (Audit 2).
    const [inv] = await query<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM project_members m JOIN projects p ON p.id = m.project_id
                WHERE p.owner_profile_id = $1 AND m.profile_id = $1) AS owner_rows,
              (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id IN ($1, $2)) AS role_rows,
              (SELECT count(*)::int FROM (SELECT account_id FROM individual_profiles GROUP BY account_id HAVING count(*) > 1) d) AS dup_profiles,
              (SELECT count(*)::int FROM (SELECT project_id, profile_id FROM project_members WHERE state = 'ACTIVE' GROUP BY 1, 2 HAVING count(*) > 1) d) AS dup_active,
              (SELECT count(*)::int FROM projects WHERE owner_profile_id = $1) AS ventures`,
      [owner.profile_id, mateIds.profile_id],
    )
    expect(inv).toEqual({
      owner_rows: 0,
      role_rows: 0,
      dup_profiles: 0,
      dup_active: 0,
      ventures: 2,
    })
    const programmesAfter = await query<{ n: number }>(
      'SELECT (SELECT count(*) FROM programmes)::int + (SELECT count(*) FROM events)::int AS n',
    )
    expect(programmesAfter[0]!.n).toBe(programmesBefore[0]!.n)

    await mate.context.close()
    await second.close()
    expect(context).toBeTruthy()
  })
})

test.describe('WF02 UAT — alternate and negative paths', () => {
  test('ALT-01 guest: every WF02 route → /auth', async ({ page }) => {
    for (const route of MEMBER_ROUTES) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/auth')
    }
  })

  test('ALT-02 incomplete onboarding cannot bypass into WF02 (pages and APIs)', async ({
    page,
  }) => {
    await signIn(page, newEmail('partial'))
    await expect(page).toHaveURL('/onboarding/purpose')
    for (const route of MEMBER_ROUTES) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/onboarding/purpose')
    }
    const r = await page.request.post('/api/v1/ventures', { data: { type: 'PROJECT', name: 'x' } })
    expect(r.status()).toBe(403)
  })

  test('ALT-03 a used magic link never signs in again', async ({ page, browser }) => {
    const email = newEmail('used')
    const token = await signIn(page, email)
    await onboard(page, 'Link Once')
    const other: BrowserContext = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const p2 = await other.newPage()
    await p2.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(p2).not.toHaveURL('/me')
    expect((await p2.request.get('/api/v1/me/profile')).status()).toBe(401)
    await other.close()
  })

  test('ALT-04 foreign session, venture and membership ids are hidden (IDOR)', async ({
    page,
    browser,
  }) => {
    const a = newEmail('idor-a')
    await signIn(page, a)
    await onboard(page, 'IDOR A')
    const b = await persona(browser, 'idor-b', 'IDOR B')
    await onboard(b.page, b.name)
    const [bSession] = await query<{ id: string }>(
      `SELECT s.id::text FROM user_sessions s JOIN user_accounts u ON u.id = s.account_id
        WHERE u.email_normalized = $1 AND s.revoked_at IS NULL LIMIT 1`,
      [b.email],
    )
    expect((await page.request.delete(`/api/v1/me/sessions/${bSession!.id}`)).status()).toBe(404)
    expect((await b.page.request.get('/api/v1/me/profile')).status()).toBe(200)

    const v = await (
      await b.page.request.post('/api/v1/ventures', { data: { type: 'STARTUP', name: 'B only' } })
    ).json()
    const inv = await (
      await b.page.request.post(`/api/v1/ventures/${v.id}/team/invitations`, {
        data: { email: 'someone@example.test' },
      })
    ).json()
    for (const r of [
      await page.request.get(`/api/v1/ventures/${v.id}`),
      await page.request.patch(`/api/v1/ventures/${v.id}`, { data: { name: 'x' } }),
      await page.request.get(`/api/v1/ventures/${v.id}/team`),
      await page.request.delete(`/api/v1/ventures/${v.id}/team/${inv.membership_id}`),
      await page.request.post(
        `/api/v1/ventures/${v.id}/team/invitations/${inv.membership_id}/accept`,
      ),
    ]) {
      expect(r.status()).toBe(404)
    }
    // Profile spoofing: authority fields are refused on the own profile.
    const spoof = await page.request.patch('/api/v1/me/profile', {
      data: { completion_percent: 100 },
    })
    expect(spoof.status()).toBe(422)
    await b.context.close()
  })

  test('ALT-05 ARCHIVED venture is read-only on page, API and team', async ({ page }) => {
    await signIn(page, newEmail('arch'))
    await onboard(page, 'Archive Owner')
    const v = await (
      await page.request.post('/api/v1/ventures', { data: { type: 'PROJECT', name: 'Old' } })
    ).json()
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect(
      (await page.request.patch(`/api/v1/ventures/${v.id}`, { data: { name: 'x' } })).status(),
    ).toBe(409)
    expect(
      (
        await page.request.post(`/api/v1/ventures/${v.id}/team/invitations`, {
          data: { email: 'late@example.test' },
        })
      ).status(),
    ).toBe(409)
    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="read-only"]')).toBeVisible()
    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: 'Mời thành viên' })).toHaveCount(0)
  })

  test('ALT-06 decline and cancel paths keep history and grant nothing', async ({
    page,
    browser,
  }) => {
    await signIn(page, newEmail('dec-owner'))
    await onboard(page, 'Decline Owner')
    const v = await (
      await page.request.post('/api/v1/ventures', { data: { type: 'STARTUP', name: 'Dec' } })
    ).json()
    const who = await persona(browser, 'decliner', 'Decliner')
    await onboard(who.page, who.name)
    const inv = await (
      await page.request.post(`/api/v1/ventures/${v.id}/team/invitations`, {
        data: { email: who.email },
      })
    ).json()
    await who.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await who.page.getByRole('button', { name: 'Từ chối' }).click()
    await expect(who.page.locator('[data-state="declined"]')).toBeVisible()
    const cancel = await (
      await page.request.post(`/api/v1/ventures/${v.id}/team/invitations`, {
        data: { email: 'gone@example.test' },
      })
    ).json()
    expect(
      (await page.request.delete(`/api/v1/ventures/${v.id}/team/${cancel.membership_id}`)).status(),
    ).toBe(200)
    const rows = await query<{ state: string }>(
      'SELECT state::text AS state FROM project_members WHERE project_id = $1 ORDER BY invited_at',
      [v.id],
    )
    expect(rows.map((r) => r.state)).toEqual(['REJECTED', 'REMOVED'])
    expect(await relations(who.page.request)).toEqual([])
    expect(inv.kind).toBe('PENDING_INVITATION')
    await who.context.close()
  })
})
