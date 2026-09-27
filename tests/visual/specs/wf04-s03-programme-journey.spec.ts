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
 * WF04-S03 — Structure & journey (DEC-WF04-H3/H4, DEC-WF04-S03-D1..D3):
 * ordered stages (add / edit / remove / move), CHALLENGE-only problem
 * statements, atomic edits in the session store, S02 → S03, IDOR / scope,
 * no database or audit write, responsive basics and approved primitives.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const journey = (id: string) => `/demo/programmes/${id}/setup/journey`

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
  const email = `wf04-s03-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S03', 'ACTIVE', now(), now()) RETURNING id::text`,
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

async function raw(page: Page, account = LEADER_ACCOUNT) {
  return page.evaluate((k) => sessionStorage.getItem(k), storeKey(account))
}

async function snapshot() {
  const [row] = await query<Record<string, string>>(
    `SELECT (SELECT count(*) FROM programmes)::text AS programmes,
            (SELECT max(updated_at)::text FROM programmes) AS programmes_at,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT max(updated_at)::text FROM events) AS events_at,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            (SELECT max(updated_at)::text FROM individual_profiles) AS profiles_at,
            (SELECT count(*) FROM community_memberships)::text AS memberships,
            (SELECT max(updated_at)::text FROM organizations) AS organizations_at`,
  )
  return row
}

const stageNames = (page: Page) =>
  page
    .locator('[data-stage-id]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-position'), el.querySelector('p')?.textContent]),
    )
const problemTitles = (page: Page) =>
  page.locator('[data-problem-id] p:first-child').allTextContents()
const stage = (page: Page, name: string) =>
  page.locator('[data-stage-id]').filter({ has: page.getByText(name, { exact: true }) })

