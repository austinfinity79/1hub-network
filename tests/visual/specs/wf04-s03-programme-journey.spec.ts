import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  CHAPTER_02,
  LEADER,
  call,
  cleanupProgrammes,
  createProgramme,
  expectNoOverflow,
  login,
  person,
  programmeRow,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S03 → WF04-PROD-04 — structure and journey on the canonical API
 * (rewritten from the demo journey spec, contract §17): stages and Challenge
 * problem statements persist in `programmes.metadata` through PATCH, survive a
 * refresh, a failed save retries, a conflict re-reads the programme, a closed
 * programme is read only, and foreign or malformed ids are 404.
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

type Stage = { name: string; position?: number; starts_on?: string | null }
const storedStages = async (id: string) =>
  ((await programmeRow(id))!.metadata.journey?.stages ?? []) as Stage[]
const storedProblems = async (id: string) =>
  ((await programmeRow(id))!.metadata.challenge?.problem_statements ?? []) as { title: string }[]

const stages = (page: Page) => page.locator('[data-stage-id]')

async function addStage(page: Page, name: string, start = '', end = '') {
  await page.locator('[data-action="add-stage"]').click()
  await page.locator('#st-name-new').fill(name)
  if (start) await page.locator('#st-start-new').fill(start)
  if (end) await page.locator('#st-end-new').fill(end)
  await page.locator('[data-action="save-stage"]').click()
  await expect(page.locator('[data-stage-editor]')).toHaveCount(0)
}

test.describe('WF04-S03 stages (metadata.journey)', () => {
  test('add, edit, move and remove persist and survive a refresh', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { name: 'Hành trình lưu thật' })
    await page.goto(routes.setup(programme.id, 'journey'))
    await expect(page.locator('[data-state="stages-empty"]')).toBeVisible()

    await addStage(page, 'Ươm tạo', '2026-11-01', '2026-11-30')
    await addStage(page, 'Demo day')
    expect(
      (await storedStages(programme.id)).map((s) => [s.position, s.name, s.starts_on]),
    ).toEqual([
      [1, 'Ươm tạo', '2026-11-01'],
      [2, 'Demo day', null],
    ])

    const second = stages(page).nth(1)
    await second.locator('[data-move="up"]').click()
    await expect(stages(page).first()).toContainText('Demo day')
    expect((await storedStages(programme.id)).map((s) => s.name)).toEqual(['Demo day', 'Ươm tạo'])

    await stages(page).nth(1).locator('[data-action="edit"]').click()
    await page.locator('[data-stage-editor] input').first().fill('Ươm tạo chuyên sâu')
    await page.locator('[data-action="save-stage"]').click()
    await expect(stages(page).nth(1)).toContainText('Ươm tạo chuyên sâu')

    await stages(page).first().locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="yes"]').click()
    await expect(stages(page)).toHaveCount(1)

    await page.reload()
    await expect(stages(page)).toHaveCount(1)
    await expect(stages(page).first()).toContainText('Ươm tạo chuyên sâu')
    expect((await storedStages(programme.id)).map((s) => [s.position, s.name])).toEqual([
      [1, 'Ươm tạo chuyên sâu'],
    ])
  })

  test('an invalid stage is refused on screen and never sent', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'journey'))
    let patches = 0
    page.on('request', (r) => {
      if (r.method() === 'PATCH') patches += 1
    })
    await page.locator('[data-action="add-stage"]').click()
    await page.locator('#st-name-new').fill('   ')
    await page.locator('#st-start-new').fill('2026-11-02')
    await page.locator('#st-end-new').fill('2026-11-01')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-stage-editor] [data-error="name"]')).toBeVisible()
    expect(patches).toBe(0)
    expect(await storedStages(programme.id)).toEqual([])
  })

  test('a failed save shows "Thử lại"; the retry saves once', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'journey'))
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
    await page.locator('[data-action="add-stage"]').click()
    await page.locator('#st-name-new').fill('Sau thử lại')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toBeVisible()
    expect(await storedStages(programme.id)).toEqual([])
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toHaveCount(0)
    await expect(stages(page)).toHaveCount(1)
    expect((await storedStages(programme.id)).map((s) => s.name)).toEqual(['Sau thử lại'])
    const mocked = consoleErrors.filter((e) => /status of 500/.test(e))
    expect(mocked).toHaveLength(1)
    consoleErrors.splice(
      0,
      consoleErrors.length,
      ...consoleErrors.filter((e) => !mocked.includes(e)),
    )
  })

  test('a programme closed elsewhere: the save is a conflict, the screen re-reads and turns read only', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'journey'))
    await call(page.request, 'post', `/${programme.id}/publish`)
    await call(page.request, 'post', `/${programme.id}/close`)
    await page.locator('[data-action="add-stage"]').click()
    await page.locator('#st-name-new').fill('Quá muộn')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page.locator('[data-state="save-conflict"]')).toBeVisible()
    await expect(page.locator('[data-state="read-only"]')).toContainText('đã đóng')
    await expect(page.locator('[data-action="add-stage"]')).toHaveCount(0)
    expect(await storedStages(programme.id)).toEqual([])
  })
})

