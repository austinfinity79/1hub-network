import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  CHAPTER_01,
  CHAPTER_02,
  LEADER,
  SEED_CHALLENGE,
  adm5Primitives,
  call,
  cleanupProgrammes,
  clubWithLeader,
  createProgramme,
  expectNoOverflow,
  login,
  person,
  programmeRow,
  routes,
  track,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S08 → WF04-PROD-04 — the programme detail / manage page and its basic
 * information step on the canonical API (rewritten from the demo detail spec,
 * contract §17; coverage restored by WF04-PROD-04-FIX): content from the
 * database, every manage link opens its step, basic information is validated
 * and saved, a closed or archived-owner programme is read only, the same 404.
 * Closing is API-only: the approved design has no close control, so the page
 * draws none (WF04-PROD-04-FIX).
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = watchConsole(page)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await cleanupProgrammes()
  await closePool()
})

const status = (page: Page) => page.locator('[data-detail-status]')

/** A PUBLISHED Challenge with a stage, a problem and a two-question form. */
async function populated(page: Page) {
  const detail = await createProgramme(page.request, {
    type: 'CHALLENGE',
    name: 'Thử thách đầy đủ',
    summary: 'Ba tháng đồng hành.',
    starts_at: '2026-11-01T00:00:00+07:00',
    ends_at: '2026-12-15T23:59:00+07:00',
  })
  const id = detail.programme.id
  await call(page.request, 'patch', `/${id}`, {
    stages: [{ name: 'Ươm tạo', starts_on: '2026-11-01', ends_on: '2026-11-30' }],
    problem_statements: [{ title: 'Giảm hao hụt chặng cuối' }],
  })
  await call(page.request, 'put', `/${id}/registration`, {
    applicant_types: ['TEAM', 'STARTUP'],
    questions: [
      { id: 'q-a', prompt: 'Vấn đề?', required: true, step: 1 },
      { id: 'q-b', prompt: 'Cần gì?', required: false, step: 4 },
    ],
  })
  await call(page.request, 'post', `/${id}/publish`)
  return id
}

test.describe('WF04-S08 content from the canonical API', () => {
  test('the seed Challenge: overview, linked event, empty journey / problems / registration / team', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await page.goto(routes.detail(SEED_CHALLENGE))
    await expect(page.locator('h1')).toHaveText('Demo Challenge')
    await expect(status(page)).toHaveAttribute('data-detail-status', 'DRAFT')
    await expect(page.locator('[data-overview="type"]')).toContainText('Challenge')
    await expect(page.locator('[data-overview="owner"]')).toContainText('Chapter 01')
    await expect(page.locator('[data-overview="time"]')).toContainText('01/11/2026')
    await expect(page.locator('[data-overview="summary"]')).toContainText('Fixture challenge.')
    await expect(page.locator('[data-detail="journey"]')).toContainText('0 giai đoạn')
    await expect(page.locator('[data-detail="problems"]')).toContainText('0 bài toán')
    await expect(page.locator('[data-detail="events"]')).toContainText('1 sự kiện')
    await expect(page.locator('[data-detail="events"]')).toContainText('Demo Draft Event')
    await expect(page.locator('[data-detail="registration"]')).toContainText(
      'Chưa chọn người đăng ký',
    )
    await expect(page.locator('[data-detail="team"]')).toContainText('0 thành viên')
    await expect(page.locator('[data-nav="detail-review"]')).toHaveText('Rà soát & xuất bản')
    // Overview "Sửa" plus the journey, problems, events, registration and team cards.
    await expect(page.locator('[data-manage]')).toHaveCount(6)
  })

  test('a PUBLISHED Challenge summarises its stage, problem and registration', async ({ page }) => {
    await login(page.request, LEADER)
    const id = await populated(page)
    await page.goto(routes.detail(id))
    await expect(status(page)).toHaveAttribute('data-detail-status', 'PUBLISHED')
    await expect(status(page)).toContainText('Đang công khai.')
    await expect(page.locator('[data-overview="summary"]')).toContainText('Ba tháng đồng hành.')
    await expect(page.locator('[data-overview="time"]')).toContainText('01/11/2026 – 15/12/2026')
    await expect(page.locator('[data-detail="journey"]')).toContainText('1 giai đoạn')
    await expect(page.locator('[data-detail="journey"]')).toContainText('Ươm tạo')
    await expect(page.locator('[data-detail="problems"]')).toContainText('Giảm hao hụt chặng cuối')
    await expect(page.locator('[data-detail="registration"]')).toContainText(
      'Đội · Startup · 2 câu hỏi riêng',
    )
    await expect(page.locator('[data-nav="detail-review"]')).toHaveText('Rà soát')
  })

  test('every manage link opens its built step; review and back lead where they say', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const id = await populated(page)
    for (const step of ['basic', 'journey', 'events', 'registration', 'team']) {
      await page.goto(routes.detail(id))
      await page.locator(`[data-manage="${step}"]`).first().click()
      await expect(page).toHaveURL(new RegExp(`${routes.setup(id, step)}$`))
      await expect(page.locator('[data-demo-page]')).toBeVisible()
    }
    await page.goto(routes.detail(id))
    await page.locator('[data-nav="detail-review"]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(id, 'review')}$`))
    await page.goto(routes.detail(id))
    await page.locator('[data-nav="detail-back"]').click()
    await expect(page).toHaveURL(/\/demo\/programmes$/)
  })
})

