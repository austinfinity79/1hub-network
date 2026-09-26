import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF03-S03 — organization members (/ops/org/:orgId/members).
 * API 05 §8.3; DEC-WF03-G3/G4/G5/G6; DEC-WF03-S03-D1..D3.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const PIXEL_ORG = 'e8000000-0000-0000-0000-000000000001'
const membersApi = (id: string) => `/api/v1/ops/organizations/${id}/members`

let consoleErrors: string[] = []
const profiles: string[] = []
const orgs: string[] = []

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
  for (const table of [
    'community_memberships',
    'leadership_records',
    'profile_visibility_settings',
  ]) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [orgs])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(
  name: string,
  opts: { org?: string; state?: string; leader?: string; level?: string; onboarded?: boolean } = {},
) {
  const email = `s03-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, headline, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'Kỹ sư', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  profiles.push(p!.id)
  if (opts.org && opts.state) {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at, created_at)
       VALUES ($1, $2, $3::membership_state, $4, '2026-02-01T03:00:00Z', '2026-02-01T03:00:00Z')`,
      [
        p!.id,
        opts.org,
        opts.state,
        opts.state === 'PENDING_APPROVAL' ? 'SELF_DECLARED' : 'ORGANIZATION_VERIFIED',
      ],
    )
  }
  if (opts.org && opts.leader) {
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, $3, 'ACTIVE')`,
      [p!.id, opts.org, opts.leader],
    )
  }
  if (opts.level) {
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, group_overrides) VALUES ($1, $2)`,
      [p!.id, JSON.stringify({ PROFILE_DISCOVERY: opts.level })],
    )
  }
  return { email, profileId: p!.id }
}

const rows = (page: Page) => page.locator('[data-member-row]')

test.describe('WF03-S03 access and scope', () => {
  test('1/2/7/8. guest → /auth; member and membership + leadership alone → 404 / 403', async ({
    page,
    request,
  }) => {
    await page.goto(`/ops/org/${CHAPTER_01}/members`)
    await expect(page).toHaveURL('/auth')
    expect((await request.get(membersApi(CHAPTER_01))).status()).toBe(401)
    const tied = await person('S03 Tied', {
      org: CHAPTER_01,
      state: 'ACTIVE',
      leader: 'Trưởng ban',
    })
    for (const email of ['member@example.test', tied.email]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(`/ops/org/${CHAPTER_01}/members`))?.status(), email).toBe(404)
      expect((await page.request.get(membersApi(CHAPTER_01))).status(), email).toBe(403)
    }
  })

  test('3/4/5/6/10/11. leader: own org only; ids and headers spoofed; no PII or role data', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
    await expect(rows(page).first()).toBeVisible()
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/@|HUB_COMMUNITY_LEADER|PLATFORM_ADMIN|role_code/)
    const body = await (await page.request.get(membersApi(CHAPTER_01))).json()
    expect(JSON.stringify(body)).not.toMatch(/@|email|account|bio|role_code|capabilit|metadata/i)
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        'leadership',
        'membership',
        'profile',
        'profile_id',
      ])
    }
    for (const id of [CLUB_01, CHAPTER_02, 'sample-org']) {
      expect((await page.goto(`/ops/org/${id}/members`))?.status(), id).toBe(404)
      const r = await page.request.get(membersApi(id), { headers: { 'x-org-id': CHAPTER_01 } })
      expect(r.status(), id).toBe(403)
    }
    // A member's profile id under a foreign org path stays denied.
    const someone = body.items[0].profile_id as string
    expect((await page.goto(`/ops/org/${CHAPTER_02}/members/${someone}`))?.status()).toBe(404)
  })

  test('9/12. PRIVATE discovery: identity hidden from ops (admin too), facts shown, search blind', async ({
    page,
  }) => {
    const hidden = await person('S03 Ẩn Danh', {
      org: CHAPTER_01,
      state: 'ACTIVE',
      level: 'PRIVATE',
    })
    for (const email of ['leader@example.test', 'ops@example.test']) {
      await page.context().clearCookies()
      await login(page.request, email)
      await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
      const row = page.locator(`[data-member-row="${hidden.profileId}"]`)
      await expect(row).toContainText('Hồ sơ không công khai')
      await expect(row).not.toContainText('Ẩn Danh')
      await expect(row).toContainText('Thành viên')
      const api = await (
        await page.request.get(`${membersApi(CHAPTER_01)}?q=${encodeURIComponent('Ẩn Danh')}`)
      ).json()
      expect(api.items).toEqual([])
    }
  })
})

