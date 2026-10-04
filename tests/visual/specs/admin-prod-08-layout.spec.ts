import { expect, test, type Page } from '@playwright/test'

import { requestAccountDeletion } from '../../../src/lib/account/settings'
import { grantAccess } from '../../../src/lib/admin/delegation'
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
import { layoutFindings } from '../support/admin-layout'

/**
 * ADMIN-PROD-08 — layout safety, confirmation states and route / action smoke
 * on every Admin screen, independent of the pixel baseline (data-agnostic, so
 * it runs in the protected regression): no clipped header or label text, no
 * covered or unreachable control, no table column that disappears, no form
 * field leaving its card, page-level overflow none — at 1440 / 1024 / 768.
 * The four approved confirm forms: focus, required reason, cancel, and no
 * accidental execution. Every link on every screen resolves; no account
 * escalation action exists. Console errors and 5xx: none.
 */

const P = ADM_PEOPLE
const O = ADM_FX.org
const V = (n: number) => `ad020000-0000-4000-8000-000000000e${n.toString(16).padStart(2, '0')}`

let consoleErrors: string[] = []
let fiveXX: string[] = []

test.beforeEach(async ({ page }) => {
  await seedAdminFixture()
  consoleErrors = []
  fiveXX = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => {
    if (r.status() >= 500) fiveXX.push(`${r.status()} ${r.url()}`)
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
  expect(fiveXX, 'no 5xx').toEqual([])
})

test.afterAll(async () => {
  await query(
    `DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
  )
  await query(
    `DELETE FROM venture_reviews WHERE venture_id IN (SELECT id FROM projects WHERE owner_profile_id::text LIKE 'ad020000-%')`,
  )
  await query(`DELETE FROM projects WHERE owner_profile_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'ADM08%'`)
  await query(`DELETE FROM account_deletion_requests WHERE account_id::text LIKE 'ad020000-%'`)
  await clearAdminFixture()
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

async function fixture() {
  const verification = await withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P.memberC.account,
      body: { organization_id: O.CH_A, position_title: 'Phó Chủ tịch', period_from: '2024-03' },
      requestId: 'adm08',
      now: new Date('2026-10-04T05:00:00Z'),
    }),
  )
  const venture = V(0xa0)
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, region_id,
                           owner_role_label, status, visibility, website)
     VALUES ($1, 'STARTUP', $2, 'adm08-venture', 'ADM08 Nông Sản Số', 'Một dòng mô tả', $3, $4, 'Nhà sáng lập', 'DRAFT', 'PRIVATE', 'https://example.vn')`,
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
      requestId: 'adm08',
    }),
  )
  const [fb] = await query<{ id: string }>(
    `INSERT INTO feedback_submissions (account_id, profile_id, body, type, priority)
     VALUES ($1, $2, 'ADM08 Đề xuất tính năng lọc thành viên theo năm gia nhập', 'FEATURE', 'HIGH')
     RETURNING id::text`,
    [P.memberA.account, P.memberA.profile],
  )
  await grantAccess(
    P.admin.account,
    {
      organizationId: O.CH_A,
      granteeProfileId: P.memberC.profile,
      capability: 'membership:confirm',
    },
    'adm08',
  )
  await requestAccountDeletion(P.memberA.account, 'adm08')
  const [del] = await query<{ id: string }>(
    `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
    [P.memberA.account],
  )
  return { verification: verification.id, review: review.id, fb: fb!.id, del: del!.id }
}

const screens = (ids: Awaited<ReturnType<typeof fixture>>) => [
  '/ops/admin',
  '/ops/admin/verification',
  `/ops/admin/verification/${ids.verification}`,
  '/ops/admin/ventures',
  `/ops/admin/ventures/${ids.review}`,
  '/ops/admin/access',
  `/ops/admin/access/${O.CH_A}`,
  '/ops/admin/feedback',
  `/ops/admin/feedback/${ids.fb}`,
  '/ops/admin/categories',
  '/ops/admin/accounts',
  `/ops/admin/accounts/${ids.del}`,
]

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
}

/** Every control can be scrolled into view and is the topmost element at its centre. */
async function coveredControls(page: Page): Promise<string[]> {
  const controls = page.locator(
    'main button:visible, main a[href]:visible, main input:visible, main select:visible, main textarea:visible',
  )
  const out: string[] = []
  for (let i = 0; i < (await controls.count()); i++) {
    const c = controls.nth(i)
    await c.scrollIntoViewIfNeeded()
    const covered = await c.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !(hit && (hit === el || el.contains(hit)))
    })
    if (covered) out.push(`covered: ${(await c.textContent())?.trim().slice(0, 24) ?? ''}`)
  }
  return out
}

test.describe('ADMIN-PROD-08 layout safety', () => {
  test('12 screens × 1440 / 1024 / 768: no clipping, overlap, collapsed column or field overflow', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    const ids = await fixture()
    await login(page, 'admin')
    const findings: string[] = []
    for (const [w, h] of [
      [1440, 900],
      [1024, 900],
      [768, 1024],
    ] as const) {
      await page.setViewportSize({ width: w, height: h })
      for (const route of screens(ids)) {
        await page.goto(route)
        await settle(page)
        for (const f of [...(await layoutFindings(page)), ...(await coveredControls(page))])
          findings.push(`${w} ${route}: ${f}`)
      }
    }
    expect(findings).toEqual([])
  })
})

test.describe('ADMIN-PROD-08 confirmation states', () => {
  test('reject / revoke / decline: focus, required reason, cancel, no accidental execution', async ({
    page,
  }) => {
    const ids = await fixture()
    await login(page, 'admin')
    const cases = [
      {
        route: `/ops/admin/verification/${ids.verification}`,
        open: '[data-action="reject"]',
        form: '[data-reject-form]',
        focus: 'input',
        reasonRequired: false,
      },
      {
        route: `/ops/admin/ventures/${ids.review}`,
        open: '[data-action="reject"]',
        form: '[data-reject-form]',
        focus: 'input',
        reasonRequired: false,
      },
      {
        route: `/ops/admin/access/${O.CH_A}`,
        open: '[data-action="revoke"]',
        form: '[data-revoke-confirm]',
        focus: 'button:has-text("Huỷ")',
        reasonRequired: false,
      },
      {
        route: `/ops/admin/accounts/${ids.del}`,
        open: '[data-action="decline"]',
        form: '[data-decline-form]',
        focus: 'input',
        reasonRequired: true,
      },
    ]
    for (const c of cases) {
      await page.goto(c.route)
      await settle(page)
      await page.locator(c.open).first().focus()
      await page.keyboard.press('Enter')
      const form = page.locator(c.form)
      await expect(form, c.route).toBeVisible()
      await expect(form.locator(c.focus).first(), `${c.route} focus`).toBeFocused()
      expect(await layoutFindings(page), c.route).toEqual([])
      if (c.reasonRequired) {
        const submit = form.locator('button[type="submit"]')
        await expect(submit).toBeDisabled()
        await form.locator('input').fill('Nghĩa vụ lưu giữ hồ sơ')
        await expect(submit).toBeEnabled()
        await form.locator('input').fill('   ')
        await expect(submit).toBeDisabled()
      }
      // Cancel (Enter on the focused Huỷ for revoke) closes the form and restores the action.
      if (c.focus.startsWith('button')) await page.keyboard.press('Enter')
      else await form.locator('button', { hasText: 'Huỷ' }).click()
      await expect(form, `${c.route} cancel`).toHaveCount(0)
      await expect(page.locator(c.open).first()).toBeVisible()
    }
    const [v] = await query<{ s: string }>(
      `SELECT status::text AS s FROM role_verification_requests WHERE id = $1`,
      [ids.verification],
    )
    const [r] = await query<{ s: string }>(
      `SELECT status::text AS s FROM venture_reviews WHERE id = $1`,
      [ids.review],
    )
    const [d] = await query<{ s: string }>(
      `SELECT status::text AS s FROM account_deletion_requests WHERE id = $1`,
      [ids.del],
    )
    const [g] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments WHERE scope_id = $1 AND state = 'ACTIVE'
          AND individual_profile_id::text LIKE 'ad020000-%'`,
      [O.CH_A],
    )
    expect([v!.s, r!.s, d!.s, g!.n]).toEqual(['PENDING', 'PENDING', 'PENDING', 2])
  })
})

