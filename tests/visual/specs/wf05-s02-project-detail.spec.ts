import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { deleteApplicationsForTest } from '../../../src/lib/application/testing'
import { closePool, query } from '../../../src/lib/db/client'
import { seedVenture } from '../../../src/lib/venture/testing'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF05-S02 — one Project / Startup and its participation (DEC-WF05-G1..G5,
 * DEC-WF05-T00-D1..D3): the canonical WF02 venture for its owner or an ACTIVE
 * member, the team (owner + ACTIVE), the PUBLISHED programmes with the
 * actor's eligibility and the server application status (TASK 24.4); WF02 edit
 * / team links; "Đăng ký" opens the L5 form; S01 → S02; IDOR / spoofing; no
 * writes; responsive and primitives.
 */

const API = '/api/v1/demo/projects'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const HANOI = '20000000-0000-0000-0000-000000000001'
const GOVTECH = '20000000-0000-0000-0000-000000000011'
const EDU = '20000000-0000-0000-0000-000000000012'
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const detailUrl = (id: string) => `/demo/projects/${id}`

type Person = { accountId: string; profileId: string; email: string }
const accounts: string[] = []
let consoleErrors: string[] = []

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
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await deleteApplicationsForTest(
    `venture_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM project_domains WHERE project_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
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

async function person(name: string): Promise<Person> {
  const email = `wf05-s02-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id, email }
}