test.describe('WF04-S08 no close control (WF04-PROD-04-FIX); read only states', () => {
  test('a PUBLISHED programme offers no close control; closed through the API it is read only', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const id = await populated(page)
    await page.goto(routes.detail(id))
    await expect(status(page)).toHaveAttribute('data-detail-status', 'PUBLISHED')
    await expect(page.locator('[data-action="close-programme"]')).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText('Đóng chương trình')
    await expect(page.locator('div[data-confirm]')).toHaveCount(0)

    // The approved transition stays available on the API (PROD-03).
    await call(page.request, 'post', `/${id}/close`)
    expect((await programmeRow(id))!.status).toBe('CLOSED')
    await page.reload()
    await expect(status(page)).toHaveAttribute('data-detail-status', 'CLOSED')
    await expect(status(page)).toContainText('Đã đóng')
    await expect(page.locator('[data-manage]')).toHaveCount(0)
    await expect(page.locator('[data-nav="detail-review"]')).toHaveText('Rà soát')
  })

  test('an ARCHIVED owner offers no manage link', async ({ page }) => {
    const club = await clubWithLeader()
    await login(page.request, club.leader)
    const owned = await createProgramme(page.request, { organization_id: club.id })
    await call(page.request, 'post', `/${owned.programme.id}/publish`)
    await club.archive()
    await page.goto(routes.detail(owned.programme.id))
    await expect(status(page)).toHaveAttribute('data-detail-status', 'PUBLISHED')
    await expect(page.locator('[data-manage]')).toHaveCount(0)
  })
})

