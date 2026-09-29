import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF04-T00 — Programme / Challenge DEMO foundation (DEC-WF04-H1..H5,
 * DEC-WF04-T00-D1..D5): demo API, guard and organization scope, spoofing,
 * fixture determinism, the Event boundary, the session store and reset, no
 * database / audit writes, the OpsShell entry and the "Dữ liệu demo" frame.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const API = '/api/v1/demo/programmes'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')

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

/** A completed person with one RoleAssignment row (any code / scope). */
async function person(role: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-t00-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 T00', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  people.push(p!.id)
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [p!.id, role.code, role.scopeType, role.scopeId],
  )
  return email
}

async function snapshot() {
  const [row] = await query<Record<string, string>>(
    `SELECT (SELECT count(*) FROM programmes)::text AS programmes,
            (SELECT max(updated_at)::text FROM programmes) AS programmes_at,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT max(updated_at)::text FROM events) AS events_at,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            (SELECT count(*) FROM role_assignments)::text AS roles`,
  )
  return row
}

const meta = (page: Page) => page.locator('[data-demo-meta]')

test.describe('WF04-T00 demo API and authorization', () => {
  test('1/7/8/9. platform admin: both fixtures, deterministic, canonical, programme-linked events', async ({
    request,
  }) => {
    await login(request, 'ops@example.test')
    const first = await (await request.get(API)).json()
    const second = await (await request.get(API)).json()
    expect(second).toEqual(first)
    expect(
      first.items.map((i: { id: string; type: string; status: string }) => [
        i.id,
        i.type,
        i.status,
      ]),
    ).toEqual([
      [PROGRAMME, 'PROGRAMME', 'PUBLISHED'],
      [CHALLENGE, 'CHALLENGE', 'DRAFT'],
    ])
    for (const item of first.items) {
      expect(item.demo).toBe(true)
      expect(item.organization).toEqual({
        id: CHAPTER_01,
        slug: 'chapter-01',
        name: 'Chapter 01',
        type: 'CHAPTER',
      })
      expect(['PROGRAMME', 'CHALLENGE']).toContain(item.type)
    }
    for (const id of [PROGRAMME, CHALLENGE]) {
      const detail = await (await request.get(`${API}/${id}`)).json()
      expect(detail.programme.id).toBe(id)
      expect(detail.events.length).toBeGreaterThan(0)
      for (const e of detail.events) expect(e.programme_id).toBe(id)
      expect(
        detail.team.every((m: { role_label: string }) => m.role_label === 'PROGRAMME_ORGANIZER'),
      ).toBe(true)
      if (detail.programme.type === 'CHALLENGE') expect(detail.problem_statements.length).toBe(2)
      else expect(detail).not.toHaveProperty('problem_statements')
    }
  })

  test('2. the Chapter 01 leader reads both fixtures (owning organization in scope)', async ({
    request,
  }) => {
    await login(request, 'leader@example.test')
    const list = await (await request.get(API)).json()
    expect(list.items.map((i: { id: string }) => i.id)).toEqual([PROGRAMME, CHALLENGE])
    expect((await request.get(`${API}/${CHALLENGE}`)).status()).toBe(200)
  })

  test('3/4. guest 401 / page → /auth; ordinary member 403 / 404 / page 404', async ({ page }) => {
    expect((await page.request.get(API)).status()).toBe(401)
    expect((await page.request.get(`${API}/${PROGRAMME}`)).status()).toBe(401)
    await page.goto('/demo/programmes')
    await expect(page).toHaveURL('/auth')

    await login(page.request, 'member@example.test')
    expect((await page.request.get(API)).status()).toBe(403)
    expect((await page.request.get(`${API}/${PROGRAMME}`)).status()).toBe(404)
    expect((await page.goto('/demo/programmes'))?.status()).toBe(404)
    await expect(page.locator('[data-shell="not-found"]')).toHaveCount(1)

    await page.context().clearCookies()
    await login(page.request, `wf04-incomplete-${Date.now()}@example.test`)
    await page.goto('/demo/programmes')
    await expect(page).toHaveURL('/onboarding')
  })

  test('5/6. foreign organization and spoofed scope are denied; labels grant nothing', async ({
    page,
  }) => {
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign)
    const spoofed = [
      `${API}?orgId=${CHAPTER_01}`,
      `${API}?organization_id=${CHAPTER_01}&scope=PLATFORM`,
    ]
    for (const url of spoofed)
      expect((await (await page.request.get(url)).json()).items).toEqual([])
    const headers = { 'x-organization-id': CHAPTER_01, 'x-role': 'PLATFORM_ADMIN' }
    expect((await (await page.request.get(API, { headers })).json()).items).toEqual([])
    for (const id of [PROGRAMME, CHALLENGE]) {
      expect((await page.request.get(`${API}/${id}?orgId=${CHAPTER_01}`)).status()).toBe(404)
    }
    expect((await page.goto('/demo/programmes'))?.status()).toBe(200)
    await expect(meta(page)).toHaveText('0 chương trình · 0 challenge')

    for (const scope of [
      { code: 'PROGRAMME_ORGANIZER', scopeType: 'PROGRAMME', scopeId: PROGRAMME },
      { code: 'PROGRAMME_ORGANIZER', scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 },
      { code: 'PROGRAMME_ORGANIZER', scopeType: 'PLATFORM', scopeId: null },
    ]) {
      await page.context().clearCookies()
      await login(page.request, await person(scope))
      expect((await page.request.get(API)).status()).toBe(403)
      expect((await page.request.get(`${API}/${CHALLENGE}`)).status()).toBe(404)
      expect((await page.goto('/demo/programmes'))?.status()).toBe(404)
    }
  })

  test('mutation methods do not exist and cannot change the fixture', async ({ request }) => {
    await login(request, 'ops@example.test')
    const before = await (await request.get(`${API}/${CHALLENGE}`)).json()
    const body = { programme: { name: 'hacked', status: 'PUBLISHED' } }
    for (const url of [API, `${API}/${CHALLENGE}`]) {
      for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        expect((await request[method](url, { data: body })).status(), `${method} ${url}`).toBe(405)
      }
    }
    expect(await (await request.get(`${API}/${CHALLENGE}`)).json()).toEqual(before)
  })

  test('14. responses carry no contact, account, session or token data', async ({ request }) => {
    await login(request, 'ops@example.test')
    for (const url of [API, `${API}/${PROGRAMME}`, `${API}/${CHALLENGE}`]) {
      const text = await (await request.get(url)).text()
      expect(text).not.toMatch(/@|account|session|token|cookie|password|30000000-/i)
    }
  })
})

