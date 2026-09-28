import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF03-S02 — organization dashboard (/ops/org/:orgId).
 * API 05 §8.2; DEC-WF03-G1/G11/G15; DEC-WF03-S02-D1..D3; the page is the
 * corrected L20 CHP1 subset (TASK 22.4, DEC-L3-D2).
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

test.describe('WF03-S02 header action (DEC-L3-D2)', () => {
  test('"Tạo sự kiện" for event:manage opens the events create panel; the work chip names the unit', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-screen="WF03-S02"] h1')).toHaveText('Chapter 01')
    const create = page.locator('[data-nav="dashboard-create-event"]')
    await expect(create).toHaveText('Tạo sự kiện')
    await expect(create).toHaveAttribute('href', `/ops/org/${CHAPTER_01}/events?create=1`)
    await expect(page.locator('[data-work-item="pending_memberships"]')).toContainText(
      'Chờ chapter',
    )
    // No summit button, scope notice or capability chips (S02-D1, HD-08).
    await expect(page.getByText('Tạo summit mới')).toHaveCount(0)
    await expect(page.getByText(/phạm vi quyền/)).toHaveCount(0)
  })
})

test.describe('WF03-S02 pixel QA (corrected L20 CHP1 subset)', () => {
  const REFERENCE = 'design-reference/final/revision/L3/L20__chapter-dashboard__SOURCE.png'
  /** L20 is drawn without a sidebar: the left column moves by the 216px OpsShell. */
  const LEFT = 216
  /** L20, measured once: KPI and work card tops, the work label, a "Chờ chapter" chip. */
  const REF = { kpi: 187, work: 360, label: { x: 997 }, chip: { x: 1087, y: 552 }, create: 1100 }

  test('1440×900: header, KPI card frame, work card head, chip, header action', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-work-item="pending_memberships"]')).toBeVisible()
    const box = async (selector: string) => {
      const b = (await page.locator(selector).first().boundingBox())!
      return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.x + b.width) }
    }
    const kpi = await box('[data-metric="active_members"]')
    const work = await box('[data-card="work"]')
    const chip = await box('[data-work-item] [class*="chip"]')
    const create = await box('[data-nav="dashboard-create-event"]')
    const dyKpi = kpi.y - REF.kpi
    const dyWork = work.y - REF.work
    await auditRevision(page, {
      name: 'WF03-S02.L20',
      reference: REFERENCE,
      segments: [
        // "Chapter" and "Bảng điều khiển ·" are common to both headers.
        { name: 'title', reference: { x: 44, y: 18, width: 66, height: 30 }, dx: LEFT, dy: 0 },
        { name: 'subtitle', reference: { x: 44, y: 46, width: 100, height: 22 }, dx: LEFT, dy: 0 },
        {
          name: 'header-rule',
          reference: { x: 400, y: 70, width: 600, height: 30 },
          dx: LEFT,
          dy: 0,
        },
        {
          name: 'create-event',
          reference: { x: 1094, y: 14, width: 138, height: 56 },
          dx: create.x - REF.create,
          dy: 0,
        },
        {
          name: 'kpi-left-edge',
          reference: { x: 42, y: 181, width: 26, height: 156 },
          dx: LEFT,
          dy: dyKpi,
        },
        {
          name: 'kpi-right-edge',
          reference: { x: 350, y: 181, width: 24, height: 156 },
          dx: kpi.right - 369,
          dy: dyKpi,
        },
        {
          name: 'work-label',
          reference: { x: 990, y: 376, width: 90, height: 34 },
          dx: work.x + 25 - REF.label.x,
          dy: dyWork,
        },
        {
          name: 'work-rule',
          reference: { x: 1000, y: 404, width: 360, height: 18 },
          dx: work.x + 25 - REF.label.x,
          dy: dyWork,
        },
        {
          name: 'chip',
          reference: { x: 1083, y: 548, width: 90, height: 34 },
          dx: chip.x - REF.chip.x,
          dy: chip.y - REF.chip.y,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SHELL',
          reason: 'HD-11 / DEC-L3-D2: OpsShell stays; L20 is drawn without a sidebar',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'DEC-WF03-S02-D1 / DEC-L3-D2: no scope notice, landing / registration / qualifying KPIs, conversion funnel or "Tạo summit mới"; the four KPI cards carry the canonical aggregates',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'One canonical work item (pending membership requests) with its "Làm ngay" link; the work card spans the content width (no funnel beside it)',
        },
        {
          class: 'INTENTIONAL-DATA',
          reason: 'organization name, unit and counts come from Chapter 01; no actor line',
        },
        { class: 'INTENTIONAL-SCOPE', reason: 'HD-11: no floating "Góp ý" button' },
      ],
    })
  })
})
