import path from 'node:path'

import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

import { onboardThroughUi } from '../support/onboarding'
import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { seedVenture } from '../../../src/lib/venture/testing'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF05 closing gate (PROCESS-P0-ACCELERATED-SAFE-V2 §I), realigned by TASK
 * 24.4 (DEC-L5): the application lives on the server and its screens are the
 * L5 member routes. HC-WF05 journeys (a PROJECT and a STARTUP owner signed in
 * through the real magic link and WF01 onboarding, entering from MemberShell),
 * canonical reuse (a WF02 rename), reset; SEC-WF05-01 (8 actors × every WF05 /
 * L5 route and API, spoofed, and the application writes); NEG-WF05;
 * SERVER-WF05; NAV-WF05; VIS-WF05 / COPY-WF05. Every phase is bracketed by
 * row-exact hashes of every table in the schema: only an application step may
 * write, and only the application, its audit events and its idempotency keys.
 * WF01 / WF02 setup writes happen outside the brackets, through their own
 * workflows. Screen-level cases stay in each WF05 spec and the L5 spec.
 */

const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const API = '/api/v1/demo/projects'
const APPS = '/api/v1/applications'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const Q1 = 'Dự án của bạn giải quyết vấn đề gì?'
const Q2 = 'Bạn cần chương trình hỗ trợ điều gì?'
const PROGRAMME_NAME = 'Chương trình ươm tạo (demo)'
const PLACEHOLDER = /\bTODO\b|FIXME|lorem ipsum|\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/i
const LEAK = /@example\.test|hub_session|\btoken\b|\bcookie\b|30000000-|40000000-/i
/** Technical words, and outcomes no WF05 source supports. */
const COPY_BANNED =
  /fixture|\bmock\b|sessionStorage|localStorage|\bDTO\b|canonical|\benum\b|owner_profile_id|profile_id|account_id|\bAPI\b|\bJSON\b|approved|accepted|under review|matched|recommended|đã duyệt|phê duyệt|chấp nhận|đang xem xét|trúng tuyển|được chọn|đề xuất|xếp hạng|điểm số|kết quả/i
/** Written by a sign-in (WF01) only; a bracket that signs someone in may change these, WF05 never. */
const SIGN_IN_TABLES = ['auth_magic_link_requests', 'user_sessions']
/** Written by an application step only (DEC-L5-D2 / D3); nothing else in WF05 writes. */
const APPLICATION_TABLES = ['applications', 'audit_events', 'idempotency_keys']

const detailUrl = (id: string) => `/demo/projects/${id}`
const formUrl = (id: string, programme = PROGRAMME) => `/projects/${id}/applications/${programme}`
const reviewUrl = (id: string, programme = PROGRAMME) => `${formUrl(id, programme)}/review`
const submittedUrl = (id: string) => `${formUrl(id)}/submitted`
/** The WF05-S03 path, a redirect since TASK 24.4 (HD-A10). */
const oldFormUrl = (id: string) => `/demo/projects/${id}/applications/${PROGRAMME}`

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
  const owned = `(SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
                   WHERE i.account_id = ANY($1::uuid[]))`
  await query(`DELETE FROM applications WHERE venture_id IN ${owned}`, [accounts])
  await query(`DELETE FROM project_members WHERE project_id IN ${owned}`, [accounts])
  await query(
    `DELETE FROM projects WHERE owner_profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await closePool()
})

// ------------------------------------------------------------------ helpers

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

const newEmail = (tag: string) =>
  `wf05-uat-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`

/** The real WF01 path: /auth → check email → the magic link. */
async function signIn(page: Page, email: string) {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
}

/** ACC-05 → ACC-10 → /me through the screens (DEC-L1R). */
const onboard = onboardThroughUi

async function accountOf(email: string): Promise<Person> {
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
      WHERE a.email_normalized = $1`,
    [email],
  )
  accounts.push(row!.account_id)
  return { accountId: row!.account_id, profileId: row!.profile_id, email }
}

async function person(name: string): Promise<Person> {
  const email = newEmail('p')
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

/** Owner with a STARTUP (ACTIVE member labelled "Founder", pending invitee), a PROJECT, an archived one; a stranger's venture. */
async function world() {
  const owner = await person('Chủ Hồ Sơ')
  const teammate = await person('Thành Viên')
  const invitee = await person('Được Mời')
  const stranger = await person('Người Ngoài')
  const startup = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Startup UAT' })
  const project = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án UAT' })
  const archived = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ UAT' })
  const foreign = await seedVenture(stranger.accountId, { type: 'STARTUP', name: 'Ngoài UAT' })
  await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [startup.id])
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived.id])
  // The "Founder" label on an ACTIVE member grants nothing (membership ≠ ownership).
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
     VALUES ($1, $2, 'Founder', 'ACTIVE', now())`,
    [startup.id, teammate.profileId],
  )
  await query(
    `INSERT INTO project_members (project_id, invite_email_normalized, role_label, state, invited_at, invited_by_profile_id, joined_at)
     VALUES ($1, $2, 'Cố vấn', 'PENDING_CONFIRMATION', now(), $3, NULL)`,
    [startup.id, invitee.email, owner.profileId],
  )
  return { owner, teammate, invitee, stranger, startup, project, archived, foreign }
}

/** Row-exact hash and row count of every base table in the schema. */
async function tables(): Promise<Record<string, string>> {
  const names = await query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`,
  )
  const out: Record<string, string> = {}
  for (const { name } of names) {
    const [row] = await query<{ h: string; n: string }>(
      `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS h, count(*)::text AS n
         FROM "${name}" t`,
    )
    out[name] = `${row!.n}:${row!.h}`
  }
  return out
}

/**
 * Tables that differ between two snapshots. Strict (no table at all) unless the
 * bracket signs someone in (the WF01 sign-in tables) or takes an application
 * step (the application tables).
 */
function expectNoWrites(
  before: Record<string, string>,
  after: Record<string, string>,
  { signIns = false, applications = false } = {},
) {
  expect(Object.keys(after)).toEqual(Object.keys(before))
  const allowed = [...(signIns ? SIGN_IN_TABLES : []), ...(applications ? APPLICATION_TABLES : [])]
  const changed = Object.keys(before).filter((t) => before[t] !== after[t])
  expect(
    changed.filter((t) => !allowed.includes(t)),
    'tables written',
  ).toEqual([])
  return changed
}

