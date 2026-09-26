import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF03-S02 — organization dashboard (/ops/org/:orgId).
 * API 05 §8.2; DEC-WF03-G1/G11/G15; DEC-WF03-S02-D1..D3.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const dashboardApi = (id: string) => `/api/v1/ops/organizations/${id}/dashboard`

let consoleErrors: string[] = []
const orgs: string[] = []
const profiles: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [orgs])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function relationsOnly() {
  const email = `s02-rel-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'S02', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  profiles.push(p!.id)
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED')`,
    [p!.id, CHAPTER_01],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Trưởng chapter', 'ACTIVE')`,
    [p!.id, CHAPTER_01],
  )
  return email
}

const metric = (page: Page, key: string) => page.locator(`[data-metric="${key}"] [data-value]`)

test.describe('WF03-S02 access and scope', () => {
  test('1/2/7/8. guest → /auth; member and membership + title alone → 404 / 403', async ({
    page,
    request,
  }) => {
    await page.goto(`/ops/org/${CHAPTER_01}`)
    await expect(page).toHaveURL('/auth')
    expect((await request.get(dashboardApi(CHAPTER_01))).status()).toBe(401)
    for (const email of ['member@example.test', await relationsOnly()]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(`/ops/org/${CHAPTER_01}`))?.status(), email).toBe(404)
      const r = await page.request.get(dashboardApi(CHAPTER_01))
      expect(r.status()).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
  })

  test('3/4/6/9/10. leader: own dashboard with canonical counts; foreign, child and spoofed ids refused', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}`, { waitUntil: 'networkidle' })
    const api = await (await page.request.get(dashboardApi(CHAPTER_01))).json()
    for (const key of [
      'active_members',
      'pending_memberships',
      'active_leaders',
      'published_events',
    ]) {
      await expect(metric(page, key)).toHaveText(String(api.summary[key]))
    }
    await expect(page.locator('[data-metric="active_members"]')).toContainText(
      `${api.summary.child_organizations} tổ chức trực thuộc`,
    )
    const work = page.locator('[data-work-item="pending_memberships"]')
    await expect(work).toContainText(
      `${api.summary.pending_memberships} yêu cầu thành viên chờ duyệt`,
    )
    await expect(work.getByRole('link', { name: 'Làm ngay' })).toHaveAttribute(
      'href',
      `/ops/org/${CHAPTER_01}/members`,
    )
    // No identities anywhere on the page or in the DTO.
    expect(await page.locator('main').innerText()).not.toMatch(/@|pending@|Demo Leader/)
    expect(JSON.stringify(api)).not.toMatch(/@|profile|email|metadata|programme/i)
    // Foreign / child / parent / malformed: page 404, API 403, whatever the headers say.
    for (const id of [CHAPTER_02, CLUB_01, HUB, 'sample-org']) {
      expect((await page.goto(`/ops/org/${id}`))?.status(), id).toBe(404)
      const r = await page.request.get(dashboardApi(id), { headers: { 'x-org-id': CHAPTER_01 } })
      expect(r.status(), id).toBe(403)
    }
    const spoof = await page.request.get(`${dashboardApi(CHAPTER_02)}?orgId=${CHAPTER_01}`)
    expect(spoof.status()).toBe(403)
  })

  test('5. platform admin: any operational organization', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    expect((await page.goto(`/ops/org/${CLUB_01}`, { waitUntil: 'networkidle' }))?.status()).toBe(
      200,
    )
    await expect(page.locator('[data-screen="WF03-S02"] h1')).toHaveText('Club 01')
    expect((await page.request.get(dashboardApi(HUB))).status()).toBe(200)
  })
})

test.describe('WF03-S02 states', () => {
  test('zero state: a new organization shows zeros and no work item', async ({ page }) => {
    const [row] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S02 Empty Club', 'DRAFT') RETURNING id::text`,
      [`s02-empty-${Date.now()}`],
    )
    orgs.push(row!.id)
    await login(page.request, 'ops@example.test')
    await page.goto(`/ops/org/${row!.id}`, { waitUntil: 'networkidle' })
    for (const key of [
      'active_members',
      'pending_memberships',
      'active_leaders',
      'published_events',
    ]) {
      await expect(metric(page, key)).toHaveText('0')
    }
    await expect(page.locator('[data-state="work-empty"]')).toBeVisible()
  })

  test('error: neutral message; retry reloads the canonical dashboard', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await page.route('**/api/v1/ops/organizations/*/dashboard', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.goto(`/ops/org/${CHAPTER_01}`, { waitUntil: 'networkidle' })
    const failed = page.locator('[data-state="dashboard-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).not.toContainText(/500|UNCONTRACTED|request/i)
    await page.unroute('**/api/v1/ops/organizations/*/dashboard')
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(metric(page, 'active_members')).toHaveText(/^\d+$/)
  })
})

