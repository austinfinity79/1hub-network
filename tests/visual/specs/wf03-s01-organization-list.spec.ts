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
 * WF03-S01 — ops organization selector / list (/ops/network).
 * DEC-WF03-G8/G11/G15, DEC-WF03-T00-D1..D3, DEC-WF03-S01-D1.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const PIXEL_ORG = 'e7000000-0000-0000-0000-000000000001'

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
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    profiles,
  ])
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query(
    'DELETE FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[])',
    [orgs],
  )
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [orgs])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function org(type: string, name: string) {
  const slug = `s01-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [row] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ($1, $2, $3, 'PUBLISHED') RETURNING id::text`,
    [type, slug, name],
  )
  orgs.push(row!.id)
  return row!.id
}

/** An onboarded person; optionally a leader of `leaderOf`, with membership + title in `tiesTo`. */
async function person(opts: { leaderOf?: string; tiesTo?: string }) {
  const email = `s01-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'S01', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  profiles.push(p!.id)
  if (opts.leaderOf) {
    await query(
      `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $2, 'ACTIVE')`,
      [p!.id, opts.leaderOf],
    )
  }
  if (opts.tiesTo) {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED')`,
      [p!.id, opts.tiesTo],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Trưởng chapter', 'ACTIVE')`,
      [p!.id, opts.tiesTo],
    )
  }
  return email
}

const rows = (page: Page) => page.locator('[data-org-row]')

test.describe('WF03-S01 access', () => {
  test('1/2/8/9. guest → /auth; member, and membership + leadership title alone → 404', async ({
    page,
  }) => {
    await page.goto('/ops/network')
    await expect(page).toHaveURL('/auth')
    await login(page.request, 'member@example.test')
    expect((await page.goto('/ops/network'))?.status()).toBe(404)
    await page.context().clearCookies()
    await login(page.request, await person({ tiesTo: CHAPTER_01 }))
    expect((await page.goto('/ops/network'))?.status()).toBe(404)
  })

  test('3/4/10. leader: exactly the assigned Chapter, no child CLB, no PII', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    await expect(rows(page)).toHaveCount(1)
    const row = page.locator(`[data-org-row="${CHAPTER_01}"]`)
    await expect(row.getByRole('cell')).toHaveText([
      'Chapter 01',
      'HUB Network',
      /^\d+$/,
      'Chapter',
      'Đang công khai',
    ])
    await expect(page.locator(`[data-org-row="${CLUB_01}"]`)).toHaveCount(0)
    await expect(page.locator('[data-count]')).toHaveText('1 tổ chức')
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/@|HUB_COMMUNITY_LEADER|role|scope/i)
  })

  test('5. platform admin: every HUB / CHAPTER / CLB, never COMPANY / FUND / PARTNER', async ({
    page,
  }) => {
    const company = await org('COMPANY', 'S01 Company')
    const fund = await org('FUND', 'S01 Fund')
    await login(page.request, 'ops@example.test')
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    for (const id of [HUB, CHAPTER_01, CHAPTER_02, CLUB_01]) {
      await expect(page.locator(`[data-org-row="${id}"]`)).toHaveCount(1)
    }
    for (const id of [company, fund]) {
      await expect(page.locator(`[data-org-row="${id}"]`)).toHaveCount(0)
    }
    await expect(page.locator(`[data-org-row="${CLUB_01}"] [role="cell"]`).nth(1)).toHaveText(
      'Chapter 01',
    )
  })
})

test.describe('WF03-S01 selection and context', () => {
  test('selecting opens the org context; spoofed context grants nothing downstream', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    // Spoof attempts on the list itself: query, storage, header.
    await page.goto(`/ops/network?orgId=${CHAPTER_02}&scope=${HUB}`, { waitUntil: 'networkidle' })
    await page.evaluate((id) => localStorage.setItem('ops.org', id), CHAPTER_02)
    await expect(rows(page)).toHaveCount(1)
    await page.getByRole('link', { name: 'Chapter 01' }).click()
    await expect(page).toHaveURL(`/ops/org/${CHAPTER_01}`)
    await expect(page.locator(`[data-org-context="${CHAPTER_01}"]`)).toContainText('Chapter 01')
    // 6/7. Direct URL to a foreign or child organization stays denied.
    for (const id of [CHAPTER_02, CLUB_01, HUB]) {
      expect((await page.goto(`/ops/org/${id}`))?.status(), id).toBe(404)
    }
    const api = await page.request.get('/api/v1/ops/organizations', {
      headers: { 'x-org-id': CHAPTER_02 },
    })
    expect((await api.json()).items.map((i: { id: string }) => i.id)).toEqual([CHAPTER_01])
  })
})

