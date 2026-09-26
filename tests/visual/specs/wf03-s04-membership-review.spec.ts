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
 * WF03-S04 — membership review / leadership ops (/ops/org/:orgId/members/:profileId).
 * API 05 §8.3; DEC-WF03-G3/G4/G5/G6/G14; DEC-WF03-S04-D1..D4.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const DEMO_PENDING = '40000000-0000-0000-0000-000000000005'
/** Test-hook history row for the pixel state; removed in afterAll. */
const PIXEL_HISTORY = 'e8000000-0000-0000-0000-0000000000a4'
const API = (org: string) => `/api/v1/ops/organizations/${org}`
const PAGE = (org: string, profile: string) => `/ops/org/${org}/members/${profile}`

let consoleErrors: string[] = []
const profiles: string[] = []
const accounts: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (
       SELECT id FROM community_memberships WHERE profile_id = ANY($1::uuid[])
       UNION SELECT id FROM leadership_records WHERE profile_id = ANY($1::uuid[]))`,
    [profiles],
  )
  for (const table of [
    'community_memberships',
    'leadership_records',
    'profile_visibility_settings',
  ]) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query('DELETE FROM community_memberships WHERE id = $1', [PIXEL_HISTORY])
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [profiles])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(
  name: string,
  opts: { org?: string; state?: string; leader?: string; level?: string } = {},
) {
  const email = `s04-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  accounts.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, headline, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'Kỹ sư', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  profiles.push(p!.id)
  let membershipId: string | null = null
  if (opts.org && opts.state) {
    const [m] = await query<{ id: string }>(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at, created_at)
       VALUES ($1, $2, $3::membership_state, 'SELF_DECLARED',
               CASE WHEN $3::text = 'PENDING_APPROVAL' THEN NULL ELSE '2026-02-01T03:00:00Z'::timestamptz END,
               '2026-02-01T03:00:00Z')
       RETURNING id::text`,
      [p!.id, opts.org, opts.state],
    )
    membershipId = m!.id
  }
  if (opts.org && opts.leader) {
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, $3, 'ACTIVE')`,
      [p!.id, opts.org, opts.leader],
    )
  }
  if (opts.level) {
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, group_overrides) VALUES ($1, $2)`,
      [p!.id, JSON.stringify({ PROFILE_DISCOVERY: opts.level })],
    )
  }
  return { email, accountId: a!.id, profileId: p!.id, membershipId }
}

const audits = (resourceId: string) =>
  query<{ action: string }>(
    `SELECT action FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [resourceId],
  )
const roleCount = async (accountId: string) =>
  Number(
    (
      await query<{ n: string }>(
        `SELECT count(*) AS n FROM role_assignments WHERE account_id = $1`,
        [accountId],
      )
    )[0]!.n,
  )
const membershipState = async (id: string) =>
  (
    await query<{ state: string; source: string }>(
      `SELECT state::text AS state, source FROM community_memberships WHERE id = $1`,
      [id],
    )
  )[0]!

