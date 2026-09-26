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
 * WF04-S05 — registration configuration (DEC-WF04-S05-D1..D3): who may apply
 * and the programme's own questions in the session store, profile reuse
 * stated, read-only demo counts; no application row, engine, period or rule;
 * S04 → S05 → (S06 not yet); IDOR / scope; no writes; responsive; primitives.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const url = (id: string) => `/demo/programmes/${id}/setup/registration`

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
  const email = `wf04-s05-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S05', 'ACTIVE', now(), now()) RETURNING id::text`,
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
        programmes: Record<
          string,
          {
            registration: { applicant_types: string[]; questions: string[] }
            application_counts: object
          }
        >
      })
    : null
}

async function snapshot() {
  const [row] = await query<Record<string, string | null>>(
    `SELECT (SELECT count(*) FROM programmes)::text AS programmes,
            (SELECT max(updated_at)::text FROM programmes) AS programmes_at,
            to_regclass('public.applications')::text AS applications_table,
            (SELECT count(*) FROM projects)::text AS projects,
            (SELECT max(updated_at)::text FROM projects) AS projects_at,
            (SELECT max(updated_at)::text FROM individual_profiles) AS profiles_at,
            (SELECT count(*) FROM community_memberships)::text AS memberships,
            (SELECT count(*) FROM role_assignments)::text AS roles,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics`,
  )
  return row
}

const chips = (page: Page) => page.locator('[data-applicant-type]').allTextContents()
const questions = (page: Page) => page.locator('[data-question]').allTextContents()
const counts = (page: Page) =>
  page
    .locator('[data-count-status]')
    .evaluateAll((els) => els.map((el) => [el.getAttribute('data-count-status'), el.textContent]))

