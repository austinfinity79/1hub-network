import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * WF03-COMPLETION-AUDIT — happy-path UAT across S01 → S09 as ONE journey
 * (docs/implementation/WF03_UAT_MATRIX.md, HC-WF03-01..20), plus the
 * workflow-level authorization matrix and cross-cutting negative cases.
 * Sign-in is the real magic-link path (WF01); a new member requests
 * membership through WF02-S04. Canonical DB state is checked after every
 * mutation. `UAT_KEEP=1` keeps the journey data for the restart proof.
 */

const FIXTURE = path.join(REPO_ROOT, 'tests/visual/fixtures/wf01-s06-qa-vocabulary.sql')
const REGION = '20000000-0000-0000-0000-000000000002'
const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const PROGRAMME_EVENT = 'b0000000-0000-0000-0000-000000000002'
const UAT_CLB_SLUG = `uat3-clb-${Date.now()}`
const UAT_EVENT = `UAT3 Chapter Summit ${Date.now().toString(36)}`
const UAT_DESCRIPTION = 'Chapter 01 — cộng đồng khởi nghiệp (UAT3)'
const KEEP = process.env.UAT_KEEP === '1'

/** Every audit code the application may write (src/lib/audit/audit.ts). */
const AUDIT_CODES = [
  'CONSENT_ACCEPTED',
  'PROFILE_VISIBILITY_CHANGED',
  'PROFILE_ACTIVATED',
  'MEMBERSHIP_REQUESTED',
  'ACCOUNT_DELETION_REQUESTED',
  'VENTURE_TEAM_INVITED',
  'VENTURE_TEAM_JOINED',
  'VENTURE_TEAM_INVITATION_REJECTED',
  'VENTURE_TEAM_ROLE_CHANGED',
  'VENTURE_TEAM_REMOVED',
  'MEMBERSHIP_APPROVED',
  'MEMBERSHIP_REJECTED',
  'LEADERSHIP_CREATED',
  'LEADERSHIP_ENDED',
  'ORGANIZATION_UPDATED',
  'ORGANIZATION_RELATIONSHIP_CREATED',
  'ORGANIZATION_RELATIONSHIP_ENDED',
  'EVENT_CREATED',
  'EVENT_UPDATED',
  'EVENT_PUBLISHED',
  'EVENT_CANCELLED',
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
  if (!KEEP) await cleanup()
  await closePool()
})

