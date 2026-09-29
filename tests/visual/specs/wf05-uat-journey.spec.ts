import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { onboardThroughUi } from '../support/onboarding'
import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { createVenture } from '../../../src/lib/venture/venture'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF05 closing gate (PROCESS-P0-ACCELERATED-SAFE-V2 §I): HC-WF05 journeys (a
 * PROJECT and a STARTUP owner signed in through the real magic link and WF01
 * onboarding, entering from MemberShell), canonical reuse (a WF02 rename),
 * reset; SEC-WF05-01 (8 actors × every WF05 route and API, spoofed); NEG-WF05;
 * STORE-WF05; NAV-WF05; VIS-WF05 / COPY-WF05. Every WF05 phase is bracketed by
 * row-exact hashes of every table in the schema; WF01 / WF02 setup writes
 * happen outside the brackets, through their own workflows. Screen-level cases
 * stay in each WF05-T00 / S0x spec.
 */

const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const API = '/api/v1/demo/projects'
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
  const startup = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Startup UAT' })
  const project = await createVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án UAT' })
  const archived = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Lưu trữ UAT' })
  const foreign = await createVenture(stranger.accountId, { type: 'STARTUP', name: 'Ngoài UAT' })
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
 * bracket itself signs someone in, which may touch the WF01 sign-in tables only.
 */
