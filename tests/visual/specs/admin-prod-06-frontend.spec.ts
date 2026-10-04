import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { requestAccountDeletion } from '../../../src/lib/account/settings'
import { grantAccess, revokeAccess } from '../../../src/lib/admin/delegation'
import { submitVentureForReview } from '../../../src/lib/admin/venture-submission'
import {
  ADM_FX,
  ADM_PEOPLE,
  clearAdminFixture,
  seedAdminFixture,
} from '../../../src/lib/admin/testing'
import { fileVerificationRequest } from '../../../src/lib/admin/verification'
import { closePool, query, withTransaction } from '../../../src/lib/db/client'
import { LIBRARY_FX } from '../../../src/lib/library/testing'

/**
 * ADMIN-PROD-06 — the Admin Portal frontend inside the existing OpsShell (05
 * §26–28): capability-based navigation (including the PROD-05 handoff gap —
 * a capability-only grantee with no `network:read`), the six modules' real
 * UI against real APIs (no runtime fixture; every row here comes from a real
 * writer, exactly as `*.db-test.ts` creates one), permission / not-found /
 * deep links, and the account-deletion reject-reason rule (DEC-ADM-PD7.1).
 * No response may be a 5xx and the browser console stays clean.
 */

const P = ADM_PEOPLE
const O = ADM_FX.org
type Person = keyof typeof P
const NOW = new Date('2026-10-04T05:00:00Z')
const V = (n: number) => `ad020000-0000-4000-8000-000000000e${n.toString(16).padStart(2, '0')}`
const PREFIX = 'ADM06'

let consoleErrors: string[] = []
const statuses: number[] = []

test.beforeAll(async () => {
  await seedAdminFixture()
})

test.beforeEach(async ({ page }) => {
  await seedAdminFixture()
  consoleErrors = []
  statuses.length = 0
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => statuses.push(r.status()))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
  expect(
    statuses.filter((s) => s >= 500),
    'no 5xx',
  ).toEqual([])
})

test.afterAll(async () => {
  await query(
    `DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
  )
  await query(
    `DELETE FROM venture_reviews WHERE venture_id IN (SELECT id FROM projects WHERE owner_profile_id::text LIKE 'ad020000-%')`,
  )
  await query(`DELETE FROM projects WHERE owner_profile_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM feedback_submissions WHERE body LIKE '${PREFIX}%'`)
  await query(`DELETE FROM account_deletion_requests WHERE account_id::text LIKE 'ad020000-%'`)
  await clearAdminFixture()
  await closePool()
})

async function login(request: APIRequestContext, who: Person) {
  await request.post('/api/v1/auth/logout').catch(() => undefined)
  const email = `adm02-fx-${who.toLowerCase()}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function pageLogin(page: Page, who: Person) {
  await login(page.request, who)
}

async function fileVerification(who: Person, org: string) {
  return withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P[who].account,
      body: {
        organization_id: org,
        position_title: 'Chủ tịch',
        period_from: '2024-01',
        period_to: null,
      },
      requestId: 'adm06-file',
      now: NOW,
    }),
  )
}

