import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { requestAccountDeletion } from '../../../src/lib/account/settings'
import { grantAccess } from '../../../src/lib/admin/delegation'
import { submitVentureForReview } from '../../../src/lib/admin/venture-submission'
import { ADM_FX, ADM_PEOPLE, seedAdminFixture } from '../../../src/lib/admin/testing'
import { fileVerificationRequest } from '../../../src/lib/admin/verification'
import { closePool, query, withTransaction } from '../../../src/lib/db/client'
import { LIBRARY_FX } from '../../../src/lib/library/testing'

/**
 * ADMIN-DESIGN-01 — captures the candidate canonical visual baseline of the
 * Admin Portal P0 (the ADMIN-PROD-07 UI, no redesign) for PO approval.
 * Opt-in, like `pixel-qa-screens`: it writes files, so it runs only with
 *
 *   ADMIN_DESIGN_CAPTURE=1 pnpm visual admin-design-01-capture
 *
 * on a freshly reset database (+ the QA vocabulary fixture). Every row it
 * shows comes from a real writer, then its timestamps are pinned so the
 * frames are deterministic. Output: `design-reference/candidate/admin/`
 * (override with ADMIN_DESIGN_OUT), plus `capture-matrix.json`.
 */

test.skip(!process.env.ADMIN_DESIGN_CAPTURE, 'ADMIN_DESIGN_CAPTURE not set')

const P = ADM_PEOPLE
const O = ADM_FX.org
const OUT =
  process.env.ADMIN_DESIGN_OUT ?? join(process.cwd(), 'design-reference', 'candidate', 'admin')
const PINNED = '2026-09-28T02:00:00Z'
const V = (n: number) => `ad020000-0000-4000-8000-000000000e${n.toString(16).padStart(2, '0')}`
const ZERO = '00000000-0000-4000-8000-000000000000'

