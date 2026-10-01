import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  CHAPTER_01,
  LEADER,
  adm5Primitives,
  SEED_PROGRAMME,
  auditActions,
  call,
  cleanupProgrammes,
  clubWithLeader,
  createProgramme,
  expectNoOverflow,
  login,
  programmeRow,
  routes,
  track,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S07 → WF04-PROD-04 — review and publish through
 * `POST /api/v1/programmes/{id}/publish` (rewritten from the demo review spec,
 * contract §17). The checklist is contract §8 only (name, type, owner, dates):
 * no "CHALLENGE needs a problem" rule (Q7, DEC-W4P-D12). One publish per
 * intent (Idempotency-Key), a conflict re-reads the programme, an ARCHIVED
 * owner cannot publish (DEC-W4P-D13).
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

const publish = (page: Page) => page.locator('[data-action="publish"]')
const checks = (page: Page) =>
  page
    .locator('[data-check]')
    .evaluateAll((items) =>
      items.map((i) => [i.getAttribute('data-check'), i.getAttribute('data-ok')]),
    )

test.describe('WF04-S07 checklist and publish', () => {
  test('a bare CHALLENGE draft is ready: four checks, no problem rule; publish persists and opens the detail', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, {
      type: 'CHALLENGE',
      name: 'Xuất bản thật',
    })
    await page.goto(routes.setup(programme.id, 'review'))
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'true'],
    ])
    await expect(page.locator('[data-review-checklist]')).not.toContainText('bài toán')
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'ready',
    )
    await expect(page.locator('main')).not.toContainText('bản demo')
    await publish(page).click()
    await expect(page).toHaveURL(new RegExp(`${routes.detail(programme.id)}$`))
    await expect(page.locator('[data-state="flash"]')).toContainText('Đã xuất bản “Xuất bản thật”.')
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    expect((await programmeRow(programme.id))!.status).toBe('PUBLISHED')
    expect(await auditActions(programme.id)).toEqual(['PROGRAMME_CREATED', 'PROGRAMME_PUBLISHED'])
  })

  test('a double click publishes once', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'review'))
    await publish(page).dblclick()
    await expect(page).toHaveURL(new RegExp(`${routes.detail(programme.id)}$`))
    expect(
      (await auditActions(programme.id)).filter((a) => a === 'PROGRAMME_PUBLISHED'),
    ).toHaveLength(1)
  })

  test('a PUBLISHED programme offers no publish; its review shows the published state', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await page.goto(routes.setup(SEED_PROGRAMME, 'review'))
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    await expect(publish(page)).toHaveCount(0)
    await expect(page.locator('[data-nav="review-detail"]')).toBeVisible()
  })

  test('a blank name fails its check and publish stays disabled', async ({ page }) => {
    const [row] = await query<{ id: string }>(
      `INSERT INTO programmes (organization_id, programme_type, slug, name) VALUES ($1, 'PROGRAMME', $2, '   ') RETURNING id::text`,
      [CHAPTER_01, `wf04-s07-blank-${Date.now()}`],
    )
    track(row!.id)
    await login(page.request, LEADER)
    await page.goto(routes.setup(row!.id, 'review'))
    await expect(page.locator('[data-check="name"]')).toHaveAttribute('data-ok', 'false')
    await expect(page.locator('[data-fix="name"]')).toBeVisible()
    await expect(publish(page)).toBeDisabled()
    expect((await programmeRow(row!.id))!.status).toBe('DRAFT')
  })

  test('an ARCHIVED owner: read only, owner check fails, publish disabled (DEC-W4P-D13)', async ({
    page,
  }) => {
    const club = await clubWithLeader()
    await login(page.request, club.leader)
    const { programme } = await createProgramme(page.request, { organization_id: club.id })
    await club.archive()
    await page.goto(routes.setup(programme.id, 'review'))
    await expect(page.locator('[data-state="read-only"]')).toContainText(
      'Đơn vị chủ trì đã ngừng hoạt động',
    )
    await expect(page.locator('[data-check="owner"]')).toHaveAttribute('data-ok', 'false')
    await expect(publish(page)).toBeDisabled()
    expect((await programmeRow(programme.id))!.status).toBe('DRAFT')
  })

  test('published elsewhere: the click is a conflict, the screen re-reads the programme', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'review'))
    await call(page.request, 'post', `/${programme.id}/publish`)
    await publish(page).click()
    await expect(page.locator('[data-state="save-conflict"]')).toBeVisible()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    expect(
      (await auditActions(programme.id)).filter((a) => a === 'PROGRAMME_PUBLISHED'),
    ).toHaveLength(1)
  })
})

