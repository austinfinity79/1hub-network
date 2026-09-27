import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { createVenture } from '../../../src/lib/venture/venture'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF05-S03 — the demo application draft (DEC-WF05-G3..G5, DEC-WF05-T00-D1):
 * S02 → S03 for the eligible owner; the draft is created by the first "Lưu
 * nháp" and updated after (answers may be incomplete); one per venture ×
 * programme; refresh / back / reset; atomic refusals; SUBMITTED read only;
 * members, archived and foreign actors cannot edit; no S04 route; no writes;
 * IDOR / spoofing; responsive and primitives.
 */

const API = '/api/v1/demo/projects'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const detailUrl = (id: string) => `/demo/projects/${id}`
const appUrl = (id: string, programme = PROGRAMME) =>
  `/demo/projects/${id}/applications/${programme}`

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
  const email = `wf05-s03-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
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

async function world() {
  const owner = await person('Chủ Đơn')
  const teammate = await person('Thành Viên')
  const invitee = await person('Được Mời')
  const stranger = await person('Người Ngoài')
  const startup = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Startup S03' })
  const project = await createVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án S03' })
  const archived = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ S03' })
  const foreign = await createVenture(stranger.accountId, { type: 'STARTUP', name: 'Ngoài S03' })
  await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [startup.id])
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
  return { owner, teammate, invitee, stranger, startup, project, archived, foreign }
}

async function fingerprint() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string | null>>(
    `SELECT ${table('projects')} AS projects, ${table('project_members')} AS members,
            ${table('project_domains')} AS domains, ${table('programmes')} AS programmes,
            ${table('events')} AS events, ${table('role_assignments')} AS roles,
            ${table('community_memberships')} AS memberships,
            ${table('leadership_records')} AS leadership,
            ${table('individual_profiles')} AS profiles, ${table('audit_events')} AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            to_regclass('public.applications')::text AS applications`,
  )
  return row!
}

const storeKey = (accountId: string) =>
  `hub.wf05-demo.v1.${createHash('sha256').update(`wf05-demo:${accountId}`).digest('hex').slice(0, 16)}`
type Stored = {
  applications: Record<
    string,
    {
      primary_applicant_type: string
      primary_applicant_id: string
      status: string
      programme_specific_answers: string[]
      created_at: string
      updated_at: string
    }
  >
}
async function stored(page: Page, accountId: string): Promise<Stored | null> {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), storeKey(accountId))
  return raw ? (JSON.parse(raw) as Stored) : null
}
const rawStore = (page: Page, accountId: string) =>
  page.evaluate((k) => sessionStorage.getItem(k), storeKey(accountId))

async function open(page: Page, id: string, programme = PROGRAMME) {
  const response = await page.goto(appUrl(id, programme), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="application-loading"]')).toHaveCount(0)
  return response
}

const answer = (page: Page, i: number) => page.locator(`#answer-${i}`)
const save = (page: Page) => page.locator('[data-action="save-draft"]')
const form = (page: Page) => page.locator('[data-application-form]')

async function inject(
  page: Page,
  accountId: string,
  ventureId: string,
  status: 'DRAFT' | 'SUBMITTED',
) {
  const now = new Date().toISOString()
  await page.evaluate(
    ([k, v]) => sessionStorage.setItem(k!, v!),
    [
      storeKey(accountId),
      JSON.stringify({
        version: 1,
        applications: {
          [`${ventureId}:${PROGRAMME}`]: {
            primary_applicant_type: 'STARTUP',
            primary_applicant_id: ventureId,
            programme_id: PROGRAMME,
            status,
            programme_specific_answers: ['Trả lời một', 'Trả lời hai'],
            created_at: now,
            updated_at: now,
            submitted_at: status === 'SUBMITTED' ? now : null,
          },
        },
      }),
    ],
  )
}

