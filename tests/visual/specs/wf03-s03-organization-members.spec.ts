import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF03-S03 — organization members (/ops/org/:orgId/members).
 * API 05 §8.3; DEC-WF03-G3/G4/G5/G6; DEC-WF03-S03-D1..D3; the page is the
 * corrected L26 CHP7 subset (TASK 22.4, DEC-L3-D4).
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const membersApi = (id: string) => `/api/v1/ops/organizations/${id}/members`

let consoleErrors: string[] = []
const profiles: string[] = []
const orgs: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  for (const table of [
    'community_memberships',
    'leadership_records',
    'profile_visibility_settings',
  ]) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [orgs])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(
  name: string,
  opts: { org?: string; state?: string; leader?: string; level?: string; onboarded?: boolean } = {},
) {
  const email = `s03-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, headline, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'Kỹ sư', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  profiles.push(p!.id)
  if (opts.org && opts.state) {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at, created_at)
       VALUES ($1, $2, $3::membership_state, $4, '2026-02-01T03:00:00Z', '2026-02-01T03:00:00Z')`,
      [
        p!.id,
        opts.org,
        opts.state,
        opts.state === 'PENDING_APPROVAL' ? 'SELF_DECLARED' : 'ORGANIZATION_VERIFIED',
      ],
    )
  }
  if (opts.org && opts.leader) {
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, $3, 'ACTIVE')`,
      [p!.id, opts.org, opts.leader],
    )
  }
  if (opts.level) {
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, group_overrides) VALUES ($1, $2)`,
      [p!.id, JSON.stringify({ PROFILE_DISCOVERY: opts.level })],
    )
  }
  return { email, profileId: p!.id }
}

const rows = (page: Page) => page.locator('[data-member-row]')

test.describe('WF03-S03 access and scope', () => {
  test('1/2/7/8. guest → /auth; member and membership + leadership alone → 404 / 403', async ({
    page,
    request,
  }) => {
    await page.goto(`/ops/org/${CHAPTER_01}/members`)
    await expect(page).toHaveURL('/auth')
    expect((await request.get(membersApi(CHAPTER_01))).status()).toBe(401)
    const tied = await person('S03 Tied', {
      org: CHAPTER_01,
      state: 'ACTIVE',
      leader: 'Trưởng ban',
    })
    for (const email of ['member@example.test', tied.email]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(`/ops/org/${CHAPTER_01}/members`))?.status(), email).toBe(404)
      expect((await page.request.get(membersApi(CHAPTER_01))).status(), email).toBe(403)
    }
  })

  test('3/4/5/6/10/11. leader: own org only; ids and headers spoofed; no PII or role data', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
    await expect(rows(page).first()).toBeVisible()
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/@|HUB_COMMUNITY_LEADER|PLATFORM_ADMIN|role_code/)
    const body = await (await page.request.get(membersApi(CHAPTER_01))).json()
    expect(JSON.stringify(body)).not.toMatch(/@|email|account|bio|role_code|capabilit|metadata/i)
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        'leadership',
        'membership',
        'profile',
        'profile_id',
      ])
    }
    for (const id of [CLUB_01, CHAPTER_02, 'sample-org']) {
      expect((await page.goto(`/ops/org/${id}/members`))?.status(), id).toBe(404)
      const r = await page.request.get(membersApi(id), { headers: { 'x-org-id': CHAPTER_01 } })
      expect(r.status(), id).toBe(403)
    }
    // A member's profile id under a foreign org path stays denied.
    const someone = body.items[0].profile_id as string
    expect((await page.goto(`/ops/org/${CHAPTER_02}/members/${someone}`))?.status()).toBe(404)
  })

  test('9/12. PRIVATE discovery: identity hidden from ops (admin too), facts shown, search blind', async ({
    page,
  }) => {
    const hidden = await person('S03 Ẩn Danh', {
      org: CHAPTER_01,
      state: 'ACTIVE',
      level: 'PRIVATE',
    })
    for (const email of ['leader@example.test', 'ops@example.test']) {
      await page.context().clearCookies()
      await login(page.request, email)
      await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
      await page.locator('[data-tab="active"]').click()
      const row = page.locator(`[data-member-row="${hidden.profileId}"]`)
      await expect(row).toContainText('Hồ sơ không công khai')
      await expect(row).not.toContainText('Ẩn Danh')
      await expect(row).toContainText('Thành viên')
      const api = await (
        await page.request.get(`${membersApi(CHAPTER_01)}?q=${encodeURIComponent('Ẩn Danh')}`)
      ).json()
      expect(api.items).toEqual([])
    }
  })
})