async function open(page: Page, id: string) {
  await page.goto(journey(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

async function reset(page: Page) {
  await page.locator('[data-demo-reset="start"]').click()
  await page.locator('[data-demo-reset="confirm"]').click()
}

test.describe('WF04-S03 stages', () => {
  test('1/2. fixtures render in stored order; frame, stepper, back and a disabled next', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chương trình ươm tạo (demo)')
    await expect(page.locator('[data-demo-meta]')).toHaveText(
      'Chương trình · Đang công khai · Chapter 01',
    )
    expect(await stageNames(page)).toEqual([
      ['1', 'Mở đăng ký'],
      ['2', 'Ươm tạo'],
      ['3', 'Ngày trình diễn'],
    ])
    await expect(page.locator('[data-stage-id] >> nth=0')).toContainText('01')
    await expect(page.locator('[data-journey-problems]')).toHaveCount(0)
    await expect(page.locator('[data-setup-stepper] [aria-current="step"]')).toContainText(
      'Hành trình',
    )
    await expect(page.locator('[data-setup-stepper] a')).toHaveCount(0)
    // DEC-WF04-S04-D3: "Tiếp theo" opens the events step.
    const next = page.locator('[data-setup-next]')
    await expect(next).toHaveAttribute('href', `/demo/programmes/${PROGRAMME}/setup/events`)
    await expect(next).toHaveText('Tiếp theo')
    await expect(page.locator('[data-nav="programme-demo"]')).toHaveAttribute(
      'aria-current',
      'page',
    )

    await open(page, CHALLENGE)
    expect(await stageNames(page)).toEqual([
      ['1', 'Nhận giải pháp'],
      ['2', 'Kết nối thí điểm'],
    ])
    await expect(page.locator('[data-journey-problems]')).toBeVisible()
    expect(await problemTitles(page)).toEqual([
      'Bài toán mẫu 1: tối ưu giao hàng chặng cuối',
      'Bài toán mẫu 2: số hoá hồ sơ khách hàng',
    ])
    await page.locator('[data-nav="journey-back"]').click()
    await expect(page).toHaveURL('/demo/programmes')
  })

  test('3-11. add, edit, remove, move, boundaries, empty, refresh, reset; nothing written', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)

    // Add (one stage, position 4).
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('  Kết nối nhà tài trợ  ')
    await page.getByLabel('Ngày bắt đầu').fill('2026-12-16')
    await page.getByLabel('Ngày kết thúc').fill('2026-12-20')
    await page.locator('[data-action="save-stage"]').click()
    expect(await stageNames(page)).toEqual([
      ['1', 'Mở đăng ký'],
      ['2', 'Ươm tạo'],
      ['3', 'Ngày trình diễn'],
      ['4', 'Kết nối nhà tài trợ'],
    ])
    await expect(stage(page, 'Kết nối nhà tài trợ')).toContainText('16/12/2026 – 20/12/2026')

    // Edit (fields only; position unchanged).
    await stage(page, 'Ươm tạo').locator('[data-action="edit"]').click()
    await page.getByLabel('Tên giai đoạn').fill('Ươm tạo chuyên sâu')
    await page.getByLabel('Mô tả ngắn').fill('Làm việc 1:1')
    await page.locator('[data-action="save-stage"]').click()
    await expect(stage(page, 'Ươm tạo chuyên sâu')).toHaveAttribute('data-position', '2')
    await expect(stage(page, 'Ươm tạo chuyên sâu')).toContainText('Làm việc 1:1')

    // Move down / up, boundaries.
    await page.getByRole('button', { name: 'Chuyển “Mở đăng ký” xuống' }).click()
    expect((await stageNames(page)).map((s) => s[1])).toEqual([
      'Ươm tạo chuyên sâu',
      'Mở đăng ký',
      'Ngày trình diễn',
      'Kết nối nhà tài trợ',
    ])
    await page.getByRole('button', { name: 'Chuyển “Kết nối nhà tài trợ” lên' }).click()
    expect((await stageNames(page)).map((s) => s[1])).toEqual([
      'Ươm tạo chuyên sâu',
      'Mở đăng ký',
      'Kết nối nhà tài trợ',
      'Ngày trình diễn',
    ])
    await expect(
      page.getByRole('button', { name: 'Chuyển “Ươm tạo chuyên sâu” lên' }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Chuyển “Ngày trình diễn” xuống' }),
    ).toBeDisabled()

    // Remove with the inline confirmation (cancel first); positions stay contiguous.
    await stage(page, 'Mở đăng ký').locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="no"]').click()
    await expect(page.locator('[data-stage-id]')).toHaveCount(4)
    await stage(page, 'Mở đăng ký').locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="yes"]').click()
    expect(await stageNames(page)).toEqual([
      ['1', 'Ươm tạo chuyên sâu'],
      ['2', 'Kết nối nhà tài trợ'],
      ['3', 'Ngày trình diễn'],
    ])

    // Refresh keeps the order (session store).
    await page.reload({ waitUntil: 'networkidle' })
    expect((await stageNames(page)).map((s) => s[0])).toEqual(['1', '2', '3'])
    expect((await stageNames(page)).map((s) => s[1])).toEqual([
      'Ươm tạo chuyên sâu',
      'Kết nối nhà tài trợ',
      'Ngày trình diễn',
    ])

    // Empty list, then a first stage again.
    for (let n = 3; n > 0; n--) {
      await page.locator('[data-stage-id] [data-action="remove"]').first().click()
      await page.locator('[data-confirm="yes"]').click()
    }
    await expect(page.locator('[data-state="stages-empty"]')).toHaveText('Chưa có giai đoạn nào.')
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('Khởi động')
    await page.locator('[data-action="save-stage"]').click()
    expect(await stageNames(page)).toEqual([['1', 'Khởi động']])

    // The fixture itself never changed; reset restores the original order.
    expect(DEMO_PROGRAMMES[0]!.stages.map((s) => s.name)).toEqual([
      'Mở đăng ký',
      'Ươm tạo',
      'Ngày trình diễn',
    ])
    await reset(page)
    expect(await stageNames(page)).toEqual([
      ['1', 'Mở đăng ký'],
      ['2', 'Ươm tạo'],
      ['3', 'Ngày trình diễn'],
    ])
    expect(await raw(page)).toBeNull()
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect(await snapshot()).toEqual(before)
  })

  test('12. an invalid edit changes nothing (blank name, reversed dates)', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('   ')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-error="name"]')).toHaveText('Trường này là bắt buộc.')
    expect(await raw(page)).toBeNull()
    await page.getByRole('button', { name: 'Huỷ', exact: true }).last().click()
    await stage(page, 'Ươm tạo').locator('[data-action="edit"]').click()
    await page.getByLabel('Ngày bắt đầu').fill('2026-11-30')
    await page.getByLabel('Ngày kết thúc').fill('2026-10-01')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-error="dates"]')).toHaveText(
      'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
    )
    expect(await raw(page)).toBeNull()
    await page.getByLabel('Ngày kết thúc').fill('2026-12-01')
    await expect(page.locator('[data-error="dates"]')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(stage(page, 'Ươm tạo')).toContainText('01/10/2026 – 30/11/2026')
  })
})

