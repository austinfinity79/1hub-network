import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { DEMO_PROGRAMMES } from '../../../src/lib/programme-demo/fixtures'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF04 closing gate (PROCESS-P0-ACCELERATED-SAFE-V2 §I): UAT-WF04-J1
 * (Programme), UAT-WF04-J2 (Challenge), SEC-WF04-01 (actors × every WF04 route
 * and API), NEG-WF04 (negative / alternate), NAV-WF04 (every control of a
 * session draft), EVT-WF04 (Event boundary) and VIS-WF04 (visual completion).
 * Sign-in in the journeys is the real magic-link path (WF01). Every journey
 * proves the canonical tables unchanged. Screen-level cases stay in each
 * WF04-S0x spec.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const ADMIN_ACCOUNT = '30000000-0000-0000-0000-000000000003'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const API = '/api/v1/demo/programmes'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const STEPS = ['basic', 'journey', 'events', 'registration', 'team', 'review'] as const
const SCREEN: Record<string, string> = {
  detail: 'WF04-S08',
  basic: 'WF04-S08-BASIC',
  journey: 'WF04-S03',
  events: 'WF04-S04',
  registration: 'WF04-S05',
  team: 'WF04-S06',
  review: 'WF04-S07',
}
const detailUrl = (id: string) => `/demo/programmes/${id}`
const stepUrl = (id: string, step: (typeof STEPS)[number]) => `/demo/programmes/${id}/setup/${step}`
const PLACEHOLDER = /\bTODO\b|FIXME|lorem ipsum|\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/i
const LEAK = /@example\.test|hub_session|\btoken\b|30000000-|40000000-/i

const people: string[] = []
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
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    people,
  ])
  await closePool()
})

// ------------------------------------------------------------------ helpers

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** The real WF01 path: /auth → check email → the magic link → signed in. */
async function signIn(page: Page, email: string) {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

async function person(role: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-uat-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 UAT', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  people.push(p!.id)
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [p!.id, role.code, role.scopeType, role.scopeId],
  )
  return { email, account: a!.id }
}

const storeKey = (account: string) =>
  `hub.wf04-demo.v1.${createHash('sha256').update(`wf04-demo:${account}`).digest('hex').slice(0, 16)}`

type StoredDetail = {
  programme: { id: string; name: string; status: string; type: string; organization_id: string }
  stages: { name: string }[]
  problem_statements?: { title: string }[]
  events: { id: string; name: string; programme_id: string; status: string }[]
  registration: { applicant_types: string[]; questions: string[] }
  team: unknown[]
}

async function stored(page: Page, account: string) {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), storeKey(account))
  return raw
    ? (JSON.parse(raw) as { programmes: Record<string, StoredDetail>; created: string[] })
    : null
}

/** Row-exact fingerprints of every canonical table WF04 could touch. */
async function snapshot() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string | null>>(
    `SELECT ${table('programmes')} AS programmes,
            ${table('events')} AS events,
            to_regclass('public.applications')::text AS applications_table,
            ${table('organizations')} AS organizations,
            ${table('organization_relationships')} AS relationships,
            ${table('individual_profiles')} AS profiles,
            ${table('projects')} AS projects,
            ${table('project_members')} AS project_members,
            ${table('project_domains')} AS project_domains,
            ${table('community_memberships')} AS memberships,
            ${table('leadership_records')} AS leadership,
            ${table('role_assignments')} AS roles,
            ${table('membership_bootstrap')} AS bootstrap,
            ${table('consent_records')} AS consents,
            ${table('vocabulary_items')} AS vocabulary,
            ${table('audit_events')} AS audit,
            (SELECT count(*) FROM audit_events)::text AS audit_count,
            (SELECT count(*) FROM analytics_events)::text AS analytics`,
  )
  return row!
}

type Evidence = { id: string; step: string; checked: string; result: 'PASS' }

/** Step evidence: a step is recorded only after its assertions passed. */
function journal(page: Page, name: string) {
  const steps: Evidence[] = []
  return {
    steps,
    async pass(id: string, step: string, checked: string, shot = false) {
      if (shot)
        await page.screenshot({
          path: path.join(ACTUAL, `wf04-uat-${name}-${id}.png`),
          fullPage: true,
        })
      steps.push({ id, step, checked, result: 'PASS' })
    },
  }
}

async function settled(page: Page) {
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

async function reset(page: Page) {
  await page.locator('[data-demo-reset="start"]').click()
  await page.locator('[data-demo-reset="confirm"]').click()
}

const rows = (page: Page) => page.locator('[data-programme-row]')
const stageNames = (page: Page) =>
  page
    .locator('[data-stage-id]')
    .evaluateAll((els) => els.map((el) => el.querySelector('p')?.textContent ?? ''))
const stage = (page: Page, name: string) =>
  page.locator('[data-stage-id]').filter({ has: page.getByText(name, { exact: true }) })
const problemTitles = (page: Page) =>
  page.locator('[data-problem-id] p:first-child').allTextContents()
const eventNames = (page: Page) => page.locator('[data-event-id] p:first-child').allTextContents()
const eventRow = (page: Page, name: string) =>
  page.locator('[data-event-id]').filter({ has: page.getByText(name, { exact: true }) })
const checks = (page: Page) =>
  page
    .locator('[data-check]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-check'), el.getAttribute('data-ok')]),
    )
const card = (page: Page, name: string) => page.locator(`[data-detail="${name}"]`)
const cardItems = (page: Page, name: string) => card(page, name).locator('li').allInnerTexts()
const overview = (page: Page, key: string) =>
  page.locator(`[data-overview="${key}"] p:last-of-type`)

async function addStage(page: Page, name: string, from: string, to: string) {
  await page.locator('[data-action="add-stage"]').click()
  await page.getByLabel('Tên giai đoạn').fill(name)
  await page.getByLabel('Ngày bắt đầu').fill(from)
  await page.getByLabel('Ngày kết thúc').fill(to)
  await page.locator('[data-action="save-stage"]').click()
  await expect(stage(page, name)).toHaveCount(1)
}

async function addEvent(page: Page, name: string, start: string, end: string) {
  await page.locator('[data-action="add-event"]').click()
  await page.getByLabel('Tên sự kiện').fill(name)
  await page.getByLabel('Bắt đầu').fill(start)
  await page.getByLabel('Kết thúc').fill(end)
  await page.locator('[data-action="save-event"]').click()
  await expect(eventRow(page, name)).toHaveCount(1)
}

