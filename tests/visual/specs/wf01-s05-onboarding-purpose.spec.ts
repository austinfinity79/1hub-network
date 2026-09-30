import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import { IDS, memberships, reach, signInFresh, stored, watchConsole } from '../support/onboarding'

/**
 * WF01-S05 / ACC-08 — onboarding stage 3, "Bạn tham gia hệ sinh thái với vai
 * trò nào?" (/onboarding/purpose). Production. Decisions DEC-L1R-D3, D5, D7
 * (docs/decisions/DECISION_LOG.md).
 */

const ROLES_API = '/api/v1/me/onboarding/roles'
const STAGE_API = '/api/v1/me/onboarding/stage'

let consoleErrors: string[] = []

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

async function openRoles(page: Page) {
  await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Bạn tham gia hệ sinh thái với vai trò nào?',
  )
}

const role = (page: Page, name: string) => page.getByRole('checkbox', { name: new RegExp(name) })
const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' })
const panel = (page: Page) => page.locator('[data-anchor="hub"]')

/** What a declaration must never produce, for one account. */
async function granted(accountId: string) {
  const [row] = await query<{ leadership: number; assignments: number }>(
    `SELECT (SELECT count(*)::int FROM leadership_records l WHERE l.profile_id = p.id) AS leadership,
            (SELECT count(*)::int FROM role_assignments r
              WHERE r.individual_profile_id = p.id) AS assignments
       FROM individual_profiles p WHERE p.account_id = $1`,
    [accountId],
  )
  return row
}