test.describe('WF04-S03 problem statements', () => {
  test('13-16. CHALLENGE add / edit / remove / empty; PROGRAMME never shows them; reset restores', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-action="add-problem"]').click()
    await page.getByLabel('Tên bài toán').fill('   ')
    await page.locator('[data-action="save-problem"]').click()
    await expect(page.locator('[data-error="title"]')).toHaveText('Trường này là bắt buộc.')
    expect(await raw(page)).toBeNull()
    await page.getByLabel('Tên bài toán').fill('Bài toán 3: kiểm kê kho')
    await page.locator('[data-action="save-problem"]').click()
    expect(await problemTitles(page)).toHaveLength(3)
    const third = page.locator('[data-problem-id]').filter({ hasText: 'Bài toán 3: kiểm kê kho' })
    await third.locator('[data-action="edit"]').click()
    await page.getByLabel('Tên bài toán').fill('Bài toán 3: kiểm kê kho tự động')
    await page.locator('[data-action="save-problem"]').click()
    expect((await problemTitles(page))[2]).toBe('Bài toán 3: kiểm kê kho tự động')
    for (let n = 3; n > 0; n--) {
      await page.locator('[data-problem-id] [data-action="remove"]').first().click()
      await page.locator('[data-confirm="yes"]').click()
    }
    await expect(page.locator('[data-state="problems-empty"]')).toHaveText('Chưa có bài toán nào.')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="problems-empty"]')).toBeVisible()

    // The Programme stays free of Challenge content.
    await open(page, PROGRAMME)
    await expect(page.locator('[data-journey-problems]')).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText('Bài toán')

    await open(page, CHALLENGE)
    await reset(page)
    expect(await problemTitles(page)).toEqual([
      'Bài toán mẫu 1: tối ưu giao hàng chặng cuối',
      'Bài toán mẫu 2: số hoá hồ sơ khách hàng',
    ])
  })

  test('17/18. S02 → S03: a new PROGRAMME and a new CHALLENGE enter the journey empty', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const [type, name] of [
      ['Chương trình', 'Chương trình mới (S03)'],
      ['Challenge', 'Challenge mới (S03)'],
    ] as const) {
      await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
      await page.getByRole('radio', { name: type }).check()
      await page.getByLabel('Tên', { exact: true }).fill(name)
      await page.locator('[data-demo-save]').click()
      await expect(page).toHaveURL(/\/demo\/programmes\/[0-9a-f-]{36}\/setup\/journey$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
      await expect(page.locator('[data-state="flash"]')).toHaveText(`Đã tạo bản nháp “${name}”.`)
      await expect(page.locator('[data-state="stages-empty"]')).toBeVisible()
      await expect(page.locator('[data-journey-problems]')).toHaveCount(
        type === 'Challenge' ? 1 : 0,
      )
      if (type === 'Challenge')
        await expect(page.locator('[data-state="problems-empty"]')).toBeVisible()
      await page.locator('[data-action="add-stage"]').click()
      await page.getByLabel('Tên giai đoạn').fill('Giai đoạn đầu')
      await page.locator('[data-action="save-stage"]').click()
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.locator('[data-state="flash"]')).toHaveCount(0)
      expect(await stageNames(page)).toEqual([['1', 'Giai đoạn đầu']])
    }
  })
})

test.describe('WF04-S03 authorization and IDOR', () => {
  test('in-scope ids work directly; malformed / unknown fixture ids 404; random ids show nothing', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const id of [PROGRAMME, CHALLENGE]) {
      expect((await page.goto(`${journey(id)}?orgId=${CHAPTER_02}`))?.status()).toBe(200)
      await expect(page.locator('[data-stage-id]').first()).toBeVisible()
    }
    for (const id of [
      'abc',
      'd4000000-0000-0000-0000-000000000099',
      '60000000-0000-0000-0000-00000000000g',
    ]) {
      expect((await page.goto(journey(id)))?.status(), id).toBe(404)
      await expect(page.locator('[data-shell="not-found"]'), id).toHaveCount(1)
    }
    // A UUID that is no draft of this session: nothing is revealed.
    expect((await page.goto(journey('7c9e6679-7425-40de-944b-e07fc1f90ae7')))?.status()).toBe(200)
    await expect(page.locator('[data-state="setup-missing"]')).toHaveText(
      /Không tìm thấy chương trình này/,
    )
    await expect(page.locator('[data-stage-id]')).toHaveCount(0)
  })

  test('foreign organization, member, guest, label and header spoofing are refused', async ({
    page,
  }) => {
    await page.goto(journey(PROGRAMME))
    await expect(page).toHaveURL('/auth')

    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    for (const id of [PROGRAMME, CHALLENGE])
      expect((await page.goto(`${journey(id)}?orgId=${CHAPTER_01}`))?.status(), id).toBe(404)
    // A stored copy of a Chapter 01 programme (tampered client state) is not shown either.
    const draftId = 'b1f0a9c2-0000-4000-8000-000000000301'
    const copy = structuredClone(DEMO_PROGRAMMES[1]!)
    copy.programme = { ...copy.programme, id: draftId }
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(foreign.account),
        JSON.stringify({
          version: 1,
          programmes: {
            [draftId]: {
              ...copy,
              organization: {
                id: CHAPTER_01,
                slug: 'chapter-01',
                name: 'Chapter 01',
                type: 'CHAPTER',
              },
              demo: true,
            },
          },
          created: [draftId],
        }),
      ],
    )
    await open(page, draftId)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()

    for (const who of [
      'member@example.test',
      (
        await person({
          code: 'PROGRAMME_ORGANIZER',
          scopeType: 'ORGANIZATION',
          scopeId: CHAPTER_01,
        })
      ).email,
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      await page.setExtraHTTPHeaders({
        'x-role': 'PLATFORM_ADMIN',
        'x-organization-id': CHAPTER_01,
      })
      expect((await page.goto(journey(CHALLENGE)))?.status(), who).toBe(404)
    }
  })

  test('platform admin edits any fixture; HTML and store carry no contact or session data', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('Giai đoạn admin')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-stage-id]')).toHaveCount(3)
    const html = await (await page.request.get(journey(CHALLENGE))).text()
    expect(html).not.toMatch(/@example\.test|30000000-/)
    const stored = await raw(page, '30000000-0000-0000-0000-000000000003')
    expect(stored).not.toMatch(/@|token|cookie|30000000-/)
  })
})

