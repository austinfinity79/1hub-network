import { randomUUID } from 'node:crypto'
import path from 'node:path'

import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
  type Request,
} from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'
import {
  applyVocabularyFixture,
  completedAccount,
  IDS,
  QA,
  watchConsole,
} from '../support/onboarding'
import { CORE, createVenture, freshAddress, invite, STAGE } from '../support/workspace'

/**
 * WF02-S05 — Project / Startup: the /projects/new wizard (PRJ1 → PRJ2 → PRJ3)
 * and the editor /projects/:id/edit. Decisions DEC-L2R-D4..D11 (required
 * fields, stage, creator role, levels, e-mailed invitations, idempotent
 * create, DRAFT only, inert AI block and link row), DEC-WF02-S05-G2..G5.
 * The PRJ1–PRJ3 pixel audits live in wf02-l2-revision.spec.ts.
 */

const VENTURES = '/api/v1/ventures'
const NIL = '00000000-0000-0000-0000-000000000000'
const REQUIRED = 'Trường này là bắt buộc.'

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

const member = (request: APIRequestContext, label: string) =>
  completedAccount(request, `s05-${label}`)

/** Another member, signed in in a browser context of their own. */
async function persona(browser: Browser, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  watchConsole(page, consoleErrors)
  const account = await member(page.request, label)
  return { context, page, request: page.request, ...account }
}

/** `who` joins the venture at `permission` through the real invite → accept path. */
async function join(
  owner: APIRequestContext,
  ventureId: string,
  who: { request: APIRequestContext; email: string },
  permission: 'EDIT' | 'VIEW',
) {
  const { membership_id } = await invite(owner, ventureId, {
    email: who.email,
    role_label: 'Thành viên',
    permission,
  })
  const accepted = await who.request.post(
    `${VENTURES}/${ventureId}/team/invitations/${membership_id}/accept`,
  )
  expect(accepted.status(), await accepted.text()).toBe(200)
  return membership_id
}

const wizard = (page: Page) => page.locator('[data-project-wizard]')
const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' })
const saveDraft = (page: Page) => page.getByRole('button', { name: 'Lưu nháp', exact: true })
const exitDraft = (page: Page) => page.getByRole('button', { name: 'Lưu nháp và thoát' })
const alerts = (page: Page) => page.locator('[data-step-form="info"] [role="alert"]')
const save = (page: Page) => page.getByRole('button', { name: 'Lưu', exact: true })

type Step1 = {
  type?: 'Dự án / ý tưởng' | 'Startup'
  name?: string
  domains?: string[]
  summary?: string
  stage?: string
  role?: string
}

/** PRJ1 as the member fills it: type card, name, field chips, description, stage, role. */
async function fillStep1(page: Page, v: Step1) {
  if (v.type) await page.getByRole('radio', { name: v.type, exact: true }).check({ force: true })
  if (v.name !== undefined) await page.locator('#ve-name').fill(v.name)
  if (v.domains?.length) {
    const picker = page.locator('[aria-controls="ve-domain-list"]')
    if ((await picker.getAttribute('aria-expanded')) !== 'true') await picker.click()
    for (const label of v.domains) {
      await page
        .locator('#ve-domain-list')
        .getByRole('button', { name: label, exact: true })
        .click()
    }
  }
  if (v.summary !== undefined) await page.locator('#ve-summary').fill(v.summary)
  if (v.stage) await page.getByRole('radio', { name: v.stage, exact: true }).check({ force: true })
  if (v.role) await page.getByRole('radio', { name: v.role, exact: true }).check({ force: true })
}

const posted = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST')
const patchedOf = (page: Page, id: string) =>
  page.waitForResponse(
    (r) => r.url().endsWith(`${VENTURES}/${id}`) && r.request().method() === 'PATCH',
  )

const ventureCount = async (profileId: string) =>
  (
    await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1',
      [profileId],
    )
  )[0]!.n

type StoredVenture = {
  type: string
  status: string
  name: string
  summary: string | null
  stage_id: string | null
  owner_role_label: string | null
  owner: string
  domains: string[]
  team_rows: number
}

async function stored(id: string): Promise<StoredVenture> {
  const [row] = await query<StoredVenture>(
    `SELECT p.type::text AS type, p.status::text AS status, p.name, p.summary,
            p.stage_id::text AS stage_id, p.owner_role_label, p.owner_profile_id::text AS owner,
            ARRAY(SELECT vocabulary_item_id::text FROM project_domains
                   WHERE project_id = p.id ORDER BY 1) AS domains,
            (SELECT count(*)::int FROM project_members WHERE project_id = p.id) AS team_rows
       FROM projects p WHERE p.id = $1`,
    [id],
  )
  return row!
}

async function audits(ventureId: string) {
  return query<{ action: string; after: Record<string, unknown>; payload: string }>(
    `SELECT action, after_data AS after,
            coalesce(before_data::text, '') || coalesce(after_data::text, '') AS payload
       FROM audit_events WHERE resource_type = 'project' AND resource_id::text = $1
      ORDER BY created_at, id`,
    [ventureId],
  )
}

test.describe('WF02-S05 guards', () => {
  test('guest → /auth on every route; every venture API 401', async ({ page, request }) => {
    for (const route of [
      '/projects',
      '/projects/new',
      `/projects/new?venture=${NIL}&step=team`,
      `/projects/${NIL}/edit`,
    ]) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/auth')
    }
    for (const r of [
      await request.post(VENTURES, { data: { type: 'PROJECT', name: 'x', ...CORE } }),
      await request.get(`${VENTURES}/${NIL}`),
      await request.patch(`${VENTURES}/${NIL}`, { data: { name: 'x' } }),
      await request.get('/api/v1/me/ventures'),
    ]) {
      expect(r.status(), r.url()).toBe(401)
    }
  })

  test('G2: onboarding not DONE → resolver step on the page, 403 on a complete create', async ({
    page,
  }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: freshAddress('s05-new') },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/projects/new')
    await expect(page).toHaveURL('/onboarding')
    const r = await page.request.post(VENTURES, { data: { type: 'PROJECT', name: 'x', ...CORE } })
    expect(r.status()).toBe(403)
    expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
  })
})

