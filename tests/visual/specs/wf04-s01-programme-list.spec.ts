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
 * WF04-S01 — Programme / Challenge list (DEC-WF04-H1/H2, DEC-WF04-S01-D1..D3):
 * rows from `GET /api/v1/demo/programmes` + the session store, states,
 * scope, spoofing, no writes, disabled create, non-navigable rows, responsive
 * basics and the ADM5 primitives.
 */

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
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text()))
      consoleErrors.push(m.text())
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

async function foreignLeader() {
  const email = `wf04-s01-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S01', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  people.push(p!.id)
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $2, 'ACTIVE')`,
    [p!.id, CHAPTER_02],
  )
  return { email, account: a!.id }
}

const storeKey = (account: string) =>
  `hub.wf04-demo.v1.${createHash('sha256').update(`wf04-demo:${account}`).digest('hex').slice(0, 16)}`

async function snapshot() {
  const [row] = await query<Record<string, string>>(
    `SELECT (SELECT count(*) FROM programmes)::text AS programmes,
            (SELECT max(updated_at)::text FROM programmes) AS programmes_at,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics`,
  )
  return row
}

const rows = (page: Page) => page.locator('[data-programme-row]')
const meta = (page: Page) => page.locator('[data-demo-meta]')

async function open(page: Page) {
  await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="list-loading"]')).toHaveCount(0)
}

async function cells(page: Page) {
  return rows(page).evaluateAll((els) =>
    els.map((el) => [...el.querySelectorAll('[role="cell"]')].map((c) => c.textContent)),
  )
}

test.describe('WF04-S01 list content', () => {
  test('1-6/12. both fixtures, canonical labels, status, owner, dates, fixed order, no duplicates', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    await open(page)
    await expect(page.locator('[data-screen="WF04-S01"]')).toHaveCount(1)
    await expect(rows(page)).toHaveCount(2)
    expect(
      await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-programme-row'))),
    ).toEqual([PROGRAMME, CHALLENGE])
    expect(await cells(page)).toEqual([
      [
        'Chương trình ươm tạo (demo)',
        'Chapter 01',
        'Chương trình',
        '01/09/2026 – 15/12/2026',
        '—',
        'Đang công khai',
      ],
      [
        'Thử thách đổi mới (demo)',
        'Chapter 01',
        'Challenge',
        '01/11/2026 – 31/01/2027',
        '2',
        'Bản nháp',
      ],
    ])
    await expect(rows(page).first().locator('[data-status]')).toHaveAttribute(
      'data-status',
      'PUBLISHED',
    )
    await expect(rows(page).nth(1).locator('[data-status]')).toHaveAttribute('data-status', 'DRAFT')
    expect(await page.locator('[role="columnheader"]').allTextContents()).toEqual([
      'Tên',
      'Đơn vị chủ trì',
      'Loại',
      'Thời gian',
      'Bài toán',
      'Trạng thái',
    ])
    await expect(meta(page)).toHaveText('1 chương trình · 1 challenge')
    // One demo indicator (the T00 frame), no competing banner.
    await expect(page.locator('[data-demo-notice]')).toHaveCount(1)
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(
      /fixture|DTO|sessionStorage|mock|\bAPI\b|CLOSED|ARCHIVED|Đã đóng|Lưu trữ/i,
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(2)
  })

  test('rows do not navigate and "Tạo mới" is disabled with its reason (S02 / S08 not built)', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page)
    await expect(page.locator('[data-programme-table] a')).toHaveCount(0)
    await expect(page.locator('a[href^="/demo/programmes/"]')).toHaveCount(0)
    const create = page.locator('[data-demo-create]')
    await expect(create).toBeDisabled()
    await expect(create).toHaveAttribute('aria-disabled', 'true')
    await expect(create).toHaveAttribute('title', 'Chưa có trong phiên bản này')
    await expect(create).toHaveAccessibleName('Tạo mới — Chưa có trong phiên bản này')
    await rows(page).first().click()
    await expect(page).toHaveURL('/demo/programmes')
    // OpsShell: the demo entry is current; WF03 nav unchanged; no WF03-S05 link.
    await expect(page.locator('[data-nav="programme-demo"]')).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      await page
        .locator('[data-nav-key]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-nav-key'))),
    ).toEqual(['network'])
    await expect(page.locator('a[href^="/ops/org/"][href$="/programmes"]')).toHaveCount(0)
  })
})

