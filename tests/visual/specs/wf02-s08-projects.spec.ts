import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import {
  applyVocabularyFixture,
  completedAccount,
  signInFresh,
  watchConsole,
  type Account,
} from '../support/onboarding'
import { createVenture, freshAddress, invite, STAGE } from '../support/workspace'

/**
 * WF02-S08 — /projects, "Dự án & startup của tôi" (ME7). Production.
 * Decisions DEC-L2R-D1, D7, D8, D10, D11; screen contract l2-screen-contracts.md.
 *
 * Functional and security behaviour: one card per venture the member owns or
 * belongs to as an ACTIVE member, actions by the viewer's level, one banner per
 * pending invitation to the account's own address, accept / decline, the
 * empty state, the page guard, GET /me/ventures and /me/venture-invitations,
 * and the responsive basics. The ME7 pixel audit lives in wf02-l2-revision.spec.ts.
 */

const VENTURES_API = '/api/v1/ventures'
const MY_VENTURES = '/api/v1/me/ventures'
const MY_INVITATIONS = '/api/v1/me/venture-invitations'
const NIL = '00000000-0000-0000-0000-000000000000'

let consoleErrors: string[] = []
let contexts: BrowserContext[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  contexts = []
  watchConsole(page, consoleErrors)
  await page.context().clearCookies()
})

test.afterEach(async () => {
  for (const context of contexts) await context.close()
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

type Member = Account & { profileId: string }
type Other = { context: BrowserContext; request: APIRequestContext; account: Member }

/** Another member, signed in in a browser context of its own. */
async function otherMember(browser: Browser, label: string): Promise<Other> {
  const context = await browser.newContext()
  contexts.push(context)
  const account = await completedAccount(context.request, label)
  return { context, request: context.request, account }
}

/** `other` owns a new venture and invites `email` to it. */
async function invitedBy(
  other: Other,
  email: string,
  venture: Record<string, unknown>,
  body: { role_label?: string; permission?: 'EDIT' | 'VIEW' },
) {
  const created = await createVenture(other.request, venture)
  const { membership_id } = await invite(other.request, created.id, { email, ...body })
  return { venture: created, membershipId: membership_id }
}

const answer = (id: string, membershipId: string, kind: 'accept' | 'decline') =>
  `${VENTURES_API}/${id}/team/invitations/${membershipId}/${kind}`

async function openProjects(page: Page) {
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-screen="ME7"]')).toBeVisible()
}

const card = (page: Page, id: string) => page.locator(`[data-venture="${id}"]`)
const banner = (page: Page, id: string) => page.locator(`[data-invitation="${id}"]`)
const emptyState = (page: Page) => page.locator('[data-state="empty"]')

async function items(request: APIRequestContext, url: string) {
  const response = await request.get(url)
  expect(response.status(), url).toBe(200)
  return (await response.json()).items as Record<string, unknown>[]
}

async function row(membershipId: string) {
  const [found] = await query<{ state: string; profile_id: string | null; permission: string }>(
    `SELECT state::text, profile_id::text, permission::text FROM project_members WHERE id = $1`,
    [membershipId],
  )
  return found!
}

/** Chips, facts and action links of one card, as the member reads them. */
async function readCard(page: Page, id: string) {
  const c = card(page, id)
  return {
    chips: await c.locator('[data-kind]').allTextContents(),
    facts: await c.locator('p').last().locator('span').allTextContents(),
    actions: await c
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute('href')])),
  }
}