test.describe('WF04-T00 Event boundary', () => {
  test('10. WF03 standalone events are unchanged: no demo event, all programme_id NULL', async ({
    request,
  }) => {
    await login(request, 'leader@example.test')
    const events = await (
      await request.get(`/api/v1/ops/organizations/${CHAPTER_01}/events`)
    ).json()
    const ids = events.items.map((e: { id: string }) => e.id)
    expect(ids.some((id: string) => id.startsWith('d40'))).toBe(false)
    const [linked] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events WHERE id = ANY($1::uuid[]) AND programme_id IS NOT NULL`,
      [ids],
    )
    expect(linked!.n).toBe(0)
    const [rows] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events WHERE id::text LIKE 'd40%' OR programme_id::text LIKE 'd40%'`,
    )
    expect(rows!.n).toBe(0)
  })
})

test.describe('WF04-T00 session store, reset and the demo frame', () => {
  test('11/12/13. refresh keeps a session draft; reset restores the fixture; no DB / audit write; login kept', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(meta(page)).toHaveText('1 chương trình · 1 challenge')

    const detail = await (await page.request.get(`${API}/${CHALLENGE}`)).json()
    const draftId = 'b1f0a9c2-0000-4000-8000-000000000001'
    detail.programme = { ...detail.programme, id: draftId, name: 'Bản nháp phiên (T00)' }
    const key = `hub.wf04-demo.v1.${createHash('sha256')
      .update(`wf04-demo:${LEADER_ACCOUNT}`)
      .digest('hex')
      .slice(0, 16)}`
    await page.evaluate(
      ([k, value]) => sessionStorage.setItem(k!, value!),
      [key, JSON.stringify({ version: 1, programmes: { [draftId]: detail }, created: [draftId] })],
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(meta(page)).toHaveText('1 chương trình · 2 challenge')

    await page.locator('[data-demo-reset="start"]').click()
    await expect(page.getByRole('group', { name: /Đưa dữ liệu demo về ban đầu/ })).toBeVisible()
    await page.getByRole('button', { name: 'Huỷ' }).click()
    await expect(meta(page)).toHaveText('1 chương trình · 2 challenge')
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(meta(page)).toHaveText('1 chương trình · 1 challenge')
    await expect(page.locator('[data-demo-notice]')).toContainText('Đã đặt lại dữ liệu demo.')
    expect(await page.evaluate((k) => sessionStorage.getItem(k), key)).toBeNull()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(meta(page)).toHaveText('1 chương trình · 1 challenge')

    // The signed-in session, membership and permissions are untouched.
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect((await page.goto('/ops/network'))?.status()).toBe(200)
    expect(await snapshot()).toEqual(before)
  })

  test('a store written by another actor is not read (per-actor key)', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    const detail = await (await page.request.get(`${API}/${CHALLENGE}`)).json()
    detail.programme = { ...detail.programme, id: 'b1f0a9c2-0000-4000-8000-000000000002' }
    const leaderKey = `hub.wf04-demo.v1.${createHash('sha256')
      .update(`wf04-demo:${LEADER_ACCOUNT}`)
      .digest('hex')
      .slice(0, 16)}`
    await page.evaluate(
      ([k, value]) => sessionStorage.setItem(k!, value!),
      [
        leaderKey,
        JSON.stringify({
          version: 1,
          programmes: { [detail.programme.id]: detail },
          created: [detail.programme.id],
        }),
      ],
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(meta(page)).toHaveText('1 chương trình · 1 challenge')
  })

  test('the frame: title, "Dữ liệu demo" notice; only on demo surfaces; unbuilt routes are 404', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chương trình & Challenge')
    const notice = page.locator('[data-demo-notice]')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Dữ liệu demo · Internal Alpha')
    await expect(page.locator('[data-route-placeholder]')).toHaveCount(0)
    for (const other of ['/', '/me', '/ops/network', `/ops/org/${CHAPTER_01}/events`]) {
      await page.goto(other)
      await expect(page.locator('[data-demo-notice]'), other).toHaveCount(0)
    }
    for (const unbuilt of [
      `/demo/programmes/${CHALLENGE}/setup/unknown`,
      `/demo/programmes/${CHALLENGE}/manage`,
      '/demo/unknown',
    ]) {
      expect((await page.goto(unbuilt))?.status(), unbuilt).toBe(404)
      await expect(page.locator('[data-shell="not-found"]'), unbuilt).toHaveCount(1)
    }
  })
})

