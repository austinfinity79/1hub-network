import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { DEMO_PROGRAMMES } from '../../../src/lib/programme-demo/fixtures'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF04-S04 — events of a demo Programme / Challenge (DEC-WF04-S04-D1..D3):
 * only this programme's events, canonical fields and rules, add / edit /
 * remove-draft in the session store, S03 → S04 → (S05 not yet), IDOR, the
 * WF03 Event boundary, no database or audit write, responsive and primitives.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const eventsUrl = (id: string) => `/demo/programmes/${id}/setup/events`

const people: string[] = []
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    people,
  ])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(role: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-s04-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S04', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  people.push(p!.id)
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [p!.id, role.code, role.scopeType, role.scopeId],
  )
  return { email, account: a!.id }
}

const storeKey = (account: string) =>
  `hub.wf04-demo.v1.${createHash('sha256').update(`wf04-demo:${account}`).digest('hex').slice(0, 16)}`

async function stored(page: Page, account = LEADER_ACCOUNT) {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), storeKey(account))
  return raw
    ? (JSON.parse(raw) as {
        programmes: Record<string, { events: Array<Record<string, unknown>> }>
      })
    : null
}

async function snapshot() {
  const [row] = await query<Record<string, string>>(
    `SELECT (SELECT count(*) FROM programmes)::text AS programmes,
            (SELECT max(updated_at)::text FROM programmes) AS programmes_at,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT max(updated_at)::text FROM events) AS events_at,
            (SELECT count(*) FROM events WHERE programme_id IS NOT NULL)::text AS linked_events,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            (SELECT max(updated_at)::text FROM individual_profiles) AS profiles_at,
            (SELECT count(*) FROM community_memberships)::text AS memberships,
            (SELECT max(updated_at)::text FROM organizations) AS organizations_at`,
  )
  return row
}

const rows = (page: Page) => page.locator('[data-event-id]')
const names = (page: Page) => rows(page).locator('p:first-child').allTextContents()
const row = (page: Page, name: string) =>
  rows(page).filter({ has: page.getByText(name, { exact: true }) })