/** Removes the journey's rows and restores the one fixture field it edits. */
async function cleanup() {
  const events = `SELECT id FROM events WHERE name LIKE 'UAT3%'`
  const rels = `SELECT id FROM organization_relationships WHERE target_org_id IN (SELECT id FROM organizations WHERE slug LIKE 'uat3-%')`
  const people = `SELECT p.id FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id WHERE a.email LIKE 'uat3-%'`
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (${events}) OR resource_id IN (${rels})
        OR resource_id IN (SELECT id FROM community_memberships WHERE profile_id IN (${people}))
        OR resource_id IN (SELECT id FROM leadership_records WHERE profile_id IN (${people}))
        OR (action = 'ORGANIZATION_UPDATED' AND resource_id = $1)`,
    [CHAPTER_01],
  )
  await query(`DELETE FROM events WHERE id IN (${events})`)
  await query(`DELETE FROM organization_relationships WHERE id IN (${rels})`)
  await query(`DELETE FROM organizations WHERE slug LIKE 'uat3-%'`)
  await query(`DELETE FROM leadership_records WHERE profile_id IN (${people})`)
  await query(`DELETE FROM community_memberships WHERE profile_id IN (${people})`)
  await query(`UPDATE organizations SET description = 'Fixture chapter' WHERE id = $1`, [
    CHAPTER_01,
  ])
}

const newEmail = (tag: string) =>
  `uat3-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`

async function signIn(page: Page, email: string) {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
  // The callback signs in client-side; wait until it has left /auth.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
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
  await page.getByRole('link', { name: 'Vào Tài khoản của tôi' }).click()
  await expect(page).toHaveURL('/me')
}

const audits = (resourceId: string) =>
  query<{ action: string }>(
    `SELECT action FROM audit_events WHERE resource_id = $1 ORDER BY action`,
    [resourceId],
  ).then((rows) => rows.map((r) => r.action))
const roleCount = async (profileId: string) =>
  Number(
    (
      await query<{ n: string }>(
        `SELECT count(*) AS n FROM role_assignments ra JOIN individual_profiles p ON p.id = $1
          WHERE ra.individual_profile_id = p.id OR ra.account_id = p.account_id`,
        [profileId],
      )
    )[0]!.n,
  )

test.describe('WF03 UAT — happy path', () => {
  test('UAT-WF03-J1: request → review → leadership → profile → hierarchy → event → public page', async ({
    browser,
    page,
  }) => {
    test.setTimeout(180_000)
    const pub = await (await page.request.get('/api/v1/organizations/by-slug/chapter-01')).json()

    // Preconditions: a new member onboards (WF01) and requests Chapter 01 (WF02-S04).
    const memberEmail = newEmail('member')
    await signIn(page, memberEmail)
    await onboard(page, 'Thành Viên UAT3')
    await page.goto('/me/roles', { waitUntil: 'networkidle' })
    await page.getByRole('combobox').selectOption({ label: 'Chapter 01' })
    await page.locator('[data-card="request"]').getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await expect(page.locator('[data-state="request-sent"]')).toBeVisible()
    const [member] = await query<{ profile_id: string; membership_id: string; state: string }>(
      `SELECT p.id::text AS profile_id, m.id::text AS membership_id, m.state::text AS state
         FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
         JOIN community_memberships m ON m.profile_id = p.id AND m.organization_id = $2
        WHERE a.email_normalized = $1`,
      [memberEmail, CHAPTER_01],
    )
    expect(member!.state).toBe('PENDING_APPROVAL')
    // Membership alone opens no ops area.
    expect((await page.goto('/ops/network'))?.status()).toBe(404)

    // HC-WF03-01..03: the leader signs in, enters /ops and sees exactly Chapter 01.
    const ops = await browser.newContext()
    const leader = await ops.newPage()
    await signIn(leader, 'leader@example.test')
    await leader.goto('/ops/network', { waitUntil: 'networkidle' })
    await expect(leader.locator('[data-org-row]')).toHaveCount(1)
    await expect(leader.locator(`[data-org-row="${CHAPTER_01}"]`)).toContainText('Chapter 01')

    // HC-WF03-04/05: select it → dashboard with the pending request counted.
    await leader.locator(`[data-org-row="${CHAPTER_01}"] a`).first().click()
    await expect(leader).toHaveURL(`/ops/org/${CHAPTER_01}`)
    const pending = Number(
      (
        await query<{ n: string }>(
          `SELECT count(*) AS n FROM community_memberships WHERE organization_id = $1 AND state = 'PENDING_APPROVAL'`,
          [CHAPTER_01],
        )
      )[0]!.n,
    )
    await expect(
      leader
        .locator(
          '[data-metric="pending_memberships"] [data-value], [data-metric="pending"] [data-value]',
        )
        .first(),
    ).toHaveText(String(pending))

    // HC-WF03-06/07: members → the pending row → S04.
    await leader.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
    const row = leader.locator(`[data-member-row="${member!.profile_id}"]`)
    await expect(row).toHaveAttribute('data-membership-state', 'PENDING_APPROVAL')
    await row.locator('a').click()
    await expect(leader).toHaveURL(`/ops/org/${CHAPTER_01}/members/${member!.profile_id}`)

    // HC-WF03-08/09: approve → ACTIVE, organization-verified, one audit event, no role.
    await leader.locator('[data-action="approve"]').click()
    await expect(leader.locator('[data-screen="WF03-S04"]')).toHaveAttribute(
      'data-membership-state',
      'ACTIVE',
    )
    const [approved] = await query<{ state: string; source: string }>(
      `SELECT state::text AS state, source FROM community_memberships WHERE id = $1`,
      [member!.membership_id],
    )
    expect(approved).toEqual({ state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED' })
    expect(await audits(member!.membership_id)).toEqual(
      ['MEMBERSHIP_APPROVED', 'MEMBERSHIP_REQUESTED'].sort(),
    )
    expect(await roleCount(member!.profile_id)).toBe(0)

    // HC-WF03-10: leadership title → ACTIVE record, one audit event, still no capability.
    await leader.locator('[data-action="add-leadership"]').click()
    await leader.locator('#leadership-title').fill('Điều phối UAT3')
    await leader.locator('[data-leadership-form] button[type="submit"]').click()
    await expect(leader.locator('[data-leadership]')).toContainText('Điều phối UAT3')
    const [lead] = await query<{ id: string; state: string }>(
      `SELECT id::text, state::text AS state FROM leadership_records WHERE profile_id = $1 AND organization_id = $2`,
      [member!.profile_id, CHAPTER_01],
    )
    expect(lead!.state).toBe('ACTIVE')
    expect(await audits(lead!.id)).toEqual(['LEADERSHIP_CREATED'])
    expect(await roleCount(member!.profile_id)).toBe(0)
    const memberSession = await (await page.request.get('/api/v1/session')).json()
    expect(memberSession.capabilities).toEqual([])
    expect((await page.goto(`/ops/org/${CHAPTER_01}`))?.status()).toBe(404)

    // HC-WF03-11/12: profile → edit the description → one ORGANIZATION_UPDATED.
    await leader.goto(`/ops/org/${CHAPTER_01}/profile`, { waitUntil: 'networkidle' })
    await leader.locator('[data-action="edit"]').click()
    await leader.locator('#org-description').fill(UAT_DESCRIPTION)
    await leader.locator('[data-action="save"]').click()
    await expect(leader.locator('[data-state="save-success"]')).toBeVisible()
    const [profile] = await query<{ description: string }>(
      `SELECT description FROM organizations WHERE id = $1`,
      [CHAPTER_01],
    )
    expect(profile!.description).toBe(UAT_DESCRIPTION)
    expect(await audits(CHAPTER_01)).toEqual(['ORGANIZATION_UPDATED'])

    // HC-WF03-13: hierarchy read-only on S06, from organization_relationships.
    await expect(leader.locator('[data-relation="parent"]')).toContainText('HUB Network')
    await expect(leader.locator('[data-relation="child"]', { hasText: 'Club 01' })).toBeVisible()

    // HC-WF03-14: a relationship operation needs both ends in scope → the platform admin
    // attaches a new parentless CLB to Chapter 01 through S08.
    const [clb] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'UAT3 CLB', 'PUBLISHED') RETURNING id::text`,
      [UAT_CLB_SLUG],
    )
    const adminCtx = await browser.newContext()
    const admin = await adminCtx.newPage()
    await signIn(admin, 'ops@example.test')
    await admin.goto(`/ops/org/${CHAPTER_01}/settings`, { waitUntil: 'networkidle' })
    await admin.locator('#relationship-mode').selectOption('CHILD')
    await admin.locator('#relationship-target').selectOption(clb!.id)
    await admin.locator('[data-action="save"]').click()
    await expect(admin.locator('[data-state="save-success"]')).toBeVisible()
    const [rel] = await query<{ id: string; source: string }>(
      `SELECT id::text, source_org_id::text AS source FROM organization_relationships
        WHERE target_org_id = $1 AND relationship_type = 'PARENT' AND state = 'ACTIVE'`,
      [clb!.id],
    )
    expect(rel!.source).toBe(CHAPTER_01)
    expect(await audits(rel!.id)).toEqual(['ORGANIZATION_RELATIONSHIP_CREATED'])
    const [legacy] = await query<{ parent_id: string | null }>(
      `SELECT parent_id::text FROM organizations WHERE id = $1`,
      [clb!.id],
    )
    expect(legacy!.parent_id).toBeNull()
    await adminCtx.close()

    // HC-WF03-15..17: the leader creates, edits and publishes a standalone event.
    await leader.goto(`/ops/org/${CHAPTER_01}/events`, { waitUntil: 'networkidle' })
    await leader.locator('[data-action="new-event"]').click()
    await leader.locator('#event-name').fill(UAT_EVENT)
    await leader.locator('#event-starts').fill('2031-05-20T09:00')
    await leader.locator('#event-ends').fill('2031-05-20T12:00')
    await leader.locator('[data-action="save"]').click()
    await expect(leader.locator('[data-card="detail"]')).toBeVisible()
    await leader.locator('#event-location').fill('Cần Thơ')
    await leader.locator('[data-action="save"]').click()
    await expect(leader.locator('[data-state="action-success"]')).toHaveText('Đã lưu thay đổi.')
    await leader.locator('[data-action="publish"]').click()
    const eventRow = leader.locator('[data-event]', { hasText: UAT_EVENT })
    await expect(eventRow).toHaveAttribute('data-status', 'PUBLISHED')
    const [ev] = await query<{
      id: string
      status: string
      programme_id: string | null
      organization_id: string
    }>(
      `SELECT id::text, status::text AS status, programme_id::text, organization_id::text FROM events WHERE name = $1`,
      [UAT_EVENT],
    )
    expect(ev).toMatchObject({
      status: 'PUBLISHED',
      programme_id: null,
      organization_id: CHAPTER_01,
    })
    expect(await audits(ev!.id)).toEqual(['EVENT_CREATED', 'EVENT_PUBLISHED', 'EVENT_UPDATED'])
    // The WF04 programme-linked draft never appears in S07.
    await expect(leader.locator(`[data-event="${PROGRAMME_EVENT}"]`)).toHaveCount(0)
    await ops.close()

    // HC-WF03-18..20: a guest opens the public page.
    const guestCtx = await browser.newContext()
    const guest = await guestCtx.newPage()
    expect((await guest.goto('/organizations/chapter-01'))?.status()).toBe(200)
    await expect(guest.locator('[data-event-card]', { hasText: UAT_EVENT })).toBeVisible()
    await expect(guest.locator(`[data-child="${UAT_CLB_SLUG}"]`)).toBeVisible()
    await expect(guest.locator('header')).toContainText(UAT_DESCRIPTION)
    const text = await guest.locator('body').innerText()
    expect(text).not.toContain('Thành Viên UAT3')
    expect(text).not.toContain('Điều phối UAT3')
    expect(text).not.toMatch(/@example\.test|PENDING|ORGANIZATION_VERIFIED/)
    const after = await (await guest.request.get('/api/v1/organizations/by-slug/chapter-01')).json()
    expect(after.stats.active_members).toBe(pub.stats.active_members + 1)
    expect(after.stats.children).toBe(pub.stats.children + 1)
    expect(after.stats.public_events).toBe(pub.stats.public_events + 1)
    await guestCtx.close()
  })
})