/** Owner: STARTUP (ACTIVE; region, domains; one ACTIVE member, one invitee), PROJECT (DRAFT), ARCHIVED. */
async function world() {
  const owner = await person('Chủ Dự Án')
  const teammate = await person('Thành Viên Đội')
  const invitee = await person('Người Được Mời')
  const stranger = await person('Người Ngoài')
  const startup = await seedVenture(owner.accountId, {
    type: 'STARTUP',
    name: 'Startup S02',
    summary: 'Nền tảng số cho hợp tác xã.',
    region_id: HANOI,
    domain_ids: [GOVTECH, EDU],
  })
  const project = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án S02' })
  const archived = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ S02' })
  const foreign = await seedVenture(stranger.accountId, { type: 'PROJECT', name: 'Ngoài S02' })
  await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [startup.id])
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived.id])
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
     VALUES ($1, $2, 'Kỹ thuật', 'ACTIVE', now())`,
    [startup.id, teammate.profileId],
  )
  await query(
    `INSERT INTO project_members (project_id, invite_email_normalized, role_label, state, invited_at, invited_by_profile_id, joined_at, invite_expires_at)
     VALUES ($1, $2, 'Cố vấn', 'PENDING_CONFIRMATION', now(), $3, NULL, now() + interval '7 days')`,
    [startup.id, invitee.email, owner.profileId],
  )
  return { owner, teammate, invitee, stranger, startup, project, archived, foreign }
}

async function fingerprint() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string | null>>(
    `SELECT ${table('projects')} AS projects, ${table('project_members')} AS members,
            ${table('project_domains')} AS domains, ${table('programmes')} AS programmes,
            ${table('events')} AS events, ${table('role_assignments')} AS roles,
            ${table('individual_profiles')} AS profiles, ${table('audit_events')} AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            ${table('applications')} AS applications`,
  )
  return row!
}

async function open(page: Page, id: string) {
  const response = await page.goto(detailUrl(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="venture-loading"]')).toHaveCount(0)
  return response
}

const overview = (page: Page, key: string) =>
  page.locator(`[data-overview="${key}"] p:last-of-type`)
const programmeRow = (page: Page, id = PROGRAMME) => page.locator(`[data-programme="${id}"]`)
const apply = (page: Page) => page.locator('[data-action="apply"]')

test.describe('WF05-S02 project / startup detail', () => {
  test('1/9. owner opens the PROJECT: canonical fields, team, P1 eligible as TEAM; "Đăng ký" opens the L5 form', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    expect((await open(page, w.project.id))?.status()).toBe(200)
    await expect(page.locator('[data-screen="WF05-S02"]')).toHaveAttribute(
      'data-venture-type',
      'PROJECT',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dự án S02')
    await expect(page.locator('[data-demo-meta]')).toHaveText('Dự án · Chủ sở hữu')
    await expect(overview(page, 'type')).toHaveText('Dự án')
    await expect(overview(page, 'status')).toHaveText('Bản nháp')
    // DEC-L2R-D4: description and field are required; region stays optional.
    await expect(overview(page, 'summary')).toHaveText('Mô tả một dòng')
    await expect(overview(page, 'region')).toHaveText('—')
    await expect(overview(page, 'domains')).toHaveText('Công nghệ khu vực công')
    await expect(page.locator('[data-team-count]')).toHaveText('1 thành viên')
    await expect(page.locator('[data-team-row]')).toHaveText(['Chủ Dự Án · Chủ sở hữu'])
    // Eligible (PROJECT → TEAM ∈ P1): "Đăng ký" opens the L5 form (TASK 24.4).
    await expect(programmeRow(page)).toHaveAttribute('data-eligible', 'true')
    await expect(apply(page)).toHaveAttribute(
      'href',
      `/projects/${w.project.id}/applications/${PROGRAMME}`,
    )
    const api = await (await page.request.get(`${API}/${w.project.id}`)).json()
    expect(api.venture.applicant_type).toBe('TEAM')
    // No applicant-type or enum wording on the page.
    expect(await page.locator('[data-screen="WF05-S02"]').innerText()).not.toMatch(
      /\bPROJECT\b|\bSTARTUP\b|\bTEAM\b|Đăng ký với tư cách|fixture|sessionStorage|DTO|canonical|owner_profile_id/,
    )
  })

  test('2/7/10. owner opens the STARTUP: status, region, domains, team (owner + ACTIVE, no invitee); eligible as STARTUP', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await expect(page.locator('[data-demo-meta]')).toHaveText('Startup · Chủ sở hữu')
    await expect(overview(page, 'type')).toHaveText('Startup')
    await expect(overview(page, 'status')).toHaveText('Đang hoạt động')
    await expect(overview(page, 'summary')).toHaveText('Nền tảng số cho hợp tác xã.')
    await expect(overview(page, 'region')).toHaveText('Hà Nội')
    await expect(overview(page, 'domains')).toHaveText('Công nghệ khu vực công, Giáo dục')
    await expect(page.locator('[data-team-count]')).toHaveText('2 thành viên')
    await expect(page.locator('[data-team-row]')).toHaveText([
      'Chủ Dự Án · Chủ sở hữu',
      'Thành Viên Đội · Kỹ thuật',
    ])
    await expect(page.locator('[data-detail="team"]')).not.toContainText('Người Được Mời')
    await expect(programmeRow(page)).toHaveAttribute('data-eligible', 'true')
    expect(
      (await (await page.request.get(`${API}/${w.startup.id}`)).json()).venture.applicant_type,
    ).toBe('STARTUP')
  })

  test('3. an ACTIVE team member reads the venture: no edit, no "Đăng ký", the reason instead', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.teammate.email)
    await open(page, w.startup.id)
    await expect(page.locator('[data-screen="WF05-S02"]')).toHaveAttribute(
      'data-relation',
      'MEMBER',
    )
    await expect(page.locator('[data-demo-meta]')).toHaveText('Startup · Thành viên')
    await expect(page.locator('[data-nav="venture-edit"]')).toHaveCount(0)
    await expect(page.locator('[data-nav="venture-team"]')).toHaveAttribute(
      'href',
      `/projects/${w.startup.id}/team`,
    )
    await expect(apply(page)).toHaveCount(0)
    await expect(programmeRow(page).locator('[data-ineligible]')).toHaveText(
      'Chỉ chủ sở hữu đăng ký được.',
    )
  })

  test('8. archived: read only, the archived notice, no edit and no "Đăng ký"', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page, w.archived.id)
    await expect(page.locator('[data-state="venture-archived"]')).toHaveText(
      'Hồ sơ đã lưu trữ: chỉ xem, không đăng ký chương trình mới.',
    )
    await expect(overview(page, 'status')).toHaveText('Đã lưu trữ')
    await expect(page.locator('[data-nav="venture-edit"]')).toHaveCount(0)
    await expect(apply(page)).toHaveCount(0)
    await expect(programmeRow(page).locator('[data-ineligible]')).toHaveText('Hồ sơ đã lưu trữ.')
  })

  test('6/18. WF02 edits show on S02 at once; "Sửa hồ sơ" and "Xem đội" open WF02', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await page.locator('[data-nav="venture-edit"]').click()
    await expect(page).toHaveURL(`/projects/${w.startup.id}/edit`)
    expect(
      (
        await page.request.patch(`/api/v1/ventures/${w.startup.id}`, {
          data: { name: 'Startup S02 mới', summary: 'Tóm tắt mới.' },
        })
      ).status(),
    ).toBe(200)
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(detailUrl(w.startup.id))
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Startup S02 mới')
    await expect(overview(page, 'summary')).toHaveText('Tóm tắt mới.')
    await page.locator('[data-nav="venture-team"]').click()
    await expect(page).toHaveURL(`/projects/${w.startup.id}/team`)
  })
})

test.describe('WF05-S02 participation', () => {
  test('11/12/13/14. only the PUBLISHED fixture, read only; no programme action or ops data', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    expect(
      await page
        .locator('[data-programme]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-programme'))),
    ).toEqual([PROGRAMME])
    await expect(programmeRow(page, CHALLENGE)).toHaveCount(0)
    await expect(programmeRow(page).locator('[data-programme-kind]')).toHaveText(
      'Chương trình · Chapter 01',
    )
    await expect(programmeRow(page).locator('[data-programme-meta]')).toHaveText(
      '01/09/2026 – 15/12/2026 · Dành cho: Đội, Startup',
    )
    // The row's only link is the eligible owner's "Đăng ký" (L5 form); no programme management.
    await expect(page.locator('[data-programme] a:not([data-action="apply"])')).toHaveCount(0)
    await expect(programmeRow(page).locator('[data-action="apply"]')).toHaveAttribute(
      'href',
      `/projects/${w.startup.id}/applications/${PROGRAMME}`,
    )
    expect(await page.locator('[data-detail="programmes"]').innerText()).not.toMatch(
      /Người vận hành|Thử thách đổi mới|Đang xem xét|Cần bổ sung/,
    )
    expect(await fingerprint()).toEqual(before)
  })

  test('12. a PUBLISHED Challenge and a type the programme does not take (response shaped by the API)', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.route(`**${API}/${w.project.id}`, async (route) => {
      const body = await (await route.fetch()).json()
      body.programmes.push({
        ...body.programmes[0],
        id: 'd4000000-0000-0000-0000-000000000009',
        type: 'CHALLENGE',
        name: 'Thử thách công khai (demo)',
        applicant_types: ['STARTUP'],
        eligibility: { eligible: false, reason: 'TYPE_NOT_ACCEPTED' },
      })
      await route.fulfill({ json: body })
    })
    await open(page, w.project.id)
    const row = programmeRow(page, 'd4000000-0000-0000-0000-000000000009')
    await expect(row.locator('[data-programme-kind]')).toHaveText('Challenge · Chapter 01')
    await expect(row.locator('[data-ineligible]')).toHaveText(
      'Chương trình không nhận loại hồ sơ này.',
    )
    await expect(row.locator('[data-action="apply"]')).toHaveCount(0)
  })

  test('15/16. viewing creates no application; the server application shows its status and replaces "Đăng ký"', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await fingerprint()
    await open(page, w.startup.id)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await fingerprint()).toEqual(before)
    const created = await (
      await page.request.post('/api/v1/applications', {
        data: { venture_id: w.startup.id, programme_id: PROGRAMME },
      })
    ).json()
    await page.reload({ waitUntil: 'networkidle' })
    // WF05-PROD-04: the L5 status wording ("Bản nháp", as on the form and the choice).
    await expect(programmeRow(page).locator('[data-application]')).toHaveText('Bản nháp')
    await expect(apply(page)).toHaveCount(0)
    await expect(programmeRow(page).locator('[data-nav="application-resume"]')).toHaveAttribute(
      'href',
      `/projects/${w.startup.id}/applications/${PROGRAMME}`,
    )
    await page.request.patch(`/api/v1/applications/${created.id}`, {
      data: {
        answers: [
          { question_id: 'q-problem', value: 'A' },
          { question_id: 'q-support', value: 'B' },
        ],
      },
    })
    expect((await page.request.post(`/api/v1/applications/${created.id}/submit`)).status()).toBe(
      200,
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(programmeRow(page).locator('[data-application]')).toHaveText('Đã nộp')
    await expect(programmeRow(page).locator('[data-nav="application-view"]')).toHaveAttribute(
      'href',
      `/projects/${w.startup.id}/applications/${PROGRAMME}/submitted`,
    )
    // The other venture has no application: its "Đăng ký" stays.
    await open(page, w.project.id)
    await expect(apply(page)).toHaveCount(1)
    // The application lives on the server (HD-A10); WF05-PROD-04: no demo reset any more.
    await open(page, w.startup.id)
    await expect(page.locator('[data-demo-reset]')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(programmeRow(page).locator('[data-application]')).toHaveText('Đã nộp')
  })

  test('20/21. no open programme; loading, then an error with a safe message and "Thử lại"', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      const body = await (await route.fetch()).json()
      await route.fulfill({ json: { ...body, programmes: [] } })
    })
    await open(page, w.startup.id)
    await expect(page.locator('[data-state="programmes-empty"]')).toHaveText(
      'Hiện chưa có chương trình nào đang mở.',
    )
    await expect(page.locator('[data-detail="overview"]')).toBeVisible()
    await page.unroute(`**${API}/${w.startup.id}`)

    let release!: () => void
    const gate = new Promise<void>((done) => (release = done))
    let fail = true
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      await gate
      if (fail)
        return route.fulfill({
          status: 500,
          json: { error: { code: 'INTERNAL', message: 'boom' } },
        })
      return route.continue()
    })
    await page.goto(detailUrl(w.startup.id))
    await expect(page.locator('[data-state="venture-loading"]')).toBeVisible()
    release()
    const failed = page.locator('[data-state="venture-failed"]')
    await expect(failed).toHaveText(/Chưa tải được hồ sơ\. Vui lòng thử lại\./)
    expect(await failed.innerText()).not.toMatch(/boom|INTERNAL|\b500\b/)
    await expect(page.locator('[data-state="programmes-empty"], [data-detail]')).toHaveCount(0)
    fail = false
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator('[data-detail="overview"]')).toBeVisible()
  })
})

test.describe('WF05-S02 navigation', () => {
  test('17/19/22. S01 → S02 → back; direct refresh; the L5 form linked; old S03 / S04 paths redirect', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto('/demo/projects', { waitUntil: 'networkidle' })
    for (const id of [w.startup.id, w.project.id, w.archived.id]) {
      await page.locator(`[data-venture="${id}"] [data-nav="venture-detail"]`).click()
      await expect(page).toHaveURL(detailUrl(id))
      await expect(page.locator('[data-detail="overview"]')).toBeVisible()
      await page.locator('[data-nav="detail-back"]').click()
      await expect(page).toHaveURL('/demo/projects')
    }
    await open(page, w.startup.id)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-detail="overview"]')).toBeVisible()
    const links = await page
      .locator('[data-screen="WF05-S02"] a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(links).toEqual([
      '/demo/projects',
      `/projects/${w.startup.id}/edit`,
      `/projects/${w.startup.id}/team`,
      `/projects/${w.startup.id}/applications/${PROGRAMME}`,
    ])
    // The old S03 / S04 paths redirect to the L5 member routes (HD-A10), which answer 200.
    expect(
      (await page.request.get(`${detailUrl(w.startup.id)}/applications/${PROGRAMME}`)).status(),
    ).toBe(200)
    expect(
      (
        await page.request.get(`${detailUrl(w.startup.id)}/applications/${PROGRAMME}/review`)
      ).status(),
    ).toBe(200)
    await expect(page.locator('a[href$="/review"]')).toHaveCount(0)
  })
})

test.describe('WF05-S02 authorization, IDOR and privacy', () => {
  test('guest, onboarding, unrelated, pending invitee, admin, leader, random, malformed, spoofed: the same 404; owner unaffected by spoofs', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await page.goto(detailUrl(w.startup.id))
    await expect(page).toHaveURL(`/auth?redirect=${encodeURIComponent(detailUrl(w.startup.id))}`)
    await login(page.request, 'newcomer@example.test')
    await page.goto(detailUrl(w.startup.id))
    await expect(page).toHaveURL(/\/onboarding(\/|$)/)

    const spoofs = {
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': '10000000-0000-0000-0000-000000000101',
      'x-owner-profile-id': w.owner.profileId,
      'x-profile-id': w.owner.profileId,
      'x-account-id': w.owner.accountId,
    }
    const q = `?owner_profile_id=${w.owner.profileId}&profile_id=${w.owner.profileId}&account_id=${w.owner.accountId}&orgId=10000000-0000-0000-0000-000000000101&role=OWNER`
    for (const who of [
      w.stranger.email,
      w.invitee.email,
      'ops@example.test',
      'leader@example.test',
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      for (const id of [w.startup.id, w.project.id, w.archived.id]) {
        expect((await page.request.get(detailUrl(id))).status(), `${who} ${id}`).toBe(404)
        expect(
          (await page.request.get(detailUrl(id) + q, { headers: spoofs })).status(),
          `${who} ${id} spoofed`,
        ).toBe(404)
        expect((await page.request.get(`${API}/${id}`, { headers: spoofs })).status()).toBe(404)
      }
    }
    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    for (const id of [RANDOM, 'abc', w.foreign.id, `${w.startup.id}x`])
      expect((await page.request.get(detailUrl(id))).status(), id).toBe(404)
    // Spoofs do not change the owner's own view either.
    const html = await (
      await page.request.get(detailUrl(w.startup.id) + q, { headers: spoofs })
    ).text()
    expect(html).not.toMatch(/@example\.test|30000000-|40000000-|hub_session/)
    const api = await (await page.request.get(`${API}/${w.startup.id}`, { headers: spoofs })).json()
    expect(api.venture.relation).toBe('OWNER')
    expect(JSON.stringify(api)).not.toMatch(
      /@|email|profile_id|account|slug|metadata|token|cookie/i,
    )
    expect(JSON.stringify(api)).not.toContain(w.invitee.email)
    expect(await fingerprint()).toEqual(before)
  })
})

test.describe('WF05-S02 responsive basics', () => {
  test('768 / 390: no overflow; a long name wraps; actions do not overlap; cards and rows reachable', async ({
    page,
  }) => {
    const w = await world()
    const long = await seedVenture(w.owner.accountId, {
      type: 'STARTUP',
      name: 'Startup-với-một-cái-tên-rất-dài-không-có-khoảng-trắng-để-kiểm-tra-xuống-dòng-S02',
    })
    await login(page.request, w.owner.email)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const id of [w.startup.id, long.id]) {
        await open(page, id)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          `${width}px ${id} overflow`,
        ).toBe(0)
        const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!
        for (const action of ['detail-back', 'venture-edit']) {
          const box = (await page.locator(`[data-nav="${action}"]`).boundingBox())!
          const overlaps =
            box.x < title.x + title.width &&
            box.x + box.width > title.x &&
            box.y < title.y + title.height &&
            box.y + box.height > title.y
          expect(overlaps, `${width}px ${action} overlaps the title`).toBe(false)
        }
        for (const locator of [
          page.locator('[data-detail="overview"]'),
          page.locator('[data-nav="venture-team"]'),
          programmeRow(page),
        ]) {
          await locator.scrollIntoViewIfNeeded()
          await expect(locator).toBeInViewport()
        }
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s02-${width}.png`), fullPage: true })
    }
  })
})

