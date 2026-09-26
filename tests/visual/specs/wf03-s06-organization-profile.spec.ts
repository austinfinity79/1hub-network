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
 * WF03-S06 — organization profile / detail (/ops/org/:orgId/profile).
 * API 05 §8.5; DEC-WF03-C1/G8/G9/G14; DEC-WF03-S06-D1..D4.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const PAGE = (org: string) => `/ops/org/${org}/profile`
const API = (org: string) => `/api/v1/ops/organizations/${org}/profile`

let consoleErrors: string[] = []
const profiles: string[] = []
const accounts: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // 4xx answers are expected refusals; the one 500 is the mocked server error.
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
  await query(`DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])`, [
    [HUB, CHAPTER_01, CHAPTER_02, CLUB_01],
  ])
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [profiles])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** An onboarded person with an ACTIVE membership and a leadership title in Chapter 01. */
async function tiedPerson() {
  const email = `s06-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  accounts.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'S06 Tied', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  profiles.push(p!.id)
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED', now())`,
    [p!.id, CHAPTER_01],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chủ tịch', 'ACTIVE')`,
    [p!.id, CHAPTER_01],
  )
  return email
}

const snapshot = async (id: string) =>
  (
    await query(
      `SELECT name, description, slug, type::text, status::text, parent_id::text, logo_asset_id, metadata, updated_at
         FROM organizations WHERE id = $1`,
      [id],
    )
  )[0]
const hierarchy = async () =>
  query(
    `SELECT id::text, source_org_id::text, target_org_id::text, relationship_type, state::text, ended_at
       FROM organization_relationships ORDER BY id`,
  )