type Answer = { question_id: string; value: string }
type ApplicationRow = {
  id: string
  venture_id: string
  programme_id: string
  status: string
  type: string
  answers: Answer[]
  created_at: string
  submitted_at: string | null
  snapshot: {
    venture: { id: string; name: string }
    answers: Answer[]
    programme: { id: string; name: string }
  } | null
}

/** The server applications of these ventures, oldest first. */
function applicationsOf(ventureIds: string[]) {
  return query<ApplicationRow>(
    `SELECT id::text, venture_id::text, programme_id::text, status::text,
            primary_applicant_type::text AS type, answers, created_at::text,
            submitted_at::text, snapshot
       FROM applications WHERE venture_id = ANY($1::uuid[]) ORDER BY created_at`,
    [ventureIds],
  )
}

async function auditOf(resourceId: string) {
  const rows = await query<{ action: string }>(
    `SELECT action FROM audit_events WHERE resource_id::text = $1 ORDER BY created_at`,
    [resourceId],
  )
  return rows.map((r) => r.action)
}

const answersOf = (a0: string, a1: string): Answer[] => [
  { question_id: 'q-problem', value: a0 },
  { question_id: 'q-support', value: a1 },
]

/** A DRAFT through the L5 API (the owner's request), with its answers when given. */
async function draft(request: APIRequestContext, ventureId: string, answers?: [string, string]) {
  const created = await request.post(APPS, {
    data: { venture_id: ventureId, programme_id: PROGRAMME },
  })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: string }
  if (answers)
    expect(
      (await request.patch(`${APPS}/${id}`, { data: { answers: answersOf(...answers) } })).status(),
    ).toBe(200)
  return id
}

async function submit(request: APIRequestContext, id: string) {
  expect((await request.post(`${APPS}/${id}/submit`)).status()).toBe(200)
}

async function errorCode(response: APIResponse) {
  const body = (await response.json()) as { error?: { code: string } }
  return `${response.status()} ${body.error?.code ?? ''}`.trim()
}

async function settled(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'networkidle' })
  await expect(
    page.locator('[data-state="projects-loading"], [data-state="detail-loading"]'),
  ).toHaveCount(0)
  return response
}

async function reset(page: Page) {
  await page.locator('[data-demo-reset="start"]').click()
  await page.locator('[data-demo-reset="confirm"]').click()
}

function journal(name: string) {
  const steps: { id: string; check: string; url: string }[] = []
  return {
    step: (page: Page, id: string, check: string) =>
      steps.push({ id, check, url: new URL(page.url()).pathname }),
    write: (extra: Record<string, unknown> = {}) =>
      writeJsonReport(`WF05-UAT.${name}.json`, { journey: name, steps, ...extra }),
  }
}

const answer = (page: Page, question: 'q-problem' | 'q-support') => page.locator(`#q-${question}`)
const screenState = (page: Page, screen: string) => page.locator(`[data-screen="${screen}"]`)
const formStep = (page: Page) => screenState(page, 'L5-SUB1')

// ------------------------------------------------------------ HC journeys

type Kind = { type: 'PROJECT' | 'STARTUP'; label: string; stored: string }
const KINDS: Record<'PROJECT' | 'STARTUP', Kind> = {
  PROJECT: { type: 'PROJECT', label: 'Dự án', stored: 'TEAM' },
  STARTUP: { type: 'STARTUP', label: 'Startup', stored: 'STARTUP' },
}