test.describe('WF02-S08 guards', () => {
  test('guest → /auth; both lists and the answers are 401', async ({ page, request }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL('/auth')
    for (const [method, url] of [
      ['GET', MY_VENTURES],
      ['GET', MY_INVITATIONS],
      ['POST', answer(NIL, NIL, 'accept')],
      ['POST', answer(NIL, NIL, 'decline')],
    ] as const) {
      const response = await request.fetch(url, { method })
      expect(response.status(), `${method} ${url}`).toBe(401)
      expect(JSON.stringify(await response.json())).not.toMatch(/venture|membership_id/)
    }
  })

  test('onboarding open → its step; an invitation waits and cannot be accepted yet', async ({
    page,
    browser,
  }) => {
    const me = await signInFresh(page.request, 's08-new')
    await page.goto('/projects')
    await expect(page).toHaveURL('/onboarding')
    const owner = await otherMember(browser, 's08-new-owner')
    const { venture, membershipId } = await invitedBy(
      owner,
      me.email,
      { type: 'PROJECT', name: 'S08 Chờ onboarding' },
      { permission: 'VIEW' },
    )
    const refused = await page.request.post(answer(venture.id, membershipId, 'accept'))
    expect(refused.status()).toBe(403)
    expect((await row(membershipId)).state).toBe('PENDING_CONFIRMATION')
  })
})