function expectNoWrites(
  before: Record<string, string>,
  after: Record<string, string>,
  { signIns = false } = {},
) {
  expect(Object.keys(after)).toEqual(Object.keys(before))
  expect(after.applications, 'no applications table').toBeUndefined()
  const changed = Object.keys(before).filter((t) => before[t] !== after[t])
  expect(
    changed.filter((t) => !(signIns && SIGN_IN_TABLES.includes(t))),
    'tables written',
  ).toEqual([])
  return changed
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
const rawStore = (page: Page, accountId: string) =>
  page.evaluate((k) => sessionStorage.getItem(k), storeKey(accountId))
async function stored(page: Page, accountId: string) {
  const raw = await rawStore(page, accountId)
  return raw
    ? (JSON.parse(raw) as { version: number; applications: Record<string, StoredApplication> })
    : null
}

async function plant(
  page: Page,
  accountId: string,
  entries: {
    ventureId: string
    type?: 'TEAM' | 'STARTUP'
    status?: 'DRAFT' | 'SUBMITTED'
    answers?: string[]
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
        created_at: now,
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

async function settled(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'networkidle' })
  await expect(
    page.locator(
      '[data-state="projects-loading"], [data-state="detail-loading"], [data-state="application-loading"], [data-state="review-loading"]',
    ),
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

const answer = (page: Page, i: number) => page.locator(`#answer-${i}`)
const screenState = (page: Page, screen: string) => page.locator(`[data-screen="${screen}"]`)
const answersShown = (page: Page) =>
  page
    .locator('[data-review-answer]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText))

// ------------------------------------------------------------ HC journeys

type Kind = { type: 'PROJECT' | 'STARTUP'; label: string; applicant: string; stored: string }
const KINDS: Record<'PROJECT' | 'STARTUP', Kind> = {
  PROJECT: { type: 'PROJECT', label: 'Dự án', applicant: 'Đội', stored: 'TEAM' },
  STARTUP: { type: 'STARTUP', label: 'Startup', applicant: 'Startup', stored: 'STARTUP' },
}

/** HC-WF05-01 / 02: sign-in → onboarding → MemberShell → S01 → WF02 create → S01 → S02 → S03 → S04 → SUBMITTED. */
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
  await page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' }).click()
  await expect(page).toHaveURL(/\/projects\/new\?venture=[0-9a-f-]{36}&step=team$/)
  const ventureId = new URL(page.url()).searchParams.get('venture')!
  await page.locator('[data-nav="wizard-exit"]').click()
  await expect(page).toHaveURL('/me')
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
  await expect(page).toHaveURL(appUrl(ventureId))
  await expect(screenState(page, 'WF05-S03')).toHaveAttribute('data-application-state', 'NONE')
  await expect(page.locator('[data-applicant-name]')).toHaveText(name)
  await expect(page.locator('[data-section="applicant"]')).toContainText(
    `Đăng ký với tư cách: ${kind.applicant}`,
  )
  await expect(page.locator('label[for^="answer-"]')).toHaveText(['Câu hỏi 1', 'Câu hỏi 2'])
  await expect(page.locator('[data-application-form]')).toContainText(Q1)
  await expect(page.locator('[data-application-form]')).toContainText(Q2)
  expect(await rawStore(page, me.accountId)).toBeNull()
  log.step(page, 'HP-05', `S02 → S03 as ${kind.stored}; opening stores nothing`)

  await answer(page, 0).fill(a0)
  await page.locator('[data-action="save-draft"]').click()
  await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
  const draft = (await stored(page, me.accountId))!.applications[`${ventureId}:${PROGRAMME}`]!
  expect(draft).toMatchObject({
    primary_applicant_type: kind.stored,
    primary_applicant_id: ventureId,
    programme_id: PROGRAMME,
    status: 'DRAFT',
    programme_specific_answers: [a0, ''],
    submitted_at: null,
  })
  log.step(page, 'HP-06', 'Incomplete "Lưu nháp" creates one DRAFT')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(answer(page, 0)).toHaveValue(a0)
  await expect(answer(page, 1)).toHaveValue('')
  await expect(screenState(page, 'WF05-S03')).toHaveAttribute('data-application-state', 'DRAFT')
  log.step(page, 'HP-07', 'Refresh: answers kept')

  await answer(page, 1).fill(a1)
  await page.locator('[data-action="review"]').click()
  await expect(page).toHaveURL(reviewUrl(ventureId))
  await expect(page.locator('[data-review-venture]')).toHaveText(name)
  await expect(page.locator('[data-review-applicant]')).toHaveText(
    `${kind.label} · Đăng ký với tư cách: ${kind.applicant}`,
  )
  await expect(page.locator('[data-review-programme]')).toHaveText(PROGRAMME_NAME)
  expect(await answersShown(page)).toEqual([`${Q1}\n${a0}`, `${Q2}\n${a1}`])
  await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng nộp')
  log.step(page, 'HP-08', '"Rà soát & nộp" saves and opens S04; checklist green')

  await page.locator('[data-action="submit"]').click()
  await expect(screenState(page, 'WF05-S04')).toHaveAttribute('data-application-state', 'SUBMITTED')
  await expect(page.locator('[data-state="review-submitted"]')).toHaveText(
    'Đã nộp đơn. Đơn chỉ xem được, không sửa được.',
  )
  const submitted = (await stored(page, me.accountId))!
  expect(Object.keys(submitted.applications)).toEqual([`${ventureId}:${PROGRAMME}`])
  expect(submitted.applications[`${ventureId}:${PROGRAMME}`]).toMatchObject({
    status: 'SUBMITTED',
    programme_specific_answers: [a0, a1],
    created_at: draft.created_at,
  })
  log.step(page, 'HP-09', 'DRAFT → SUBMITTED once; answers and created_at kept')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(screenState(page, 'WF05-S04')).toHaveAttribute('data-application-state', 'SUBMITTED')
  await expect(page.locator('[data-action="submit"], textarea')).toHaveCount(0)
  log.step(page, 'HP-10', 'Refresh: still SUBMITTED, read only')

  await page.locator('[data-nav="review-back"]').click()
  await expect(page).toHaveURL(detailUrl(ventureId))
  await expect(participation.locator('[data-application]')).toHaveText('Đã nộp')
  await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
  await page.locator('[data-nav="detail-back"]').click()
  await expect(page).toHaveURL('/demo/projects')
  await expect(row.locator('[data-venture-applications]')).toHaveText(
    `Đơn đăng ký demo: ${PROGRAMME_NAME} · Đã nộp`,
  )
  log.step(page, 'HP-11', 'S04 → S02 "Đã nộp", no second "Đăng ký" → S01 "Đã nộp"')

  await settled(page, appUrl(ventureId))
  await expect(page.locator('[data-state="application-locked"]')).toHaveText(
    'Đơn đã nộp: không sửa được.',
  )
  await expect(
    page.locator('textarea, [data-action="save-draft"], [data-action="review"]'),
  ).toHaveCount(0)
  await page.locator('[data-nav="application-view-submitted"]').click()
  await expect(page).toHaveURL(reviewUrl(ventureId))
  await page.goBack()
  await expect(page).toHaveURL(appUrl(ventureId))
  await page.goBack()
  await expect(page).toHaveURL('/demo/projects')
  log.step(page, 'HP-12', 'S03 attempted after submit: locked; "Xem đơn đã nộp"; back works')

  // No copy of venture or programme data; one canonical record; nothing written.
  const raw = (await rawStore(page, me.accountId))!
  expect(raw).not.toContain(name)
  expect(raw).not.toMatch(/Chương trình ươm tạo|Chapter 01|@|hub_session|token|cookie/)
  expect(storeKey(me.accountId)).not.toMatch(/@|example|[0-9a-f]{8}-/)
  const [{ n }] = (await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1`,
    [me.profileId],
  )) as [{ n: number }]
  expect(n).toBe(1)
  const changed = expectNoWrites(before, await tables())
  log.step(page, 'HP-13', 'Store: references + answers only; 1 canonical venture; 0 table writes')
  log.write({ type: kind.type, applicant: kind.stored, tables_changed: changed })
}

test.describe('HC-WF05-01 / 02 owner journeys', () => {
  test('HC-WF05-01 PROJECT owner: magic link → onboarding → MemberShell → S01 → WF02 → S02 → S03 (TEAM) → S04 → SUBMITTED', async ({
    page,
  }) => {
    await ownerJourney(page, KINDS.PROJECT, 'HC01')
  })

  test('HC-WF05-02 STARTUP owner: the same journey; STARTUP → STARTUP', async ({ page }) => {
    await ownerJourney(page, KINDS.STARTUP, 'HC02')
  })
})

test.describe('HC-WF05-03 canonical reuse', () => {
  test('a WF02 rename shows on S01, S02, S03 and S04; no sync, copy or second venture', async ({
    page,
  }) => {
    const log = journal('HC03')
    const w = await world()
    await login(page.request, w.owner.email)
    await settled(page, appUrl(w.startup.id))
    await answer(page, 0).fill('Giữ nguyên câu trả lời')
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    const raw = (await rawStore(page, w.owner.accountId))!
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
    await page.locator('[data-nav="project-demo"]').click()
    await expect(page.locator(`[data-venture="${w.startup.id}"]`)).toContainText(
      'Startup UAT đổi tên',
    )
    await page.locator(`[data-venture="${w.startup.id}"] [data-nav="venture-detail"]`).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Startup UAT đổi tên')
    await page.locator('[data-nav="application-resume"]').click()
    await expect(page.locator('[data-applicant-name]')).toHaveText('Startup UAT đổi tên')
    await expect(page.locator('[data-demo-meta]')).toHaveText('Startup UAT đổi tên · Bản nháp')
    await settled(page, reviewUrl(w.startup.id))
    await expect(page.locator('[data-review-venture]')).toHaveText('Startup UAT đổi tên')
    log.step(page, 'CR-03', 'S01, S02, S03, S04 show the new name')

    expect(await rawStore(page, w.owner.accountId)).toBe(raw)
    const names = await query<{ name: string }>(
      `SELECT name FROM projects WHERE owner_profile_id = $1 ORDER BY name`,
      [w.owner.profileId],
    )
    expect(names.map((r) => r.name)).toEqual(['Dự án UAT', 'Lưu trữ UAT', 'Startup UAT đổi tên'])
    const changed = expectNoWrites(before, await tables())
    log.step(page, 'CR-04', 'Store byte-identical; one record per venture; 0 table writes')
    log.write({ tables_changed: changed })
  })
})

test.describe('HC-WF05-04 reset', () => {
  test('reset after DRAFT and after SUBMITTED clears only the session; canonical and WF04 data unchanged', async ({
    page,
  }) => {
    const log = journal('HC04')
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await tables()
    const programmes = await (await page.request.get(API)).json()
    await settled(page, appUrl(w.project.id))
    await answer(page, 0).fill('Nháp sẽ bị xoá')
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    await reset(page)
    await expect(screenState(page, 'WF05-S03')).toHaveAttribute('data-application-state', 'NONE')
    await expect(answer(page, 0)).toHaveValue('')
    expect(await rawStore(page, w.owner.accountId)).toBeNull()
    log.step(page, 'RS-01', 'Reset after DRAFT: form afresh, store empty')

    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await settled(page, reviewUrl(w.startup.id))
    await page.locator('[data-action="submit"]').click()
    await expect(screenState(page, 'WF05-S04')).toHaveAttribute(
      'data-application-state',
      'SUBMITTED',
    )
    await reset(page)
    await expect(page.locator('[data-state="review-no-application"]')).toBeVisible()
    expect(await rawStore(page, w.owner.accountId)).toBeNull()
    await settled(page, detailUrl(w.startup.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(1)
    log.step(page, 'RS-02', 'Reset after SUBMITTED: gone; S02 offers "Đăng ký" again')

    expect(await (await page.request.get(API)).json()).toEqual(programmes)
    const changed = expectNoWrites(before, await tables())
    log.step(page, 'RS-03', 'Ventures, members, profiles, programmes, events: unchanged')
    log.write({ tables_changed: changed })
  })
})

// --------------------------------------------------------------- SEC matrix

test.describe('SEC-WF05-01 authorization matrix', () => {
  test('8 actors × 4 WF05 routes + 2 APIs, plain and spoofed; relation from the server only; no write, no leak', async ({
    page,
  }) => {
    const w = await world()
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
      appUrl(w.startup.id),
      reviewUrl(w.startup.id),
    ]
    const apis = [API, `${API}/${w.startup.id}`]
    const secrets = [
      w.owner.email,
      w.owner.accountId,
      w.owner.profileId,
      w.teammate.email,
      w.teammate.accountId,
      w.teammate.profileId,
      w.invitee.email,
    ]
    type Row = { actor: string; pages: string[]; apis: number[]; spoofed: 'same' }
    const matrix: Row[] = []
    const run = async (actor: string, expectPages: string[], expectApis: number[]) => {
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
      matrix.push({ actor, pages: got, apis: codes, spoofed: 'same' })
    }

    await run('guest', ['auth', 'auth', 'auth', 'auth'], [401, 401])
    await login(page.request, 'newcomer@example.test')
    await run(
      'onboarding incomplete',
      ['onboarding', 'onboarding', 'onboarding', 'onboarding'],
      [403, 403],
    )
    for (const [actor, email, expected] of [
      ['owner', w.owner.email, ['200', '200', '200', '200']],
      ['ACTIVE member ("Founder" label)', w.teammate.email, ['200', '200', '200', '200']],
      ['pending invitee', w.invitee.email, ['200', '404', '404', '404']],
      ['unrelated member', w.stranger.email, ['200', '404', '404', '404']],
      ['platform admin', 'ops@example.test', ['200', '404', '404', '404']],
      ['HUB leader', 'leader@example.test', ['200', '404', '404', '404']],
    ] as const) {
      await page.context().clearCookies()
      await login(page.request, email)
      const detailCode = expected[1] === '200' ? 200 : 404
      await run(actor, [...expected], [200, detailCode])
      const list = await (await page.request.get(API)).json()
      const listed = JSON.stringify(list).includes(w.startup.id)
      expect(listed, `${actor} lists the venture`).toBe(detailCode === 200)
    }

    // The relation and the eligibility come from the server: the member reads, never applies.
    const member = await (await page.request.get(`${API}/${w.startup.id}`)).json()
    expect(member).toBeDefined()
    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    const asMember = await (await page.request.get(`${API}/${w.startup.id}`)).json()
    expect(asMember.venture.relation).toBe('MEMBER')
    expect(asMember.programmes[0].eligibility).toEqual({ eligible: false, reason: 'NOT_OWNER' })
    await settled(page, appUrl(w.startup.id))
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Không đăng ký được: Chỉ chủ sở hữu đăng ký được.',
    )
    await plant(page, w.teammate.accountId, [{ ventureId: w.startup.id }])
    const planted = await rawStore(page, w.teammate.accountId)
    await settled(page, reviewUrl(w.startup.id))
    await expect(page.locator('[data-check="owner"]')).toHaveAttribute('data-ok', 'false')
    await expect(page.locator('[data-action="submit"]')).toBeDisabled()
    expect(await rawStore(page, w.teammate.accountId)).toBe(planted)

    // No method other than GET on the demo API.
    await page.context().clearCookies()
    await login(page.request, w.owner.email)
    const asOwner = await (await page.request.get(`${API}/${w.startup.id}`)).json()
    expect(asOwner.venture.relation).toBe('OWNER')
    for (const url of apis)
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
  test('ids: foreign / random / malformed venture, DRAFT / random / malformed programme, future sub-route, id swap after a valid load, planted foreign draft', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await tables()
    await settled(page, reviewUrl(w.startup.id))
    for (const url of [
      detailUrl(w.foreign.id),
      detailUrl(RANDOM),
      detailUrl('abc'),
      appUrl(w.foreign.id),
      appUrl(w.startup.id, CHALLENGE),
      appUrl(w.startup.id, RANDOM),
      appUrl(w.startup.id, 'abc'),
      reviewUrl(w.foreign.id),
      reviewUrl(w.startup.id, CHALLENGE),
      `${appUrl(w.startup.id)}/submit`,
      `${reviewUrl(w.startup.id)}/next`,
      `${detailUrl(w.startup.id)}/applications`,
    ])
      expect((await page.goto(url))?.status(), url).toBe(404)
    // A draft planted under a foreign venture in the owner's own store is never shown or used.
    await plant(page, w.owner.accountId, [{ ventureId: w.foreign.id }, { ventureId: w.startup.id }])
    const planted = (await stored(page, w.owner.accountId))!
    await settled(page, reviewUrl(w.startup.id))
    await page.locator('[data-action="submit"]').click()
    await expect(screenState(page, 'WF05-S04')).toHaveAttribute(
      'data-application-state',
      'SUBMITTED',
    )
    const after = (await stored(page, w.owner.accountId))!
    expect(after.applications[`${w.foreign.id}:${PROGRAMME}`]).toEqual(
      planted.applications[`${w.foreign.id}:${PROGRAMME}`],
    )
    expect((await page.goto(reviewUrl(w.foreign.id)))?.status()).toBe(404)
    expectNoWrites(before, await tables())
  })

  test('lifecycle: archived, existing SUBMITTED, duplicate start / save, double submit, missing / invalid answers, a stale form after SUBMITTED', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await tables()
    // ARCHIVED: no "Đăng ký", S03 locked, S04 blocked.
    await settled(page, detailUrl(w.archived.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await settled(page, appUrl(w.archived.id))
    await expect(page.locator('[data-state="application-locked"]')).toHaveText(
      'Không đăng ký được: Hồ sơ đã lưu trữ.',
    )
    await plant(page, w.owner.accountId, [{ ventureId: w.archived.id }])
    await settled(page, reviewUrl(w.archived.id))
    await expect(page.locator('[data-check="active"]')).toHaveAttribute('data-ok', 'false')
    await expect(page.locator('[data-action="submit"]')).toBeDisabled()
    await reset(page)

    // Duplicate start and duplicate save: one application.
    await settled(page, appUrl(w.startup.id))
    await settled(page, appUrl(w.startup.id))
    await answer(page, 0).fill('Một')
    await page.locator('[data-action="save-draft"]').dblclick()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    await settled(page, appUrl(w.startup.id))
    await answer(page, 1).fill('Hai')
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    let state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications)).toEqual([`${w.startup.id}:${PROGRAMME}`])
    await settled(page, detailUrl(w.startup.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await expect(page.locator('[data-nav="application-resume"]')).toHaveText('Tiếp tục')

    // Invalid answer: refused at save, blocked at submit; missing answer: blocked.
    await settled(page, appUrl(w.startup.id))
    const good = await rawStore(page, w.owner.accountId)
    await answer(page, 1).fill('x'.repeat(2001))
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-error="answer-1"]')).toHaveText('Tối đa 2000 ký tự.')
    expect(await rawStore(page, w.owner.accountId)).toBe(good)
    for (const answers of [
      ['Một', ''],
      ['Một', 'x'.repeat(2001)],
    ]) {
      await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers }])
      const planted = await rawStore(page, w.owner.accountId)
      await settled(page, reviewUrl(w.startup.id))
      await expect(page.locator('[data-check="answers"]')).toHaveAttribute('data-ok', 'false')
      await expect(page.locator('[data-action="submit"]')).toBeDisabled()
      expect(await rawStore(page, w.owner.accountId)).toBe(planted)
    }

    // Double submit: one transition. Existing SUBMITTED: no "Đăng ký", S03 locked.
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await settled(page, reviewUrl(w.startup.id))
    await page.locator('[data-action="submit"]').dblclick()
    await expect(screenState(page, 'WF05-S04')).toHaveAttribute(
      'data-application-state',
      'SUBMITTED',
    )
    state = (await stored(page, w.owner.accountId))!
    expect(Object.keys(state.applications)).toHaveLength(1)
    await settled(page, detailUrl(w.startup.id))
    await expect(page.locator('[data-action="apply"]')).toHaveCount(0)
    await settled(page, appUrl(w.startup.id))
    await expect(page.locator('[data-state="application-locked"]')).toBeVisible()

    // A form opened while DRAFT, submitted meanwhile: the save is refused; SUBMITTED never returns to DRAFT.
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id }])
    await settled(page, appUrl(w.startup.id))
    await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, status: 'SUBMITTED' }])
    const final = await rawStore(page, w.owner.accountId)
    await answer(page, 0).fill('Sửa sau khi nộp')
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-failed"]')).toBeVisible()
    expect(await rawStore(page, w.owner.accountId)).toBe(final)
    expectNoWrites(before, await tables())
  })
})

// ---------------------------------------------------------------- STORE

test.describe('STORE-WF05 application store', () => {
  test('refresh, resume, a new clean session, one pair, no snapshot / PII / secret, atomic save and submit', async ({
    page,
    browser,
    baseURL,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    const before = await tables()
    await settled(page, appUrl(w.project.id))
    await answer(page, 0).fill('Câu một')
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
    // Refresh and resume from S01 → S02 "Tiếp tục".
    await page.reload({ waitUntil: 'networkidle' })
    await expect(answer(page, 0)).toHaveValue('Câu một')
    await settled(page, '/demo/projects')
    await page.locator(`[data-venture="${w.project.id}"] [data-nav="venture-detail"]`).click()
    await page.locator('[data-nav="application-resume"]').click()
    await expect(answer(page, 0)).toHaveValue('Câu một')

    // Shape: the T00 field names only; no venture / programme copy; no PII or secret.
    const raw = (await rawStore(page, w.owner.accountId))!
    const parsed = JSON.parse(raw)
    expect(Object.keys(parsed).sort()).toEqual(['applications', 'version'])
    expect(Object.keys(parsed.applications)).toEqual([`${w.project.id}:${PROGRAMME}`])
    expect(Object.keys(parsed.applications[`${w.project.id}:${PROGRAMME}`]).sort()).toEqual([
      'created_at',
      'primary_applicant_id',
      'primary_applicant_type',
      'programme_id',
      'programme_specific_answers',
      'status',
      'submitted_at',
      'updated_at',
    ])
    const cookies = await page.context().cookies()
    for (const c of cookies) expect(raw).not.toContain(c.value)
    expect(raw).not.toMatch(/Dự án UAT|Chủ Hồ Sơ|Chương trình ươm tạo|@|hub_session|token/)
    expect(storeKey(w.owner.accountId)).not.toContain(w.owner.accountId)
    const keys = await page.evaluate(() => Object.keys(sessionStorage))
    expect(keys.filter((k) => k.startsWith('hub.wf05-demo'))).toEqual([storeKey(w.owner.accountId)])
    expect(
      await page.evaluate(() => Object.keys(localStorage).filter((k) => /wf05/.test(k))),
    ).toEqual([])

    // Atomic save and submit: a refused browser write changes nothing.
    const block = () =>
      page.evaluate(() => {
        const original = Storage.prototype.setItem
        ;(window as unknown as { __restore: () => void }).__restore = () => {
          Storage.prototype.setItem = original
        }
        Storage.prototype.setItem = () => {
          throw new DOMException('quota', 'QuotaExceededError')
        }
      })
    const unblock = () =>
      page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await answer(page, 1).fill('Câu hai')
    await block()
    await page.locator('[data-action="save-draft"]').click()
    await expect(page.locator('[data-state="draft-failed"]')).toBeVisible()
    expect(await rawStore(page, w.owner.accountId)).toBe(raw)
    await unblock()
    await page.locator('[data-action="review"]').click()
    await expect(page).toHaveURL(reviewUrl(w.project.id))
    const draft = (await stored(page, w.owner.accountId))!.applications[
      `${w.project.id}:${PROGRAMME}`
    ]!
    const complete = await rawStore(page, w.owner.accountId)
    await block()
    await page.locator('[data-action="submit"]').click()
    await expect(page.locator('[data-state="submit-failed"]')).toBeVisible()
    expect(await rawStore(page, w.owner.accountId)).toBe(complete)
    await unblock()
    await page.locator('[data-action="submit"]').click()
    await expect(screenState(page, 'WF05-S04')).toHaveAttribute(
      'data-application-state',
      'SUBMITTED',
    )
    const done = (await stored(page, w.owner.accountId))!.applications[
      `${w.project.id}:${PROGRAMME}`
    ]!
    expect(done.programme_specific_answers).toEqual(['Câu một', 'Câu hai'])
    expect(done.created_at).toBe(draft.created_at)

    // A new clean browser session of the same account holds no application.
    const fresh = await browser.newContext({ baseURL })
    const other = await fresh.newPage()
    await login(other.request, w.owner.email)
    await other.goto(detailUrl(w.project.id), { waitUntil: 'networkidle' })
    await expect(other.locator('[data-action="apply"]')).toHaveCount(1)
    expect(await other.evaluate(() => Object.keys(sessionStorage).length)).toBe(0)
    await fresh.close()
    expectNoWrites(before, await tables(), { signIns: true })
  })
})

// ------------------------------------------------------------------- NAV

test.describe('NAV-WF05 navigation crawl', () => {
  test('every link on every WF05 route and state leads to a built screen; no #, placeholder, dev or future route; back and refresh', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await page.goto('/demo/projects', { waitUntil: 'networkidle' })
    await plant(page, w.owner.accountId, [
      { ventureId: w.startup.id },
      { ventureId: w.project.id, type: 'TEAM', status: 'SUBMITTED' },
    ])
    const visits = [
      '/demo/projects',
      detailUrl(w.startup.id),
      detailUrl(w.project.id),
      detailUrl(w.archived.id),
      appUrl(w.startup.id),
      appUrl(w.project.id),
      appUrl(w.archived.id),
      reviewUrl(w.startup.id),
      reviewUrl(w.project.id),
      reviewUrl(w.archived.id),
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
          expect(href, `${label} ${url}`).not.toMatch(/^(#.*|javascript:.*|)$/)
          expect(href, `${label} ${url}`).not.toMatch(/\/dev\b|\/applications\/[^/]+\/(?!review$)/)
          if (!hrefs.has(href)) hrefs.set(href, `${label} ${url}`)
        }
      }
    }
    await crawl('owner')
    await page.context().clearCookies()
    await login(page.request, w.teammate.email)
    visits.splice(
      0,
      visits.length,
      '/demo/projects',
      detailUrl(w.startup.id),
      appUrl(w.startup.id),
      reviewUrl(w.startup.id),
    )
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
    const wf05 = [...hrefs.keys()].filter((h) => h.startsWith('/demo/projects'))
    for (const h of wf05)
      expect(h).toMatch(
        /^\/demo\/projects(\/[0-9a-f-]{36}(\/applications\/d4000000-0000-0000-0000-000000000001(\/review)?)?)?$/,
      )

    // Clicks forward S01 → S02 → S03 → S04, then back at every step; direct refresh on each.
    await plant(page, w.owner.accountId, [])
    await settled(page, '/demo/projects')
    await page.locator(`[data-venture="${w.startup.id}"] [data-nav="venture-detail"]`).click()
    await expect(page).toHaveURL(detailUrl(w.startup.id))
    await page.locator('[data-action="apply"]').click()
    await expect(page).toHaveURL(appUrl(w.startup.id))
    await answer(page, 0).fill('Một')
    await answer(page, 1).fill('Hai')
    await page.locator('[data-action="review"]').click()
    await expect(page).toHaveURL(reviewUrl(w.startup.id))
    for (const [back, marker] of [
      [appUrl(w.startup.id), 'WF05-S03'],
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
  test('11 representative states at 1440 / 768 / 390: typography, shell and header band vs approved primitives, no overflow, key action reachable, copy clean', async ({
    page,
  }) => {
    const w = await world()
    const empty = await person('Chưa Có Hồ Sơ')
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
    const long = 'Một câu trả lời dài để kiểm tra việc xuống dòng trên màn hình nhỏ '
      .repeat(6)
      .trim()
    type State = { name: string; who: Person; key: string; open: () => Promise<void> }
    /** Opens `url` with an empty application store (states never inherit one). */
    const clean = async (url: string) => {
      await settled(page, url)
      await plant(page, w.owner.accountId, [])
      await page.reload({ waitUntil: 'networkidle' })
      await settled(page, url)
    }
    const states: State[] = [
      {
        name: 's01-populated',
        who: w.owner,
        key: '[data-nav="create-project"]',
        open: () => clean('/demo/projects'),
      },
      {
        name: 's01-empty',
        who: empty,
        key: '[data-state="ventures-empty"]',
        open: async () => void (await settled(page, '/demo/projects')),
      },
      {
        name: 's02-project',
        who: w.owner,
        key: '[data-action="apply"]',
        open: () => clean(detailUrl(w.project.id)),
      },
      {
        name: 's02-startup',
        who: w.owner,
        key: '[data-action="apply"]',
        open: () => clean(detailUrl(w.startup.id)),
      },
      {
        name: 's02-archived',
        who: w.owner,
        key: '[data-programme] [data-ineligible]',
        open: () => clean(detailUrl(w.archived.id)),
      },
      {
        name: 's03-new',
        who: w.owner,
        key: '[data-action="save-draft"]',
        open: async () => {
          await plant(page, w.owner.accountId, [])
          await settled(page, appUrl(w.startup.id))
        },
      },
      {
        name: 's03-saved',
        who: w.owner,
        key: '[data-state="draft-saved"]',
        open: async () => {
          await plant(page, w.owner.accountId, [])
          await settled(page, appUrl(w.startup.id))
          await answer(page, 0).fill(long)
          await page.locator('[data-action="save-draft"]').click()
          await expect(page.locator('[data-state="draft-saved"]')).toBeVisible()
        },
      },
      {
        name: 's03-validation',
        who: w.owner,
        key: '[data-error="answer-1"]',
        open: async () => {
          await plant(page, w.owner.accountId, [])
          await settled(page, appUrl(w.startup.id))
          await answer(page, 1).fill('x'.repeat(2001))
          await page.locator('[data-action="save-draft"]').click()
          await expect(page.locator('[data-error="answer-1"]')).toBeVisible()
        },
      },
      {
        name: 's04-ready',
        who: w.owner,
        key: '[data-action="submit"]',
        open: async () => {
          await plant(page, w.owner.accountId, [
            { ventureId: w.startup.id, answers: [long, 'Hai'] },
          ])
          await settled(page, reviewUrl(w.startup.id))
        },
      },
      {
        name: 's04-incomplete',
        who: w.owner,
        key: '[data-publish-state="incomplete"]',
        open: async () => {
          await plant(page, w.owner.accountId, [{ ventureId: w.startup.id, answers: [long, ''] }])
          await settled(page, reviewUrl(w.startup.id))
        },
      },
      {
        name: 's04-submitted',
        who: w.owner,
        key: '[data-publish-state="submitted"]',
        open: async () => {
          await plant(page, w.owner.accountId, [
            { ventureId: w.startup.id, answers: [long, 'Hai'], status: 'SUBMITTED' },
          ])
          await settled(page, reviewUrl(w.startup.id))
        },
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
            'DEC-WF05-G1: MemberShell + WF04 demo frame, card chrome, S05 form and S07 checklist; no WF05 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