test.describe('WF03-S03 filters and states', () => {
  test('chips filter pending requests and active leadership; search by visible name', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    const [o] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S03 Filter Club', 'PUBLISHED') RETURNING id::text`,
      [`s03-f-${Date.now()}`],
    )
    orgs.push(o!.id)
    const a = await person('S03 An', { org: o!.id, state: 'ACTIVE', leader: 'Chủ nhiệm' })
    const b = await person('S03 Bình', { org: o!.id, state: 'PENDING_APPROVAL' })
    await page.goto(`/ops/org/${o!.id}/members`, { waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(2)
    await expect(page.locator(`[data-member-row="${b.profileId}"]`)).toHaveAttribute(
      'data-membership-state',
      'PENDING_APPROVAL',
    )
    await page.locator('[data-filter="pending"]').click()
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator(`[data-member-row="${b.profileId}"]`)).toBeVisible()
    await page.locator('[data-filter="leaders"]').click()
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator(`[data-member-row="${a.profileId}"]`)).toContainText('Chủ nhiệm')
    await page.locator('[data-filter="leaders"]').click()
    await page.getByRole('searchbox').fill('bình')
    await page.getByRole('searchbox').press('Enter')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator(`[data-member-row="${b.profileId}"] a`)).toHaveAttribute(
      'href',
      `/ops/org/${o!.id}/members/${b.profileId}`,
    )
  })

  test('empty and error states', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    const [o] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S03 Empty Club', 'DRAFT') RETURNING id::text`,
      [`s03-e-${Date.now()}`],
    )
    orgs.push(o!.id)
    await page.goto(`/ops/org/${o!.id}/members`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="members-empty"]')).toHaveText('Chưa có thành viên nào.')
    await page.route('**/api/v1/ops/organizations/*/members*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.reload({ waitUntil: 'networkidle' })
    const failed = page.locator('[data-state="members-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).not.toContainText(/500|UNCONTRACTED|request/i)
    await page.unroute('**/api/v1/ops/organizations/*/members*')
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator('[data-state="members-empty"]')).toBeVisible()
  })
})

test.describe('WF03-S03 pixel QA', () => {
  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S03')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S03')!, {
      // Test-only CLB with the drawn five rows: rows 2 and 5 need attention (pending).
      beforeNavigate: async () => {
        await query(
          `INSERT INTO organizations (id, type, slug, name, status) VALUES ($1, 'CLB', 's03-pixel-club', 'CLB QA', 'PUBLISHED') ON CONFLICT (id) DO NOTHING`,
          [PIXEL_ORG],
        )
        orgs.push(PIXEL_ORG)
        await person('An Nguyễn', { org: PIXEL_ORG, state: 'ACTIVE' })
        await person('Bình Trần', { org: PIXEL_ORG, state: 'PENDING_APPROVAL' })
        await person('Chi Lê', { org: PIXEL_ORG, state: 'ACTIVE', leader: 'Chủ nhiệm' })
        await person('Dũng Phạm', { org: PIXEL_ORG, state: 'ALUMNI' })
        await person('Hà Võ', { org: PIXEL_ORG, state: 'PENDING_APPROVAL' })
      },
      afterLoad: async (p) => {
        await expect(rows(p)).toHaveCount(5)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    // Below the 893px reference only the OpsShell sidebar continues.
    const below = full.below_reference!.unexpected_bbox
    if (below) expect(below.x + below.width, 'UI below the reference').toBeLessThanOrEqual(216)

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    // The first chip is compared as a component: its position follows the omitted
    // dropdowns and its label differs (contracted filter), its shape does not.
    const chipBox = (await page.locator('[data-filter="pending"]').boundingBox())!
    // Compared with the drawn INACTIVE chip ("Đang bị khoá", 1104..1223 × 106..140);
    // the first drawn chip is in its active state.
    const chipDx = Math.round(chipBox.x) - 1104
    const chipDy = Math.round(chipBox.y) - 106
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
      return rects
    })
    // Reference text: title, subtitle, search placeholder, chip labels, column labels, cells.
    const REF_TEXT: Rect[] = [
      { x: 238, y: 24, width: 400, height: 52 },
      { x: 270, y: 112, width: 220, height: 24 },
      { x: 960, y: 112, width: 440, height: 24 },
      { x: 256, y: 180, width: 960, height: 22 },
      ...[346, 462, 578, 694, 810].flatMap((y) => [
        { x: 294, y: y - 16, width: 250, height: 36 },
        { x: 556, y: y - 14, width: 110, height: 30 },
        { x: 720, y: y - 10, width: 780, height: 22 },
      ]),
    ]
    // INTENTIONAL-P0-SCOPE: "Xuất CSV", the region and role dropdowns (no source).
    const OMITTED: Rect[] = [
      { x: 1324, y: 28, width: 92, height: 42 },
      { x: 1228, y: 100, width: 184, height: 50 },
    ]
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header', reference: { x: 216, y: 0, width: 1224, height: 86 }, dy: 0 },
        { name: 'filter-card-left', reference: { x: 216, y: 86, width: 500, height: 78 }, dy: 0 },
        { name: 'filter-card-right', reference: { x: 1400, y: 86, width: 40, height: 78 }, dy: 0 },
        {
          name: 'chip',
          reference: { x: 1101, y: 103, width: 64, height: 41 },
          dy: chipDy,
          dx: chipDx,
        },
        { name: 'table', reference: { x: 216, y: 165, width: 1224, height: 710 }, dy: 0 },
      ],
      [
        ...textMask,
        ...REF_TEXT,
        ...OMITTED,
        // The reference chip label, moved with the chip segment.
        { x: 1110 + chipDx, y: 112 + chipDy, width: 110, height: 24 },
      ],
      { diffPath: resolveOutputPath('diff', 'WF03-S03.segments.diff.png') },
    )
    writeJsonReport('WF03-S03.segments.json', {
      screen_id: 'WF03-S03',
      state: qaConfigFor('WF03-S03')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-G3 / S03-D1: organization relationship view, not account admin — columns Thành viên, Trạng thái, Nguồn, Vai trò, Từ; no email, verification or last login',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: OMITTED[0],
          reason: '"Xuất CSV" not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'Chip row: two contracted filter chips right-aligned; the search field takes the width freed by the omitted dropdowns (compared per component)',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: OMITTED[1],
          reason: '"Tỉnh" and "Vai trò HUB" dropdowns have no contracted filter',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'Chips are the contracted filters (pending requests, active leadership); the attention tint marks PENDING_APPROVAL rows; the second identity line is the visible headline',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