async function addProblem(page: Page, title: string) {
  await page.locator('[data-action="add-problem"]').click()
  await page.getByLabel('Tên bài toán').fill(title)
  await page.locator('[data-action="save-problem"]').click()
  await expect(page.locator('[data-problem-id]').filter({ hasText: title })).toHaveCount(1)
}

async function next(page: Page, step: (typeof STEPS)[number] | 'detail', id: string) {
  await page.locator('[data-setup-next]').click()
  await expect(page).toHaveURL(step === 'detail' ? detailUrl(id) : stepUrl(id, step))
  await settled(page)
  await expect(page.locator(`[data-screen="${SCREEN[step]}"]`)).toBeVisible()
}

/** Creates a session draft through S02 and returns its id (the page is on S03). */
async function createDraft(
  page: Page,
  v: { type: 'Chương trình' | 'Challenge'; name: string; owner?: string },
) {
  await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
  await page.getByRole('radio', { name: v.type }).check()
  await page.getByLabel('Tên', { exact: true }).fill(v.name)
  if (v.owner) await page.locator('select#pc-owner').selectOption({ label: v.owner })
  await page.locator('[data-demo-save]').click()
  await expect(page).toHaveURL(/\/demo\/programmes\/[0-9a-f-]{36}\/setup\/journey$/)
  await settled(page)
  return page.url().split('/').at(-3)!
}

// ------------------------------------------------------- UAT-WF04-J1 Programme

