import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { FIXTURES, qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S04 — Roles & Network Links (/me/roles). Production.
 * Decisions DEC-WF02-H5/H11, DEC-WF02-S04-G1..G5, DEC-WF02-S04-D1..D4.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const CHAPTER_01 = FIXTURES.chapter01Id
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const HUB = '10000000-0000-0000-0000-000000000001'
const REQUEST_API = '/api/v1/me/membership-requests'
const PIXEL_LEADERSHIP_ID = 'c4000000-0000-0000-0000-000000000001'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 500s and the 409/404 refusals are scenarios under test.
    if (m.type() === 'error' && !/status of (404|409|500)/.test(m.text()))
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

async function completedMember(request: APIRequestContext, label = 's04'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        data: {
          full_name: 'Đặng Kim Chi',
          display_name: 'Đặng Kim Chi',
          country_id: COUNTRY,
          headline: 'QA',
          region_id: REGION,
          domain_ids: [DOMAIN],
        },
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
  for (const completed of ['CAPABILITY', 'ROLE']) {
    const stage = await request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect(stage.ok()).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

async function membership(
  profileId: string,
  org: string,
  state: string,
  source = 'ORGANIZATION_VERIFIED',
) {
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
     VALUES ($1, $2, $3, $4, '2026-09-01T03:00:00Z')`,
    [profileId, org, state, source],
  )
}

const states = (profileId: string, org: string) =>
  query<{ state: string }>(
    `SELECT state::text AS state FROM community_memberships WHERE profile_id = $1 AND organization_id = $2 ORDER BY created_at, id`,
    [profileId, org],
  ).then((r) => r.map((x) => x.state))

const auditCount = async (accountId: string) =>
  (
    await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'MEMBERSHIP_REQUESTED'`,
      [accountId],
    )
  )[0]!.n

const rolesCard = (page: Page) => page.locator('[data-card="roles"]')
const requestCard = (page: Page) => page.locator('[data-card="request"]')
const select = (page: Page) => requestCard(page).getByRole('combobox')

async function openRoles(page: Page) {
  await page.goto('/me/roles', { waitUntil: 'networkidle' })
  await expect(rolesCard(page)).toHaveAttribute('aria-busy', 'false')
}

async function authz(request: APIRequestContext) {
  const s = await (await request.get('/api/v1/session')).json()
  return { capabilities: s.capabilities, managed_scopes: s.managed_scopes }
}

test.describe('WF02-S04 guards', () => {
  test('1. guest → /auth; the request API is 401', async ({ page, request }) => {
    await page.goto('/me/roles')
    await expect(page).toHaveURL('/auth')
    expect(
      (await request.post(REQUEST_API, { data: { organization_id: CHAPTER_01 } })).status(),
    ).toBe(401)
  })

  test('2. an account that has not finished onboarding → its resolver step', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s04-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/me/roles')
    await expect(page).toHaveURL('/onboarding')
  })
})

test.describe('WF02-S04 read states', () => {
  test('A. no relationships: real empty state; request available; no journal', async ({ page }) => {
    await completedMember(page.request)
    await openRoles(page)
    await expect(page.locator('[aria-current="page"]')).toHaveText('Vai trò & liên kết')
    await expect(page.locator('[data-state="network-empty"]')).toHaveText(
      'Chưa có vai trò nào được ghi nhận.',
    )
    const options = await select(page).locator('option').allTextContents()
    expect(options).toEqual(['Chọn tổ chức', 'Chapter 01', 'Chapter 02', 'Club 01', 'HUB Network'])
    const text = await page.locator('main').innerText()
    for (const banned of ['NHẬT KÝ', 'Nhật ký', 'duyệt 2', 'gán ', 'công khai'])
      expect(text, banned).not.toContain(banned)
  })

  test('B/C/D/E/F. memberships, pending, leadership, multiple organisations and a venture stay separate rows', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    const before = await authz(page.request)
    await membership(m.profileId, CHAPTER_01, 'ACTIVE')
    await membership(m.profileId, CHAPTER_02, 'PENDING_APPROVAL', 'SELF_DECLARED')
    await membership(m.profileId, CLUB_01, 'REJECTED', 'SELF_DECLARED')
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, started_at) VALUES ($1, $2, 'Phó Chủ tịch', 'ACTIVE', '2026-08-18T03:00:00Z')`,
      [m.profileId, CHAPTER_01],
    )
    await query(
      `INSERT INTO projects (type, owner_profile_id, slug, name, status, metadata) VALUES ('STARTUP', $1, $2, 'Tracely Test', 'DRAFT', '{"secret":"do-not-render"}')`,
      [m.profileId, `s04-${Date.now()}`],
    )
    await openRoles(page)
    const rows = rolesCard(page).locator('li')
    expect(
      await rows.evaluateAll((els) =>
        els.map((el) => [
          el.getAttribute('data-kind'),
          (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
        ]),
      ),
    ).toEqual([
      ['venture', 'Tracely Test startup Chủ sở hữu Hệ thống ghi nhận'],
      ['membership', 'Chapter 01 chapter Thành viên Tổ chức xác nhận · từ 01/09/2026'],
      ['membership', 'Chapter 02 chapter Đang chờ duyệt Tự khai báo · từ 01/09/2026'],
      ['membership', 'Club 01 clb Không được duyệt Tự khai báo · từ 01/09/2026'],
      ['leadership', 'Chapter 01 chapter Phó Chủ tịch từ 18/08/2026'],
    ])
    // Selector: blocked organisations hidden (ACTIVE, PENDING); REJECTED stays requestable.
    expect(await select(page).locator('option').allTextContents()).toEqual([
      'Chọn tổ chức',
      'Club 01',
      'HUB Network',
    ])
    expect(await page.locator('main').innerText()).not.toContain('do-not-render')
    // 6/7/8: membership, pending and leadership grant nothing.
    expect(await authz(page.request)).toEqual(before)
    expect(before).toEqual({ capabilities: [], managed_scopes: [] })
  })
})

test.describe('WF02-S04 membership request', () => {
  test('G/13. submit → PENDING_APPROVAL row, one audit, no capability; survives refresh', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    const before = await authz(page.request)
    await openRoles(page)
    // No choice → nothing sent.
    let posts = 0
    page.on('request', (r) => {
      if (r.url().endsWith(REQUEST_API)) posts++
    })
    await requestCard(page).getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await expect(requestCard(page).getByRole('alert')).toHaveText('Vui lòng chọn một tổ chức.')
    expect(posts).toBe(0)

    await select(page).selectOption({ label: 'Chapter 02' })
    const response = page.waitForResponse((r) => r.url().endsWith(REQUEST_API))
    await requestCard(page).getByRole('button', { name: 'Gửi yêu cầu' }).click()
    const res = await response
    expect(res.status()).toBe(201)
    expect(res.request().headers()['idempotency-key']).toBeTruthy()
    expect(await res.json()).toMatchObject({
      status: 'PENDING_APPROVAL',
      source_type: 'SELF_DECLARED',
      organization: { id: CHAPTER_02 },
    })
    await expect(page.locator('[data-state="request-sent"]')).toContainText('đang chờ duyệt')
    await expect(rolesCard(page).locator('li[data-pending]')).toContainText('Chapter 02')
    expect(await select(page).locator('option').allTextContents()).not.toContain('Chapter 02')

    expect(await states(m.profileId, CHAPTER_02)).toEqual(['PENDING_APPROVAL'])
    expect(await auditCount(m.accountId)).toBe(1)
    const created = await query<{ l: number; r: number }>(
      `SELECT (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS l,
              (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $1) AS r`,
      [m.profileId],
    )
    expect(created[0]).toEqual({ l: 0, r: 0 })
    expect(await authz(page.request)).toEqual(before)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(rolesCard(page).locator('li[data-pending]')).toContainText('Chapter 02')
  })

  test('H/9/10. duplicate, concurrent and replayed requests create one record', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    const first = await page.request.post(REQUEST_API, { data: { organization_id: CHAPTER_01 } })
    expect(first.status()).toBe(201)
    const dup = await page.request.post(REQUEST_API, { data: { organization_id: CHAPTER_01 } })
    expect(dup.status()).toBe(409)
    expect((await dup.json()).error.code).toBe('MEMBERSHIP_INVALID_TRANSITION')

    const burst = await Promise.all(
      Array.from({ length: 6 }, () =>
        page.request.post(REQUEST_API, { data: { organization_id: CHAPTER_02 } }),
      ),
    )
    expect(burst.filter((r) => r.status() === 201)).toHaveLength(1)
    expect(burst.filter((r) => r.status() === 409)).toHaveLength(5)

    const key = `s04-${Date.now()}`
    const a = await page.request.post(REQUEST_API, {
      data: { organization_id: CLUB_01 },
      headers: { 'Idempotency-Key': key },
    })
    const b = await page.request.post(REQUEST_API, {
      data: { organization_id: CLUB_01 },
      headers: { 'Idempotency-Key': key },
    })
    expect(a.status()).toBe(201)
    expect(b.status()).toBe(201)
    expect((await b.json()).id).toBe((await a.json()).id)

    expect(await states(m.profileId, CHAPTER_01)).toEqual(['PENDING_APPROVAL'])
    expect(await states(m.profileId, CHAPTER_02)).toEqual(['PENDING_APPROVAL'])
    expect(await states(m.profileId, CLUB_01)).toEqual(['PENDING_APPROVAL'])
    expect(await auditCount(m.accountId)).toBe(3)
  })

  test('G4 via HTTP: SUSPENDED/ALUMNI refuse; REJECTED/WITHDRAWN allow a new record and keep history', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await membership(m.profileId, CHAPTER_01, 'SUSPENDED')
    await membership(m.profileId, CHAPTER_02, 'ALUMNI')
    await membership(m.profileId, CLUB_01, 'REJECTED', 'SELF_DECLARED')
    await membership(m.profileId, HUB, 'WITHDRAWN', 'SELF_DECLARED')
    for (const org of [CHAPTER_01, CHAPTER_02]) {
      const r = await page.request.post(REQUEST_API, { data: { organization_id: org } })
      expect(r.status(), org).toBe(409)
      expect((await r.json()).error.code).toBe('MEMBERSHIP_INVALID_TRANSITION')
    }
    await openRoles(page)
    expect(await select(page).locator('option').allTextContents()).toEqual([
      'Chọn tổ chức',
      'Club 01',
      'HUB Network',
    ])
    await select(page).selectOption({ label: 'Club 01' })
    await requestCard(page).getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await expect(page.locator('[data-state="request-sent"]')).toBeVisible()
    expect(await states(m.profileId, CLUB_01)).toEqual(['REJECTED', 'PENDING_APPROVAL'])
    const hub = await page.request.post(REQUEST_API, { data: { organization_id: HUB } })
    expect(hub.status()).toBe(201)
    expect(await states(m.profileId, HUB)).toEqual(['WITHDRAWN', 'PENDING_APPROVAL'])
    expect(await states(m.profileId, CHAPTER_01)).toEqual(['SUSPENDED'])
    expect(await states(m.profileId, CHAPTER_02)).toEqual(['ALUMNI'])
  })

  test('11/12. invalid or non-requestable organisations are 404 and write nothing', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    for (const body of [
      { organization_id: '00000000-0000-0000-0000-000000000000' },
      { organization_id: 'chapter-01' },
      {},
      { organization: { id: CHAPTER_01, type: 'CHAPTER', status: 'PUBLISHED' } },
    ]) {
      const r = await page.request.post(REQUEST_API, { data: body })
      expect(r.status(), JSON.stringify(body)).toBe(404)
    }
    expect(await auditCount(m.accountId)).toBe(0)
  })

  test('4. body identifiers cannot switch the member or force ACTIVE', async ({
    playwright,
    page,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's04-other')
    const self = await completedMember(page.request, 's04-self')
    const r = await page.request.post(REQUEST_API, {
      data: {
        organization_id: CHAPTER_01,
        profile_id: other.profileId,
        account_id: other.accountId,
        state: 'ACTIVE',
        source: 'ORGANIZATION_VERIFIED',
      },
    })
    expect(r.status()).toBe(201)
    expect(await r.json()).toMatchObject({
      status: 'PENDING_APPROVAL',
      source_type: 'SELF_DECLARED',
    })
    expect(await states(self.profileId, CHAPTER_01)).toEqual(['PENDING_APPROVAL'])
    expect(await states(other.profileId, CHAPTER_01)).toEqual([])
    await otherCtx.dispose()
  })

  test('I. network and request API failures show errors; retry recovers', async ({ page }) => {
    await completedMember(page.request)
    const fail = (route: import('@playwright/test').Route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
      })
    await page.route('**/api/v1/me/network', fail)
    await page.goto('/me/roles', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="network-failed"]')).toBeVisible()
    await page.unroute('**/api/v1/me/network')
    await page
      .locator('[data-state="network-failed"]')
      .getByRole('button', { name: 'Thử lại' })
      .click()
    await expect(page.locator('[data-state="network-empty"]')).toBeVisible()

    await page.route('**/api/v1/me/membership-requests', fail)
    await select(page).selectOption({ label: 'Chapter 01' })
    await requestCard(page).getByRole('button', { name: 'Gửi yêu cầu' }).click()
    await expect(page.locator('[data-state="request-error"]')).toContainText(
      'Chưa gửi được yêu cầu',
    )
    await expect(page.locator('[data-state="network-empty"]')).toBeVisible()
  })
})

test.describe('WF02-S04 security', () => {
  test('3/5/14/15. seeded member: own rows only; no bootstrap, contact or raw data', async ({
    page,
    playwright,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's04-leak')
    await membership(other.profileId, CLUB_01, 'ACTIVE')
    expect(
      (await page.request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    await page.goto(`/me/roles?profile_id=${other.profileId}`, { waitUntil: 'networkidle' })
    await expect(rolesCard(page).locator('li')).toHaveCount(2)
    const text = await page.locator('main').innerText()
    const html = await page.content()
    expect(text).not.toContain(other.profileId)
    for (const leak of [
      other.email,
      'member@example.test',
      'fixture-batch-01',
      'membership_bootstrap',
      '"metadata"',
      'demo-startup',
      'consumed_by',
    ]) {
      expect(html, leak).not.toContain(leak)
    }
    await otherCtx.dispose()
  })
})

test.describe('WF02-S04 pixel QA', () => {
  test.afterAll(async () => {
    await query('DELETE FROM leadership_records WHERE id = $1', [PIXEL_LEADERSHIP_ID])
  })

  test('viewport against the approved reference (shell, header, roles card)', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S04')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S04')!, {
      // Test-only third row matching the reference: a Chapter 01 leadership record.
      beforeNavigate: async () => {
        await query(
          `INSERT INTO leadership_records (id, profile_id, organization_id, role_label, state, started_at)
           VALUES ($1, $2, $3, 'Phó Chủ tịch', 'ACTIVE', '2026-08-18T03:00:00Z') ON CONFLICT (id) DO NOTHING`,
          [PIXEL_LEADERSHIP_ID, FIXTURES.memberProfileId, CHAPTER_01],
        )
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-card="roles"] li')).toHaveCount(3)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.typography?.violations).toEqual([])

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const r of range.getClientRects())
          rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
      }
      for (const svg of document.querySelectorAll('header svg')) {
        const r = svg.getBoundingClientRect()
        rects.push({ x: r.x - 1, y: r.y - 1, width: r.width + 2, height: r.height + 2 })
      }
      return rects
    })
    // Reference text boxes; the chip boxes are compared, their labels masked.
    const REF_TEXT: Rect[] = [
      { x: 60, y: 18, width: 400, height: 24 },
      { x: 1236, y: 18, width: 100, height: 24 },
      { x: 60, y: 88, width: 110, height: 18 },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      { x: 336, y: 90, width: 775, height: 70 },
      { x: 362, y: 198, width: 130, height: 18 },
      ...[0, 1, 2].flatMap((i) => [
        { x: 362, y: 266 + 139 * i, width: 140, height: 26 },
        { x: 596, y: 270 + 139 * i, width: 50, height: 18 },
        { x: 660, y: 266 + 139 * i, width: 110, height: 26 },
        { x: 1120, y: 266 + 139 * i, width: 234, height: 24 },
      ]),
    ]
    const BELL: Rect = { x: 1196, y: 16, width: 36, height: 28 }
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S04.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      [
        {
          name: 'shell+header+roles-card',
          reference: { x: 0, y: 0, width: 1440, height: 660 },
          dy: 0,
        },
        { name: 'sidebar-rest', reference: { x: 0, y: 660, width: 330, height: 240 }, dy: 0 },
      ],
      [...textMask, ...REF_TEXT, BELL],
      { diffPath },
    )
    writeJsonReport('WF02-S04.segments.json', {
      screen_id: 'WF02-S04',
      state: qaConfigFor('WF02-S04')!.state,
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 340, y: 662, width: 1036, height: 463 },
          reason: 'DEC-WF02-H5: activity journal ("Nhật ký của tôi") not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S04-G5: membership-request card (selector + "Gửi yêu cầu") in the freed slot; not compared',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-H5 / DEC-WF02-S04-D2: right-hand provenance shows stored source and date, never an approver name ("Trần Quốc Huy duyệt", "HUB tổng gán")',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: BELL,
          reason: 'DEC-WF02-H9/H10: bell counter omitted; SVG bell (ICON-RENDERING)',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'text glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
