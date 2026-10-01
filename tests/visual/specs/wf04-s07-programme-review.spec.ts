import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  CHAPTER_01,
  LEADER,
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