test.describe('UAT-WF04-J1 Programme happy path', () => {
  test('HP-P01..P23: create → journey → events → registration → team → review → publish → detail → list → reset', async ({
    page,
  }) => {
    const log = journal(page, 'j1')
    const name = 'UAT Chương trình kết nối (demo)'

    // 1. The authorized operator enters the demo from the OpsShell.
    await signIn(page, 'leader@example.test')
    const before = await snapshot()
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    await page.locator('[data-nav="programme-demo"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await expect(rows(page)).toHaveCount(2)
    await log.pass('P01', 'enter /demo/programmes', 'OpsShell entry → S01; 2 fixture rows', true)

    // 2-3. Create a PROGRAMME with its basic information.
    await page.locator('[data-demo-create]').click()
    await expect(page).toHaveURL('/demo/programmes/new')
    await page.getByRole('radio', { name: 'Chương trình' }).check()
    await expect(page.locator('#pc-owner')).toHaveText('Chapter 01')
    await log.pass('P02', 'create PROGRAMME', 'S02; type chosen; owner = Chapter 01 (scope)')
    await page.getByLabel('Tên', { exact: true }).fill(name)
    await page.getByLabel('Tóm tắt').fill('Kết nối các đội dự án với cố vấn.')
    await page.getByLabel('Ngày bắt đầu').fill('2026-10-01')
    await page.getByLabel('Ngày kết thúc').fill('2026-12-31')
    await log.pass('P03', 'basic info', 'name, summary, 01/10/2026 – 31/12/2026', true)

    // 4. Continue to the journey.
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await settled(page)
    const id = page.url().split('/').at(-3)!
    await expect(page.locator('[data-state="flash"]')).toHaveText(`Đã tạo bản nháp “${name}”.`)
    await expect(page.locator('[data-state="stages-empty"]')).toBeVisible()
    await expect(page.locator('[data-journey-problems]')).toHaveCount(0)
    expect((await stored(page, LEADER_ACCOUNT))!.programmes[id]!.programme).toMatchObject({
      status: 'DRAFT',
      type: 'PROGRAMME',
      organization_id: CHAPTER_01,
    })
    await log.pass('P04', 'S02 → S03', 'session DRAFT PROGRAMME; empty journey; no Bài toán')

    // 5. Add, edit and reorder stages.
    await addStage(page, 'Tuyển chọn', '2026-10-01', '2026-10-15')
    await addStage(page, 'Đồng hành', '2026-10-16', '2026-11-30')
    await addStage(page, 'Tổng kết', '2026-12-01', '2026-12-31')
    await stage(page, 'Đồng hành').locator('[data-action="edit"]').click()
    await page.getByLabel('Tên giai đoạn').fill('Đồng hành chuyên sâu')
    await page.getByLabel('Mô tả ngắn').fill('Làm việc cùng cố vấn.')
    await page.locator('[data-action="save-stage"]').click()
    await page.getByRole('button', { name: 'Chuyển “Tổng kết” lên' }).click()
    expect(await stageNames(page)).toEqual(['Tuyển chọn', 'Tổng kết', 'Đồng hành chuyên sâu'])
    await page.getByRole('button', { name: 'Chuyển “Tổng kết” xuống' }).click()
    expect(await stageNames(page)).toEqual(['Tuyển chọn', 'Đồng hành chuyên sâu', 'Tổng kết'])
    await log.pass('P05', 'stages', '3 added, 1 edited, moved up then down', true)

    // 6-7. Events: add two, edit one, remove the other.
    await next(page, 'events', id)
    await expect(page.locator('[data-state="events-empty"]')).toBeVisible()
    await log.pass('P06', 'S03 → S04', 'empty event list')
    await addEvent(page, 'UAT Buổi khai mạc', '2026-10-05T09:00', '2026-10-05T11:00')
    await addEvent(page, 'UAT Buổi nháp', '2026-10-20T14:00', '2026-10-20T16:00')
    await eventRow(page, 'UAT Buổi khai mạc').locator('[data-action="edit"]').click()
    await page.getByLabel('Tên sự kiện').fill('UAT Buổi khai mạc chính thức')
    await page.getByLabel('Địa điểm').fill('Hà Nội')
    await page.locator('[data-action="save-event"]').click()
    await eventRow(page, 'UAT Buổi nháp').locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="yes"]').click()
    expect(await eventNames(page)).toEqual(['UAT Buổi khai mạc chính thức'])
    const events = (await stored(page, LEADER_ACCOUNT))!.programmes[id]!.events
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ programme_id: id, status: 'DRAFT' })
    await log.pass('P07', 'events', '2 added, 1 edited, 1 removed; programme_id = draft id', true)

    // 8-9. Registration configuration.
    await next(page, 'registration', id)
    await expect(page.locator('[data-state="registration-empty"]')).toHaveText(
      'Chưa cấu hình đăng ký.',
    )
    await log.pass('P08', 'S04 → S05', 'not configured')
    await page.locator('[data-action="configure-registration"]').click()
    await page.getByLabel('Cá nhân').check()
    await page.getByLabel('Đội').check()
    await page.locator('[data-action="add-question"]').click()
    await page.getByLabel('Câu hỏi 1', { exact: true }).fill('Bạn mong đợi gì từ chương trình?')
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-state="registration-saved"]')).toHaveText(
      'Đã lưu cấu hình đăng ký.',
    )
    expect(await page.locator('[data-applicant-type]').allTextContents()).toEqual([
      'Cá nhân',
      'Đội',
    ])
    expect(await page.locator('[data-question]').allTextContents()).toEqual([
      'Bạn mong đợi gì từ chương trình?',
    ])
    await log.pass('P09', 'registration', 'Cá nhân + Đội, 1 question; saved', true)

    // 10-11. Operating team: read-only.
    await next(page, 'team', id)
    await log.pass('P10', 'S05 → S06', 'team step')
    await expect(page.locator('[data-state="team-empty"]')).toHaveText(
      'Chưa có thành viên trong đội vận hành.',
    )
    const team = page.locator('[data-screen="WF04-S06"]')
    await expect(team.locator('input, select, textarea')).toHaveCount(0)
    expect(await team.locator('button').allInnerTexts()).toEqual(['Đặt lại demo'])
    await log.pass('P11', 'team read-only', 'no input, no invite / add / remove / role control')

    // 12-13. Review and checklist.
    await next(page, 'review', id)
    await log.pass('P12', 'S06 → S07', 'review step')
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'true'],
    ])
    await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng xuất bản')
    await expect(page.locator('[data-review="problems"]')).toHaveCount(0)
    await log.pass('P13', 'checklist', '4 PROGRAMME items all "Đạt"; no Bài toán item', true)

    // 14-16. Publish → DRAFT → PUBLISHED → detail.
    await page.locator('[data-action="publish"]').click()
    await log.pass('P14', 'publish', '"Xuất bản" clicked once')
    await expect(page).toHaveURL(detailUrl(id))
    expect((await stored(page, LEADER_ACCOUNT))!.programmes[id]!.programme.status).toBe('PUBLISHED')
    await log.pass('P15', 'DRAFT → PUBLISHED', 'session copy status PUBLISHED')
    await expect(page.locator('[data-state="flash"]')).toHaveText(`Đã xuất bản “${name}”.`)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await log.pass('P16', 'S07 → S08', 'detail with one-off confirmation, PUBLISHED', true)

    // 17. Every summary reflects the mutations.
    const summaries = async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
      await expect(overview(page, 'type')).toHaveText('Chương trình')
      await expect(overview(page, 'owner')).toHaveText('Chapter 01')
      await expect(overview(page, 'time')).toHaveText('01/10/2026 – 31/12/2026')
      await expect(overview(page, 'summary')).toHaveText('Kết nối các đội dự án với cố vấn.')
      expect(await cardItems(page, 'journey')).toEqual([
        'Tuyển chọn · 01/10/2026 – 15/10/2026',
        'Đồng hành chuyên sâu · 16/10/2026 – 30/11/2026',
        'Tổng kết · 01/12/2026 – 31/12/2026',
      ])
      expect((await cardItems(page, 'events')).join('\n')).toContain(
        'UAT Buổi khai mạc chính thức · 05/10/2026 · 09:00–11:00',
      )
      await expect(card(page, 'events')).toContainText('1 sự kiện')
      await expect(card(page, 'registration')).toContainText('Cá nhân · Đội · 1 câu hỏi riêng')
      await expect(card(page, 'team')).toContainText('0 thành viên')
      await expect(card(page, 'problems')).toHaveCount(0)
    }
    await summaries()
    await log.pass('P17', 'detail summaries', 'overview, 3 stages, 1 event, registration, team')

    // 18-19. Refresh keeps the session state.
    await page.reload({ waitUntil: 'networkidle' })
    await settled(page)
    await log.pass('P18', 'refresh', 'reload of the detail')
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await expect(page.locator('[data-state="flash"]')).toHaveCount(0)
    await summaries()
    await log.pass('P19', 'state after refresh', 'PUBLISHED, same summaries; flash gone')

    // 20-21. Back to the list.
    await page.locator('[data-nav="detail-back"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await log.pass('P20', 'return to list', '"← Danh sách" → S01')
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator(`[data-programme-row="${id}"] [data-status]`)).toHaveText(
      'Đang công khai',
    )
    await log.pass('P21', 'created row listed', '3 rows; new row "Đang công khai"', true)

    // 22-23. Reset: the draft disappears, the fixtures return.
    await reset(page)
    await log.pass('P22', 'reset', '"Đặt lại demo" confirmed')
    await expect(rows(page)).toHaveCount(2)
    await expect(page.locator(`[data-programme-row="${id}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-programme-row="${PROGRAMME}"] [data-status]`)).toHaveText(
      'Đang công khai',
    )
    await expect(page.locator(`[data-programme-row="${CHALLENGE}"] [data-status]`)).toHaveText(
      'Bản nháp',
    )
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()
    await page.goto(detailUrl(id), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    expect(await snapshot()).toEqual(before)
    await log.pass('P23', 'fixtures return', '2 fixtures, draft gone, store empty, DB unchanged')

    writeJsonReport('WF04-UAT.J1.json', { journey: 'UAT-WF04-J1', steps: log.steps })
    expect(log.steps).toHaveLength(23)
  })
})

// ------------------------------------------------------- UAT-WF04-J2 Challenge

