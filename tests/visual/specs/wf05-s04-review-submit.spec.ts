import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { seedVenture } from '../../../src/lib/venture/testing'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF05-S04 — review + submit (DEC-WF05-G5, DEC-WF05-T00-D1): S03 "Rà soát &
 * nộp" saves and opens the review; the owner sees the live venture, programme,
 * applicant type, every question and answer; the checklist blocks an
 * incomplete or invalid draft; "Nộp đơn" re-reads the venture and programme and
 * performs DRAFT → SUBMITTED once, atomically; SUBMITTED is final and read
 * only (S03 locked, S01 / S02 "Đã nộp"); refresh / reset; members, invitees,
 * strangers, admin and leader never submit; IDOR / spoofing; no writes;
 * responsive and primitives.
 */

const API = '/api/v1/demo/projects'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const Q1 = 'Dự án của bạn giải quyết vấn đề gì?'
const Q2 = 'Bạn cần chương trình hỗ trợ điều gì?'
const detailUrl = (id: string) => `/demo/projects/${id}`
const appUrl = (id: string, programme = PROGRAMME) =>
  `/demo/projects/${id}/applications/${programme}`
const reviewUrl = (id: string, programme = PROGRAMME) => `${appUrl(id, programme)}/review`

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
  const email = `wf05-s04-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
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
  const owner = await person('Chủ Nộp')
  const teammate = await person('Thành Viên')
  const invitee = await person('Được Mời')
  const stranger = await person('Người Ngoài')
  const startup = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Startup S04' })
  const project = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án S04' })
  const archived = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ S04' })
  const foreign = await seedVenture(stranger.accountId, { type: 'STARTUP', name: 'Ngoài S04' })
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
type StoredApplication = {
  primary_applicant_type: string
  primary_applicant_id: string
  programme_id: string
  status: string
  programme_specific_answers: string[]
  created_at: string
  updated_at: string
  submitted_at: string | null
}
async function stored(
  page: Page,
  accountId: string,
): Promise<{ applications: Record<string, StoredApplication> } | null> {
  const raw = await rawStore(page, accountId)
  return raw ? JSON.parse(raw) : null
}
const rawStore = (page: Page, accountId: string) =>
  page.evaluate((k) => sessionStorage.getItem(k), storeKey(accountId))

/** Writes the actor's store directly (a planted or tampered value; no change event). */
async function plant(
  page: Page,
  accountId: string,
  entries: {
    ventureId: string
    type?: 'TEAM' | 'STARTUP'
    status?: 'DRAFT' | 'SUBMITTED'
    answers?: string[]
    createdAt?: string
  }[],
) {
  const now = new Date().toISOString()
  const applications = Object.fromEntries(
    entries.map((e) => [
      `${e.ventureId}:${PROGRAMME}`,
      {
        primary_applicant_type: e.type ?? 'STARTUP',
        primary_applicant_id: e.ventureId,
        programme_id: PROGRAMME,
        status: e.status ?? 'DRAFT',
        programme_specific_answers: e.answers ?? ['Trả lời một', 'Trả lời hai'],
        created_at: e.createdAt ?? now,
        updated_at: now,
        submitted_at: e.status === 'SUBMITTED' ? now : null,
      },
    ]),
  )
  await page.evaluate(
    ([k, v]) => sessionStorage.setItem(k!, v!),
    [storeKey(accountId), JSON.stringify({ version: 1, applications })],
  )
}

async function openReview(page: Page, id: string, programme = PROGRAMME) {
  const response = await page.goto(reviewUrl(id, programme), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="review-loading"]')).toHaveCount(0)
  return response
}

const screen = (page: Page) => page.locator('[data-screen="WF05-S04"]')
const submitButton = (page: Page) => page.locator('[data-action="submit"]')
const check = (page: Page, item: string) => page.locator(`[data-check="${item}"]`)
/** Question and answer per item, as rendered (question on its own line). */
const answersShown = (page: Page) =>
  page
    .locator('[data-review-answer]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText))

async function hrefs(page: Page) {
  return page
    .locator('[data-screen="WF05-S04"] a')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')!))
}

test.describe('WF05-S04 review + submit', () => {
  test('1/3/4/5/27. PROJECT owner: S03 "Rà soát & nộp" saves and opens S04; live venture, programme, TEAM, every answer', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await page.goto(appUrl(w.project.id), { waitUntil: 'networkidle' })
    await page.locator('#answer-0').fill('Kết nối nông dân với chợ đầu mối.')
    await page.locator('#answer-1').fill('Cố vấn pháp lý và thị trường.')
    // 27. The button saves first (nothing typed is lost), then opens S04.
    await page.locator('[data-action="review"]').click()
    await expect(page).toHaveURL(reviewUrl(w.project.id))
    await expect(screen(page)).toHaveAttribute('data-application-state', 'DRAFT')
    const app = (await stored(page, w.owner.accountId))!.applications[
      `${w.project.id}:${PROGRAMME}`
    ]!
    expect(app.status).toBe('DRAFT')
    expect(app.primary_applicant_type).toBe('TEAM')
    // 1 / 3 / 4 / 5. Three separate blocks: venture, programme, answers.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Rà soát đơn: Chương trình ươm tạo (demo)',
    )
    await expect(page.locator('[data-demo-meta]')).toHaveText('Dự án S04 · Bản nháp')
    await expect(page.locator('[data-review-venture]')).toHaveText('Dự án S04')
    await expect(page.locator('[data-review-applicant]')).toHaveText(
      'Dự án · Đăng ký với tư cách: Đội',
    )
    await expect(page.locator('[data-review-programme]')).toHaveText('Chương trình ươm tạo (demo)')
    await expect(page.locator('[data-review="programme"]')).toContainText(
      'Chương trình · Chapter 01 · 01/09/2026 – 15/12/2026',
    )
    expect(await answersShown(page)).toEqual([
      `${Q1}\nKết nối nông dân với chợ đầu mối.`,
      `${Q2}\nCố vấn pháp lý và thị trường.`,
    ])
    for (const item of ['owner', 'active', 'type', 'answers'])
      await expect(check(page, item)).toHaveAttribute('data-ok', 'true')
    await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng nộp')
    await expect(submitButton(page)).toBeEnabled()
    await expect(submitButton(page)).toHaveText('Nộp đơn')
    // No technical ids or personal data in the page text.
    const text = await screen(page).innerText()
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|@|Chủ Nộp|DRAFT|TEAM|STARTUP/)
    // Back to S03 while DRAFT: the answers are there to edit.
    await page.locator('[data-nav="review-edit"]').click()
    await expect(page).toHaveURL(appUrl(w.project.id))
    await expect(page.locator('#answer-0')).toHaveValue('Kết nối nông dân với chợ đầu mối.')
    expect(await fingerprint()).toEqual(before)
  })

  test('2/6/10/11/12/13/25/28. STARTUP owner submits: one SUBMITTED, answers and created_at kept; read only; refresh; S02 / S01 "Đã nộp"', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await page.goto(appUrl(w.startup.id), { waitUntil: 'networkidle' })
    await page.locator('#answer-0').fill('Số hoá sổ sách hợp tác xã.')
    await page.locator('#answer-1').fill('Kết nối doanh nghiệp đầu ra.')
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    const draft = (await stored(page, w.owner.accountId))!.applications[
      `${w.startup.id}:${PROGRAMME}`
    ]!
    await page.locator('[data-action="review"]').click()
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    await expect(page.locator('[data-review-applicant]')).toHaveText(
      'Startup · Đăng ký với tư cách: Startup',
    )
    await submitButton(page).click()
    // 10 / 13. The page stays, read only (HC-WF05-08).
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    await expect(page.locator('[data-state="review-submitted"]')).toHaveText(
      'Đã nộp đơn. Đơn chỉ xem được, không sửa được.',
    )
    await expect(page.locator('[data-demo-meta]')).toHaveText('Startup S04 · Đã nộp')
    await expect(page.locator('[data-application="SUBMITTED"]')).toHaveText('Đã nộp')
    await expect(page.locator('[data-publish-state="submitted"]')).toContainText(/Nộp ngày \d\d\//)
    await expect(
      page.locator(
        'textarea, input, [data-action="submit"], [data-review-checklist], [data-nav="review-edit"]',
      ),
    ).toHaveCount(0)
    expect(await answersShown(page)).toEqual([
      `${Q1}\nSố hoá sổ sách hợp tác xã.`,
      `${Q2}\nKết nối doanh nghiệp đầu ra.`,
    ])
    // 11 / 12. The same logical application: answers and created_at kept; one record.
    const state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications)).toEqual([`${w.startup.id}:${PROGRAMME}`])
    const app = state.applications[`${w.startup.id}:${PROGRAMME}`]!
    expect(app).toMatchObject({
      status: 'SUBMITTED',
      primary_applicant_type: 'STARTUP',
      primary_applicant_id: w.startup.id,
      programme_id: PROGRAMME,
      programme_specific_answers: draft.programme_specific_answers,
      created_at: draft.created_at,
    })
    expect(app.submitted_at).not.toBeNull()
    // 25. Refresh keeps SUBMITTED.
    const raw = await rawStore(page, w.owner.accountId)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    expect(await rawStore(page, w.owner.accountId)).toBe(raw)
    // 28. Post-submit: back to S02 ("Đã nộp", "Xem đơn"), S01, and the review again.
    expect(await hrefs(page)).toEqual([detailUrl(w.startup.id)])
    await page.locator('[data-nav="review-back"]').click()
    await expect(page).toHaveURL(detailUrl(w.startup.id))
    const row = page.locator(`[data-programme="${PROGRAMME}"]`)
    await expect(row.locator('[data-application]')).toHaveText('Đã nộp')
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await row.locator('[data-nav="application-view"]').click()
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    await page.goto('/demo/projects', { waitUntil: 'networkidle' })
    await expect(
      page.locator(`[data-venture="${w.startup.id}"] [data-venture-applications]`),
    ).toHaveText('Đơn đăng ký demo: Chương trình ươm tạo (demo) · Đã nộp')
    expect(await rawStore(page, w.owner.accountId)).toBe(raw)
    expect(await fingerprint()).toEqual(before)
  })

  test('3. a WF02 rename shows live on S04; the application holds no venture or programme data', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    const raw = (await rawStore(page, w.owner.accountId))!
    expect(raw).not.toMatch(/Startup S04|Chương trình ươm tạo|Chapter 01|Chủ Nộp|@/)
    expect(
      (
        await page.request.patch(`/api/v1/ventures/${w.startup.id}`, {
          data: { name: 'Startup S04 mới' },
        })
      ).status(),
    ).toBe(200)
    await openReview(page, w.startup.id)
    await expect(page.locator('[data-review-venture]')).toHaveText('Startup S04 mới')
    await expect(page.locator('[data-demo-meta]')).toHaveText('Startup S04 mới · Bản nháp')
    await submitButton(page).click()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    const after = (await rawStore(page, w.owner.accountId))!
    expect(after).not.toMatch(/Startup S04|Chương trình ươm tạo|Chapter 01|Chủ Nộp|@/)
  })

  test('7/8/9. a missing, blank, too-long or mismatched answer blocks submit; the DRAFT is untouched', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    // 7. Missing: saved from S03 with one answer.
    await page.goto(appUrl(w.startup.id), { waitUntil: 'networkidle' })
    await page.locator('#answer-0').fill('Chỉ một câu')
    await page.locator('[data-action="review"]').click()
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    const saved = await rawStore(page, w.owner.accountId)
    // Wait for the review to render before reading it (a plain evaluate does not retry).
    await expect(page.locator('[data-review-answer]')).toHaveCount(2)
    expect((await answersShown(page))[1]).toBe(`${Q2}\nChưa trả lời`)
    await expect(page.locator('[data-review-answer="1"]')).toHaveAttribute('data-answered', 'false')
    await expect(check(page, 'answers')).toHaveAttribute('data-ok', 'false')
    await expect(check(page, 'answers')).toContainText('✗ Còn thiếu')
    await expect(page.locator('[data-readiness]')).toHaveText('Còn thiếu 1 mục')
    await expect(page.locator('[data-publish-state="incomplete"]')).toContainText(
      'Hoàn thành các mục còn thiếu để nộp.',
    )
    await expect(submitButton(page)).toBeDisabled()
    await submitButton(page).click({ force: true })
    expect(await rawStore(page, w.owner.accountId)).toBe(saved)
    await expect(screen(page)).toHaveAttribute('data-application-state', 'DRAFT')

    // 8. Blank-only, too long and a mismatched count (config drift): each blocks, never repaired.
    for (const answers of [
      ['   ', 'Hai'],
      ['Một', 'x'.repeat(2001)],
      ['Chỉ một câu cho hai câu hỏi'],
    ]) {
      await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers }])
      const planted = await rawStore(page, w.owner.accountId)
      await openReview(page, w.startup.id)
      await expect(check(page, 'answers'), answers.join('|')).toHaveAttribute('data-ok', 'false')
      await expect(submitButton(page)).toBeDisabled()
      await submitButton(page).click({ force: true })
      expect(await rawStore(page, w.owner.accountId)).toBe(planted)
    }

    // 9. Changed after the page rendered: the store refuses; nothing half-written; the page shows it.
    for (const answers of [
      ['Một', ''],
      ['Một', 'x'.repeat(2001)],
    ]) {
      await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
      await openReview(page, w.startup.id)
      await expect(submitButton(page)).toBeEnabled()
      await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers }])
      const tampered = await rawStore(page, w.owner.accountId)
      await submitButton(page).click()
      await expect(page.locator('[data-state="submit-refused"]')).toHaveText(
        'Chưa nộp được đơn: kiểm tra lại các mục bên dưới.',
      )
      await expect(check(page, 'answers')).toHaveAttribute('data-ok', 'false')
      await expect(submitButton(page)).toBeDisabled()
      expect(await rawStore(page, w.owner.accountId)).toBe(tampered)
      const app = (await stored(page, w.owner.accountId))!.applications[
        `${w.startup.id}:${PROGRAMME}`
      ]!
      expect(app.status).toBe('DRAFT')
      expect(app.submitted_at).toBeNull()
    }
  })

  test('atomicity: a refused browser write leaves the DRAFT; the retry submits once', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    const draft = await rawStore(page, w.owner.accountId)
    await openReview(page, w.startup.id)
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await submitButton(page).click()
    await expect(page.locator('[data-state="submit-failed"]')).toHaveText(
      'Chưa nộp được đơn. Vui lòng thử lại.',
    )
    expect(await rawStore(page, w.owner.accountId)).toBe(draft)
    await expect(screen(page)).toHaveAttribute('data-application-state', 'DRAFT')
    await expect(submitButton(page)).toBeEnabled()
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await submitButton(page).click()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    const state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications)).toHaveLength(1)
  })

  test('SUBMITTING: the re-read is in flight; the button is busy and disabled; nothing stored until it lands', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    const draft = await rawStore(page, w.owner.accountId)
    await openReview(page, w.startup.id)
    let release!: () => void
    const gate = new Promise<void>((done) => (release = done))
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      await gate
      await route.continue()
    })
    await submitButton(page).click()
    await expect(submitButton(page)).toHaveText('Đang nộp…')
    await expect(submitButton(page)).toBeDisabled()
    await expect(submitButton(page)).toHaveAttribute('aria-busy', 'true')
    expect(await rawStore(page, w.owner.accountId)).toBe(draft)
    release()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
  })

  test('14/15/16/17. double click and a repeated submit: one SUBMITTED; S03 locked; no second application', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await openReview(page, w.startup.id)
    // 17. Double click and a scripted burst: one transition.
    await submitButton(page).dblclick()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    const first = await rawStore(page, w.owner.accountId)
    // Another page of this session (the project) with a burst of clicks.
    await plant(page, w.owner.accountId, [
      { ventureId: w.startup.id, status: 'SUBMITTED' },
      { ventureId: w.project.id, type: 'TEAM' },
    ])
    await openReview(page, w.project.id)
    await page.evaluate(() => {
      const b = document.querySelector<HTMLButtonElement>('[data-action="submit"]')!
      b.click()
      b.click()
      b.click()
    })
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    const state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications).sort()).toEqual(
      [`${w.project.id}:${PROGRAMME}`, `${w.startup.id}:${PROGRAMME}`].sort(),
    )
    expect(state.applications[`${w.project.id}:${PROGRAMME}`]!.status).toBe('SUBMITTED')

    // 16. Repeated submit from a page rendered before the application was submitted
    // elsewhere in this session: refused; the SUBMITTED record is untouched.
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await openReview(page, w.startup.id)
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, status: 'SUBMITTED' }])
    const submitted = await rawStore(page, w.owner.accountId)
    await submitButton(page).click()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    await expect(page.locator('[data-action="submit"], [data-nav="review-edit"]')).toHaveCount(0)
    expect(await rawStore(page, w.owner.accountId)).toBe(submitted)
    expect(first).not.toBeNull()

    // 14. S03 is locked: no form, only the read-only view and the link back to it.
    await page.goto(appUrl(w.startup.id), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Đơn đã nộp: không sửa được.',
    )
    await expect(
      page.locator('textarea, [data-action="save-draft"], [data-action="review"]'),
    ).toHaveCount(0)
    await page.locator('[data-nav="application-view-submitted"]').click()
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    // 15. S02 offers no second "Đăng ký"; the application is one record.
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    expect(await rawStore(page, w.owner.accountId)).toBe(submitted)
    expect(await fingerprint()).toEqual(before)
  })

  test('22. ARCHIVED: blocked on load and when archived after the page loaded; the DRAFT and the venture unchanged', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [
      { ventureId: w.archived.id },
      { ventureId: w.startup.id },
    ])
    const planted = await rawStore(page, w.owner.accountId)
    // Archived before: the checklist blocks it; no path back to an editable draft.
    expect((await openReview(page, w.archived.id))?.status()).toBe(200)
    await expect(check(page, 'active')).toHaveAttribute('data-ok', 'false')
    await expect(submitButton(page)).toBeDisabled()
    await expect(page.locator('[data-nav="review-edit"]')).toHaveCount(0)
    expect(await hrefs(page)).toEqual([detailUrl(w.archived.id)])
    // Archived after the page loaded: the submit-time re-read refuses; never a stale submit.
    await openReview(page, w.startup.id)
    await expect(submitButton(page)).toBeEnabled()
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [w.startup.id])
    const before = await fingerprint()
    await submitButton(page).click()
    await expect(page.locator('[data-state="submit-refused"]')).toBeVisible()
    await expect(check(page, 'active')).toHaveAttribute('data-ok', 'false')
    await expect(submitButton(page)).toBeDisabled()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'DRAFT')
    expect(await rawStore(page, w.owner.accountId)).toBe(planted)
    expect(await fingerprint()).toEqual(before)
  })

  test('a programme that no longer takes the venture type, or is gone at submit time: blocked (source-backed)', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    const planted = await rawStore(page, w.owner.accountId)
    await openReview(page, w.startup.id)
    // The response is shaped as if the programme stopped taking STARTUP after the load.
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      const body = await (await route.fetch()).json()
      body.programmes[0].applicant_types = ['TEAM']
      body.programmes[0].eligibility = { eligible: false, reason: 'TYPE_NOT_ACCEPTED' }
      await route.fulfill({ json: body })
    })
    await submitButton(page).click()
    await expect(page.locator('[data-state="submit-refused"]')).toBeVisible()
    await expect(check(page, 'type')).toHaveAttribute('data-ok', 'false')
    expect(await rawStore(page, w.owner.accountId)).toBe(planted)
    // The programme is gone (no longer PUBLISHED): not found, nothing stored.
    await page.unroute(`**${API}/${w.startup.id}`)
    await openReview(page, w.startup.id)
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      const body = await (await route.fetch()).json()
      body.programmes = []
      await route.fulfill({ json: body })
    })
    await submitButton(page).click()
    await expect(page.locator('[data-state="review-missing"]')).toHaveText(
      'Không tìm thấy đơn đăng ký này.',
    )
    expect(await rawStore(page, w.owner.accountId)).toBe(planted)
  })

  test('26. reset clears the SUBMITTED application; ventures and programmes unchanged', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, status: 'SUBMITTED' }])
    await openReview(page, w.startup.id)
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(page.locator('[data-state="review-no-application"]')).toHaveText(
      /Chưa có đơn đăng ký nào cho chương trình này trong phiên này\./,
    )
    await expect(page.locator('[data-review-summary], [data-action="submit"]')).toHaveCount(0)
    expect(await rawStore(page, w.owner.accountId)).toBeNull()
    // Opening S04 without an application creates nothing; the start link goes to S03.
    await page.reload({ waitUntil: 'networkidle' })
    expect(await rawStore(page, w.owner.accountId)).toBeNull()
    await page.locator('[data-nav="review-start"]').click()
    await expect(page).toHaveURL(appUrl(w.startup.id))
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-action="apply"]')).toHaveCount(1)
    await expect(page.locator('[data-review-venture]')).toHaveCount(0)
    expect(await fingerprint()).toEqual(before)
  })

  test('29. no dead links: every S04 link in every state answers 200', async ({ page }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    const seen = new Set<string>()
    await openReview(page, w.startup.id)
    for (const h of await hrefs(page)) seen.add(h)
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await openReview(page, w.startup.id)
    for (const h of await hrefs(page)) seen.add(h)
    await submitButton(page).click()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    for (const h of await hrefs(page)) seen.add(h)
    await page.goto(appUrl(w.startup.id), { waitUntil: 'networkidle' })
    seen.add((await page.locator('[data-nav="application-view-submitted"]').getAttribute('href'))!)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    seen.add((await page.locator('[data-nav="application-view"]').getAttribute('href'))!)
    expect([...seen].sort()).toEqual(
      [appUrl(w.startup.id), detailUrl(w.startup.id), reviewUrl(w.startup.id)].sort(),
    )
    for (const url of seen) expect((await page.request.get(url)).status(), url).toBe(200)
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
    await page.goto(reviewUrl(w.startup.id))
    await expect(page.locator('[data-state="review-loading"]')).toBeVisible()
    release()
    const failed = page.locator('[data-state="review-failed"]')
    await expect(failed).toHaveText(/Chưa tải được đơn đăng ký\. Vui lòng thử lại\./)
    expect(await failed.innerText()).not.toMatch(/boom|INTERNAL|\b500\b/)
    await expect(submitButton(page)).toHaveCount(0)
    fail = false
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator('[data-state="review-no-application"]')).toBeVisible()
  })
})

test.describe('WF05-S04 authorization, IDOR and privacy', () => {
  test('18–21/23/24. member, invitee, stranger, admin, leader, foreign, random, malformed, DRAFT programme, spoofs, id swap: never a submit', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    // Guest and onboarding.
    await page.goto(reviewUrl(w.startup.id))
    await expect(page).toHaveURL('/auth')
    await login(page.request, 'newcomer@example.test')
    await page.goto(reviewUrl(w.startup.id))
    await expect(page).toHaveURL(/\/onboarding(\/|$)/)

    // 18. ACTIVE team member: the review is readable, nothing to submit — even a planted draft.
    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    expect((await openReview(page, w.startup.id))?.status()).toBe(200)
    await expect(page.locator('[data-state="review-no-application"]')).toBeVisible()
    await expect(page.locator('[data-nav="review-start"], [data-action="submit"]')).toHaveCount(0)
    await plant(page, w.teammate.accountId, [{ ventureId: w.startup.id }])
    const planted = await rawStore(page, w.teammate.accountId)
    await openReview(page, w.startup.id)
    await expect(check(page, 'owner')).toHaveAttribute('data-ok', 'false')
    await expect(submitButton(page)).toBeDisabled()
    await expect(page.locator('[data-nav="review-edit"]')).toHaveCount(0)
    await submitButton(page).click({ force: true })
    expect(await rawStore(page, w.teammate.accountId)).toBe(planted)

    const spoofs = {
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': '10000000-0000-0000-0000-000000000101',
      'x-owner-profile-id': w.owner.profileId,
      'x-profile-id': w.owner.profileId,
      'x-account-id': w.owner.accountId,
    }
    const q = `?owner_profile_id=${w.owner.profileId}&profile_id=${w.owner.profileId}&account_id=${w.owner.accountId}&orgId=10000000-0000-0000-0000-000000000101&role=OWNER`
    // 19 / 20 / 21. Pending invitee, unrelated member, admin, leader: 404, spoofed or not.
    for (const who of [
      w.invitee.email,
      w.stranger.email,
      'ops@example.test',
      'leader@example.test',
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      for (const id of [w.startup.id, w.project.id]) {
        expect((await page.request.get(reviewUrl(id))).status(), `${who} ${id}`).toBe(404)
        expect(
          (await page.request.get(reviewUrl(id) + q, { headers: spoofs })).status(),
          `${who} ${id} spoofed`,
        ).toBe(404)
      }
    }

    // 23 / 24. The owner: foreign / random / malformed venture, DRAFT / unknown programme,
    // and ids swapped after a valid review: 404; no cross-venture submit.
    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }, { ventureId: w.foreign.id }])
    await openReview(page, w.startup.id)
    await expect(submitButton(page)).toBeEnabled()
    for (const url of [
      reviewUrl(w.foreign.id),
      reviewUrl(RANDOM),
      reviewUrl('abc'),
      reviewUrl(w.startup.id, CHALLENGE),
      reviewUrl(w.startup.id, RANDOM),
      reviewUrl(w.startup.id, 'abc'),
      reviewUrl(w.foreign.id) + q,
      `${appUrl(w.startup.id)}/unknown`,
    ])
      expect((await page.goto(url))?.status(), url).toBe(404)
    // The owner's spoofed request is the owner's own view, nothing more.
    expect(
      (await page.request.get(reviewUrl(w.startup.id) + q, { headers: spoofs })).status(),
    ).toBe(200)
    await openReview(page, w.startup.id)
    await submitButton(page).click()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    const state = (await stored(page, w.owner.accountId))!
    expect(state.applications[`${w.foreign.id}:${PROGRAMME}`]!.status).toBe('DRAFT')
    expect(state.applications[`${w.startup.id}:${PROGRAMME}`]!.status).toBe('SUBMITTED')

    // Privacy: page HTML, rendered text and the store key carry nothing personal or technical.
    const html = await (await page.request.get(reviewUrl(w.startup.id), { headers: spoofs })).text()
    expect(html).not.toMatch(/@example\.test|30000000-|40000000-|hub_session/)
    expect(await screen(page).innerText()).not.toMatch(
      /@|[0-9a-f]{8}-[0-9a-f]{4}-|token|cookie|Chủ Nộp|Thành Viên|Được Mời/,
    )
    expect(storeKey(w.owner.accountId)).not.toMatch(/@|example|Chủ/)
    expect(await fingerprint()).toEqual(before)
  })
})

test.describe('WF05-S04 responsive basics', () => {
  test('768 / 390: no overflow; long answers wrap; submit and validation reachable; no overlap', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    const long = 'Một câu trả lời rất dài để kiểm tra việc xuống dòng '.repeat(8).trim()
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers: [long, ''] }])
      await openReview(page, w.startup.id)
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(await overflow(), `${width}px overflow`).toBe(0)
      const answerBox = (await page.locator('[data-review-answer="0"]').boundingBox())!
      expect(answerBox.x + answerBox.width, `${width}px answer`).toBeLessThanOrEqual(width)
      const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!
      const edit = (await page.locator('[data-nav="review-edit"]').boundingBox())!
      expect(edit.y >= title.y + title.height - 1 || edit.x >= title.x + title.width - 1).toBe(true)
      for (const locator of [
        check(page, 'answers'),
        page.locator('[data-publish-state="incomplete"]'),
        submitButton(page),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s04-${width}.png`), fullPage: true })
      // Ready → submit → read only, at this width.
      await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers: [long, 'Hai'] }])
      await openReview(page, w.startup.id)
      await submitButton(page).scrollIntoViewIfNeeded()
      await expect(submitButton(page)).toBeInViewport()
      await submitButton(page).click()
      await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
      expect(await overflow(), `${width}px submitted overflow`).toBe(0)
      await page.screenshot({
        path: path.join(ACTUAL, `wf05-s04-submitted-${width}.png`),
        fullPage: true,
      })
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

