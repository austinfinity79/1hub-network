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
 * WF03-S08 — organization settings / relationships (/ops/org/:orgId/settings).
 * API 05 §8.7; DEC-WF03-S08-RELATIONSHIP-CONTRACT; DEC-WF03-S08-D1..D4; migration 009.
 * Mutations use test-only organizations; the seeded tree is only read.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const PIXEL_CLB = 'e8000000-0000-0000-0000-000000000008'
const PIXEL_CLOSED = 'e8000000-0000-0000-0000-000000000009'
const PAGE = (org: string) => `/ops/org/${org}/settings`
const API = (org: string) => `/api/v1/ops/organizations/${org}/relationships`

let consoleErrors: string[] = []
const orgs: string[] = []
const profiles: string[] = []
const accounts: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  const ids = [...orgs, PIXEL_CLB]
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (
       SELECT id FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[]))`,
    [ids],
  )
  await query(
    `DELETE FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[])`,
    [ids],
  )
  await query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [ids])
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

async function org(type: string, name: string) {
  const [o] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ($1::org_type, $2, $3, 'PUBLISHED') RETURNING id::text`,
    [type, `s08-${Date.now()}-${Math.random().toString(36).slice(2)}`, name],
  )
  orgs.push(o!.id)
  return o!.id
}

async function tiedPerson() {
  const email = `s08-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  accounts.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'S08 Tied', 'ACTIVE', now(), now()) RETURNING id::text`,
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

const tree = () =>
  query(
    `SELECT id::text, source_org_id::text, target_org_id::text, state::text, ended_at
       FROM organization_relationships ORDER BY id`,
  )
const relAudits = async () =>
  Number(
    (
      await query<{ n: string }>(
        `SELECT count(*) AS n FROM audit_events WHERE action LIKE 'ORGANIZATION_RELATIONSHIP_%'`,
      )
    )[0]!.n,
  )
const activeParents = (child: string) =>
  query<{ source: string }>(
    `SELECT source_org_id::text AS source FROM organization_relationships
      WHERE target_org_id = $1 AND relationship_type = 'PARENT' AND state = 'ACTIVE'`,
    [child],
  )

test.describe('WF03-S08 access and scope', () => {
  test('1/2/3/4. guest → /auth, 401; member and membership + leadership → 404 page, 403 API', async ({
    page,
    request,
  }) => {
    const before = await tree()
    await page.goto(PAGE(CHAPTER_01))
    await expect(page).toHaveURL('/auth')
    expect((await request.get(API(CHAPTER_01))).status()).toBe(401)
    expect(
      (
        await request.post(API(CHAPTER_01), {
          data: { target_organization_id: CLUB_01, relationship_type: 'PARENT' },
        })
      ).status(),
    ).toBe(401)
    for (const email of ['member@example.test', await tiedPerson()]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(PAGE(CHAPTER_01)))?.status(), email).toBe(404)
      expect((await page.request.get(API(CHAPTER_01))).status(), email).toBe(403)
      const r = await page.request.post(
        `${API(CHAPTER_01)}/d0000000-0000-0000-0000-000000000002/close`,
        {
          data: {},
        },
      )
      expect(r.status(), email).toBe(403)
    }
    expect(await tree()).toEqual(before)
  })

  test('6/7. leader: reads own Chapter; every mutation touching another org is 403; spoofing changes nothing', async ({
    page,
  }) => {
    const before = await tree()
    const audits = await relAudits()
    const clb = await org('CLB', 'S08 Leader Target')
    await login(page.request, 'leader@example.test')
    expect((await page.goto(PAGE(CHAPTER_01)))?.status()).toBe(200)
    await expect(page.locator('[data-screen="WF03-S08"]')).toBeVisible()
    await expect(page.locator('[data-relationship]')).toHaveCount(2)
    // Both ends are required: nothing is manageable, no candidates.
    await expect(page.locator('[data-action="end"]')).toHaveCount(0)
    await expect(page.locator('[data-state="no-candidates"]')).toBeVisible()
    for (const [path, data] of [
      [API(CHAPTER_01), { target_organization_id: clb, relationship_type: 'PARENT' }],
      [API(CHAPTER_01), { target_organization_id: CHAPTER_02, relationship_type: 'PARENT' }],
      [API(HUB), { target_organization_id: clb, relationship_type: 'PARENT' }],
      [`${API(CHAPTER_01)}/d0000000-0000-0000-0000-000000000001/close`, {}],
      [`${API(CHAPTER_01)}/d0000000-0000-0000-0000-000000000002/close`, {}],
    ] as const) {
      const r = await page.request.post(path, {
        data,
        headers: { 'x-org-id': HUB, 'x-organization-id': HUB },
      })
      expect(r.status(), path).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
    for (const id of [CLUB_01, CHAPTER_02, HUB, 'sample-org']) {
      expect((await page.goto(PAGE(id)))?.status(), id).toBe(404)
      expect((await page.request.get(API(id))).status(), id).toBe(403)
    }
    expect(await tree()).toEqual(before)
    expect(await relAudits()).toBe(audits)
  })
})