test.describe('WF02-S08 list', () => {
  test('owner, Biên tập and Xem: one card each, chips, facts and actions follow the level', async ({
    page,
    browser,
  }) => {
    const me = await completedAccount(page.request, 's08-list')
    const own = await createVenture(page.request, {
      type: 'STARTUP',
      name: 'S08 A Của tôi',
      stage_id: STAGE.pilot,
      owner_role_label: 'Founder',
    })
    await invite(page.request, own.id, { email: freshAddress('s08-mate'), permission: 'EDIT' })
    const editor = await otherMember(browser, 's08-editor-owner')
    const edit = await invitedBy(
      editor,
      me.email,
      { type: 'PROJECT', name: 'S08 B Biên tập', stage_id: STAGE.mvp },
      { role_label: 'Co-founder', permission: 'EDIT' },
    )
    const viewer = await otherMember(browser, 's08-viewer-owner')
    const view = await invitedBy(
      viewer,
      me.email,
      { type: 'STARTUP', name: 'S08 C Xem', stage_id: STAGE.selling },
      { role_label: 'Cố vấn', permission: 'VIEW' },
    )
    for (const { venture, membershipId } of [edit, view]) {
      expect((await page.request.post(answer(venture.id, membershipId, 'accept'))).status()).toBe(
        200,
      )
    }

    await openProjects(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dự án & startup của tôi')
    const cards = page.locator('[data-venture]')
    await expect(cards).toHaveCount(3)
    // Owned first, then by name.
    expect(
      await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-venture'))),
    ).toEqual([own.id, edit.venture.id, view.venture.id])
    for (const id of [own.id, edit.venture.id, view.venture.id])
      await expect(card(page, id)).toHaveAttribute('data-status', 'DRAFT')
    await expect(emptyState(page)).toHaveCount(0)
    await expect(page.locator('[data-invitation]')).toHaveCount(0)

    const api = await items(page.request, MY_VENTURES)
    const stage = (id: string) => (api.find((v) => v.id === id)!.stage as { label: string }).label

    expect(await readCard(page, own.id)).toEqual({
      chips: ['Startup', 'Nháp · chỉ đội thấy', 'Chủ sở hữu'],
      facts: [`Giai đoạn: ${stage(own.id)}`, '1 thành viên', 'Founder'],
      actions: [
        ['Hoàn thiện hồ sơ', `/projects/${own.id}/edit`],
        ['Mời thành viên', `/projects/${own.id}/team`],
      ],
    })
    expect(await readCard(page, edit.venture.id)).toEqual({
      chips: ['Dự án', 'Nháp · chỉ đội thấy', 'Biên tập'],
      facts: [`Giai đoạn: ${stage(edit.venture.id)}`, '2 thành viên', 'Co-founder'],
      actions: [
        ['Hoàn thiện hồ sơ', `/projects/${edit.venture.id}/edit`],
        ['Thành viên', `/projects/${edit.venture.id}/team`],
      ],
    })
    expect(await readCard(page, view.venture.id)).toEqual({
      chips: ['Startup', 'Nháp · chỉ đội thấy', 'Xem'],
      facts: [`Giai đoạn: ${stage(view.venture.id)}`, '2 thành viên', 'Cố vấn'],
      actions: [
        ['Xem hồ sơ', `/projects/${view.venture.id}/edit`],
        ['Thành viên', `/projects/${view.venture.id}/team`],
      ],
    })

    // The API agrees; the pending count is the owner's to know only.
    expect(api.map((v) => [v.id, v.permission, v.can_edit, v.pending_invitations])).toEqual([
      [own.id, 'OWNER', true, 1],
      [edit.venture.id, 'EDIT', true, null],
      [view.venture.id, 'VIEW', false, null],
    ])

    // The actions lead to screens the level may open.
    await card(page, edit.venture.id).getByRole('link', { name: 'Hoàn thiện hồ sơ' }).click()
    await expect(page).toHaveURL(`/projects/${edit.venture.id}/edit`)
    await openProjects(page)
    await card(page, own.id).getByRole('link', { name: 'Mời thành viên' }).click()
    await expect(page).toHaveURL(`/projects/${own.id}/team`)
    await openProjects(page)
    await card(page, view.venture.id).getByRole('link', { name: 'Xem hồ sơ' }).click()
    await expect(page).toHaveURL(`/projects/${view.venture.id}/edit`)
  })

  test('shell: header and sidebar lead to existing routes; inert items stay put', async ({
    page,
  }) => {
    await completedAccount(page.request, 's08-shell')
    await openProjects(page)
    const shell = page.locator('[data-shell="workspace"][data-frame="projects"]')
    await expect(shell).toBeVisible()
    await expect(shell.locator('header [data-nav="home"]')).toHaveAttribute('href', '/')
    const sidebar = shell.getByRole('navigation', { name: 'Tài khoản của tôi' })
    expect(
      await sidebar
        .getByRole('link')
        .evaluateAll((els) =>
          els.map((el) => [
            el.textContent,
            el.getAttribute('href'),
            el.getAttribute('aria-current'),
          ]),
        ),
    ).toEqual([
      ['Hồ sơ của tôi', '/me', null],
      ['Dự án & startup', '/projects', 'page'],
      // PO decision (Alpha interaction gap fix): applications live on the L5 entry.
      ['Hồ sơ đăng ký', '/demo/projects', null],
      ['Tổ chức của tôi', '/me/roles', null],
      ['Cài đặt', '/me/settings', null],
    ])
    // PO decision: "Mạng lưới" is the public Library.
    await expect(
      shell.locator('header').getByRole('link', { name: 'Mạng lưới', exact: true }),
    ).toHaveAttribute('href', '/library')
    const inert = shell.locator('[data-nav-kind="INERT"]')
    expect(
      await inert.evaluateAll((els) =>
        els.map((el) => [el.textContent, el.tagName, el.getAttribute('aria-disabled')]),
      ),
    ).toEqual([
      ['Chương trình', 'SPAN', 'true'],
      ['Sự kiện', 'SPAN', 'true'],
    ])
    for (const item of await inert.all()) {
      await expect(item).toHaveAttribute('aria-label', /— .+/)
      await item.click()
      await expect(page).toHaveURL('/projects')
    }
    // S1-UAT-02 (FB-01, DEC-S1F-D1): "Góp ý" is the one shared launcher.
    await expect(page.locator('[data-feedback-launcher]')).toHaveCount(1)
    await expect(shell.locator('[data-nav="project-demo"]')).toHaveAttribute(
      'href',
      '/demo/projects',
    )
    await expect(page.locator('[data-nav="create-project"]')).toHaveAttribute(
      'href',
      '/projects/new',
    )
    await expect(page.locator('[data-nav="create-project"]')).toHaveText('+ Tạo dự án / startup')

    for (const [name, href] of [
      ['Hồ sơ của tôi', '/me'],
      ['Hồ sơ đăng ký', '/demo/projects'],
      ['Tổ chức của tôi', '/me/roles'],
      ['Cài đặt', '/me/settings'],
    ] as const) {
      await openProjects(page)
      await sidebar.getByRole('link', { name, exact: true }).click()
      await expect(page).toHaveURL(href)
    }
    await openProjects(page)
    await page.locator('[data-nav="create-project"]').click()
    await expect(page).toHaveURL('/projects/new')
  })

  test('no venture: the empty state and its create link', async ({ page }) => {
    await completedAccount(page.request, 's08-empty')
    await openProjects(page)
    await expect(page.locator('[data-venture]')).toHaveCount(0)
    await expect(page.locator('[data-invitations]')).toHaveCount(0)
    await expect(emptyState(page)).toContainText(
      'Bạn chưa thuộc đội nào. Tạo một dự án/startup để lưu hồ sơ đội một lần',
    )
    await expect(page.locator('[data-nav="create-project-empty"]')).toHaveAttribute(
      'href',
      '/projects/new',
    )
    expect(await items(page.request, MY_VENTURES)).toEqual([])
    expect(await items(page.request, MY_INVITATIONS)).toEqual([])
  })
})

test.describe('WF02-S08 invitations', () => {
  test('a pending invitation is a banner, not a venture; only the invited address sees it', async ({
    page,
    browser,
  }) => {
    const me = await completedAccount(page.request, 's08-inv')
    const owner = await otherMember(browser, 's08-inv-owner')
    const { venture, membershipId } = await invitedBy(
      owner,
      me.email,
      { type: 'STARTUP', name: 'S08 AgriLink', stage_id: STAGE.mvp },
      { role_label: 'Cố vấn vận hành', permission: 'VIEW' },
    )

    await openProjects(page)
    await expect(page.locator('[data-venture]')).toHaveCount(0)
    // Not a member of any team yet: the empty state stays with the banner.
    await expect(emptyState(page)).toBeVisible()
    const b = banner(page, membershipId)
    await expect(b).toContainText('LỜI MỜI ĐANG CHỜ')
    await expect(b).toContainText(
      'S08 AgriLink mời bạn vào đội với vai trò Cố vấn vận hành · quyền Xem',
    )
    await expect(b.getByRole('button', { name: 'Từ chối' })).toBeEnabled()
    await expect(b.getByRole('button', { name: 'Chấp nhận' })).toBeEnabled()

    expect(await items(page.request, MY_VENTURES)).toEqual([])
    const invitations = await items(page.request, MY_INVITATIONS)
    expect(invitations).toHaveLength(1)
    expect(Object.keys(invitations[0]!).sort()).toEqual([
      'invited_at',
      'membership_id',
      'permission',
      'role_label',
      'venture',
    ])
    expect(invitations[0]).toMatchObject({
      venture: { id: venture.id, name: 'S08 AgriLink', type: 'STARTUP' },
      membership_id: membershipId,
      role_label: 'Cố vấn vận hành',
      permission: 'VIEW',
    })
    const raw = JSON.stringify(invitations)
    for (const secret of [owner.account.email, owner.account.profileId, me.email])
      expect(raw).not.toContain(secret)

    // Another account sees nothing of it and cannot answer it.
    const stranger = await otherMember(browser, 's08-inv-stranger')
    const strangerPage = await stranger.context.newPage()
    await openProjects(strangerPage)
    await expect(strangerPage.locator('[data-invitation]')).toHaveCount(0)
    await expect(strangerPage.locator('[data-venture]')).toHaveCount(0)
    expect(await items(stranger.request, MY_INVITATIONS)).toEqual([])
    for (const kind of ['accept', 'decline'] as const)
      expect((await stranger.request.post(answer(venture.id, membershipId, kind))).status()).toBe(
        404,
      )

    // The owner sees its venture as owner, never the invitation as its own.
    const ownerPage = await owner.context.newPage()
    await openProjects(ownerPage)
    await expect(ownerPage.locator('[data-invitation]')).toHaveCount(0)
    await expect(card(ownerPage, venture.id)).toBeVisible()
    expect(await items(owner.request, MY_INVITATIONS)).toEqual([])
    expect((await owner.request.post(answer(venture.id, membershipId, 'accept'))).status()).toBe(
      404,
    )
    expect((await row(membershipId)).state).toBe('PENDING_CONFIRMATION')
  })

  test('accept (keyboard) → the venture joins the list with the invited level', async ({
    page,
    browser,
  }) => {
    const me = await completedAccount(page.request, 's08-accept')
    const owner = await otherMember(browser, 's08-accept-owner')
    const { venture, membershipId } = await invitedBy(
      owner,
      me.email,
      { type: 'PROJECT', name: 'S08 Kho lạnh', stage_id: STAGE.idea },
      { role_label: 'Co-founder', permission: 'EDIT' },
    )
    await openProjects(page)
    const accept = banner(page, membershipId).getByRole('button', { name: 'Chấp nhận' })
    await accept.focus()
    const answered = page.waitForResponse((r) => r.url().endsWith('/accept'))
    await page.keyboard.press('Enter')
    expect((await answered).status()).toBe(200)
    await expect(banner(page, membershipId)).toHaveCount(0)
    await expect(card(page, venture.id)).toBeVisible()
    await expect(emptyState(page)).toHaveCount(0)
    expect((await readCard(page, venture.id)).chips).toEqual([
      'Dự án',
      'Nháp · chỉ đội thấy',
      'Biên tập',
    ])
    await expect(
      card(page, venture.id).getByRole('link', { name: 'Hoàn thiện hồ sơ' }),
    ).toBeVisible()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(card(page, venture.id)).toBeVisible()

    expect(await row(membershipId)).toEqual({
      state: 'ACTIVE',
      profile_id: me.profileId,
      permission: 'EDIT',
    })
    expect((await items(page.request, MY_VENTURES)).map((v) => [v.id, v.permission])).toEqual([
      [venture.id, 'EDIT'],
    ])
    expect(await items(page.request, MY_INVITATIONS)).toEqual([])
    const [audit] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events
        WHERE actor_account_id = $1 AND action = 'VENTURE_TEAM_JOINED'`,
      [me.accountId],
    )
    expect(audit!.n).toBe(1)
    // A repeated accept is the same outcome, not a second membership.
    expect((await page.request.post(answer(venture.id, membershipId, 'accept'))).status()).toBe(200)
    const [members] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM project_members
        WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
      [venture.id, me.profileId],
    )
    expect(members!.n).toBe(1)
  })

  test('decline → the banner leaves and nothing is joined', async ({ page, browser }) => {
    const me = await completedAccount(page.request, 's08-decline')
    const owner = await otherMember(browser, 's08-decline-owner')
    const { venture, membershipId } = await invitedBy(
      owner,
      me.email,
      { type: 'STARTUP', name: 'S08 Từ chối' },
      { permission: 'EDIT' },
    )
    await openProjects(page)
    const answered = page.waitForResponse((r) => r.url().endsWith('/decline'))
    await banner(page, membershipId).getByRole('button', { name: 'Từ chối' }).click()
    expect((await answered).status()).toBe(200)
    await expect(banner(page, membershipId)).toHaveCount(0)
    await expect(page.locator('[data-venture]')).toHaveCount(0)
    await expect(emptyState(page)).toBeVisible()
    expect((await row(membershipId)).state).toBe('REJECTED')
    expect((await row(membershipId)).profile_id).toBeNull()
    expect(await items(page.request, MY_VENTURES)).toEqual([])
    expect(await items(page.request, MY_INVITATIONS)).toEqual([])
    expect((await page.request.get(`${VENTURES_API}/${venture.id}`)).status()).toBe(404)
    // A declined invitation cannot be accepted afterwards.
    expect((await page.request.post(answer(venture.id, membershipId, 'accept'))).status()).toBe(409)
    expect((await row(membershipId)).state).toBe('REJECTED')
  })

  /** The member's banner, then the owner cancels the invitation before it is answered. */
  async function cancelledMeanwhile(page: Page, browser: Browser, label: string) {
    const me = await completedAccount(page.request, label)
    const owner = await otherMember(browser, `${label}-owner`)
    const { venture, membershipId } = await invitedBy(
      owner,
      me.email,
      { type: 'PROJECT', name: 'S08 Đã huỷ' },
      { permission: 'VIEW' },
    )
    await openProjects(page)
    await expect(banner(page, membershipId)).toBeVisible()
    const cancelled = await owner.request.delete(
      `${VENTURES_API}/${venture.id}/team/${membershipId}`,
    )
    expect(cancelled.status()).toBe(200)
    return { membershipId }
  }

  for (const kind of ['accept', 'decline'] as const) {
    test(`${kind} of an invitation cancelled meanwhile: list reloaded, no membership`, async ({
      page,
      browser,
    }) => {
      const { membershipId } = await cancelledMeanwhile(page, browser, `s08-closed-${kind}`)
      const answered = page.waitForResponse((r) => r.url().endsWith(`/${kind}`))
      await banner(page, membershipId)
        .getByRole('button', { name: kind === 'accept' ? 'Chấp nhận' : 'Từ chối' })
        .click()
      const response = await answered
      expect(response.status()).toBe(409)
      expect((await response.json()).error.code).toBe('MEMBERSHIP_INVALID_TRANSITION')
      // The list is read again: the closed invitation is gone and nothing joined.
      await expect(banner(page, membershipId)).toHaveCount(0)
      await expect(page.locator('[data-venture]')).toHaveCount(0)
      await expect(emptyState(page)).toBeVisible()
      expect((await row(membershipId)).state).toBe('REMOVED')
      expect((await row(membershipId)).profile_id).toBeNull()
      expect(await items(page.request, MY_VENTURES)).toEqual([])
      expect(await items(page.request, MY_INVITATIONS)).toEqual([])
    })
  }

  // The message is the page's, not the banner's: the reload removes the banner.
  test('an invitation cancelled meanwhile: the member is told why it went away', async ({
    page,
    browser,
  }) => {
    const { membershipId } = await cancelledMeanwhile(page, browser, 's08-closed-msg')
    const answered = page.waitForResponse((r) => r.url().endsWith('/accept'))
    await banner(page, membershipId).getByRole('button', { name: 'Chấp nhận' }).click()
    expect((await answered).status()).toBe(409)
    await expect(banner(page, membershipId)).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    // Contract (l2-screen-contracts.md, ME7 accept failure): "message, list reloaded".
    await expect(page.getByText('Lời mời này không còn hiệu lực.')).toBeVisible()
  })
})

test.describe('WF02-S08 security', () => {
  test('the lists ignore query, body and headers and never return another account’s data', async ({
    page,
    browser,
  }) => {
    const me = await completedAccount(page.request, 's08-idor')
    const mine = await createVenture(page.request, { type: 'STARTUP', name: 'S08 Của tôi' })
    const other = await otherMember(browser, 's08-idor-other')
    const theirs = await createVenture(other.request, {
      type: 'PROJECT',
      name: 'S08 Của người khác',
    })
    const third = await otherMember(browser, 's08-idor-third')
    const pending = await invitedBy(
      third,
      other.account.email,
      { type: 'STARTUP', name: 'S08 Lời mời của người khác' },
      { permission: 'EDIT' },
    )
    const spoof = {
      'x-account-id': other.account.accountId,
      'x-profile-id': other.account.profileId,
      'x-forwarded-email': other.account.email,
    }
    const qs = `?profile_id=${other.account.profileId}&account_id=${other.account.accountId}&email=${encodeURIComponent(other.account.email)}`
    const secrets = [
      theirs.id,
      'S08 Của người khác',
      pending.venture.id,
      pending.membershipId,
      'S08 Lời mời của người khác',
      other.account.email,
      other.account.profileId,
    ]

    for (const url of [MY_VENTURES, MY_INVITATIONS]) {
      const response = await page.request.fetch(`${url}${qs}`, {
        method: 'GET',
        headers: spoof,
        data: { profile_id: other.account.profileId, account_id: other.account.accountId },
      })
      expect(response.status(), url).toBe(200)
      const raw = await response.text()
      for (const secret of secrets) expect(raw, `${url} ${secret}`).not.toContain(secret)
      expect(raw).not.toMatch(/"(owner_profile_id|profile_id|account_id|slug|metadata|email)"/)
    }
    expect((await items(page.request, MY_VENTURES)).map((v) => v.id)).toEqual([mine.id])
    expect(await items(page.request, MY_INVITATIONS)).toEqual([])
    // The owner of the other venture still reads its own.
    expect((await items(other.request, MY_VENTURES)).map((v) => v.id)).toEqual([theirs.id])
    expect((await items(other.request, MY_INVITATIONS)).map((i) => i.membership_id)).toEqual([
      pending.membershipId,
    ])

    // No write method exists on the lists.
    for (const url of [MY_VENTURES, MY_INVITATIONS]) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const response = await page.request.fetch(url, { method, data: {} })
        expect(response.status(), `${method} ${url}`).toBeGreaterThanOrEqual(400)
        const raw = await response.text()
        for (const secret of secrets) expect(raw).not.toContain(secret)
      }
    }

    // Someone else's invitation cannot be answered, even with its ids.
    for (const kind of ['accept', 'decline'] as const) {
      const response = await page.request.post(
        answer(pending.venture.id, pending.membershipId, kind),
        { headers: spoof },
      )
      expect(response.status(), kind).toBe(404)
    }
    expect((await row(pending.membershipId)).state).toBe('PENDING_CONFIRMATION')

    // The page is always the session's own.
    await page.goto(`/projects${qs}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-venture]')).toHaveCount(1)
    await expect(card(page, mine.id)).toBeVisible()
    await expect(page.locator('[data-invitation]')).toHaveCount(0)
    // The caller put the other account's ids and address in the URL, which the
    // page echoes in its router state: they are checked in the rendered text;
    // the other account's own data must appear nowhere.
    const text = await page.locator('body').innerText()
    for (const secret of secrets) expect(text, secret).not.toContain(secret)
    const html = await page.content()
    for (const secret of secrets.slice(0, 5)) expect(html, secret).not.toContain(secret)
    expect(html).not.toContain(me.accountId)
  })
})