test.describe('WF04-S03 problem statements (metadata.challenge)', () => {
  test('a CHALLENGE adds, edits and removes problems; a PROGRAMME has no problem section', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const challenge = await createProgramme(page.request, { type: 'CHALLENGE' })
    await page.goto(routes.setup(challenge.programme.id, 'journey'))
    await expect(page.locator('[data-state="problems-empty"]')).toBeVisible()
    await expect(page.locator('[data-journey-problems]')).not.toContainText('ít nhất một bài toán')
    for (const title of ['Bài toán 1', 'Bài toán 2']) {
      await page.locator('[data-action="add-problem"]').click()
      await page.locator('#pr-title-new').fill(title)
      await page.locator('[data-action="save-problem"]').click()
      await expect(page.locator('[data-problem-editor]')).toHaveCount(0)
    }
    const problems = page.locator('[data-problem-id]')
    await problems.first().locator('[data-action="edit"]').click()
    await page.locator('[data-problem-editor] input').first().fill('Bài toán 1 (sửa)')
    await page.locator('[data-action="save-problem"]').click()
    await problems.nth(1).locator('[data-action="remove"]').click()
    await page.locator('[data-confirm="yes"]').click()
    await expect(problems).toHaveCount(1)
    await page.reload()
    await expect(page.locator('[data-problem-id]')).toHaveText([/Bài toán 1 \(sửa\)/])
    expect((await storedProblems(challenge.programme.id)).map((p) => p.title)).toEqual([
      'Bài toán 1 (sửa)',
    ])

    const plain = await createProgramme(page.request)
    await page.goto(routes.setup(plain.programme.id, 'journey'))
    await expect(page.locator('[data-journey-stages]')).toBeVisible()
    await expect(page.locator('[data-journey-problems]')).toHaveCount(0)
  })
})

test.describe('WF04-S03 read only, authorization and responsive', () => {
  test('a closed programme shows its stages without any edit control', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { type: 'CHALLENGE' })
    await call(page.request, 'patch', `/${programme.id}`, {
      stages: [{ name: 'Giai đoạn đóng' }],
      problem_statements: [{ title: 'Bài toán đóng' }],
    })
    await call(page.request, 'post', `/${programme.id}/publish`)
    await call(page.request, 'post', `/${programme.id}/close`)
    await page.goto(routes.setup(programme.id, 'journey'))
    await expect(page.locator('[data-state="read-only"]')).toBeVisible()
    await expect(stages(page)).toHaveCount(1)
    for (const control of ['add-stage', 'add-problem', 'edit', 'remove'])
      await expect(page.locator(`[data-action="${control}"]`)).toHaveCount(0)
    await expect(page.locator('[data-move]')).toHaveCount(0)
  })

  test('another unit’s, unknown, fixture-only and malformed ids are the same 404', async ({
    page,
  }) => {
    const other = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.context().clearCookies()
    await login(page.request, other)
    expect((await page.goto(routes.setup(programme.id, 'journey')))?.status()).toBe(404)
    await page.context().clearCookies()
    await login(page.request, LEADER)
    for (const id of [
      'not-a-uuid',
      '99999999-9999-9999-9999-999999999999',
      'd4000000-0000-0000-0000-000000000002',
    ])
      expect((await page.goto(routes.setup(id, 'journey')))?.status(), id).toBe(404)
  })

  test('768 / 390: no page overflow; stage controls reachable; 1440 typography', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { type: 'CHALLENGE' })
    await call(page.request, 'patch', `/${programme.id}`, {
      stages: [
        { name: 'Ươm tạo', starts_on: '2026-11-01', ends_on: '2026-11-30' },
        { name: 'Demo day' },
      ],
      problem_statements: [{ title: 'Giảm hao hụt chặng cuối' }],
    })
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.setup(programme.id, 'journey'))
      await expectNoOverflow(page, `${width}px`)
      const edit = stages(page).first().locator('[data-action="edit"]')
      await edit.scrollIntoViewIfNeeded()
      await expect(edit).toBeInViewport()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s03-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(routes.setup(programme.id, 'journey'))
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s03-1440x900.png'), fullPage: true })
  })
})