test.describe('WF05-S03 application draft', () => {
  test('1/3/10/11/12/22. PROJECT owner: S02 → S03 as TEAM; opening stores nothing; an incomplete save creates one DRAFT', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.project.id), { waitUntil: 'networkidle' })
    await page.locator('[data-action="apply"]').click()
    await expect(page).toHaveURL(appUrl(w.project.id))
    await expect(page.locator('[data-screen="WF05-S03"]')).toHaveAttribute(
      'data-application-state',
      'NONE',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Đăng ký: Chương trình ươm tạo (demo)',
    )
    await expect(page.locator('[data-demo-meta]')).toHaveText('Dự án S03 · Chưa lưu')
    await expect(page.locator('[data-applicant-name]')).toHaveText('Dự án S03')
    await expect(page.locator('[data-applicant-meta]')).toHaveText(
      'Dự án · Đăng ký với tư cách: Đội',
    )
    await expect(page.locator('[data-programme-kind]')).toHaveText('Chương trình · Chapter 01')
    await expect(page.locator('[data-question]')).toHaveCount(2)
    await expect(page.getByLabel('Câu hỏi 1')).toHaveValue('')
    // Opening (and refreshing) the form stores nothing.
    await page.reload({ waitUntil: 'networkidle' })
    expect(await rawStore(page, w.owner.accountId)).toBeNull()

    await answer(page, 0).fill('Đội chúng tôi xây dựng nền tảng kết nối.')
    await save(page).click()
    await expect(page.locator('[data-state="draft-saved"]')).toHaveText('Đã lưu bản nháp.')
    await expect(page.locator('[data-demo-meta]')).toHaveText('Dự án S03 · Bản nháp')
    const state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications)).toEqual([`${w.project.id}:${PROGRAMME}`])
    expect(state.applications[`${w.project.id}:${PROGRAMME}`]).toMatchObject({
      primary_applicant_type: 'TEAM',
      primary_applicant_id: w.project.id,
      status: 'DRAFT',
      programme_specific_answers: ['Đội chúng tôi xây dựng nền tảng kết nối.', ''],
    })
    expect(await fingerprint()).toEqual(before)
  })

  test('2/4/13/14/15/16/24. STARTUP owner: repeated saves update one draft; double click, refresh, back and resume', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await expect(page.locator('[data-applicant-meta]')).toHaveText(
      'Startup · Đăng ký với tư cách: Startup',
    )
    await answer(page, 0).fill('Một')
    await save(page).dblclick()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    let state = (await stored(page, w.owner.accountId))!
    const key = `${w.startup.id}:${PROGRAMME}`
    expect(Object.keys(state.applications)).toEqual([key])
    expect(state.applications[key]!.primary_applicant_type).toBe('STARTUP')
    const created = state.applications[key]!.created_at
    await answer(page, 1).fill('Hai')
    await expect(page.locator('[data-state="draft-saved"]')).toHaveCount(0)
    await save(page).click()
    state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications)).toEqual([key])
    expect(state.applications[key]).toMatchObject({
      created_at: created,
      status: 'DRAFT',
      programme_specific_answers: ['Một', 'Hai'],
    })
    // Refresh restores the answers.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(answer(page, 0)).toHaveValue('Một')
    await expect(answer(page, 1)).toHaveValue('Hai')
    // Back → S02: "Nháp" + "Tiếp tục", no second "Đăng ký"; resume opens the same draft.
    await page.locator('[data-nav="application-back"]').click()
    await expect(page).toHaveURL(detailUrl(w.startup.id))
    const row = page.locator(`[data-programme="${PROGRAMME}"]`)
    await expect(row.locator('[data-application]')).toHaveText('Nháp')
    await expect(row.locator('[data-action="apply"]')).toHaveCount(0)
    await row.locator('[data-nav="application-resume"]').click()
    await expect(page).toHaveURL(appUrl(w.startup.id))
    await expect(answer(page, 1)).toHaveValue('Hai')
    // S01 shows the draft too.
    await page.goto('/demo/projects', { waitUntil: 'networkidle' })
    await expect(
      page.locator(`[data-venture="${w.startup.id}"] [data-venture-applications]`),
    ).toHaveText('Đơn đăng ký demo: Chương trình ươm tạo (demo) · Nháp')
    expect(Object.keys((await stored(page, w.owner.accountId))!.applications)).toHaveLength(1)
  })

  test('17/18. a WF02 rename shows live on S03; the draft holds no venture or programme data', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await answer(page, 0).fill('Giữ nguyên')
    await save(page).click()
    const raw = (await rawStore(page, w.owner.accountId))!
    expect(raw).not.toMatch(/Startup S03|Chương trình ươm tạo|Chapter 01|Chủ Đơn|@|token|cookie/)
    expect(
      (
        await page.request.patch(`/api/v1/ventures/${w.startup.id}`, {
          data: { name: 'Startup S03 mới' },
        })
      ).status(),
    ).toBe(200)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-applicant-name]')).toHaveText('Startup S03 mới')
    await expect(page.locator('[data-demo-meta]')).toHaveText('Startup S03 mới · Bản nháp')
    await expect(page.locator('[data-programme-name]')).toHaveText('Chương trình ươm tạo (demo)')
    await expect(
      page.locator('[data-section="programme"] a, [data-section="applicant"] a'),
    ).toHaveCount(0)
    expect(await rawStore(page, w.owner.accountId)).toBe(raw)
  })

  test('19/20. atomic refusals keep the saved draft; reset clears it and the next open starts afresh', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await answer(page, 0).fill('Bản đã lưu')
    await save(page).click()
    const saved = await rawStore(page, w.owner.accountId)
    // Too long: the field error; nothing stored.
    await answer(page, 1).fill('x'.repeat(2001))
    await save(page).click()
    await expect(page.locator('[data-error="answer-1"]')).toHaveText('Tối đa 2000 ký tự.')
    await expect(answer(page, 1)).toHaveAttribute('aria-invalid', 'true')
    expect(await rawStore(page, w.owner.accountId)).toBe(saved)
    // A refused browser write: the safe message; nothing half-written.
    await answer(page, 1).fill('Mới')
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await save(page).click()
    await expect(page.locator('[data-state="draft-failed"]')).toHaveText(
      'Chưa lưu được bản nháp. Vui lòng thử lại.',
    )
    expect(await rawStore(page, w.owner.accountId)).toBe(saved)
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await save(page).click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    expect(
      (await stored(page, w.owner.accountId))!.applications[`${w.startup.id}:${PROGRAMME}`]!
        .programme_specific_answers,
    ).toEqual(['Bản đã lưu', 'Mới'])
    // Reset: the form starts afresh, the store is empty, S02 offers "Đăng ký" again.
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(answer(page, 0)).toHaveValue('')
    await expect(page.locator('[data-screen="WF05-S03"]')).toHaveAttribute(
      'data-application-state',
      'NONE',
    )
    expect(await rawStore(page, w.owner.accountId)).toBeNull()
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-action="apply"]')).toHaveCount(1)
  })

  test('21. a SUBMITTED application is read only: no form, no review; S02 has no "Tiếp tục"', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await inject(page, w.owner.accountId, w.startup.id, 'SUBMITTED')
    const raw = await rawStore(page, w.owner.accountId)
    await open(page, w.startup.id)
    await expect(page.locator('[data-screen="WF05-S03"]')).toHaveAttribute(
      'data-application-state',
      'SUBMITTED',
    )
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Đơn đã nộp: không sửa được.',
    )
    await expect(page.locator('[data-answer]')).toHaveText([
      'Dự án của bạn giải quyết vấn đề gì? — Trả lời một',
      'Bạn cần chương trình hỗ trợ điều gì? — Trả lời hai',
    ])
    await expect(form(page)).toHaveCount(0)
    await expect(
      page.locator('textarea, [data-action="review"], [data-action="save-draft"]'),
    ).toHaveCount(0)
    expect(await rawStore(page, w.owner.accountId)).toBe(raw)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    const row = page.locator(`[data-programme="${PROGRAMME}"]`)
    await expect(row.locator('[data-application]')).toHaveText('Đã nộp')
    await expect(row.locator('a, button')).toHaveCount(0)
  })

  test('5/6/7/23. archived and team member: locked, nothing stored; DRAFT / unknown programmes 404; no S04 route', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    // 6. Archived: readable, not editable.
    expect((await open(page, w.archived.id))?.status()).toBe(200)
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Không đăng ký được: Hồ sơ đã lưu trữ.',
    )
    await expect(form(page)).toHaveCount(0)
    // 5. The DRAFT Challenge, a random or malformed programme: 404.
    for (const programme of [CHALLENGE, RANDOM, 'abc', 'd4000000-0000-0000-0000-000000000099'])
      expect((await page.request.get(appUrl(w.startup.id, programme))).status(), programme).toBe(
        404,
      )
    // 23. S04: disabled with its reason; no link; its route is 404.
    await open(page, w.startup.id)
    const review = page.locator('[data-action="review"]')
    await expect(review).toBeDisabled()
    await expect(review).toHaveAttribute('title', 'Chưa có trong phiên bản này')
    await expect(page.locator('a[href$="/review"]')).toHaveCount(0)
    expect((await page.request.get(`${appUrl(w.startup.id)}/review`)).status()).toBe(404)
    expect(
      await page
        .locator('[data-screen="WF05-S03"] a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
    ).toEqual([detailUrl(w.startup.id)])
    expect(await rawStore(page, w.owner.accountId)).toBeNull()

    // 7. ACTIVE team member: locked; nothing stored.
    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    expect((await open(page, w.startup.id))?.status()).toBe(200)
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Không đăng ký được: Chỉ chủ sở hữu đăng ký được.',
    )
    await expect(page.locator('textarea, [data-action="save-draft"]')).toHaveCount(0)
    expect(await rawStore(page, w.teammate.accountId)).toBeNull()
  })

  test('a programme that does not take the venture type is locked (response shaped by the API)', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.route(`**${API}/${w.project.id}`, async (route) => {
      const body = await (await route.fetch()).json()
      body.programmes[0].eligibility = { eligible: false, reason: 'TYPE_NOT_ACCEPTED' }
      await route.fulfill({ json: body })
    })
    await open(page, w.project.id)
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Không đăng ký được: Chương trình không nhận loại hồ sơ này.',
    )
    await expect(form(page)).toHaveCount(0)
  })

  test('loading, then an error with a safe message and "Thử lại"', async ({ page }) => {
    const w = await world()
    await login(page.request, w.owner.email)
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
    await page.goto(appUrl(w.startup.id))
    await expect(page.locator('[data-state="application-loading"]')).toBeVisible()
    release()
    const failed = page.locator('[data-state="application-failed"]')
    await expect(failed).toHaveText(/Chưa tải được đơn đăng ký\. Vui lòng thử lại\./)
    expect(await failed.innerText()).not.toMatch(/boom|INTERNAL|\b500\b/)
    await expect(form(page)).toHaveCount(0)
    fail = false
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(form(page)).toBeVisible()
  })
})