/** HC-WF05-01 / 02: sign-in → onboarding → MemberShell → S01 → WF02 create → S01 → S02 → L5 form → review → SUBMITTED. */
async function ownerJourney(page: Page, kind: Kind, id: string) {
  const log = journal(id)
  const email = newEmail(kind.type.toLowerCase())
  const name = `${kind.label} Nông Sản ${id}`
  const a0 = 'Kết nối nông hộ với người mua.'
  const a1 = 'Cố vấn thị trường và pháp lý.'

  // Sign-in and onboarding through WF01; MemberShell entry.
  await signIn(page, email)
  await onboard(page, `Chủ ${kind.label}`)
  const me = await accountOf(email)
  // DEC-L2R-D1: /me (FP1-OWN) leads to /projects, whose sidebar holds the demo entry.
  await page.locator('[data-nav="projects"]').click()
  await expect(page).toHaveURL('/projects')
  await page.locator('[data-nav="project-demo"]').click()
  await expect(page).toHaveURL('/demo/projects')
  await expect(page.locator('[data-state="ventures-empty"]')).toHaveText(
    'Bạn chưa có dự án hay startup nào.',
  )
  await expect(page.locator('[data-section="programmes"] [data-programme]')).toHaveCount(1)
  await expect(page.locator(`[data-programme="${PROGRAMME}"]`)).toContainText(PROGRAMME_NAME)
  log.step(
    page,
    'HP-01',
    'MemberShell "Dự án & Startup · Demo" → S01: no venture, the PUBLISHED programme only',
  )

  // The canonical venture is created in WF02, then WF05 is entered again from MemberShell.
  await page.locator('[data-nav="create-project"]').click()
  await expect(page).toHaveURL('/projects/new')
  await page
    .getByRole('radio', { name: kind.type === 'PROJECT' ? 'Dự án / ý tưởng' : 'Startup' })
    .check()
  await page.locator('#ve-name').fill(name)
  // DEC-L2R-D4: field, description and stage are required.
  const picker = page.locator('[aria-controls="ve-domain-list"]')
  await picker.click()
  await page.getByRole('button', { name: 'Công nghệ khu vực công', exact: true }).click()
  await picker.click()
  await page.locator('#ve-summary').fill('Kết nối nông hộ với người mua.')
  await page.getByRole('radio', { name: 'Ý tưởng', exact: true }).check({ force: true })
  await page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' }).click()
  await expect(page).toHaveURL(/\/projects\/new\?venture=[0-9a-f-]{36}&step=team$/)
  const ventureId = new URL(page.url()).searchParams.get('venture')!
  await page.locator('[data-nav="wizard-exit"]').click()
  await expect(page).toHaveURL('/projects')
  log.step(
    page,
    'HP-02',
    `S01 "+ Tạo dự án / startup" → WF02 create ${kind.type} → back to MemberShell`,
  )

  const before = await tables()
  await page.locator('[data-nav="project-demo"]').click()
  await expect(page).toHaveURL('/demo/projects')
  const row = page.locator(`[data-venture="${ventureId}"]`)
  await expect(row).toContainText(name)
  await expect(row).toContainText(kind.label)
  log.step(page, 'HP-03', 'S01 lists the canonical venture (owner)')

  await row.locator('[data-nav="venture-detail"]').click()
  await expect(page).toHaveURL(detailUrl(ventureId))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  const participation = page.locator(`[data-programme="${PROGRAMME}"]`)
  await expect(participation.locator('[data-action="apply"]')).toHaveText('Đăng ký')
  log.step(page, 'HP-04', 'S01 → S02: detail, P1 eligible, "Đăng ký"')

  await participation.locator('[data-action="apply"]').click()
  await expect(page).toHaveURL(formUrl(ventureId))
  await expect(formStep(page)).toHaveAttribute('data-step', '1')
  await expect(page.locator('label[for="q-q-problem"]')).toContainText(Q1)
  await expect(page.locator('[data-save-state]')).toHaveText('Chưa lưu')
  expect(await applicationsOf([ventureId])).toEqual([])
  log.step(page, 'HP-05', 'S02 "Đăng ký" → L5 form, step 01; opening it writes nothing')

  await answer(page, 'q-problem').fill(a0)
  await page.locator('[data-action="next"]').click()
  await expect(formStep(page)).toHaveAttribute('data-step', '3')
  await expect(page).toHaveURL(`${formUrl(ventureId)}?buoc=3`)
  const [draftRow, ...others] = await applicationsOf([ventureId])
  expect(others).toEqual([])
  expect(draftRow).toMatchObject({
    programme_id: PROGRAMME,
    status: 'DRAFT',
    type: kind.stored,
    // An empty answer is not stored (DEC-L5-D3).
    answers: [{ question_id: 'q-problem', value: a0 }],
    submitted_at: null,
    snapshot: null,
  })
  log.step(page, 'HP-06', `Leaving step 01 saves one DRAFT on the server as ${kind.stored}`)

  await page.locator('[data-action="next"]').click()
  await expect(formStep(page)).toHaveAttribute('data-step', '4')
  await expect(page.locator('label[for="q-q-support"]')).toContainText(Q2)
  await answer(page, 'q-support').fill(a1)
  await answer(page, 'q-support').blur()
  await expect(page.locator('[data-save-state="idle"]')).toHaveText(/^Đã lưu lúc \d\d:\d\d$/)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(formStep(page)).toHaveAttribute('data-step', '4')
  await expect(answer(page, 'q-support')).toHaveValue(a1)
  log.step(page, 'HP-07', 'Leaving a field saves; refresh resumes step 04 with its answer')

  await page.locator('[data-action="to-review"]').click()
  await expect(page).toHaveURL(reviewUrl(ventureId))
  await expect(page.locator('[data-question="q-problem"]')).toContainText(Q1)
  await expect(page.locator('[data-question="q-problem"]')).toContainText(a0)
  await expect(page.locator('[data-question="q-support"]')).toContainText(a1)
  await expect(page.locator('[data-anchor="attached"]')).toContainText(name)
  await expect(page.locator('[data-anchor="readiness"]')).toHaveText('Đủ điều kiện nộp')
  log.step(page, 'HP-08', '"Soát lại trước khi nộp" → review: both answers, the venture attached')

  await page.locator('[data-action="submit"]').dblclick()
  await expect(page).toHaveURL(submittedUrl(ventureId))
  await expect(screenState(page, 'L5-SUB3')).toBeVisible()
  const [done, ...more] = await applicationsOf([ventureId])
  expect(more).toEqual([])
  expect(done).toMatchObject({
    id: draftRow!.id,
    status: 'SUBMITTED',
    answers: answersOf(a0, a1),
    created_at: draftRow!.created_at,
  })
  expect(done!.snapshot).toMatchObject({
    venture: { id: ventureId, name },
    answers: answersOf(a0, a1),
    programme: { id: PROGRAMME, name: PROGRAMME_NAME },
  })
  expect(await auditOf(done!.id)).toEqual(['APPLICATION_DRAFT_CREATED', 'APPLICATION_SUBMITTED'])
  log.step(page, 'HP-09', 'Double-click "Nộp hồ sơ": DRAFT → SUBMITTED once; one audit each')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(screenState(page, 'L5-SUB3')).toBeVisible()
  await expect(page.locator('textarea, [data-action="submit"]')).toHaveCount(0)
  for (const url of [formUrl(ventureId), reviewUrl(ventureId), oldFormUrl(ventureId)]) {
    await page.goto(url, { waitUntil: 'networkidle' })
    await expect(page, url).toHaveURL(submittedUrl(ventureId))
  }
  log.step(page, 'HP-10', 'Refresh: still SUBMITTED, read only; the form and review open it')

  await settled(page, detailUrl(ventureId))
  await expect(participation.locator('[data-application]')).toHaveText('Đã nộp')
  await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
  await expect(participation.locator('[data-nav="application-view"]')).toHaveAttribute(
    'href',
    submittedUrl(ventureId),
  )
  await page.locator('[data-nav="detail-back"]').click()
  await expect(page).toHaveURL('/demo/projects')
  await expect(row.locator('[data-venture-applications]')).toHaveText(
    `Đơn đăng ký: ${PROGRAMME_NAME} · Đã nộp`,
  )
  log.step(page, 'HP-11', 'S02 "Đã nộp", no second "Đăng ký" → S01 "Đã nộp"')

  const [{ n }] = (await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1`,
    [me.profileId],
  )) as [{ n: number }]
  expect(n).toBe(1)
  const changed = expectNoWrites(before, await tables(), { applications: true })
  log.step(page, 'HP-12', '1 canonical venture; only the application tables written')
  log.write({ type: kind.type, applicant: kind.stored, tables_changed: changed })
}

test.describe('HC-WF05-01 / 02 owner journeys', () => {
  test('HC-WF05-01 PROJECT owner: magic link → onboarding → MemberShell → S01 → WF02 → S02 → L5 form (TEAM) → review → SUBMITTED', async ({
    page,
  }) => {
    await ownerJourney(page, KINDS.PROJECT, 'HC01')
  })

  test('HC-WF05-02 STARTUP owner: the same journey; STARTUP → STARTUP', async ({ page }) => {
    await ownerJourney(page, KINDS.STARTUP, 'HC02')
  })
})

test.describe('HC-WF05-03 canonical reuse', () => {
  test('a WF02 rename shows on S01, S02 and the review; the DRAFT references the venture, no copy', async ({
    page,
  }) => {
    const log = journal('HC03')
    const w = await world()
    await login(page.request, w.owner.email)
    await draft(page.request, w.startup.id, ['Giữ nguyên câu trả lời', ''])
    const [kept] = await applicationsOf([w.startup.id])
    log.step(page, 'CR-01', 'A DRAFT for the STARTUP')

    // WF02 edit through S02 "Sửa hồ sơ" (the WF02 write, outside the WF05 bracket).
    await settled(page, detailUrl(w.startup.id))
    await page.locator('[data-nav="venture-edit"]').click()
    await expect(page).toHaveURL(`/projects/${w.startup.id}/edit`)
    await page.locator('#ve-name').fill('Startup UAT đổi tên')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('[data-status]')).toContainText('đã lưu lúc')
    await page.locator('[data-nav="editor-back"]').click()
    log.step(page, 'CR-02', 'S02 "Sửa hồ sơ" → WF02 rename → back')

    const before = await tables()
    await page.locator('[data-nav="projects"]').click()
    await page.locator('[data-nav="project-demo"]').click()
    await expect(page.locator(`[data-venture="${w.startup.id}"]`)).toContainText(
      'Startup UAT đổi tên',
    )
    await page.locator(`[data-venture="${w.startup.id}"] [data-nav="venture-detail"]`).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Startup UAT đổi tên')
    await page.locator('[data-nav="application-resume"]').click()
    await expect(page).toHaveURL(formUrl(w.startup.id))
    await expect(formStep(page)).toBeVisible()
    await settled(page, reviewUrl(w.startup.id))
    await expect(page.locator('[data-anchor="attached"]')).toContainText('Startup UAT đổi tên')
    log.step(page, 'CR-03', 'S01, S02 and the review show the new name')

    expect(await applicationsOf([w.startup.id])).toEqual([kept])
    const names = await query<{ name: string }>(
      `SELECT name FROM projects WHERE owner_profile_id = $1 ORDER BY name`,
      [w.owner.profileId],
    )
    expect(names.map((r) => r.name)).toEqual(['Dự án UAT', 'Lưu trữ UAT', 'Startup UAT đổi tên'])
    const changed = expectNoWrites(before, await tables())
    log.step(page, 'CR-04', 'DRAFT row identical; one record per venture; 0 table writes')
    log.write({ tables_changed: changed })
  })
})

test.describe('HC-WF05-04 reset', () => {
  test('reset after DRAFT and after SUBMITTED leaves the server applications (HD-A10); canonical and WF04 data unchanged', async ({
    page,
  }) => {
    const log = journal('HC04')
    const w = await world()
    await login(page.request, w.owner.email)
    await draft(page.request, w.project.id, ['Nháp vẫn còn', ''])
    const sent = await draft(page.request, w.startup.id, ['Một', 'Hai'])
    await submit(page.request, sent)
    const kept = await applicationsOf([w.project.id, w.startup.id])
    const before = await tables()
    const programmes = await (await page.request.get(API)).json()
    await settled(page, '/demo/projects')
    await reset(page)
    await expect(page.locator('[data-demo-notice]')).toContainText('Đã đặt lại dữ liệu demo.')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(
      page.locator(`[data-venture="${w.project.id}"] [data-venture-applications]`),
    ).toHaveText(`Đơn đăng ký: ${PROGRAMME_NAME} · Nháp`)
    await expect(
      page.locator(`[data-venture="${w.startup.id}"] [data-venture-applications]`),
    ).toHaveText(`Đơn đăng ký: ${PROGRAMME_NAME} · Đã nộp`)
    log.step(page, 'RS-01', 'Reset on S01: the DRAFT and the SUBMITTED application stay')

    await settled(page, detailUrl(w.startup.id))
    await reset(page)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-nav="application-view"]')).toHaveCount(1)
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    log.step(page, 'RS-02', 'Reset on S02: still "Đã nộp", no second "Đăng ký"')

    expect(await applicationsOf([w.project.id, w.startup.id])).toEqual(kept)
    expect(await (await page.request.get(API)).json()).toEqual(programmes)
    const changed = expectNoWrites(before, await tables())
    log.step(page, 'RS-03', 'Applications, ventures, members, profiles, programmes: unchanged')
    log.write({ tables_changed: changed })
  })
})

// --------------------------------------------------------------- SEC matrix

test.describe('SEC-WF05-01 authorization matrix', () => {
  test('8 actors × 6 WF05 / L5 routes + 4 APIs + 3 writes, plain and spoofed; relation from the server only; no write, no leak', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const own = await draft(page.request, w.startup.id, ['Một', ''])
    await page.context().clearCookies()
    const before = await tables()
    const spoofs = {
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': '10000000-0000-0000-0000-000000000101',
      'x-owner-profile-id': w.owner.profileId,
      'x-profile-id': w.owner.profileId,
      'x-account-id': w.owner.accountId,
    }
    const q = `?owner_profile_id=${w.owner.profileId}&profile_id=${w.owner.profileId}&account_id=${w.owner.accountId}&orgId=10000000-0000-0000-0000-000000000101&role=OWNER&role_label=Founder`
    const pages = [
      '/demo/projects',
      detailUrl(w.startup.id),
      formUrl(w.startup.id),
      reviewUrl(w.startup.id),
      submittedUrl(w.startup.id),
      oldFormUrl(w.startup.id),
    ]
    const apis = [API, `${API}/${w.startup.id}`, '/api/v1/me/applications', `${APPS}/${own}`]
    const secrets = [
      w.owner.email,
      w.owner.accountId,
      w.owner.profileId,
      w.teammate.email,
      w.teammate.accountId,
      w.teammate.profileId,
      w.invitee.email,
    ]
    type Row = { actor: string; pages: string[]; apis: number[]; writes: string[] }
    const matrix: Row[] = []
    const run = async (
      actor: string,
      expectPages: string[],
      expectApis: number[],
      expectWrites: string[] | null,
    ) => {
      const got: string[] = []
      for (const url of pages) {
        for (const [suffix, headers] of [
          ['', {}],
          [q, spoofs],
        ] as const) {
          const r = await page.request.get(url + suffix, { headers })
          const path = new URL(r.url()).pathname
          const outcome =
            r.status() === 200 && path.startsWith('/auth')
              ? 'auth'
              : r.status() === 200 && path.startsWith('/onboarding')
                ? 'onboarding'
                : String(r.status())
          if (suffix) expect(outcome, `${actor} ${url} spoofed`).toBe(got[got.length - 1])
          else got.push(outcome)
          // A spoofed request echoes its own query in the route payload; check the plain one.
          if (!suffix) {
            const body = await r.text()
            for (const s of secrets) expect(body, `${actor} ${url}`).not.toContain(s)
          }
        }
      }
      expect(got, actor).toEqual(expectPages)
      const codes: number[] = []
      for (const url of apis) {
        const plain = await page.request.get(url)
        const spoofed = await page.request.get(url + q, { headers: spoofs })
        expect(spoofed.status(), `${actor} ${url} spoofed`).toBe(plain.status())
        const body = await plain.text()
        for (const s of secrets) expect(body, `${actor} ${url}`).not.toContain(s)
        codes.push(plain.status())
      }
      expect(codes, actor).toEqual(expectApis)
      // The application writes, spoofed as the owner: never allowed for anyone else.
      if (!expectWrites) return void matrix.push({ actor, pages: got, apis: codes, writes: [] })
      const writes = [
        await errorCode(
          await page.request.post(APPS, {
            data: { venture_id: w.startup.id, programme_id: PROGRAMME },
            headers: spoofs,
          }),
        ),
        await errorCode(
          await page.request.patch(`${APPS}/${own}`, {
            data: { answers: answersOf('Sửa', 'Sửa') },
            headers: spoofs,
          }),
        ),
        await errorCode(await page.request.post(`${APPS}/${own}/submit`, { headers: spoofs })),
      ]
      expect(writes, actor).toEqual(expectWrites)
      matrix.push({ actor, pages: got, apis: codes, writes })
    }

    const auth = ['auth', 'auth', 'auth', 'auth', 'auth', 'auth']
    await run(
      'guest',
      auth,
      [401, 401, 401, 401],
      [
        '401 UNCONTRACTED_UNAUTHENTICATED',
        '401 UNCONTRACTED_UNAUTHENTICATED',
        '401 UNCONTRACTED_UNAUTHENTICATED',
      ],
    )
    await login(page.request, 'newcomer@example.test')
    await run(
      'onboarding incomplete',
      ['onboarding', 'onboarding', 'onboarding', 'onboarding', 'onboarding', 'onboarding'],
      [403, 403, 403, 403],
      ['403 SCOPE_FORBIDDEN', '403 SCOPE_FORBIDDEN', '403 SCOPE_FORBIDDEN'],
    )
    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    // The owner reads everything; the owner's writes are the journeys' and NEG's.
    await run('owner', ['200', '200', '200', '200', '200', '200'], [200, 200, 200, 200], null)
    const notFound = [
      '404 UNCONTRACTED_NOT_FOUND',
      '404 UNCONTRACTED_NOT_FOUND',
      '404 UNCONTRACTED_NOT_FOUND',
    ]
    for (const [actor, email, expected, writes] of [
      [
        'ACTIVE member ("Founder" label)',
        w.teammate.email,
        ['200', '200', '404', '404', '404', '404'],
        ['403 SCOPE_FORBIDDEN', '404 UNCONTRACTED_NOT_FOUND', '404 UNCONTRACTED_NOT_FOUND'],
      ],
      ['pending invitee', w.invitee.email, ['200', '404', '404', '404', '404', '404'], notFound],
      ['unrelated member', w.stranger.email, ['200', '404', '404', '404', '404', '404'], notFound],
      ['platform admin', 'ops@example.test', ['200', '404', '404', '404', '404', '404'], notFound],
      ['HUB leader', 'leader@example.test', ['200', '404', '404', '404', '404', '404'], notFound],
    ] as const) {
      await page.context().clearCookies()
      await login(page.request, email)
      const detailCode = expected[1] === '200' ? 200 : 404
      await run(actor, [...expected], [200, detailCode, 200, 404], [...writes])
      const list = await (await page.request.get(API)).json()
      expect(JSON.stringify(list).includes(w.startup.id), `${actor} lists the venture`).toBe(
        detailCode === 200,
      )
      expect(await (await page.request.get('/api/v1/me/applications')).json(), actor).toEqual([])
    }

    // The relation and the eligibility come from the server: the member reads, never applies.
    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    const asMember = await (await page.request.get(`${API}/${w.startup.id}`)).json()
    expect(asMember.venture.relation).toBe('MEMBER')
    expect(asMember.programmes[0].eligibility).toEqual({ eligible: false, reason: 'NOT_OWNER' })
    await settled(page, detailUrl(w.startup.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await expect(page.locator('[data-nav^="application-"]')).toHaveCount(0)

    // No method other than GET on the demo API.
    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    const asOwner = await (await page.request.get(`${API}/${w.startup.id}`)).json()
    expect(asOwner.venture.relation).toBe('OWNER')
    for (const url of [API, `${API}/${w.startup.id}`])
      for (const method of ['post', 'put', 'patch', 'delete'] as const)
        expect((await page.request[method](url, { data: {} })).status(), `${method} ${url}`).toBe(
          405,
        )

    const changed = expectNoWrites(before, await tables(), { signIns: true })
    writeJsonReport('WF05-UAT.SEC.json', { matrix, tables_changed: changed })
  })
})

// ------------------------------------------------------------------ NEG

test.describe('NEG-WF05 negative / alternate', () => {
  test('ids: foreign / random / malformed venture, programme and application; future sub-routes; id swap; a foreign venture or application is never attached or submitted', async ({
    page,
    browser,
    baseURL,
  }) => {
    const w = await world()
    const theirs = await browser.newContext({ baseURL })
    await login(theirs.request, w.stranger.email)
    const foreignApp = await draft(theirs.request, w.foreign.id, ['Của người khác', 'Hai'])
    await theirs.close()
    await login(page.request, w.owner.email)
    const mine = await draft(page.request, w.startup.id, ['Một', ''])
    const kept = await applicationsOf([w.startup.id, w.foreign.id])
    const before = await tables()
    for (const url of [
      detailUrl(w.foreign.id),
      detailUrl(RANDOM),
      detailUrl('abc'),
      formUrl(w.foreign.id),
      formUrl(w.startup.id, CHALLENGE),
      formUrl(w.startup.id, RANDOM),
      formUrl(w.startup.id, 'abc'),
      formUrl('abc'),
      reviewUrl(w.foreign.id),
      reviewUrl(w.startup.id, CHALLENGE),
      reviewUrl(w.startup.id, 'abc'),
      submittedUrl(w.foreign.id),
      oldFormUrl(w.foreign.id),
      `${formUrl(w.startup.id)}/submit`,
      `${reviewUrl(w.startup.id)}/next`,
      `${detailUrl(w.startup.id)}/applications`,
      `/programmes/${CHALLENGE}/apply`,
      `/programmes/${RANDOM}/apply`,
      '/programmes/abc/apply',
    ])
      expect((await page.goto(url))?.status(), url).toBe(404)

    const post = (data: unknown) => page.request.post(APPS, { data })
    expect(await errorCode(await post({ venture_id: w.foreign.id, programme_id: PROGRAMME }))).toBe(
      '404 UNCONTRACTED_NOT_FOUND',
    )
    expect(await errorCode(await post({ venture_id: w.startup.id, programme_id: CHALLENGE }))).toBe(
      '404 UNCONTRACTED_NOT_FOUND',
    )
    expect(await errorCode(await post({ venture_id: w.startup.id, programme_id: RANDOM }))).toBe(
      '404 UNCONTRACTED_NOT_FOUND',
    )
    expect(await errorCode(await post({ venture_id: 'abc', programme_id: PROGRAMME }))).toBe(
      '422 APPLICATION_VALIDATION_FAILED',
    )
    expect(
      await errorCode(
        await post({ venture_id: w.project.id, programme_id: PROGRAMME, status: 'SUBMITTED' }),
      ),
    ).toBe('422 APPLICATION_VALIDATION_FAILED')
    for (const url of [`${APPS}/${foreignApp}`, `${APPS}/abc`, `${APPS}/${RANDOM}`]) {
      expect(await errorCode(await page.request.get(url)), url).toBe('404 UNCONTRACTED_NOT_FOUND')
      expect(
        await errorCode(await page.request.patch(url, { data: { answers: answersOf('x', 'y') } })),
        url,
      ).toBe('404 UNCONTRACTED_NOT_FOUND')
      expect(await errorCode(await page.request.post(`${url}/submit`)), url).toBe(
        '404 UNCONTRACTED_NOT_FOUND',
      )
    }
    // Id swap: an application's venture, programme or status never changes through a save.
    for (const extra of [
      { venture_id: w.foreign.id },
      { programme_id: CHALLENGE },
      { status: 'SUBMITTED' },
    ])
      expect(
        await errorCode(
          await page.request.patch(`${APPS}/${mine}`, {
            data: { answers: answersOf('x', 'y'), ...extra },
          }),
        ),
        JSON.stringify(extra),
      ).toBe('422 APPLICATION_VALIDATION_FAILED')
    expect(await applicationsOf([w.startup.id, w.foreign.id])).toEqual(kept)
    expectNoWrites(before, await tables())
  })

  test('lifecycle: archived, duplicate start, invalid / missing answers, existing SUBMITTED final, a stale form after SUBMITTED', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await tables()
    // ARCHIVED: no "Đăng ký", the form locked, the API refuses.
    await settled(page, detailUrl(w.archived.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await settled(page, formUrl(w.archived.id))
    await expect(page.locator('[data-ineligible="ARCHIVED"]')).toHaveText(
      'Hồ sơ này đã lưu trữ nên không nộp được.',
    )
    await expect(answer(page, 'q-problem')).toBeDisabled()
    const archived = await page.request.post(APPS, {
      data: { venture_id: w.archived.id, programme_id: PROGRAMME },
    })
    expect(await errorCode(archived)).toBe('409 APPLICATION_NOT_ELIGIBLE')
    expect(await applicationsOf([w.archived.id])).toEqual([])

    // Duplicate start: the same key replays; another start is 409 with the existing id.
    const key = crypto.randomUUID()
    const data = { venture_id: w.startup.id, programme_id: PROGRAMME }
    const first = await page.request.post(APPS, { data, headers: { 'Idempotency-Key': key } })
    const replay = await page.request.post(APPS, { data, headers: { 'Idempotency-Key': key } })
    expect([first.status(), replay.status()]).toEqual([201, 201])
    const id = ((await first.json()) as { id: string }).id
    expect(((await replay.json()) as { id: string }).id).toBe(id)
    const again = await page.request.post(APPS, { data })
    expect(await errorCode(again)).toBe('409 APPLICATION_EXISTS')
    expect(
      ((await again.json()) as { error: { fields: Record<string, string> } }).error.fields,
    ).toMatchObject({ application_id: id })
    expect((await applicationsOf([w.startup.id])).map((r) => r.id)).toEqual([id])
    await settled(page, detailUrl(w.startup.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await expect(page.locator('[data-nav="application-resume"]')).toHaveText('Tiếp tục')

    // Invalid answer: refused by the server and capped by the form; missing answer: blocked.
    expect(
      await errorCode(
        await page.request.patch(`${APPS}/${id}`, {
          data: { answers: answersOf('Một', 'x'.repeat(2001)) },
        }),
      ),
    ).toBe('422 APPLICATION_VALIDATION_FAILED')
    await settled(page, `${formUrl(w.startup.id)}?buoc=4`)
    await answer(page, 'q-support').fill('x'.repeat(2001))
    await expect(answer(page, 'q-support')).toHaveValue('x'.repeat(2000))
    await answer(page, 'q-support').fill('')
    expect(
      (
        await page.request.patch(`${APPS}/${id}`, { data: { answers: answersOf('Một', '') } })
      ).status(),
    ).toBe(200)
    const incomplete = await page.request.post(`${APPS}/${id}/submit`)
    expect(await errorCode(incomplete)).toBe('422 APPLICATION_INCOMPLETE')
    await settled(page, reviewUrl(w.startup.id))
    await expect(page.locator('[data-action="submit"]')).toBeDisabled()
    await expect(page.locator('[data-anchor="readiness"]')).toHaveText(
      'Còn 1 việc trước khi nộp được',
    )

    // A form opened while DRAFT, submitted meanwhile: its save is refused; SUBMITTED is final.
    await settled(page, `${formUrl(w.startup.id)}?buoc=1`)
    await page.request.patch(`${APPS}/${id}`, { data: { answers: answersOf('Một', 'Hai') } })
    await submit(page.request, id)
    const [final] = await applicationsOf([w.startup.id])
    await answer(page, 'q-problem').fill('Sửa sau khi nộp')
    await answer(page, 'q-problem').blur()
    await expect(page.locator('[data-save-state="failed"]')).toHaveText('Chưa lưu được — thử lại')
    expect(await applicationsOf([w.startup.id])).toEqual([final])

    // Existing SUBMITTED: no "Đăng ký", every route opens the submitted view, every write is 409.
    await settled(page, detailUrl(w.startup.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await expect(page.locator('[data-nav="application-view"]')).toHaveText('Xem đơn')
    await settled(page, formUrl(w.startup.id))
    await expect(page).toHaveURL(submittedUrl(w.startup.id))
    expect(
      await errorCode(
        await page.request.patch(`${APPS}/${id}`, { data: { answers: answersOf('x', 'y') } }),
      ),
    ).toBe('409 APPLICATION_SUBMITTED')
    expect(await errorCode(await page.request.post(`${APPS}/${id}/submit`))).toBe(
      '409 APPLICATION_SUBMITTED',
    )
    expect(await errorCode(await page.request.post(APPS, { data }))).toBe('409 APPLICATION_EXISTS')
    expect(await applicationsOf([w.startup.id])).toEqual([final])
    expect(await auditOf(id)).toEqual(['APPLICATION_DRAFT_CREATED', 'APPLICATION_SUBMITTED'])
    expectNoWrites(before, await tables(), { applications: true })
  })
})

// --------------------------------------------------------------- SERVER

test.describe('SERVER-WF05 application record', () => {
  test('refresh, resume from S01 → S02, a new browser session sees the same DRAFT, nothing in browser storage, the snapshot at submit', async ({
    page,
    browser,
    baseURL,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await tables()
    await settled(page, formUrl(w.project.id))
    await answer(page, 'q-problem').fill('Câu một')
    await answer(page, 'q-problem').blur()
    await expect(page.locator('[data-save-state="idle"]')).toHaveText(/^Đã lưu lúc/)
    // Refresh resumes on the first step with an unanswered required question.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(formStep(page)).toHaveAttribute('data-step', '4')
    await page.locator('[data-action="prev"]').click()
    await page.locator('[data-action="prev"]').click()
    await expect(formStep(page)).toHaveAttribute('data-step', '1')
    await expect(answer(page, 'q-problem')).toHaveValue('Câu một')
    await settled(page, '/demo/projects')
    await page.locator(`[data-venture="${w.project.id}"] [data-nav="venture-detail"]`).click()
    await page.locator('[data-nav="application-resume"]').click()
    await expect(page).toHaveURL(formUrl(w.project.id))
    await expect(formStep(page)).toHaveAttribute('data-step', '4')

    // Nothing of the application lives in the browser.
    for (const store of ['sessionStorage', 'localStorage'] as const)
      expect(
        await page.evaluate(
          (s) => Object.keys(window[s]).filter((k) => /wf05|application/i.test(k)),
          store,
        ),
        store,
      ).toEqual([])

    // A new clean browser session of the same account continues the same DRAFT.
    const fresh = await browser.newContext({ baseURL })
    const other = await fresh.newPage()
    await login(other.request, w.owner.email)
    await other.goto(`${formUrl(w.project.id)}?buoc=1`, { waitUntil: 'networkidle' })
    await expect(answer(other, 'q-problem')).toHaveValue('Câu một')
    await other.goto(`${formUrl(w.project.id)}?buoc=4`, { waitUntil: 'networkidle' })
    await answer(other, 'q-support').fill('Câu hai')
    await other.locator('[data-action="to-review"]').click()
    await expect(other).toHaveURL(reviewUrl(w.project.id))
    await other.locator('[data-action="submit"]').click()
    await expect(other).toHaveURL(submittedUrl(w.project.id))
    await fresh.close()

    const [row, ...more] = await applicationsOf([w.project.id])
    expect(more).toEqual([])
    expect(row).toMatchObject({ status: 'SUBMITTED', type: 'TEAM' })
    expect(row!.snapshot).toMatchObject({
      venture: { id: w.project.id, name: 'Dự án UAT' },
      answers: answersOf('Câu một', 'Câu hai'),
    })
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(submittedUrl(w.project.id))
    await expect(page.locator('[data-question="q-support"]')).toContainText('Câu hai')
    expectNoWrites(before, await tables(), { signIns: true, applications: true })
  })
})

// ------------------------------------------------------------------- NAV

test.describe('NAV-WF05 navigation crawl', () => {
  test('every link on every WF05 / L5 route and state leads to a built screen; no placeholder, dev or future route; back and refresh', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await draft(page.request, w.startup.id, ['Một', ''])
    await submit(page.request, await draft(page.request, w.project.id, ['Một', 'Hai']))
    const visits = [
      '/demo/projects',
      detailUrl(w.startup.id),
      detailUrl(w.project.id),
      detailUrl(w.archived.id),
      `${formUrl(w.startup.id)}?buoc=1`,
      `${formUrl(w.startup.id)}?buoc=3`,
      `${formUrl(w.startup.id)}?buoc=4`,
      reviewUrl(w.startup.id),
      submittedUrl(w.project.id),
      formUrl(w.archived.id),
      `/programmes/${PROGRAMME}/apply`,
    ]
    const hrefs = new Map<string, string>()
    let visited = 0
    const crawl = async (label: string) => {
      for (const url of visits) {
        const response = await settled(page, url)
        expect(response?.status(), `${label} ${url}`).toBe(200)
        visited++
        const text = await page.locator('body').innerText()
        expect(text, `${label} ${url}`).not.toMatch(PLACEHOLDER)
        for (const href of await page
          .locator('a')
          .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))) {
          expect(href, `${label} ${url}`).not.toMatch(/^(#|javascript:.*|)$/)
          // An in-page anchor must land on this page.
          if (href.startsWith('#')) {
            await expect(page.locator(href), `${label} ${url} ${href}`).toHaveCount(1)
            continue
          }
          expect(href, `${label} ${url}`).not.toMatch(/\/dev\b/)
          if (!hrefs.has(href)) hrefs.set(href, `${label} ${url}`)
        }
      }
    }
    await crawl('owner')
    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    visits.splice(0, visits.length, '/demo/projects', detailUrl(w.startup.id))
    await crawl('member')

    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    const dead: string[] = []
    for (const [href, from] of hrefs) {
      const r = await page.request.get(href)
      if (r.status() !== 200 || new URL(r.url()).pathname.startsWith('/auth'))
        dead.push(`${href} (${from})`)
    }
    expect(dead).toEqual([])
    const uuid = '[0-9a-f-]{36}'
    for (const h of [...hrefs.keys()].filter((h) => /^\/demo\/projects|\/applications\//.test(h)))
      expect(h).toMatch(
        new RegExp(
          `^(/demo/projects(/${uuid})?|/projects/${uuid}/applications/${PROGRAMME}(/review|/submitted)?(\\?buoc=[1-4])?)$`,
        ),
      )

    // Clicks forward S01 → S02 → form → review, then back at every step; direct refresh on each.
    await settled(page, '/demo/projects')
    await page.locator(`[data-venture="${w.startup.id}"] [data-nav="venture-detail"]`).click()
    await expect(page).toHaveURL(detailUrl(w.startup.id))
    await page.locator('[data-nav="application-resume"]').click()
    await expect(page).toHaveURL(formUrl(w.startup.id))
    await answer(page, 'q-support').fill('Hai')
    await page.locator('[data-action="to-review"]').click()
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    for (const [back, marker] of [
      [formUrl(w.startup.id), 'L5-SUB1'],
      [detailUrl(w.startup.id), 'WF05-S02'],
      ['/demo/projects', 'WF05-S01'],
    ] as const) {
      await page.goBack()
      await expect(page).toHaveURL(back)
      await expect(screenState(page, marker)).toBeVisible()
      await page.reload({ waitUntil: 'networkidle' })
      await expect(screenState(page, marker)).toBeVisible()
    }
    writeJsonReport('WF05-UAT.NAV.json', {
      pages_visited: visited,
      unique_links: hrefs.size,
      links: [...hrefs.keys()].sort(),
      dead,
    })
  })
})

// ------------------------------------------------------------ VIS / COPY

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
    for (const el of document.querySelectorAll('textarea')) {
      const r = el.getBoundingClientRect()
      rects.push({ x: r.x + 4, y: r.y + 4, width: r.width - 8, height: r.height - 8 })
    }
    return rects
  })
}

test.describe('VIS-WF05 / COPY-WF05 visual and copy completion', () => {
  test('6 representative WF05 states at 1440 / 768 / 390: typography, shell and header band vs approved primitives, no overflow, key action reachable, copy clean', async ({
    page,
  }) => {
    const w = await world()
    const empty = await person('Chưa Có Hồ Sơ')
    await login(page.request, w.owner.email)
    await draft(page.request, w.startup.id, ['Một', ''])
    await page.context().clearCookies()
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
    type State = { name: string; who: Person; key: string; open: () => Promise<void> }
    const at = (url: string) => async () => void (await settled(page, url))
    // The L5 screens are audited against L37–L43 in the L5 spec (TASK 24.4).
    const states: State[] = [
      {
        name: 's01-populated',
        who: w.owner,
        key: '[data-nav="create-project"]',
        open: at('/demo/projects'),
      },
      {
        name: 's01-empty',
        who: empty,
        key: '[data-state="ventures-empty"]',
        open: at('/demo/projects'),
      },
      {
        name: 's02-project',
        who: w.owner,
        key: '[data-action="apply"]',
        open: at(detailUrl(w.project.id)),
      },
      {
        name: 's02-startup-draft',
        who: w.owner,
        key: '[data-nav="application-resume"]',
        open: at(detailUrl(w.startup.id)),
      },
      {
        name: 's02-archived',
        who: w.owner,
        key: '[data-programme] [data-ineligible]',
        open: at(detailUrl(w.archived.id)),
      },
      {
        name: 's02-member',
        who: w.teammate,
        key: '[data-programme] [data-ineligible]',
        open: at(detailUrl(w.startup.id)),
      },
    ]
    const results: SegmentResult[] = []
    const copyFindings: string[] = []
    let checked = 0
    let current = ''
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const s of states) {
        if (current !== s.who.email) {
          await page.context().clearCookies()
          await login(page.request, s.who.email)
          current = s.who.email
        }
        await s.open()
        const tag = `${s.name}-${width}`
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          `${tag} overflow`,
        ).toBe(0)
        const key = page.locator(s.key).first()
        await key.scrollIntoViewIfNeeded()
        await expect(key, `${tag} key`).toBeInViewport()
        const text = await page.locator('[data-demo-page]').innerText()
        if (COPY_BANNED.test(text) || PLACEHOLDER.test(text) || LEAK.test(text))
          copyFindings.push(
            `${tag}: ${text.match(COPY_BANNED) ?? text.match(PLACEHOLDER) ?? text.match(LEAK)}`,
          )
        await page.evaluate(() => window.scrollTo(0, 0))
        await settle(page)
        await page.screenshot({ path: path.join(ACTUAL, `wf05-uat-${tag}.png`), fullPage: true })
        if (width !== 1440) continue
        const typography = await assertTypography(page)
        expect(typography.violations, tag).toEqual([])
        checked += typography.checked
        const actual = decodePng(await page.screenshot())
        const masks = [...(await textRects(page)), ...referenceText]
        results.push(
          ...compareSegments(
            shellRef,
            actual,
            [
              {
                name: `${tag}-shell-header`,
                reference: { x: 0, y: 0, width: 1440, height: 60 },
                dy: 0,
              },
              {
                name: `${tag}-shell-sidebar`,
                reference: { x: 0, y: 60, width: 330, height: 380 },
                dy: 0,
              },
            ],
            masks,
            { diffPath: resolveOutputPath('diff', `WF05-UAT.${tag}.shell.diff.png`) },
          ),
        )
        const rule = (await page.locator('[data-demo-page] > header').boundingBox())!
        const header: Segment[] = [
          {
            name: `${tag}-header-rule`,
            reference: { x: 500, y: 72, width: 600, height: 6 },
            dy: Math.round(rule.y + rule.height) - 76,
          },
        ]
        results.push(
          ...compareSegments(adm5, actual, header, masks, {
            diffPath: resolveOutputPath('diff', `WF05-UAT.${tag}.primitives.diff.png`),
          }),
        )
      }
    }
    expect(copyFindings).toEqual([])
    writeJsonReport('WF05-UAT.VIS.json', {
      screen_id: 'WF05',
      states: states.map((s) => s.name),
      widths: [1440, 768, 390],
      typography_checked: checked,
      approved_wf05_bitmap: null,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF05-G1: MemberShell + WF04 demo frame and card chrome; no WF05 pixel parity claimed. The application screens are L5 (DEC-L5-D4), audited in l5-startup-journey.spec.ts',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