test.describe('WF02-S05 PRJ1 create', () => {
  test('the four required fields are checked before any request; a PROJECT is created DRAFT with its stage and role', async ({
    page,
  }) => {
    const m = await member(page.request, 'project')
    let posts = 0
    page.on('request', (r) => {
      if (r.url().endsWith(VENTURES) && r.method() === 'POST') posts += 1
    })
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await expect(wizard(page)).toHaveAttribute('data-step', 'info')
    await expect(page.locator('[data-anchor="stage"] label')).toHaveText([
      'Ý tưởng',
      'MVP',
      'Pilot / Thử nghiệm',
      'Đang bán',
      'Tăng trưởng',
    ])
    await expect(page.locator('[data-anchor="role"] input[type="radio"]')).toHaveCount(3)
    // PRJ1 starts with the first role chosen.
    await expect(page.getByRole('radio', { name: 'Founder', exact: true })).toBeChecked()

    // Nothing filled: every save refuses in place, naming the five fields.
    for (const action of [next(page), saveDraft(page), exitDraft(page)]) {
      await action.click()
      await expect(alerts(page)).toHaveCount(5)
      await expect(alerts(page)).toHaveText(Array(5).fill(REQUIRED))
    }
    await expect(page).toHaveURL('/projects/new')
    // Type and name alone are not enough.
    await fillStep1(page, { type: 'Dự án / ý tưởng', name: 'Tracely QA' })
    await next(page).click()
    await expect(alerts(page)).toHaveCount(3)
    expect(posts).toBe(0)
    expect(await ventureCount(m.profileId)).toBe(0)

    await fillStep1(page, {
      domains: ['Logistics'],
      summary: 'Theo dõi bưu kiện.',
      stage: 'Pilot / Thử nghiệm',
      role: 'Co-founder',
    })
    await expect(alerts(page)).toHaveCount(0)
    const response = posted(page)
    await next(page).click()
    const res = await response
    expect(res.status()).toBe(201)
    expect(res.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.request().postDataJSON()).toEqual({
      type: 'PROJECT',
      name: 'Tracely QA',
      summary: 'Theo dõi bưu kiện.',
      domain_ids: [QA.domain.logistics],
      stage_id: STAGE.pilot,
      owner_role_label: 'Co-founder',
    })
    const v = await res.json()
    expect(v).toMatchObject({
      type: 'PROJECT',
      status: 'DRAFT',
      name: 'Tracely QA',
      relation: 'OWNER',
      permission: 'OWNER',
      role_label: 'Co-founder',
      can_edit: true,
      stage: { id: STAGE.pilot, code: 'PILOT', label: 'Pilot / Thử nghiệm' },
    })
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=team`)
    // Owner = the session's profile, no team row for it; audit carries ids, type, status only.
    expect(await stored(v.id)).toEqual({
      type: 'PROJECT',
      status: 'DRAFT',
      name: 'Tracely QA',
      summary: 'Theo dõi bưu kiện.',
      stage_id: STAGE.pilot,
      owner_role_label: 'Co-founder',
      owner: m.profileId,
      domains: [QA.domain.logistics],
      team_rows: 0,
    })
    const trail = await audits(v.id)
    expect(trail.map((a) => a.action)).toEqual(['VENTURE_CREATED'])
    expect(trail[0]!.after).toEqual({ type: 'PROJECT', status: 'DRAFT' })
    expect(posts).toBe(1)

    // Reloaded, step 1 shows what was stored; the type is fixed.
    await page.goto(`/projects/new?venture=${v.id}&step=info`, { waitUntil: 'networkidle' })
    await expect(page.locator('#ve-name')).toHaveValue('Tracely QA')
    await expect(page.locator('#ve-summary')).toHaveValue('Theo dõi bưu kiện.')
    await expect(page.locator('[aria-controls="ve-domain-list"]')).toHaveText('Logistics')
    await expect(page.getByRole('radio', { name: 'Pilot / Thử nghiệm', exact: true })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Co-founder', exact: true })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Dự án / ý tưởng', exact: true })).toBeDisabled()
    await expect(page.locator('[data-nav="wizard-cancel"]')).toHaveCount(0)

    // The editor shows the same stage and role.
    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('#ve-stage')).toHaveValue(STAGE.pilot)
    await expect(page.locator('#ve-role')).toHaveValue('Co-founder')
    await expect(page.locator('[data-status]')).toHaveText('Bản nháp')

    // ME7 lists it as the member's own, draft and team-only.
    await page.goto('/projects', { waitUntil: 'networkidle' })
    const card = page.locator(`[data-venture="${v.id}"]`)
    await expect(card).toHaveAttribute('data-status', 'DRAFT')
    await expect(card.locator('[data-kind="type"]')).toHaveText('Dự án')
    await expect(card.locator('[data-kind="status"]')).toHaveText('Nháp · chỉ đội thấy')
    await expect(card.locator('[data-kind="permission"]')).toHaveText('Chủ sở hữu')
    await expect(card).toContainText('Giai đoạn: Pilot')
    await expect(card).toContainText('Co-founder')
    const mine = await (await page.request.get('/api/v1/me/ventures')).json()
    expect(mine.items).toEqual([
      expect.objectContaining({
        id: v.id,
        relation: 'OWNER',
        permission: 'OWNER',
        status: 'DRAFT',
      }),
    ])
  })

  test('a STARTUP with two fields keeps the default role Founder; PRJ3 states the facts and leads to the editor', async ({
    page,
  }) => {
    const m = await member(page.request, 'startup')
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await fillStep1(page, {
      type: 'Startup',
      name: 'Startup QA',
      domains: ['Logistics', 'AgriTech'],
      summary: 'Kho lạnh theo giờ.',
      stage: 'Ý tưởng',
    })
    const response = posted(page)
    await next(page).click()
    const v = await (await response).json()
    expect(v).toMatchObject({
      type: 'STARTUP',
      status: 'DRAFT',
      role_label: 'Founder',
      stage: { id: STAGE.idea },
    })
    expect(v.domains.map((d: { id: string }) => d.id).sort()).toEqual(
      [QA.domain.logistics, QA.domain.agritech].sort(),
    )
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=team`)
    expect((await stored(v.id)).owner).toBe(m.profileId)

    await page.getByRole('button', { name: 'Bỏ qua, mời sau' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=done`)
    const done = page.locator('[data-step-form="done"]')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Startup QA đã được tạo')
    await expect(done).toContainText('Startup')
    await expect(done).toContainText('Nháp · chỉ đội thấy')
    await expect(done).toContainText('Hồ sơ đang ở trạng thái nháp — chỉ đội của bạn nhìn thấy.')
    await expect(done.locator('[data-next="edit"]')).toContainText('Hoàn thiện hồ sơ startup')
    // No promise of review, publication or a completeness count (D-V1, D-V2).
    for (const claim of ['duyệt', 'công khai', 'xuất bản', '/48', 'lời mời đang chờ'])
      expect(await done.innerText(), claim).not.toContain(claim)
    await done.getByRole('link', { name: 'Hoàn thiện hồ sơ' }).click()
    await expect(page).toHaveURL(`/projects/${v.id}/edit`)
    await expect(page.locator('#ve-stage')).toHaveValue(STAGE.idea)
    await expect(page.locator('#ve-role')).toHaveValue('Founder')

    await page.goto('/projects', { waitUntil: 'networkidle' })
    const card = page.locator(`[data-venture="${v.id}"]`)
    await expect(card.locator('[data-kind="type"]')).toHaveText('Startup')
    await expect(card.locator('[data-kind="permission"]')).toHaveText('Chủ sở hữu')
  })

  test('POST /ventures re-checks every required field, the stage vocabulary and client authority keys; nothing is created', async ({
    page,
  }) => {
    const m = await member(page.request, 'api')
    const full: Record<string, unknown> = { type: 'STARTUP', name: 'API QA', ...CORE }
    const without = (key: string) =>
      Object.fromEntries(Object.entries(full).filter(([k]) => k !== key))
    const cases: [Record<string, unknown>, Record<string, string>][] = [
      [without('name'), { name: 'required' }],
      [{ ...full, name: '   ' }, { name: 'required' }],
      [without('summary'), { summary: 'required' }],
      [{ ...full, summary: '' }, { summary: 'required' }],
      [without('domain_ids'), { domain_ids: 'required' }],
      [{ ...full, domain_ids: [] }, { domain_ids: 'required' }],
      [without('stage_id'), { stage_id: 'required' }],
      [{ ...full, stage_id: null }, { stage_id: 'required' }],
      [{ ...full, stage_id: NIL }, { stage_id: 'unknown' }],
      [{ ...full, stage_id: QA.domain.logistics }, { stage_id: 'wrong_type' }],
      [{ ...full, domain_ids: [STAGE.idea] }, { domain_ids: 'wrong_type' }],
      [{ ...full, domain_ids: [QA.skill.data] }, { domain_ids: 'wrong_type' }],
      [{ ...full, domain_ids: [NIL] }, { domain_ids: 'unknown' }],
      [{ ...full, region_id: NIL }, { region_id: 'unknown' }],
      [{ ...full, region_id: QA.domain.logistics }, { region_id: 'wrong_type' }],
      [without('type'), { type: 'invalid' }],
      [{ ...full, type: 'COMPANY' }, { type: 'invalid' }],
      [{ ...full, owner_role_label: 'x'.repeat(101) }, { owner_role_label: 'too_long' }],
      // Owner, status, level and system fields are never the client's (DEC-L2R-D6).
      [{ ...full, owner_profile_id: m.profileId }, { owner_profile_id: 'not_accepted' }],
      [{ ...full, profile_id: m.profileId }, { profile_id: 'not_accepted' }],
      [{ ...full, status: 'ACTIVE' }, { status: 'not_accepted' }],
      [{ ...full, permission: 'OWNER' }, { permission: 'not_accepted' }],
      [{ ...full, relation: 'OWNER' }, { relation: 'not_accepted' }],
      [{ ...full, slug: 'mine' }, { slug: 'not_accepted' }],
    ]
    for (const [data, fields] of cases) {
      const r = await page.request.post(VENTURES, { data })
      expect(r.status(), JSON.stringify(data)).toBe(422)
      const { error } = await r.json()
      expect([error.code, error.fields], JSON.stringify(data)).toEqual([
        'PROFILE_VALIDATION_FAILED',
        fields,
      ])
    }
    const archived = await page.request.post(VENTURES, {
      data: { ...full, domain_ids: [QA.domain.archived] },
    })
    expect(archived.status()).toBe(422)
    expect((await archived.json()).error).toMatchObject({
      code: 'VOCABULARY_ITEM_INACTIVE',
      fields: { domain_ids: 'inactive' },
    })
    expect(await ventureCount(m.profileId)).toBe(0)

    // Later updates cannot clear a required value, change the type or write authority.
    const v = await createVenture(page.request, { type: 'PROJECT', name: 'Cố định' })
    const before = await stored(v.id)
    for (const [data, fields] of [
      [{ type: 'STARTUP' }, { type: 'immutable' }],
      [{ name: '' }, { name: 'required' }],
      [{ summary: null }, { summary: 'required' }],
      [{ stage_id: null }, { stage_id: 'required' }],
      [{ domain_ids: [] }, { domain_ids: 'required' }],
      [{ owner_profile_id: NIL }, { owner_profile_id: 'not_accepted' }],
      [{ status: 'ACTIVE' }, { status: 'not_accepted' }],
      [{ permission: 'OWNER' }, { permission: 'not_accepted' }],
    ] as const) {
      const r = await page.request.patch(`${VENTURES}/${v.id}`, { data })
      expect(r.status(), JSON.stringify(data)).toBe(422)
      expect((await r.json()).error.fields, JSON.stringify(data)).toEqual(fields)
    }
    expect(await stored(v.id)).toEqual(before)
  })

  test('Idempotency-Key: a repeated create returns the same venture; another body under the key is 409; keys are per account', async ({
    page,
    browser,
  }) => {
    const m = await member(page.request, 'idem')
    const body = { type: 'PROJECT', name: 'Một lần', ...CORE }
    const post = (request: APIRequestContext, data: object, key: string) =>
      request.post(VENTURES, { data, headers: { 'Idempotency-Key': key } })

    const key = randomUUID()
    const first = await post(page.request, body, key)
    expect(first.status()).toBe(201)
    const id = (await first.json()).id
    const again = await post(page.request, body, key)
    expect(again.status()).toBe(201)
    expect((await again.json()).id).toBe(id)
    const other = await post(page.request, { ...body, name: 'Khác' }, key)
    expect(other.status()).toBe(409)
    expect((await other.json()).error.code).toBe('UNCONTRACTED_IDEMPOTENCY_CONFLICT')
    expect(await ventureCount(m.profileId)).toBe(1)

    // Concurrent repeats of one key still make one venture.
    const burstKey = randomUUID()
    const burst = await Promise.all(
      [0, 1, 2].map(() => post(page.request, { ...body, name: 'Đồng thời' }, burstKey)),
    )
    expect(burst.map((r) => r.status())).toEqual([201, 201, 201])
    const ids = await Promise.all(burst.map(async (r) => (await r.json()).id as string))
    expect(new Set(ids).size).toBe(1)
    expect(await ventureCount(m.profileId)).toBe(2)

    // A refused create keeps nothing, so the corrected request under the same key succeeds.
    const retryKey = randomUUID()
    const refused = await post(page.request, { ...body, name: 'Sửa lại', summary: '' }, retryKey)
    expect(refused.status()).toBe(422)
    const corrected = await post(page.request, { ...body, name: 'Sửa lại' }, retryKey)
    expect(corrected.status()).toBe(201)
    expect(await ventureCount(m.profileId)).toBe(3)

    // Another account reusing the key gets its own venture, never a replay of this one.
    const stranger = await persona(browser, 'idem-other')
    const theirs = await post(stranger.request, body, key)
    expect(theirs.status()).toBe(201)
    const own = await theirs.json()
    expect(own.id).not.toBe(id)
    expect((await stored(own.id)).owner).toBe(stranger.profileId)
    expect(await ventureCount(m.profileId)).toBe(3)

    const [created] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events a JOIN projects p ON p.id::text = a.resource_id::text
        WHERE a.action = 'VENTURE_CREATED' AND p.owner_profile_id = $1`,
      [m.profileId],
    )
    expect(created!.n).toBe(3)
    await stranger.context.close()
  })

  test('a double "Tiếp tục" sends one create; its key replayed gives the same venture; refresh and back keep it', async ({
    page,
  }) => {
    const m = await member(page.request, 'double')
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    const creates: Request[] = []
    await page.route(`**${VENTURES}`, async (route) => {
      if (route.request().method() === 'POST') {
        creates.push(route.request())
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      await route.continue()
    })
    await fillStep1(page, {
      type: 'Dự án / ý tưởng',
      name: 'Một lần',
      domains: ['Logistics'],
      summary: 'Mô tả.',
      stage: 'Ý tưởng',
    })
    await next(page).dblclick()
    await expect(page).toHaveURL(/step=team$/)
    expect(creates).toHaveLength(1)
    await page.unroute(`**${VENTURES}`)
    const id = new URL(page.url()).searchParams.get('venture')!
    expect(await ventureCount(m.profileId)).toBe(1)

    // The wizard's own request, sent again as a retry would: the same venture.
    const replay = await page.request.post(VENTURES, {
      data: creates[0]!.postDataJSON(),
      headers: { 'Idempotency-Key': creates[0]!.headers()['idempotency-key']! },
    })
    expect(replay.status()).toBe(201)
    expect((await replay.json()).id).toBe(id)
    expect(await ventureCount(m.profileId)).toBe(1)

    // A refresh resumes the same record.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(wizard(page)).toHaveAttribute('data-step', 'team')
    // "Quay lại" edits the same record: the save is a PATCH, never a second POST.
    await page.getByRole('button', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${id}&step=info`)
    await page.locator('#ve-name').fill('Một lần 2')
    const patched = patchedOf(page, id)
    await next(page).click()
    expect((await patched).status()).toBe(200)
    await expect(page).toHaveURL(`/projects/new?venture=${id}&step=team`)
    // The browser's back button returns to the same venture.
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(`/projects/new?venture=${id}&step=team`)
    await expect(wizard(page)).toHaveAttribute('data-step', 'team')
    // On step 2 "Lưu nháp và thoát" leaves for the list; the record is kept.
    await page.locator('[data-nav="wizard-exit"]').click()
    await expect(page).toHaveURL('/projects')
    await expect(page.locator(`[data-venture="${id}"]`)).toContainText('Một lần 2')
    expect(await ventureCount(m.profileId)).toBe(1)
    expect((await stored(id)).name).toBe('Một lần 2')
  })

  test('"Lưu nháp" creates once then PATCHes; "Lưu nháp và thoát" saves and opens /projects; "Huỷ" saves nothing', async ({
    page,
  }) => {
    const m = await member(page.request, 'draft')
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Huỷ' }).click()
    await expect(page).toHaveURL('/projects')
    expect(await ventureCount(m.profileId)).toBe(0)

    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await fillStep1(page, {
      type: 'Startup',
      name: 'Nháp QA',
      domains: ['AgriTech'],
      summary: 'Nháp.',
      stage: 'MVP',
    })
    const response = posted(page)
    await saveDraft(page).click()
    const v = await (await response).json()
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=info`)
    await expect(page.locator('[data-step-form="info"] [role="status"]')).toContainText(
      'Đã lưu bản nháp lúc',
    )
    await page.locator('#ve-name').fill('Nháp QA 2')
    const patched = patchedOf(page, v.id)
    await exitDraft(page).click()
    expect((await patched).status()).toBe(200)
    await expect(page).toHaveURL('/projects')
    await expect(page.locator(`[data-venture="${v.id}"]`)).toContainText('Nháp QA 2')
    expect(await ventureCount(m.profileId)).toBe(1)
    expect(await stored(v.id)).toMatchObject({
      name: 'Nháp QA 2',
      status: 'DRAFT',
      type: 'STARTUP',
      stage_id: STAGE.mvp,
      owner_role_label: 'Founder',
    })
  })

  test('the AI block and the link row are drawn inert: not a control, no request', async ({
    page,
  }) => {
    await member(page.request, 'inert')
    const calls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/')) calls.push(`${r.method()} ${r.url()}`)
    })
    const assertInert = async (scope: string, label: string) => {
      const inert = page.locator(`${scope} [data-cta-kind="INERT"]`)
      await expect(inert).toHaveText(label)
      await expect(inert).toHaveAttribute('aria-disabled', 'true')
      await expect(inert).toHaveAttribute('aria-label', new RegExp(`^${label} — .+`))
      expect(await inert.evaluate((el) => [el.tagName, (el as HTMLElement).tabIndex])).toEqual([
        'SPAN',
        -1,
      ])
      await expect(page.locator(scope).getByRole('button')).toHaveCount(0)
      await expect(page.locator(scope).getByRole('link')).toHaveCount(0)
      await expect(page.locator(`${scope} input`)).toHaveCount(0)
      const url = page.url()
      calls.length = 0
      await inert.click({ force: true })
      await page.waitForLoadState('networkidle')
      expect(calls, `${label} sends nothing`).toEqual([])
      expect(page.url()).toBe(url)
    }

    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await assertInert('[data-ai-block]', 'Tải pitch deck')

    const v = await createVenture(page.request, { type: 'PROJECT', name: 'Link QA' })
    await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
    await assertInert('[data-invite-link]', 'Sao chép link')
    await expect(page.locator('[data-team-table] li')).toHaveCount(1)
    expect(await stored(v.id)).toMatchObject({ team_rows: 0 })
  })

  test('PRJ2: several addresses become one e-mailed invitation each with the chosen role and level; refusals keep the form', async ({
    page,
  }) => {
    const m = await member(page.request, 'prj2')
    const name = `Đội QA ${Date.now()}`
    const v = await createVenture(page.request, {
      type: 'PROJECT',
      name,
      owner_role_label: 'Founder',
    })
    await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
    const ownerRow = page.locator('[data-team-table] [data-row-kind="OWNER"]')
    for (const chip of ['Founder', 'Chủ sở hữu', 'Bạn']) await expect(ownerRow).toContainText(chip)
    await expect(page.locator('#team-invite-role option')).toHaveText([
      'Founder',
      'Co-founder',
      'Thành viên',
    ])
    await expect(page.locator('#team-invite-role')).toHaveValue('Co-founder')
    await expect(page.locator('#team-invite-permission option')).toHaveText(['Biên tập', 'Xem'])
    await expect(page.locator('#team-invite-permission')).toHaveValue('EDIT')
    await expect(page.locator('[data-anchor="levels"] li')).toHaveText([
      /^Chủ sở hữu — /,
      /^Biên tập — /,
      /^Xem — /,
    ])

    const [a, b] = [freshAddress('prj2-a'), freshAddress('prj2-b')]
    await page.locator('#team-invite-email').fill(`${a}, ${b.toUpperCase()}`)
    await page.locator('#team-invite-role').selectOption('Thành viên')
    await page.locator('#team-invite-permission').selectOption('VIEW')
    await page.getByRole('button', { name: 'Gửi lời mời' }).click()
    await expect(page.locator('[data-state="invite-sent"]')).toHaveText('Đã gửi lời mời.')
    const pending = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(pending).toHaveCount(2)
    for (const [i, address] of [a, b].entries()) {
      await expect(pending.nth(i)).toContainText(address)
      for (const chip of ['Thành viên', 'Xem', 'Chờ xác nhận'])
        await expect(pending.nth(i)).toContainText(chip)
    }
    await expect(page.locator('#team-invite-email')).toHaveValue('')
    const rows = await query<Record<string, unknown>>(
      `SELECT invite_email_normalized AS email, state::text AS state, permission, role_label,
              profile_id::text AS profile
         FROM project_members WHERE project_id = $1 ORDER BY invited_at, id`,
      [v.id],
    )
    expect(rows).toEqual(
      [a, b].map((email) => ({
        email,
        state: 'PENDING_CONFIRMATION',
        permission: 'VIEW',
        role_label: 'Thành viên',
        profile: null,
      })),
    )
    for (const address of [a, b]) {
      const mail = await page.request.get(
        `/dev/outbox/invitations?email=${encodeURIComponent(address)}`,
      )
      expect(mail.status()).toBe(200)
      const { subject, text, link } = await mail.json()
      // DEC-PDF-D4: the approved subject and sentence; the level is not in the e-mail.
      expect(subject).toBe(`Bạn được mời tham gia ${name} trên 1hub.network`)
      expect(text).toContain(` mời bạn tham gia ${name} với vai trò Thành viên.`)
      expect(text).toContain('Xem lời mời: ')
      expect(text).not.toContain('quyền')
      expect(new URL(link).pathname).toBe('/projects')
      expect(new URL(link).search).toBe('')
    }

    // Refusals name the reason and create nothing.
    const refusals: [string, string][] = [
      [a, 'Email này đã có một lời mời đang chờ.'],
      ['not-an-email', 'Email chưa hợp lệ.'],
      [m.email, 'Email chưa hợp lệ.'],
    ]
    for (const [value, message] of refusals) {
      await page.locator('#team-invite-email').fill(value)
      await page.getByRole('button', { name: 'Gửi lời mời' }).click()
      await expect(page.locator('#team-invite-error')).toHaveText(message)
      await expect(page.locator('#team-invite-email')).toHaveValue(value)
    }
    await expect(pending).toHaveCount(2)

    // Once an invitation waits, only "Hoàn tất" moves on; PRJ3 counts them.
    await expect(page.getByRole('button', { name: 'Bỏ qua, mời sau' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Hoàn tất' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=done`)
    const done = page.locator('[data-step-form="done"]')
    await expect(done).toContainText('2 lời mời đang chờ')
    await expect(done).toContainText('Nháp · chỉ đội thấy')
    await expect(done.locator('[data-next="edit"]')).toContainText('Hoàn thiện hồ sơ dự án')
    await page.getByRole('link', { name: 'Về Dự án & startup' }).click()
    await expect(page).toHaveURL('/projects')
  })
})

test.describe('WF02-S05 editor and permissions', () => {
  test('owner: name, stage, own role, region and fields persist after reload; a required value cannot be cleared; audit names fields only', async ({
    page,
  }) => {
    await member(page.request, 'edit-owner')
    const v = await createVenture(page.request, {
      type: 'PROJECT',
      name: 'Sửa QA',
      owner_role_label: 'Founder',
    })
    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('#ve-stage')).toHaveValue(STAGE.idea)
    await expect(page.locator('#ve-stage option:not([disabled])')).toHaveText([
      'Ý tưởng',
      'MVP',
      'Pilot / Thử nghiệm',
      'Đang bán',
      'Tăng trưởng',
    ])
    await expect(page.locator('#ve-role')).toHaveValue('Founder')
    await page.locator('#ve-name').fill('Sửa QA 2')
    await page.locator('#ve-stage').selectOption(STAGE.selling)
    await page.locator('#ve-role').selectOption('Co-founder')
    await page.locator('#ve-region').selectOption(IDS.danang)
    const patched = patchedOf(page, v.id)
    await save(page).click()
    const body = await (await patched).json()
    expect(body).toMatchObject({
      name: 'Sửa QA 2',
      stage: { id: STAGE.selling, label: 'Đang bán' },
      role_label: 'Co-founder',
      region: { id: IDS.danang },
    })
    await expect(page.locator('[data-status]')).toContainText('Bản nháp · đã lưu lúc')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('#ve-name')).toHaveValue('Sửa QA 2')
    await expect(page.locator('#ve-stage')).toHaveValue(STAGE.selling)
    await expect(page.locator('#ve-role')).toHaveValue('Co-founder')
    await expect(page.locator('#ve-region')).toHaveValue(IDS.danang)

    // A field is replaced and the optional region cleared; the fields cannot be emptied.
    await page.locator('[aria-controls="ve-domain-list"]').click()
    const chips = page.locator('#ve-domain-list')
    await chips.getByRole('button', { name: 'AgriTech', exact: true }).click()
    await chips.getByRole('button', { name: 'Logistics', exact: true }).click()
    await page.locator('#ve-region').selectOption('')
    const replaced = patchedOf(page, v.id)
    await save(page).click()
    const after = await (await replaced).json()
    expect([after.region, after.domains.map((d: { id: string }) => d.id)]).toEqual([
      null,
      [QA.domain.agritech],
    ])
    await chips.getByRole('button', { name: 'AgriTech', exact: true }).click()
    const emptied = patchedOf(page, v.id)
    await save(page).click()
    expect((await emptied).status()).toBe(422)
    await expect(page.getByRole('alert').filter({ hasText: REQUIRED })).toBeVisible()
    expect((await stored(v.id)).domains).toEqual([QA.domain.agritech])
    await chips.getByRole('button', { name: 'AgriTech', exact: true }).click()

    // DEC-L2R-D4: the description stays once given.
    await page.locator('#ve-summary').fill('')
    const refused = patchedOf(page, v.id)
    await save(page).click()
    expect((await refused).status()).toBe(422)
    await expect(page.getByRole('alert').filter({ hasText: REQUIRED })).toBeVisible()
    expect((await stored(v.id)).summary).toBe(CORE.summary)

    const trail = await audits(v.id)
    // Refused saves write nothing.
    expect(trail.map((a) => a.action)).toEqual([
      'VENTURE_CREATED',
      'VENTURE_UPDATED',
      'VENTURE_UPDATED',
    ])
    expect(trail[1]!.after).toEqual({
      status: 'DRAFT',
      fields: ['domain_ids', 'name', 'owner_role_label', 'region_id', 'stage_id', 'summary'],
    })
    for (const a of trail) expect(a.payload).not.toMatch(/Sửa QA|Co-founder|Founder|@/)
  })

  test('Biên tập edits name, summary and stage but not the owner role; Xem reads only; a stranger gets 404', async ({
    page,
    browser,
  }) => {
    await member(page.request, 'perm-owner')
    const v = await createVenture(page.request, {
      type: 'STARTUP',
      name: 'Quyền QA',
      owner_role_label: 'Founder',
    })
    const editor = await persona(browser, 'perm-edit')
    const viewer = await persona(browser, 'perm-view')
    const stranger = await persona(browser, 'perm-stranger')
    await join(page.request, v.id, editor, 'EDIT')
    await join(page.request, v.id, viewer, 'VIEW')
    const url = `${VENTURES}/${v.id}`

    expect(await (await editor.request.get(url)).json()).toMatchObject({
      relation: 'MEMBER',
      permission: 'EDIT',
      can_edit: true,
      role_label: 'Thành viên',
    })
    expect(await (await viewer.request.get(url)).json()).toMatchObject({
      relation: 'MEMBER',
      permission: 'VIEW',
      can_edit: false,
    })
    for (const [who, data] of [
      [editor, { owner_role_label: 'Co-founder' }],
      [viewer, { name: 'Hijack' }],
      [viewer, { stage_id: STAGE.growth }],
    ] as const) {
      const r = await who.request.patch(url, { data })
      expect(r.status(), JSON.stringify(data)).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
    for (const r of [
      await stranger.request.get(url),
      await stranger.request.patch(url, { data: { name: 'x' } }),
    ]) {
      expect(r.status()).toBe(404)
    }

    // Biên tập: the form without the owner's role; saves name, summary and stage.
    await editor.page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(editor.page.locator('#ve-role')).toHaveCount(0)
    await expect(editor.page.getByText('Vai trò của bạn trong đội')).toHaveCount(0)
    await editor.page.locator('#ve-name').fill('Quyền QA 2')
    await editor.page.locator('#ve-summary').fill('Biên tập đã sửa.')
    await editor.page.locator('#ve-stage').selectOption(STAGE.pilot)
    const patched = patchedOf(editor.page, v.id)
    await save(editor.page).click()
    const res = await patched
    expect(res.status()).toBe(200)
    expect(Object.keys(res.request().postDataJSON())).not.toContain('owner_role_label')
    await editor.page.reload({ waitUntil: 'networkidle' })
    await expect(editor.page.locator('#ve-name')).toHaveValue('Quyền QA 2')
    await expect(editor.page.locator('#ve-stage')).toHaveValue(STAGE.pilot)
    expect(await stored(v.id)).toMatchObject({
      name: 'Quyền QA 2',
      summary: 'Biên tập đã sửa.',
      stage_id: STAGE.pilot,
      owner_role_label: 'Founder',
    })

    // Xem: read-only notice, disabled fields, no save.
    await viewer.page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(viewer.page.locator('[data-state="read-only"]')).toHaveText(
      'Bạn có quyền Xem nên chỉ xem được hồ sơ này.',
    )
    await expect(save(viewer.page)).toHaveCount(0)
    for (const field of ['#ve-name', '#ve-summary', '#ve-stage', '#ve-region'])
      await expect(viewer.page.locator(field), field).toBeDisabled()
    await expect(viewer.page.locator('[aria-controls="ve-domain-list"]')).toBeDisabled()
    await expect(viewer.page.locator('#ve-role')).toHaveCount(0)

    // Only the owner reaches the wizard of the venture; a stranger sees nothing.
    for (const who of [editor, viewer, stranger]) {
      const res = await who.page.goto(`/projects/new?venture=${v.id}&step=info`)
      expect(res?.status()).toBe(404)
    }
    expect((await stranger.page.goto(`/projects/${v.id}/edit`))?.status()).toBe(404)
    await expect(stranger.page.locator('body')).not.toContainText('Quyền QA')
    for (const who of [editor, viewer, stranger]) await who.context.close()
  })

  test('ARCHIVED is read-only for the owner and for Biên tập, on the page and the API', async ({
    page,
    browser,
  }) => {
    await member(page.request, 'arch-owner')
    const v = await createVenture(page.request, { type: 'PROJECT', name: 'Lưu trữ QA' })
    const editor = await persona(browser, 'arch-edit')
    await join(page.request, v.id, editor, 'EDIT')
    // No archive action exists in P0; the lifecycle state is set as a fixture.
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])

    for (const request of [page.request, editor.request]) {
      const r = await request.patch(`${VENTURES}/${v.id}`, { data: { name: 'Không' } })
      expect(r.status()).toBe(409)
      expect((await r.json()).error.code).toBe('PROFILE_DEACTIVATED')
      expect((await (await request.get(`${VENTURES}/${v.id}`)).json()).can_edit).toBe(false)
    }
    const late = await page.request.post(`${VENTURES}/${v.id}/team/invitations`, {
      data: { email: freshAddress('late') },
    })
    expect(late.status()).toBe(409)

    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="read-only"]')).toContainText('lưu trữ')
    await expect(save(page)).toHaveCount(0)
    await expect(page.locator('#ve-name')).toBeDisabled()
    await expect(page.locator('#ve-stage')).toBeDisabled()
    await expect(page.locator('[data-status]')).toHaveText('Đã lưu trữ')
    expect((await page.goto(`/projects/new?venture=${v.id}&step=info`))?.status()).toBe(404)
    await editor.context.close()
  })

  test('the wizard URL never reaches a venture the member does not own; headers grant nothing', async ({
    page,
    browser,
  }) => {
    const owner = await persona(browser, 'w-owner')
    const theirs = await createVenture(owner.request, {
      type: 'PROJECT',
      name: 'Không phải của bạn',
    })
    const me = await member(page.request, 'w-me')

    // A stranger, a Biên tập member and malformed ids all get the same 404.
    const stranger = await page.goto(`/projects/new?venture=${theirs.id}&step=team`)
    expect(stranger?.status()).toBe(404)
    await join(owner.request, theirs.id, { request: page.request, email: me.email }, 'EDIT')
    for (const url of [
      `/projects/new?venture=${theirs.id}&step=info`,
      `/projects/new?venture=${theirs.id}&step=team`,
      `/projects/new?venture=${theirs.id}&step=done`,
      '/projects/new?venture=------------------------------------&step=team',
      '/projects/new?venture=not-a-uuid',
    ]) {
      const res = await page.goto(url)
      expect(res?.status(), url).toBe(404)
      await expect(page.locator('body')).not.toContainText('Không phải của bạn')
    }
    // Header spoofing grants nothing: the session decides.
    const spoof = await page.request.get(`/projects/new?venture=${theirs.id}&step=team`, {
      headers: {
        'x-account-id': owner.accountId,
        'x-profile-id': owner.profileId,
        'x-role': 'PLATFORM_ADMIN',
        'x-permission': 'OWNER',
      },
    })
    expect(spoof.status()).toBe(404)
    // The owner's own venture with an unknown step opens step 1.
    const own = await createVenture(page.request, { type: 'PROJECT', name: 'Của tôi' })
    await page.goto(`/projects/new?venture=${own.id}&step=nope`, { waitUntil: 'networkidle' })
    await expect(wizard(page)).toHaveAttribute('data-step', 'info')
    await expect(page.locator('#ve-name')).toHaveValue('Của tôi')
    await owner.context.close()
  })

  test('a stranger opening the edit page gets 404; the DTO carries no slug, owner or profile id', async ({
    page,
    browser,
  }) => {
    const owner = await persona(browser, 'dto-owner')
    const v = await createVenture(owner.request, {
      type: 'PROJECT',
      name: 'Private',
      owner_role_label: 'Founder',
    })
    await member(page.request, 'dto-stranger')
    const res = await page.goto(`/projects/${v.id}/edit`)
    expect(res?.status()).toBe(404)
    await expect(page.locator('body')).not.toContainText('Private')
    const [row] = await query<{ slug: string }>('SELECT slug FROM projects WHERE id = $1', [v.id])
    const own = await (await owner.request.get(`${VENTURES}/${v.id}`)).json()
    const json = JSON.stringify(own)
    for (const leak of [row!.slug, owner.profileId, owner.accountId, owner.email])
      expect(json).not.toContain(leak)
    expect(Object.keys(own).sort()).toEqual([
      'can_edit',
      'domains',
      'id',
      'name',
      'permission',
      'region',
      'relation',
      'role_label',
      'stage',
      'status',
      'summary',
      'type',
      // DEC-PDF-D1 (API §20.1).
      'visibility',
    ])
    await owner.context.close()
  })
})