test.describe('WF05-S03 authorization, IDOR and privacy', () => {
  test('8/9. guest, onboarding, unrelated, invitee, admin, leader, foreign, random, malformed, spoofed: never an editable draft', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await page.goto(appUrl(w.startup.id))
    await expect(page).toHaveURL('/auth')
    await login(page.request, 'newcomer@example.test')
    await page.goto(appUrl(w.startup.id))
    await expect(page).toHaveURL(/\/onboarding\//)

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
      for (const id of [w.startup.id, w.project.id]) {
        expect((await page.request.get(appUrl(id))).status(), `${who} ${id}`).toBe(404)
        expect(
          (await page.request.get(appUrl(id) + q, { headers: spoofs })).status(),
          `${who} ${id} spoofed`,
        ).toBe(404)
      }
    }
    // The stranger's own venture works for the stranger only; ids swapped after a valid load 404.
    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await expect(form(page)).toBeVisible()
    for (const url of [
      appUrl(w.foreign.id),
      appUrl(RANDOM),
      appUrl('abc'),
      appUrl(w.startup.id, CHALLENGE),
      `/demo/projects/${w.foreign.id}/applications/${PROGRAMME}` + q,
    ])
      expect((await page.goto(url))?.status(), url).toBe(404)
    // A draft planted for another member's venture in the owner's store is never shown or used.
    await open(page, w.startup.id)
    await inject(page, w.owner.accountId, w.foreign.id, 'DRAFT')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-screen="WF05-S03"]')).toHaveAttribute(
      'data-application-state',
      'NONE',
    )
    await answer(page, 0).fill('Chỉ của tôi')
    await save(page).click()
    const state = (await stored(page, w.owner.accountId))!
    expect(state.applications[`${w.foreign.id}:${PROGRAMME}`]!.programme_specific_answers).toEqual([
      'Trả lời một',
      'Trả lời hai',
    ])
    expect(state.applications[`${w.startup.id}:${PROGRAMME}`]!.programme_specific_answers).toEqual([
      'Chỉ của tôi',
      '',
    ])
    // Privacy: page HTML, API and the store key carry nothing personal.
    const html = await (await page.request.get(appUrl(w.startup.id), { headers: spoofs })).text()
    expect(html).not.toMatch(/@example\.test|30000000-|40000000-|hub_session/)
    expect(storeKey(w.owner.accountId)).not.toMatch(/@|example|Chủ/)
    expect(await fingerprint()).toEqual(before)
  })
})