test.describe('WF04-S08 basic information (DEC-WF04-S08-D2)', () => {
  test('type and owner are read only; name and dates are validated; a save shows on the detail', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, {
      type: 'CHALLENGE',
      name: 'Tên cũ',
    })
    await page.goto(routes.setup(programme.id, 'basic'))
    await expect(page.locator('[data-readonly="type"]')).toHaveText('Challenge')
    await expect(page.locator('[data-readonly="owner"]')).toHaveText('Chapter 01')
    await page.locator('#be-name').fill('   ')
    await page.locator('#be-start').fill('2026-12-02')
    await page.locator('#be-end').fill('2026-12-01')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-error="name"]')).toBeVisible()
    await expect(page.locator('[data-error="dates"]')).toBeVisible()
    expect((await programmeRow(programme.id))!.name).toBe('Tên cũ')

    await page.locator('#be-name').fill('Tên mới')
    await page.locator('#be-end').fill('2026-12-31')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="basic-saved"]')).toBeVisible()
    const row = (await programmeRow(programme.id))!
    expect(row.name).toBe('Tên mới')
    expect(row.ends_at!.toISOString()).toBe('2026-12-31T16:59:00.000Z')
    await page.goto(routes.detail(programme.id))
    await expect(page.locator('h1')).toHaveText('Tên mới')
    await expect(page.locator('[data-overview="time"]')).toContainText('02/12/2026 – 31/12/2026')
  })

  test('a failed save shows "Thử lại"; the retry stores the edit once', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { name: 'Trước thử lại' })
    await page.goto(routes.setup(programme.id, 'basic'))
    let fail = true
    await page.route(`**/api/v1/programmes/${programme.id}`, async (route) => {
      if (route.request().method() === 'PATCH' && fail) {
        fail = false
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"error":{"code":"X","message":"m","request_id":"r"}}',
        })
      } else await route.continue()
    })
    await page.locator('#be-name').fill('Sau thử lại')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toBeVisible()
    expect((await programmeRow(programme.id))!.name).toBe('Trước thử lại')
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toHaveCount(0)
    expect((await programmeRow(programme.id))!.name).toBe('Sau thử lại')
    const [updates] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1 AND action = 'PROGRAMME_UPDATED'`,
      [programme.id],
    )
    expect(updates!.n).toBe(1)
    const mocked = consoleErrors.filter((e) => /status of 500/.test(e))
    expect(mocked).toHaveLength(1)
    consoleErrors.splice(
      0,
      consoleErrors.length,
      ...consoleErrors.filter((e) => !mocked.includes(e)),
    )
  })

  test('the review "Sửa" on a failing name opens the basic step, which fixes it', async ({
    page,
  }) => {
    const [row] = await query<{ id: string }>(
      `INSERT INTO programmes (organization_id, programme_type, slug, name) VALUES ($1, 'PROGRAMME', $2, '   ') RETURNING id::text`,
      [CHAPTER_01, `wf04-s08-fix-${Date.now()}`],
    )
    track(row!.id)
    await login(page.request, LEADER)
    await page.goto(routes.setup(row!.id, 'review'))
    await page.locator('[data-fix="name"]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(row!.id, 'basic')}$`))
    await page.locator('#be-name').fill('Đã có tên')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="basic-saved"]')).toBeVisible()
    await page.goto(routes.setup(row!.id, 'review'))
    await expect(page.locator('[data-check="name"]')).toHaveAttribute('data-ok', 'true')
  })
})

test.describe('WF04-S08 authorization, responsive and visual QA', () => {
  test('another unit’s, unknown, fixture-only and malformed ids are the same 404', async ({
    page,
  }) => {
    const other = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, other)
    expect((await page.goto(routes.detail(SEED_CHALLENGE)))?.status()).toBe(404)
    expect((await page.goto(routes.setup(SEED_CHALLENGE, 'basic')))?.status()).toBe(404)
    await page.context().clearCookies()
    await login(page.request, LEADER)
    for (const id of [
      'not-a-uuid',
      '99999999-9999-9999-9999-999999999999',
      'd4000000-0000-0000-0000-000000000002',
    ])
      expect((await page.goto(routes.detail(id)))?.status(), id).toBe(404)
  })

  test('768 / 390: cards stack without overflow; status and actions reachable', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const id = await populated(page)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.detail(id))
      await expectNoOverflow(page, `${width}px`)
      await expect(status(page)).toBeInViewport()
      await page.locator('[data-nav="detail-review"]').scrollIntoViewIfNeeded()
      await expect(page.locator('[data-nav="detail-review"]')).toBeInViewport()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s08-${width}.png`), fullPage: true })
    }
  })

  test('1440×900 DRAFT, PUBLISHED and basic information: typography and ADM5 primitives', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const id = await populated(page)
    await page.goto(routes.detail(SEED_CHALLENGE))
    await adm5Primitives(
      page,
      'WF04-S08',
      'draft',
      '[data-detail="overview"]',
      '[data-overview="owner"]',
    )
    await page.goto(routes.detail(id))
    await adm5Primitives(
      page,
      'WF04-S08',
      'published',
      '[data-detail="overview"]',
      '[data-overview="owner"]',
    )
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s08-1440x900.png'), fullPage: true })
    await page.goto(routes.setup(SEED_CHALLENGE, 'basic'))
    await adm5Primitives(
      page,
      'WF04-S08-BASIC',
      'basic',
      '[data-basic-info]',
      '[data-readonly="type"]',
    )
  })
})
