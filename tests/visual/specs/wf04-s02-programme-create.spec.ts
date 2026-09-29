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
 * WF04-S02 — create a demo Programme / Challenge (DEC-WF04-S02-D1..D4):
 * canonical basic information only, owner from the server-side scope, one
 * session DRAFT per save, no database / audit write, then the journey step
 * (S03) with a one-off confirmation.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const ADMIN_ACCOUNT = '30000000-0000-0000-0000-000000000003'
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

async function person(role: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-s02-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S02', 'ACTIVE', now(), now()) RETURNING id::text`,
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

async function stored(page: Page, account: string) {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), storeKey(account))
  return raw
    ? (JSON.parse(raw) as {
        created: string[]
        programmes: Record<
          string,
          { programme: Record<string, unknown>; organization: { id: string } }
        >
      })
    : null
}

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

const JOURNEY = /\/demo\/programmes\/[0-9a-f-]{36}\/setup\/journey$/
const form = (page: Page) => page.locator('[data-programme-form]')

/** After a save: the journey step of the new draft, then back to the list. */
async function backToList(page: Page) {
  await expect(page).toHaveURL(JOURNEY)
  await expect(page.locator('[data-screen="WF04-S03"]')).toBeVisible()
  await page.locator('[data-nav="journey-back"]').click()
  await expect(page).toHaveURL('/demo/programmes')
}
const save = (page: Page) => page.locator('[data-demo-save]')
const rows = (page: Page) => page.locator('[data-programme-row]')

async function openCreate(page: Page) {
  await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-screen="WF04-S02"]')).toBeVisible()
}

async function fill(
  page: Page,
  v: {
    type?: 'Chương trình' | 'Challenge'
    name?: string
    summary?: string
    start?: string
    end?: string
  },
) {
  if (v.type) await page.getByRole('radio', { name: v.type }).check()
  if (v.name !== undefined) await page.getByLabel('Tên', { exact: true }).fill(v.name)
  if (v.summary !== undefined) await page.getByLabel('Tóm tắt').fill(v.summary)
  if (v.start !== undefined) await page.getByLabel('Ngày bắt đầu').fill(v.start)
  if (v.end !== undefined) await page.getByLabel('Ngày kết thúc').fill(v.end)
}

async function cells(page: Page) {
  return rows(page).evaluateAll((els) =>
    els.map((el) => [...el.querySelectorAll('[role="cell"]')].map((c) => c.textContent)),
  )
}