async function open(page: Page, id: string) {
  await page.goto(eventsUrl(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

async function fillEvent(
  page: Page,
  v: { name?: string; start?: string; end?: string; location?: string; summary?: string },
) {
  if (v.name !== undefined) await page.getByLabel('Tên sự kiện').fill(v.name)
  if (v.start !== undefined) await page.getByLabel('Bắt đầu').fill(v.start)
  if (v.end !== undefined) await page.getByLabel('Kết thúc').fill(v.end)
  if (v.location !== undefined) await page.getByLabel('Địa điểm').fill(v.location)
  if (v.summary !== undefined) await page.getByLabel('Tóm tắt').fill(v.summary)
}

test.describe('WF04-S04 events', () => {
  test('1-4/13-16. fixtures of this programme only, S07 order, frame; S03 → S04 → back; next safe', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    // The server render is the loading state (the session is read after hydration).
    expect(await (await page.request.get(eventsUrl(PROGRAMME))).text()).toContain(
      'data-state="setup-loading"',
    )
    await page.goto(`/demo/programmes/${PROGRAMME}/setup/journey`, { waitUntil: 'networkidle' })
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(eventsUrl(PROGRAMME))
    await expect(page.locator('[data-screen="WF04-S04"]')).toBeVisible()
    await expect(page.locator('[data-setup-stepper] [aria-current="step"]')).toContainText(
      'Sự kiện',
    )
    expect(await names(page)).toEqual(['Ngày trình diễn (demo)', 'Buổi định hướng (demo)'])
    await expect(row(page, 'Buổi định hướng (demo)')).toContainText(
      '03/10/2026 · 09:00–11:00 · Trực tuyến',
    )
    await expect(row(page, 'Buổi định hướng (demo)').locator('[data-status]')).toHaveText(
      'Đang công khai',
    )
    // Published events: edit only (no removal — WF03 would cancel them).
    await expect(rows(page).locator('[data-action="edit"]')).toHaveCount(2)
    await expect(rows(page).locator('[data-action="remove"]')).toHaveCount(0)
    // Standalone WF03 events of the same organization never appear.
    const standalone = await query<{ name: string }>(
      `SELECT name FROM events WHERE organization_id = $1 AND programme_id IS NULL`,
      [CHAPTER_01],
    )
    expect(standalone.length).toBeGreaterThan(0)
    const text = await page.locator('main').innerText()
    for (const { name } of standalone) expect(text).not.toContain(name)
    // Next waits for S05; back returns to the journey.
    const next = page.locator('[data-setup-next]')
    await expect(next).toBeDisabled()
    await expect(next).toHaveAttribute('title', 'Chưa có trong phiên bản này')
    await expect(page.locator('a[href*="/setup/registration"]')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(2)
    await page.locator('[data-nav="events-back"]').click()
    await expect(page).toHaveURL(`/demo/programmes/${PROGRAMME}/setup/journey`)

    await open(page, CHALLENGE)
    expect(await names(page)).toEqual(['Giới thiệu bài toán (demo)'])
    await expect(row(page, 'Giới thiệu bài toán (demo)').locator('[data-status]')).toHaveText(
      'Bản nháp',
    )
    // S03 owns the problem statements; S04 does not repeat them.
    await expect(page.locator('[data-journey-problems]')).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText('Bài toán mẫu')
  })

  test('5-12. add, edit, remove a draft, validation, empty; refresh and reset; nothing written', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    const wf03Before = await (
      await page.request.get(`/api/v1/ops/organizations/${CHAPTER_01}/events`)
    ).json()
    await open(page, PROGRAMME)

    // Add: a hidden programme_id in the form is ignored — the link comes from the route.
    await page.locator('[data-action="add-event"]').click()
    await page.evaluate((spoof) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'programme_id'
      input.value = spoof
      document.querySelector('[data-event-editor]')!.append(input)
    }, CHALLENGE)
    await fillEvent(page, {
      name: 'Buổi kết nối (demo)',
      start: '2026-11-20T09:00',
      end: '2026-11-20T08:00',
    })
    await page.locator('[data-action="save-event"]').click()
    await expect(page.locator('[data-error="dates"]')).toHaveText(
      'Thời điểm kết thúc không được trước thời điểm bắt đầu.',
    )
    expect(await stored(page)).toBeNull()
    await fillEvent(page, { end: '2026-11-20T11:30', location: 'Hà Nội' })
    await expect(page.locator('[data-error="dates"]')).toHaveCount(0)
    await page.locator('[data-action="save-event"]').click()
    expect(await names(page)).toEqual([
      'Ngày trình diễn (demo)',
      'Buổi kết nối (demo)',
      'Buổi định hướng (demo)',
    ])
    await expect(row(page, 'Buổi kết nối (demo)')).toContainText(
      '20/11/2026 · 09:00–11:30 · Hà Nội',
    )
    await expect(row(page, 'Buổi kết nối (demo)').locator('[data-status]')).toHaveText('Bản nháp')
    const created = (await stored(page))!.programmes[PROGRAMME]!.events.find(
      (e) => e.name === 'Buổi kết nối (demo)',
    )!
    expect(created).toMatchObject({
      programme_id: PROGRAMME,
      organization_id: CHAPTER_01,
      status: 'DRAFT',
      starts_at: '2026-11-20T02:00:00.000Z',
      ends_at: '2026-11-20T04:30:00.000Z',
    })

    // Edit a published fixture event: fields change, state and link stay.
    await row(page, 'Buổi định hướng (demo)').locator('[data-action="edit"]').click()
    await fillEvent(page, { name: 'Buổi định hướng mở rộng (demo)' })
    await page.locator('[data-action="save-event"]').click()
    await expect(row(page, 'Buổi định hướng mở rộng (demo)').locator('[data-status]')).toHaveText(
      'Đang công khai',
    )
    // Remove the new draft (confirm; cancel first).
    await row(page, 'Buổi kết nối (demo)').locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="no"]').click()
    await expect(rows(page)).toHaveCount(3)
    await row(page, 'Buổi kết nối (demo)').locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="yes"]').click()
    await expect(rows(page)).toHaveCount(2)

    // Refresh keeps the edits.
    await page.reload({ waitUntil: 'networkidle' })
    expect(await names(page)).toEqual(['Ngày trình diễn (demo)', 'Buổi định hướng mở rộng (demo)'])

    // Empty: the Challenge's only (draft) event removed.
    await open(page, CHALLENGE)
    await rows(page).first().locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="yes"]').click()
    await expect(page.locator('[data-state="events-empty"]')).toHaveText('Chưa có sự kiện nào.')

    // Reset restores the fixture events of both.
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    expect(await names(page)).toEqual(['Giới thiệu bài toán (demo)'])
    await open(page, PROGRAMME)
    expect(await names(page)).toEqual(['Ngày trình diễn (demo)', 'Buổi định hướng (demo)'])
    expect(DEMO_PROGRAMMES[0]!.events.map((e) => e.name)).toEqual([
      'Buổi định hướng (demo)',
      'Ngày trình diễn (demo)',
    ])

    // WF03 runtime unchanged; no demo event reached it or the database.
    const wf03After = await (
      await page.request.get(`/api/v1/ops/organizations/${CHAPTER_01}/events`)
    ).json()
    expect(wf03After).toEqual(wf03Before)
    for (const e of wf03After.items as Array<{ id: string; name: string }>) {
      expect(e.id.startsWith('d40')).toBe(false)
      expect(['Buổi kết nối (demo)', 'Buổi định hướng mở rộng (demo)']).not.toContain(e.name)
    }
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect(await snapshot()).toEqual(before)
  })

  test('only this programme’s events render or change, even with a tampered session copy', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    const copy = {
      ...structuredClone(DEMO_PROGRAMMES[0]!),
      organization: { id: CHAPTER_01, slug: 'chapter-01', name: 'Chapter 01', type: 'CHAPTER' },
      demo: true,
    }
    copy.events.push({
      ...structuredClone(DEMO_PROGRAMMES[1]!.events[0]!),
      name: 'Sự kiện lạc chương trình',
    })
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(LEADER_ACCOUNT),
        JSON.stringify({ version: 1, programmes: { [PROGRAMME]: copy }, created: [] }),
      ],
    )
    await page.reload({ waitUntil: 'networkidle' })
    expect(await names(page)).toEqual(['Ngày trình diễn (demo)', 'Buổi định hướng (demo)'])
    await expect(page.locator('main')).not.toContainText('Sự kiện lạc chương trình')
  })

  test('save error: a refused write shows "Thử lại"; retry stores it once and closes the editor', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-action="add-event"]').click()
    await fillEvent(page, { name: 'Lưu lỗi (demo)' })
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await page.locator('[data-action="save-event"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toContainText(
      'Chưa lưu được thay đổi. Vui lòng thử lại.',
    )
    expect(await page.locator('main').innerText()).not.toMatch(/quota|DOMException|sessionStorage/i)
    await expect(rows(page)).toHaveCount(1)
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toHaveCount(0)
    await expect(page.locator('[data-event-editor]')).toHaveCount(0)
    expect(await names(page)).toEqual(['Lưu lỗi (demo)', 'Giới thiệu bài toán (demo)'])
  })

  test('S02 → S03 → S04: a new draft has no events yet and can add one', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Challenge' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Challenge có sự kiện')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(/\/demo\/programmes\/[0-9a-f-]{36}\/setup\/events$/)
    await expect(page.locator('[data-state="events-empty"]')).toBeVisible()
    await page.locator('[data-action="add-event"]').click()
    await fillEvent(page, { name: 'Sự kiện đầu tiên' })
    await page.locator('[data-action="save-event"]').click()
    await expect(row(page, 'Sự kiện đầu tiên')).toContainText('Chưa có thời gian')
    await page.reload({ waitUntil: 'networkidle' })
    expect(await names(page)).toEqual(['Sự kiện đầu tiên'])
  })
})