test.describe('WF04-T00 OpsShell entry', () => {
  test('15. shown to ops actors in every OpsShell context, current on the demo; never for members', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const source of [
      '/ops/network',
      `/ops/org/${CHAPTER_01}`,
      `/ops/org/${CHAPTER_01}/events`,
    ]) {
      await page.goto(source)
      const entry = page.locator('[data-nav="programme-demo"]')
      await expect(entry, source).toHaveAttribute('href', '/demo/programmes')
      await expect(entry, source).toHaveText('Chương trình & Challenge')
      await expect(page.getByText('Demo · Internal Alpha', { exact: true }), source).toBeVisible()
      await expect(entry, source).not.toHaveAttribute('aria-current', 'page')
    }
    await page.locator('[data-nav="programme-demo"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await expect(page.locator('[data-nav="programme-demo"]')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.locator('[data-nav="account-entry"]')).toBeVisible()

    await page.context().clearCookies()
    await login(page.request, 'member@example.test')
    for (const source of ['/', '/me', '/me/settings']) {
      await page.goto(source)
      await expect(page.locator('[data-nav="programme-demo"]'), source).toHaveCount(0)
      // The Programme demo is never linked for members (DEC-WF04-H2). The member-side
      // WF05 Project / Startup demo entry (DEC-WF05-G2) is a different demo.
      await expect(page.locator('a[href^="/demo/programmes"]'), source).toHaveCount(0)
    }
  })

  test('16. WF03 ops routes are unchanged: same nav, S05 stays the unlinked FUTURE route', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}`)
    expect(
      await page
        .locator('[data-nav-key]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-nav-key'))),
    ).toEqual(['network', 'overview', 'members', 'profile', 'events', 'relationships'])
    await expect(page.locator('a[href$="/programmes"]:not([href^="/demo"])')).toHaveCount(0)
    const future = await page.request.get(`/ops/org/${CHAPTER_01}/programmes`)
    expect(future.status()).toBe(200)
    expect(await future.text()).toContain('data-route-placeholder')
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

test.describe('WF04-T00 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900: typography; header band and demo notice match the approved ADM5 primitives', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await settle(page)
    const typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-t00-demo-frame-1440x900.png') })
    const actual = decodePng(await page.screenshot())
    const { screens } = loadManifest()
    const adm5 = findScreen(screens, 'WF03-S05')
    const reference = readPng(path.join(REPO_ROOT, adm5.full_page_baseline!))
    const box = (await page.locator('[data-demo-notice]').boundingBox())!
    const top = Math.round(box.y)
    const left = Math.round(box.x)
    const bottom = Math.round(box.y + box.height)
    // ADM5 notice panel: 250..1405 × 348..421 on the #efefef canvas.
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header-band', reference: { x: 500, y: 4, width: 740, height: 66 }, dy: 0 },
        { name: 'header-rule', reference: { x: 500, y: 72, width: 740, height: 6 }, dy: 0 },
        { name: 'canvas-gap', reference: { x: 300, y: 79, width: 900, height: 16 }, dy: 0 },
        {
          name: 'notice-left-edge',
          reference: { x: 240, y: 352, width: 22, height: 64 },
          dx: left - 250,
          dy: top - 348,
        },
        {
          name: 'notice-top-edge',
          reference: { x: 300, y: 342, width: 800, height: 14 },
          dx: left - 250,
          dy: top - 348,
        },
        {
          name: 'notice-bottom-edge',
          reference: { x: 300, y: 408, width: 800, height: 18 },
          dx: left - 250,
          dy: bottom - 421,
        },
      ],
      await textRects(page),
      { diffPath: resolveOutputPath('diff', 'WF04-T00.primitives.diff.png') },
    )
    writeJsonReport('WF04-T00.primitives.json', {
      screen_id: 'WF04-T00',
      reference_compared: adm5.full_page_baseline,
      approved_wf04_bitmap: null,
      notice_box: box,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1: no approved WF04 reference; the frame is composed from the ADM header band and the ADM5 notice panel. The OpsShell demo entry has no drawn reference (typography only). No WF04 pixel parity is claimed',
        },
      ],
      typography,
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