test.describe('WF04-S02 create', () => {
  test('S01 → Tạo mới → S02; a PROGRAMME is created as a session DRAFT and listed first', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await page.locator('[data-demo-create]').click()
    await expect(page).toHaveURL('/demo/programmes/new')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chương trình / challenge mới')
    await expect(page.locator('[data-demo-notice]')).toHaveCount(1)
    // Owner from the server-side scope: exactly Chapter 01, read-only.
    await expect(page.locator('#pc-owner')).toHaveText('Chapter 01')
    await expect(page.locator('select#pc-owner')).toHaveCount(0)
    // Only the canonical basic information: no taxonomy or future fields.
    const labels = await form(page).locator('legend, label[for]').allTextContents()
    expect(labels).toEqual([
      'Loại',
      'Tên',
      'Tóm tắt',
      'Đơn vị chủ trì',
      'Thời gian',
      'Ngày bắt đầu',
      'Ngày kết thúc',
    ])
    expect(await form(page).innerText()).not.toMatch(/Lĩnh vực|Tỉnh|nhà đầu tư|chấm|Bài toán/i)

    await fill(page, {
      type: 'Chương trình',
      name: '  Chương trình kết nối (demo)  ',
      summary: 'Một chương trình mới.',
      start: '2026-10-01',
      end: '2026-12-31',
    })
    await save(page).click()
    // DEC-WF04-S03-D3: a save continues to the journey step with the confirmation.
    await expect(page).toHaveURL(JOURNEY)
    await expect(page.locator('[data-screen="WF04-S03"]')).toHaveAttribute(
      'data-programme-type',
      'PROGRAMME',
    )
    await expect(page.locator('[data-state="flash"]')).toHaveText(
      'Đã tạo bản nháp “Chương trình kết nối (demo)”.',
    )
    await page.locator('[data-nav="journey-back"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await expect(rows(page)).toHaveCount(3)
    expect((await cells(page))[0]).toEqual([
      'Chương trình kết nối (demo)',
      'Chapter 01',
      'Chương trình',
      '01/10/2026 – 31/12/2026',
      '—',
      'Bản nháp',
    ])
    await expect(page.locator('[data-demo-meta]')).toHaveText('2 chương trình · 1 challenge')
    const state = (await stored(page, LEADER_ACCOUNT))!
    expect(state.created).toHaveLength(1)
    const draft = state.programmes[state.created[0]!]!
    expect(draft.programme).toMatchObject({
      type: 'PROGRAMME',
      status: 'DRAFT',
      organization_id: CHAPTER_01,
      name: 'Chương trình kết nối (demo)',
      summary: 'Một chương trình mới.',
    })
    expect(String(draft.programme.id)).not.toMatch(/^d40/)
    expect(draft).not.toHaveProperty('problem_statements')
    expect(JSON.stringify(state)).not.toMatch(/@|token|cookie|30000000-/)

    // Refresh keeps it; the one-off confirmation is gone.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator('[data-state="flash"]')).toHaveCount(0)
    // Reset removes it and restores the two fixtures.
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(rows(page)).toHaveCount(2)
    expect((await cells(page)).map((c) => c[0])).toEqual([
      'Chương trình ươm tạo (demo)',
      'Thử thách đổi mới (demo)',
    ])
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect(await snapshot()).toEqual(before)
  })

  test('a CHALLENGE with only the required fields; optional summary and dates stay empty', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await openCreate(page)
    await fill(page, { type: 'Challenge', name: 'Thử thách tối giản' })
    await save(page).click()
    await backToList(page)
    await expect(rows(page)).toHaveCount(3)
    expect((await cells(page))[0]).toEqual([
      'Thử thách tối giản',
      'Chapter 01',
      'Challenge',
      '—',
      '0',
      'Bản nháp',
    ])
    const state = (await stored(page, LEADER_ACCOUNT))!
    const draft = state.programmes[state.created[0]!]!
    expect(draft.programme).toMatchObject({
      type: 'CHALLENGE',
      summary: null,
      starts_at: null,
      ends_at: null,
    })
    expect(draft).toHaveProperty('problem_statements', [])
    // A new, clean session starts from the fixtures only.
    const fresh = await page.context().newPage()
    await fresh.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(fresh.locator('[data-programme-row]')).toHaveCount(2)
    await fresh.close()
  })

  test('validation: required, blank name, date order, cleared on correction; nothing is stored', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await openCreate(page)
    await save(page).click()
    await expect(page).toHaveURL('/demo/programmes/new')
    await expect(page.locator('[data-error="type"]')).toHaveText('Trường này là bắt buộc.')
    await expect(page.locator('[data-error="name"]')).toHaveText('Trường này là bắt buộc.')
    await expect(page.getByLabel('Tên', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-error="organization_id"]')).toHaveCount(0)

    await fill(page, { type: 'Challenge', name: '   ', start: '2026-12-01', end: '2026-11-01' })
    await expect(page.locator('[data-error="type"]')).toHaveCount(0)
    await save(page).click()
    await expect(page.locator('[data-error="name"]')).toHaveText('Trường này là bắt buộc.')
    await expect(page.locator('[data-error="dates"]')).toHaveText(
      'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
    )
    await fill(page, { name: 'Tên hợp lệ' })
    await expect(page.locator('[data-error="name"]')).toHaveCount(0)
    await fill(page, { end: '2026-12-01' })
    await expect(page.locator('[data-error="dates"]')).toHaveCount(0)
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()
    await page.locator('[data-nav="programme-cancel"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await expect(rows(page)).toHaveCount(2)
  })

  test('an invalid type value is rejected; a double click creates exactly one draft', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await openCreate(page)
    await fill(page, { name: 'Loại giả' })
    await page.evaluate(() => {
      const radio = document.querySelector<HTMLInputElement>('input[name="programme-type"]')!
      radio.value = 'SUMMIT'
    })
    // A controlled radio whose value was tampered with never shows as checked.
    await page.getByRole('radio', { name: 'Chương trình' }).click()
    await save(page).click()
    await expect(page.locator('[data-error="type"]')).toHaveText('Loại không hợp lệ.')
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()

    await openCreate(page)
    await fill(page, { type: 'Challenge', name: 'Nhấn hai lần' })
    await save(page).dblclick()
    await backToList(page)
    const state = (await stored(page, LEADER_ACCOUNT))!
    expect(state.created).toHaveLength(1)
    await expect(rows(page)).toHaveCount(3)
  })

  test('save error: a refused write shows a safe message, stores nothing, and retry succeeds', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await openCreate(page)
    await fill(page, { type: 'Chương trình', name: 'Lưu lỗi' })
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await save(page).click()
    await expect(page).toHaveURL('/demo/programmes/new')
    await expect(page.locator('[data-state="save-failed"]')).toHaveText(
      'Chưa lưu được bản nháp. Vui lòng thử lại.',
    )
    expect(await page.locator('main').innerText()).not.toMatch(/quota|DOMException|sessionStorage/i)
    await expect(save(page)).toBeEnabled()
    expect(await stored(page, LEADER_ACCOUNT)).toBeNull()
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await save(page).click()
    await backToList(page)
    await expect(rows(page)).toHaveCount(3)
  })
})