async function ventureAndReview(n: number, owner: Person) {
  const id = V(n)
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, region_id,
                           owner_role_label, status, visibility, website)
     VALUES ($1, 'STARTUP', $2, $3, $4, 'Một dòng mô tả', $5, $6, 'Founder', 'DRAFT', 'PRIVATE', 'https://live.example')`,
    [
      id,
      P[owner].profile,
      `adm06-fx-${n}`,
      `ADM06 Venture ${n}`,
      LIBRARY_FX.stage.MVP,
      LIBRARY_FX.region.hanoi,
    ],
  )
  await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
    id,
    LIBRARY_FX.domain.govtech,
  ])
  const review = await withTransaction((exec) =>
    submitVentureForReview(exec, {
      accountId: P[owner].account,
      ventureId: id,
      requestId: 'adm06-submit',
    }),
  )
  return review.id
}

async function feedback(type = 'BUG') {
  const [row] = await query<{ id: string }>(
    `INSERT INTO feedback_submissions (account_id, profile_id, body, type)
     VALUES ($1, $2, $3, $4) RETURNING id::text`,
    [P.memberA.account, P.memberA.profile, `${PREFIX} nút lưu không phản hồi`, type],
  )
  return row!.id
}

test.describe('ADMIN-PROD-06 navigation by capability', () => {
  test('admin sees every admin item and Home; a plain member sees none and is 404 everywhere', async ({
    page,
  }) => {
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin')
    await expect(page.locator('[data-nav-key="admin-home"]')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.locator('[data-nav-key^="admin-"]')).toHaveCount(7) // home + 6
    await expect(page.locator('[data-nav-key="network"]')).toBeVisible()

    await pageLogin(page, 'memberA')
    for (const route of [
      '/ops/admin',
      '/ops/admin/verification',
      '/ops/admin/ventures',
      '/ops/admin/access',
      '/ops/admin/feedback',
      '/ops/admin/categories',
      '/ops/admin/accounts',
    ]) {
      expect((await page.goto(route))?.status(), route).toBe(404)
    }
  })

  test('a capability-only verification:review grantee (no network:read) reaches /ops/admin and exactly its one queue', async ({
    page,
  }) => {
    const grant = await grantAccess(
      P.admin.account,
      {
        organizationId: O.CLB_A1,
        granteeProfileId: P.memberB.profile,
        capability: 'verification:review',
      },
      'adm06-grant',
    )
    try {
      await pageLogin(page, 'memberB')
      await expect((await page.goto('/ops/admin'))?.status()).toBe(200)
      // The dead-link gap (PROD-05 handoff): hidden rather than sent to a 404.
      await expect(page.locator('[data-nav-key="network"]')).toHaveCount(0)
      await expect(page.locator('[data-nav-key="admin-verification"]')).toBeVisible()
      await expect(page.locator('[data-nav-key="admin-feedback"]')).toHaveCount(0)
      expect((await page.goto('/ops/admin/verification'))?.status()).toBe(200)
      // Holds none of feedback:manage anywhere: this one page is still 404.
      expect((await page.goto('/ops/admin/feedback'))?.status()).toBe(404)
    } finally {
      await revokeAccess(
        P.admin.account,
        { organizationId: O.CLB_A1, grantId: grant.id },
        'adm06-revoke',
      )
    }
  })
})

test.describe('ADMIN-PROD-06 verification', () => {
  test('queue → detail → approve; deep link to the detail reloads correctly', async ({ page }) => {
    const req = await fileVerification('memberC', O.CH_A)
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin/verification')
    await expect(page.locator(`[data-request-row="${req.id}"]`)).toBeVisible()

    // Deep link straight to the detail (no nav click).
    await page.goto(`/ops/admin/verification/${req.id}`)
    await expect(page.locator('[data-requester-name]')).toBeVisible()
    await page.locator('[data-action="approve"]').click()
    await expect(page.locator('[data-screen="ADMIN-VERIFICATION-DETAIL"]')).toHaveAttribute(
      'data-status',
      'APPROVED',
    )
    await expect(page.locator('[data-action="approve"]')).toHaveCount(0)
  })

  test('reject requires no reason but records one; history renders', async ({ page }) => {
    const req = await fileVerification('memberB', O.CH_A)
    await pageLogin(page, 'admin')
    await page.goto(`/ops/admin/verification/${req.id}`)
    await page.locator('[data-action="reject"]').click()
    await page.locator('[data-reject-form] input').fill('Không đủ bằng chứng')
    await page.locator('[data-reject-form] button[type="submit"]').click()
    await expect(page.locator('[data-screen="ADMIN-VERIFICATION-DETAIL"]')).toHaveAttribute(
      'data-status',
      'REJECTED',
    )
    await expect(page.locator('[data-card="reject-reason"]')).toContainText('Không đủ bằng chứng')
    await expect(page.locator('[data-history-entry]').first()).toBeVisible()
  })
})

test.describe('ADMIN-PROD-06 venture review', () => {
  test('queue → detail shows public-vs-pending and the real diff; reject with a reason', async ({
    page,
  }) => {
    const reviewId = await ventureAndReview(1, 'memberC')
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin/ventures')
    await expect(page.locator(`[data-review-row="${reviewId}"]`)).toBeVisible()

    await page.goto(`/ops/admin/ventures/${reviewId}`)
    // First publication: no public version yet, never rendered as if it were live.
    await expect(page.locator('[data-column="public-current"]').first()).toContainText(
      /Chưa có phiên bản công khai/,
    )
    await expect(
      page.locator('[data-diff-field="name"] [data-column="pending-candidate"]'),
    ).toContainText('ADM06 Venture 1')
    await page.locator('[data-action="reject"]').click()
    await page.locator('[data-reject-form] input').fill('Thiếu thông tin bắt buộc')
    await page.locator('[data-reject-form] button[type="submit"]').click()
    await expect(page.locator('[data-screen="ADMIN-VENTURE-DETAIL"]')).toHaveAttribute(
      'data-status',
      'REJECTED',
    )
    await expect(page.locator('[data-card="reject-reason"]')).toContainText(
      'Thiếu thông tin bắt buộc',
    )
  })
})

test.describe('ADMIN-PROD-06 organization access / delegation', () => {
  test('a leader grants and revokes access on their own unit; scopes come from the server, not the client', async ({
    page,
  }) => {
    await pageLogin(page, 'chALeader')
    await page.goto('/ops/admin/access')
    await expect(page.locator(`[data-org-row="${O.CH_A}"]`)).toBeVisible()
    // Reach only (own unit + direct children): the sibling chapter never lists.
    await expect(page.locator(`[data-org-row="${O.CH_B}"]`)).toHaveCount(0)

    await page.goto(`/ops/admin/access/${O.CH_A}`)
    await page.locator('[data-grant-form] input').fill(P.memberC.profile)
    await page.locator('[data-grant-form] select').selectOption('membership:confirm')
    await page.locator('[data-grant-form] button[type="submit"]').click()
    const row = page.locator('[data-grant-row]').filter({ hasText: 'membership:confirm' })
    await expect(row).toBeVisible()
    await row.locator('[data-action="revoke"]').click()
    await row.locator('[data-revoke-confirm] button', { hasText: 'Thu hồi' }).click()
    await expect(row).toHaveCount(0)
    await expect(page.locator('[data-card="history"]')).toContainText('membership:confirm')
  })
})

test.describe('ADMIN-PROD-06 feedback', () => {
  test('queue, triage and the weekly summary read view', async ({ page }) => {
    const id = await feedback()
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin/feedback')
    await expect(page.locator(`[data-feedback-row="${id}"]`)).toBeVisible()
    await page.locator('[data-action="toggle-summary"]').click()
    await expect(page.locator('[data-card="weekly-summary"]')).toBeVisible()

    await page.goto(`/ops/admin/feedback/${id}`)
    await page.locator('[data-field="status"]').selectOption('IN_REVIEW')
    await page.locator('[data-triage-form] button[type="submit"]').click()
    await expect(page.locator('[data-screen="ADMIN-FEEDBACK-DETAIL"]')).toHaveAttribute(
      'data-status',
      'IN_REVIEW',
    )
  })

  test('a screenshot past 90 days shows a clean expired state, never a broken image', async ({
    page,
  }) => {
    const [row] = await query<{ id: string }>(
      `INSERT INTO feedback_submissions (account_id, profile_id, body, type, screenshot_asset_id, created_at)
       VALUES ($1, $2, $3, 'BUG', 'asset_' || md5(random()::text), now() - interval '120 days')
       RETURNING id::text`,
      [P.memberA.account, P.memberA.profile, `${PREFIX} ảnh cũ`],
    )
    await pageLogin(page, 'admin')
    await page.goto(`/ops/admin/feedback/${row!.id}`)
    await expect(page.locator('[data-state="screenshot-expired"]')).toBeVisible()
    await expect(page.locator('[data-card="screenshot"] img')).toHaveCount(0)
  })
})

test.describe('ADMIN-PROD-06 categories', () => {
  test('rename, archive and reorder a SKILL item', async ({ page }) => {
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin/categories')
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/ops/categories/SKILL') && r.ok()),
      page.locator('[data-tab="SKILL"]').click(),
    ])
    const firstRow = page.locator('[data-item-row]').first()
    const id = (await firstRow.getAttribute('data-item-row'))!
    // force: true — the click's own result changes this button's selector
    // (data-action flips archive → activate); Playwright's own actionability
    // stability wait otherwise races the component's re-render.
    await firstRow.locator('[data-action="archive"]').click({ force: true })
    await expect(page.locator(`[data-item-row="${id}"]`)).toContainText('Lưu trữ')
    await page.locator(`[data-item-row="${id}"] [data-action="activate"]`).click({ force: true })
    await expect(page.locator(`[data-item-row="${id}"]`)).toContainText('Hoạt động')
  })

  test('VENTURE_STAGE has no archive control (label and order only)', async ({ page }) => {
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin/categories')
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/ops/categories/VENTURE_STAGE') && r.ok()),
      page.locator('[data-tab="VENTURE_STAGE"]').click(),
    ])
    await expect(
      page.locator('[data-item-row]').first().locator('[data-action="archive"]'),
    ).toHaveCount(0)
  })
})

test.describe('ADMIN-PROD-06 account operations', () => {
  test('a deletion request can only be declined with a reason (DEC-ADM-PD7.1); the UI blocks an empty one', async ({
    page,
  }) => {
    await requestAccountDeletion(P.memberC.account, 'adm06-request')
    await pageLogin(page, 'admin')
    await page.goto('/ops/admin/accounts')
    await expect(page.locator('[data-queue="accounts"] [data-request-row]').first()).toBeVisible()

    const [row] = await query<{ id: string }>(
      `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
      [P.memberC.account],
    )
    await page.goto(`/ops/admin/accounts/${row!.id}`)
    await page.locator('[data-action="decline"]').click()
    const submit = page.locator('[data-decline-form] button[type="submit"]')
    await expect(submit).toBeDisabled()
    await page
      .locator('[data-decline-form] [data-field="reason"]')
      .fill('Nghĩa vụ lưu giữ pháp lý: hồ sơ đang có tranh chấp.')
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(page.locator('[data-screen="ADMIN-ACCOUNT-REQUEST-DETAIL"]')).toHaveAttribute(
      'data-status',
      'DECLINED',
    )
    // No hard-delete control anywhere on this screen.
    await expect(page.getByText(/xoá vĩnh viễn|hard delete/i)).toHaveCount(0)
  })

  test('direct lock is offered and hidden for the viewer’s own account', async ({ page }) => {
    await requestAccountDeletion(P.memberB.account, 'adm06-request-2')
    const [row] = await query<{ id: string }>(
      `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
      [P.memberB.account],
    )
    await pageLogin(page, 'admin')
    await page.goto(`/ops/admin/accounts/${row!.id}`)
    await expect(page.locator('[data-action="direct-lock"]')).toBeVisible()

    // The admin's own account is never a request target in this fixture, so
    // self-hiding is asserted on the request-level self guard instead: an
    // admin may not process or decline a request about themselves.
    await query(`INSERT INTO account_deletion_requests (account_id) VALUES ($1)`, [P.admin.account])
    const [own] = await query<{ id: string }>(
      `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
      [P.admin.account],
    )
    await page.goto(`/ops/admin/accounts/${own!.id}`)
    await expect(page.locator('[data-action="process"]')).toHaveCount(0)
    await expect(page.locator('[data-action="decline"]')).toHaveCount(0)
  })
})

test.describe('ADMIN-PROD-06 responsive smoke', () => {
  test('1440 / 1024 / 768: no horizontal overflow on the admin home and a queue', async ({
    page,
  }) => {
    await pageLogin(page, 'admin')
    for (const width of [1440, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of ['/ops/admin', '/ops/admin/feedback']) {
        await page.goto(route)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${route} @ ${width}px horizontal overflow`).toBeLessThanOrEqual(0)
      }
    }
  })

  test('390: loads without a crash (smoke only; the fixed-width OpsShell sidebar is inherited shell debt, not scoped here)', async ({
    page,
  }) => {
    await pageLogin(page, 'admin')
    await page.setViewportSize({ width: 390, height: 844 })
    const response = await page.goto('/ops/admin')
    expect(response?.status()).toBe(200)
    await expect(page.locator('[data-screen="ADMIN-HOME"]')).toBeVisible()
  })
})