test.describe('WF03-S03 filters and states', () => {
  test('tabs: pending requests first, then active and all; leaders block; search by visible name', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    const [o] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S03 Filter Club', 'PUBLISHED') RETURNING id::text`,
      [`s03-f-${Date.now()}`],
    )
    orgs.push(o!.id)
    const a = await person('S03 An', { org: o!.id, state: 'ACTIVE', leader: 'Chủ nhiệm' })
    const b = await person('S03 Bình', { org: o!.id, state: 'PENDING_APPROVAL' })
    await page.goto(`/ops/org/${o!.id}/members`, { waitUntil: 'networkidle' })
    // Default tab: the pending requests, each with the inline review actions.
    await expect(page.locator('[data-tab="pending"]')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-tab="pending"]')).toHaveText('Đơn chờ duyệt (1)')
    await expect(rows(page)).toHaveCount(1)
    const pending = page.locator(`[data-member-row="${b.profileId}"]`)
    await expect(pending).toHaveAttribute('data-membership-state', 'PENDING_APPROVAL')
    await expect(pending.locator('[data-action="approve"]')).toHaveText('Duyệt')
    await expect(pending.locator('[data-action="reject"]')).toHaveText('Từ chối')
    await page.locator('[data-tab="active"]').click()
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator(`[data-member-row="${a.profileId}"]`)).toContainText('Chủ nhiệm')
    await expect(page.locator('[data-action="approve"]')).toHaveCount(0)
    await page.locator('[data-tab="all"]').click()
    await expect(rows(page)).toHaveCount(2)
    // Ban điều hành: ACTIVE leadership titles; "Xem cả" opens the active tab.
    const leaders = page.locator('[data-card="leaders"]')
    await expect(leaders).toContainText('Ban điều hành · 1')
    await expect(leaders.locator('[data-leader]')).toHaveCount(1)
    await expect(leaders.locator(`[data-leader="${a.profileId}"]`)).toContainText('Chủ nhiệm')
    await leaders.getByRole('button', { name: 'Xem cả 1 thành viên →' }).click()
    await expect(page.locator('[data-tab="active"]')).toHaveAttribute('aria-selected', 'true')
    await page.locator('[data-tab="all"]').click()
    await page.getByRole('searchbox').fill('bình')
    await page.getByRole('searchbox').press('Enter')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator(`[data-member-row="${b.profileId}"] a`).first()).toHaveAttribute(
      'href',
      `/ops/org/${o!.id}/members/${b.profileId}`,
    )
  })

  test('inline review (DEC-L3-D4): Duyệt / Từ chối send the S04 call; the server decides', async ({
    page,
  }) => {
    const approve = await person('S03 Duyệt', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    const reject = await person('S03 Từ Chối', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    const refused = await person('S03 Server', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    const foreign = await person('S03 Foreign', { org: CHAPTER_02, state: 'PENDING_APPROVAL' })
    const stateOf = async (profileId: string) =>
      (
        await query<{ id: string; state: string; source: string }>(
          `SELECT id::text, state::text AS state, source FROM community_memberships WHERE profile_id = $1`,
          [profileId],
        )
      )[0]!
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
    const row = (id: string) => page.locator(`[data-member-row="${id}"]`)

    await row(approve.profileId).locator('[data-action="approve"]').click()
    await expect(row(approve.profileId)).toHaveCount(0)
    expect(await stateOf(approve.profileId)).toMatchObject({
      state: 'ACTIVE',
      source: 'ORGANIZATION_VERIFIED',
    })
    await row(reject.profileId).locator('[data-action="reject"]').click()
    await expect(row(reject.profileId)).toHaveCount(0)
    expect((await stateOf(reject.profileId)).state).toBe('REJECTED')
    const audited = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE resource_id = ANY($1::uuid[]) ORDER BY created_at, id`,
      [[(await stateOf(approve.profileId)).id, (await stateOf(reject.profileId)).id]],
    )
    expect(audited.map((e) => e.action).sort()).toEqual([
      'MEMBERSHIP_APPROVED',
      'MEMBERSHIP_REJECTED',
    ])

    // A refused call leaves the request pending and says so; no dead state.
    await page.route('**/api/v1/ops/organizations/*/memberships/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { code: 'FORBIDDEN', message: 'x', request_id: 'r' },
            }),
          })
        : route.continue(),
    )
    await row(refused.profileId).locator('[data-action="approve"]').click()
    await expect(page.locator('[data-state="action-failed"]')).toHaveText(
      'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.',
    )
    await expect(row(refused.profileId)).toHaveAttribute(
      'data-membership-state',
      'PENDING_APPROVAL',
    )
    expect((await stateOf(refused.profileId)).state).toBe('PENDING_APPROVAL')
    await page.unroute('**/api/v1/ops/organizations/*/memberships/*')

    // The same call on a foreign organization's request is refused on the server.
    const other = await stateOf(foreign.profileId)
    for (const org of [CHAPTER_02, CHAPTER_01]) {
      const r = await page.request.patch(
        `/api/v1/ops/organizations/${org}/memberships/${other.id}`,
        {
          data: { status: 'ACTIVE' },
          headers: { 'x-org-id': CHAPTER_02, 'x-role': 'PLATFORM_ADMIN' },
        },
      )
      expect([403, 404], org).toContain(r.status())
    }
    expect((await stateOf(foreign.profileId)).state).toBe('PENDING_APPROVAL')
    await query(
      `DELETE FROM audit_events WHERE resource_id IN (SELECT id FROM community_memberships WHERE profile_id = ANY($1::uuid[]))`,
      [[approve.profileId, reject.profileId]],
    )
  })

  test('empty and error states', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    const [o] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S03 Empty Club', 'DRAFT') RETURNING id::text`,
      [`s03-e-${Date.now()}`],
    )
    orgs.push(o!.id)
    await page.goto(`/ops/org/${o!.id}/members`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="members-empty"]')).toHaveText(
      'Không có thành viên phù hợp.',
    )
    await page.locator('[data-tab="all"]').click()
    await expect(page.locator('[data-state="members-empty"]')).toHaveText('Chưa có thành viên nào.')
    await page.route('**/api/v1/ops/organizations/*/members*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.reload({ waitUntil: 'networkidle' })
    const failed = page.locator('[data-state="members-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).not.toContainText(/500|UNCONTRACTED|request/i)
    await page.unroute('**/api/v1/ops/organizations/*/members*')
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator('[data-state="members-empty"]')).toBeVisible()
  })
})

