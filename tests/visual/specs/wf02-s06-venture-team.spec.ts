import path from 'node:path'

import { expect, test, type APIRequestContext, type Browser } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { FIXTURES, qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S06 — Venture team / members (/projects/:id/team).
 * Decisions DEC-WF02-H7, DEC-WF02-S06-G1..G9; migration 008.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const VENTURES = '/api/v1/ventures'
const NIL = '00000000-0000-0000-0000-000000000000'

let consoleErrors: string[] = []

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
  await closePool()
})

type Member = { email: string; accountId: string; profileId: string }

async function completedMember(request: APIRequestContext, label = 's06'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        data: {
          full_name: label,
          display_name: label,
          country_id: COUNTRY,
          headline: 'QA',
          region_id: REGION,
          domain_ids: [DOMAIN],
        },
      })
    ).status(),
  ).toBe(200)
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    expect(
      (
        await request.post('/api/v1/me/consents/accept', {
          data: { consent_type: doc.type, policy_version: doc.version },
        })
      ).ok(),
    ).toBe(true)
  }
  for (const completed of ['CAPABILITY', 'ROLE']) {
    const stage = await request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect(stage.ok()).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

async function persona(browser: Browser, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  const member = await completedMember(page.request, label)
  return { context, page, member }
}

async function newVenture(request: APIRequestContext, name = 'Team QA') {
  const r = await request.post(VENTURES, { data: { type: 'STARTUP', name } })
  expect(r.status()).toBe(201)
  return (await r.json()) as { id: string }
}

async function stateOf(id: string) {
  const [row] = await query<{ state: string; profile_id: string | null }>(
    'SELECT state::text AS state, profile_id::text FROM project_members WHERE id = $1',
    [id],
  )
  return row!
}

test.describe('WF02-S06 guards', () => {
  test('guest → /auth on the page; every team API 401', async ({ page, request }) => {
    await page.goto(`/projects/${NIL}/team`)
    await expect(page).toHaveURL('/auth')
    const base = `${VENTURES}/${NIL}/team`
    for (const r of [
      await request.get(base),
      await request.post(`${base}/invitations`, { data: { email: 'a@b.test' } }),
      await request.patch(`${base}/${NIL}`, { data: { role_label: 'x' } }),
      await request.delete(`${base}/${NIL}`),
      await request.post(`${base}/invitations/${NIL}/accept`),
      await request.post(`${base}/invitations/${NIL}/decline`),
    ]) {
      expect(r.status()).toBe(401)
    }
  })

  test('onboarding not DONE → resolver step on the page', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s06-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto(`/projects/${FIXTURES.demoStartupId}/team`)
    await expect(page).toHaveURL('/onboarding')
  })
})