test.describe('WF02-S08 responsive', () => {
  test('1024, 768 and 390: no horizontal overflow; primary actions visible and reachable', async ({
    page,
    browser,
  }) => {
    const me = await completedAccount(page.request, 's08-resp')
    const own = await createVenture(page.request, {
      type: 'STARTUP',
      name: 'Tracely — truy xuất nguồn gốc cho hợp tác xã nông sản miền Trung',
      stage_id: STAGE.pilot,
      owner_role_label: 'Founder',
    })
    const owner = await otherMember(browser, 's08-resp-owner')
    const { membershipId } = await invitedBy(
      owner,
      me.email,
      { type: 'PROJECT', name: 'S08 AgriLink' },
      { role_label: 'Cố vấn vận hành', permission: 'VIEW' },
    )

    for (const [width, height] of [
      [1024, 768],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await openProjects(page)
      await page.evaluate(() => document.fonts.ready)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${width}px overflow`).toBeLessThanOrEqual(0)
      const selectors = [
        '[data-nav="create-project"]',
        `[data-venture="${own.id}"] [data-nav="venture-edit"]`,
        `[data-venture="${own.id}"] [data-nav="venture-invite"]`,
        `[data-invitation="${membershipId}"] button`,
      ]
      const problems = await page.evaluate(async (list) => {
        const found: string[] = []
        for (const selector of list) {
          const nodes = [...document.querySelectorAll<HTMLElement>(selector)]
          if (nodes.length === 0) found.push(`${selector}: missing`)
          for (const node of nodes) {
            const label = node.innerText.trim() || selector
            if (node.getClientRects().length === 0) {
              found.push(`${label}: hidden`)
              continue
            }
            node.scrollIntoView({ block: 'center' })
            await new Promise((done) => requestAnimationFrame(() => done(null)))
            const r = node.getBoundingClientRect()
            if (r.width < 1 || r.height < 1) found.push(`${label}: zero size`)
            else if (r.left < -1 || r.right > window.innerWidth + 1)
              found.push(`${label}: outside the viewport (${r.left}..${r.right})`)
            else {
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
              if (!hit || !(hit === node || node.contains(hit)))
                found.push(`${label}: covered by ${hit?.tagName}`)
            }
          }
        }
        return found
      }, selectors)
      expect(problems, `${width}px`).toEqual([])
      await expect(
        banner(page, membershipId).getByRole('button', { name: 'Chấp nhận' }),
      ).toBeVisible()
    }
  })
})