async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent!.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const r of range.getClientRects())
        rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
    }
    return rects
  })
}

test.describe('WF05-S02 visual QA (approved primitives; no WF05 bitmap)', () => {
  test('1440×900 PROJECT, STARTUP, no programme, archived, error: typography; shell vs WF02-S01; primitives vs ADM5', async ({
    page,
  }) => {
    const w = await world()
    const shellRef = readPng(
      path.join(REPO_ROOT, 'design-reference/final/WF02/WF02-S01__account-home__1440x900.png'),
    )
    const adm5 = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const referenceText: Rect[] = [
      { x: 60, y: 18, width: 400, height: 24 },
      { x: 1236, y: 18, width: 100, height: 24 },
      { x: 60, y: 88, width: 110, height: 18 },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      { x: 1196, y: 16, width: 36, height: 28 },
      { x: 60, y: 118, width: 262, height: 48 },
    ]
    const results: SegmentResult[] = []
    let checked = 0
    const capture = async (name: string, withCard: boolean) => {
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s02-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf05-s02-${name}-full.png`),
        fullPage: true,
      })
      const actual = decodePng(await page.screenshot())
      const masks = [...(await textRects(page)), ...referenceText]
      results.push(
        ...compareSegments(
          shellRef,
          actual,
          [
            {
              name: `${name}-shell-header`,
              reference: { x: 0, y: 0, width: 1440, height: 60 },
              dy: 0,
            },
            {
              name: `${name}-shell-sidebar`,
              reference: { x: 0, y: 60, width: 330, height: 380 },
              dy: 0,
            },
          ],
          masks,
          { diffPath: resolveOutputPath('diff', `WF05-S02.${name}.shell.diff.png`) },
        ),
      )
      const rule = (await page.locator('[data-demo-page] > header').boundingBox())!
      const segments: { name: string; reference: Rect; dx?: number; dy: number }[] = [
        {
          name: `${name}-header-rule`,
          reference: { x: 500, y: 72, width: 600, height: 6 },
          dy: Math.round(rule.y + rule.height) - 76,
        },
      ]
      if (withCard) {
        const card = (await page.locator('[data-detail="overview"]').boundingBox())!
        segments.push({
          name: `${name}-card-top`,
          reference: { x: 300, y: 95, width: 800, height: 8 },
          dx: Math.round(card.x) - 248,
          dy: Math.round(card.y) - 99,
        })
      }
      results.push(
        ...compareSegments(adm5, actual, segments, masks, {
          diffPath: resolveOutputPath('diff', `WF05-S02.${name}.primitives.diff.png`),
        }),
      )
    }

    await login(page.request, w.owner.email)
    await open(page, w.project.id)
    await capture('project', true)
    await open(page, w.startup.id)
    await capture('startup', true)
    await open(page, w.archived.id)
    await capture('archived', true)
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      const body = await (await route.fetch()).json()
      await route.fulfill({ json: { ...body, programmes: [] } })
    })
    await open(page, w.startup.id)
    await capture('no-programmes', true)
    await page.unroute(`**${API}/${w.startup.id}`)
    await page.route(`**${API}/${w.startup.id}`, (route) =>
      route.fulfill({ status: 500, json: {} }),
    )
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="venture-failed"]')).toBeVisible()
    await capture('error', false)

    writeJsonReport('WF05-S02.primitives.json', {
      screen_id: 'WF05-S02',
      references: [
        'WF02-S01 ME0 (member shell header + sidebar)',
        'WF03-S05 ADM5 (header rule, card)',
      ],
      approved_wf05_bitmap: null,
      typography_checked: checked,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF05-G1: WF04 demo frame, detail rows and card chrome inside MemberShell, WF02 venture wording; "Đăng ký" disabled with its reason until S03; no WF05 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
