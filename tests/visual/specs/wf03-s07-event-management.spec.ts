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
 * WF03-S07 — standalone Event management (/ops/org/:orgId/events).
 * API 05 §8.6; DEC-WF03-G2/G10/G14; DEC-WF03-S07-EVENT-LIFECYCLE; DEC-WF03-S07-D1..D4.
 * The S07 bitmap is a WF04 collage (not authority): visual QA compares the
 * screen's primitives with the approved WF03 S08 (ADM21) reference.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const DEMO_EVENT = 'b0000000-0000-0000-0000-000000000001' // PUBLISHED, standalone
const PROGRAMME_EVENT = 'b0000000-0000-0000-0000-000000000002' // DRAFT, programme-linked (WF04)
const PAGE = (org: string) => `/ops/org/${org}/events`
const LIST = (org: string) => `/api/v1/ops/organizations/${org}/events`
const EVENT = (id: string) => `/api/v1/ops/events/${id}`

let consoleErrors: string[] = []
const profiles: string[] = []
const accounts: string[] = []
const orgs: string[] = []

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
  const mine = `SELECT id FROM events WHERE name LIKE 'S07 %' OR organization_id = ANY($1::uuid[])`
  await query(`DELETE FROM audit_events WHERE resource_id IN (${mine})`, [orgs])
  await query(`DELETE FROM events WHERE id IN (${mine})`, [orgs])
  await query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [orgs])
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

async function tiedPerson() {
  const email = `s07-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  accounts.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'S07 Tied', 'ACTIVE', now(), now()) RETURNING id::text`,
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

/** A PUBLISHED standalone event in a test organization outside the leader's scope. */
async function foreignEvent() {
  const [o] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S07 Foreign Club', 'PUBLISHED') RETURNING id::text`,
    [`s07-${Date.now()}-${Math.random().toString(36).slice(2)}`],
  )
  orgs.push(o!.id)
  const [e] = await query<{ id: string }>(
    `INSERT INTO events (organization_id, slug, name, status, starts_at, ends_at)
     VALUES ($1, $2, 'S07 Foreign Event', 'PUBLISHED', now() + interval '10 days', now() + interval '11 days')
     RETURNING id::text`,
    [o!.id, `s07-foreign-${Date.now()}`],
  )
  return e!.id
}

const eventRow = async (id: string) =>
  (
    await query(
      `SELECT name, summary, starts_at, ends_at, location_text, status::text, programme_id, organization_id::text, updated_at
         FROM events WHERE id = $1`,
      [id],
    )
  )[0]