test.describe('WF04-S01 states', () => {
  test('loading, then populated', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    let release!: () => void
    const gate = new Promise<void>((done) => (release = done))
    await page.route(`**${API}`, async (route) => {
      await gate
      await route.continue()
    })
    await page.goto('/demo/programmes')
    await expect(page.locator('[data-state="list-loading"]')).toBeVisible()
    await expect(page.locator('[data-programme-table]')).toHaveAttribute('aria-busy', 'true')
    release()
    await expect(rows(page)).toHaveCount(2)
    await expect(page.locator('[data-programme-table]')).toHaveAttribute('aria-busy', 'false')
  })

  test('error: no raw payload, only a retry that recovers', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    let calls = 0
    await page.route(`**${API}`, async (route) => {
      calls += 1
      if (calls === 1)
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'UNCONTRACTED_INTERNAL', message: 'boom', request_id: 'req-x' },
          }),
        })
      return route.continue()
    })
    await page.goto('/demo/programmes')
    const failed = page.locator('[data-state="list-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).toHaveAttribute('role', 'alert')
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/UNCONTRACTED|boom|req-x|500/)
    await expect(failed.getByRole('button')).toHaveText('Thử lại')
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(rows(page)).toHaveCount(2)
    expect(calls).toBe(2)
  })

  test('empty: a leader with no in-scope demo sees the scoped empty state', async ({ page }) => {
    await login(page.request, (await foreignLeader()).email)
    await open(page)
    await expect(rows(page)).toHaveCount(0)
    await expect(page.locator('[data-state="list-empty"]')).toHaveText(
      'Chưa có chương trình hoặc challenge nào trong phạm vi tổ chức của bạn.',
    )
    await expect(meta(page)).toHaveText('0 chương trình · 0 challenge')
  })

  test('9-11. session changes survive refresh, never duplicate; reset restores the fixture; nothing written', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await open(page)
    const detail = await (await page.request.get(`${API}/${CHALLENGE}`)).json()
    const renamed = structuredClone(detail)
    renamed.programme.name = 'Thử thách đã sửa trong phiên'
    const draft = structuredClone(detail)
    const draftId = 'b1f0a9c2-0000-4000-8000-000000000051'
    draft.programme = { ...draft.programme, id: draftId, name: 'Bản nháp trong phiên' }
    const state = {
      version: 1,
      programmes: { [CHALLENGE]: renamed, [draftId]: draft },
      created: [draftId, CHALLENGE],
    }
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [storeKey(LEADER_ACCOUNT), JSON.stringify(state)],
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(3)
    expect((await cells(page)).map((c) => c[0])).toEqual([
      'Bản nháp trong phiên',
      'Chương trình ươm tạo (demo)',
      'Thử thách đã sửa trong phiên',
    ])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(3)

    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(rows(page)).toHaveCount(2)
    expect((await cells(page)).map((c) => c[0])).toEqual([
      'Chương trình ươm tạo (demo)',
      'Thử thách đổi mới (demo)',
    ])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(2)
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect((await (await page.request.get(API)).json()).items).toHaveLength(2)
    expect(await snapshot()).toEqual(before)
  })
})

test.describe('WF04-S01 security', () => {
  test('1/2/8/9. admin and in-scope leader succeed; no PII, token, cookie or session data', async ({
    page,
  }) => {
    for (const email of ['ops@example.test', 'leader@example.test']) {
      await page.context().clearCookies()
      await login(page.request, email)
      const res = await page.request.get(API)
      expect(res.status()).toBe(200)
      const text = await res.text()
      expect(JSON.parse(text).items).toHaveLength(2)
      expect(text).not.toMatch(/@|account|session|token|cookie|password|30000000-/i)
      await open(page)
      await expect(rows(page)).toHaveCount(2)
    }
  })

  test('3/4/5/6/7. foreign scope hidden; member and guest denied; x-role / orgId / client state grant nothing', async ({
    page,
  }) => {
    const spoof = {
      headers: {
        'x-role': 'PLATFORM_ADMIN',
        'x-organization-id': '10000000-0000-0000-0000-000000000101',
      },
    }
    const url = `${API}?orgId=10000000-0000-0000-0000-000000000101&role=PLATFORM_ADMIN`

    expect((await page.request.get(url, spoof)).status()).toBe(401)
    await page.goto('/demo/programmes')
    await expect(page).toHaveURL('/auth')

    await login(page.request, 'member@example.test')
    expect((await page.request.get(url, spoof)).status()).toBe(403)
    expect((await page.goto('/demo/programmes'))?.status()).toBe(404)

    await page.context().clearCookies()
    const foreign = await foreignLeader()
    await login(page.request, foreign.email)
    expect((await (await page.request.get(url, spoof)).json()).items).toEqual([])
    // Client state cannot reveal an out-of-scope programme: a stored copy of a
    // Chapter 01 fixture, even marked as a session draft, is not shown.
    await open(page)
    const copy = {
      ...structuredClone(DEMO_PROGRAMMES[1]!),
      organization: {
        id: '10000000-0000-0000-0000-000000000101',
        slug: 'chapter-01',
        name: 'Chapter 01',
        type: 'CHAPTER',
      },
      demo: true,
    }
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(foreign.account),
        JSON.stringify({ version: 1, programmes: { [CHALLENGE]: copy }, created: [CHALLENGE] }),
      ],
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(0)
    await expect(page.locator('[data-state="list-empty"]')).toBeVisible()
  })

  test('10/11. loading the list writes no programme, event, audit or analytics row', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'ops@example.test')
    await open(page)
    await page.reload({ waitUntil: 'networkidle' })
    await login(page.request, 'leader@example.test')
    await open(page)
    expect(await snapshot()).toEqual(before)
  })
})

