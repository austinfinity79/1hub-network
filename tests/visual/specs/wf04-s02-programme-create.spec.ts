import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'
import {
  ADMIN,
  CHAPTER_01,
  LEADER,
  auditActions,
  cleanupProgrammes,
  clubWithLeader,
  expectNoOverflow,
  login,
  programmeRow,
  routes,
  track,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S02 → WF04-PROD-04 — create through `POST /api/v1/programmes`
 * (rewritten from the demo create spec, contract §17): one DRAFT row and one
 * audit event, client and server validation, one row per double click
 * (Idempotency-Key), owner options from the server (never ARCHIVED,
 * DEC-W4P-D13), safe refusals, responsive and the approved primitives.
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

const save = (page: Page) => page.locator('[data-demo-save]')

async function openCreate(page: Page) {
  await page.goto(routes.create)
  await expect(page.locator('[data-programme-form]')).toBeVisible()
}

async function fill(
  page: Page,
  values: { type?: string; name?: string; summary?: string; start?: string; end?: string },
) {
  if (values.type) await page.getByRole('radio', { name: values.type, exact: true }).check()
  if (values.name !== undefined) await page.getByLabel('Tên', { exact: true }).fill(values.name)
  if (values.summary !== undefined)
    await page.getByLabel('Tóm tắt', { exact: true }).fill(values.summary)
  if (values.start !== undefined) await page.getByLabel('Ngày bắt đầu').fill(values.start)
  if (values.end !== undefined) await page.getByLabel('Ngày kết thúc').fill(values.end)
}

const idFrom = (page: Page) => new URL(page.url()).pathname.split('/')[3]!

test.describe('WF04-S02 create (canonical row)', () => {
  test('a PROGRAMME is created as a DRAFT row of the leader’s organization, audited, then the journey opens', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await openCreate(page)
    await expect(page.locator('#pc-owner')).toHaveText('Chapter 01')
    await fill(page, {
      type: 'Chương trình',
      name: '  Ươm tạo mùa thu  ',
      summary: 'Ba tháng đồng hành.',
      start: '2026-10-01',
      end: '2026-12-31',
    })
    await save(page).click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    const id = idFrom(page)
    track(id)
    await expect(page.locator('[data-state="flash"]')).toContainText(
      'Đã tạo bản nháp “Ươm tạo mùa thu”.',
    )

    const row = await programmeRow(id)
    expect(row).toMatchObject({
      status: 'DRAFT',
      name: 'Ươm tạo mùa thu',
      summary: 'Ba tháng đồng hành.',
    })
    expect(row!.starts_at!.toISOString()).toBe('2026-09-30T17:00:00.000Z')
    expect(row!.ends_at!.toISOString()).toBe('2026-12-31T16:59:00.000Z')
    expect(await auditActions(id)).toEqual(['PROGRAMME_CREATED'])
    const [owner] = await query<{ organization_id: string; programme_type: string }>(
      'SELECT organization_id::text, programme_type::text FROM programmes WHERE id = $1',
      [id],
    )
    expect(owner).toEqual({ organization_id: CHAPTER_01, programme_type: 'PROGRAMME' })

    // Refresh and a direct route load the persisted row.
    await page.reload()
    await expect(page.locator('[data-screen="WF04-S03"] h1')).toHaveText('Ươm tạo mùa thu')
    await page.goto(routes.list)
    await expect(page.locator(`[data-programme-row="${id}"]`)).toBeVisible()
  })

  test('validation: required fields and date order are checked before any request', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await openCreate(page)
    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/v1/programmes')) posts += 1
    })
    await save(page).click()
    await expect(page.locator('[data-error="type"]')).toBeVisible()
    await expect(page.locator('[data-error="name"]')).toBeVisible()
    await fill(page, { type: 'Challenge', name: '   ', start: '2026-12-02', end: '2026-12-01' })
    await save(page).click()
    await expect(page.locator('[data-error="name"]')).toBeVisible()
    await expect(page.locator('[data-error="dates"]')).toContainText(
      'Ngày kết thúc phải từ ngày bắt đầu',
    )
    await fill(page, { name: 'Đã sửa', end: '2026-12-03' })
    await expect(page.locator('[data-error="name"]')).toHaveCount(0)
    expect(posts).toBe(0)
    await expect(page).toHaveURL(/\/new$/)
  })

  test('a double click creates exactly one programme', async ({ page }) => {
    await login(page.request, LEADER)
    await openCreate(page)
    const name = `Nhấp đúp ${Date.now()}`
    await fill(page, { type: 'Challenge', name })
    await save(page).dblclick()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    track(idFrom(page))
    const [count] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM programmes WHERE name = $1',
      [name],
    )
    expect(count!.n).toBe(1)
  })

  test('a refused or failed create shows a safe message, writes nothing, and a retry creates once', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await openCreate(page)
    const name = `Thử lại ${Date.now()}`
    await fill(page, { type: 'Chương trình', name })
    let answer: 409 | 500 | null = 409
    await page.route('**/api/v1/programmes', async (route) => {
      if (route.request().method() === 'POST' && answer) {
        const status = answer
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'X', message: 'internal detail', request_id: 'req_x' },
          }),
        })
      } else await route.continue()
    })
    await save(page).click()
    await expect(page.locator('[data-state="save-failed"]')).toContainText(
      'Chưa tạo được chương trình cho đơn vị này.',
    )
    answer = 500
    await save(page).click()
    await expect(page.locator('[data-state="save-failed"]')).toContainText(
      'Chưa lưu được bản nháp. Vui lòng thử lại.',
    )
    await expect(page.locator('main')).not.toContainText('internal detail')
    const [none] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM programmes WHERE name = $1',
      [name],
    )
    expect(none!.n).toBe(0)
    answer = null
    await save(page).click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    track(idFrom(page))
    const [one] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM programmes WHERE name = $1',
      [name],
    )
    expect(one!.n).toBe(1)
    // The mocked 500 is the browser's own resource log (4xx logs are ignored).
    const mocked = consoleErrors.filter((e) => /status of 500/.test(e))
    expect(mocked).toHaveLength(1)
    consoleErrors.splice(
      0,
      consoleErrors.length,
      ...consoleErrors.filter((e) => !mocked.includes(e)),
    )
  })
})