test.describe('WF03-S03 pixel QA (corrected L26 CHP7 subset)', () => {
  const REFERENCE = 'design-reference/final/revision/L3/L26__chapter-members__SOURCE.png'
  /**
   * L26 is drawn 1600 wide with its own 248px sidebar; inside OpsShell (216px)
   * the left column moves by -32 and the right edge by -160. Measured once: the
   * leaders card top, the first request row and the first leader row.
   */
  const LEFT = -32
  const RIGHT = -160
  const REF_LEADERS = 1025
  /** Drawn order. The page lists names alphabetically (S03-D1), so each row is compared with the drawn row of the same name. */
  const REF_ROWS = ['Nguyễn Thị Mai', 'Lê Văn Bình', 'Đỗ Quang Huy', 'Trần Bảo Ngọc']
  const REF_LEADER_ROWS = [
    ['Trần Quốc Huy', 'Người đứng đầu'],
    ['Lê Thu Trang', 'Điều phối'],
    ['Phạm Đức Anh', 'Điều phối'],
  ] as const

  test('1440×900 full page: title, pending tab, table head, request rows, review actions, leaders', async ({
    page,
  }) => {
    const [o] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CHAPTER', $1, 'Chapter QA', 'PUBLISHED') RETURNING id::text`,
      [`s03-px-${Date.now()}`],
    )
    orgs.push(o!.id)
    for (const name of REF_ROWS) await person(name, { org: o!.id, state: 'PENDING_APPROVAL' })
    for (const [name, title] of REF_LEADER_ROWS)
      await person(name, { org: o!.id, state: 'ACTIVE', leader: title })

    await login(page.request, 'ops@example.test')
    await page.goto(`/ops/org/${o!.id}/members`, { waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(4)
    await expect(page.locator('[data-action="approve"]')).toHaveCount(4)
    await expect(page.locator('[data-leader]')).toHaveCount(3)
    const tab = (await page.locator('[data-tab="pending"]').boundingBox())!
    const card = (await page.locator('[data-card="leaders"]').boundingBox())!
    const dyLeaders = Math.round(card.y) - REF_LEADERS
    const topsOf = (selector: string) =>
      page
        .locator(selector)
        .evaluateAll((els) =>
          Object.fromEntries(
            els.map((el) => [
              el.querySelector('[class*="name"], [class*="leaderName"]')!.textContent!,
              Math.round(el.getBoundingClientRect().y + scrollY),
            ]),
          ),
        )
    const rowTop = await topsOf('[data-member-row]')
    const leaderTop = await topsOf('[data-leader]')
    // Each row's second line is the visible headline where L26 prints an email (G4).
    const second = await page.locator('[data-member-row] [class*="headline"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x - 2, y: r.y + scrollY - 2, width: r.width + 40, height: r.height + 4 }
      }),
    )
    await auditRevision(page, {
      name: 'WF03-S03.L26',
      reference: REFERENCE,
      full: true,
      exclude: second,
      segments: [
        { name: 'title', reference: { x: 272, y: 20, width: 260, height: 44 }, dx: LEFT, dy: 0 },
        {
          name: 'tab-pending',
          reference: { x: 276, y: 100, width: 156, height: 48 },
          dx: Math.round(tab.x) - 280,
          dy: Math.round(tab.y) - 105,
        },
        {
          name: 'table-head',
          reference: { x: 281, y: 166, width: 104, height: 140 },
          dx: LEFT,
          dy: 0,
        },
        {
          name: 'head-block',
          reference: { x: 560, y: 166, width: 480, height: 140 },
          dx: LEFT,
          dy: 0,
        },
        ...REF_ROWS.flatMap((name, i) => [
          {
            name: `row-${i + 1}-person`,
            reference: { x: 281, y: 305 + 143 * i, width: 320, height: 143 },
            dx: LEFT,
            dy: rowTop[name]! - (305 + 143 * i),
          },
          {
            name: `row-${i + 1}-review`,
            reference: { x: 1370, y: 340 + 143 * i, width: 185, height: 62 },
            dx: RIGHT,
            dy: rowTop[name]! - (305 + 143 * i),
          },
        ]),
        {
          name: 'table-bottom',
          reference: { x: 281, y: 845, width: 400, height: 40 },
          dx: LEFT,
          dy: 0,
        },
        {
          name: 'leaders-head',
          reference: { x: 281, y: 1025, width: 115, height: 53 },
          dx: LEFT,
          dy: dyLeaders,
        },
        ...REF_LEADER_ROWS.map(([name], i) => ({
          name: `leader-${i + 1}`,
          reference: { x: 281, y: 1078 + 139 * i, width: 240, height: 139 },
          dx: LEFT,
          dy: leaderTop[name]! - (1078 + 139 * i),
        })),
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SHELL',
          reason:
            'HD-11 / DEC-L3-D4: OpsShell stays; the reference "Quản trị chapter" sidebar is a shell change',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'DEC-L3-D4 (Bucket B): "Mời qua email", "Xuất danh sách", the rule notes, "Chuyển giao" / "Gỡ quyền" and the approval line under each leader are not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'G4 / S03-D1: no email — the second identity line is the visible headline; no join-reason column; "gửi dd/mm/yyyy" instead of a relative time; the head labels sit over their columns',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-L3-D4: the third tab is "Tất cả" (no "đã rời" grouping in P0); the leaders label counts the ACTIVE titles; chips carry display titles (G6); every pending row keeps the attention tint; rows follow the S03-D1 alphabetical order, so each is compared with the drawn row of the same name',
        },
        { class: 'INTENTIONAL-SCOPE', reason: 'HD-11: no floating "Góp ý" button' },
      ],
    })
  })
})