test.describe('WF02-S05 pixel QA', () => {
  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S05')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S05')!, {
      afterLoad: async (p) => {
        await expect(p.locator('[data-venture-editor]')).toBeVisible()
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    // DEC-L2R-D4..D6: "Giai đoạn" and "Vai trò của bạn trong đội" lengthen the one
    // form, so it ends below the reference height; nothing else may continue there.
    const form = await page.locator('[data-contract="venture-form"]').evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }
    })
    const below = full.below_reference!.unexpected_bbox
    if (below) {
      expect(below.x, 'UI below the reference height, left of the form').toBeGreaterThanOrEqual(
        Math.floor(form.x),
      )
      expect(
        below.x + below.width,
        'UI below the reference height, right of the form',
      ).toBeLessThanOrEqual(Math.ceil(form.x + form.width))
      expect(below.y + below.height, 'UI below the form').toBeLessThanOrEqual(
        Math.ceil(form.y + form.height),
      )
    }

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const TEXT: Rect[] = [{ x: 60, y: 20, width: 300, height: 46 }]
    // INTENTIONAL-P0-SCOPE: "Xem bản public" + "Gửi HUB duyệt"; INTENTIONAL-CONTRACT: "Lưu".
    const ACTIONS: Rect = { x: 1068, y: 14, width: 314, height: 56 }
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S05.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      [{ name: 'editor-header', reference: { x: 0, y: 0, width: 1440, height: 90 }, dy: 0 }],
      [...TEXT, ACTIONS],
      { diffPath },
    )
    writeJsonReport('WF02-S05.segments.json', {
      screen_id: 'WF02-S05',
      state: qaConfigFor('WF02-S05')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference, form },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: ACTIONS,
          reason:
            'DEC-WF02-H3/H6, DEC-L2R-D10: "Xem bản public" and "Gửi HUB duyệt" not rendered (no public eligibility rule, D-V1); "Lưu" in their place (G1)',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 113, width: 1312, height: 72 },
          reason: 'DEC-WF02-H6, D-V2: required-field progress card not rendered',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 200, width: 1312, height: 630 },
          reason:
            'DEC-WF02-H6: A–J navigator, section C (C1–C5, image upload) and editorial rules not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S05-G1, DEC-L2R-D4..D6: canonical form (Loại, Tên, Tóm tắt, Lĩnh vực, Giai đoạn, Vai trò của bạn trong đội for the owner, Tỉnh / Thành phố) in S02 field language; not compared',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-L2R-D4..D6: the "Giai đoạn" and "Vai trò của bạn trong đội" fields make the form longer than the reference; below the reference height only the form column continues (asserted against the form box)',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason: 'header status shows the lifecycle label instead of the unsupported completion %',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'title/status glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