test.describe('WF03-S02 pixel QA', () => {
  test('components against the approved reference (drawn without a sidebar)', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S02')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S02')!, {
      afterLoad: async (p) => {
        await expect(p.locator('[data-work-item="pending_memberships"]')).toBeVisible()
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    // Below the 782px reference only the OpsShell sidebar continues (T00-D1).
    const bbox = full.below_reference!.unexpected_bbox
    if (bbox) expect(bbox.x + bbox.width, 'UI below the reference').toBeLessThanOrEqual(216)

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const kpi = (await page.locator('[data-metric="active_members"]').boundingBox())!
    const work = (await page.locator('[data-card="work"]').boundingBox())!
    const chip = (await page.locator('[data-work-item] span').first().boundingBox())!
    const act = (await page.getByRole('link', { name: 'Làm ngay' }).boundingBox())!
    const textMask: Rect[] = await page.evaluate(() => {
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
    const dx = 216
    const kpiDy = Math.round(kpi.y) - 236
    const workDy = Math.round(work.y) - 403
    const chipDx = Math.round(chip.x) - 729
    const chipDy = Math.round(chip.y) - 461
    const actDx = Math.round(act.x) - 830
    const actDy = Math.round(act.y) - 457
    // Reference text boxes (in reference coordinates), shifted like their segment.
    const REF = {
      header: [{ x: 44, y: 18, width: 300, height: 48 }],
      kpi: [
        { x: 66, y: 254, width: 150, height: 18 },
        { x: 66, y: 290, width: 60, height: 32 },
        { x: 66, y: 338, width: 150, height: 22 },
      ],
      work: [
        { x: 68, y: 423, width: 120, height: 22 },
        { x: 68, y: 455, width: 320, height: 42 },
      ],
      chip: [{ x: 740, y: 466, width: 64, height: 18 }],
      act: [{ x: 842, y: 466, width: 72, height: 18 }],
    }
    const shift = (rects: Rect[], x: number, y: number) =>
      rects.map((r) => ({ ...r, x: r.x + x, y: r.y + y }))
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header-band', reference: { x: 0, y: 0, width: 700, height: 90 }, dy: 0, dx },
        { name: 'kpi-card', reference: { x: 44, y: 232, width: 250, height: 151 }, dy: kpiDy, dx },
        {
          name: 'work-card-head',
          reference: { x: 44, y: 399, width: 420, height: 104 },
          dy: workDy,
          dx,
        },
        {
          name: 'chip',
          reference: { x: 725, y: 457, width: 93, height: 36 },
          dy: chipDy,
          dx: chipDx,
        },
        {
          name: 'button',
          reference: { x: 826, y: 453, width: 105, height: 44 },
          dy: actDy,
          dx: actDx,
        },
      ],
      [
        ...textMask,
        ...shift(REF.header, dx, 0),
        ...shift(REF.kpi, dx, kpiDy),
        ...shift(REF.work, dx, workDy),
        ...shift(REF.chip, chipDx, chipDy),
        ...shift(REF.act, actDx, actDy),
      ],
      { diffPath: resolveOutputPath('diff', 'WF03-S02.segments.diff.png') },
    )
    writeJsonReport('WF03-S02.segments.json', {
      screen_id: 'WF03-S02',
      state: qaConfigFor('WF03-S02')!.state,
      offsets: { dx, kpiDy, workDy, chipDx, chipDy, actDx, actDy },
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-G15: OpsShell sidebar; the reference is drawn full-width, so the frame is compared per component with offsets and card widths follow the narrower content area',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 0, y: 84, width: 1440, height: 129 },
          reason:
            'DEC-WF03-G1: capability chip bar and the enterprise scope notice are not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-G1 / S02-D1: KPI cards carry canonical aggregates (Thành viên, Yêu cầu chờ duyệt, Ban điều hành, Sự kiện đã công khai); enterprise KPIs have no P0 source',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 972, y: 403, width: 420, height: 252 },
          reason: 'Pilot card (WF04 / WF05) not rendered; the work card spans the content width',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'One canonical work item (pending membership requests); the drawn enterprise items have no P0 source',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