const audits = (id: string) =>
  query<{ action: string; before: unknown; after: unknown }>(
    `SELECT action, before_data AS before, after_data AS after FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [id],
  )
const restoreChapter01 = () =>
  query(
    `UPDATE organizations SET name = 'Chapter 01', description = 'Fixture chapter' WHERE id = $1`,
    [CHAPTER_01],
  )

test.describe('WF03-S06 access and scope', () => {
  test('1/2/6/7. guest → /auth, 401; member, membership + leadership → 404 page, 403 API; unchanged', async ({
    page,
    request,
  }) => {
    const before = await snapshot(CHAPTER_01)
    await page.goto(PAGE(CHAPTER_01))
    await expect(page).toHaveURL('/auth')
    expect((await request.patch(API(CHAPTER_01), { data: { name: 'X' } })).status()).toBe(401)
    for (const email of ['member@example.test', await tiedPerson()]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(PAGE(CHAPTER_01)))?.status(), email).toBe(404)
      const r = await page.request.patch(API(CHAPTER_01), { data: { name: 'Hijack' } })
      expect(r.status(), email).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
    expect(await snapshot(CHAPTER_01)).toEqual(before)
    expect(await audits(CHAPTER_01)).toEqual([])
  })

  test('3/4/5/8. leader: own Chapter only; foreign, child and parent orgs refused; spoofing changes nothing', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    expect((await page.goto(PAGE(CHAPTER_01)))?.status()).toBe(200)
    await expect(page.locator('[data-screen="WF03-S06"]')).toBeVisible()
    const before = {
      hub: await snapshot(HUB),
      ch2: await snapshot(CHAPTER_02),
      club: await snapshot(CLUB_01),
    }
    for (const org of [CLUB_01, CHAPTER_02, HUB, 'sample-org']) {
      expect((await page.goto(PAGE(org)))?.status(), org).toBe(404)
      const r = await page.request.patch(`${API(org)}?orgId=${CHAPTER_01}`, {
        data: { name: 'Hijack' },
        headers: { 'x-org-id': CHAPTER_01, 'x-organization-id': CHAPTER_01 },
      })
      expect(r.status(), org).toBe(403)
    }
    // Ids in the body are refused, not honoured.
    for (const data of [
      { organization_id: CHAPTER_02, name: 'Hijack' },
      { id: CHAPTER_02, name: 'Hijack' },
      { account_id: 'x', name: 'Hijack' },
      { profile_id: 'x', name: 'Hijack' },
    ]) {
      expect((await page.request.patch(API(CHAPTER_01), { data })).status()).toBe(422)
    }
    expect({
      hub: await snapshot(HUB),
      ch2: await snapshot(CHAPTER_02),
      club: await snapshot(CLUB_01),
    }).toEqual(before)
    expect(await audits(CHAPTER_02)).toEqual([])
  })

  test('9/10/11/12. hierarchy and server-owned fields refused; no private data; failure leaves the DB unchanged', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const before = await snapshot(CHAPTER_01)
    const relations = await hierarchy()
    for (const data of [
      { parent_id: CHAPTER_02 },
      { parent: CHAPTER_02 },
      { children: [] },
      { relationship_type: 'PARENT' },
      { type: 'HUB' },
      { slug: 'hijack' },
      { status: 'ARCHIVED' },
      { logo_asset_id: 'x' },
      { metadata: { a: 1 } },
      { updated_at: '2020-01-01T00:00:00Z' },
      { name: 'Hợp lệ', description: 'x'.repeat(2001) },
      { name: '' },
    ]) {
      const r = await page.request.patch(API(CHAPTER_01), { data })
      expect(r.status(), JSON.stringify(data).slice(0, 40)).toBe(422)
      expect((await r.json()).error.code).toBe('PROFILE_VALIDATION_FAILED')
    }
    expect(await snapshot(CHAPTER_01)).toEqual(before)
    expect(await hierarchy()).toEqual(relations)
    expect(await audits(CHAPTER_01)).toEqual([])

    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/@|HUB_COMMUNITY_LEADER|PLATFORM_ADMIN|role_code|metadata/)
    // No hierarchy-management control on S06.
    await expect(page.locator('[data-card="relationships"] button')).toHaveCount(0)
    await expect(page.locator('[data-card="relationships"] input')).toHaveCount(0)
  })
})

test.describe('WF03-S06 view and edit', () => {
  test.afterEach(async () => {
    await restoreChapter01()
  })

  test('view state: canonical fields and read-only hierarchy (organization_relationships)', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-org-name]')).toHaveText('Chapter 01')
    await expect(page.locator('[data-org-type]')).toHaveText('Chapter')
    await expect(page.locator('[data-org-status]')).toHaveText('Đang công khai')
    await expect(page.locator('[data-fact="description"]')).toHaveText('Fixture chapter')
    await expect(page.locator('[data-relation="parent"]')).toContainText('HUB Network')
    await expect(page.locator('[data-relation="child"]')).toContainText('Club 01')
    await expect(page.locator('[data-nav-key="profile"]')).toHaveAttribute('aria-current', 'page')
  })

  test('edit → save: name and description persist, one ORGANIZATION_UPDATED event, hierarchy untouched', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    const relations = await hierarchy()
    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    await page.locator('[data-action="edit"]').click()
    await expect(page.locator('[data-screen="WF03-S06"]')).toHaveAttribute('data-mode', 'edit')
    await page.locator('#org-name').fill('Chapter 01 — Cần Thơ')
    await page.locator('#org-description').fill('Cộng đồng khởi nghiệp.\nDòng hai.')
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-state="save-success"]')).toBeVisible()
    await expect(page.locator('[data-screen="WF03-S06"]')).toHaveAttribute('data-mode', 'view')
    await expect(page.locator('[data-org-name]')).toHaveText('Chapter 01 — Cần Thơ')
    const row = await snapshot(CHAPTER_01)
    expect(row).toMatchObject({
      name: 'Chapter 01 — Cần Thơ',
      description: 'Cộng đồng khởi nghiệp.\nDòng hai.',
      type: 'CHAPTER',
      status: 'PUBLISHED',
    })
    const events = await audits(CHAPTER_01)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      action: 'ORGANIZATION_UPDATED',
      after: { organization_id: CHAPTER_01, changed_fields: ['name', 'description'] },
    })
    expect(JSON.stringify(events)).not.toMatch(/Cộng đồng|@|token|cookie/)
    expect(await hierarchy()).toEqual(relations)
    // Reload shows the persisted canonical values.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-fact="name"]')).toHaveText('Chapter 01 — Cần Thơ')
  })

  test('validation error, server error with safe retry, cancel', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    const before = await snapshot(CHAPTER_01)
    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    await page.locator('[data-action="edit"]').click()
    await page.locator('#org-name').fill('   ')
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-field-error="name"]')).toBeVisible()
    await expect(page.locator('[data-state="save-failed"]')).toBeVisible()
    expect(await snapshot(CHAPTER_01)).toEqual(before)

    await page.route('**/api/v1/ops/organizations/*/profile', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.locator('#org-name').fill('Chapter 01 thử')
    await page.locator('[data-action="save"]').click()
    const failed = page.locator('[data-state="save-failed"]')
    await expect(failed).toContainText('Không lưu được')
    await expect(failed).not.toContainText(/500|UNCONTRACTED|request/i)
    await expect(page.locator('[data-screen="WF03-S06"]')).toHaveAttribute('data-mode', 'edit')
    await page.unroute('**/api/v1/ops/organizations/*/profile')
    // Safe retry: the draft is kept and the same save succeeds.
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-state="save-success"]')).toBeVisible()
    await expect(page.locator('[data-org-name]')).toHaveText('Chapter 01 thử')
    await page.locator('[data-action="edit"]').click()
    await page.locator('#org-name').fill('Bỏ qua')
    await page.locator('[data-action="cancel"]').click()
    await expect(page.locator('[data-org-name]')).toHaveText('Chapter 01 thử')
    expect((await snapshot(CHAPTER_01))!.name).toBe('Chapter 01 thử')
  })
})

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

test.describe('WF03-S06 pixel QA', () => {
  test('viewport + full page against the approved reference (component segments)', async ({
    page,
  }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S06')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S06')!, {
      afterLoad: async (p) => {
        await expect(p.locator('[data-relation]')).toHaveCount(2)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])

    const actual = decodePng(await page.screenshot({ animations: 'disabled', fullPage: true }))
    const reference = readPng(path.join(REPO_ROOT, screen.full_page_baseline!))
    const box = async (sel: string) => (await page.locator(sel).boundingBox())!
    const logo = await box('[data-screen="WF03-S06"] header > span')
    const profile = await box('[data-card="profile"]')
    const relations = await box('[data-card="relationships"]')
    const firstRelation = await box('[data-relation="parent"]')
    const editButton = await box('[data-action="edit"]')
    const typeChip = await box('[data-org-type]')
    const statusChip = await box('[data-org-status]')
    const relChip = (await page.locator('[data-relation="parent"] > span').first().boundingBox())!
    // The drawn top bar is OpsShell's sidebar here: everything moves up 60px and
    // the header / cards start at the content gutter (compared as components).
    const headerDx = Math.round(logo.x) - 64
    const headerDy = Math.round(logo.y) - 84
    const cardDx = Math.round(profile.x) - 324
    const cardDy = Math.round(profile.y) - 195
    const cardRightDx = Math.round(profile.x + profile.width) - 1376
    const relDy = Math.round(relations.y) - 1376
    const relRightDx = Math.round(relations.x + relations.width) - 1376
    const rowDy = Math.round(firstRelation.y) - 1445
    const mask = await textRects(page)
    // Reference text (moved with its segment): name + chips, card eyebrow / title,
    // relationship title and first row.
    const REF_TEXT: Rect[] = [
      { x: 140 + headerDx, y: 84 + headerDy, width: 540, height: 32 },
      { x: 342 + cardDx, y: 214 + cardDy, width: 560, height: 46 },
      { x: 1250 + cardRightDx, y: 226 + cardDy, width: 110, height: 26 },
      { x: 342 + cardDx, y: 1395 + relDy, width: 560, height: 46 },
      { x: 342 + cardDx, y: 1460 + rowDy, width: 760, height: 32 },
    ]
    // INTENTIONAL-CONTRACT: "Yêu cầu đổi chapter cha" (S08 request, not S06).
    // INTENTIONAL-CONTRACT: the undrawn "Chỉnh sửa" action (contract: edit_profile_sections)
    // sits where the reference draws the status chip; status moved to the header chip.
    const OMITTED: Rect[] = [
      { x: 1155 + relRightDx, y: 1395 + relDy, width: 202, height: 48 },
      {
        x: editButton.x - 3,
        y: editButton.y - 3,
        width: editButton.width + 6,
        height: editButton.height + 6,
      },
    ]
    const results = compareSegments(
      reference,
      actual,
      [
        {
          // Logo tile + name line; the chip row is compared per chip below.
          name: 'header-identity',
          reference: { x: 56, y: 76, width: 640, height: 41 },
          dx: headerDx,
          dy: headerDy,
        },
        {
          name: 'header-band-bottom',
          reference: { x: 60, y: 150, width: 1000, height: 30 },
          dx: headerDx,
          dy: headerDy,
        },
        {
          name: 'profile-card-top-left',
          reference: { x: 316, y: 187, width: 640, height: 76 },
          dx: cardDx,
          dy: cardDy,
        },
        {
          name: 'profile-card-top-right',
          reference: { x: 1140, y: 187, width: 245, height: 76 },
          dx: cardRightDx,
          dy: cardDy,
        },
        {
          name: 'relationship-card-top-left',
          reference: { x: 316, y: 1368, width: 640, height: 76 },
          dx: cardDx,
          dy: relDy,
        },
        // Chip / button shapes compared at their left caps (labels and widths differ).
        {
          name: 'type-chip-cap',
          reference: { x: 139, y: 115, width: 16, height: 32 },
          dx: Math.round(typeChip.x) - 142,
          dy: Math.round(typeChip.y) - 118,
        },
        {
          name: 'status-chip-cap',
          reference: { x: 245, y: 115, width: 16, height: 32 },
          dx: Math.round(statusChip.x) - 248,
          dy: Math.round(statusChip.y) - 118,
        },
        {
          name: 'relationship-chip-cap',
          reference: { x: 344, y: 1461, width: 16, height: 31 },
          dx: Math.round(relChip.x) - 347,
          dy: Math.round(relChip.y) - 1464,
        },
        {
          // The drawn secondary button ("Yêu cầu đổi chapter cha") is the style reused
          // for "Chỉnh sửa".
          name: 'secondary-button-cap',
          reference: { x: 1156, y: 1396, width: 18, height: 47 },
          dx: Math.round(editButton.x) - 1159,
          dy: Math.round(editButton.y) - 1399,
        },
        {
          name: 'relationship-first-row',
          reference: { x: 330, y: 1450, width: 700, height: 60 },
          dx: cardDx,
          dy: rowDy,
        },
      ],
      [...mask, ...REF_TEXT, ...OMITTED],
      { diffPath: resolveOutputPath('diff', 'WF03-S06.segments.diff.png') },
    )
    writeJsonReport('WF03-S06.segments.json', {
      screen_id: 'WF03-S06',
      state: qaConfigFor('WF03-S06')!.state,
      full_page: {
        rule: 'EXACT',
        status: full.comparison.status,
        reference_height: 1839,
        actual_height: full.comparison.actual_size!.height,
      },
      offsets: { headerDx, headerDy, cardDx, cardDy, cardRightDx, relDy, relRightDx, rowDy },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-S06-D3: OpsShell replaces the drawn top bar and in-page section menu; header band and cards start at the content gutter and are compared as components',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'Not rendered (no P0 source or owned by S08 / other workflows): publication checklist, representatives, visibility groups, verification, programmes, change history, "Bạn: Người quản lý hồ sơ", "Chưa xác thực thông tin", "Yêu cầu đổi chapter cha", "Yêu cầu lưu trữ"',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'The first card is the canonical profile (view / edit of name and description) in the drawn card chrome; the relationship card shows canonical PARENT rows read-only',
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