test.describe('WF01-S05 functional and security', () => {
  test('a guest is sent to /auth; the API refuses', async ({ page, request }) => {
    await page.goto('/onboarding/purpose')
    await expect(page).toHaveURL('/auth')
    expect((await request.get(ROLES_API)).status()).toBe(401)
    expect((await request.put(ROLES_API, { data: { roles: [] } })).status()).toBe(401)
    expect((await request.put(STAGE_API, { data: { completed: 'ROLE' } })).status()).toBe(401)
  })

  test('the stage opens only after stage 2 is passed', async ({ page }) => {
    await signInFresh(page.request, 's05')
    await reach(page.request, 'CAPABILITY')
    await page.goto('/onboarding/purpose')
    await expect(page).toHaveURL('/onboarding/capability')
    const refused = await page.request.put(STAGE_API, { data: { completed: 'ROLE' } })
    expect(refused.status()).toBe(422)
    expect((await refused.json()).error.fields).toEqual({ capability_stage: 'missing' })
  })

  test('six roles, multi-select, none required', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await expect(page.locator('header')).toContainText('BƯỚC 3/4 · VAI TRÒ')
    await expect(page.locator('[data-role]')).toHaveCount(6)
    await expect(page.locator('[data-role]')).toContainText([
      'Thành viên HUB Network',
      'Innovator/Nhà đổi mới sáng tạo',
      'Startup Founder',
      'Đại diện tổ chức',
      'Đại diện quỹ/Nhà đầu tư',
      'Quan tâm đến đổi mới sáng tạo',
    ])
    await expect(page.getByText('ĐÃ CHỌN 0')).toBeVisible()
    await expect(panel(page)).toHaveCount(0)
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    const row = await stored(accountId)
    expect(row).toMatchObject({ roles: [], claims: [] })
    expect(row!.role_at).toBeInstanceOf(Date)
  })

  test('selected roles are stored as declared and grant nothing', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await role(page, 'Innovator').check({ force: true })
    await role(page, 'Startup Founder').check({ force: true })
    await role(page, 'Đại diện quỹ').check({ force: true })
    await role(page, 'Đại diện quỹ').uncheck({ force: true })
    await expect(page.getByText('ĐÃ CHỌN 2')).toBeVisible()
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect((await stored(accountId))!.roles).toEqual(['INNOVATOR', 'STARTUP_FOUNDER'])
    expect(await memberships(accountId)).toEqual([])
    expect(await granted(accountId)).toEqual({ leadership: 0, assignments: 0 })
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities ?? []).toEqual([])
    expect(session.managed_scopes ?? []).toEqual([])
  })

  test('F. a HUB unit is a draft "Chờ xác minh": no membership, no leadership, no permission', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await role(page, 'Thành viên HUB Network').check({ force: true })
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).locator('[data-badge="pending"]')).toHaveText('Chờ xác minh')
    await expect(panel(page)).toContainText('không cấp quyền quản trị HUB Chapter hay CLB')
    await panel(page).getByLabel('Đơn vị').selectOption(IDS.chapter01)
    await panel(page).getByLabel('Chức vụ').fill('Phó trưởng chapter')
    await panel(page).getByLabel('Thời gian').fill('2024 – nay')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')

    expect(await stored(accountId)).toMatchObject({
      roles: ['HUB_MEMBER'],
      claims: [
        { organization_id: IDS.chapter01, position: 'Phó trưởng chapter', period: '2024 – nay' },
      ],
    })
    expect(await memberships(accountId)).toEqual([])
    expect(await granted(accountId)).toEqual({ leadership: 0, assignments: 0 })

    // The claimed unit's operations stay closed, screen and API alike.
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities ?? []).toEqual([])
    const ops = `/api/v1/ops/organizations/${IDS.chapter01}`
    for (const path of [`${ops}/members`, `${ops}/dashboard`]) {
      expect([403, 404], path).toContain((await page.request.get(path)).status())
    }
    const audit = await query(
      `SELECT 1 FROM audit_events WHERE actor_account_id = $1 AND action = 'MEMBERSHIP_REQUESTED'`,
      [accountId],
    )
    expect(audit).toHaveLength(0)
  })

  test('the browser’s Back shows what was saved; saving again loses nothing', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await role(page, 'Innovator').check({ force: true })
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    await page.goBack()
    await expect(page).toHaveURL('/onboarding/purpose')
    await expect(role(page, 'Innovator')).toBeChecked()
    await page.locator('header').getByRole('button', { name: 'Lưu và hoàn tất sau' }).click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({ roles: ['INNOVATOR'] })
  })

  test('several units: one claim per unit; a row with text needs its unit', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await role(page, 'Thành viên HUB Network').check({ force: true })
    await panel(page).getByLabel('Chức vụ').fill('Thành viên')
    await next(page).click()
    await expect(page.getByText('Vui lòng chọn đơn vị cho vị trí này.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/purpose')
    await panel(page).getByLabel('Đơn vị').selectOption(IDS.chapter01)

    await panel(page)
      .getByRole('button', { name: /Thêm vị trí khác/ })
      .click()
    const second = panel(page).locator('[data-claim="1"]')
    // A unit picked in another row is not offered again.
    await expect(second.locator(`option[value="${IDS.chapter01}"]`)).toHaveCount(0)
    await second.getByLabel('Đơn vị').selectOption(IDS.chapter02)
    await second.getByLabel('Chức vụ').fill('Trưởng ban')
    await panel(page)
      .getByRole('button', { name: /Thêm vị trí khác/ })
      .click()
    await panel(page)
      .locator('[data-claim="2"]')
      .getByRole('button', { name: 'Bỏ vị trí này' })
      .click()
    await expect(panel(page).locator('[data-claim]')).toHaveCount(2)
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect((await stored(accountId))!.claims).toEqual([
      { organization_id: IDS.chapter01, position: 'Thành viên', period: null },
      { organization_id: IDS.chapter02, position: 'Trưởng ban', period: null },
    ])
  })

  test('deselecting the HUB role drops the named units', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    const saved = await page.request.put(ROLES_API, {
      data: {
        roles: ['HUB_MEMBER', 'INNOVATOR'],
        hub_claims: [{ organization_id: IDS.chapter01, position: 'Thành viên' }],
      },
    })
    expect(saved.status()).toBe(200)
    await openRoles(page)
    await expect(panel(page).getByLabel('Chức vụ')).toHaveValue('Thành viên')
    await role(page, 'Thành viên HUB Network').uncheck({ force: true })
    await expect(panel(page)).toHaveCount(0)
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(await stored(accountId)).toMatchObject({ roles: ['INNOVATOR'], claims: [] })
  })

  test('the server refuses roles, states and units the form never sends', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    const [hidden] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status)
       VALUES ('CHAPTER', $1, 'Spec draft chapter', 'DRAFT') RETURNING id::text`,
      [`s05-${Date.now()}`],
    )
    try {
      for (const data of [
        { roles: ['PLATFORM_ADMIN'] },
        { roles: ['HUB_COMMUNITY_LEADER'] },
        { roles: ['HUB_MEMBER'], role_code: 'PLATFORM_ADMIN' },
        { roles: ['HUB_MEMBER'], capabilities: ['membership:confirm'] },
        { roles: ['INNOVATOR'], hub_claims: [{ organization_id: IDS.chapter01 }] },
        {
          roles: ['HUB_MEMBER'],
          hub_claims: [{ organization_id: IDS.chapter01, state: 'ACTIVE' }],
        },
        {
          roles: ['HUB_MEMBER'],
          hub_claims: [{ organization_id: IDS.chapter01, source: 'ORGANIZATION_VERIFIED' }],
        },
        { roles: ['HUB_MEMBER'], hub_claims: [{ organization_id: hidden!.id }] },
        { roles: ['HUB_MEMBER'], hub_claims: [{ organization_id: 'chapter-01' }] },
        {
          roles: ['HUB_MEMBER'],
          hub_claims: [{ organization_id: IDS.chapter01 }, { organization_id: IDS.chapter01 }],
        },
      ]) {
        const response = await page.request.put(ROLES_API, { data })
        expect(response.status(), JSON.stringify(data)).toBe(422)
        expect((await response.json()).error.code).toBe('PROFILE_VALIDATION_FAILED')
      }
    } finally {
      await query('DELETE FROM organizations WHERE id = $1', [hidden!.id])
    }
    expect(await stored(accountId)).toMatchObject({ roles: [], claims: [] })
    expect(await memberships(accountId)).toEqual([])
  })

  test('one account cannot read or write another account’s declaration', async ({
    page,
    browser,
  }) => {
    const owner = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, { data: { roles: ['STARTUP_FOUNDER'] } })
    const other = await browser.newContext()
    try {
      const stranger = await signInFresh(other.request, 's05-other')
      await reach(other.request, 'ROLE')
      // The endpoint takes no account or profile id: a spoofed one is refused or ignored.
      const spoofed = await other.request.put(ROLES_API, {
        data: { roles: ['INVESTOR_REPRESENTATIVE'], account_id: owner.accountId },
        headers: { 'x-account-id': owner.accountId, 'x-role': 'PLATFORM_ADMIN' },
      })
      expect(spoofed.status()).toBe(422)
      expect(await (await other.request.get(ROLES_API)).json()).toEqual({
        roles: [],
        hub_claims: [],
      })
      expect((await stored(owner.accountId))!.roles).toEqual(['STARTUP_FOUNDER'])
      expect((await stored(stranger.accountId))!.roles).toEqual([])
    } finally {
      await other.close()
    }
  })

  test('"Lưu và hoàn tất sau" saves without passing the stage; the account resumes here', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await role(page, 'Quan tâm đến đổi mới sáng tạo').check({ force: true })
    await page.locator('header').getByRole('button', { name: 'Lưu và hoàn tất sau' }).click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({
      roles: ['INNOVATION_ENTHUSIAST'],
      role_at: null,
    })
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/purpose')
    await expect(role(page, 'Quan tâm đến đổi mới sáng tạo')).toBeChecked()
    await page.getByRole('link', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL('/onboarding/capability')
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    await openRoles(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('checkbox')).toHaveCount(6)
    await role(page, 'Thành viên HUB Network').focus()
    await page.keyboard.press('Space')
    await expect(role(page, 'Thành viên HUB Network')).toBeChecked()
    expect(
      await role(page, 'Thành viên HUB Network').evaluate(
        (el) => getComputedStyle(el.closest('label')!).outlineStyle,
      ),
    ).not.toBe('none')
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
      'Vị trí tại HUB Network',
    )
    for (const label of ['Đơn vị', 'Chức vụ', 'Thời gian']) {
      await expect(panel(page).getByLabel(label), label).toHaveCount(1)
    }
  })
})

test.describe('WF01-S05 pixel QA (ACC-08)', () => {
  /** ACC-08, measured once. */
  const REF = { cardTop: 113, rolesTop: 262, hubTop: 611, infoTop: 898, ruleTop: 996 } as const

  test('1440×900: header, role cards, HUB panel, note and footer match ACC-08', async ({
    page,
  }) => {
    await signInFresh(page.request, 's05')
    await reach(page.request, 'ROLE')
    const saved = await page.request.put(ROLES_API, {
      data: {
        roles: ['HUB_MEMBER', 'INNOVATOR', 'STARTUP_FOUNDER'],
        hub_claims: [
          { organization_id: IDS.chapter01, position: 'Phó trưởng chapter', period: '2024 – nay' },
        ],
      },
    })
    expect(saved.status()).toBe(200)
    await openRoles(page)
    const at = (name: string) => topOf(page, `[data-anchor="${name}"]`)
    const card = await topOf(page, '[data-ui="surface"]')

    await auditRevision(page, {
      name: 'WF01-S05.ACC-08',
      reference: 'design-reference/final/revision/L1/ACC-08__onboarding-role__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 66 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 270, y: 100, width: 900, height: 150 },
          dy: card - REF.cardTop,
        },
        {
          name: 'roles',
          reference: { x: 310, y: 252, width: 820, height: 340 },
          dy: (await at('roles')) - REF.rolesTop,
        },
        {
          name: 'hub-panel',
          reference: { x: 310, y: 600, width: 820, height: 280 },
          dy: (await at('hub')) - REF.hubTop,
        },
        {
          name: 'note',
          reference: { x: 310, y: 888, width: 820, height: 90 },
          dy: (await at('info')) - REF.infoTop,
        },
        {
          name: 'footer',
          reference: { x: 270, y: 985, width: 900, height: 180 },
          dy: (await at('rule')) - REF.ruleTop,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-A1: no AI provider, so the "AI đề xuất" mark on a suggested role is not drawn; "Góp ý" is hidden for Alpha (PO decision 30/09), so its pill is not compared',
        },
      ],
    })
  })
})