test.describe('WF04-S02 owner options (server scope, DEC-W4P-D13)', () => {
  test('platform admin chooses among active HUB / CHAPTER / CLB only', async ({ page }) => {
    const club = await clubWithLeader()
    const archived = await clubWithLeader()
    await archived.archive()
    const [company] = await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE type::text NOT IN ('HUB', 'CHAPTER', 'CLB') LIMIT 1`,
    )
    await login(page.request, ADMIN)
    await openCreate(page)
    const options = await page
      .locator('#pc-owner option')
      .evaluateAll((o) => (o as HTMLOptionElement[]).map((x) => x.value).filter(Boolean))
    expect(options).toContain(CHAPTER_01)
    expect(options).toContain(club.id)
    expect(options).not.toContain(archived.id)
    if (company) expect(options).not.toContain(company.id)
  })

  test('a leader whose only organization is ARCHIVED sees the unavailable state; nothing can be saved', async ({
    page,
  }) => {
    const club = await clubWithLeader()
    await club.archive()
    await login(page.request, club.leader)
    await openCreate(page)
    await expect(page.locator('[data-state="no-owner"]')).toBeVisible()
    await expect(save(page)).toBeDisabled()
  })
})

test.describe('WF04-S02 responsive and visual QA', () => {
  test('768 / 390: no page overflow; fields and "Lưu" reachable', async ({ page }) => {
    await login(page.request, LEADER)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await openCreate(page)
      await expectNoOverflow(page, `${width}px`)
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

  test('1440×900: typography; input and header match the approved sources', async ({ page }) => {
    await login(page.request, LEADER)
    await openCreate(page)
    await settle(page)
    await fill(page, {
      type: 'Challenge',
      name: 'Thử thách mẫu',
      summary: 'Tóm tắt.',
      start: '2026-10-01',
      end: '2026-12-31',
    })
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
    const mask: Rect[] = await page.evaluate(() => {
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
          class: 'INTENTIONAL',
          reason:
            'DEC-WF04-H1 / S02-D1: WF02-S02/S05 field language; WF04-PROD-04 removes the demo notice (contract §16); pixel reference method is contract Q9 (PROD-06)',
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