test.describe('WF04-S04 authorization and IDOR', () => {
  test('in scope works; malformed / unknown fixture 404; random or WF03 event ids reveal nothing', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    for (const id of [PROGRAMME, CHALLENGE]) {
      expect((await page.goto(`${eventsUrl(id)}?orgId=${CHAPTER_02}`))?.status()).toBe(200)
      await expect(rows(page).first()).toBeVisible()
    }
    for (const id of ['abc', 'd4000000-0000-0000-0000-000000000099']) {
      expect((await page.goto(eventsUrl(id)))?.status(), id).toBe(404)
      await expect(page.locator('[data-shell="not-found"]'), id).toHaveCount(1)
    }
    const [standalone] = await query<{ id: string }>(
      `SELECT id::text FROM events WHERE programme_id IS NULL ORDER BY created_at LIMIT 1`,
    )
    for (const id of ['7c9e6679-7425-40de-944b-e07fc1f90ae7', standalone!.id]) {
      expect((await page.goto(eventsUrl(id)))?.status(), id).toBe(200)
      await expect(page.locator('[data-state="setup-missing"]'), id).toBeVisible()
      await expect(rows(page)).toHaveCount(0)
    }
  })

  test('foreign organization, member, guest, label and header spoofing are refused', async ({
    page,
  }) => {
    await page.goto(eventsUrl(PROGRAMME))
    await expect(page).toHaveURL('/auth')
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    for (const id of [PROGRAMME, CHALLENGE])
      expect((await page.goto(`${eventsUrl(id)}?orgId=${CHAPTER_01}`))?.status(), id).toBe(404)
    for (const who of [
      'member@example.test',
      (await person({ code: 'PROGRAMME_ORGANIZER', scopeType: 'PROGRAMME', scopeId: PROGRAMME }))
        .email,
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      await page.setExtraHTTPHeaders({
        'x-role': 'PLATFORM_ADMIN',
        'x-organization-id': CHAPTER_01,
      })
      expect((await page.goto(eventsUrl(PROGRAMME)))?.status(), who).toBe(404)
    }
  })

  test('no contact or session data in the page or the store', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await page.locator('[data-action="add-event"]').click()
    await fillEvent(page, { name: 'Kiểm tra rò rỉ' })
    await page.locator('[data-action="save-event"]').click()
    const html = await (await page.request.get(eventsUrl(PROGRAMME))).text()
    expect(html).not.toMatch(/@example\.test|30000000-/)
    expect(JSON.stringify(await stored(page))).not.toMatch(/@|token|cookie|30000000-/)
  })
})