const WIDTHS: readonly { w: number; h: number }[] = [
  { w: 1440, h: 900 },
  { w: 1024, h: 900 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
]

type Frame = {
  id: string
  route: string
  module: string
  state: string
  file: string
  viewport: string
  status: 'CANONICAL_REFERENCE' | 'KNOWN_DEBT'
  font: string
  overflow: number
  height: number
}
const frames: Frame[] = []
let ids: Record<string, string> = {}
const consoleErrors: string[] = []

/**
 * Pins every timestamp of the given rows; the n-th value gets PINNED + n
 * minutes, so rows never tie and their order is the order given (ties would
 * fall back to random uuids and reorder the queues between runs).
 */
async function pinTimestamps(table: string, idColumn: string, values: string[]) {
  const cols = await query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns
      WHERE table_name = $1 AND data_type LIKE 'timestamp%'`,
    [table],
  )
  for (const [i, value] of values.entries()) {
    const at = new Date(Date.parse(PINNED) + i * 60_000).toISOString()
    for (const { c } of cols)
      await query(`UPDATE ${table} SET ${c} = $2 WHERE ${idColumn} = $1 AND ${c} IS NOT NULL`, [
        value,
        at,
      ])
  }
}

test.beforeAll(async () => {
  await seedAdminFixture()
  mkdirSync(OUT, { recursive: true })
  // Re-runnable: the guest row is not an ADM fixture row, so seedAdminFixture keeps it.
  await query(`DELETE FROM feedback_submissions WHERE body LIKE ANY($1)`, [
    ['Nút "Lưu hồ sơ"%', 'Muốn lọc danh sách%', 'Trang sự kiện hiển thị%'],
  ])

  const verification = await withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P.memberC.account,
      body: { organization_id: O.CH_A, position_title: 'Phó Chủ tịch', period_from: '2024-03' },
      requestId: 'adm-design-01',
      now: new Date(PINNED),
    }),
  )
  await withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P.memberB.account,
      body: {
        organization_id: O.CLB_A1,
        position_title: 'Trưởng ban Truyền thông',
        period_from: '2023-09',
        period_to: '2025-08',
      },
      requestId: 'adm-design-01',
      now: new Date(PINNED),
    }),
  )

  const venture = V(0x90)
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, region_id,
                           owner_role_label, status, visibility, website)
     VALUES ($1, 'STARTUP', $2, 'adm-design-venture', 'Nông Sản Số', 'Nền tảng kết nối hợp tác xã nông sản với bếp ăn doanh nghiệp', $3, $4, 'Nhà sáng lập', 'DRAFT', 'PRIVATE', 'https://nongsanso.vn')`,
    [venture, P.memberB.profile, LIBRARY_FX.stage.MVP, LIBRARY_FX.region.hanoi],
  )
  await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
    venture,
    LIBRARY_FX.domain.govtech,
  ])
  const review = await withTransaction((exec) =>
    submitVentureForReview(exec, {
      accountId: P.memberB.account,
      ventureId: venture,
      requestId: 'adm-design-01',
    }),
  )

  const feedbackRows = await query<{ id: string }>(
    `INSERT INTO feedback_submissions (account_id, profile_id, body, type, priority, guest_email)
     VALUES ($1, $2, 'Nút "Lưu hồ sơ" không phản hồi khi tải ảnh đại diện lớn hơn 2 MB.', 'BUG', 'HIGH', NULL),
            ($3, $4, 'Muốn lọc danh sách thành viên theo năm gia nhập.', 'FEATURE', NULL, NULL),
            (NULL, NULL, 'Trang sự kiện hiển thị sai múi giờ trên điện thoại.', 'UX', 'MEDIUM', 'ban.doc@example.test')
     RETURNING id::text`,
    [P.memberA.account, P.memberA.profile, P.memberC.account, P.memberC.profile],
  )

  await grantAccess(
    P.chALeader.account,
    {
      organizationId: O.CH_A,
      granteeProfileId: P.memberC.profile,
      capability: 'membership:confirm',
    },
    'adm-design-01',
  )

  await requestAccountDeletion(P.memberA.account, 'adm-design-01')
  const [deletion] = await query<{ id: string }>(
    `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
    [P.memberA.account],
  )

  ids = {
    verification: verification.id,
    review: review.id,
    feedback: feedbackRows[0]!.id,
    deletion: deletion!.id,
  }
  await pinTimestamps('role_verification_requests', 'requester_profile_id', [
    P.memberB.profile,
    P.memberC.profile,
  ])
  await pinTimestamps('venture_reviews', 'venture_id', [venture])
  await pinTimestamps(
    'feedback_submissions',
    'id',
    feedbackRows.map((r) => r.id),
  )
  await pinTimestamps('account_deletion_requests', 'id', [deletion!.id])
  // Every fixture assignment (the leaders' whole roles included) shows a pinned "from" date.
  await query(
    `UPDATE role_assignments r SET valid_from = $1::timestamptz + o.n * interval '1 minute'
       FROM (SELECT id, row_number() OVER (ORDER BY individual_profile_id, scope_id, capability NULLS FIRST) AS n
               FROM role_assignments WHERE individual_profile_id::text LIKE 'ad020000-%') o
      WHERE r.id = o.id`,
    [PINNED],
  )
  await query(
    `UPDATE audit_events SET created_at = $1 WHERE actor_account_id::text LIKE 'ad020000-%'`,
    [PINNED],
  )
})

test.afterAll(async () => {
  writeFileSync(
    join(OUT, 'capture-matrix.json'),
    JSON.stringify({ frames, consoleErrors }, null, 2),
  )
  await closePool()
})

async function login(page: Page, who: keyof typeof P) {
  await page.context().clearCookies()
  expect(
    (
      await page.request.post('/dev/login', {
        data: { email: `adm02-fx-${who.toLowerCase()}@example.test` },
      })
    ).ok(),
  ).toBe(true)
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
  await page.waitForTimeout(150)
}

async function shoot(
  page: Page,
  id: string,
  module: string,
  state: string,
  route: string,
  widths = WIDTHS,
) {
  for (const { w, h } of widths) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(100)
    const measure = await page.evaluate(() => ({
      font: getComputedStyle(document.querySelector('main h1') ?? document.body).fontFamily.split(
        ',',
      )[0]!,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
    }))
    const status = w === 390 ? 'KNOWN_DEBT' : 'CANONICAL_REFERENCE'
    const base = `${id}__${state}`
    if (w === 1440) {
      const file = `${base}__1440x900.png`
      await page.screenshot({ path: join(OUT, file), animations: 'disabled' })
      frames.push({ id, route, module, state, file, viewport: '1440x900', status, ...measure })
    }
    const file = `${base}__${w}__full.png`
    await page.screenshot({ path: join(OUT, file), fullPage: true, animations: 'disabled' })
    frames.push({ id, route, module, state, file, viewport: `${w}x${h} full`, status, ...measure })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

test.beforeEach(({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
})

test('screens: the six modules, queues and details (admin)', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page, 'admin')
  const screens: [string, string, string, string][] = [
    ['ADMIN-HOME', 'Home', 'default', '/ops/admin'],
    ['ADMIN-VERIFICATION', 'Verification', 'queue', '/ops/admin/verification'],
    [
      'ADMIN-VERIFICATION-DETAIL',
      'Verification',
      'detail',
      `/ops/admin/verification/${ids.verification}`,
    ],
    ['ADMIN-VENTURES', 'Venture Review', 'queue', '/ops/admin/ventures'],
    ['ADMIN-VENTURE-DETAIL', 'Venture Review', 'detail', `/ops/admin/ventures/${ids.review}`],
    ['ADMIN-ACCESS', 'Organizations / Delegation', 'list', '/ops/admin/access'],
    ['ADMIN-ACCESS-MANAGER', 'Organizations / Delegation', 'detail', `/ops/admin/access/${O.CH_A}`],
    ['ADMIN-FEEDBACK', 'Feedback', 'queue', '/ops/admin/feedback'],
    ['ADMIN-FEEDBACK-DETAIL', 'Feedback', 'detail', `/ops/admin/feedback/${ids.feedback}`],
    ['ADMIN-CATEGORIES', 'Categories', 'list', '/ops/admin/categories'],
    ['ADMIN-ACCOUNTS', 'Account Ops', 'queue', '/ops/admin/accounts'],
    [
      'ADMIN-ACCOUNT-REQUEST-DETAIL',
      'Account Ops',
      'detail',
      `/ops/admin/accounts/${ids.deletion}`,
    ],
  ]
  for (const [id, module, state, route] of screens) {
    expect((await page.goto(route))?.status(), route).toBe(200)
    await settle(page)
    await shoot(page, id, module, state, route)
  }
})

test('shared states: confirm forms, summary, empty, loading, error, denied, not found', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const desktop = WIDTHS.slice(0, 1)
  await login(page, 'admin')
  const confirms: [string, string, string, string][] = [
    [
      'ADMIN-VERIFICATION-DETAIL',
      'Verification',
      `/ops/admin/verification/${ids.verification}`,
      '[data-action="reject"]',
    ],
    [
      'ADMIN-VENTURE-DETAIL',
      'Venture Review',
      `/ops/admin/ventures/${ids.review}`,
      '[data-action="reject"]',
    ],
    [
      'ADMIN-ACCESS-MANAGER',
      'Organizations / Delegation',
      `/ops/admin/access/${O.CH_A}`,
      '[data-action="revoke"]',
    ],
    [
      'ADMIN-ACCOUNT-REQUEST-DETAIL',
      'Account Ops',
      `/ops/admin/accounts/${ids.deletion}`,
      '[data-action="decline"]',
    ],
  ]
  for (const [id, module, route, trigger] of confirms) {
    await page.goto(route)
    await settle(page)
    await page.locator(trigger).first().click()
    await shoot(page, id, module, 'confirm', route, desktop)
  }

  await page.goto('/ops/admin/feedback')
  await settle(page)
  await page.locator('[data-action="toggle-summary"]').click()
  await expect(page.locator('[data-card="weekly-summary"]')).toBeVisible()
  // The default is the current week; pin the fixture's week so the frame never drifts.
  const week = page.locator('[data-card="weekly-summary"] input')
  await week.fill('2026-W40')
  await week.blur()
  await expect(page.locator('[data-summary-week="2026-W40"]')).toBeVisible()
  await shoot(page, 'ADMIN-FEEDBACK', 'Feedback', 'weekly-summary', '/ops/admin/feedback', desktop)

  await page.goto('/ops/admin/accounts')
  await settle(page)
  await page.locator('[data-filter="kind"]').selectOption('ESCALATION')
  await expect(page.locator('[data-state="empty"]')).toBeVisible()
  await shoot(page, 'ADMIN-ACCOUNTS', 'Account Ops', 'empty', '/ops/admin/accounts', desktop)

  await page.route('**/api/v1/ops/verification-requests?**', () => new Promise(() => undefined))
  await page.goto('/ops/admin/verification')
  await expect(page.locator('[data-state="loading"]')).toBeVisible()
  await shoot(
    page,
    'ADMIN-VERIFICATION',
    'Verification',
    'loading',
    '/ops/admin/verification',
    desktop,
  )
  await page.unroute('**/api/v1/ops/verification-requests?**')

  await page.route('**/api/v1/ops/feedback?**', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"error":{"code":"INTERNAL","message":"x","request_id":"r"}}',
    }),
  )
  await page.goto('/ops/admin/feedback')
  await expect(page.locator('[data-state^="load-"]')).toBeVisible()
  await shoot(page, 'ADMIN-FEEDBACK', 'Feedback', 'error', '/ops/admin/feedback', desktop)
  await page.unroute('**/api/v1/ops/feedback?**')

  await page.goto(`/ops/admin/feedback/${ZERO}`)
  await expect(page.locator('[data-state="load-not_found"]')).toBeVisible()
  await shoot(
    page,
    'ADMIN-FEEDBACK-DETAIL',
    'Feedback',
    'not-found',
    `/ops/admin/feedback/${ZERO}`,
    desktop,
  )

  await login(page, 'chALeader')
  await page.goto(`/ops/admin/access/${O.CH_B}`)
  await expect(page.locator('[data-state^="load-"]')).toBeVisible()
  await shoot(
    page,
    'ADMIN-ACCESS-MANAGER',
    'Organizations / Delegation',
    'denied',
    `/ops/admin/access/${O.CH_B}`,
    desktop,
  )
  await page.goto('/ops/admin')
  await settle(page)
  await shoot(page, 'ADMIN-HOME', 'Home', 'leader', '/ops/admin', desktop)
})