test.describe('ADMIN-PROD-08 routes and actions', () => {
  test('every link on every screen resolves; no dead or forbidden action is offered', async ({
    page,
  }) => {
    const ids = await fixture()
    for (const who of ['admin', 'chALeader'] as const) {
      await login(page, who)
      const hrefs = new Set<string>()
      for (const route of screens(ids)) {
        const response = await page.goto(route)
        if (who === 'chALeader' && response?.status() === 404) continue
        await settle(page)
        for (const href of await page
          .locator('main a[href], nav a[href]')
          .evaluateAll((as) => as.map((a) => a.getAttribute('href')!)))
          if (href.startsWith('/')) hrefs.add(href)
        await expect(
          page.getByText(/đề nghị khoá|khoá tài khoản thành viên|escalat|xoá vĩnh viễn/i),
        ).toHaveCount(0)
        // Every enabled button is wired to a handler or a form (no dead CTA).
        const dead = await page
          .locator('main button:enabled')
          .evaluateAll((bs) =>
            bs
              .filter(
                (b) =>
                  (b as HTMLButtonElement).type !== 'submit' &&
                  !Object.keys(b).some((k) => k.startsWith('__reactProps')),
              )
              .map((b) => b.textContent),
          )
        expect(dead, `${who} ${route} dead buttons`).toEqual([])
      }
      for (const href of hrefs) {
        const status = (await page.request.get(href)).status()
        expect(status, `${who} ${href}`).toBeLessThan(400)
      }
    }
  })
})