test.describe('WF04-S04 responsive basics', () => {
  test('768 / 390: no page overflow; list, back, next, edit and time fields usable', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page, PROGRAMME)
      await rows(page).first().locator('[data-action="edit"]').click()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      for (const locator of [
        page.locator('[data-nav="events-back"]'),
        page.locator('[data-setup-next]'),
        page.getByLabel('Bắt đầu'),
        page.getByLabel('Kết thúc'),
        page.locator('[data-action="save-event"]'),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s04-${width}.png`), fullPage: true })
    }
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

test.describe('WF04-S04 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 Programme populated / empty and Challenge: typography; header, card, pill primitives', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const adm5 = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const results = []
    let checked = 0
    for (const [name, id] of [
      ['programme', PROGRAMME],
      ['challenge', CHALLENGE],
    ] as const) {
      await open(page, id)
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s04-${name}-1440x900.png`) })
      const actual = decodePng(await page.screenshot())
      const card = (await page.locator('[data-programme-events]').boundingBox())!
      const first = (await rows(page).first().boundingBox())!
      const pill = (await rows(page).first().locator('[data-status]').boundingBox())!
      const cx = Math.round(card.x) - 248
      const cy = Math.round(card.y) - 99
      const px = Math.round(pill.x)
      const py = Math.round(pill.y)
      // ADM5 pill references: open-state 1311 × 149, neutral 1311 × 198 (corners on half pixels).
      const [refY, kind] = name === 'programme' ? [149, 'open'] : [198, 'neutral']
      const raster: Rect[] = [
        { x: px, y: py, width: 9, height: 7 },
        { x: px, y: py + 14, width: 9, height: 8 },
      ]
      results.push(
        ...compareSegments(
          adm5,
          actual,
          [
            {
              name: `${name}-header-band`,
              reference: { x: 500, y: 4, width: 600, height: 66 },
              dy: 0,
            },
            {
              name: `${name}-header-rule`,
              reference: { x: 500, y: 72, width: 600, height: 6 },
              dy: 0,
            },
            {
              name: `${name}-card-top`,
              reference: { x: 300, y: 95, width: 800, height: 8 },
              dx: cx,
              dy: cy,
            },
            {
              name: `${name}-card-left`,
              reference: { x: 244, y: 140, width: 10, height: 40 },
              dx: cx,
              dy: Math.round(first.y) + 4 - 140,
            },
            {
              name: `${name}-pill-${kind}-cap`,
              reference: { x: 1308, y: refY - 3, width: 12, height: 28 },
              dx: px - 1311,
              dy: py - refY,
            },
          ],
          [...(await textRects(page)), ...raster],
          { diffPath: resolveOutputPath('diff', `WF04-S04.${name}.diff.png`) },
        ),
      )
    }
    // Programme empty: a new draft's events step.
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Chương trình' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Chương trình chưa có sự kiện')
    await page.locator('[data-demo-save]').click()
    await page.locator('[data-setup-next]').click()
    await expect(page.locator('[data-state="events-empty"]')).toBeVisible()
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s04-programme-empty-1440x900.png') })

    writeJsonReport('WF04-S04.primitives.json', {
      screen_id: 'WF04-S04',
      references: ['WF03-S05 ADM5 full (header, table card, pills)'],
      approved_wf04_bitmap: null,
      typography_checked: checked,
      raster: 'ADM5 pill corners on half pixels (masked; straight edge and fill compared)',
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S04-D1: S03 card chrome with the S07 event wording and ADM5 pills; no WF04 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