const eventAudits = (id: string) =>
  query<{ action: string; before: unknown; after: unknown }>(
    `SELECT action, before_data AS before, after_data AS after FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [id],
  )
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

test.describe('WF03-S07 access and scope', () => {
  test('1/2/3/4. guest → /auth, 401; member and membership + leadership → 404 page, 403 / 404 API', async ({
    page,
    request,
  }) => {
    const before = await eventRow(DEMO_EVENT)
    await page.goto(PAGE(CHAPTER_01))
    await expect(page).toHaveURL('/auth')
    expect((await request.get(LIST(CHAPTER_01))).status()).toBe(401)
    expect((await request.post(LIST(CHAPTER_01), { data: { name: 'X' } })).status()).toBe(401)
    expect((await request.post(`${EVENT(DEMO_EVENT)}/cancel`)).status()).toBe(401)
    for (const email of ['member@example.test', await tiedPerson()]) {
      await page.context().clearCookies()
      await login(page.request, email)
      const r = page.request
      expect((await page.goto(PAGE(CHAPTER_01)))?.status(), email).toBe(404)
      expect((await r.get(LIST(CHAPTER_01))).status(), email).toBe(403)
      expect((await r.post(LIST(CHAPTER_01), { data: { name: 'S07 Hijack' } })).status()).toBe(403)
      for (const [method, url] of [
        ['get', `/api/v1/events/${DEMO_EVENT}`],
        ['patch', EVENT(DEMO_EVENT)],
        ['post', `${EVENT(DEMO_EVENT)}/publish`],
        ['post', `${EVENT(DEMO_EVENT)}/cancel`],
      ] as const) {
        const res = await r[method](url, method === 'patch' ? { data: { name: 'Hijack' } } : {})
        expect(res.status(), `${email} ${method} ${url}`).toBe(404)
      }
    }
    expect(await eventRow(DEMO_EVENT)).toEqual(before)
    expect(await eventAudits(DEMO_EVENT)).toEqual([])
  })

  test('5/6/9/10/11. leader: own Chapter only; foreign org and foreign event refused; spoofing changes nothing', async ({
    page,
  }) => {
    const foreign = await foreignEvent()
    const before = await eventRow(foreign)
    await login(page.request, 'leader@example.test')
    expect((await page.goto(PAGE(CHAPTER_01)))?.status()).toBe(200)
    await expect(page.locator(`[data-event="${DEMO_EVENT}"]`)).toBeVisible()
    // The programme-linked draft is WF04: not listed.
    await expect(page.locator(`[data-event="${PROGRAMME_EVENT}"]`)).toHaveCount(0)
    for (const org of [CLUB_01, CHAPTER_02, 'sample-org']) {
      expect((await page.goto(PAGE(org)))?.status(), org).toBe(404)
      const r = await page.request.post(`${LIST(org)}?orgId=${CHAPTER_01}`, {
        data: { name: 'S07 Hijack' },
        headers: { 'x-org-id': CHAPTER_01, 'x-organization-id': CHAPTER_01 },
      })
      expect(r.status(), org).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
    for (const [method, url] of [
      ['patch', EVENT(foreign)],
      ['post', `${EVENT(foreign)}/publish`],
      ['post', `${EVENT(foreign)}/cancel`],
      ['patch', EVENT(PROGRAMME_EVENT)],
      ['post', `${EVENT(PROGRAMME_EVENT)}/publish`],
    ] as const) {
      const res = await page.request[method](url, method === 'patch' ? { data: { name: 'x' } } : {})
      expect(res.status(), url).toBe(404)
    }
    expect(await eventRow(foreign)).toEqual(before)
    expect(await eventAudits(foreign)).toEqual([])
  })

  test('7/8/12/13. programme_id / server fields refused; unsupported transitions 409; DB unchanged; safe DTO', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const count = (await query(`SELECT 1 FROM events WHERE organization_id = $1`, [CHAPTER_01]))
      .length
    for (const data of [
      { name: 'S07 X', programme_id: 'c0000000-0000-0000-0000-000000000001' },
      { name: 'S07 X', registration_enabled: true },
      { name: 'S07 X', status: 'PUBLISHED' },
      { name: 'S07 X', organization_id: CHAPTER_02 },
      { name: 'S07 X', timezone: 'UTC' },
      { name: 'S07 X', starts_at: future(3), ends_at: future(2) },
    ]) {
      const r = await page.request.post(LIST(CHAPTER_01), { data })
      expect(r.status(), JSON.stringify(data)).toBe(422)
    }
    expect(
      (await query(`SELECT 1 FROM events WHERE organization_id = $1`, [CHAPTER_01])).length,
    ).toBe(count)
    const before = await eventRow(DEMO_EVENT)
    // DEMO_EVENT is PUBLISHED: publish again → 409; PATCH programme → 422.
    expect((await page.request.post(`${EVENT(DEMO_EVENT)}/publish`)).status()).toBe(409)
    expect(
      (await page.request.patch(EVENT(DEMO_EVENT), { data: { programme_id: null } })).status(),
    ).toBe(422)
    expect(await eventRow(DEMO_EVENT)).toEqual(before)
    expect(await eventAudits(DEMO_EVENT)).toEqual([])
    // A fresh DRAFT cannot be cancelled (E1).
    const created = await (
      await page.request.post(LIST(CHAPTER_01), { data: { name: 'S07 Draft Only' } })
    ).json()
    expect((await page.request.post(`${EVENT(created.id)}/cancel`)).status()).toBe(409)
    const list = await (await page.request.get(LIST(CHAPTER_01))).json()
    for (const item of list.items) {
      expect(Object.keys(item).sort()).toEqual([
        'created_at',
        'ends_at',
        'id',
        'location_text',
        'name',
        'organization_id',
        'slug',
        'starts_at',
        'status',
        'summary',
        'updated_at',
      ])
    }
    expect(JSON.stringify(list)).not.toMatch(
      /@|email|account|profile|programme|metadata|role_code/i,
    )
  })
})

test.describe('WF03-S07 lifecycle through the UI', () => {
  test('create → validation error → edit → publish → cancel; audit and history kept', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-card="create"]')).toBeVisible()
    await page.locator('#event-name').fill('S07 Chapter Summit')
    await page.locator('#event-starts').fill('2031-03-10T09:00')
    await page.locator('#event-ends').fill('2031-03-10T08:00')
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-field-error="ends_at"]')).toBeVisible()
    await page.locator('#event-ends').fill('2031-03-10T12:00')
    await page.locator('#event-location').fill('Cần Thơ')
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-state="action-success"]')).toBeVisible()
    await expect(page.locator('[data-card="detail"]')).toBeVisible()
    const row = page.locator('[data-event]', { hasText: 'S07 Chapter Summit' })
    await expect(row).toHaveAttribute('data-status', 'DRAFT')
    const id = (await row.getAttribute('data-event'))!
    expect(await eventRow(id)).toMatchObject({
      organization_id: CHAPTER_01,
      programme_id: null,
      status: 'DRAFT',
      location_text: 'Cần Thơ',
    })
    // Stored in UTC from the Asia/Ho_Chi_Minh input.
    expect(new Date((await eventRow(id))!.starts_at as Date).toISOString()).toBe(
      '2031-03-10T02:00:00.000Z',
    )

    await page.locator('#event-summary').fill('Gặp mặt thường niên')
    await page.locator('[data-action="save"]').click()
    await expect(page.locator('[data-state="action-success"]')).toHaveText('Đã lưu thay đổi.')
    await page.locator('[data-action="publish"]').click()
    await expect(row).toHaveAttribute('data-status', 'PUBLISHED')
    await page.locator('[data-action="cancel-event"]').click()
    await page.locator('[data-action="confirm-cancel"]').click()
    await expect(row).toHaveAttribute('data-status', 'CANCELLED')
    await expect(page.locator('[data-state="read-only"]')).toBeVisible()
    await expect(page.locator('[data-action="publish"]')).toHaveCount(0)

    const events = await eventAudits(id)
    expect(events.map((e) => e.action)).toEqual([
      'EVENT_CREATED',
      'EVENT_UPDATED',
      'EVENT_PUBLISHED',
      'EVENT_CANCELLED',
    ])
    expect(JSON.stringify(events)).not.toMatch(/Gặp mặt|Cần Thơ|S07 Chapter|@|token|cookie/)
  })

  test('API error with retry; stale action shows the latest state', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    const created = await (
      await page.request.post(LIST(CHAPTER_01), {
        data: { name: 'S07 Stale', starts_at: future(5), ends_at: future(6) },
      })
    ).json()
    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    await page.locator(`[data-event="${created.id}"] [data-action="open"]`).click()
    // Someone else publishes first: the stale publish is refused and the page refreshes.
    await page.request.post(`${EVENT(created.id)}/publish`)
    await page.locator('[data-action="publish"]').click()
    await expect(page.locator('[data-state="action-failed"]')).toContainText('đã thay đổi')
    await expect(page.locator(`[data-event="${created.id}"]`)).toHaveAttribute(
      'data-status',
      'PUBLISHED',
    )
    await page.route('**/api/v1/ops/organizations/*/events', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
            }),
          })
        : route.continue(),
    )
    await page.locator('#event-summary').fill('Sửa')
    await page.locator('[data-action="save"]').click()
    const failed = page.locator('[data-state="events-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).not.toContainText(/500|UNCONTRACTED|request/i)
    await page.unroute('**/api/v1/ops/organizations/*/events')
    await failed.getByRole('button').click()
    await expect(failed).toHaveCount(0)
  })

  test('Idempotency-Key on create and publish (05 §2.3): replay returns the first result', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const headers = { 'Idempotency-Key': `s07-${Date.now()}` }
    const data = { name: 'S07 Idempotent', starts_at: future(7), ends_at: future(8) }
    const a = await page.request.post(LIST(CHAPTER_01), { data, headers })
    const b = await page.request.post(LIST(CHAPTER_01), { data, headers })
    expect([a.status(), b.status()]).toEqual([201, 201])
    const first = await a.json()
    expect((await b.json()).id).toBe(first.id)
    expect(await query(`SELECT 1 FROM events WHERE name = 'S07 Idempotent'`)).toHaveLength(1)
    const pk = { 'Idempotency-Key': `s07-pub-${Date.now()}` }
    const p1 = await page.request.post(`${EVENT(first.id)}/publish`, { headers: pk })
    const p2 = await page.request.post(`${EVENT(first.id)}/publish`, { headers: pk })
    expect([p1.status(), p2.status()]).toEqual([200, 200])
    expect((await eventAudits(first.id)).map((e) => e.action)).toEqual([
      'EVENT_CREATED',
      'EVENT_PUBLISHED',
    ])
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

test.describe('WF03-S07 visual QA (approved WF03 primitives)', () => {
  test('capture + typography; header, table card and form primitives match ADM21 (S08)', async ({
    page,
  }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S07')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S07')!, {
      // Deterministic state: only the seeded events (test-created ones are removed).
      beforeNavigate: async () => {
        const mine = `SELECT id FROM events WHERE name LIKE 'S07 %'`
        await query(`DELETE FROM audit_events WHERE resource_id IN (${mine})`)
        await query(`DELETE FROM events WHERE id IN (${mine})`)
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-event]')).toHaveCount(1)
        await expect(p.locator(`[data-event="${DEMO_EVENT}"]`)).toBeVisible()
        await expect(p.locator('[data-card="create"]')).toBeVisible()
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.typography?.violations).toEqual([])

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const s08 = findScreen(screens, 'WF03-S08')
    const reference = readPng(path.join(REPO_ROOT, s08.viewport_baseline))
    const button = (await page.locator('[data-action="new-event"]').boundingBox())!
    expect([Math.round(button.x), Math.round(button.y), Math.round(button.width)]).toEqual([
      931, 32, 122,
    ])
    const card = (await page.locator('[data-card="events"]').boundingBox())!
    const side = (await page.locator('[data-card="create"]').boundingBox())!
    expect([Math.round(side.x), Math.round(side.y)]).toEqual([1071, 23])
    const cardDy = Math.round(card.y) - 401
    const mask = await textRects(page)
    // ADM21 text in the compared regions (title, button label, eyebrows, column
    // labels, form label and select value): moved with its segment.
    const REF_TEXT: Rect[] = [
      { x: 238, y: 20, width: 440, height: 58 },
      { x: 936, y: 38, width: 112, height: 22 },
      { x: 258, y: 417 + cardDy, width: 780, height: 44 },
      { x: 1086, y: 40, width: 320, height: 48 },
      { x: 1096, y: 96, width: 300, height: 26 },
      { x: 1086, y: 138, width: 320, height: 20 },
    ]
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header', reference: { x: 216, y: 0, width: 850, height: 84 }, dy: 0 },
        {
          name: 'table-card-top',
          reference: { x: 236, y: 395, width: 824, height: 72 },
          dy: cardDy,
        },
        {
          // Eyebrow, first label and first field (a select in ADM21, a text input here:
          // the caret is masked).
          name: 'form-card-top',
          reference: { x: 1064, y: 16, width: 360, height: 118 },
          dy: 0,
        },
      ],
      [...mask, ...REF_TEXT, { x: 1360, y: 100, width: 26, height: 20 }],
      { diffPath: resolveOutputPath('diff', 'WF03-S07.primitives.diff.png') },
    )
    writeJsonReport('WF03-S07.primitives.json', {
      screen_id: 'WF03-S07',
      state: qaConfigFor('WF03-S07')!.state,
      reference_compared: s08.viewport_baseline,
      s07_bitmap: {
        status: viewport.comparison.status,
        classification: 'INTENTIONAL-CONTRACT (DEC-WF03-G2: WF04 collage, not business authority)',
      },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-G2: the S07 bitmap draws WF04 programme / challenge content (landing funnel, qualifying round, campaign mail); none is rendered. The screen uses the ADM21 (S08) primitives, compared here',
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