test.describe('WF04-S03 responsive basics', () => {
  test('768 / 390: no page overflow; stage controls reachable', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page, CHALLENGE)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      for (const locator of [
        page.getByRole('button', { name: 'Chuyển “Nhận giải pháp” xuống' }),
        page.locator('[data-stage-id] [data-action="edit"]').first(),
        page.locator('[data-action="add-problem"]'),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s03-${width}.png`), fullPage: true })
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

test.describe('WF04-S03 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 Programme, Challenge, empty and editing: typography; header, card and input primitives', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const { screens } = loadManifest()
    const adm5 = readPng(path.join(REPO_ROOT, findScreen(screens, 'WF03-S05').full_page_baseline!))
    const s02 = readPng(path.join(REPO_ROOT, findScreen(screens, 'WF02-S02').viewport_baseline))
    const results = []
    let typographyChecked = 0

    for (const [name, id] of [
      ['programme', PROGRAMME],
      ['challenge', CHALLENGE],
    ] as const) {
      await open(page, id)
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      typographyChecked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s03-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf04-s03-${name}-full.png`),
        fullPage: true,
      })
      const actual = decodePng(await page.screenshot())
      const card = (await page.locator('[data-journey-stages]').boundingBox())!
      const firstRow = (await page.locator('[data-stage-id]').first().boundingBox())!
      const cx = Math.round(card.x) - 248
      const cy = Math.round(card.y) - 99
      // The left edge is compared inside the first stage row (white, like ADM5's row 1).
      const ry = Math.round(firstRow.y) + 4 - 140
      // ADM5 header band / rule, and the ADM5 table card's top and left edges (248 × 99).
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
              dy: ry,
            },
          ],
          await textRects(page),
          { diffPath: resolveOutputPath('diff', `WF04-S03.${name}.diff.png`) },
        ),
      )
    }

    // Editing state: the stage name input against the WF02-S02 input (64..923 × 140..191).
    await page.locator('[data-action="add-stage"]').click()
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    const input = (await page.getByLabel('Tên giai đoạn').boundingBox())!
    await page.screenshot({
      path: path.join(ACTUAL, 'wf04-s03-editing-1440x900.png'),
      fullPage: true,
    })
    const editing = decodePng(await page.screenshot({ fullPage: true }))
    const ix = Math.round(input.x) - 64
    const iy = Math.round(input.y) - 140
    results.push(
      ...compareSegments(
        s02,
        editing,
        [
          {
            name: 'stage-input-left',
            reference: { x: 60, y: 150, width: 10, height: 32 },
            dx: ix,
            dy: iy,
          },
          {
            name: 'stage-input-top',
            reference: { x: 200, y: 137, width: 500, height: 7 },
            dx: ix,
            dy: iy,
          },
        ],
        await textRects(page),
        { diffPath: resolveOutputPath('diff', 'WF04-S03.editing.diff.png') },
      ),
    )

    // Empty state capture (a new draft).
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Chương trình' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Hành trình trống')
    await page.locator('[data-demo-save]').click()
    await expect(page.locator('[data-state="stages-empty"]')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s03-empty-1440x900.png') })

    writeJsonReport('WF04-S03.primitives.json', {
      screen_id: 'WF04-S03',
      references: ['WF03-S05 ADM5 full (header, table card)', 'WF02-S02 viewport (input)'],
      approved_wf04_bitmap: null,
      typography_checked: typographyChecked,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S03-D1: ADM5 card chrome, WF01 stepper language and WF01-S08 index, WF03 text actions, WF02 inputs; no WF04 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
