import { randomUUID } from 'node:crypto'

import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
} from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import {
  applyVocabularyFixture,
  completedAccount,
  onboardThroughUi,
  watchConsole,
} from '../support/onboarding'
import { signInThroughUi } from '../support/auth'
import { CORE, createVenture, freshAddress, invite, STAGE } from '../support/workspace'

/**
 * WF02 L2 UAT — the business matrix of TASK 22-L1-L2-SOT-REALIGN (BA workbook
 * WF-02, DEC-L2R-D1..D11), one test per letter:
 *
 *   A profile on /me (FP1-OWN)       H invitation by link (inert, D-T1)
 *   B create PROJECT                 I accept → member at the invited level
 *   C create STARTUP                 J IDOR
 *   D duplicate create               K role / level spoofing
 *   E stage persists                 L pending invitations: the invitee only
 *   F creator role, no privilege     M DRAFT is never public (D-V1)
 *   G e-mail invitation
 *
 * Every state is reached through the real screens and APIs; the database is
 * read to check what was stored, never written. Guard paths follow (ALT-*).
 */

const VENTURES = '/api/v1/ventures'
const NIL = '00000000-0000-0000-0000-000000000000'
const MEMBER_ROUTES = [
  '/me',
  '/me/profile/edit',
  '/me/privacy',
  '/me/roles',
  '/me/settings',
  '/projects',
  '/projects/new',
  `/projects/${NIL}/edit`,
  `/projects/${NIL}/team`,
]

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

const newEmail = (tag: string) => freshAddress(`uat2-${tag}`)

/** WF01 sign-in as the member does it since S1-UAT-01: /auth, password (DEC-S1A-D1). */
async function signIn(page: Page, email: string) {
  await signInThroughUi(page, email)
}

/** The compatibility magic link (DEC-S1A-D7): requested by API, opened in the browser. */
async function signInByMagicLink(page: Page, email: string) {
  const { token } = await requestMagicLink(email, null)
  await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
  return token
}

/** Another member, signed in in a browser context of their own. */
async function persona(browser: Browser, tag: string, display_name = tag) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  watchConsole(page, consoleErrors)
  const account = await completedAccount(page.request, `uat2-${tag}`, { display_name })
  return { context, page, request: page.request, ...account }
}

/** The one completion service, read through all three endpoints. */
async function completion(request: APIRequestContext): Promise<number> {
  const session = await (await request.get('/api/v1/session')).json()
  const profile = await (await request.get('/api/v1/me/profile')).json()
  const own = await (await request.get('/api/v1/me/profile/completion')).json()
  const values = [session.profile.completion_percent, profile.completion.percent, own.percent]
  expect(new Set(values).size, `completion disagrees: ${values.join('/')}`).toBe(1)
  return values[0]
}

async function authority(request: APIRequestContext) {
  const s = await (await request.get('/api/v1/session')).json()
  return { capabilities: s.capabilities, managed_scopes: s.managed_scopes }
}

type Step1 = {
  type: 'Dự án / ý tưởng' | 'Startup'
  name: string
  domains?: string[]
  summary?: string
  stage?: string
  role?: string
}

const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' })
const alerts = (page: Page) => page.locator('[data-step-form="info"] [role="alert"]')

async function fillStep1(page: Page, v: Step1) {
  await page.getByRole('radio', { name: v.type, exact: true }).check({ force: true })
  await page.locator('#ve-name').fill(v.name)
  await page.locator('[aria-controls="ve-domain-list"]').click()
  for (const label of v.domains ?? ['Logistics'])
    await page.locator('#ve-domain-list').getByRole('button', { name: label, exact: true }).click()
  await page.locator('#ve-summary').fill(v.summary ?? 'Một dòng mô tả.')
  await page.getByRole('radio', { name: v.stage ?? 'Ý tưởng', exact: true }).check({ force: true })
  if (v.role) await page.getByRole('radio', { name: v.role, exact: true }).check({ force: true })
}