test.describe('WF03-S04 access and scope', () => {
  test('1/2. guest → /auth and 401; member and relationship-only people → 404 page, 403 API', async ({
    page,
    request,
  }) => {
    const target = await person('S04 Target', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    await page.goto(PAGE(CHAPTER_01, target.profileId))
    await expect(page).toHaveURL('/auth')
    expect((await request.get(`${API(CHAPTER_01)}/members/${target.profileId}`)).status()).toBe(401)
    expect(
      (
        await request.patch(`${API(CHAPTER_01)}/memberships/${target.membershipId}`, {
          data: { status: 'ACTIVE' },
        })
      ).status(),
    ).toBe(401)
    // An ACTIVE member who also holds a leadership title has no operations capability.
    const tied = await person('S04 Tied', {
      org: CHAPTER_01,
      state: 'ACTIVE',
      leader: 'Trưởng ban',
    })
    for (const email of ['member@example.test', tied.email]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(PAGE(CHAPTER_01, target.profileId)))?.status(), email).toBe(404)
      const r = page.request
      expect((await r.get(`${API(CHAPTER_01)}/members/${target.profileId}`)).status()).toBe(403)
      expect(
        (
          await r.patch(`${API(CHAPTER_01)}/memberships/${target.membershipId}`, {
            data: { status: 'ACTIVE' },
          })
        ).status(),
      ).toBe(403)
      expect(
        (
          await r.post(`${API(CHAPTER_01)}/leadership`, {
            data: { profile_id: target.profileId, title: 'Chủ nhiệm' },
          })
        ).status(),
      ).toBe(403)
    }
    expect(await audits(target.membershipId!)).toEqual([])
    expect((await membershipState(target.membershipId!)).state).toBe('PENDING_APPROVAL')
  })

  test('3/4/5/6. leader: own Chapter only; foreign orgs, unrelated people and foreign records refused', async ({
    page,
  }) => {
    const elsewhere = await person('S04 Elsewhere', { org: CHAPTER_02, state: 'PENDING_APPROVAL' })
    const stranger = await person('S04 Stranger')
    await login(page.request, 'leader@example.test')
    expect((await page.goto(PAGE(CHAPTER_01, DEMO_PENDING)))?.status()).toBe(200)
    await expect(page.locator('[data-screen="WF03-S04"]')).toBeVisible()
    await expect(page.locator('[data-member-name]')).toHaveText('Demo Pending')
    await expect(page.locator('[data-action="approve"]')).toBeVisible()
    // Child CLB, sibling Chapter: the page is 404, the API 403 — spoofed context changes nothing.
    for (const org of [CLUB_01, CHAPTER_02]) {
      expect((await page.goto(PAGE(org, elsewhere.profileId)))?.status(), org).toBe(404)
      const r = await page.request.patch(`${API(org)}/memberships/${elsewhere.membershipId}`, {
        data: { status: 'ACTIVE' },
        headers: { 'x-org-id': CHAPTER_01, 'x-organization-id': CHAPTER_01 },
      })
      expect(r.status(), org).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
    // Own Chapter path, unrelated person or another organization's person: 404.
    for (const who of [stranger.profileId, elsewhere.profileId]) {
      expect((await page.goto(PAGE(CHAPTER_01, who)))?.status()).toBe(404)
      expect((await page.request.get(`${API(CHAPTER_01)}/members/${who}`)).status()).toBe(404)
    }
    // A foreign membership id through the own Chapter: 404, unchanged.
    expect(
      (
        await page.request.patch(`${API(CHAPTER_01)}/memberships/${elsewhere.membershipId}`, {
          data: { status: 'ACTIVE' },
        })
      ).status(),
    ).toBe(404)
    expect(
      (
        await page.request.post(`${API(CHAPTER_01)}/leadership`, {
          data: { profile_id: elsewhere.profileId, title: 'Chủ nhiệm' },
        })
      ).status(),
    ).toBe(404)
    expect((await membershipState(elsewhere.membershipId!)).state).toBe('PENDING_APPROVAL')
    expect(await audits(elsewhere.membershipId!)).toEqual([])
  })

  test('12/13. no PII, account or role data; PRIVATE identity hidden from ops; consent read-only', async ({
    page,
  }) => {
    const hidden = await person('S04 Ẩn Danh', {
      org: CHAPTER_01,
      state: 'PENDING_APPROVAL',
      level: 'PRIVATE',
    })
    for (const email of ['leader@example.test', 'ops@example.test']) {
      await page.context().clearCookies()
      await login(page.request, email)
      await page.goto(PAGE(CHAPTER_01, hidden.profileId), { waitUntil: 'networkidle' })
      await expect(page.locator('[data-member-name]')).toHaveText('Hồ sơ không công khai')
      await expect(page.locator('main')).not.toContainText('Ẩn Danh')
      await expect(page.locator('[data-consent-discovery]')).toHaveText('chưa bật')
      await expect(page.locator('[data-consent-discovery]')).not.toHaveAttribute('role', /.+/)
      const text = await page.locator('main').innerText()
      expect(text).not.toMatch(/@|HUB_COMMUNITY_LEADER|PLATFORM_ADMIN|role_code/)
      const body = await (
        await page.request.get(`${API(CHAPTER_01)}/members/${hidden.profileId}`)
      ).json()
      expect(Object.keys(body).sort()).toEqual([
        'consent_summary',
        'leadership',
        'membership',
        'memberships',
        'organization',
        'permissions',
        'profile',
        'profile_id',
      ])
      expect(body.profile).toBeNull()
      const json = JSON.stringify(body)
      expect(json).not.toContain(hidden.email)
      expect(json).not.toContain(hidden.accountId)
      expect(json).not.toMatch(/email|account|bio|role_code|metadata|audit/i)
    }
  })
})