test.describe('WF04-S02 owner and authorization', () => {
  test('platform admin chooses the owner from every operational organization; an injected one is refused', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    await openCreate(page)
    const select = page.locator('select#pc-owner')
    const options = await select.locator('option').allTextContents()
    expect(options[0]).toBe('Chọn đơn vị')
    const ops = await query<{ name: string }>(
      `SELECT name FROM organizations WHERE type::text IN ('HUB', 'CHAPTER', 'CLB') ORDER BY name, id`,
    )
    expect(options.slice(1)).toEqual(ops.map((o) => o.name))
    for (const name of ['Chapter 01', 'Chapter 02', 'HUB Network']) expect(options).toContain(name)
    await fill(page, { type: 'Challenge', name: 'Challenge của admin' })
    await save(page).click()
    await expect(page.locator('[data-error="organization_id"]')).toHaveText(
      'Trường này là bắt buộc.',
    )
    await page.evaluate(() => {
      const option = document.createElement('option')
      option.value = '99999999-0000-4000-8000-000000000000'
      option.textContent = 'Tổ chức giả'
      document.querySelector('select#pc-owner')!.append(option)
    })
    await select.selectOption('99999999-0000-4000-8000-000000000000')
    await save(page).click()
    await expect(page.locator('[data-error="organization_id"]')).toHaveText(
      'Đơn vị chủ trì không hợp lệ.',
    )
    expect(await stored(page, ADMIN_ACCOUNT)).toBeNull()
    await select.selectOption({ label: 'Chapter 02' })
    await expect(page.locator('[data-error="organization_id"]')).toHaveCount(0)
    await save(page).click()
    await backToList(page)
    await expect(rows(page)).toHaveCount(3)
    expect((await cells(page))[0]!.slice(0, 3)).toEqual([
      'Challenge của admin',
      'Chapter 02',
      'Challenge',
    ])
  })

  test('query / header scope spoofing does not change the owner or grant access', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/demo/programmes/new?orgId=${CHAPTER_02}&organization_id=${CHAPTER_02}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('#pc-owner')).toHaveText('Chapter 01')

    await page.context().clearCookies()
    await login(page.request, 'member@example.test')
    await page.setExtraHTTPHeaders({ 'x-role': 'PLATFORM_ADMIN', 'x-organization-id': CHAPTER_01 })
    expect((await page.goto(`/demo/programmes/new?orgId=${CHAPTER_01}`))?.status()).toBe(404)
  })

  test('guest → /auth; incomplete → resolver; member, PROGRAMME_ORGANIZER label → 404; foreign leader owns only its org', async ({
    page,
  }) => {
    await page.goto('/demo/programmes/new')
    await expect(page).toHaveURL('/auth')
    await login(page.request, `wf04-s02-incomplete-${Date.now()}@example.test`)
    await page.goto('/demo/programmes/new')
    await expect(page).toHaveURL('/onboarding')
    for (const who of [
      'member@example.test',
      (
        await person({
          code: 'PROGRAMME_ORGANIZER',
          scopeType: 'ORGANIZATION',
          scopeId: CHAPTER_01,
        })
      ).email,
      (await person({ code: 'PROGRAMME_ORGANIZER', scopeType: 'PLATFORM', scopeId: null })).email,
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      expect((await page.goto('/demo/programmes/new'))?.status(), who).toBe(404)
    }
    await page.context().clearCookies()
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    await openCreate(page)
    await expect(page.locator('#pc-owner')).toHaveText('Chapter 02')
    const html = await (await page.request.get('/demo/programmes/new')).text()
    expect(html).not.toContain(CHAPTER_01)
    expect(html).not.toMatch(/@example\.test|30000000-/)
  })
})