test.describe('UAT-WF04-J2 Challenge happy path', () => {
  test('HP-C01..C16: Challenge with Bài toán, blocked then published, detail, refresh, reset', async ({
    page,
  }) => {
    const log = journal(page, 'j2')
    const name = 'UAT Thử thách số hoá (demo)'

    // 1-2. The platform admin creates a CHALLENGE owned by Chapter 01.
    await signIn(page, 'ops@example.test')
    const before = await snapshot()
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    await page.locator('[data-nav="programme-demo"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await page.locator('[data-demo-create]').click()
    await page.getByRole('radio', { name: 'Challenge' }).check()
    await log.pass('C01', 'create CHALLENGE', 'admin; S01 → S02; type Challenge')
    await page.getByLabel('Tên', { exact: true }).fill(name)
    await page.getByLabel('Tóm tắt').fill('Tìm giải pháp số hoá hồ sơ.')
    await page.getByLabel('Ngày bắt đầu').fill('2026-11-01')
    await page.getByLabel('Ngày kết thúc').fill('2027-01-31')
    await page.locator('select#pc-owner').selectOption({ label: 'Chapter 01' })
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await settled(page)
    const id = page.url().split('/').at(-3)!
    await log.pass('C02', 'basic info', 'name, summary, dates, owner Chapter 01; saved', true)

    // 3-5. Journey with the Challenge-only Bài toán.
    await addStage(page, 'Nhận giải pháp', '2026-11-01', '2026-12-15')
    await log.pass('C03', 'journey', '1 stage')
    await expect(page.locator('[data-journey-problems]')).toBeVisible()
    await expect(page.locator('[data-state="problems-empty"]')).toHaveText('Chưa có bài toán nào.')
    await log.pass('C04', 'Bài toán section', 'shown for CHALLENGE only, empty')
    await addProblem(page, 'Bài toán UAT 1')
    await addProblem(page, 'Bài toán UAT 2')
    await page
      .locator('[data-problem-id]')
      .filter({ hasText: 'Bài toán UAT 2' })
      .locator('[data-action="edit"]')
      .click()
    await page.getByLabel('Tên bài toán').fill('Bài toán UAT 2 (sửa)')
    await page.locator('[data-action="save-problem"]').click()
    expect(await problemTitles(page)).toEqual(['Bài toán UAT 1', 'Bài toán UAT 2 (sửa)'])
    for (let n = 2; n > 0; n--) {
      await page.locator('[data-problem-id] [data-action="remove"]').first().click()
      await page.locator('[data-confirm="yes"]').click()
    }
    await expect(page.locator('[data-state="problems-empty"]')).toBeVisible()
    await log.pass('C05', 'Bài toán add / edit / remove', '2 added, 1 edited, both removed', true)

    // 6-8. Events, registration, team.
    await next(page, 'events', id)
    await addEvent(page, 'UAT Giới thiệu thử thách', '2026-11-05T14:00', '2026-11-05T16:00')
    await log.pass('C06', 'events', '1 event linked to the draft')
    await next(page, 'registration', id)
    await page.locator('[data-action="configure-registration"]').click()
    await page.getByLabel('Startup').check()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-state="registration-saved"]')).toBeVisible()
    await log.pass('C07', 'registration', 'Startup')
    await next(page, 'team', id)
    await expect(page.locator('[data-state="team-empty"]')).toBeVisible()
    await log.pass('C08', 'team', 'read-only, empty')

    // 9-10. Review: blocked while the Challenge has no Bài toán.
    await next(page, 'review', id)
    await log.pass('C09', 'review', 'S06 → S07')
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'true'],
      ['problems', 'false'],
    ])
    await expect(page.locator('[data-readiness]')).toHaveText('Còn thiếu 1 mục')
    await expect(page.locator('[data-action="publish"]')).toBeDisabled()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'incomplete',
    )
    expect((await stored(page, ADMIN_ACCOUNT))!.programmes[id]!.programme.status).toBe('DRAFT')
    await log.pass('C10', 'publish blocked', 'problems "Còn thiếu"; button disabled; DRAFT', true)

    // 11. Satisfy it from the checklist's "Sửa".
    await page.locator('[data-fix="problems"]').click()
    await expect(page).toHaveURL(stepUrl(id, 'journey'))
    await settled(page)
    await addProblem(page, 'Bài toán: số hoá hồ sơ thành viên')
    await page.goto(stepUrl(id, 'review'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng xuất bản')
    await log.pass('C11', 'requirement satisfied', 'fix link → S03; 1 Bài toán; ready')

    // 12-14. Publish → PUBLISHED detail with the Bài toán summary.
    await page.locator('[data-action="publish"]').click()
    await expect(page).toHaveURL(detailUrl(id))
    await log.pass('C12', 'publish', 'S07 → S08')
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await expect(overview(page, 'type')).toHaveText('Challenge')
    await expect(overview(page, 'owner')).toHaveText('Chapter 01')
    await log.pass('C13', 'PUBLISHED detail', 'status band PUBLISHED; type Challenge', true)
    await expect(card(page, 'problems')).toContainText('1 bài toán')
    expect(await cardItems(page, 'problems')).toEqual(['Bài toán: số hoá hồ sơ thành viên'])
    await expect(card(page, 'registration')).toContainText('Startup · 0 câu hỏi riêng')
    await log.pass('C14', 'Bài toán summary', '1 bài toán with its title')

    // 15-16. Refresh, then reset.
    await page.reload({ waitUntil: 'networkidle' })
    await settled(page)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await expect(card(page, 'problems')).toContainText('1 bài toán')
    await log.pass('C15', 'refresh', 'PUBLISHED and Bài toán kept')
    await reset(page)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    expect(await stored(page, ADMIN_ACCOUNT)).toBeNull()
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(2)
    expect(await snapshot()).toEqual(before)
    await log.pass('C16', 'reset', 'draft gone, 2 fixtures, store empty, DB unchanged')

    writeJsonReport('WF04-UAT.J2.json', { journey: 'UAT-WF04-J2', steps: log.steps })
    expect(log.steps).toHaveLength(16)
  })
})

// ------------------------------------------------------- UAT-WF04-J3 keep a draft

test.describe('UAT-WF04-J3 keep a draft', () => {
  test('HP-D01..D05: S02 → S03 → leave at S04 → S01 shows the DRAFT → reopen resumes the saved data', async ({
    page,
  }) => {
    const log = journal(page, 'j3')
    await login(page.request, 'leader@example.test')
    const id = await createDraft(page, { type: 'Chương trình', name: 'Bản nháp để dành (demo)' })
    await addStage(page, 'Chuẩn bị', '2026-10-01', '2026-10-10')
    await log.pass('D01', 'S02 → S03', 'draft created; 1 stage saved')
    await next(page, 'events', id)
    await page.locator('[data-action="add-event"]').click()
    await page.getByLabel('Tên sự kiện').fill('Chưa lưu')
    await log.pass('D02', 'leave at S04', 'an unsaved event editor is left open')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(page.locator(`[data-programme-row="${id}"] [data-status]`)).toHaveText('Bản nháp')
    await log.pass('D03', 'S01 shows the DRAFT', 'row listed as "Bản nháp"')
    await page.locator(`[data-programme-row="${id}"] a`).click()
    await expect(page).toHaveURL(detailUrl(id))
    await settled(page)
    expect(await cardItems(page, 'journey')).toEqual(['Chuẩn bị · 01/10/2026 – 10/10/2026'])
    await expect(card(page, 'events')).toContainText('0 sự kiện')
    await log.pass('D04', 'reopen', 'S08 shows the saved stage; the unsaved event was not stored')
    await page.locator('[data-manage="journey"]').click()
    await expect(page).toHaveURL(stepUrl(id, 'journey'))
    await expect(page.locator('[data-screen="WF04-S03"]')).toBeVisible()
    await expect(stage(page, 'Chuẩn bị')).toHaveCount(1)
    expect(await stageNames(page)).toEqual(['Chuẩn bị'])
    await reset(page)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    await log.pass('D05', 'resume and reset', 'manage → S03 with the saved stage; reset removes it')
    writeJsonReport('WF04-UAT.J3.json', { journey: 'UAT-WF04-J3', steps: log.steps })
  })
})