test.describe('WF03-S04 review and leadership actions', () => {
  test('7/9/11. approve through the UI: ACTIVE, organization-verified, audited, no RoleAssignment; replay 409', async ({
    page,
  }) => {
    const target = await person('S04 Duyệt', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    const roles = await roleCount(target.accountId)
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01, target.profileId), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-pending-alert]')).toBeVisible()
    // Spoofed fields are refused before anything changes.
    const spoof = await page.request.patch(
      `${API(CHAPTER_01)}/memberships/${target.membershipId}`,
      {
        data: { status: 'ACTIVE', source: 'IDENTITY_VERIFIED', role_code: 'PLATFORM_ADMIN' },
      },
    )
    expect(spoof.status()).toBe(422)
    await page.locator('[data-action="approve"]').click()
    await expect(page.locator('[data-screen="WF03-S04"]')).toHaveAttribute(
      'data-membership-state',
      'ACTIVE',
    )
    await expect(page.locator('[data-action="approve"]')).toHaveCount(0)
    await expect(page.locator('[data-pending-alert]')).toHaveCount(0)
    expect(await membershipState(target.membershipId!)).toEqual({
      state: 'ACTIVE',
      source: 'ORGANIZATION_VERIFIED',
    })
    expect((await audits(target.membershipId!)).map((a) => a.action)).toEqual([
      'MEMBERSHIP_APPROVED',
    ])
    expect(await roleCount(target.accountId)).toBe(roles)
    for (const status of ['ACTIVE', 'REJECTED']) {
      const r = await page.request.patch(`${API(CHAPTER_01)}/memberships/${target.membershipId}`, {
        data: { status },
      })
      expect(r.status()).toBe(409)
      expect((await r.json()).error.code).toBe('MEMBERSHIP_INVALID_TRANSITION')
    }
    expect(await audits(target.membershipId!)).toHaveLength(1)
  })

  test('8. reject through the UI keeps the request in the history', async ({ page }) => {
    const target = await person('S04 Từ Chối', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01, target.profileId), { waitUntil: 'networkidle' })
    await page.locator('[data-action="reject"]').click()
    await expect(page.locator('[data-screen="WF03-S04"]')).toHaveAttribute(
      'data-membership-state',
      'REJECTED',
    )
    expect((await membershipState(target.membershipId!)).state).toBe('REJECTED')
    const history = page.locator('[data-history-entry]')
    await expect(history).toHaveCount(2)
    await expect(history.first()).toContainText('Không được duyệt')
    expect((await audits(target.membershipId!)).map((a) => a.action)).toEqual([
      'MEMBERSHIP_REJECTED',
    ])
  })

  test('10. leadership: assign through the form, end as alumni; duplicate 409; no RoleAssignment', async ({
    page,
  }) => {
    const target = await person('S04 Lãnh Đạo', { org: CHAPTER_01, state: 'ACTIVE' })
    const roles = await roleCount(target.accountId)
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01, target.profileId), { waitUntil: 'networkidle' })
    await page.locator('[data-action="add-leadership"]').click()
    await page.locator('#leadership-title').fill('Phó chủ nhiệm')
    await page.locator('[data-leadership-form] button[type="submit"]').click()
    const leader = page.locator('[data-leadership]')
    await expect(leader).toHaveCount(1)
    await expect(leader).toContainText('Phó chủ nhiệm')
    await expect(page.locator('[data-card="relationship"] p')).toContainText('Phó chủ nhiệm')
    const dup = await page.request.post(`${API(CHAPTER_01)}/leadership`, {
      data: { profile_id: target.profileId, title: 'Phó chủ nhiệm' },
    })
    expect(dup.status()).toBe(409)
    expect(
      (
        await page.request.post(`${API(CHAPTER_01)}/leadership`, {
          data: { profile_id: target.profileId, title: 'X', role_code: 'HUB_COMMUNITY_LEADER' },
        })
      ).status(),
    ).toBe(422)
    const id = (await leader.getAttribute('data-leadership'))!
    await leader.locator('[data-action="end-alumni"]').click()
    await expect(page.locator('[data-leadership]')).toHaveCount(0)
    await expect(page.locator('[data-history-entry]').first()).toContainText(
      'Kết thúc vai trò Phó chủ nhiệm',
    )
    expect((await audits(id)).map((a) => a.action)).toEqual([
      'LEADERSHIP_CREATED',
      'LEADERSHIP_ENDED',
    ])
    expect(await roleCount(target.accountId)).toBe(roles)
    // The ended title grants nothing: the person still has no ops access.
    await page.context().clearCookies()
    await login(page.request, target.email)
    expect((await page.goto(PAGE(CHAPTER_01, target.profileId)))?.status()).toBe(404)
  })

  test('14. a failed action shows a safe message and the latest state', async ({ page }) => {
    const target = await person('S04 Lỗi', { org: CHAPTER_01, state: 'PENDING_APPROVAL' })
    await login(page.request, 'leader@example.test')
    await page.goto(PAGE(CHAPTER_01, target.profileId), { waitUntil: 'networkidle' })
    // Someone else rejects first; the stale approve is refused (409) and the page refreshes.
    await query(
      `UPDATE community_memberships SET state = 'REJECTED', ended_at = now() WHERE id = $1`,
      [target.membershipId],
    )
    await page.locator('[data-action="approve"]').click()
    const notice = page.locator('[data-state="action-failed"]')
    await expect(notice).toBeVisible()
    await expect(notice).not.toContainText(/409|MEMBERSHIP_INVALID|request/i)
    await expect(page.locator('[data-screen="WF03-S04"]')).toHaveAttribute(
      'data-membership-state',
      'REJECTED',
    )
    expect(await audits(target.membershipId!)).toEqual([])
  })
})