test.describe('WF04-S01 responsive basics', () => {
  test('768 / 390: no page overflow; notice, reset and the table stay reachable', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      await expect(page.locator('[data-demo-notice]')).toBeVisible()
      await page.locator('[data-demo-reset="start"]').scrollIntoViewIfNeeded()
      await expect(page.locator('[data-demo-reset="start"]')).toBeInViewport()
      await expect(rows(page)).toHaveCount(2)
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s01-${width}.png`), fullPage: true })
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

test.describe('WF04-S01 visual QA (ADM5 primitives; no WF04 bitmap)', () => {
  test('1440×900: typography; table card, head, row rule and pills match ADM5', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page)
    await settle(page)
    const typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s01-1440x900.png') })
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s01-full.png'), fullPage: true })
    const actual = decodePng(await page.screenshot())
    const reference = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const table = (await page.locator('[data-programme-table]').boundingBox())!
    const pills = page.locator('[data-programme-row] [data-status]')
    const accent = (await pills.nth(0).boundingBox())!
    const neutral = (await pills.nth(1).boundingBox())!
    const tx = Math.round(table.x) - 248
    const ty = Math.round(table.y) - 99
    const tBottom = Math.round(table.y + table.height) - 330
    // RASTER-NOISE: the ADM5 pills sit on half pixels, so their curved corners are
    // anti-aliased across two pixels while the runtime draws a crisp 1px border.
    // The curves are masked; the straight edge and the fill are still compared.
    const ax = Math.round(accent.x)
    const ay = Math.round(accent.y)
    const nx = Math.round(neutral.x)
    const ny = Math.round(neutral.y)
    // The status pill is fully inside the table card (never clipped).
    expect(accent.x + accent.width).toBeLessThanOrEqual(table.x + table.width - 8)
    const raster: Rect[] = [
      { x: ax, y: ay, width: 9, height: 7 },
      { x: ax, y: ay + 14, width: 9, height: 8 },
      { x: nx, y: ny, width: 9, height: 7 },
      { x: nx, y: ny + 14, width: 9, height: 8 },
    ]
    // ADM5 (full baseline): table 248..1407 × 99..329, head 100..134 + rule 135, first
    // row rule 184; open-state pill 1311 × 149, neutral pill 1311 × 198.
    const results = compareSegments(
      reference,
      actual,
      [
        {
          name: 'table-top-edge',
          reference: { x: 300, y: 95, width: 800, height: 8 },
          dx: tx,
          dy: ty,
        },
        {
          name: 'table-left-edge',
          reference: { x: 244, y: 140, width: 10, height: 40 },
          dx: tx,
          dy: ty,
        },
        {
          name: 'head-fill',
          reference: { x: 450, y: 100, width: 130, height: 34 },
          dx: tx,
          dy: ty,
        },
        { name: 'head-rule', reference: { x: 450, y: 133, width: 130, height: 5 }, dx: tx, dy: ty },
        { name: 'row-fill', reference: { x: 450, y: 137, width: 130, height: 45 }, dx: tx, dy: ty },
        { name: 'row-rule', reference: { x: 450, y: 182, width: 130, height: 5 }, dx: tx, dy: ty },
        {
          name: 'table-bottom-edge',
          reference: { x: 300, y: 326, width: 800, height: 8 },
          dx: tx,
          dy: tBottom,
        },
        {
          name: 'pill-open-cap',
          reference: { x: 1308, y: 146, width: 12, height: 28 },
          dx: ax - 1311,
          dy: ay - 149,
        },
        {
          name: 'pill-neutral-cap',
          reference: { x: 1308, y: 195, width: 12, height: 28 },
          dx: nx - 1311,
          dy: ny - 198,
        },
      ],
      [...(await textRects(page)), ...raster],
      { diffPath: resolveOutputPath('diff', 'WF04-S01.primitives.diff.png') },
    )
    writeJsonReport('WF04-S01.primitives.json', {
      screen_id: 'WF04-S01',
      reference_compared: 'WF03-S05 (ADM5) full baseline',
      approved_wf04_bitmap: null,
      boxes: { table, accent, neutral },
      raster_masks: {
        class: 'RASTER-NOISE',
        rects: raster,
        reason: 'ADM5 pill corners on half pixels',
      },
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S01-D3: composed from ADM5 primitives; "Chapter hưởng ứng" track shows canonical dates; the problem-count track is 29px narrower so the status pill sits at x 1282 and is never clipped; the demo notice sits between header and table; "Tạo mới" disabled until S02; no WF04 pixel parity claimed',
        },
      ],
      typography,
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