test.describe('WF03-S08 relationship lifecycle (platform admin, test organizations)', () => {
  test('create → change parent → close through the UI; history kept; parent_id never written', async ({
    page,
  }) => {
    const hub = await org('HUB', 'S08 HUB')
    const chA = await org('CHAPTER', 'S08 Chapter A')
    const chB = await org('CHAPTER', 'S08 Chapter B')
    const clb = await org('CLB', 'S08 CLB')
    await query(
      `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type) VALUES ($1, $2, 'PARENT'), ($1, $3, 'PARENT')`,
      [hub, chA, chB],
    )
    await login(page.request, 'ops@example.test')
    // Create: Chapter A becomes the parent of the CLB.
    await page.goto(PAGE(chA), { waitUntil: 'networkidle' })
    await page.locator('#relationship-mode').selectOption('CHILD')
    await page.locator('#relationship-target').selectOption(clb)
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-state="save-success"]')).toBeVisible()
    await expect(page.locator('[data-relationship]')).toHaveCount(2)
    expect((await activeParents(clb)).map((r) => r.source)).toEqual([chA])

    // Change parent from the CLB: explicit, atomic, old row kept as history.
    await page.goto(PAGE(clb), { waitUntil: 'networkidle' })
    await page.locator('#relationship-mode').selectOption('PARENT')
    await expect(page.locator('[data-add-form]')).toContainText('Đã kết thúc')
    await page.locator('#relationship-target').selectOption(chB)
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-state="save-success"]')).toBeVisible()
    await expect(page.locator('[data-history]')).toHaveCount(1)
    await expect(page.locator('[data-history]')).toContainText('S08 Chapter A')
    expect((await activeParents(clb)).map((r) => r.source)).toEqual([chB])

    // Close with a reason.
    await page.locator('[data-action="end"]').click()
    await page.locator('[data-close-form] input').fill('Kết thúc nhiệm kỳ')
    await page.locator('[data-close-form] button[type="submit"]').click()
    await expect(page.locator('[data-state="save-success"]')).toBeVisible()
    await expect(page.locator('[data-relationship]')).toHaveCount(0)
    await expect(page.locator('[data-history]')).toHaveCount(2)
    await expect(page.locator('[data-card="history"]')).toContainText('Kết thúc nhiệm kỳ')
    expect(await activeParents(clb)).toEqual([])

    const events = await query<{ action: string; after: unknown }>(
      `SELECT action, after_data AS after FROM audit_events WHERE resource_id IN (
         SELECT id FROM organization_relationships WHERE target_org_id = $1) ORDER BY created_at, id`,
      [clb],
    )
    // created_at is transaction time, so the change's ENDED + CREATED tie: compare as a set.
    expect(events.map((e) => e.action).sort()).toEqual([
      'ORGANIZATION_RELATIONSHIP_CREATED',
      'ORGANIZATION_RELATIONSHIP_CREATED',
      'ORGANIZATION_RELATIONSHIP_ENDED',
      'ORGANIZATION_RELATIONSHIP_ENDED',
    ])
    expect(JSON.stringify(events)).not.toMatch(/nhiệm kỳ|@|token|cookie|S08 /)
    const legacy = await query<{ parent_id: string | null }>(
      `SELECT parent_id::text FROM organizations WHERE id = ANY($1::uuid[])`,
      [[chA, chB, clb]],
    )
    expect(legacy.every((r) => r.parent_id === null)).toBe(true)

    // S06 reads the same canonical hierarchy.
    await page.goto(`/ops/org/${chB}/profile`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-relation="parent"]')).toContainText('S08 HUB')
    await expect(page.locator('[data-relation="child"]')).toHaveCount(0)
  })

  test('8/9/10/11/13. type matrix, second parent, self, spoofed ids, extra fields: refused, no audit', async ({
    page,
  }) => {
    const hub = await org('HUB', 'S08 R HUB')
    const hub2 = await org('HUB', 'S08 R HUB 2')
    const ch = await org('CHAPTER', 'S08 R Chapter')
    const clb = await org('CLB', 'S08 R CLB')
    await login(page.request, 'ops@example.test')
    expect(
      (
        await page.request.post(API(hub), {
          data: { target_organization_id: ch, relationship_type: 'PARENT' },
        })
      ).status(),
    ).toBe(201)
    const before = await tree()
    const audits = await relAudits()
    const cases: Array<[string, Record<string, unknown>, number, string?]> = [
      [hub, { target_organization_id: clb, relationship_type: 'PARENT' }, 422, 'type_not_allowed'],
      [clb, { target_organization_id: ch, relationship_type: 'PARENT' }, 422, 'type_not_allowed'],
      [ch, { target_organization_id: hub, relationship_type: 'PARENT' }, 422, 'type_not_allowed'],
      [ch, { target_organization_id: ch, relationship_type: 'PARENT' }, 422, 'self'],
      [hub2, { target_organization_id: ch, relationship_type: 'PARENT' }, 409],
      [hub, { target_organization_id: ch, relationship_type: 'PARENT' }, 409],
      [hub, { target_organization_id: ch, relationship_type: 'PARTNER' }, 422],
      [hub, { target_organization_id: ch, relationship_type: 'PARENT', parent_id: hub2 }, 422],
      [hub, { target_organization_id: ch, relationship_type: 'PARENT', state: 'CLOSED' }, 422],
      [
        hub2,
        { target_organization_id: ch, relationship_type: 'PARENT', replaces_relationship_id: hub },
        409,
      ],
      [
        hub,
        {
          target_organization_id: '00000000-0000-0000-0000-000000000000',
          relationship_type: 'PARENT',
        },
        404,
      ],
      [hub, { target_organization_id: 'not-a-uuid', relationship_type: 'PARENT' }, 422],
    ]
    for (const [path, data, status, reason] of cases) {
      const r = await page.request.post(API(path), { data })
      expect(r.status(), JSON.stringify(data)).toBe(status)
      if (reason) expect((await r.json()).error.fields.target_organization_id).toBe(reason)
    }
    expect(await tree()).toEqual(before)
    expect(await relAudits()).toBe(audits)
    expect((await activeParents(ch)).map((r) => r.source)).toEqual([hub])
  })

  test('12. concurrent parents for one child: one 201, one 409, one ACTIVE parent', async ({
    page,
  }) => {
    const chA = await org('CHAPTER', 'S08 C Chapter A')
    const chB = await org('CHAPTER', 'S08 C Chapter B')
    const clb = await org('CLB', 'S08 C CLB')
    await login(page.request, 'ops@example.test')
    const [a, b] = await Promise.all(
      [chA, chB].map((p) =>
        page.request.post(API(p), {
          data: { target_organization_id: clb, relationship_type: 'PARENT' },
        }),
      ),
    )
    expect([a!.status(), b!.status()].sort()).toEqual([201, 409])
    expect(await activeParents(clb)).toHaveLength(1)
  })

  test('Idempotency-Key (05 §2.3): replay returns the first result; a different body is refused', async ({
    page,
  }) => {
    const ch = await org('CHAPTER', 'S08 I Chapter')
    const clb = await org('CLB', 'S08 I CLB')
    const other = await org('CLB', 'S08 I CLB 2')
    await login(page.request, 'ops@example.test')
    const key = `s08-${Date.now()}`
    const send = (target: string) =>
      page.request.post(API(ch), {
        data: { target_organization_id: target, relationship_type: 'PARENT' },
        headers: { 'Idempotency-Key': key },
      })
    const first = await send(clb)
    const replay = await send(clb)
    expect([first.status(), replay.status()]).toEqual([201, 201])
    expect(await replay.json()).toEqual(await first.json())
    expect(await activeParents(clb)).toHaveLength(1)
    const created = (await first.json()).id as string
    const events = await query(`SELECT 1 FROM audit_events WHERE resource_id = $1`, [created])
    expect(events).toHaveLength(1)
    const mismatch = await send(other)
    expect(mismatch.status()).toBe(409)
    expect(await activeParents(other)).toHaveLength(0)
    // Close with a key: the replay does not re-run (no second 409).
    const closeKey = { 'Idempotency-Key': `${key}-close` }
    const c1 = await page.request.post(`${API(ch)}/${created}/close`, {
      data: {},
      headers: closeKey,
    })
    const c2 = await page.request.post(`${API(ch)}/${created}/close`, {
      data: {},
      headers: closeKey,
    })
    expect([c1.status(), c2.status()]).toEqual([200, 200])
    expect(
      await query(`SELECT 1 FROM audit_events WHERE resource_id = $1`, [created]),
    ).toHaveLength(2)
  })

  test('14. DTO carries no PII or account data', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    const body = await (await page.request.get(API(CHAPTER_01))).json()
    expect(Object.keys(body).sort()).toEqual([
      'candidates',
      'children',
      'history',
      'organization',
      'parent',
      'permissions',
    ])
    expect(JSON.stringify(body)).not.toMatch(
      /@|email|account|profile|parent_id|role_code|metadata/i,
    )
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

test.describe('WF03-S08 pixel QA', () => {
  test('viewport + full page against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S08')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S08')!, {
      // A parentless CLB (the add form has a candidate) and one closed relationship (history).
      beforeNavigate: async () => {
        await query(
          `INSERT INTO organizations (id, type, slug, name, status) VALUES ($1, 'CLB', 's08-pixel-clb', 'CLB QA', 'PUBLISHED') ON CONFLICT (id) DO NOTHING`,
          [PIXEL_CLB],
        )
        await query(
          `INSERT INTO organization_relationships (id, source_org_id, target_org_id, relationship_type, state, started_at, ended_at, metadata)
           VALUES ($1, $2, $3, 'PARENT', 'CLOSED', '2025-01-10T03:00:00Z', '2026-09-01T03:00:00Z', '{"close_reason":"Chuyển sang chapter khác"}')
           ON CONFLICT (id) DO NOTHING`,
          [PIXEL_CLOSED, CHAPTER_01, PIXEL_CLB],
        )
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-relationship]')).toHaveCount(2)
        await expect(p.locator('[data-history]')).toHaveCount(1)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    const below = full.below_reference!.unexpected_bbox
    if (below) expect(below.x + below.width, 'UI below the reference').toBeLessThanOrEqual(216)

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!
    const activeCard = await box('[data-card="active"]')
    const historyCard = await box('[data-card="history"]')
    const rulesCard = await box('[data-card="rules"]')
    const firstRow = await box('[data-relationship]')
    const addButton = await box('[data-action="focus-add"]')
    expect([Math.round(addButton.x), Math.round(addButton.y)]).toEqual([931, 32])
    // The change-parent request card (ADM21 197..384) is not P0: the cards below move up.
    const activeDy = Math.round(activeCard.y) - 401
    const historyDy = Math.round(historyCard.y) - 772
    const rulesDy = Math.round(rulesCard.y) - 334
    const rowDy = Math.round(firstRow.y) - 466
    const mask = await textRects(page)
    const REF_TEXT: Rect[] = [
      { x: 238, y: 20, width: 440, height: 58 },
      { x: 936, y: 38, width: 112, height: 22 },
      { x: 258, y: 106, width: 250, height: 20 },
      // Tree chips: labels (and so chip widths) are the canonical names.
      { x: 258, y: 128, width: 440, height: 36 },
      { x: 258, y: 417 + activeDy, width: 780, height: 44 },
      { x: 258, y: 470 + rowDy, width: 790, height: 280 },
      { x: 258, y: 787 + historyDy, width: 780, height: 64 },
      { x: 1086, y: 40, width: 320, height: 48 },
      { x: 1086, y: 138, width: 320, height: 20 },
      { x: 1096, y: 96, width: 300, height: 26 },
      { x: 1096, y: 170, width: 300, height: 26 },
      { x: 1086, y: 208, width: 320, height: 48 },
      { x: 1100, y: 268, width: 90, height: 26 },
      { x: 1086, y: 350 + rulesDy, width: 320, height: 200 },
    ]
    // INTENTIONAL-P0-SCOPE: "+ Thêm quan hệ" label width follows the copy; the
    // drawn add form shows its error state (red field + message); ours is idle.
    const OMITTED: Rect[] = [
      { x: 1086, y: 160, width: 322, height: 48 },
      { x: 1086, y: 206, width: 322, height: 52 },
    ]
    const results = compareSegments(
      reference,
      actual,
      [
        // Title block and the pinned "+ Thêm quan hệ" button (122×33 at 931, 32).
        { name: 'header', reference: { x: 216, y: 0, width: 850, height: 84 }, dy: 0 },
        { name: 'tree-card', reference: { x: 236, y: 84, width: 824, height: 104 }, dy: 0 },
        {
          name: 'active-card-top',
          reference: { x: 236, y: 395, width: 824, height: 72 },
          dy: activeDy,
        },
        {
          name: 'active-first-row',
          reference: { x: 236, y: 466, width: 824, height: 45 },
          dy: rowDy,
        },
        {
          name: 'history-card',
          reference: { x: 236, y: 766, width: 824, height: 104 },
          dy: historyDy,
        },
        // Up to the second label: below it the reference draws the error state.
        { name: 'add-card-top', reference: { x: 1064, y: 16, width: 360, height: 144 }, dy: 0 },
        {
          name: 'rules-card-top',
          reference: { x: 1064, y: 328, width: 360, height: 60 },
          dy: rulesDy,
        },
      ],
      [...mask, ...REF_TEXT, ...OMITTED],
      { diffPath: resolveOutputPath('diff', 'WF03-S08.segments.diff.png') },
    )
    writeJsonReport('WF03-S08.segments.json', {
      screen_id: 'WF03-S08',
      state: qaConfigFor('WF03-S08')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      offsets: { activeDy, historyDy, rulesDy, rowDy },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reason:
            'Change-parent request queue (approve / reject / request more), partner / co-organizer / programme rows and the audit-log card are not P0 (DEC-WF03-S08-D4); the cards below move up and are compared as components',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'Valid pairs follow ADM21 (HUB → Chapter, Chapter → CLB); the rules card shows the frozen matrix; the add form is idle (the drawn error state is exercised in tests)',
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