test.describe('WF05-S04 visual QA (approved primitives; no WF05 bitmap)', () => {
  test('1440×900 ready, incomplete, submitting, refused, submitted, no application, error: typography; shell vs WF02-S01; primitives vs ADM5', async ({
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
    const capture = async (name: string, card: string | null) => {
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s04-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf05-s04-${name}-full.png`),
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
          { diffPath: resolveOutputPath('diff', `WF05-S04.${name}.shell.diff.png`) },
        ),
      )
      const rule = (await page.locator('[data-demo-page] > header').boundingBox())!
      const segments: Segment[] = [
        {
          name: `${name}-header-rule`,
          reference: { x: 500, y: 72, width: 600, height: 6 },
          dy: Math.round(rule.y + rule.height) - 76,
        },
      ]
      if (card) {
        const box = (await page.locator(card).boundingBox())!
        segments.push({
          name: `${name}-card-top`,
          reference: { x: 300, y: 95, width: 800, height: 8 },
          dx: Math.round(box.x) - 248,
          dy: Math.round(box.y) - 99,
        })
      }
      results.push(
        ...compareSegments(adm5, actual, segments, masks, {
          diffPath: resolveOutputPath('diff', `WF05-S04.${name}.primitives.diff.png`),
        }),
      )
    }

    await login(page.request, w.owner.email)
    await page.goto(detailUrl(w.startup.id), { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [
      {
        ventureId: w.startup.id,
        answers: ['Chúng tôi giúp hợp tác xã số hoá sổ sách.', 'Kết nối doanh nghiệp đầu ra.'],
      },
    ])
    await openReview(page, w.startup.id)
    await capture('ready', '[data-review-summary]')
    await plant(page, w.owner.accountId, [
      { ventureId: w.startup.id, answers: ['Chúng tôi giúp hợp tác xã số hoá sổ sách.', ''] },
    ])
    await openReview(page, w.startup.id)
    await capture('incomplete', '[data-review-summary]')
    // Refused at submit time (changed after render): the validation notice.
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await openReview(page, w.startup.id)
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers: ['Một', ''] }])
    await submitButton(page).click()
    await expect(page.locator('[data-state="submit-refused"]')).toBeVisible()
    await capture('validation', '[data-review-summary]')
    // SUBMITTING: the submit-time re-read held open.
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await openReview(page, w.startup.id)
    let release!: () => void
    const gate = new Promise<void>((done) => (release = done))
    await page.route(`**${API}/${w.startup.id}`, async (route) => {
      await gate
      await route.continue()
    })
    await submitButton(page).click()
    await expect(submitButton(page)).toHaveText('Đang nộp…')
    await capture('submitting', '[data-review-summary]')
    release()
    await expect(screen(page)).toHaveAttribute('data-application-state', 'SUBMITTED')
    await page.unroute(`**${API}/${w.startup.id}`)
    await capture('submitted', '[data-review-summary]')
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(page.locator('[data-state="review-no-application"]')).toBeVisible()
    await capture('no-application', null)
    await page.route(`**${API}/${w.startup.id}`, (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'boom' } } }),
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="review-failed"]')).toBeVisible()
    await capture('error', null)

    writeJsonReport('WF05-S04.primitives.json', {
      screen_id: 'WF05-S04',
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
            'DEC-WF05-G1: WF04 demo frame, card chrome, review rows and S07 checklist inside MemberShell; answers and dates masked as content; no WF05 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