/** PRJ1 → "Tiếp tục": the venture the server created, from its 201 answer. */
async function createThroughWizard(page: Page, v: Step1) {
  await page.goto('/projects/new', { waitUntil: 'networkidle' })
  await fillStep1(page, v)
  const response = page.waitForResponse(
    (r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST',
  )
  await next(page).click()
  const res = await response
  expect(res.status(), await res.text()).toBe(201)
  const body = await res.json()
  await expect(page).toHaveURL(`/projects/new?venture=${body.id}&step=team`)
  return body
}

async function ventureRow(id: string) {
  const [row] = await query<{
    type: string
    status: string
    owner: string
    stage_id: string | null
    role: string | null
    team_rows: number
  }>(
    `SELECT p.type::text AS type, p.status::text AS status, p.owner_profile_id::text AS owner,
            p.stage_id::text AS stage_id, p.owner_role_label AS role,
            (SELECT count(*)::int FROM project_members WHERE project_id = p.id) AS team_rows
       FROM projects p WHERE p.id = $1`,
    [id],
  )
  return row!
}

const ventureCount = async (profileId: string) =>
  (
    await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1',
      [profileId],
    )
  )[0]!.n

test.describe('WF02 L2 UAT — business matrix', () => {
  test('A · PROFILE: FP1-OWN shows the profile; an education record added in the dialog is saved, edited and shown after reload', async ({
    page,
  }) => {
    await signIn(page, newEmail('a'))
    await onboardThroughUi(page, 'Hồ Sơ UAT')
    await expect(page).toHaveURL('/me')
    await expect(page.locator('[data-anchor="identity"]')).toContainText('Hồ Sơ UAT')
    const percent = await completion(page.request)
    const education = page.locator('[data-anchor="education"]')
    await expect(education).toContainText('Chưa có học vấn.')

    await page.getByRole('button', { name: 'Thêm học vấn' }).click()
    const dialog = page.locator('dialog[data-dialog="education"]')
    await expect(dialog.getByRole('heading')).toHaveText('Thêm học vấn')
    // A refused save keeps the dialog open with its message.
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Trường này là bắt buộc.')
    await dialog.getByLabel('Trường', { exact: true }).fill('Đại học Bách khoa Đà Nẵng')
    await dialog.getByLabel('Ngành / chương trình').fill('Kỹ sư · Kỹ thuật hệ thống công nghiệp')
    await dialog.getByLabel('Từ', { exact: true }).fill('09/2012')
    await dialog.getByLabel('Đến', { exact: true }).fill('06/2016')
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/me/profile') && r.request().method() === 'PATCH',
    )
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toBeHidden()
    const record = education.locator('[data-record="education"]')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(record).toHaveCount(1)
    await expect(record).toContainText('Đại học Bách khoa Đà Nẵng')
    await expect(record).toContainText('Kỹ sư · Kỹ thuật hệ thống công nghiệp')
    await expect(record).toContainText('2012 – 2016')

    // Edit in place: the pencil, then the record's own pencil.
    await page.getByRole('button', { name: 'Sửa học vấn' }).click()
    await education.getByRole('button', { name: 'Sửa Đại học Bách khoa Đà Nẵng' }).click()
    await expect(dialog.getByRole('heading')).toHaveText('Sửa học vấn')
    await expect(dialog.getByLabel('Từ', { exact: true })).toHaveValue('09/2012')
    await dialog.getByLabel('Ngành / chương trình').fill('Thạc sĩ · Quản trị chuỗi cung ứng')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog).toBeHidden()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(record).toContainText('Thạc sĩ · Quản trị chuỗi cung ứng')
    const profile = await (await page.request.get('/api/v1/me/profile')).json()
    expect(profile.education).toEqual([
      expect.objectContaining({
        institution: 'Đại học Bách khoa Đà Nẵng',
        programme: 'Thạc sĩ · Quản trị chuỗi cung ứng',
        started_on: '2012-09',
        ended_on: '2016-06',
      }),
    ])
    // The one completion service still agrees on every endpoint.
    expect(await completion(page.request)).toBeGreaterThanOrEqual(percent)
  })

  test('B · create PROJECT: required fields named → DRAFT → the creator is the owner', async ({
    page,
  }) => {
    const m = await completedAccount(page.request, 'uat2-b')
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
    await page.locator('[data-nav="create-project-empty"]').click()
    await expect(page).toHaveURL('/projects/new')
    await next(page).click()
    await expect(alerts(page)).toHaveText(Array(5).fill('Trường này là bắt buộc.'))
    expect(await ventureCount(m.profileId)).toBe(0)

    const v = await createThroughWizard(page, { type: 'Dự án / ý tưởng', name: 'Dự Án UAT' })
    expect(v).toMatchObject({ type: 'PROJECT', status: 'DRAFT', relation: 'OWNER' })
    expect(await ventureRow(v.id)).toMatchObject({
      type: 'PROJECT',
      status: 'DRAFT',
      owner: m.profileId,
      team_rows: 0,
    })
    await page.goto('/projects', { waitUntil: 'networkidle' })
    const card = page.locator(`[data-venture="${v.id}"]`)
    await expect(card.locator('[data-kind="type"]')).toHaveText('Dự án')
    await expect(card.locator('[data-kind="status"]')).toHaveText('Nháp · chỉ đội thấy')
    await expect(card.locator('[data-kind="permission"]')).toHaveText('Chủ sở hữu')
    const mine = await (await page.request.get('/api/v1/me/ventures')).json()
    expect(mine.items.map((x: { id: string; relation: string }) => [x.id, x.relation])).toEqual([
      [v.id, 'OWNER'],
    ])
  })

  test('C · create STARTUP: required fields named → DRAFT → the creator is the owner', async ({
    page,
  }) => {
    const m = await completedAccount(page.request, 'uat2-c')
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await page.locator('[data-nav="create-project"]').click()
    await expect(page).toHaveURL('/projects/new')
    await page.getByRole('radio', { name: 'Startup', exact: true }).check({ force: true })
    await page.locator('#ve-name').fill('Startup UAT')
    await next(page).click()
    await expect(alerts(page)).toHaveText(Array(3).fill('Trường này là bắt buộc.'))
    expect(await ventureCount(m.profileId)).toBe(0)

    const v = await createThroughWizard(page, {
      type: 'Startup',
      name: 'Startup UAT',
      domains: ['AgriTech', 'Logistics'],
    })
    expect(v).toMatchObject({ type: 'STARTUP', status: 'DRAFT', relation: 'OWNER' })
    expect(await ventureRow(v.id)).toMatchObject({
      type: 'STARTUP',
      status: 'DRAFT',
      owner: m.profileId,
      team_rows: 0,
    })
    await page.goto('/projects', { waitUntil: 'networkidle' })
    const card = page.locator(`[data-venture="${v.id}"]`)
    await expect(card.locator('[data-kind="type"]')).toHaveText('Startup')
    await expect(card.locator('[data-kind="permission"]')).toHaveText('Chủ sở hữu')
  })

  test('D · duplicate: double submit, the same key again, refresh and back leave one venture', async ({
    page,
  }) => {
    const m = await completedAccount(page.request, 'uat2-d')
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    const creates: Request[] = []
    await page.route(`**${VENTURES}`, async (route) => {
      if (route.request().method() === 'POST') {
        creates.push(route.request())
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      await route.continue()
    })
    await fillStep1(page, { type: 'Dự án / ý tưởng', name: 'Trùng UAT' })
    await next(page).dblclick()
    await expect(page).toHaveURL(/step=team$/)
    await page.unroute(`**${VENTURES}`)
    expect(creates).toHaveLength(1)
    const id = new URL(page.url()).searchParams.get('venture')!

    const replay = await page.request.post(VENTURES, {
      data: creates[0]!.postDataJSON(),
      headers: { 'Idempotency-Key': creates[0]!.headers()['idempotency-key']! },
    })
    expect([replay.status(), (await replay.json()).id]).toEqual([201, id])
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL(`/projects/new?venture=${id}&step=info`)
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click()
    await expect(page.locator('[data-step-form="info"] [role="status"]')).toBeVisible()
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(`/projects/new?venture=${id}&step=info`)
    expect(await ventureCount(m.profileId)).toBe(1)
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-venture]')).toHaveCount(1)
  })

  test('E · stage: chosen on PRJ1, stored, shown after reload, changed in the editor', async ({
    page,
  }) => {
    await completedAccount(page.request, 'uat2-e')
    const v = await createThroughWizard(page, {
      type: 'Startup',
      name: 'Giai Đoạn UAT',
      stage: 'Pilot / Thử nghiệm',
    })
    expect(v.stage).toMatchObject({ id: STAGE.pilot, code: 'PILOT', label: 'Pilot / Thử nghiệm' })
    expect((await ventureRow(v.id)).stage_id).toBe(STAGE.pilot)
    await page.goto(`/projects/new?venture=${v.id}&step=info`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('radio', { name: 'Pilot / Thử nghiệm', exact: true })).toBeChecked()

    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('#ve-stage')).toHaveValue(STAGE.pilot)
    await page.locator('#ve-stage').selectOption({ label: 'Đang bán' })
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('[data-status]')).toContainText('đã lưu lúc')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('#ve-stage')).toHaveValue(STAGE.selling)
    expect((await ventureRow(v.id)).stage_id).toBe(STAGE.selling)
    const read = await (await page.request.get(`${VENTURES}/${v.id}`)).json()
    expect(read.stage).toMatchObject({ id: STAGE.selling, label: 'Đang bán' })
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(page.locator(`[data-venture="${v.id}"]`)).toContainText('Giai đoạn: Đang bán')
  })

  test('F · creator role: stored and shown again; it grants no platform privilege and changes no level', async ({
    page,
  }) => {
    const m = await completedAccount(page.request, 'uat2-f')
    const before = await authority(page.request)
    expect(before).toEqual({ capabilities: [], managed_scopes: [] })
    const v = await createThroughWizard(page, {
      type: 'Dự án / ý tưởng',
      name: 'Vai Trò UAT',
      role: 'Co-founder',
    })
    expect(v).toMatchObject({ role_label: 'Co-founder', permission: 'OWNER' })
    expect((await ventureRow(v.id)).role).toBe('Co-founder')
    await page.goto(`/projects/new?venture=${v.id}&step=info`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('radio', { name: 'Co-founder', exact: true })).toBeChecked()
    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('#ve-role')).toHaveValue('Co-founder')
    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    const owner = page.locator('[data-row-kind="OWNER"]').getByRole('cell')
    await expect(owner.nth(1)).toHaveText('Co-founder')
    await expect(owner.nth(2)).toHaveText('Chủ sở hữu')

    // The lowest role still leaves the creator the owner of their venture.
    const low = await createVenture(page.request, {
      type: 'PROJECT',
      name: 'Vai Trò Thấp UAT',
      owner_role_label: 'Thành viên',
    })
    const lowRead = await (await page.request.get(`${VENTURES}/${low.id}`)).json()
    expect(lowRead).toMatchObject({ permission: 'OWNER', can_edit: true, role_label: 'Thành viên' })
    const lowTeam = await (await page.request.get(`${VENTURES}/${low.id}/team`)).json()
    expect([lowTeam.viewer, lowTeam.can_manage]).toEqual(['OWNER', true])

    // Nothing on the platform: no role assignment, no leadership, no capability, no ops.
    const [rows] = await query<{ roles: number; leaders: number; memberships: number }>(
      `SELECT (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $1) AS roles,
              (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS leaders,
              (SELECT count(*)::int FROM community_memberships WHERE profile_id = $1) AS memberships`,
      [m.profileId],
    )
    expect(rows).toEqual({ roles: 0, leaders: 0, memberships: 0 })
    expect(await authority(page.request)).toEqual(before)
    expect((await page.goto('/ops/network'))?.status()).toBe(404)
    const ops = await page.request.get('/api/v1/ops/organizations')
    expect([403, 404]).toContain(ops.status())
  })

  test('G · e-mail invitation: PENDING_CONFIRMATION with role and level, the message in the outbox', async ({
    page,
  }) => {
    const m = await completedAccount(page.request, 'uat2-g', { display_name: 'Người Mời G' })
    const v = await createThroughWizard(page, { type: 'Startup', name: 'Mời UAT' })
    const address = newEmail('g-invitee')
    await page.locator('#team-invite-email').fill(address)
    await page.locator('#team-invite-role').selectOption('Co-founder')
    await page.locator('#team-invite-permission').selectOption('EDIT')
    await page.getByRole('button', { name: 'Gửi lời mời' }).click()
    await expect(page.locator('[data-state="invite-sent"]')).toHaveText('Đã gửi lời mời.')
    const row = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(row).toContainText(address)
    await expect(row).toContainText('Chờ xác nhận')
    const [stored] = await query<Record<string, unknown>>(
      `SELECT state::text AS state, profile_id::text AS profile, permission, role_label,
              invited_by_profile_id::text AS inviter
         FROM project_members WHERE project_id = $1`,
      [v.id],
    )
    expect(stored).toEqual({
      state: 'PENDING_CONFIRMATION',
      profile: null,
      permission: 'EDIT',
      role_label: 'Co-founder',
      inviter: m.profileId,
    })
    const mail = await page.request.get(
      `/dev/outbox/invitations?email=${encodeURIComponent(address)}`,
    )
    expect(mail.status()).toBe(200)
    const { subject, text, link } = await mail.json()
    // DEC-PDF-D4: the approved subject and sentence, naming the inviter.
    expect(subject).toBe('Bạn được mời tham gia Mời UAT trên 1hub.network')
    expect(text).toBe(
      `Người Mời G mời bạn tham gia Mời UAT với vai trò Co-founder.\n\nXem lời mời: ${link}`,
    )
    expect(new URL(link).pathname).toBe('/projects')
    expect(`${text}${link}`).not.toMatch(/token|[0-9a-f]{8}-[0-9a-f]{4}-/i)
    // Nobody joined: the team is the owner alone.
    const team = await (await page.request.get(`${VENTURES}/${v.id}/team`)).json()
    expect(team.counts).toEqual({ members: 1, pending: 1 })
  })

  test('H · link invitation: drawn and inert, no endpoint (NOT SUPPORTED BY CONTRACT, D-T1)', async ({
    page,
  }) => {
    await completedAccount(page.request, 'uat2-h')
    const v = await createVenture(page.request, { type: 'PROJECT', name: 'Link UAT' })
    await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
    const link = page.locator('[data-invite-link] [data-cta-kind="INERT"]')
    await expect(link).toHaveText('Sao chép link')
    await expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(await link.evaluate((el) => el.tagName)).toBe('SPAN')
    const calls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/')) calls.push(`${r.method()} ${r.url()}`)
    })
    await link.click({ force: true })
    await page.waitForLoadState('networkidle')
    expect(calls).toEqual([])
    // No route mints, lists or redeems an invitation link.
    for (const res of [
      await page.request.post(`${VENTURES}/${v.id}/team/invitation-links`),
      await page.request.post(`${VENTURES}/${v.id}/team/link`),
      await page.request.get(`${VENTURES}/${v.id}/team/invitations`),
      await page.request.post(`${VENTURES}/${v.id}/invite-link`),
    ]) {
      expect([404, 405], res.url()).toContain(res.status())
    }
    expect((await ventureRow(v.id)).team_rows).toBe(0)
  })

  test('I · accept: the invitee joins only by accepting, at the invited level', async ({
    page,
    browser,
  }) => {
    await completedAccount(page.request, 'uat2-i-owner')
    const v = await createVenture(page.request, { type: 'STARTUP', name: 'Nhận UAT' })
    const invitee = await persona(browser, 'i-invitee', 'Người Nhận UAT')
    const { membership_id } = await invite(page.request, v.id, {
      email: invitee.email,
      role_label: 'Co-founder',
      permission: 'EDIT',
    })
    // Signed in, not yet a member: the venture stays closed to them.
    expect((await invitee.request.get(`${VENTURES}/${v.id}`)).status()).toBe(404)
    await invitee.page.goto('/projects', { waitUntil: 'networkidle' })
    const banner = invitee.page.locator(`[data-invitation="${membership_id}"]`)
    await expect(banner).toContainText('LỜI MỜI ĐANG CHỜ')
    await expect(banner).toContainText(
      'Nhận UAT mời bạn vào đội với vai trò Co-founder · quyền Biên tập',
    )
    await banner.getByRole('button', { name: 'Chấp nhận' }).click()
    await expect(banner).toHaveCount(0)
    const card = invitee.page.locator(`[data-venture="${v.id}"]`)
    await expect(card.locator('[data-kind="permission"]')).toHaveText('Biên tập')
    await expect(card).toContainText('Co-founder')
    const mine = await (await invitee.request.get('/api/v1/me/ventures')).json()
    expect(mine.items).toEqual([
      expect.objectContaining({ id: v.id, relation: 'MEMBER', permission: 'EDIT', can_edit: true }),
    ])
    const [row] = await query<Record<string, unknown>>(
      `SELECT state::text AS state, profile_id::text AS profile, permission FROM project_members WHERE id = $1`,
      [membership_id],
    )
    expect(row).toEqual({ state: 'ACTIVE', profile: invitee.profileId, permission: 'EDIT' })
    // Biên tập: edits the venture, not the team.
    expect(
      (
        await invitee.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'Nhận UAT 2' } })
      ).status(),
    ).toBe(200)
    expect(
      (
        await invitee.request.post(`${VENTURES}/${v.id}/team/invitations`, {
          data: { email: newEmail('i-x') },
        })
      ).status(),
    ).toBe(403)
    expect(
      (await (await invitee.request.get('/api/v1/me/venture-invitations')).json()).items,
    ).toEqual([])
    await invitee.context.close()
  })

  test('J · IDOR: another member can neither read nor change the venture, its team or its invitations', async ({
    page,
    browser,
  }) => {
    await completedAccount(page.request, 'uat2-j-owner')
    const v = await createVenture(page.request, { type: 'STARTUP', name: 'Riêng Tư UAT' })
    const waiting = await invite(page.request, v.id, { email: newEmail('j-waiting') })
    const other = await persona(browser, 'j-other')
    const base = `${VENTURES}/${v.id}`
    for (const res of [
      await other.request.get(base),
      await other.request.patch(base, { data: { name: 'x' } }),
      await other.request.get(`${base}/team`),
      await other.request.post(`${base}/team/invitations`, { data: { email: newEmail('j-x') } }),
      await other.request.patch(`${base}/team/${waiting.membership_id}`, {
        data: { permission: 'EDIT' },
      }),
      await other.request.delete(`${base}/team/${waiting.membership_id}`),
      await other.request.post(`${base}/team/invitations/${waiting.membership_id}/accept`),
      await other.request.post(`${base}/team/invitations/${waiting.membership_id}/decline`),
    ]) {
      expect(res.status(), `${res.url()}`).toBe(404)
    }
    for (const route of [
      `/projects/${v.id}/edit`,
      `/projects/${v.id}/team`,
      `/projects/new?venture=${v.id}&step=team`,
    ]) {
      expect((await other.page.goto(route))?.status(), route).toBe(404)
      await expect(other.page.locator('body')).not.toContainText('Riêng Tư UAT')
    }
    expect((await (await other.request.get('/api/v1/me/ventures')).json()).items).toEqual([])
    expect(
      (await (await other.request.get('/api/v1/me/venture-invitations')).json()).items,
    ).toEqual([])
    const [row] = await query<{ state: string; name: string }>(
      `SELECT m.state::text AS state, p.name FROM project_members m JOIN projects p ON p.id = m.project_id WHERE m.id = $1`,
      [waiting.membership_id],
    )
    expect(row).toEqual({ state: 'PENDING_CONFIRMATION', name: 'Riêng Tư UAT' })
    await other.context.close()
  })

  test('K · role spoof: headers, query and body cannot raise a level or reach the platform', async ({
    page,
    browser,
  }) => {
    const owner = await completedAccount(page.request, 'uat2-k-owner')
    const v = await createVenture(page.request, { type: 'PROJECT', name: 'Giả Mạo UAT' })
    const viewer = await persona(browser, 'k-viewer')
    const editor = await persona(browser, 'k-editor')
    for (const [who, permission] of [
      [viewer, 'VIEW'],
      [editor, 'EDIT'],
    ] as const) {
      const { membership_id } = await invite(page.request, v.id, { email: who.email, permission })
      const accepted = await who.request.post(
        `${VENTURES}/${v.id}/team/invitations/${membership_id}/accept`,
      )
      expect(accepted.status()).toBe(200)
    }
    const headers = {
      'x-role': 'PLATFORM_ADMIN',
      'x-permission': 'OWNER',
      'x-profile-id': owner.profileId,
      'x-account-id': owner.accountId,
    }
    const cases: [APIRequestContext, 'post' | 'patch', string, object, number][] = [
      [viewer.request, 'patch', `${VENTURES}/${v.id}?permission=EDIT`, { name: 'x' }, 403],
      [editor.request, 'patch', `${VENTURES}/${v.id}`, { owner_role_label: 'Founder' }, 403],
      [
        editor.request,
        'post',
        `${VENTURES}/${v.id}/team/invitations`,
        { email: newEmail('k-x'), permission: 'EDIT' },
        403,
      ],
      [
        page.request,
        'post',
        `${VENTURES}/${v.id}/team/invitations`,
        { email: newEmail('k-y'), permission: 'OWNER' },
        422,
      ],
      [
        editor.request,
        'post',
        VENTURES,
        { type: 'PROJECT', name: 'x', ...CORE, owner_profile_id: owner.profileId },
        422,
      ],
      [
        editor.request,
        'post',
        VENTURES,
        { type: 'PROJECT', name: 'x', ...CORE, status: 'ACTIVE' },
        422,
      ],
      [
        editor.request,
        'post',
        VENTURES,
        { type: 'PROJECT', name: 'x', ...CORE, permission: 'OWNER' },
        422,
      ],
    ]
    for (const [request, method, url, data, status] of cases) {
      const res = await request[method](url, { headers, data })
      expect(res.status(), `${method} ${url} ${JSON.stringify(data)}`).toBe(status)
    }
    expect(
      await (await viewer.request.get(`${VENTURES}/${v.id}`, { headers })).json(),
    ).toMatchObject({
      permission: 'VIEW',
      can_edit: false,
    })
    for (const who of [viewer, editor]) {
      expect(await authority(who.request)).toEqual({ capabilities: [], managed_scopes: [] })
      expect((await who.page.goto('/ops/network'))?.status()).toBe(404)
    }
    const [rbac] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])',
      [[viewer.profileId, editor.profileId, owner.profileId]],
    )
    expect(rbac!.n).toBe(0)
    const levels = await query<{ permission: string }>(
      `SELECT permission FROM project_members WHERE project_id = $1 AND state = 'ACTIVE' ORDER BY permission`,
      [v.id],
    )
    expect(levels.map((l) => l.permission)).toEqual(['EDIT', 'VIEW'])
    expect(await ventureRow(v.id)).toMatchObject({ owner: owner.profileId, role: null })
    for (const who of [viewer, editor]) await who.context.close()
  })

  test('L · pending invitations: listed and shown to the invited address only', async ({
    page,
    browser,
  }) => {
    const owner = await completedAccount(page.request, 'uat2-l-owner')
    const v = await createVenture(page.request, { type: 'STARTUP', name: 'Chờ UAT' })
    const invitee = await persona(browser, 'l-invitee')
    const bystander = await persona(browser, 'l-bystander')
    const third = newEmail('l-third')
    const mine = await invite(page.request, v.id, {
      email: invitee.email.toUpperCase(),
      role_label: 'Thành viên',
      permission: 'VIEW',
    })
    await invite(page.request, v.id, { email: third, permission: 'EDIT' })

    const listed = await (await invitee.request.get('/api/v1/me/venture-invitations')).json()
    expect(listed.items).toEqual([
      {
        venture: { id: v.id, name: 'Chờ UAT', type: 'STARTUP' },
        membership_id: mine.membership_id,
        role_label: 'Thành viên',
        permission: 'VIEW',
        invited_at: expect.any(String),
      },
    ])
    expect(JSON.stringify(listed)).not.toContain(third)
    await invitee.page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(invitee.page.locator('[data-invitations] [data-invitation]')).toHaveCount(1)
    await invitee.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(invitee.page.locator('[data-team-invitation]')).toBeVisible()
    await expect(invitee.page.locator('body')).not.toContainText(third)

    for (const who of [bystander.request, page.request]) {
      expect((await (await who.get('/api/v1/me/venture-invitations')).json()).items).toEqual([])
    }
    await bystander.page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(bystander.page.locator('[data-invitations]')).toHaveCount(0)
    expect((await bystander.page.goto(`/projects/${v.id}/team`))?.status()).toBe(404)
    for (const kind of ['accept', 'decline']) {
      const res = await bystander.request.post(
        `${VENTURES}/${v.id}/team/invitations/${mine.membership_id}/${kind}`,
      )
      expect(res.status(), kind).toBe(404)
    }
    const [row] = await query<{ state: string }>(
      'SELECT state::text AS state FROM project_members WHERE id = $1',
      [mine.membership_id],
    )
    expect(row!.state).toBe('PENDING_CONFIRMATION')
    expect(owner.profileId).toBeTruthy()
    for (const who of [invitee, bystander]) await who.context.close()
  })

  test('M · DRAFT is never public: guests and other members never see the venture', async ({
    page,
    browser,
    playwright,
  }) => {
    await completedAccount(page.request, 'uat2-m-owner')
    const name = `Nháp Riêng ${randomUUID().slice(0, 8)}`
    const v = await createVenture(page.request, {
      type: 'STARTUP',
      name,
      summary: `${name} mô tả`,
    })
    expect((await ventureRow(v.id)).status).toBe('DRAFT')
    // Nothing publishes it: no status from the client, no review route.
    const publish = await page.request.patch(`${VENTURES}/${v.id}`, { data: { status: 'ACTIVE' } })
    expect(publish.status()).toBe(422)
    const review = await page.request.post(`${VENTURES}/${v.id}/submit-for-review`)
    expect([404, 405]).toContain(review.status())
    expect((await ventureRow(v.id)).status).toBe('DRAFT')

    const guest = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    for (const url of [`${VENTURES}/${v.id}`, `${VENTURES}/${v.id}/team`]) {
      expect((await guest.get(url)).status(), url).toBe(401)
    }
    const guestContext: BrowserContext = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const guestPage = await guestContext.newPage()
    watchConsole(guestPage, consoleErrors)
    await guestPage.goto(`/projects/${v.id}/edit`)
    await expect(guestPage).toHaveURL('/auth')
    for (const route of ['/', '/library', '/organizations/chapter-01']) {
      const res = await guestPage.goto(route, { waitUntil: 'networkidle' })
      expect(res?.status(), route).toBe(200)
      await expect(guestPage.locator('body'), route).not.toContainText(name)
      expect(await guestPage.content(), route).not.toContain(v.id)
    }
    const member = await persona(browser, 'm-other')
    expect((await member.request.get(`${VENTURES}/${v.id}`)).status()).toBe(404)
    await member.page.goto('/library', { waitUntil: 'networkidle' })
    await expect(member.page.locator('body')).not.toContainText(name)
    await guest.dispose()
    await guestContext.close()
    await member.context.close()
  })
})

test.describe('WF02 UAT — guards', () => {
  test('ALT-01 guest: every WF02 route → /auth', async ({ page }) => {
    for (const route of MEMBER_ROUTES) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/auth')
    }
  })

  test('ALT-02 incomplete onboarding cannot bypass into WF02 (pages and APIs)', async ({
    page,
  }) => {
    await signIn(page, newEmail('partial'))
    await expect(page).toHaveURL('/onboarding')
    for (const route of MEMBER_ROUTES) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/onboarding')
    }
    const r = await page.request.post(VENTURES, {
      data: { type: 'PROJECT', name: 'x', ...CORE },
    })
    expect(r.status()).toBe(403)
  })

  test('ALT-03 a used magic link never signs in again', async ({ page, browser }) => {
    const token = await signInByMagicLink(page, newEmail('used'))
    await onboardThroughUi(page, 'Link Once')
    const other: BrowserContext = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const p2 = await other.newPage()
    await p2.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(p2).not.toHaveURL('/me')
    expect((await p2.request.get('/api/v1/me/profile')).status()).toBe(401)
    await other.close()
  })
})