test.describe('WF04-S07 responsive and typography', () => {
  test('768 / 390 without overflow; 1440 typography', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { type: 'CHALLENGE' })
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.setup(programme.id, 'review'))
      await expectNoOverflow(page, `${width}px`)
      await publish(page).scrollIntoViewIfNeeded()
      await expect(publish(page)).toBeInViewport()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s07-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(routes.setup(programme.id, 'review'))
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s07-1440x900.png'), fullPage: true })
  })
})

test.describe('WF04-S07 restored coverage (WF04-PROD-04-FIX)', () => {
  test('the summary reflects the programme: basic, journey, problems, events, registration, team', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, {
      type: 'CHALLENGE',
      name: 'Rà soát đầy đủ',
      summary: 'Tóm tắt rà soát.',
      starts_at: '2026-11-01T00:00:00+07:00',
      ends_at: '2026-12-15T23:59:00+07:00',
    })
    await call(page.request, 'patch', `/${programme.id}`, {
      stages: [{ name: 'Ươm tạo' }, { name: 'Demo day' }],
      problem_statements: [{ title: 'Bài toán rà soát' }],
    })
    await call(page.request, 'put', `/${programme.id}/registration`, {
      applicant_types: ['STARTUP'],
      questions: [{ id: 'q-a', prompt: 'Vấn đề?', required: true, step: 1 }],
    })
    await page.goto(routes.setup(programme.id, 'review'))
    const row = (key: string) => page.locator(`[data-review="${key}"]`)
    await expect(row('basic')).toContainText('Challenge · Rà soát đầy đủ')
    await expect(row('basic')).toContainText('Chapter 01')
    await expect(row('basic')).toContainText('01/11/2026 – 15/12/2026')
    await expect(row('basic')).toContainText('Tóm tắt rà soát.')
    await expect(row('journey')).toContainText('2 giai đoạn')
    await expect(row('journey')).toContainText('Demo day')
    await expect(row('problems')).toContainText('Bài toán rà soát')
    await expect(row('events')).toContainText('0 sự kiện')
    await expect(row('registration')).toContainText('Startup · 1 câu hỏi riêng')
    await expect(row('team')).toContainText('0 thành viên')
    await row('journey').locator('[data-edit="journey"]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(programme.id, 'journey')}$`))
  })

  test('a failed publish keeps DRAFT; "Thử lại" publishes once with the same key', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'review'))
    let fail = true
    const keys: (string | null)[] = []
    await page.route(`**/api/v1/programmes/${programme.id}/publish`, async (route) => {
      keys.push(route.request().headers()['idempotency-key'] ?? null)
      if (fail) {
        fail = false
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"error":{"code":"X","message":"m","request_id":"r"}}',
        })
      } else await route.continue()
    })
    await publish(page).click()
    await expect(page.locator('[data-state="save-failed"]')).toBeVisible()
    expect((await programmeRow(programme.id))!.status).toBe('DRAFT')
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    expect((await programmeRow(programme.id))!.status).toBe('PUBLISHED')
    expect(
      (await auditActions(programme.id)).filter((a) => a === 'PROGRAMME_PUBLISHED'),
    ).toHaveLength(1)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])
    const mocked = consoleErrors.filter((e) => /status of 500/.test(e))
    expect(mocked).toHaveLength(1)
    consoleErrors.splice(
      0,
      consoleErrors.length,
      ...consoleErrors.filter((e) => !mocked.includes(e)),
    )
  })

  test('1440×900 ready, incomplete and published: ADM5 primitives', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, { type: 'CHALLENGE' })
    await page.goto(routes.setup(programme.id, 'review'))
    await adm5Primitives(
      page,
      'WF04-S07',
      'ready',
      '[data-review-summary]',
      '[data-review="basic"]',
    )
    const [blank] = await query<{ id: string }>(
      `INSERT INTO programmes (organization_id, programme_type, slug, name) VALUES ($1, 'PROGRAMME', $2, '   ') RETURNING id::text`,
      [CHAPTER_01, `wf04-s07-vis-${Date.now()}`],
    )
    track(blank!.id)
    await page.goto(routes.setup(blank!.id, 'review'))
    await adm5Primitives(
      page,
      'WF04-S07',
      'incomplete',
      '[data-review-summary]',
      '[data-review="basic"]',
    )
    await page.goto(routes.setup(SEED_PROGRAMME, 'review'))
    await adm5Primitives(
      page,
      'WF04-S07',
      'published',
      '[data-review-summary]',
      '[data-review="basic"]',
    )
  })
})