test.describe('WF04-S02 responsive basics', () => {
  test('768 / 390: no page overflow; fields and "Lưu" reachable', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await openCreate(page)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      for (const label of ['Tên', 'Ngày kết thúc']) {
        const field = page.getByLabel(label, { exact: true })
        await field.scrollIntoViewIfNeeded()
        await expect(field).toBeInViewport()
      }
      await save(page).scrollIntoViewIfNeeded()
      await expect(save(page)).toBeInViewport()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s02-${width}.png`), fullPage: true })
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
    for (const input of document.querySelectorAll('input, textarea')) {
      const r = input.getBoundingClientRect()
      rects.push({ x: r.x + 12, y: r.y + 12, width: r.width - 24, height: r.height - 24 })
    }
    return rects
  })
}

test.describe('WF04-S02 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 default, validation and filled: typography; input and header match the approved sources', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await openCreate(page)
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s02-default-1440x900.png') })
    await save(page).click()
    await expect(page.locator('[data-error="name"]')).toBeVisible()
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s02-validation-1440x900.png') })
    await fill(page, {
      type: 'Challenge',
      name: 'Thử thách mẫu',
      summary: 'Tóm tắt.',
      start: '2026-10-01',
      end: '2026-12-31',
    })
    await expect(page.locator('[data-error="name"]')).toHaveCount(0)
    const typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s02-filled-1440x900.png') })
    const actual = decodePng(await page.screenshot())

    const { screens } = loadManifest()
    const s02 = readPng(path.join(REPO_ROOT, findScreen(screens, 'WF02-S02').viewport_baseline))
    const adm5 = readPng(path.join(REPO_ROOT, findScreen(screens, 'WF03-S05').full_page_baseline!))
    const name = (await page.getByLabel('Tên', { exact: true }).boundingBox())!
    const nx = Math.round(name.x) - 64
    const ny = Math.round(name.y) - 140
    const mask = await textRects(page)
    // WF02-S02 input: 64..923 × 140..191, #e3dddd on the #efefef canvas.
    const inputs = compareSegments(
      s02,
      actual,
      [
        {
          name: 'input-left-edge',
          reference: { x: 60, y: 150, width: 10, height: 32 },
          dx: nx,
          dy: ny,
        },
        {
          name: 'input-top-edge',
          reference: { x: 200, y: 137, width: 560, height: 7 },
          dx: nx,
          dy: ny,
        },
        {
          name: 'input-bottom-edge',
          reference: { x: 200, y: 188, width: 560, height: 7 },
          dx: nx,
          dy: ny,
        },
      ],
      mask,
      { diffPath: resolveOutputPath('diff', 'WF04-S02.inputs.diff.png') },
    )
    const header = compareSegments(
      adm5,
      actual,
      [
        { name: 'header-band', reference: { x: 500, y: 4, width: 700, height: 66 }, dy: 0 },
        { name: 'header-rule', reference: { x: 500, y: 72, width: 700, height: 6 }, dy: 0 },
      ],
      mask,
      { diffPath: resolveOutputPath('diff', 'WF04-S02.header.diff.png') },
    )
    writeJsonReport('WF04-S02.primitives.json', {
      screen_id: 'WF04-S02',
      references: ['WF02-S02 viewport (input)', 'WF03-S05 ADM5 full (header band)'],
      approved_wf04_bitmap: null,
      name_input: name,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S02-D1: WF02-S02/S05 field language inside the demo frame; header "Huỷ" / "Lưu" in the ADM5 button family; no WF04 pixel parity claimed',
        },
      ],
      typography,
      segments: [...inputs, ...header],
      product_pixel_pass_claimed: false,
    })
    for (const r of [...inputs, ...header])
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
