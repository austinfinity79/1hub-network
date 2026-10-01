import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  LEADER,
  MEMBER,
  SEED_VENTURE,
  call,
  cleanupProgrammes,
  createProgramme,
  expectNoOverflow,
  login,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S05 → WF04-PROD-04 — registration on the canonical form WF05 reads
 * (`PUT /api/v1/programmes/{id}/registration`; rewritten from the demo
 * registration spec, contract §17): TEAM / STARTUP only (PO decision 4),
 * questions keep their stored `required` / `step`, a new question is
 * unavailable (Q3(b)), the form is read only once an application exists (PO
 * decision 3) and on a closed programme, no application count (Q5).
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

const form = async (id: string) =>
  (
    await query<{ applicant_types: string[]; questions: unknown; version: number }>(
      'SELECT applicant_types::text[] AS applicant_types, questions, version FROM programme_application_forms WHERE programme_id = $1',
      [id],
    )
  )[0]

const save = (page: Page) => page.locator('[data-action="save-registration"]')

test.describe('WF04-S05 registration (canonical form)', () => {
  test('configure: TEAM / STARTUP only, at least one type, saved as form version 1', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'registration'))
    await expect(page.locator('[data-state="registration-empty"]')).toBeVisible()
    await expect(page.locator('[data-application-counts]')).toHaveCount(0)
    await page.locator('[data-action="configure-registration"]').click()
    const types = await page
      .locator('input[name="applicant-type"]')
      .evaluateAll((i) => (i as HTMLInputElement[]).map((x) => x.value))
    expect(types).toEqual(['TEAM', 'STARTUP'])
    await expect(page.locator('[data-registration-editor]')).not.toContainText('Cá nhân')

    let puts = 0
    page.on('request', (r) => {
      if (r.method() === 'PUT') puts += 1
    })
    await save(page).click()
    await expect(page.locator('[data-error="applicant_types"]')).toBeVisible()
    expect(puts).toBe(0)

    const add = page.locator('[data-action="add-question"]')
    await expect(add).toBeDisabled()
    await expect(add).toHaveAttribute('title', 'Chưa thêm được câu hỏi mới trong bản này.')

    await page.locator('input[name="applicant-type"][value="STARTUP"]').check()
    await save(page).click()
    await expect(page.locator('[data-state="registration-saved"]')).toBeVisible()
    await expect(page.locator('[data-applicant-type="STARTUP"]')).toHaveText('Startup')
    expect(await form(programme.id)).toEqual({
      applicant_types: ['STARTUP'],
      questions: [],
      version: 1,
    })
    await page.reload()
    await expect(page.locator('[data-applicant-type="STARTUP"]')).toBeVisible()
  })

  test('editing keeps each question’s id, required and step; removing one bumps the version', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await call(page.request, 'put', `/${programme.id}/registration`, {
      applicant_types: ['TEAM', 'STARTUP'],
      questions: [
        { id: 'q-a', prompt: 'Câu A', required: true, step: 2 },
        { id: 'q-b', prompt: 'Câu B', required: false, step: 4 },
      ],
    })
    await page.goto(routes.setup(programme.id, 'registration'))
    await expect(page.locator('[data-question]')).toHaveText(['Câu A', 'Câu B'])
    await page.locator('[data-action="edit-registration"]').click()
    await page.locator('#rq-0').fill('Câu A (sửa)')
    await page.locator('[data-question-row="1"] [data-action="remove-question"]').click()
    await save(page).click()
    await expect(page.locator('[data-state="registration-saved"]')).toBeVisible()
    expect(await form(programme.id)).toEqual({
      applicant_types: ['TEAM', 'STARTUP'],
      questions: [{ id: 'q-a', prompt: 'Câu A (sửa)', required: true, step: 2 }],
      version: 2,
    })
  })

  test('once an application exists the form is read only (PO decision 3)', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await call(page.request, 'put', `/${programme.id}/registration`, {
      applicant_types: ['STARTUP'],
      questions: [{ id: 'q-a', prompt: 'Câu A', required: true, step: 1 }],
    })
    await call(page.request, 'post', `/${programme.id}/publish`)
    await page.context().clearCookies()
    await login(page.request, MEMBER)
    const applied = await page.request.post('/api/v1/applications', {
      data: { venture_id: SEED_VENTURE, programme_id: programme.id },
    })
    expect(applied.status(), await applied.text()).toBe(201)
    await page.context().clearCookies()
    await login(page.request, LEADER)
    await page.goto(routes.setup(programme.id, 'registration'))
    await expect(page.locator('[data-state="registration-locked"]')).toContainText(
      'Đã có hồ sơ đăng ký',
    )
    await expect(page.locator('[data-action="edit-registration"]')).toHaveCount(0)
    await expect(page.locator('[data-action="configure-registration"]')).toHaveCount(0)
    await expect(page.locator('[data-question]')).toHaveText(['Câu A'])
    expect((await form(programme.id))!.version).toBe(1)
  })

  test('a closed programme: read only, no configure or edit', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await call(page.request, 'post', `/${programme.id}/publish`)
    await call(page.request, 'post', `/${programme.id}/close`)
    await page.goto(routes.setup(programme.id, 'registration'))
    await expect(page.locator('[data-state="read-only"]')).toBeVisible()
    await expect(page.locator('[data-action="configure-registration"]')).toHaveCount(0)
    await expect(page.locator('[data-action="edit-registration"]')).toHaveCount(0)
  })

  test('768 / 390: no page overflow; the editor and "Lưu cấu hình" are reachable', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.setup(programme.id, 'registration'))
      await page.locator('[data-action="configure-registration"]').click()
      await expectNoOverflow(page, `${width}px`)
      await save(page).scrollIntoViewIfNeeded()
      await expect(save(page)).toBeInViewport()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s05-${width}.png`), fullPage: true })
    }
  })
})