test.describe('WF02-S06 team journeys (UI)', () => {
  test('invite → explicit accept → role edit → remove; member view hides pending data', async ({
    browser,
    page,
  }) => {
    const owner = await completedMember(page.request, 's06-owner')
    const v = await newVenture(page.request)
    const mate = await persona(browser, 's06-mate')

    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-team-view]')).toHaveAttribute('data-viewer', 'OWNER')
    await expect(page.locator('[data-row-kind="OWNER"]')).toContainText('Chủ sở hữu')
    await expect(page.locator('[data-row-kind="OWNER"]')).toContainText('Không gỡ được')
    await expect(page.locator('[data-row-kind="OWNER"] button')).toHaveCount(0)
    await expect(page.getByText('Gửi lại')).toHaveCount(0)

    await page.getByRole('button', { name: 'Mời thành viên' }).click()
    await page.locator('#team-invite-email').fill(mate.member.email.toUpperCase())
    await page.locator('#team-invite-role').fill('CTO')
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.locator('[data-state="invite-created"]')).toContainText(
      'Chưa có email nào được gửi',
    )
    const pendingRow = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(pendingRow).toContainText(mate.member.email)
    await expect(page.locator('[data-shell="editor-header"] [data-status]')).toHaveText(
      '1 thành viên · 1 lời mời chưa nhận',
    )
    const [inv] = await query<{ id: string }>(
      `SELECT id::text FROM project_members WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'`,
      [v.id],
    )

    // Signing in is not accepting: the recipient sees only their invitation.
    await mate.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(mate.page.locator('[data-team-invitation]')).toContainText('CTO')
    await expect(mate.page.locator('[data-team-table]')).toHaveCount(0)
    expect((await stateOf(inv!.id)).state).toBe('PENDING_CONFIRMATION')
    await mate.page.getByRole('button', { name: 'Nhận lời mời' }).click()
    await expect(mate.page.locator('[data-team-view]')).toHaveAttribute('data-viewer', 'MEMBER')
    await expect(mate.page.locator('[data-state="read-only"]')).toBeVisible()
    await expect(mate.page.getByRole('button', { name: 'Mời thành viên' })).toHaveCount(0)
    await expect(mate.page.getByRole('button', { name: 'Tuỳ chọn' })).toHaveCount(0)
    expect(await stateOf(inv!.id)).toEqual({ state: 'ACTIVE', profile_id: mate.member.profileId })

    // The owner edits the display role, then removes the member.
    await page.reload({ waitUntil: 'networkidle' })
    const row = page.locator('[data-row-kind="ACTIVE_MEMBER"]')
    await expect(row).toContainText('Thành viên')
    await row.getByRole('button', { name: 'Tuỳ chọn' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Sửa vai trò', 'Gỡ khỏi đội'])
    await page.getByRole('menuitem', { name: 'Sửa vai trò' }).click()
    await row.locator('input').fill('Cố vấn kỹ thuật')
    await row.getByRole('button', { name: 'Lưu' }).click()
    await expect(row).toContainText('Cố vấn kỹ thuật')
    await row.getByRole('button', { name: 'Tuỳ chọn' }).click()
    await page.getByRole('menuitem', { name: 'Gỡ khỏi đội' }).click()
    await row.getByRole('button', { name: 'Gỡ', exact: true }).click()
    await expect(page.locator('[data-row-kind="ACTIVE_MEMBER"]')).toHaveCount(0)
    expect((await stateOf(inv!.id)).state).toBe('REMOVED')

    // Removed: no venture:read any more.
    const gone = await mate.page.goto(`/projects/${v.id}/team`)
    expect(gone?.status()).toBe(404)
    expect(owner.profileId).toBeTruthy()
    await mate.context.close()
  })

  test('decline from the page; pending cancel by the owner', async ({ browser, page }) => {
    await completedMember(page.request, 's06-owner2')
    const v = await newVenture(page.request)
    const invitee = await persona(browser, 's06-decliner')
    const post = (email: string) =>
      page.request.post(`${VENTURES}/${v.id}/team/invitations`, { data: { email } })
    const declined = await (await post(invitee.member.email)).json()
    const cancelled = await (await post('cancel-me@example.test')).json()

    await invitee.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await invitee.page.getByRole('button', { name: 'Từ chối' }).click()
    await expect(invitee.page.locator('[data-state="declined"]')).toBeVisible()
    expect(await stateOf(declined.membership_id)).toEqual({ state: 'REJECTED', profile_id: null })
    expect((await invitee.page.goto(`/projects/${v.id}/team`))?.status()).toBe(404)

    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    const pending = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(pending).toHaveCount(1)
    await pending.getByRole('button', { name: 'Huỷ lời mời' }).click()
    await pending.getByRole('button', { name: 'Huỷ lời mời' }).click()
    await expect(page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(0)
    expect((await stateOf(cancelled.membership_id)).state).toBe('REMOVED')
    await invitee.context.close()
  })
})

test.describe('WF02-S06 API security', () => {
  test('IDOR, spoofing, enumeration, privacy, cross-project, concurrency', async ({
    browser,
    page,
  }) => {
    const owner = await completedMember(page.request, 's06-own')
    const v = await newVenture(page.request, 'Sec A')
    const w = await newVenture(page.request, 'Sec B')
    const mate = await persona(browser, 's06-sec-mate')
    const stranger = await persona(browser, 's06-sec-stranger')
    const other = await persona(browser, 's06-sec-other')
    const team = `${VENTURES}/${v.id}/team`

    // 11. Enumeration: a registered and an unknown email give the same answer shape.
    const a = await page.request.post(`${team}/invitations`, {
      data: { email: other.member.email },
    })
    const b = await page.request.post(`${team}/invitations`, {
      data: { email: 'never-registered@example.test' },
    })
    expect([a.status(), b.status()]).toEqual([201, 201])
    const [ja, jb] = [await a.json(), await b.json()]
    expect(Object.keys(ja).sort()).toEqual(Object.keys(jb).sort())
    expect(JSON.stringify(ja)).not.toContain(other.member.profileId)

    // Mate joins through the real path.
    const invite = await (
      await page.request.post(`${team}/invitations`, {
        data: { email: mate.member.email, role_label: 'Owner' },
      })
    ).json()
    // 14. Another signed-in user cannot accept it.
    expect(
      (
        await other.page.request.post(`${team}/invitations/${invite.membership_id}/accept`)
      ).status(),
    ).toBe(404)
    // 17. Concurrent accepts: one ACTIVE row.
    const accepts = await Promise.all(
      [0, 1, 2].map(() =>
        mate.page.request.post(`${team}/invitations/${invite.membership_id}/accept`),
      ),
    )
    expect(accepts.map((r) => r.status())).toEqual([200, 200, 200])
    const active = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
      [v.id, mate.member.profileId],
    )
    expect(active).toHaveLength(1)

    // 12. A member sees no pending or declined email; no ids or metadata.
    const seen = await (await mate.page.request.get(team)).json()
    expect(seen.viewer).toBe('MEMBER')
    const json = JSON.stringify(seen)
    for (const leak of [
      other.member.email,
      'never-registered',
      owner.email,
      mate.member.email,
      owner.profileId,
      mate.member.profileId,
    ]) {
      expect(json).not.toContain(leak)
    }
    expect(json).not.toMatch(/"(email|metadata|slug|profile_id|invited_by_profile_id)"/)

    // 6/7/8/18. Member (role_label "Owner") cannot invite, change roles or remove.
    for (const r of [
      await mate.page.request.post(`${team}/invitations`, { data: { email: 'x@example.test' } }),
      await mate.page.request.patch(`${team}/${invite.membership_id}`, {
        data: { role_label: 'x' },
      }),
      await mate.page.request.delete(`${team}/${invite.membership_id}`),
      await mate.page.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'Hijack' } }),
    ]) {
      expect(r.status()).toBe(403)
    }
    // 3. Foreign project: stranger gets 404 everywhere.
    for (const r of [
      await stranger.page.request.get(team),
      await stranger.page.request.post(`${team}/invitations`, {
        data: { email: 'y@example.test' },
      }),
      await stranger.page.request.patch(`${team}/${invite.membership_id}`, {
        data: { role_label: 'x' },
      }),
      await stranger.page.request.delete(`${team}/${invite.membership_id}`),
    ]) {
      expect(r.status()).toBe(404)
    }
    expect((await stranger.page.goto(`/projects/${v.id}/team`))?.status()).toBe(404)
    // 4/5/19. Random and cross-project membership ids → 404, nothing changes.
    for (const r of [
      await page.request.delete(`${team}/${NIL}`),
      await page.request.delete(`${team}/not-a-uuid`),
      await page.request.delete(`${VENTURES}/${w.id}/team/${invite.membership_id}`),
      await page.request.patch(`${VENTURES}/${w.id}/team/${invite.membership_id}`, {
        data: { role_label: 'x' },
      }),
    ]) {
      expect(r.status()).toBe(404)
    }
    expect((await stateOf(invite.membership_id)).state).toBe('ACTIVE')

    // 10. Spoofed authority fields are refused; owner_profile_id never moves.
    for (const key of ['owner_profile_id', 'profile_id', 'state', 'invited_by_profile_id']) {
      const r = await page.request.post(`${team}/invitations`, {
        data: { email: 'z@example.test', [key]: mate.member.profileId },
      })
      expect(r.status()).toBe(422)
    }
    const [p] = await query<{ owner: string }>(
      'SELECT owner_profile_id::text AS owner FROM projects WHERE id = $1',
      [v.id],
    )
    expect(p!.owner).toBe(owner.profileId)
    // 9. The owner is never a row: inviting the owner's own email is refused.
    const self = await page.request.post(`${team}/invitations`, {
      data: { email: owner.email },
    })
    expect(self.status()).toBe(422)

    // 15/16. Duplicate and concurrent duplicate invites: exactly one pending row.
    const dup = await Promise.all(
      [0, 1, 2, 3].map(() =>
        page.request.post(`${team}/invitations`, { data: { email: 'dup@example.test' } }),
      ),
    )
    expect(dup.map((r) => r.status()).sort()).toEqual([201, 409, 409, 409])
    expect((await dup.find((r) => r.status() === 409)!.json()).error.code).toBe(
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    const pending = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND invite_email_normalized = 'dup@example.test'`,
      [v.id],
    )
    expect(pending).toHaveLength(1)

    // 20. Audit rows carry ids and states only.
    const audits = await query<{ action: string; payload: string }>(
      `SELECT action, coalesce(before_data::text, '') || coalesce(after_data::text, '') AS payload
         FROM audit_events WHERE resource_type = 'project_member' AND after_data->>'project_id' = $1`,
      [v.id],
    )
    expect(new Set(audits.map((x) => x.action))).toEqual(
      new Set(['VENTURE_TEAM_INVITED', 'VENTURE_TEAM_JOINED']),
    )
    for (const x of audits) expect(x.payload).not.toMatch(/@|token|cookie|role_label/i)

    for (const c of [mate, stranger, other]) await c.context.close()
  })
})

test.describe('WF02-S06 pixel QA', () => {
  // Test-only rows matching the reference: three ACTIVE members beside the
  // seeded owner and the seeded pending invitation (DEC-WF02-S06-G9 fixture).
  const PIXEL = [1, 2, 3].map((n) => ({
    account: `e6000000-0000-0000-0000-00000000000${n}`,
    profile: `e6100000-0000-0000-0000-00000000000${n}`,
    member: `e6200000-0000-0000-0000-00000000000${n}`,
    name: ['Nguyễn Minh Anh', 'Trần Bảo Long', 'Phạm Thu Hà'][n - 1]!,
    role: ['Đồng sáng lập', 'Thành viên', 'Cố vấn'][n - 1]!,
    joined: ['2024-01-10T03:00:00Z', '2025-06-10T03:00:00Z', '2026-09-10T03:00:00Z'][n - 1]!,
  }))

  test.afterAll(async () => {
    const ids = (k: 'account' | 'profile' | 'member') => PIXEL.map((p) => p[k])
    await query('DELETE FROM project_members WHERE id = ANY($1::uuid[])', [ids('member')])
    await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [ids('profile')])
    await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [ids('account')])
  })

  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S06')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S06')!, {
      beforeNavigate: async () => {
        for (const p of PIXEL) {
          await query(
            `INSERT INTO user_accounts (id, email, email_normalized, status) VALUES ($1, $2, $2, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
            [p.account, `pixel-${p.member}@example.test`],
          )
          await query(
            `INSERT INTO individual_profiles (id, account_id, display_name, status) VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
            [p.profile, p.account, p.name],
          )
          await query(
            `INSERT INTO project_members (id, project_id, profile_id, role_label, state, joined_at) VALUES ($1, $2, $3, $4, 'ACTIVE', $5) ON CONFLICT (id) DO NOTHING`,
            [p.member, FIXTURES.demoStartupId, p.profile, p.role, p.joined],
          )
        }
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-team-table] [role="row"]')).toHaveCount(6)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    expect(full.below_reference?.unexpected_pixels, 'UI below the reference height').toBe(0)

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
    // Reference text boxes (glyphs differ by typography migration or copy).
    const REF_TEXT: Rect[] = [
      { x: 60, y: 20, width: 300, height: 46 },
      { x: 1250, y: 32, width: 106, height: 18 },
      { x: 84, y: 122, width: 910, height: 18 },
      ...[184, 255, 332, 409, 486].flatMap((y) => [
        { x: 128, y: y - 10, width: 300, height: 20 },
        { x: 444, y: y - 10, width: 230, height: 20 },
        { x: 684, y: y - 10, width: 230, height: 20 },
        { x: 924, y: y - 10, width: 190, height: 20 },
      ]),
      { x: 1136, y: 178, width: 80, height: 14 },
      { x: 84, y: 566, width: 620, height: 74 },
      { x: 750, y: 566, width: 620, height: 74 },
    ]
    // Row actions: "Đổi quyền" → "Tuỳ chọn" menu (G4), "Gửi lại" → "Huỷ lời mời" (G3/G6).
    const ROW_ACTIONS: Rect = { x: 1120, y: 222, width: 250, height: 296 }
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S06.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'editor-header', reference: { x: 0, y: 0, width: 1440, height: 90 }, dy: 0 },
        { name: 'team-table', reference: { x: 0, y: 90, width: 1440, height: 445 }, dy: 0 },
        { name: 'note-cards', reference: { x: 0, y: 535, width: 1440, height: 184 }, dy: 0 },
      ],
      [...textMask, ...REF_TEXT, ROW_ACTIONS],
      { diffPath },
    )
    writeJsonReport('WF02-S06.segments.json', {
      screen_id: 'WF02-S06',
      state: qaConfigFor('WF02-S06')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 1127, y: 464, width: 87, height: 44 },
          reason: 'DEC-WF02-S06-G3: "Gửi lại" (resend) not rendered; no outbound email in P0',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reference_region: ROW_ACTIONS,
          reason:
            'DEC-WF02-S06-G4/G6: "Đổi quyền" becomes the "Tuỳ chọn" menu (Sửa vai trò, Gỡ khỏi đội); a pending row offers "Huỷ lời mời"',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S06-G4/G5: "Quyền" shows Chủ sở hữu / Thành viên only (no Biên tập / Chỉ xem tiers); the owner row "Tham gia từ" is "—"',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 547, width: 646, height: 116 },
          reason:
            'DEC-WF02-H7: "Ba mức quyền" (tiers, data room, submitting solutions) replaced by the role-is-display-only note; frame compared, text masked',
        },
        {
          class: 'INTENTIONAL-COPY',
          reference_region: { x: 730, y: 547, width: 646, height: 116 },
          reason:
            'history note keeps the canonical rule without WF05 milestones; frame compared, text masked',
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