test.describe('WF05-S03 responsive basics', () => {
  test('768 / 390: no overflow; fields fit; long text wraps; save reachable; validation readable; no overlap', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page, w.startup.id)
      await answer(page, 0).fill('Một câu trả lời rất dài '.repeat(40))
      await answer(page, 1).fill('x'.repeat(2001))
      await save(page).click()
      await expect(page.locator('[data-error="answer-1"]')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        `${width}px overflow`,
      ).toBe(0)
      for (const i of [0, 1]) {
        const box = (await answer(page, i).boundingBox())!
        expect(box.x + box.width, `${width}px field ${i}`).toBeLessThanOrEqual(width)
      }
      const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!
      const back = (await page.locator('[data-nav="application-back"]').boundingBox())!
      expect(back.y >= title.y + title.height - 1 || back.x >= title.x + title.width - 1).toBe(true)
      for (const locator of [
        save(page),
        page.locator('[data-error="answer-1"]'),
        page.locator('[data-action="review"]'),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s03-${width}.png`), fullPage: true })
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
    // Typed answers are content, not layout.
    for (const el of document.querySelectorAll('textarea')) {
      const r = el.getBoundingClientRect()
      rects.push({ x: r.x + 4, y: r.y + 4, width: r.width - 8, height: r.height - 8 })
    }
    return rects
  })
}

test.describe('WF05-S03 visual QA (approved primitives; no WF05 bitmap)', () => {
  test('1440×900 new, partial, saved, validation, archived, submitted: typography; shell vs WF02-S01; primitives vs ADM5', async ({
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
    const capture = async (name: string) => {
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s03-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf05-s03-${name}-full.png`),
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
          { diffPath: resolveOutputPath('diff', `WF05-S03.${name}.shell.diff.png`) },
        ),
      )
      const rule = (await page.locator('[data-demo-page] > header').boundingBox())!
      const card = (await page.locator('[data-section="applicant"]').boundingBox())!
      results.push(
        ...compareSegments(
          adm5,
          actual,
          [
            {
              name: `${name}-header-rule`,
              reference: { x: 500, y: 72, width: 600, height: 6 },
              dy: Math.round(rule.y + rule.height) - 76,
            },
            {
              name: `${name}-card-top`,
              reference: { x: 300, y: 95, width: 800, height: 8 },
              dx: Math.round(card.x) - 248,
              dy: Math.round(card.y) - 99,
            },
          ],
          masks,
          { diffPath: resolveOutputPath('diff', `WF05-S03.${name}.primitives.diff.png`) },
        ),
      )
    }

    await login(page.request, w.owner.email)
    await open(page, w.startup.id)
    await capture('new')
    await answer(page, 0).fill('Chúng tôi giúp hợp tác xã số hoá sổ sách.')
    await capture('partial')
    await save(page).click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    await capture('saved')
    await answer(page, 1).fill('x'.repeat(2001))
    await save(page).click()
    await expect(page.locator('[data-error="answer-1"]')).toBeVisible()
    await capture('validation')
    await open(page, w.archived.id)
    await capture('archived')
    await page.goto(detailUrl(w.project.id), { waitUntil: 'networkidle' })
    await inject(page, w.owner.accountId, w.project.id, 'SUBMITTED')
    await open(page, w.project.id)
    await expect(page.locator('[data-state="application-locked"]')).toBeVisible()
    await capture('submitted')

    writeJsonReport('WF05-S03.primitives.json', {
      screen_id: 'WF05-S03',
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
            'DEC-WF05-G1: WF04 demo frame, card chrome and question form inside MemberShell; "Rà soát & nộp" disabled with its reason until S04; typed answers masked as content; no WF05 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
