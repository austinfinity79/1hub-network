import { expect, test, type APIRequestContext } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF03-S07 — standalone Event management (/ops/org/:orgId/events).
 * API 05 §8.6; DEC-WF03-G2/G10/G14; DEC-WF03-S07-EVENT-LIFECYCLE; DEC-WF03-S07-D1..D4.
 * The S07 bitmap is a WF04 collage (not authority); the page is the corrected
 * L23 CHP4 subset (TASK 22.4, DEC-L3-D3), which pixel QA compares against.
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
    // DEC-L3-D3: the panel opens on demand, from "Tạo sự kiện".
    await expect(page.locator('[data-card="create"]')).toHaveCount(0)
    await page.locator('[data-action="new-event"]').click()
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

test.describe('WF03-S07 status chips and the create panel (DEC-L3-D3)', () => {
  test('dashboard "Tạo sự kiện" opens the panel; chips group the list by status and time', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const draft = await (
      await page.request.post(LIST(CHAPTER_01), {
        data: { name: 'S07 Chip Draft', starts_at: future(9), ends_at: future(10) },
      })
    ).json()
    await page.goto(`/ops/org/${CHAPTER_01}`, { waitUntil: 'networkidle' })
    await page.locator('[data-nav="dashboard-create-event"]').click()
    await expect(page).toHaveURL(`${PAGE(CHAPTER_01)}?create=1`)
    await expect(page.locator('[data-card="create"]')).toBeVisible()
    await page.locator('[data-action="close-detail"]').click()
    await expect(page.locator('[data-card="create"]')).toHaveCount(0)

    const rowsOf = page.locator('[data-event]')
    const total = await rowsOf.count()
    await page.locator('[data-filter="draft"]').click()
    await expect(page.locator('[data-filter="draft"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`[data-event="${draft.id}"]`)).toBeVisible()
    for (const status of await rowsOf.evaluateAll((els) => els.map((e) => e.dataset.status)))
      expect(status).toBe('DRAFT')
    await page.locator('[data-filter="upcoming"]').click()
    await expect(page.locator(`[data-event="${DEMO_EVENT}"]`)).toBeVisible()
    await expect(page.locator(`[data-event="${draft.id}"]`)).toHaveCount(0)
    for (const status of await rowsOf.evaluateAll((els) => els.map((e) => e.dataset.status)))
      expect(['PUBLISHED', 'LIVE']).toContain(status)
    // Pressing the active chip again shows every event.
    await page.locator('[data-filter="upcoming"]').click()
    await expect(rowsOf).toHaveCount(total)
    // A member without event:manage never reaches the page or the panel.
    await page.context().clearCookies()
    await login(page.request, 'member@example.test')
    expect((await page.goto(`${PAGE(CHAPTER_01)}?create=1`))?.status()).toBe(404)
  })
})

test.describe('WF03-S07 pixel QA (corrected L23 CHP4 subset)', () => {
  const REFERENCE = 'design-reference/final/revision/L3/L23__chapter-events__SOURCE.png'
  /** L23 is drawn without a sidebar: the left column moves by the 216px OpsShell. */
  const LEFT = 216

  test('1440×900: header, chips, create button, column labels, first row', async ({ page }) => {
    // Deterministic state: only the seeded events (test-created ones are removed).
    const mine = `SELECT id FROM events WHERE name LIKE 'S07 %'`
    await query(`DELETE FROM audit_events WHERE resource_id IN (${mine})`)
    await query(`DELETE FROM events WHERE id IN (${mine})`)
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01), { waitUntil: 'networkidle' })
    await expect(page.locator(`[data-event="${DEMO_EVENT}"]`)).toBeVisible()
    await expect(page.locator('[data-event]').first()).toHaveAttribute('data-event', DEMO_EVENT)
    const x = async (selector: string) =>
      Math.round((await page.locator(selector).first().boundingBox())!.x)
    await auditRevision(page, {
      name: 'WF03-S07.L23',
      reference: REFERENCE,
      segments: [
        { name: 'title', reference: { x: 40, y: 12, width: 260, height: 36 }, dx: LEFT, dy: 0 },
        {
          name: 'header-rule',
          reference: { x: 320, y: 66, width: 800, height: 30 },
          dx: LEFT,
          dy: 0,
        },
        {
          name: 'chip-ended',
          reference: { x: 163, y: 114, width: 120, height: 38 },
          dx: (await x('[data-filter="ended"]')) - 167,
          dy: 0,
        },
        {
          name: 'chip-draft',
          reference: { x: 284, y: 114, width: 106, height: 38 },
          dx: (await x('[data-filter="draft"]')) - 288,
          dy: 0,
        },
        { name: 'create', reference: { x: 1262, y: 106, width: 136, height: 54 }, dx: 0, dy: 0 },
        {
          name: 'label-event',
          reference: { x: 60, y: 170, width: 80, height: 28 },
          dx: LEFT,
          dy: 0,
        },
        {
          name: 'label-time',
          reference: { x: 680, y: 170, width: 90, height: 28 },
          dx: (await x('[data-card="events"] [role="columnheader"]:nth-child(2)')) - 690,
          dy: 0,
        },
        {
          name: 'row-1-left',
          reference: { x: 44, y: 205, width: 26, height: 88 },
          dx: LEFT,
          dy: 0,
        },
        {
          name: 'row-1-manage',
          reference: { x: 1240, y: 220, width: 100, height: 58 },
          dx: 0,
          dy: 0,
        },
        {
          name: 'row-1-right',
          reference: { x: 1340, y: 205, width: 58, height: 88 },
          dx: 0,
          dy: 0,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SHELL',
          reason: 'HD-11 / DEC-L3-D3: OpsShell stays; L23 is drawn without a sidebar',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'DEC-L3-D3 (HD-09): no type, registration or owner columns, no owner warning, no rule notes and no actor line in the header (no P0 source)',
        },
        {
          class: 'INTENTIONAL-STATE',
          reason:
            'L23 draws "Sắp diễn ra" pressed while the table lists every group; the page opens with no chip pressed and lists every event',
        },
        {
          class: 'INTENTIONAL-DATA',
          reason:
            'rows, counts and the place column come from the seeded events; times keep the S07 format (date, year, start–end)',
        },
        { class: 'INTENTIONAL-SCOPE', reason: 'HD-11: no floating "Góp ý" button' },
      ],
    })
  })
})