async function open(page: Page, id: string) {
  await page.goto(url(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

test.describe('WF04-S05 registration configuration', () => {
  test('1/2/3/10/12-15. both fixtures render; S04 → S05 → back; next safe; counts read-only', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/demo/programmes/${PROGRAMME}/setup/events`, { waitUntil: 'networkidle' })
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(url(PROGRAMME))
    await expect(page.locator('[data-screen="WF04-S05"]')).toBeVisible()
    await expect(page.locator('[data-setup-stepper] [aria-current="step"]')).toContainText(
      'Đăng ký',
    )
    expect(await chips(page)).toEqual(['Đội', 'Startup'])
    expect(await questions(page)).toEqual([
      'Dự án của bạn giải quyết vấn đề gì?',
      'Bạn cần chương trình hỗ trợ điều gì?',
    ])
    await expect(page.locator('[data-registration-config]')).toContainText(
      'Hồ sơ cá nhân và hồ sơ dự án / startup được dùng lại từ hồ sơ sẵn có',
    )
    expect(await counts(page)).toEqual([
      ['SUBMITTED', '5Đã nộp'],
      ['UNDER_REVIEW', '3Đang xem xét'],
      ['NEEDS_UPDATE', '1Cần bổ sung'],
    ])
    // Nothing beyond the frozen configuration is offered.
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(
      /mở đăng ký|đóng đăng ký|hạn đăng ký|điều kiện|chấm|duyệt hồ sơ|tải lên|thanh toán|vé/i,
    )
    const next = page.locator('[data-setup-next]')
    await expect(next).toBeDisabled()
    await expect(next).toHaveAttribute('title', 'Chưa có trong phiên bản này')
    await expect(page.locator('a[href*="/setup/team"]')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await chips(page)).toEqual(['Đội', 'Startup'])
    await page.locator('[data-nav="registration-back"]').click()
    await expect(page).toHaveURL(`/demo/programmes/${PROGRAMME}/setup/events`)

    await open(page, CHALLENGE)
    expect(await chips(page)).toEqual(['Đội', 'Startup'])
    await expect(page.locator('[data-summary="questions"]')).toContainText('Chưa có câu hỏi.')
    await expect(page.locator('[data-state="counts-empty"]')).toHaveText('Chưa có hồ sơ nào.')
  })

  test('4-9/11. edit, validate, save atomically; refresh; reset; counts unchanged; no row written', async ({
    page,
  }) => {
    const before = await snapshot()
    expect(before!.applications_table).toBeNull()
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await page.locator('[data-action="edit-registration"]').click()
    const labels = await page
      .locator('[data-registration-editor] input[type="checkbox"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
    expect(labels).toEqual(['INDIVIDUAL', 'TEAM', 'STARTUP'])
    await page.getByLabel('Cá nhân').check()
    await page.getByLabel('Đội').uncheck()
    await page.locator('[data-action="add-question"]').click()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-error="question-2"]')).toHaveText(
      'Câu hỏi không được để trống.',
    )
    expect(await stored(page)).toBeNull()
    await page.getByLabel('Câu hỏi 3', { exact: true }).fill('  Nhóm bạn có bao nhiêu người?  ')
    await expect(page.locator('[data-error="question-2"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Xoá câu hỏi 1' }).click()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-state="registration-saved"]')).toHaveText(
      'Đã lưu cấu hình đăng ký.',
    )
    expect(await chips(page)).toEqual(['Cá nhân', 'Startup'])
    expect(await questions(page)).toEqual([
      'Bạn cần chương trình hỗ trợ điều gì?',
      'Nhóm bạn có bao nhiêu người?',
    ])
    const state = (await stored(page))!.programmes[PROGRAMME]!
    expect(state.registration).toEqual({
      applicant_types: ['INDIVIDUAL', 'STARTUP'],
      questions: ['Bạn cần chương trình hỗ trợ điều gì?', 'Nhóm bạn có bao nhiêu người?'],
    })
    expect(state.application_counts).toEqual(DEMO_PROGRAMMES[0]!.application_counts)
    expect(await counts(page)).toHaveLength(3)

    // An injected applicant type is refused and changes nothing.
    await page.locator('[data-action="edit-registration"]').click()
    const team = page.locator('input[name="applicant-type"][value="TEAM"]')
    await team.evaluate((box) => {
      ;(box as HTMLInputElement).value = 'INVESTOR'
    })
    await page.locator('input[name="applicant-type"][value="INVESTOR"]').click()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-error="applicant_types"]')).toHaveText(
      'Loại người đăng ký không hợp lệ.',
    )
    expect((await stored(page))!.programmes[PROGRAMME]!.registration.applicant_types).toEqual([
      'INDIVIDUAL',
      'STARTUP',
    ])
    await page.getByRole('button', { name: 'Huỷ', exact: true }).last().click()

    // Refresh keeps it; reset restores the fixture configuration.
    await page.reload({ waitUntil: 'networkidle' })
    expect(await chips(page)).toEqual(['Cá nhân', 'Startup'])
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    expect(await chips(page)).toEqual(['Đội', 'Startup'])
    expect(await questions(page)).toHaveLength(2)
    expect(await counts(page)).toHaveLength(3)
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect(await snapshot()).toEqual(before)
  })

  test('not configured: a new draft starts empty, is configured, and survives refresh', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Chương trình' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Chương trình cần cấu hình')
    await page.locator('[data-demo-save]').click()
    await page.locator('[data-setup-next]').click()
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(/\/demo\/programmes\/[0-9a-f-]{36}\/setup\/registration$/)
    await expect(page.locator('[data-state="registration-empty"]')).toHaveText(
      'Chưa cấu hình đăng ký.',
    )
    await expect(page.locator('[data-state="counts-empty"]')).toBeVisible()
    await page.locator('[data-action="configure-registration"]').click()
    await page.getByLabel('Đội').check()
    await page.locator('[data-action="save-registration"]').click()
    expect(await chips(page)).toEqual(['Đội'])
    await page.reload({ waitUntil: 'networkidle' })
    expect(await chips(page)).toEqual(['Đội'])
  })

  test('save error: "Thử lại" stores the configuration once and closes the editor', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-action="edit-registration"]').click()
    await page.getByLabel('Cá nhân').check()
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toContainText(
      'Chưa lưu được thay đổi.',
    )
    await expect(page.locator('[data-action="save-registration"]')).toBeEnabled()
    expect(await page.locator('main').innerText()).not.toMatch(/quota|DOMException|sessionStorage/i)
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-registration-editor]')).toHaveCount(0)
    expect(await chips(page)).toEqual(['Cá nhân', 'Đội', 'Startup'])
  })
})

test.describe('WF04-S05 authorization and IDOR', () => {
  test('admin in scope; malformed / unknown 404; random ids reveal nothing; a choice grants nothing', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    for (const id of [PROGRAMME, CHALLENGE]) {
      expect((await page.goto(`${url(id)}?orgId=${CHAPTER_02}`))?.status()).toBe(200)
      await expect(page.locator('[data-registration-config]')).toBeVisible()
    }
    for (const id of ['abc', 'd4000000-0000-0000-0000-000000000099']) {
      expect((await page.goto(url(id)))?.status(), id).toBe(404)
    }
    expect((await page.goto(url('7c9e6679-7425-40de-944b-e07fc1f90ae7')))?.status()).toBe(200)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()

    // Selecting INDIVIDUAL for a programme does not give a member any access.
    await page.context().clearCookies()
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await page.locator('[data-action="edit-registration"]').click()
    await page.getByLabel('Cá nhân').check()
    await page.locator('[data-action="save-registration"]').click()
    await page.context().clearCookies()
    await login(page.request, 'member@example.test')
    expect((await page.goto(url(PROGRAMME)))?.status()).toBe(404)
    expect((await page.request.get('/api/v1/demo/programmes')).status()).toBe(403)
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities).toEqual([])
  })

  test('foreign organization, guest, label and header spoofing are refused', async ({ page }) => {
    await page.goto(url(PROGRAMME))
    await expect(page).toHaveURL('/auth')
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    for (const id of [PROGRAMME, CHALLENGE])
      expect((await page.goto(`${url(id)}?orgId=${CHAPTER_01}`))?.status(), id).toBe(404)
    await page.context().clearCookies()
    await login(
      page.request,
      (
        await person({
          code: 'PROGRAMME_ORGANIZER',
          scopeType: 'ORGANIZATION',
          scopeId: CHAPTER_01,
        })
      ).email,
    )
    await page.setExtraHTTPHeaders({ 'x-role': 'PLATFORM_ADMIN', 'x-organization-id': CHAPTER_01 })
    expect((await page.goto(url(CHALLENGE)))?.status()).toBe(404)
  })

  test('no contact or session data in the page or the store', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await page.locator('[data-action="edit-registration"]').click()
    await page.locator('[data-action="save-registration"]').click()
    const html = await (await page.request.get(url(PROGRAMME))).text()
    expect(html).not.toMatch(/@example\.test|30000000-/)
    expect(JSON.stringify(await stored(page))).not.toMatch(/@|token|cookie|30000000-/)
  })
})

test.describe('WF04-S05 responsive basics', () => {
  test('768 / 390: no page overflow; editor, back and next reachable', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page, PROGRAMME)
      await page.locator('[data-action="edit-registration"]').click()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      for (const locator of [
        page.locator('[data-nav="registration-back"]'),
        page.locator('[data-setup-next]'),
        page.getByLabel('Startup'),
        page.getByLabel('Câu hỏi 1', { exact: true }),
        page.locator('[data-action="save-registration"]'),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s05-${width}.png`), fullPage: true })
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
    for (const input of document.querySelectorAll('input[type="text"], input:not([type])')) {
      const r = input.getBoundingClientRect()
      rects.push({ x: r.x + 12, y: r.y + 12, width: r.width - 24, height: r.height - 24 })
    }
    return rects
  })
}

