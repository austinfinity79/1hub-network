import { createHash } from 'node:crypto'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { PROJECT_DEMO_ENTRY } from '../../../src/lib/member/nav'
import { createVenture } from '../../../src/lib/venture/venture'

/**
 * WF05-T00 — Founder / Project / Startup demo foundation (DEC-WF05-G1..G5,
 * DEC-WF05-T00-D1..D3): the read-only demo API under the WF02 relation rule,
 * the hidden MemberShell entry, and — through the dev-only harness — the
 * browser-session application store (refresh, a new session, reset, one per
 * pair, DRAFT → SUBMITTED only, owner only, archived refused, no snapshot, no
 * PII). No S01–S04 screen exists yet.
 */

const API = '/api/v1/demo/projects'
const HARNESS = '/dev/project-demo'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const SEED_VENTURE = '50000000-0000-0000-0000-000000000001' // owned by member@
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

type Person = { accountId: string; profileId: string; email: string }
const accounts: string[] = []
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await query(
    `DELETE FROM project_members WHERE project_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM projects WHERE owner_profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(): Promise<Person> {
  const email = `wf05-t00-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF05 Founder', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id, email }
}

/** Owner with a STARTUP (one ACTIVE member, one pending invitee), a PROJECT and an ARCHIVED venture. */
async function world() {
  const owner = await person()
  const teammate = await person()
  const invitee = await person()
  const stranger = await person()
  const startup = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Startup T00' })
  const project = await createVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án T00' })
  const archived = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ T00' })
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived.id])
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
     VALUES ($1, $2, 'Kỹ thuật', 'ACTIVE', now())`,
    [startup.id, teammate.profileId],
  )
  await query(
    `INSERT INTO project_members (project_id, invite_email_normalized, role_label, state, invited_at, invited_by_profile_id, joined_at)
     VALUES ($1, $2, 'Cố vấn', 'PENDING_CONFIRMATION', now(), $3, NULL)`,
    [startup.id, invitee.email, owner.profileId],
  )
  return { owner, teammate, invitee, stranger, startup, project, archived }
}

async function fingerprint() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string | null>>(
    `SELECT ${table('projects')} AS projects, ${table('project_members')} AS members,
            ${table('project_domains')} AS domains, ${table('programmes')} AS programmes,
            ${table('events')} AS events, ${table('role_assignments')} AS roles,
            ${table('community_memberships')} AS memberships,
            ${table('leadership_records')} AS leadership, ${table('individual_profiles')} AS profiles,
            ${table('audit_events')} AS audit, (SELECT count(*) FROM analytics_events)::text AS analytics,
            ${table('schema_migrations')} AS ledger, to_regclass('public.applications')::text AS applications`,
  )
  return row!
}

const storeKey = (accountId: string) =>
  `hub.wf05-demo.v1.${createHash('sha256').update(`wf05-demo:${accountId}`).digest('hex').slice(0, 16)}`
const wf04Key = (accountId: string) =>
  `hub.wf04-demo.v1.${createHash('sha256').update(`wf04-demo:${accountId}`).digest('hex').slice(0, 16)}`

async function harness(page: Page, url = HARNESS) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-harness-ready]')).toHaveAttribute('data-harness-ready', 'true')
}

const cell = (page: Page, ventureId: string) =>
  page.locator(`[data-harness-venture="${ventureId}"] [data-harness-programme="${PROGRAMME}"]`)

async function act(page: Page, ventureId: string, action: string) {
  await cell(page, ventureId).locator(`[data-harness-action="${action}"]`).click()
}

const stored = (page: Page, accountId: string) =>
  page.evaluate((k) => sessionStorage.getItem(k), storeKey(accountId))

test.describe('WF05-T00 demo read API (security matrix)', () => {
  test('1-15: guest, onboarding, member, owner, team, unrelated, invitee, admin, leader, foreign, malformed, random, spoofs; 405; 0 writes', async ({
    request,
  }) => {
    const w = await world()
    const before = await fingerprint()
    const detail = (id: string) => `${API}/${id}`

    // 1. Guest.
    expect((await request.get(API)).status()).toBe(401)
    expect((await request.get(detail(w.startup.id))).status()).toBe(401)
    // 2. Onboarding incomplete.
    await login(request, 'newcomer@example.test')
    expect((await request.get(API)).status()).toBe(403)
    expect((await request.get(detail(w.startup.id))).status()).toBe(403)
    // 3. Onboarded member without a venture: no venture, the open programme.
    await login(request, w.stranger.email)
    const empty = await (await request.get(API)).json()
    expect(empty.ventures).toEqual([])
    expect(empty.programmes.map((p: { id: string; status: string }) => [p.id, p.status])).toEqual([
      [PROGRAMME, 'PUBLISHED'],
    ])

    // 4. Owner.
    await login(request, w.owner.email)
    const list = await (await request.get(API)).json()
    expect(
      list.ventures.map((v: Record<string, string>) => [v.name, v.relation, v.applicant_type]),
    ).toEqual([
      ['Dự án T00', 'OWNER', 'TEAM'],
      ['Lưu trữ T00', 'OWNER', 'STARTUP'],
      ['Startup T00', 'OWNER', 'STARTUP'],
    ])
    const own = await request.get(detail(w.startup.id))
    expect(own.status()).toBe(200)
    const body = await own.json()
    expect(body.venture).toMatchObject({ relation: 'OWNER', applicant_type: 'STARTUP' })
    expect(body.team.rows).toHaveLength(2) // owner + ACTIVE member, no invitation
    expect(body.programmes[0].eligibility).toEqual({ eligible: true })
    expect(
      (await (await request.get(detail(w.archived.id))).json()).programmes[0].eligibility,
    ).toEqual({ eligible: false, reason: 'ARCHIVED' })
    // Safe DTOs.
    for (const text of [JSON.stringify(list), JSON.stringify(body)])
      expect(text).not.toMatch(
        /@|email|slug|metadata|owner_profile_id|profile_id|account|token|cookie|application_counts/i,
      )
    // 10. Another member's venture (the seed's) is foreign to this owner.
    expect((await request.get(detail(SEED_VENTURE))).status()).toBe(404)
    // 11 / 12. Malformed and random ids.
    for (const id of ['abc', RANDOM, `${w.startup.id}x`, '%2e%2e'])
      expect((await request.get(detail(id))).status(), id).toBe(404)
    // Mutations do not exist.
    for (const url of [API, detail(w.startup.id)])
      for (const method of ['post', 'put', 'patch', 'delete'] as const)
        expect(
          (await request[method](url, { data: { name: 'x', status: 'ACTIVE' } })).status(),
          `${method} ${url}`,
        ).toBe(405)

    // 5. ACTIVE team member: reads, not eligible.
    await login(request, w.teammate.email)
    const team = await (await request.get(detail(w.startup.id))).json()
    expect(team.venture.relation).toBe('MEMBER')
    expect(team.programmes[0].eligibility).toEqual({ eligible: false, reason: 'NOT_OWNER' })
    expect((await request.get(detail(w.project.id))).status()).toBe(404)

    // 6 / 7 / 8 / 9 with 13 / 14 / 15: unrelated, pending invitee, admin, leader — also spoofed.
    const spoofs = {
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': '10000000-0000-0000-0000-000000000101',
      'x-owner-profile-id': w.owner.profileId,
      'x-profile-id': w.owner.profileId,
      'x-account-id': w.owner.accountId,
    }
    const query_ = `?owner_profile_id=${w.owner.profileId}&profile_id=${w.owner.profileId}&account_id=${w.owner.accountId}&orgId=10000000-0000-0000-0000-000000000101&role=OWNER`
    for (const who of [
      w.stranger.email,
      w.invitee.email,
      'ops@example.test',
      'leader@example.test',
    ]) {
      await login(request, who)
      expect((await request.get(detail(w.startup.id))).status(), who).toBe(404)
      expect(
        (await request.get(detail(w.startup.id) + query_, { headers: spoofs })).status(),
        `${who} spoofed`,
      ).toBe(404)
      const listed = await (await request.get(API + query_, { headers: spoofs })).json()
      expect(
        listed.ventures.map((v: { id: string }) => v.id),
        who,
      ).not.toContain(w.startup.id)
    }

    expect(await fingerprint()).toEqual(before)
    expect(before.applications).toBeNull()
  })
})

test.describe('WF05-T00 route and entry contract', () => {
  test('the MemberShell entry contract (shown since WF05-S01); the application and review routes are screens (S03 / S04); the harness is guarded', async ({
    page,
  }) => {
    expect(PROJECT_DEMO_ENTRY).toEqual({
      key: 'project-demo',
      group: 'Demo · Internal Alpha',
      label: 'Dự án & Startup · Demo',
      href: '/demo/projects',
      visible: true,
    })
    // Guest → /auth on the harness; onboarding incomplete → its resolver step.
    await page.goto(HARNESS)
    await expect(page).toHaveURL('/auth')
    await login(page.request, 'newcomer@example.test')
    await page.goto(HARNESS)
    await expect(page).toHaveURL(/\/onboarding\//)

    await page.context().clearCookies()
    await login(page.request, 'member@example.test')
    // WF05-S01 / S02 made /demo/projects and the owner's venture detail real screens;
    // S03 / S04 made the application and its review real screens.
    expect((await page.request.get('/demo/projects')).status()).toBe(200)
    expect((await page.request.get(`/demo/projects/${SEED_VENTURE}`)).status()).toBe(200)
    // WF05-S03 / S04: the owner's application draft and its review are screens; nothing else.
    expect(
      (await page.request.get(`/demo/projects/${SEED_VENTURE}/applications/${PROGRAMME}`)).status(),
    ).toBe(200)
    expect(
      (
        await page.request.get(`/demo/projects/${SEED_VENTURE}/applications/${PROGRAMME}/review`)
      ).status(),
    ).toBe(200)
    expect(
      (
        await page.request.get(`/demo/projects/${SEED_VENTURE}/applications/${PROGRAMME}/unknown`)
      ).status(),
    ).toBe(404)
    for (const url of ['/me', '/me/roles', '/me/privacy', '/me/settings']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await expect(page.locator('a[href^="/demo/projects"]'), url).toHaveCount(1)
      await expect(page.locator('[data-nav="project-demo"]'), url).toHaveAttribute(
        'href',
        '/demo/projects',
      )
    }
    // The resource guard: another member's venture is the same 404 on the harness.
    await login(page.request, 'leader@example.test')
    expect((await page.request.get(`${HARNESS}?venture=${SEED_VENTURE}`)).status()).toBe(404)
    expect((await page.request.get(`${HARNESS}?venture=abc`)).status()).toBe(404)
  })
})

test.describe('WF05-T00 application store (browser session)', () => {
  test('store 1-10: DRAFT, unique pair, mapping, archived, owner only, answers, SUBMITTED final, refresh, new session, reset, no snapshot / PII', async ({
    page,
    browser,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await harness(page)
    await expect(page.locator('[data-demo-notice]')).toContainText('Dữ liệu demo · Internal Alpha')
    await expect(page.locator('[data-demo-notice]')).toContainText(
      'Dự án và startup là hồ sơ thật của bạn.',
    )
    // 4 / 5 / 6: derived types; archived is not eligible.
    await expect(page.locator(`[data-harness-venture="${w.startup.id}"]`)).toHaveAttribute(
      'data-applicant-type',
      'STARTUP',
    )
    await expect(page.locator(`[data-harness-venture="${w.project.id}"]`)).toHaveAttribute(
      'data-applicant-type',
      'TEAM',
    )
    await expect(cell(page, w.archived.id)).toHaveAttribute('data-reason', 'ARCHIVED')
    await act(page, w.archived.id, 'start')
    await expect(page.locator('[data-harness-last]')).toHaveText('ARCHIVED')
    expect(await stored(page, w.owner.accountId)).toBeNull()

    // 1. Start → DRAFT; 2 / 3. the same pair cannot start again.
    await act(page, w.startup.id, 'start')
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-application', 'DRAFT')
    await act(page, w.startup.id, 'start')
    await expect(page.locator('[data-harness-last]')).toHaveText('EXISTS')
    await act(page, w.project.id, 'start')
    let state = JSON.parse((await stored(page, w.owner.accountId))!)
    expect(Object.keys(state.applications)).toEqual([
      `${w.startup.id}:${PROGRAMME}`,
      `${w.project.id}:${PROGRAMME}`,
    ])
    expect(state.applications[`${w.project.id}:${PROGRAMME}`].primary_applicant_type).toBe('TEAM')

    // Answers: incomplete cannot submit; complete submits once; SUBMITTED is final.
    await act(page, w.startup.id, 'answer-partial')
    await act(page, w.startup.id, 'submit')
    await expect(page.locator('[data-harness-last]')).toHaveText('INCOMPLETE')
    await act(page, w.startup.id, 'answer')
    await act(page, w.startup.id, 'submit')
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-application', 'SUBMITTED')
    for (const action of ['submit', 'answer', 'start']) {
      await act(page, w.startup.id, action)
      await expect(page.locator('[data-harness-last]')).toHaveText(
        action === 'start' ? 'EXISTS' : 'SUBMITTED',
      )
    }

    // 9 / 10. The stored value holds ids, type, status, answers and times only.
    const raw = (await stored(page, w.owner.accountId))!
    expect(raw).not.toMatch(/Startup T00|Dự án T00|WF05 Founder|@|token|cookie|display_name/)
    expect(storeKey(w.owner.accountId)).not.toContain(w.owner.email)

    // 8. Refresh keeps it; a new tab / browser session starts empty.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-application', 'SUBMITTED')
    const other = await browser.newContext({ baseURL: new URL(page.url()).origin })
    const fresh = await other.newPage()
    await login(fresh.request, w.owner.email)
    await harness(fresh)
    await expect(cell(fresh, w.startup.id)).toHaveAttribute('data-application', 'NONE')
    expect(await stored(fresh, w.owner.accountId)).toBeNull()
    await other.close()

    // A canonical rename (WF02) shows through; the application is untouched (a reference).
    expect(
      (
        await page.request.patch(`/api/v1/ventures/${w.startup.id}`, {
          data: { name: 'Startup T00 mới' },
        })
      ).status(),
    ).toBe(200)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator(`[data-harness-venture="${w.startup.id}"] h2`)).toHaveText(
      'Startup T00 mới',
    )
    expect(await stored(page, w.owner.accountId)).toBe(raw)

    // 7. Reset clears this store only: the WF04 demo key and the sign-in stay.
    await page.evaluate(
      ([k]) => sessionStorage.setItem(k!, '{"version":1,"programmes":{},"created":[]}'),
      [wf04Key(w.owner.accountId)],
    )
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(page.locator('[data-demo-notice]')).toContainText('Đã đặt lại dữ liệu demo.')
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-application', 'NONE')
    expect(await stored(page, w.owner.accountId)).toBeNull()
    expect(
      await page.evaluate((k) => sessionStorage.getItem(k), wf04Key(w.owner.accountId)),
    ).not.toBeNull()
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)

    // Canonical data: only the WF02 rename changed projects; nothing else was written.
    state = await fingerprint()
    expect({ ...state, projects: null }).toEqual({ ...before, projects: null })
  })

  test('an ACTIVE team member reads but cannot start; another actor never reads this store', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await harness(page)
    await act(page, w.startup.id, 'start')
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-application', 'DRAFT')

    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    await harness(page)
    await expect(page.locator(`[data-harness-venture="${w.startup.id}"]`)).toHaveAttribute(
      'data-relation',
      'MEMBER',
    )
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-reason', 'NOT_OWNER')
    // The owner's application (same tab) is under the owner's key: not visible to the member.
    await expect(cell(page, w.startup.id)).toHaveAttribute('data-application', 'NONE')
    await act(page, w.startup.id, 'start')
    await expect(page.locator('[data-harness-last]')).toHaveText('NOT_OWNER')
    expect(await stored(page, w.teammate.accountId)).toBeNull()
    await expect(page.locator(`[data-harness-venture="${w.project.id}"]`)).toHaveCount(0)
    expect((await page.request.get(`${HARNESS}?venture=${w.project.id}`)).status()).toBe(404)
  })
})