// ------------------------------------------------------- SEC-WF04-01 matrix

test.describe('SEC-WF04-01 authorization matrix', () => {
  test('6 actors × every WF04 route and API, spoofed headers and orgId; no data change, no leak', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    const label = await person({
      code: 'PROGRAMME_ORGANIZER',
      scopeType: 'PROGRAMME',
      scopeId: CHALLENGE,
    })
    const before = await snapshot()
    const fixtureRoutes = [PROGRAMME, CHALLENGE].flatMap((id) => [
      detailUrl(id),
      ...STEPS.map((s) => stepUrl(id, s)),
    ])
    const pages = ['/demo/programmes', '/demo/programmes/new', ...fixtureRoutes]
    const apis = [API, `${API}/${PROGRAMME}`, `${API}/${CHALLENGE}`]
    const spoof = {
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': CHAPTER_01,
      'x-org-id': CHAPTER_01,
    }
    const q = `?orgId=${CHAPTER_01}&role=PLATFORM_ADMIN`
    type Expect = { page: (url: string) => number; api: (url: string) => number; items?: number }
    const inScope: Expect = { page: () => 200, api: () => 200, items: 2 }
    const denied: Expect = { page: () => 404, api: (u) => (u === API ? 403 : 404) }
    const actors: [string, string | null, Expect][] = [
      ['leader', 'leader@example.test', inScope],
      ['admin', 'ops@example.test', inScope],
      ['member', 'member@example.test', denied],
      ['PROGRAMME_ORGANIZER label only', label.email, denied],
      [
        'foreign leader (Chapter 02)',
        foreign.email,
        {
          page: (u) => (u === '/demo/programmes' || u === '/demo/programmes/new' ? 200 : 404),
          api: (u) => (u === API ? 200 : 404),
          items: 0,
        },
      ],
    ]
    const matrix: {
      actor: string
      call: string
      expected: number | string
      actual: number | string
    }[] = []

    // Guest: every page → /auth, every API → 401.
    for (const url of pages) {
      await page.goto(url + q)
      await expect(page).toHaveURL('/auth')
      matrix.push({ actor: 'guest', call: url, expected: '/auth', actual: '/auth' })
    }
    for (const url of apis) {
      const status = (await page.request.get(url + q, { headers: spoof })).status()
      expect(status, `guest ${url}`).toBe(401)
      matrix.push({ actor: 'guest', call: url, expected: 401, actual: status })
    }

    for (const [actor, email, expected] of actors) {
      await page.context().clearCookies()
      await login(page.request, email!)
      for (const url of pages) {
        const res = await page.request.get(url + q, { headers: spoof })
        expect(res.status(), `${actor} ${url}`).toBe(expected.page(url))
        expect(await res.text(), `${actor} ${url} leak`).not.toMatch(
          /@example\.test|hub_session|30000000-|40000000-/,
        )
        matrix.push({ actor, call: url, expected: expected.page(url), actual: res.status() })
      }
      for (const url of apis) {
        const res = await page.request.get(url + q, { headers: spoof })
        expect(res.status(), `${actor} ${url}`).toBe(expected.api(url))
        const body = await res.text()
        expect(body, `${actor} ${url} leak`).not.toMatch(LEAK)
        if (url === API && res.status() === 200)
          expect((JSON.parse(body) as { items: unknown[] }).items).toHaveLength(expected.items!)
        matrix.push({ actor, call: url, expected: expected.api(url), actual: res.status() })
      }
      // No mutation method exists on the demo API.
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const res = await page.request.fetch(`${API}/${CHALLENGE}`, {
          method,
          headers: spoof,
          data: { status: 'PUBLISHED' },
        })
        expect(res.status(), `${actor} ${method}`).toBeGreaterThanOrEqual(400)
      }
    }
    expect(await snapshot()).toEqual(before)
    writeJsonReport('WF04-SEC-01.matrix.json', { rows: matrix })
    expect(matrix.length).toBe((pages.length + apis.length) * 6)
  })

  test('membership and leadership alone grant no Programme capability', async ({ page }) => {
    // member@ has an ACTIVE Chapter 01 membership; a leadership title without a role grants nothing.
    const [row] = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM community_memberships m
         JOIN individual_profiles p ON p.id = m.profile_id
         JOIN user_accounts a ON a.id = p.account_id
        WHERE a.email_normalized = 'member@example.test' AND m.state = 'ACTIVE'`,
    )
    expect(Number(row!.n)).toBeGreaterThan(0)
    const titled = await person({
      code: 'PROGRAMME_ORGANIZER',
      scopeType: 'PROGRAMME',
      scopeId: PROGRAMME,
    })
    const [profile] = await query<{ id: string }>(
      `SELECT p.id::text FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id WHERE a.email_normalized = $1`,
      [titled.email],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, started_at)
       VALUES ($1, $2, 'Trưởng ban chương trình', 'ACTIVE', now())`,
      [profile!.id, CHAPTER_01],
    )
    try {
      for (const email of ['member@example.test', titled.email]) {
        await page.context().clearCookies()
        await login(page.request, email)
        expect((await page.request.get(API)).status(), email).toBe(403)
        expect((await page.request.get(`${API}/${PROGRAMME}`)).status(), email).toBe(404)
        expect((await page.goto(stepUrl(PROGRAMME, 'review')))?.status(), email).toBe(404)
      }
    } finally {
      await query('DELETE FROM leadership_records WHERE profile_id = $1', [profile!.id])
    }
  })
})

// ------------------------------------------------------- NEG-WF04

