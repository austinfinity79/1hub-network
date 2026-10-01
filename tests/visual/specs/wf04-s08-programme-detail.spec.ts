import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  CHAPTER_02,
  LEADER,
  SEED_CHALLENGE,
  auditActions,
  call,
  cleanupProgrammes,
  clubWithLeader,
  createProgramme,
  expectNoOverflow,
  login,
  person,
  programmeRow,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S08 → WF04-PROD-04 — the programme detail / manage page on the
 * canonical API (rewritten from the demo detail spec, contract §17): content
 * from the database, the approved close action (PUBLISHED → CLOSED,
 * DEC-W4P-D12) behind an inline confirmation, read only after close or under
 * an ARCHIVED owner (DEC-W4P-D13), the same 404 for foreign or malformed ids.
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
const closeButton = (page: Page) => page.locator('[data-action="close-programme"]')

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
    await expect(closeButton(page)).toHaveCount(0)
    // Overview "Sửa" plus the journey, problems, events, registration and team cards.
    await expect(page.locator('[data-manage]')).toHaveCount(6)
  })
})

test.describe('WF04-S08 close (DEC-W4P-D12)', () => {
  test('cancel changes nothing; confirm closes, persists, audits once and turns the page read only', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { name: 'Đóng thật' })
    await call(page.request, 'post', `/${programme.id}/publish`)
    await page.goto(routes.detail(programme.id))
    await expect(status(page)).toHaveAttribute('data-detail-status', 'PUBLISHED')
    await expect(status(page)).toContainText('Đang công khai.')

    await closeButton(page).click()
    await expect(page.locator('div[data-confirm]')).toContainText('Đóng “Đóng thật”?')
    await page.locator('[data-confirm="no"]').click()
    expect((await programmeRow(programme.id))!.status).toBe('PUBLISHED')

    await closeButton(page).click()
    await page.locator('[data-confirm="yes"]').dblclick()
    await expect(page.locator('[data-state="closed-now"]')).toBeVisible()
    await expect(status(page)).toHaveAttribute('data-detail-status', 'CLOSED')
    await expect(status(page)).toContainText('Đã đóng')
    await expect(closeButton(page)).toHaveCount(0)
    await expect(page.locator('[data-manage]')).toHaveCount(0)
    await expect(page.locator('[data-nav="detail-review"]')).toHaveText('Rà soát')
    expect((await programmeRow(programme.id))!.status).toBe('CLOSED')
    expect((await auditActions(programme.id)).filter((a) => a === 'PROGRAMME_CLOSED')).toHaveLength(
      1,
    )

    await page.reload()
    await expect(status(page)).toHaveAttribute('data-detail-status', 'CLOSED')
    await expect(closeButton(page)).toHaveCount(0)
  })

  test('a DRAFT offers no close; an ARCHIVED owner offers no close and no manage link', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const draft = await createProgramme(page.request)
    await page.goto(routes.detail(draft.programme.id))
    await expect(closeButton(page)).toHaveCount(0)

    const club = await clubWithLeader()
    await page.context().clearCookies()
    await login(page.request, club.leader)
    const owned = await createProgramme(page.request, { organization_id: club.id })
    await call(page.request, 'post', `/${owned.programme.id}/publish`)
    await club.archive()
    await page.goto(routes.detail(owned.programme.id))
    await expect(status(page)).toHaveAttribute('data-detail-status', 'PUBLISHED')
    await expect(closeButton(page)).toHaveCount(0)
    await expect(page.locator('[data-manage]')).toHaveCount(0)
  })
})

test.describe('WF04-S08 authorization and responsive', () => {
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
    await page.context().clearCookies()
    await login(page.request, LEADER)
    for (const id of [
      'not-a-uuid',
      '99999999-9999-9999-9999-999999999999',
      'd4000000-0000-0000-0000-000000000002',
    ])
      expect((await page.goto(routes.detail(id)))?.status(), id).toBe(404)
  })

  test('768 / 390 without overflow; 1440 typography', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { type: 'CHALLENGE' })
    await call(page.request, 'patch', `/${programme.id}`, {
      stages: [{ name: 'Ươm tạo', starts_on: '2026-11-01', ends_on: '2026-11-30' }],
      problem_statements: [{ title: 'Giảm hao hụt chặng cuối' }],
    })
    await call(page.request, 'post', `/${programme.id}/publish`)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.detail(programme.id))
      await expectNoOverflow(page, `${width}px`)
      await closeButton(page).scrollIntoViewIfNeeded()
      await expect(closeButton(page)).toBeInViewport()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s08-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(routes.detail(programme.id))
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s08-1440x900.png'), fullPage: true })
  })
})
