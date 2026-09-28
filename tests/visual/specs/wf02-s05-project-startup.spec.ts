import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { auditRevision } from '../pixel-qa/revision'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S05 — Project / Startup (/projects/new, /projects/:id/edit).
 * Decisions DEC-WF02-H6/H7, DEC-WF02-S05-G1..G5, DEC-WF02-S05-D1..D3; the
 * create flow is the corrected L13a–c wizard (TASK 22.3, DEC-L2-D1..D5).
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const REGION_2 = '20000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SKILL = '20000000-0000-0000-0000-000000000021'
const VENTURES = '/api/v1/ventures'

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
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

type Member = { email: string; accountId: string; profileId: string }

async function completedMember(request: APIRequestContext, label = 's05'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (await request.put('/api/v1/me/onboarding/intent', { data: { action: 'SKIP' } })).ok(),
  ).toBe(true)
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        data: { display_name: 'Chi', headline: 'QA', region_id: REGION, domain_ids: [DOMAIN] },
      })
    ).status(),
  ).toBe(200)
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    expect(
      (
        await request.post('/api/v1/me/consents/accept', {
          data: { consent_type: doc.type, policy_version: doc.version },
        })
      ).ok(),
    ).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

const editor = (page: Page) => page.locator('[data-venture-editor]')
const save = (page: Page) => page.getByRole('button', { name: 'Lưu', exact: true })
const wizard = (page: Page) => page.locator('[data-project-wizard]')
const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' })
const ventureCount = async (profileId: string) =>
  (
    await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1',
      [profileId],
    )
  )[0]!.n

test.describe('WF02-S05 guards', () => {
  test('guest → /auth on both routes; API 401', async ({ page, request }) => {
    for (const route of ['/projects/new', '/projects/00000000-0000-0000-0000-000000000000/edit']) {
      await page.goto(route)
      await expect(page).toHaveURL('/auth')
    }
    expect((await request.post(VENTURES, { data: { type: 'PROJECT', name: 'x' } })).status()).toBe(
      401,
    )
    expect((await request.get(`${VENTURES}/00000000-0000-0000-0000-000000000000`)).status()).toBe(
      401,
    )
    expect(
      (
        await request.patch(`${VENTURES}/00000000-0000-0000-0000-000000000000`, { data: {} })
      ).status(),
    ).toBe(401)
  })

  test('G2: onboarding not DONE → resolver step on the page, 403 on create', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s05-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/projects/new')
    await expect(page).toHaveURL('/onboarding/purpose')
    const r = await page.request.post(VENTURES, { data: { type: 'PROJECT', name: 'x' } })
    expect(r.status()).toBe(403)
    expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
  })
})