test.describe('WF03 UAT — authorization matrix (AUTHN / capability / scope / state)', () => {
  test('SEC-WF03-01: every protected WF03 API × guest, member, leader, admin; IDOR ids', async ({
    playwright,
  }) => {
    // Resources outside the leader's scope (Chapter 02), created for the probe.
    const [p] = await query<{ id: string }>(
      `SELECT id::text FROM individual_profiles WHERE id = '40000000-0000-0000-0000-000000000005'`,
    )
    const [foreignMembership] = await query<{ id: string }>(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED')
       ON CONFLICT DO NOTHING RETURNING id::text`,
      [p!.id, CHAPTER_02],
    )
    const [foreignLeadership] = await query<{ id: string }>(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'UAT3 Foreign', 'ACTIVE') RETURNING id::text`,
      [p!.id, CHAPTER_02],
    )
    const [foreignEvent] = await query<{ id: string }>(
      `INSERT INTO events (organization_id, slug, name, status, starts_at, ends_at)
       VALUES ($1, $2, 'UAT3 Foreign Event', 'PUBLISHED', now() + interval '9 days', now() + interval '10 days') RETURNING id::text`,
      [CHAPTER_02, `uat3-foreign-${Date.now()}`],
    )
    const before = await snapshot()
    const O = (org: string) => `/api/v1/ops/organizations/${org}`
    type Call = [string, 'get' | 'post' | 'patch', string, Record<string, unknown>?]
    const own: Call[] = [
      ['S01 list', 'get', '/api/v1/ops/organizations'],
      ['S02 dashboard', 'get', `${O(CHAPTER_01)}/dashboard`],
      ['S03 members', 'get', `${O(CHAPTER_01)}/members`],
      ['S04 detail', 'get', `${O(CHAPTER_01)}/members/40000000-0000-0000-0000-000000000005`],
      ['S07 events', 'get', `${O(CHAPTER_01)}/events`],
      ['S08 relationships', 'get', `${O(CHAPTER_01)}/relationships`],
    ]
    const foreign: Call[] = [
      ['S02 foreign', 'get', `${O(CHAPTER_02)}/dashboard`],
      ['S03 foreign', 'get', `${O(CHAPTER_02)}/members`],
      [
        'S04 review IDOR',
        'patch',
        `${O(CHAPTER_02)}/memberships/${foreignMembership?.id ?? CHAPTER_02}`,
        { status: 'ACTIVE' },
      ],
      [
        'S04 leadership IDOR',
        'patch',
        `${O(CHAPTER_02)}/leadership/${foreignLeadership!.id}`,
        { status: 'REVOKED' },
      ],
      ['S06 foreign', 'patch', `${O(CHAPTER_02)}/profile`, { name: 'UAT3 Hijack' }],
      ['S06 child', 'patch', `${O(CLUB_01)}/profile`, { name: 'UAT3 Hijack' }],
      ['S07 foreign create', 'post', `${O(CHAPTER_02)}/events`, { name: 'UAT3 Hijack' }],
      ['S08 foreign', 'get', `${O(HUB)}/relationships`],
      [
        'S08 close IDOR',
        'post',
        `${O(CHAPTER_02)}/relationships/d0000000-0000-0000-0000-000000000003/close`,
        {},
      ],
    ]
    const eventIdor: Call[] = [
      [
        'S07 event PATCH IDOR',
        'patch',
        `/api/v1/ops/events/${foreignEvent!.id}`,
        { name: 'UAT3 Hijack' },
      ],
      ['S07 event cancel IDOR', 'post', `/api/v1/ops/events/${foreignEvent!.id}/cancel`, {}],
      ['S07 WF04 event', 'patch', `/api/v1/ops/events/${PROGRAMME_EVENT}`, { name: 'UAT3 Hijack' }],
    ]
    const baseURL = test.info().project.use.baseURL!
    const ctx = async (email: string | null) => {
      const r = await playwright.request.newContext({ baseURL })
      if (email) expect((await r.post('/dev/login', { data: { email } })).ok()).toBe(true)
      return r
    }
    const status = async (r: APIRequestContext, [, method, url, data]: Call) =>
      (await r[method](url, data ? { data } : {})).status()
    const table: Record<string, Record<string, number>> = {}
    // Guest, member and leader run every call; the admin (authorized everywhere by the
    // platform scope) runs only the reads and the contract guard, never the mutations.
    for (const [actor, email] of [
      ['guest', null],
      ['member', 'member@example.test'],
      ['leader', 'leader@example.test'],
      ['admin', 'ops@example.test'],
    ] as const) {
      const r = await ctx(email)
      table[actor] = {}
      const calls = actor === 'admin' ? [...own, eventIdor[2]!] : [...own, ...foreign, ...eventIdor]
      for (const call of calls) table[actor]![call[0]] = await status(r, call)
      await r.dispose()
    }
    for (const call of [...own, ...foreign, ...eventIdor]) {
      expect(table.guest![call[0]], `guest ${call[0]}`).toBe(401)
      expect([403, 404], `member ${call[0]}`).toContain(table.member![call[0]])
    }
    for (const call of own) expect(table.leader![call[0]], `leader ${call[0]}`).toBe(200)
    for (const call of [...foreign, ...eventIdor])
      expect([403, 404], `leader ${call[0]}`).toContain(table.leader![call[0]])
    for (const call of own) expect(table.admin![call[0]], `admin ${call[0]}`).toBe(200)
    // Admin still meets the contract guard: the WF04 event is not an S07 event.
    expect(table.admin!['S07 WF04 event']).toBe(404)
    test.info().annotations.push({ type: 'matrix', description: JSON.stringify(table) })
    // Nothing the refused calls touched changed, and no success audit was written.
    expect(await snapshot()).toEqual(before)
    await query(`DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])`, [
      [foreignLeadership!.id, foreignEvent!.id],
    ])
    await query(`DELETE FROM leadership_records WHERE id = $1`, [foreignLeadership!.id])
    await query(`DELETE FROM events WHERE id = $1`, [foreignEvent!.id])
    if (foreignMembership)
      await query(`DELETE FROM community_memberships WHERE id = $1`, [foreignMembership.id])
  })

  test('NEG-WF03: canonical invariants hold across the workflow', async () => {
    // Only known audit codes exist (no synonyms), and each resource has at most one
    // success code per action except repeatable updates.
    const actions = await query<{ action: string }>(`SELECT DISTINCT action FROM audit_events`)
    for (const { action } of actions) expect(AUDIT_CODES, action).toContain(action)
    const dup = await query(
      `SELECT resource_id, action, count(*) FROM audit_events
        WHERE action IN ('MEMBERSHIP_APPROVED','MEMBERSHIP_REJECTED','LEADERSHIP_CREATED','EVENT_CREATED','EVENT_PUBLISHED','EVENT_CANCELLED','ORGANIZATION_RELATIONSHIP_CREATED')
        GROUP BY 1, 2 HAVING count(*) > 1`,
    )
    expect(dup).toEqual([])
    // At most one ACTIVE parent per child; no self-parent.
    expect(
      await query(
        `SELECT target_org_id FROM organization_relationships WHERE relationship_type = 'PARENT' AND state = 'ACTIVE'
          GROUP BY 1 HAVING count(*) > 1`,
      ),
    ).toEqual([])
    expect(
      await query(`SELECT 1 FROM organization_relationships WHERE source_org_id = target_org_id`),
    ).toEqual([])
    // Membership / leadership never created a RoleAssignment: every assignment is a seeded one
    // or belongs to an account that holds it by fixture.
    const roles = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments WHERE role_code IN ('HUB_COMMUNITY_LEADER','PLATFORM_ADMIN')`,
    )
    expect(roles[0]!.n).toBe(2)
    // At most one open membership per person and organization.
    expect(
      await query(
        `SELECT profile_id, organization_id FROM community_memberships WHERE state IN ('PENDING_APPROVAL','ACTIVE')
          GROUP BY 1, 2 HAVING count(*) > 1`,
      ),
    ).toEqual([])
    // Standalone WF03 events only ever created with programme_id NULL.
    expect(
      await query(
        `SELECT 1 FROM events e JOIN audit_events a ON a.resource_id = e.id AND a.action = 'EVENT_CREATED'
          WHERE e.programme_id IS NOT NULL`,
      ),
    ).toEqual([])
  })
})

/** The rows a refused call could touch, for before / after equality. */
async function snapshot() {
  return {
    memberships: await query(
      `SELECT id, state::text, source FROM community_memberships WHERE organization_id = ANY($1::uuid[]) ORDER BY id`,
      [[CHAPTER_01, CHAPTER_02, CLUB_01]],
    ),
    leadership: await query(`SELECT id, state::text, ended_at FROM leadership_records ORDER BY id`),
    orgs: await query(`SELECT id, name, description, status::text FROM organizations ORDER BY id`),
    relationships: await query(
      `SELECT id, state::text, ended_at FROM organization_relationships ORDER BY id`,
    ),
    events: await query(`SELECT id, name, status::text FROM events ORDER BY id`),
    audits: await query(`SELECT count(*)::int AS n FROM audit_events`),
  }
}