async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
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
}

test.describe('WF03-S04 pixel QA', () => {
  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S04')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S04')!, {
      // Test hook: an earlier ALUMNI membership, so the history draws four entries.
      beforeNavigate: async () => {
        await query(
          `INSERT INTO community_memberships (id, profile_id, organization_id, state, source, started_at, ended_at, created_at)
           VALUES ($1, $2, $3, 'ALUMNI', 'SELF_DECLARED', '2025-03-02T02:30:00Z', '2025-12-20T09:00:00Z', '2025-03-01T08:15:00Z')
           ON CONFLICT (id) DO NOTHING`,
          [PIXEL_HISTORY, DEMO_PENDING, CHAPTER_01],
        )
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-history-entry]')).toHaveCount(4)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    // The 968px reference is taller than the viewport (EXACT rule). The page is shorter
    // by exactly the omitted consent rows (history_dy below); the height itself is
    // asserted after the history card is measured, the content per segment.

    const actual = decodePng(await page.screenshot({ animations: 'disabled', fullPage: true }))
    const reference = readPng(path.join(REPO_ROOT, screen.full_page_baseline!))
    // Only one consent row exists (G3), so the two-card band is shorter than drawn
    // and the history card follows it: compared as a component, moved up.
    const history = (await page.locator('[data-card="history"]').boundingBox())!
    const historyDy = Math.round(history.y) - 417
    expect(full.comparison.actual_size!.height).toBe(Math.max(900, 968 + historyDy))
    const consent = (await page.locator('[data-card="consent"]').boundingBox())!
    const mask = await textRects(page)
    // Reference text: title, subtitle, button labels, alert, card lines, history rows.
    const REF_TEXT: Rect[] = [
      { x: 238, y: 22, width: 420, height: 56 },
      { x: 1150, y: 38, width: 256, height: 22 },
      { x: 256, y: 104, width: 1030, height: 50 },
      { x: 258, y: 202, width: 380, height: 80 },
      { x: 850, y: 202, width: 550, height: 50 },
      { x: 850, y: 272, width: 550, height: 110 },
      { x: 258, y: 431 + historyDy, width: 110, height: 20 },
      ...[504, 626, 747, 869].map((y) => ({
        x: 258,
        y: y - 12 + historyDy,
        width: 1140,
        height: 26,
      })),
    ]
    // INTENTIONAL-CONTRACT: the "Quỹ liên hệ" / "Đơn vị đặt bài toán" consent rows have no
    // P0 source (G3); the drawn card continues below the one row ops may read.
    const OMITTED: Rect[] = [
      { x: 836, y: Math.round(consent.y + consent.height) - 4, width: 580, height: 200 },
    ]
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header', reference: { x: 216, y: 0, width: 1224, height: 88 }, dy: 0 },
        { name: 'alert', reference: { x: 216, y: 88, width: 1224, height: 96 }, dy: 0 },
        {
          name: 'relationship-card',
          reference: { x: 216, y: 184, width: 612, height: 116 },
          dy: 0,
        },
        {
          name: 'consent-card-top',
          reference: {
            x: 828,
            y: 184,
            width: 612,
            height: Math.round(consent.y + consent.height) - 188 - 6,
          },
          dy: 0,
        },
        {
          name: 'history-card',
          reference: { x: 216, y: 412, width: 1224, height: 540 },
          dy: historyDy,
        },
      ],
      [...mask, ...REF_TEXT, ...OMITTED],
      { diffPath: resolveOutputPath('diff', 'WF03-S04.segments.diff.png') },
    )
    writeJsonReport('WF03-S04.segments.json', {
      screen_id: 'WF03-S04',
      state: qaConfigFor('WF03-S04')!.state,
      full_page: {
        rule: 'EXACT',
        status: full.comparison.status,
        reference_height: 968,
        actual_height: full.comparison.actual_size!.height,
      },
      history_dy: historyDy,
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-G3 / S04-D1: relationship review, not account administration — header actions are Duyệt / Từ chối on a PENDING_APPROVAL membership; no email, resend link or account lock',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reference_region: OMITTED[0],
          reason:
            'Consent card: only the PROFILE_DISCOVERY summary ops may read (G3/G4); the history card moves up by history_dy and is compared as a component',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'History lists membership / leadership record dates (G14: no actor names, no audit log); right column is the record kind',
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