test.describe('WF02-S05 create and edit', () => {
  test('1/3/4/13/23. create a PROJECT through the wizard, then edit and refresh', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await expect(wizard(page)).toHaveAttribute('data-step', 'info')
    const text = await page.locator('body').innerText()
    // Bucket B / out of P0 (DEC-L2-D2): no stage, AI, deck, review or public claims.
    for (const banned of [
      'Data room',
      'gọi vốn',
      'Giai đoạn',
      'pitch deck',
      'Gửi HUB duyệt',
      'Chuyển thành startup',
      'mã số doanh nghiệp',
    ])
      expect(text, banned).not.toContain(banned)

    // Required fields are checked before any request.
    let posts = 0
    page.on('request', (r) => {
      if (r.url().endsWith(VENTURES) && r.method() === 'POST') posts += 1
    })
    await next(page).click()
    await expect(page.getByText('Trường này là bắt buộc.').first()).toBeVisible()
    expect(posts).toBe(0)

    await page.getByRole('radio', { name: 'Dự án / ý tưởng' }).check()
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Tracely QA')
    await page.getByLabel('Một dòng mô tả').fill('Theo dõi bưu kiện.')
    const created = page.waitForResponse(
      (r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST',
    )
    await next(page).click()
    const res = await created
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      type: 'PROJECT',
      status: 'DRAFT',
      name: 'Tracely QA',
      summary: 'Theo dõi bưu kiện.',
      relation: 'OWNER',
    })
    await expect(page).toHaveURL(`/projects/new?venture=${body.id}&step=team`)
    await expect(wizard(page)).toHaveAttribute('data-step', 'team')
    const [row] = await query<{ owner: string }>(
      'SELECT owner_profile_id::text AS owner FROM projects WHERE id = $1',
      [body.id],
    )
    expect(row!.owner).toBe(m.profileId)
    expect(
      await query('SELECT 1 FROM project_members WHERE project_id = $1', [body.id]),
    ).toHaveLength(0)

    // Back to step 1 edits the same record: the type is fixed, the save is a PATCH.
    await page.getByRole('button', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${body.id}&step=info`)
    await expect(page.getByRole('radio', { name: 'Dự án / ý tưởng' })).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Huỷ' })).toHaveCount(0)
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Tracely QA 2')
    const patched = page.waitForResponse(
      (r) => r.url().endsWith(`${VENTURES}/${body.id}`) && r.request().method() === 'PATCH',
    )
    await next(page).click()
    expect((await patched).status()).toBe(200)
    await expect(page).toHaveURL(`/projects/new?venture=${body.id}&step=team`)

    // A refresh resumes the same venture; nothing is created twice.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(wizard(page)).toHaveAttribute('data-step', 'team')
    expect(posts).toBe(1)
    expect(await ventureCount(m.profileId)).toBe(1)

    await page.getByRole('button', { name: 'Bỏ qua, mời sau' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${body.id}&step=done`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tracely QA 2 đã được tạo')
    await page.getByRole('link', { name: 'Hoàn thiện hồ sơ' }).click()
    await expect(page).toHaveURL(`/projects/${body.id}/edit`)
    await expect(editor(page)).toBeVisible()
    await expect(page.getByLabel('Tên')).toHaveValue('Tracely QA 2')
    await page.getByLabel('Tên').fill('Tracely QA 3')
    await save(page).click()
    await expect(page.locator('[data-status]')).toContainText('Bản nháp · đã lưu lúc')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByLabel('Tên')).toHaveValue('Tracely QA 3')
  })

  test('2/5/6/7/14/15/16. STARTUP with region and domains; replace and clear', async ({ page }) => {
    await completedMember(page.request)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Startup' }).check()
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Startup QA')
    await page.getByLabel('Tỉnh / Thành phố').selectOption(REGION)
    await page.getByRole('button', { name: 'Lĩnh vực' }).click()
    await page.getByRole('list', { name: 'Lĩnh vực' }).getByRole('button').first().click()
    const created = page.waitForResponse(
      (r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST',
    )
    await next(page).click()
    const body = await (await created).json()
    expect(body.type).toBe('STARTUP')
    expect(body.region.id).toBe(REGION)
    expect(body.domains).toHaveLength(1)
    await expect(page).toHaveURL(`/projects/new?venture=${body.id}&step=team`)

    await page.goto(`/projects/${body.id}/edit`, { waitUntil: 'networkidle' })
    await page.getByLabel('Tỉnh / Thành phố').selectOption(REGION_2)
    const patched = page.waitForResponse(
      (r) => r.url().endsWith(`${VENTURES}/${body.id}`) && r.request().method() === 'PATCH',
    )
    await save(page).click()
    expect((await (await patched).json()).region.id).toBe(REGION_2)

    await page.getByLabel('Tỉnh / Thành phố').selectOption('')
    await page.getByRole('button', { name: 'Lĩnh vực' }).click()
    await page.getByRole('list', { name: 'Lĩnh vực' }).locator('[aria-pressed="true"]').click()
    const cleared = page.waitForResponse(
      (r) => r.url().endsWith(`${VENTURES}/${body.id}`) && r.request().method() === 'PATCH',
    )
    await save(page).click()
    const after = await (await cleared).json()
    expect([after.region, after.domains]).toEqual([null, []])
  })

  test('8–12/17/18. invalid taxonomy, type change and owner spoof are refused', async ({
    page,
    playwright,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's05-other')
    await completedMember(page.request)
    for (const [data, code] of [
      [
        { type: 'PROJECT', name: 'x', region_id: '00000000-0000-0000-0000-000000000000' },
        'PROFILE_VALIDATION_FAILED',
      ],
      [{ type: 'PROJECT', name: 'x', region_id: DOMAIN }, 'PROFILE_VALIDATION_FAILED'],
      [
        { type: 'PROJECT', name: 'x', domain_ids: ['00000000-0000-0000-0000-000000000000'] },
        'PROFILE_VALIDATION_FAILED',
      ],
      [{ type: 'PROJECT', name: 'x', domain_ids: [SKILL] }, 'PROFILE_VALIDATION_FAILED'],
      [
        { type: 'PROJECT', name: 'x', owner_profile_id: other.profileId },
        'PROFILE_VALIDATION_FAILED',
      ],
      [{ type: 'PROJECT', name: 'x', status: 'ACTIVE' }, 'PROFILE_VALIDATION_FAILED'],
    ] as const) {
      const r = await page.request.post(VENTURES, { data })
      expect(r.status(), JSON.stringify(data)).toBe(422)
      expect((await r.json()).error.code).toBe(code)
    }
    const v = await (
      await page.request.post(VENTURES, { data: { type: 'STARTUP', name: 'Own' } })
    ).json()
    const typeChange = await page.request.patch(`${VENTURES}/${v.id}`, {
      data: { type: 'PROJECT' },
    })
    expect(typeChange.status()).toBe(422)
    expect((await typeChange.json()).error.fields).toEqual({ type: 'immutable' })
    expect(
      await query('SELECT 1 FROM projects WHERE owner_profile_id = $1', [other.profileId]),
    ).toHaveLength(0)
    await otherCtx.dispose()
  })

  test('19/20/22. members read-only, strangers 404, ACTIVE editable, ARCHIVED read-only', async ({
    page,
    playwright,
  }) => {
    const owner = await completedMember(page.request, 's05-owner')
    const v = await (
      await page.request.post(VENTURES, { data: { type: 'STARTUP', name: 'Shared' } })
    ).json()
    const memberCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const teammate = await completedMember(memberCtx, 's05-mate')
    const strangerCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(strangerCtx, 's05-stranger')
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state) VALUES ($1, $2, 'Owner', 'ACTIVE')`,
      [v.id, teammate.profileId],
    )

    const seen = await (await memberCtx.get(`${VENTURES}/${v.id}`)).json()
    expect([seen.relation, seen.can_edit]).toEqual(['MEMBER', false])
    const denied = await memberCtx.patch(`${VENTURES}/${v.id}`, { data: { name: 'Hijack' } })
    expect(denied.status()).toBe(403)
    expect((await denied.json()).error.code).toBe('SCOPE_FORBIDDEN')
    for (const r of [
      await strangerCtx.get(`${VENTURES}/${v.id}`),
      await strangerCtx.patch(`${VENTURES}/${v.id}`, { data: { name: 'x' } }),
    ]) {
      expect(r.status()).toBe(404)
    }

    await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [v.id])
    expect(
      (await page.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'Active edit' } })).status(),
    ).toBe(200)
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    const archived = await page.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'No' } })
    expect(archived.status()).toBe(409)
    expect((await archived.json()).error.code).toBe('PROFILE_DEACTIVATED')

    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="read-only"]')).toContainText('lưu trữ')
    await expect(save(page)).toHaveCount(0)
    await expect(page.getByLabel('Tên')).toBeDisabled()
    await expect(page.locator('[data-status]')).toHaveText('Đã lưu trữ')
    void owner
    await memberCtx.dispose()
    await strangerCtx.dispose()
  })

  test('a stranger opening the edit page gets 404; no metadata or slug reaches the page', async ({
    page,
    playwright,
  }) => {
    const ownerCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(ownerCtx, 's05-o')
    const v = await (
      await ownerCtx.post(VENTURES, { data: { type: 'PROJECT', name: 'Private' } })
    ).json()
    await completedMember(page.request, 's05-s')
    const res = await page.goto(`/projects/${v.id}/edit`)
    expect(res?.status()).toBe(404)
    const [row] = await query<{ slug: string }>('SELECT slug FROM projects WHERE id = $1', [v.id])
    const own = await (await ownerCtx.get(`${VENTURES}/${v.id}`)).json()
    expect(JSON.stringify(own)).not.toContain(row!.slug)
    expect(Object.keys(own).sort()).toEqual([
      'can_edit',
      'domains',
      'id',
      'name',
      'region',
      'relation',
      'status',
      'summary',
      'type',
    ])
    await ownerCtx.dispose()
  })
})

/** Creates a venture and two pending invitations over the existing APIs. */
async function seededVenture(request: APIRequestContext) {
  const v = await (
    await request.post(VENTURES, {
      data: {
        type: 'PROJECT',
        name: 'Kho lạnh chia sẻ',
        summary: 'Chia sẻ kho lạnh theo giờ cho hộ kinh doanh nông sản nhỏ',
      },
    })
  ).json()
  for (const [email, role] of [
    ['tuan.le@example.test', 'Co-founder'],
    ['thao.nguyen@example.test', 'Thành viên'],
  ]) {
    const r = await request.post(`${VENTURES}/${v.id}/team/invitations`, {
      data: { email, role_label: role },
    })
    expect(r.status()).toBe(201)
  }
  return v as { id: string }
}

test.describe('L13 wizard (TASK 22.3)', () => {
  test('"Lưu nháp" creates once then PATCHes; "Lưu nháp và thoát" saves and leaves', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Startup' }).check()
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Nháp QA')
    const posted = page.waitForResponse(
      (r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click()
    const v = await (await posted).json()
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=info`)
    await expect(page.getByRole('status')).toContainText('Đã lưu bản nháp lúc')
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Nháp QA 2')
    const patched = page.waitForResponse(
      (r) => r.url().endsWith(`${VENTURES}/${v.id}`) && r.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Lưu nháp và thoát' }).click()
    expect((await patched).status()).toBe(200)
    await expect(page).toHaveURL('/me')
    expect(await ventureCount(m.profileId)).toBe(1)
    const [row] = await query<{ name: string; status: string }>(
      'SELECT name, status::text AS status FROM projects WHERE id = $1',
      [v.id],
    )
    expect(row).toEqual({ name: 'Nháp QA 2', status: 'DRAFT' })
  })

  test('repeated "Tiếp tục" clicks send one POST; "Huỷ" leaves without saving', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Huỷ' }).click()
    await expect(page).toHaveURL('/me')
    expect(await ventureCount(m.profileId)).toBe(0)

    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    let posts = 0
    await page.route(`**${VENTURES}`, async (route) => {
      if (route.request().method() === 'POST') posts += 1
      await new Promise((r) => setTimeout(r, 400))
      await route.continue()
    })
    await page.getByRole('radio', { name: 'Dự án / ý tưởng' }).check()
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Một lần')
    await next(page).dblclick()
    await expect(page).toHaveURL(/step=team/)
    expect(posts).toBe(1)
    expect(await ventureCount(m.profileId)).toBe(1)
  })

  test('team step: invite over the existing API, duplicate refused, no email claim, DTO only', async ({
    page,
  }) => {
    await completedMember(page.request)
    const v = await (
      await page.request.post(VENTURES, { data: { type: 'PROJECT', name: 'Đội QA' } })
    ).json()
    await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-row-kind="OWNER"]')).toContainText('Chủ sở hữu')
    await page.getByLabel('Email thành viên').fill('invitee@example.test')
    await page.getByLabel('Vai trò').fill('CTO')
    const created = page.waitForResponse(
      (r) => r.url().endsWith(`/team/invitations`) && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    expect((await created).status()).toBe(201)
    const pending = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(pending).toContainText('invitee@example.test')
    await expect(pending).toContainText('Chờ xác nhận')
    await expect(page.locator('[data-state="invite-created"]')).toContainText(
      'Chưa có email nào được gửi',
    )
    // Once an invitation is pending, only "Hoàn tất" moves on.
    await expect(page.getByRole('button', { name: 'Bỏ qua, mời sau' })).toHaveCount(0)

    await page.getByLabel('Email thành viên').fill('invitee@example.test')
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.locator('[data-invite-form]').getByRole('alert')).toHaveText(
      'Email này đã có một lời mời đang chờ.',
    )
    await page.getByLabel('Email thành viên').fill('not-an-email')
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.locator('[data-invite-form]').getByRole('alert')).toHaveText(
      'Email chưa hợp lệ.',
    )

    const text = await page.locator('main').innerText()
    for (const banned of ['Biên tập', 'Sao chép link', 'BA MỨC QUYỀN', 'sẽ nhận email'])
      expect(text, banned).not.toContain(banned)
    const rows = await query<{ state: string; email: string }>(
      `SELECT state::text AS state, invite_email_normalized AS email FROM project_members WHERE project_id = $1`,
      [v.id],
    )
    expect(rows).toEqual([{ state: 'PENDING_CONFIRMATION', email: 'invitee@example.test' }])

    await page.getByRole('button', { name: 'Hoàn tất' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${v.id}&step=done`)
    await expect(page.locator('[data-step-form="done"]')).toContainText('1 lời mời đang chờ')
    await expect(page.locator('[data-step-form="done"]')).toContainText('Nháp · chỉ đội thấy')
    for (const banned of ['Hồ sơ 6/48', 'Tìm bài toán', 'Xem hồ sơ như người khác thấy'])
      await expect(page.getByText(banned)).toHaveCount(0)
    await page.getByRole('link', { name: 'Về Tài khoản của tôi' }).click()
    await expect(page).toHaveURL('/me')
  })

  test('the wizard URL never reaches a venture the member does not own', async ({
    page,
    playwright,
  }) => {
    const ownerCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(ownerCtx, 's05-w-owner')
    const theirs = await (
      await ownerCtx.post(VENTURES, { data: { type: 'PROJECT', name: 'Không phải của bạn' } })
    ).json()
    const me = await completedMember(page.request, 's05-w-me')

    // A stranger, an ACTIVE member (read-only) and malformed ids all get the same 404.
    const stranger = await page.goto(`/projects/new?venture=${theirs.id}&step=team`)
    expect(stranger?.status()).toBe(404)
    await query(
      `INSERT INTO project_members (project_id, profile_id, state) VALUES ($1, $2, 'ACTIVE')`,
      [theirs.id, me.profileId],
    )
    for (const url of [
      `/projects/new?venture=${theirs.id}&step=info`,
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
      headers: { 'x-account-id': 'x', 'x-org-id': 'x', 'x-role': 'PLATFORM_ADMIN' },
    })
    expect(spoof.status()).toBe(404)
    // The owner's own venture with an unknown step opens step 1.
    const own = await (
      await page.request.post(VENTURES, { data: { type: 'PROJECT', name: 'Của tôi' } })
    ).json()
    await page.goto(`/projects/new?venture=${own.id}&step=nope`, { waitUntil: 'networkidle' })
    await expect(wizard(page)).toHaveAttribute('data-step', 'info')
    await expect(page.getByLabel('Tên dự án hoặc tên startup')).toHaveValue('Của tôi')
    await ownerCtx.dispose()
  })

  test('guest → /auth even with a venture in the URL', async ({ page }) => {
    await page.goto('/projects/new?venture=00000000-0000-0000-0000-000000000000&step=team')
    await expect(page).toHaveURL('/auth')
  })
})

test.describe('L13 pixel QA (corrected L13a–c subset)', () => {
  const REF = {
    a: 'design-reference/final/revision/L2/L13a__project-create-core__SOURCE.png',
    b: 'design-reference/final/revision/L2/L13b__project-create-team__SOURCE.png',
    c: 'design-reference/final/revision/L2/L13c__project-create-done__SOURCE.png',
  } as const
  const INTENTIONAL = [
    {
      class: 'INTENTIONAL-SCOPE',
      reason:
        'DEC-L2-D2: stage, pitch-deck AI, the creator role and the SUB0 box are Bucket B; the fields sit in the card column',
    },
    {
      class: 'INTENTIONAL-COPY',
      reason:
        'DEC-L2-D2/D3/D4: claims P0 does not keep are dropped (type change later, extra startup fields, link invites, emails, review / public)',
    },
    { class: 'INTENTIONAL-SCOPE', reason: 'HD-11: no floating "Góp ý" button' },
  ]
  const box = (page: Page, selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: Math.round(r.x),
          y: Math.round(r.y + scrollY),
          width: Math.round(r.width),
          height: Math.round(r.height),
        }
      })
  const cardTop = async (page: Page) => (await box(page, '[data-ui="surface"]')).y

  test('L13a step 1 at 1440×900: header, card head, name field, footer', async ({ page }) => {
    await completedMember(page.request, 's05-px-a')
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Dự án / ý tưởng' }).check()
    await page.getByLabel('Tên dự án hoặc tên startup').fill('Kho lạnh chia sẻ')
    await page
      .getByLabel('Một dòng mô tả')
      .fill('Chia sẻ kho lạnh theo giờ cho hộ kinh doanh nông sản nhỏ')
    await page.locator('h1').click()
    const top = await cardTop(page)
    const input = await box(page, '#ve-name')
    const footer = await box(page, '[data-step-form="info"] > div:last-child')
    const startupBody = await box(page, '[data-checked="false"] span span:last-child')
    await auditRevision(page, {
      name: 'WF02-S05.L13a',
      reference: REF.a,
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 300, y: 112, width: 840, height: 265 },
          dy: top - 113,
        },
        {
          name: 'name-field',
          reference: { x: 355, y: 600, width: 400, height: 100 },
          dx: input.x - 360,
          dy: input.y - 630,
        },
        {
          name: 'footer',
          reference: { x: 300, y: 1170, width: 840, height: 125 },
          dy: footer.y - 1178,
        },
      ],
      // The startup card's second sentence is not kept (DEC-L2-D2).
      exclude: [{ ...startupBody, height: startupBody.height + 22 }],
      intentional: INTENTIONAL,
    })
  })

  test('L13b step 2 at 1440×900: header, title, invite row, team head, pending pill, back', async ({
    page,
  }) => {
    await completedMember(page.request, 's05-px-b')
    const v = await seededVenture(page.request)
    await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
    const top = await cardTop(page)
    const email = await box(page, '#team-invite-email')
    const head = await box(page, '[data-team-table]')
    const pill = await box(
      page,
      '[data-row-kind="PENDING_INVITATION"] span:last-child span:last-child',
    )
    const footer = await box(page, '[data-step-form="team"] > div:last-child')
    await auditRevision(page, {
      name: 'WF02-S05.L13b',
      reference: REF.b,
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        { name: 'title', reference: { x: 300, y: 112, width: 840, height: 82 }, dy: top - 113 },
        {
          name: 'invite-email',
          reference: { x: 336, y: 266, width: 330, height: 82 },
          dy: email.y - 296,
        },
        {
          name: 'team-head',
          reference: { x: 336, y: 456, width: 768, height: 26 },
          dy: head.y - 481,
        },
        {
          name: 'pending-pill',
          reference: { x: 982, y: 567, width: 120, height: 22 },
          dx: pill.x - 985,
          dy: pill.y - 565,
        },
        {
          name: 'footer-back',
          reference: { x: 300, y: 870, width: 220, height: 125 },
          dy: footer.y - 877,
        },
      ],
      // The reference draws a placeholder in the empty email field. The pill's
      // horizontal edges sit on a half pixel in the reference (P3), so the
      // pill is compared inside them: vertical edges, dot and label.
      exclude: [
        { x: email.x + 8, y: email.y + 6, width: email.width - 16, height: email.height - 12 },
      ],
      intentional: INTENTIONAL,
    })
  })

  test('L13c step 3 at 1440×900: header, head, chips, lede, next action', async ({ page }) => {
    await completedMember(page.request, 's05-px-c')
    const v = await seededVenture(page.request)
    await page.goto(`/projects/new?venture=${v.id}&step=done`, { waitUntil: 'networkidle' })
    const top = await cardTop(page)
    const next = await box(page, '[data-next="edit"]')
    await auditRevision(page, {
      name: 'WF02-S05.L13c',
      reference: REF.c,
      full: true,
      segments: [
        // The right-hand link differs by decision (DEC-L2-D4).
        { name: 'header', reference: { x: 0, y: 0, width: 1200, height: 65 }, dy: 0 },
        { name: 'head', reference: { x: 300, y: 112, width: 840, height: 162 }, dy: top - 113 },
        { name: 'chips', reference: { x: 336, y: 280, width: 212, height: 24 }, dy: top - 113 },
        { name: 'lede', reference: { x: 336, y: 312, width: 427, height: 24 }, dy: top - 113 },
        {
          name: 'next-index',
          reference: { x: 338, y: 382, width: 60, height: 112 },
          dy: next.y - 385,
        },
        {
          name: 'next-action',
          reference: { x: 905, y: 382, width: 197, height: 112 },
          dy: next.y - 385,
        },
      ],
      intentional: INTENTIONAL,
    })
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
    expect(full.below_reference?.unexpected_pixels, 'UI below the reference height').toBe(0)

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
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: ACTIONS,
          reason:
            'DEC-WF02-H3/H6: "Xem bản public" and "Gửi HUB duyệt" not rendered; "Lưu" in their place (G1)',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 113, width: 1312, height: 72 },
          reason: 'DEC-WF02-H6: required-field progress card not rendered',
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
            'DEC-WF02-S05-G1: canonical form (Loại, Tên, Tóm tắt, Lĩnh vực, Tỉnh / Thành phố) in S02 field language; not compared',
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