test.describe('NEG-WF04 negative / alternate', () => {
  test('NEG-10/11: an invalid type and an invalid applicant type are refused; nothing stored', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByLabel('Tên', { exact: true }).fill('Loại giả')
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('input[name="programme-type"]')!.value = 'SUMMIT'
    })
    await page.getByRole('radio', { name: 'Chương trình' }).click()
    await page.locator('[data-demo-save]').click()
    await expect(page.locator('[data-error="type"]')).toHaveText('Loại không hợp lệ.')
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()

    await page.goto(stepUrl(PROGRAMME, 'registration'), { waitUntil: 'networkidle' })
    await page.locator('[data-action="edit-registration"]').click()
    await page.locator('input[name="applicant-type"][value="INDIVIDUAL"]').evaluate((box) => {
      ;(box as HTMLInputElement).value = 'INVESTOR'
    })
    await page.locator('input[name="applicant-type"][value="INVESTOR"]').click()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-error="applicant_types"]')).toHaveText(
      'Loại người đăng ký không hợp lệ.',
    )
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()
  })

  test('NEG-12/14/15: invalid stage, event date range and registration are refused; nothing stored', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(stepUrl(PROGRAMME, 'journey'), { waitUntil: 'networkidle' })
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('   ')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-error="name"]')).toHaveText('Trường này là bắt buộc.')
    await page.getByLabel('Tên giai đoạn').fill('Đảo ngày')
    await page.getByLabel('Ngày bắt đầu').fill('2026-11-30')
    await page.getByLabel('Ngày kết thúc').fill('2026-10-01')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-error="dates"]')).toHaveText(
      'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
    )
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()

    await page.goto(stepUrl(PROGRAMME, 'events'), { waitUntil: 'networkidle' })
    await page.locator('[data-action="add-event"]').click()
    await page.getByLabel('Tên sự kiện').fill('Sai giờ')
    await page.getByLabel('Bắt đầu').fill('2026-11-20T09:00')
    await page.getByLabel('Kết thúc').fill('2026-11-20T08:00')
    await page.locator('[data-action="save-event"]').click()
    await expect(page.locator('[data-error="dates"]')).toHaveText(
      'Thời điểm kết thúc không được trước thời điểm bắt đầu.',
    )
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()

    await page.goto(stepUrl(PROGRAMME, 'registration'), { waitUntil: 'networkidle' })
    await page.locator('[data-action="edit-registration"]').click()
    await page.locator('[data-action="add-question"]').click()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-error="question-2"]')).toHaveText(
      'Câu hỏi không được để trống.',
    )
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()
  })

  test('NEG-13: an event is never moved to or created for another programme', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(stepUrl(PROGRAMME, 'events'), { waitUntil: 'networkidle' })
    await page.locator('[data-action="add-event"]').click()
    await page.evaluate((spoof) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'programme_id'
      input.value = spoof
      document.querySelector('[data-event-editor]')!.append(input)
    }, CHALLENGE)
    await page.getByLabel('Tên sự kiện').fill('Liên kết giả')
    await page.getByLabel('Bắt đầu').fill('2026-11-20T09:00')
    await page.getByLabel('Kết thúc').fill('2026-11-20T10:00')
    await page.locator('[data-action="save-event"]').click()
    const state = (await stored(page, LEADER_ACCOUNT))!
    expect(Object.keys(state.programmes)).toEqual([PROGRAMME])
    expect(
      state.programmes[PROGRAMME]!.events.find((e) => e.name === 'Liên kết giả'),
    ).toMatchObject({ programme_id: PROGRAMME })
    await page.goto(stepUrl(CHALLENGE, 'events'), { waitUntil: 'networkidle' })
    expect(await eventNames(page)).toEqual(['Giới thiệu bài toán (demo)'])
  })

  test('NEG-16/17: incomplete publish is blocked; a double publish transitions once', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const id = await createDraft(page, { type: 'Challenge', name: 'Thử thách chưa đủ' })
    await page.goto(stepUrl(id, 'review'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-action="publish"]')).toBeDisabled()
    await page.locator('[data-action="publish"]').click({ force: true })
    expect((await stored(page, LEADER_ACCOUNT))!.programmes[id]!.programme.status).toBe('DRAFT')

    await page.goto(stepUrl(CHALLENGE, 'review'), { waitUntil: 'networkidle' })
    await page.locator('[data-action="publish"]').dblclick()
    await expect(page).toHaveURL(detailUrl(CHALLENGE))
    const state = (await stored(page, LEADER_ACCOUNT))!
    expect(state.programmes[CHALLENGE]!.programme.status).toBe('PUBLISHED')
    expect(state.created).toEqual([id])
    await page.goto(stepUrl(CHALLENGE, 'review'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-action="publish"]')).toHaveCount(0)
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
  })

  test('NEG-18: direct load and refresh work on every WF04 route (fixtures and a session draft)', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await login(page.request, 'leader@example.test')
    const draft = await createDraft(page, { type: 'Chương trình', name: 'Bản nháp tải lại' })
    for (const [url, screen] of [
      ['/demo/programmes', 'WF04-S01'],
      ['/demo/programmes/new', 'WF04-S02'],
    ] as const) {
      expect((await page.goto(url, { waitUntil: 'networkidle' }))?.status()).toBe(200)
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible()
    }
    for (const id of [PROGRAMME, CHALLENGE, draft]) {
      for (const [key, url] of [
        ['detail', detailUrl(id)],
        ...STEPS.map((s) => [s, stepUrl(id, s)] as const),
      ] as const) {
        expect((await page.goto(url, { waitUntil: 'networkidle' }))?.status(), url).toBe(200)
        await page.reload({ waitUntil: 'networkidle' })
        await settled(page)
        await expect(page.locator(`[data-screen="${SCREEN[key]}"]`), url).toBeVisible()
        await expect(page.locator('[data-state="setup-missing"]'), url).toHaveCount(0)
        await expect(page.getByRole('heading', { level: 1 }), url).not.toHaveText('Đang tải…')
      }
    }
  })

  test('NEG-19: reset during modified state closes open editors, drops a pending retry and restores the fixtures', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    // A saved stage, then an open editor with unsaved input.
    await page.goto(stepUrl(PROGRAMME, 'journey'), { waitUntil: 'networkidle' })
    await addStage(page, 'Giai đoạn đã lưu', '2026-12-16', '2026-12-20')
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('Giai đoạn chưa lưu')
    await reset(page)
    await expect(page.getByLabel('Tên giai đoạn')).toHaveCount(0)
    expect(await stageNames(page)).toEqual(['Mở đăng ký', 'Ươm tạo', 'Ngày trình diễn'])
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()

    // An open event editor on a fixture event.
    await page.goto(stepUrl(PROGRAMME, 'events'), { waitUntil: 'networkidle' })
    await page.locator('[data-event-id] [data-action="edit"]').first().click()
    await page.getByLabel('Tên sự kiện').fill('Sửa dở')
    await reset(page)
    await expect(page.getByLabel('Tên sự kiện')).toHaveCount(0)
    expect(await eventNames(page)).toEqual(['Ngày trình diễn (demo)', 'Buổi định hướng (demo)'])

    // The basic form shows the restored values.
    await page.goto(stepUrl(PROGRAMME, 'basic'), { waitUntil: 'networkidle' })
    await page.getByLabel('Tên', { exact: true }).fill('Đổi tên dở')
    await reset(page)
    await expect(page.getByLabel('Tên', { exact: true })).toHaveValue('Chương trình ươm tạo (demo)')

    // A failed save's "Thử lại" does not survive the reset.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await page.getByLabel('Tên', { exact: true }).fill('Lưu hỏng')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toBeVisible()
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await reset(page)
    await expect(page.locator('[data-state="save-failed"]')).toHaveCount(0)
    await expect(page.locator('[data-action="retry"]')).toHaveCount(0)
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chương trình ươm tạo (demo)')

    // A created draft disappears while its step is open.
    const draft = await createDraft(page, { type: 'Chương trình', name: 'Bản nháp đặt lại' })
    await page.locator('[data-action="add-stage"]').click()
    await reset(page)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(page.locator(`[data-programme-row="${draft}"]`)).toHaveCount(0)
    await expect(rows(page)).toHaveCount(2)
  })

  test('NEG-20: no public Programme page and no unbuilt demo route', async ({ page }) => {
    for (const url of [
      '/programmes',
      '/programmes/chuong-trinh-uom-tao-demo',
      `/programmes/${PROGRAMME}`,
      '/challenges',
    ])
      expect((await page.request.get(url)).status(), url).toBe(404)
    await page.goto('/demo/programmes')
    await expect(page).toHaveURL('/auth')
    await login(page.request, 'leader@example.test')
    for (const url of [
      '/demo',
      '/demo/programmes/x',
      `/demo/programmes/${PROGRAMME}/manage`,
      `/demo/programmes/${PROGRAMME}/setup`,
      `/demo/programmes/${PROGRAMME}/setup/unknown`,
      `/demo/programmes/${PROGRAMME}/publish`,
    ])
      expect((await page.request.get(url)).status(), url).toBe(404)
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('a[href^="/demo"], a[href^="/programmes"]')).toHaveCount(0)
  })
})

