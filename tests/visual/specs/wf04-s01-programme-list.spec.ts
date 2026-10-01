import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'
import {
  ADMIN,
  CHAPTER_02,
  LEADER,
  SEED_CHALLENGE,
  SEED_PROGRAMME,
  call,
  cleanupProgrammes,
  clubWithLeader,
  createProgramme,
  expectNoOverflow,
  login,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S01 → WF04-PROD-04 — the Programme / Challenge list from
 * `GET /api/v1/programmes` (rewritten from the demo list spec, contract §17):
 * canonical rows in the actor's scope, loading / empty / error states, "Tạo
 * mới" availability (DEC-W4P-D13), refresh, responsive and the ADM5 primitives.
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

const rows = (page: Page) => page.locator('[data-programme-row]')
const row = (page: Page, id: string) => page.locator(`[data-programme-row="${id}"]`)

async function open(page: Page) {
  await page.goto(routes.list)
  await expect(page.locator('[data-state="list-loading"]')).toHaveCount(0)
}

test.describe('WF04-S01 list content (canonical rows)', () => {
  test('rows come from the database in the actor’s scope, with canonical labels', async ({
    page,
  }) => {
    await login(page.request, ADMIN)
    const foreign = await createProgramme(page.request, {
      organization_id: CHAPTER_02,
      name: 'Chương trình Chapter 02',
    })
    await page.context().clearCookies()
    await login(page.request, LEADER)
    const own = await createProgramme(page.request, {
      type: 'CHALLENGE',
      name: 'Thử thách danh sách',
      starts_at: '2026-11-01T00:00:00+07:00',
      ends_at: '2026-11-30T23:59:00+07:00',
    })
    await call(page.request, 'patch', `/${own.programme.id}`, {
      problem_statements: [{ title: 'Bài toán A' }, { title: 'Bài toán B' }],
    })
    await open(page)

    await expect(row(page, foreign.programme.id)).toHaveCount(0)
    const mine = row(page, own.programme.id)
    await expect(mine).toContainText('Thử thách danh sách')
    await expect(mine).toContainText('Chapter 01')
    await expect(mine).toContainText('Challenge')
    await expect(mine).toContainText('01/11/2026')
    await expect(mine.locator('[role="cell"]').nth(4)).toHaveText('2')
    await expect(mine.locator('[data-status]')).toHaveText('Bản nháp')
    await expect(row(page, SEED_PROGRAMME).locator('[data-status]')).toHaveText('Đang công khai')
    await expect(row(page, SEED_PROGRAMME).locator('[role="cell"]').nth(4)).toHaveText('—')
    await expect(row(page, SEED_CHALLENGE)).toBeVisible()
    await expect(page.locator('[data-demo-meta]')).toContainText('chương trình')

    // Refresh re-reads the same rows; nothing is merged from the browser.
    const before = await rows(page).allTextContents()
    await page.reload()
    await expect(rows(page)).toHaveText(before)

    await page.context().clearCookies()
    await login(page.request, ADMIN)
    await open(page)
    await expect(row(page, foreign.programme.id)).toContainText('Chapter 02')
  })

  test('a row opens the detail page; "Tạo mới" opens the create page', async ({ page }) => {
    await login(page.request, LEADER)
    await open(page)
    await row(page, SEED_CHALLENGE).locator('[data-nav="programme-detail"]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.detail(SEED_CHALLENGE)}$`))
    await page.goto(routes.list)
    await page.locator('[data-nav="programme-create"]').click()
    await expect(page).toHaveURL(/\/demo\/programmes\/new$/)
  })
})

test.describe('WF04-S01 states', () => {
  test('loading, then populated', async ({ page }) => {
    await login(page.request, LEADER)
    await page.route('**/api/v1/programmes', async (route) => {
      await new Promise((done) => setTimeout(done, 400))
      await route.continue()
    })
    await page.goto(routes.list)
    await expect(page.locator('[data-state="list-loading"]')).toBeVisible()
    await expect(row(page, SEED_PROGRAMME)).toBeVisible()
  })

  test('API error: a safe message and a retry that recovers', async ({ page }) => {
    await login(page.request, LEADER)
    let fail = true
    await page.route('**/api/v1/programmes', async (route) => {
      if (fail) {
        fail = false
        await route.fulfill({
          status: 500,
          body: '{"error":{"code":"X","message":"boom","request_id":"r"}}',
        })
      } else await route.continue()
    })
    await page.goto(routes.list)
    const failed = page.locator('[data-state="list-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).not.toContainText(/boom|500|request/)
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(row(page, SEED_PROGRAMME)).toBeVisible()
    // The one mocked 500 is the browser's own resource log, nothing else.
    const mocked = consoleErrors.filter((e) => /status of 500/.test(e))
    expect(mocked).toHaveLength(1)
    consoleErrors.splice(
      0,
      consoleErrors.length,
      ...consoleErrors.filter((e) => !mocked.includes(e)),
    )
  })

  test('empty: a leader whose organization has no programme sees the scoped empty state', async ({
    page,
  }) => {
    const club = await clubWithLeader()
    await login(page.request, club.leader)
    await open(page)
    await expect(page.locator('[data-state="list-empty"]')).toBeVisible()
    await expect(page.locator('[data-nav="programme-create"]')).toBeVisible()
  })

  test('"Tạo mới" is unavailable when every organization of the actor is ARCHIVED', async ({
    page,
  }) => {
    const club = await clubWithLeader()
    await login(page.request, club.leader)
    const existing = await createProgramme(page.request, {
      organization_id: club.id,
      name: 'Chương trình CLB lưu trữ',
    })
    await club.archive()
    await open(page)
    await expect(row(page, existing.programme.id)).toBeVisible()
    const create = page.locator('[data-demo-create]')
    await expect(create).toBeDisabled()
    await expect(create).toHaveAttribute('data-nav-kind', 'INERT')
    await expect(page.locator('[data-nav="programme-create"]')).toHaveCount(0)
  })
})

test.describe('WF04-S01 responsive and visual QA', () => {
  test('768 / 390: no page overflow; the table stays reachable', async ({ page }) => {
    await login(page.request, LEADER)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page)
      await expectNoOverflow(page, `${width}px`)
      await row(page, SEED_PROGRAMME).scrollIntoViewIfNeeded()
      await expect(row(page, SEED_PROGRAMME)).toBeVisible()
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s01-${width}.png`), fullPage: true })
    }
  })

  test('1440×900: typography; table card, head, row rule and pills match ADM5', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await open(page)
    await settle(page)
    const typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s01-1440x900.png') })
    const actual = decodePng(await page.screenshot())
    const reference = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const table = (await page.locator('[data-programme-table]').boundingBox())!
    const accent = (await row(page, SEED_PROGRAMME).locator('[data-status]').boundingBox())!
    const neutral = (await row(page, SEED_CHALLENGE).locator('[data-status]').boundingBox())!
    const tx = Math.round(table.x) - 248
    const ty = Math.round(table.y) - 99
    const ax = Math.round(accent.x)
    const ay = Math.round(accent.y)
    const nx = Math.round(neutral.x)
    const ny = Math.round(neutral.y)
    expect(accent.x + accent.width).toBeLessThanOrEqual(table.x + table.width - 8)
    // RASTER-NOISE: ADM5 pill corners sit on half pixels; the curves are masked.
    const raster: Rect[] = [
      { x: ax, y: ay, width: 9, height: 7 },
      { x: ax, y: ay + 14, width: 9, height: 8 },
      { x: nx, y: ny, width: 9, height: 7 },
      { x: nx, y: ny + 14, width: 9, height: 8 },
    ]
    const texts = await page.evaluate(() => {
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
      [...texts, ...raster],
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
          class: 'INTENTIONAL',
          reason:
            'DEC-WF04-H1 / S01-D3: composed from ADM5 primitives; WF04-PROD-04 removes the demo notice (contract §16), so the table sits directly under the header; rows are canonical data; pixel reference method is contract Q9 (PROD-06)',
        },
      ],
      typography,
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
