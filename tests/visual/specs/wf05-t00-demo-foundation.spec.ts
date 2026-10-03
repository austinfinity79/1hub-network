import { expect, test, type APIRequestContext } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { PROJECT_DEMO_ENTRY } from '../../../src/lib/member/nav'
import { seedVenture } from '../../../src/lib/venture/testing'

/**
 * WF05-T00 — Founder / Project / Startup demo foundation (DEC-WF05-G1..G5,
 * DEC-WF05-T00-D1..D3): the read-only demo API under the WF02 relation rule
 * and the MemberShell entry. TASK 24.4 (DEC-L5) moved the application from the
 * browser-session store to the server: the store, its dev harness and their
 * cases are gone; the application rules are covered by
 * `src/lib/application/application.db-test.ts` and the L5 spec.
 */

const API = '/api/v1/demo/projects'
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
  const startup = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Startup T00' })
  const project = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án T00' })
  const archived = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ T00' })
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
            ${table('schema_migrations')} AS ledger, ${table('applications')} AS applications`,
  )
  return row!
}

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
  })
})

test.describe('WF05-T00 route and entry contract', () => {
  test('the MemberShell entry contract (shown since WF05-S01); the S03 / S04 paths redirect to the L5 member routes; the harness is gone', async ({
    page,
  }) => {
    expect(PROJECT_DEMO_ENTRY).toEqual({
      key: 'project-demo',
      label: 'Dự án & Startup',
      href: '/demo/projects',
      visible: true,
    })
    const oldForm = `/demo/projects/${SEED_VENTURE}/applications/${PROGRAMME}`
    // Guest → /auth, back to the member route after sign-in (WF05-PROD-04);
    // onboarding incomplete → its resolver step.
    await page.goto(oldForm)
    await expect(page).toHaveURL(
      `/auth?redirect=${encodeURIComponent(`/projects/${SEED_VENTURE}/applications/${PROGRAMME}`)}`,
    )
    await login(page.request, 'newcomer@example.test')
    await page.goto(oldForm)
    await expect(page).toHaveURL(/\/onboarding(\/|$)/)

    await page.context().clearCookies()
    await login(page.request, 'member@example.test')
    expect((await page.request.get('/demo/projects')).status()).toBe(200)
    expect((await page.request.get(`/demo/projects/${SEED_VENTURE}`)).status()).toBe(200)
    // TASK 24.4 (HD-A10): the S03 / S04 paths redirect to the member routes, which answer.
    for (const [from, to] of [
      [oldForm, `/projects/${SEED_VENTURE}/applications/${PROGRAMME}`],
      [`${oldForm}/review`, `/projects/${SEED_VENTURE}/applications/${PROGRAMME}/review`],
    ] as const) {
      const hop = await page.request.get(from, { maxRedirects: 0 })
      expect(hop.status(), from).toBe(307)
      expect(hop.headers().location, from).toBe(to)
      expect((await page.request.get(from)).status(), from).toBe(200)
    }
    expect((await page.request.get(`${oldForm}/unknown`)).status()).toBe(404)
    // The dev harness of the browser store is removed.
    expect((await page.request.get('/dev/project-demo')).status()).toBe(404)
    // DEC-L2R-D1: /me is FP1-OWN (no sidebar); /projects carries the entry instead.
    for (const url of ['/projects', '/me/roles', '/me/privacy', '/me/settings']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      // On /projects the ME7 sidebar's "Hồ sơ đăng ký" leads there too (PO decision 30/09).
      await expect(page.locator('a[href^="/demo/projects"]'), url).toHaveText(
        url === '/projects'
          ? ['Hồ sơ đăng ký', PROJECT_DEMO_ENTRY.label]
          : [PROJECT_DEMO_ENTRY.label],
      )
      await expect(page.locator('[data-nav="project-demo"]'), url).toHaveAttribute(
        'href',
        '/demo/projects',
      )
    }
  })
})