// ------------------------------------------------------- NAV-WF04

test.describe('NAV-WF04 navigation completion', () => {
  test('every control on every route of a session draft leads to a built screen; back works at every step', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await login(page.request, 'leader@example.test')
    const id = await createDraft(page, { type: 'Challenge', name: 'Bản nháp điều hướng' })
    const sources = [
      '/demo/programmes',
      '/demo/programmes/new',
      detailUrl(id),
      ...STEPS.map((s) => stepUrl(id, s)),
    ]
    const targets = new Map<string, string>()
    for (const source of sources) {
      await page.goto(source, { waitUntil: 'networkidle' })
      await settled(page)
      const screen = page.locator('[data-screen]')
      expect(await screen.innerText(), `${source} placeholder`).not.toMatch(PLACEHOLDER)
      const links = await screen
        .locator('a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
      for (const href of links) {
        expect(href, `${source} empty or # link`).toMatch(/^\/[^#]*$/)
        targets.set(href!, source)
      }
      await expect(screen.locator('[data-nav-kind="INERT"]'), source).toHaveCount(0)
    }
    for (const [href, source] of targets) {
      const res = await page.goto(href, { waitUntil: 'networkidle' })
      expect(res?.status(), `${source} → ${href}`).toBe(200)
      await settled(page)
      await expect(page.locator('[data-screen]'), href).toBeVisible()
      await expect(page.locator('[data-state="setup-missing"]'), href).toHaveCount(0)
    }
    writeJsonReport('WF04-NAV.targets.json', {
      draft_routes: sources.length,
      targets: [...targets.keys()],
    })

    // Back at every setup step.
    for (const [from, back, to] of [
      ['basic', 'basic-back', detailUrl(id)],
      ['journey', 'journey-back', '/demo/programmes'],
      ['events', 'events-back', stepUrl(id, 'journey')],
      ['registration', 'registration-back', stepUrl(id, 'events')],
      ['team', 'team-back', stepUrl(id, 'registration')],
      ['review', 'review-back', stepUrl(id, 'team')],
    ] as const) {
      await page.goto(stepUrl(id, from), { waitUntil: 'networkidle' })
      await page.locator(`[data-nav="${back}"]`).click()
      await expect(page, from).toHaveURL(to)
    }
    await page.goto(detailUrl(id), { waitUntil: 'networkidle' })
    await page.locator('[data-nav="detail-back"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.locator('[data-nav="programme-cancel"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    // Forward: S01 → S08 by the row; the rest of the chain is walked by J1 / J2.
    await page.locator(`[data-programme-row="${id}"] a`).click()
    await expect(page).toHaveURL(detailUrl(id))
  })
})

// ------------------------------------------------------- EVT-WF04

test.describe('EVT-WF04 Event boundary', () => {
  test('demo events live only in the session, linked to their programme; WF03 events and APIs never see them', async ({
    page,
  }) => {
    const beforeRows = await query<{ id: string; programme_id: string | null }>(
      `SELECT id::text, programme_id::text FROM events ORDER BY id`,
    )
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await page.goto(stepUrl(PROGRAMME, 'events'), { waitUntil: 'networkidle' })
    await addEvent(page, 'EVT ranh giới (demo)', '2026-10-10T09:00', '2026-10-10T10:00')
    await eventRow(page, 'Buổi định hướng (demo)').locator('[data-action="edit"]').click()
    await page.getByLabel('Tên sự kiện').fill('Buổi định hướng sửa (demo)')
    await page.locator('[data-action="save-event"]').click()
    const session = (await stored(page, LEADER_ACCOUNT))!.programmes[PROGRAMME]!.events
    for (const e of session) expect(e.programme_id).toBe(PROGRAMME)
    for (const d of DEMO_PROGRAMMES)
      for (const e of d.events) expect(e.programme_id).toBe(d.programme.id)
    const demoIds = [
      ...new Set([...DEMO_PROGRAMMES.flatMap((d) => d.events), ...session].map((e) => e.id)),
    ]
    const demoNames = [
      'EVT ranh giới (demo)',
      'Buổi định hướng sửa (demo)',
      'Buổi định hướng (demo)',
    ]

    // Database: no demo event row; WF03 rows unchanged; standalone events stay unlinked.
    expect(await query(`SELECT id FROM events WHERE id = ANY($1::uuid[])`, [demoIds])).toEqual([])
    expect(
      await query<{ id: string; programme_id: string | null }>(
        `SELECT id::text, programme_id::text FROM events ORDER BY id`,
      ),
    ).toEqual(beforeRows)
    const [linked] = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM events WHERE programme_id::text LIKE 'd4%'`,
    )
    expect(linked!.n).toBe('0')

    // WF03 ops API, event APIs and the public page never carry a demo event.
    const opsList = await page.request.get(`/api/v1/ops/organizations/${CHAPTER_01}/events`)
    expect(opsList.status()).toBe(200)
    const opsBody = await opsList.text()
    for (const value of [...demoIds, ...demoNames]) expect(opsBody).not.toContain(value)
    for (const item of (JSON.parse(opsBody) as { items: { programme_id?: string | null }[] }).items)
      expect(item.programme_id ?? null).toBeNull()
    for (const eventId of demoIds) {
      expect((await page.request.get(`/api/v1/events/${eventId}`)).status()).toBe(404)
      // The WF03 mutation route treats a demo id as unknown (and changes nothing).
      expect(
        (
          await page.request.patch(`/api/v1/ops/events/${eventId}`, { data: { name: 'x' } })
        ).status(),
      ).toBe(404)
    }
    await page.goto(`/ops/org/${CHAPTER_01}/events`, { waitUntil: 'networkidle' })
    for (const n of demoNames) await expect(page.locator('main')).not.toContainText(n)
    const publicPage = await (await page.request.get('/organizations/chapter-01')).text()
    for (const n of demoNames) expect(publicPage).not.toContain(n)
    expect(await snapshot()).toEqual(before)
  })
})

// ------------------------------------------------------- VIS-WF04

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

test.describe('VIS-WF04 visual completion (approved primitives; no WF04 bitmap)', () => {
  test('11 screens at 1440×900: typography and header primitives; 768 / 390: no overflow, key action reachable', async ({
    page,
  }) => {
    test.setTimeout(420_000)
    await login(page.request, 'leader@example.test')
    const adm5 = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const results: SegmentResult[] = []
    let checked = 0
    const screens: { name: string; url: string; key: string; prepare?: () => Promise<void> }[] = [
      { name: 's01-populated', url: '/demo/programmes', key: '[data-demo-create]' },
      {
        name: 's02-filled',
        url: '/demo/programmes/new',
        key: '[data-demo-save]',
        prepare: async () => {
          await page.getByRole('radio', { name: 'Challenge' }).check()
          await page.getByLabel('Tên', { exact: true }).fill('Thử thách kết nối doanh nghiệp')
          await page.getByLabel('Tóm tắt').fill('Tìm giải pháp cho bài toán của đơn vị.')
          await page.getByLabel('Ngày bắt đầu').fill('2026-11-01')
          await page.getByLabel('Ngày kết thúc').fill('2027-01-31')
        },
      },
      {
        name: 's03-programme',
        url: stepUrl(PROGRAMME, 'journey'),
        key: '[data-action="add-stage"]',
      },
      {
        name: 's03-challenge',
        url: stepUrl(CHALLENGE, 'journey'),
        key: '[data-action="add-problem"]',
      },
      { name: 's04-events', url: stepUrl(PROGRAMME, 'events'), key: '[data-action="add-event"]' },
      {
        name: 's05-registration',
        url: stepUrl(PROGRAMME, 'registration'),
        key: '[data-action="edit-registration"]',
      },
      { name: 's06-team', url: stepUrl(PROGRAMME, 'team'), key: '[data-setup-next]' },
      { name: 's07-ready', url: stepUrl(CHALLENGE, 'review'), key: '[data-action="publish"]' },
      {
        name: 's07-published',
        url: stepUrl(CHALLENGE, 'review'),
        key: '[data-nav="review-detail"]',
        prepare: async () => {
          await page.locator('[data-action="publish"]').click()
          await expect(page).toHaveURL(detailUrl(CHALLENGE))
          await page.goto(stepUrl(CHALLENGE, 'review'), { waitUntil: 'networkidle' })
          await settled(page)
        },
      },
      { name: 's08-programme', url: detailUrl(PROGRAMME), key: '[data-nav="detail-review"]' },
      { name: 's08-challenge', url: detailUrl(CHALLENGE), key: '[data-manage="basic"]' },
    ]
    for (const s of screens) {
      await page.goto(s.url, { waitUntil: 'networkidle' })
      await settled(page)
      if (s.prepare) await s.prepare()
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, s.name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf04-completion-${s.name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf04-completion-${s.name}-full.png`),
        fullPage: true,
      })
      results.push(
        ...compareSegments(
          adm5,
          decodePng(await page.screenshot()),
          [
            {
              name: `${s.name}-header-band`,
              reference: { x: 500, y: 4, width: 600, height: 66 },
              dy: 0,
            },
            {
              name: `${s.name}-header-rule`,
              reference: { x: 500, y: 72, width: 600, height: 6 },
              dy: 0,
            },
          ],
          await textRects(page),
          { diffPath: resolveOutputPath('diff', `WF04-COMPLETION.${s.name}.diff.png`) },
        ),
      )
    }

    const responsive: { width: number; screen: string; overflow: number }[] = []
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const s of screens) {
        if (s.name === 's07-ready') continue // the Challenge is PUBLISHED by now
        await page.goto(s.url, { waitUntil: 'networkidle' })
        await settled(page)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(overflow, `${s.name} ${width}px overflow`).toBe(0)
        const key = page.locator(s.key).first()
        await key.scrollIntoViewIfNeeded()
        await expect(key, `${s.name} ${width}px key action`).toBeInViewport()
        await page.screenshot({
          path: path.join(ACTUAL, `wf04-completion-${s.name}-${width}.png`),
          fullPage: true,
        })
        responsive.push({ width, screen: s.name, overflow })
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await reset(page)

    writeJsonReport('WF04-COMPLETION.visual.json', {
      screens: screens.map((s) => s.name),
      references: ['WF03-S05 ADM5 full (header band, rule)'],
      approved_wf04_bitmap: null,
      typography_checked: checked,
      segments: results,
      responsive,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