test.describe('WF03-S01 states', () => {
  test('empty: an in-scope actor whose only scope is non-operational sees the empty state', async ({
    page,
  }) => {
    const company = await org('COMPANY', 'S01 Only Company')
    await login(page.request, await person({ leaderOf: company }))
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="list-empty"]')).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
    await expect(page.locator('[data-count]')).toHaveText('0 tổ chức')
  })

  test('error: a failed request shows a neutral message; retry reloads the canonical list', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.route('**/api/v1/ops/organizations*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    const failed = page.locator('[data-state="list-failed"]')
    await expect(failed).toBeVisible()
    await expect(failed).not.toContainText(/500|UNCONTRACTED|request/i)
    await page.unroute('**/api/v1/ops/organizations*')
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(rows(page)).toHaveCount(1)
  })
})

test.describe('WF03-S01 pixel QA', () => {
  test.afterAll(async () => {
    await query('DELETE FROM organizations WHERE id = $1', [PIXEL_ORG])
  })

  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S01')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S01')!, {
      // Test-only fifth operational organization, so the table has the drawn 5 rows.
      beforeNavigate: async (p) => {
        await query(
          `INSERT INTO organizations (id, type, slug, name, status) VALUES ($1, 'CLB', 's01-pixel-club', 'Club QA', 'PUBLISHED') ON CONFLICT (id) DO NOTHING`,
          [PIXEL_ORG],
        )
        // The board draws the fixture units only: the canonical catalogue's 68 units
        // (S1-UAT-03, Appendix E) are left out of this capture's list, never the DB.
        const catalogue = new Set(
          (
            await query<{ id: string }>(
              `SELECT id::text FROM organizations WHERE metadata->>'catalog' = 'S1_APPENDIX_E' AND type <> 'HUB'`,
            )
          ).map((r) => r.id),
        )
        await p.route('**/api/v1/ops/organizations*', async (route) => {
          const response = await route.fetch()
          const body = await response.json()
          body.items = body.items.filter((item: { id: string }) => !catalogue.has(item.id))
          await route.fulfill({ response, json: body })
        })
      },
      afterLoad: async (p) => {
        await expect(rows(p)).toHaveCount(5)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    // Below the 550px reference only the OpsShell sidebar continues; it differs
    // from the drawn ADM sidebar colour by design (DEC-WF03-T00-D1). The content
    // area must be pure canvas continuation.
    const below = full.below_reference!
    if (below.unexpected_bbox) {
      expect(
        below.unexpected_bbox.x + below.unexpected_bbox.width,
        'UI below the reference',
      ).toBeLessThanOrEqual(216)
      const shot = decodePng(await page.screenshot({ fullPage: true, animations: 'disabled' }))
      for (const y of [600, 750, 890]) {
        const i = (y * shot.width + 100) * 4
        expect([shot.data[i], shot.data[i + 1], shot.data[i + 2]], `sidebar at y ${y}`).toEqual([
          30, 4, 8,
        ])
      }
    }

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
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
    // Reference text: title, subtitle, header labels, row cells.
    const REF_TEXT: Rect[] = [
      { x: 244, y: 18, width: 180, height: 42 },
      { x: 262, y: 108, width: 1000, height: 18 },
      ...[158, 202, 246, 290, 334].map((y) => ({ x: 262, y: y - 10, width: 1100, height: 20 })),
    ]
    // INTENTIONAL-P0-SCOPE: "Tạo chapter" (no create API, G8).
    const CREATE: Rect = { x: 1300, y: 16, width: 112, height: 44 }
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header-band', reference: { x: 216, y: 0, width: 1224, height: 90 }, dy: 0 },
        { name: 'org-table', reference: { x: 216, y: 90, width: 1224, height: 272 }, dy: 0 },
      ],
      [...textMask, ...REF_TEXT, CREATE],
      { diffPath: resolveOutputPath('diff', 'WF03-S01.segments.diff.png') },
    )
    writeJsonReport('WF03-S01.segments.json', {
      screen_id: 'WF03-S01',
      state: qaConfigFor('WF03-S01')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reference_region: { x: 0, y: 0, width: 216, height: 550 },
          reason:
            'DEC-WF03-G15 / T00-D1: OpsShell sidebar replaces the ADM-coded "Quản trị" sidebar',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-S01-D1: canonical columns (Tổ chức, Trực thuộc, Thành viên, Loại, Trạng thái) in the drawn tracks; "Trưởng chapter", "Summit đang chạy", "Sự kiện 30 ngày", "Sender" have no P0 source; text masked',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: CREATE,
          reason: 'DEC-WF03-G8: "Tạo chapter" not rendered (no organization creation in P0)',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 248, y: 374, width: 1160, height: 74 },
          reason: 'Summit-lock notice (WF04) not rendered',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason: 'Title "Tổ chức & thành viên"; subtitle counts organizations only',
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