test.describe('WF04-S05 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 configured, validation and not configured: typography; header, card, input primitives', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const { screens } = loadManifest()
    const adm5 = readPng(path.join(REPO_ROOT, findScreen(screens, 'WF03-S05').full_page_baseline!))
    const s02 = readPng(path.join(REPO_ROOT, findScreen(screens, 'WF02-S02').viewport_baseline))
    const results = []
    let checked = 0

    // Configured.
    await open(page, PROGRAMME)
    await settle(page)
    let typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    checked += typography.checked
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s05-configured-1440x900.png') })
    let actual = decodePng(await page.screenshot())
    const card = (await page.locator('[data-registration-config]').boundingBox())!
    const firstRow = (await page.locator('[data-summary="applicant-types"]').boundingBox())!
    results.push(
      ...compareSegments(
        adm5,
        actual,
        [
          { name: 'header-band', reference: { x: 500, y: 4, width: 600, height: 66 }, dy: 0 },
          { name: 'header-rule', reference: { x: 500, y: 72, width: 600, height: 6 }, dy: 0 },
          {
            name: 'card-top',
            reference: { x: 300, y: 95, width: 800, height: 8 },
            dx: Math.round(card.x) - 248,
            dy: Math.round(card.y) - 99,
          },
          {
            name: 'card-left',
            reference: { x: 244, y: 140, width: 10, height: 40 },
            dx: Math.round(card.x) - 248,
            dy: Math.round(firstRow.y) + 4 - 140,
          },
        ],
        await textRects(page),
        { diffPath: resolveOutputPath('diff', 'WF04-S05.configured.diff.png') },
      ),
    )

    // Validation (editing with a blank question): the question input against WF02-S02.
    await page.locator('[data-action="edit-registration"]').click()
    await page.locator('[data-action="add-question"]').click()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-error="question-2"]')).toBeVisible()
    await settle(page)
    typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    checked += typography.checked
    await page.screenshot({
      path: path.join(ACTUAL, 'wf04-s05-validation-1440x900.png'),
      fullPage: true,
    })
    actual = decodePng(await page.screenshot({ fullPage: true }))
    const input = (await page.getByLabel('Câu hỏi 1', { exact: true }).boundingBox())!
    const ix = Math.round(input.x) - 64
    const iy = Math.round(input.y) - 140
    results.push(
      ...compareSegments(
        s02,
        actual,
        [
          {
            name: 'question-input-left',
            reference: { x: 60, y: 150, width: 10, height: 32 },
            dx: ix,
            dy: iy,
          },
          {
            name: 'question-input-top',
            reference: { x: 200, y: 137, width: 400, height: 7 },
            dx: ix,
            dy: iy,
          },
        ],
        await textRects(page),
        { diffPath: resolveOutputPath('diff', 'WF04-S05.validation.diff.png') },
      ),
    )

    // Not configured (a new draft).
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Challenge' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Challenge chưa cấu hình')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await page.goto(page.url().replace('/setup/journey', '/setup/registration'), {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('[data-state="registration-empty"]')).toBeVisible()
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s05-empty-1440x900.png') })

    writeJsonReport('WF04-S05.primitives.json', {
      screen_id: 'WF04-S05',
      references: ['WF03-S05 ADM5 full (header, card)', 'WF02-S02 viewport (input)'],
      approved_wf04_bitmap: null,
      typography_checked: checked,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S05-D1: S03 card chrome, neutral ADM5 pill family for applicant chips, WF02 inputs and checkboxes; no WF04 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
