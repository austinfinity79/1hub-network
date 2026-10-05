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
import { applyVocabularyFixture, completedAccount, watchConsole } from '../support/onboarding'
import { createVenture, freshAddress, invite } from '../support/workspace'

/**
 * WF02-S06 — Venture team / members (/projects/:id/team).
 * Decisions DEC-L2R-D7 (Chủ sở hữu from ownership; Biên tập / Xem per member,
 * set by the owner; only the owner manages the team) and DEC-L2R-D8 (the
 * invitation is e-mailed, nobody joins before accepting, the invitee sees only
 * their own invitation, 20 pending at most); DEC-WF02-S06-G1..G9; migrations
 * 008 and 011.
 */

const VENTURES = '/api/v1/ventures'
const NIL = '00000000-0000-0000-0000-000000000000'

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

const member = (request: APIRequestContext, label: string, display_name = label) =>
  completedAccount(request, `s06-${label}`, { display_name })

/** Another member, signed in in a browser context of their own. */
async function persona(browser: Browser, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  watchConsole(page, consoleErrors)
  const account = await member(page.request, label)
  return { context, page, request: page.request, ...account }
}

/** A venture of the signed-in owner, with a name no other run shares. */
const newVenture = (request: APIRequestContext, name = 'Team QA') =>
  createVenture(request, {
    type: 'STARTUP',
    name: `${name} ${Math.random().toString(36).slice(2, 7)}`,
    owner_role_label: 'Founder',
  })

async function rowOf(id: string) {
  const [row] = await query<{
    state: string
    profile_id: string | null
    permission: string
    role_label: string | null
  }>(
    `SELECT state::text AS state, profile_id::text, permission, role_label
       FROM project_members WHERE id = $1`,
    [id],
  )
  return row!
}

const outbox = (request: APIRequestContext, email: string) =>
  request.get(`/dev/outbox/invitations?email=${encodeURIComponent(email)}`)

const accept = (request: APIRequestContext, ventureId: string, membershipId: string) =>
  request.post(`${VENTURES}/${ventureId}/team/invitations/${membershipId}/accept`)

test.describe('WF02-S06 guards', () => {
  test('guest → /auth on the page; every team API 401', async ({ page, request }) => {
    await page.goto(`/projects/${NIL}/team`)
    await expect(page).toHaveURL('/auth')
    const base = `${VENTURES}/${NIL}/team`
    for (const r of [
      await request.get(base),
      await request.post(`${base}/invitations`, {
        data: { email: 'a@example.test', permission: 'VIEW' },
      }),
      await request.patch(`${base}/${NIL}`, { data: { permission: 'EDIT' } }),
      await request.delete(`${base}/${NIL}`),
      await request.post(`${base}/invitations/${NIL}/accept`),
      await request.post(`${base}/invitations/${NIL}/decline`),
      await request.get('/api/v1/me/venture-invitations'),
    ]) {
      expect(r.status(), r.url()).toBe(401)
    }
  })

  test('onboarding not DONE → resolver step on the page', async ({ page }) => {
    expect(
      (await page.request.post('/dev/login', { data: { email: freshAddress('s06-new') } })).ok(),
    ).toBe(true)
    await page.goto(`/projects/${FIXTURES.demoStartupId}/team`)
    await expect(page).toHaveURL('/onboarding')
  })
})

test.describe('WF02-S06 team journeys (UI)', () => {
  test('permission column; invite with a level; the e-mail; invitee-only view; accept; change role and level; remove', async ({
    browser,
    page,
  }) => {
    const owner = await member(page.request, 'owner', 'Chủ Đội QA')
    const v = await newVenture(page.request)
    const mate = await persona(browser, 'mate')

    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-team-view]')).toHaveAttribute('data-viewer', 'OWNER')
    await expect(page.locator('[data-team-table] [role="columnheader"]')).toHaveText([
      'Thành viên',
      'Vai trò',
      'Quyền',
      'Tham gia từ',
      '',
    ])
    const ownerRow = page.locator('[data-row-kind="OWNER"]')
    await expect(ownerRow.getByRole('cell')).toHaveText([
      'Chủ Đội QA',
      'Founder',
      'Chủ sở hữu',
      '—',
      'Không gỡ được',
    ])
    await expect(ownerRow.getByRole('button')).toHaveCount(0)
    await expect(page.getByText('Gửi lại')).toHaveCount(0)

    await page.getByRole('button', { name: 'Mời thành viên' }).click()
    await expect(page.locator('#team-invite-permission')).toHaveValue('VIEW')
    await expect(page.locator('#team-invite-permission option')).toHaveText(['Biên tập', 'Xem'])
    await page.locator('#team-invite-email').fill(mate.email.toUpperCase())
    await page.locator('#team-invite-role').fill('CTO')
    await page.locator('#team-invite-permission').selectOption('EDIT')
    await page.getByRole('button', { name: 'Gửi lời mời' }).click()
    await expect(page.locator('[data-state="invite-created"]')).toHaveText('Đã gửi lời mời.')
    const pendingRow = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(pendingRow.getByRole('cell').nth(0)).toHaveText(mate.email)
    await expect(pendingRow.getByRole('cell').nth(1)).toHaveText('CTO')
    await expect(pendingRow.getByRole('cell').nth(2)).toHaveText('Biên tập')
    await expect(pendingRow.getByRole('cell').nth(3)).toContainText('lời mời gửi')
    await expect(page.locator('[data-shell="editor-header"] [data-status]')).toHaveText(
      '1 thành viên · 1 lời mời chưa nhận',
    )
    const [inv] = await query<{ id: string }>(
      `SELECT id::text FROM project_members WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'`,
      [v.id],
    )
    expect(await rowOf(inv!.id)).toEqual({
      state: 'PENDING_CONFIRMATION',
      profile_id: null,
      permission: 'EDIT',
      role_label: 'CTO',
    })

    // The e-mail names the venture, the role and the level; it carries no token.
    const mail = await outbox(page.request, mate.email)
    expect(mail.status()).toBe(200)
    const { subject, text, link } = await mail.json()
    // DEC-PDF-D4: the approved subject and sentence; the level is not in the e-mail.
    expect(subject).toBe(`Bạn được mời tham gia ${v.name} trên 1hub.network`)
    expect(text).toContain(` mời bạn tham gia ${v.name} với vai trò CTO.`)
    expect(text).not.toContain('quyền')
    expect(new URL(link).pathname).toBe('/projects')
    expect(new URL(link).search).toBe('')
    for (const leak of [/token/i, /[?&](t|k|code)=/, new RegExp(owner.email), /[0-9a-f-]{36}/])
      expect(`${subject}\n${text}\n${link}`).not.toMatch(leak)

    // Signing in is not accepting: the invitee sees only their own invitation.
    expect((await mate.request.get(`${VENTURES}/${v.id}`)).status()).toBe(404)
    expect((await mate.request.get(`${VENTURES}/${v.id}/team`)).status()).toBe(404)
    const listed = await (await mate.request.get('/api/v1/me/venture-invitations')).json()
    expect(listed.items).toEqual([
      {
        venture: { id: v.id, name: v.name, type: 'STARTUP' },
        membership_id: inv!.id,
        role_label: 'CTO',
        permission: 'EDIT',
        invited_at: expect.any(String),
        expires_at: expect.any(String),
      },
    ])
    await mate.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(mate.page.locator('[data-team-invitation]')).toContainText('CTO')
    await expect(mate.page.locator('[data-team-table]')).toHaveCount(0)
    await expect(mate.page.locator('body')).not.toContainText('Chủ Đội QA')
    expect((await rowOf(inv!.id)).state).toBe('PENDING_CONFIRMATION')
    await mate.page.getByRole('button', { name: 'Chấp nhận' }).click()
    await expect(mate.page.locator('[data-team-view]')).toHaveAttribute('data-viewer', 'MEMBER')
    await expect(mate.page.locator('[data-state="read-only"]')).toBeVisible()
    await expect(mate.page.getByRole('button', { name: 'Mời thành viên' })).toHaveCount(0)
    await expect(mate.page.getByRole('button', { name: 'Tuỳ chọn' })).toHaveCount(0)
    await expect(
      mate.page.locator('[data-row-kind="ACTIVE_MEMBER"]').getByRole('cell').nth(2),
    ).toHaveText('Biên tập')
    expect(await rowOf(inv!.id)).toMatchObject({
      state: 'ACTIVE',
      profile_id: mate.profileId,
      permission: 'EDIT',
    })

    // The owner changes the role and the level, then removes the member.
    await page.reload({ waitUntil: 'networkidle' })
    const row = page.locator('[data-row-kind="ACTIVE_MEMBER"]')
    await expect(row.getByRole('cell').nth(2)).toHaveText('Biên tập')
    await row.getByRole('button', { name: 'Tuỳ chọn' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Sửa vai trò và quyền', 'Gỡ khỏi đội'])
    await page.getByRole('menuitem', { name: 'Sửa vai trò và quyền' }).click()
    await row.getByRole('textbox', { name: 'Vai trò' }).fill('Cố vấn kỹ thuật')
    await row.getByRole('combobox', { name: 'Quyền' }).selectOption('VIEW')
    await row.getByRole('button', { name: 'Lưu' }).click()
    await expect(row.getByRole('cell').nth(1)).toHaveText('Cố vấn kỹ thuật')
    await expect(row.getByRole('cell').nth(2)).toHaveText('Xem')
    expect(await rowOf(inv!.id)).toMatchObject({
      state: 'ACTIVE',
      permission: 'VIEW',
      role_label: 'Cố vấn kỹ thuật',
    })
    const [changed] = await query<{ before: unknown; after: unknown }>(
      `SELECT before_data AS before, after_data AS after FROM audit_events
        WHERE action = 'VENTURE_TEAM_ROLE_CHANGED' AND resource_id::text = $1`,
      [inv!.id],
    )
    expect(changed).toEqual({
      before: { project_id: v.id, state: 'ACTIVE', permission: 'EDIT' },
      after: { project_id: v.id, state: 'ACTIVE', permission: 'VIEW' },
    })
    // Xem now: the venture is read-only for the member.
    expect(
      (await mate.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'x' } })).status(),
    ).toBe(403)

    await row.getByRole('button', { name: 'Tuỳ chọn' }).click()
    await page.getByRole('menuitem', { name: 'Gỡ khỏi đội' }).click()
    await row.getByRole('button', { name: 'Gỡ', exact: true }).click()
    await expect(page.locator('[data-row-kind="ACTIVE_MEMBER"]')).toHaveCount(0)
    expect((await rowOf(inv!.id)).state).toBe('REMOVED')

    // Removed: no venture:read any more.
    const gone = await mate.page.goto(`/projects/${v.id}/team`)
    expect(gone?.status()).toBe(404)
    expect((await (await mate.request.get('/api/v1/me/ventures')).json()).items).toEqual([])
    await mate.context.close()
  })

  test('decline from the page; the owner cancels a pending invitation', async ({
    browser,
    page,
  }) => {
    await member(page.request, 'owner2')
    const v = await newVenture(page.request)
    const invitee = await persona(browser, 'decliner')
    const declined = await invite(page.request, v.id, { email: invitee.email })
    const cancelled = await invite(page.request, v.id, {
      email: freshAddress('cancel-me'),
      permission: 'EDIT',
    })

    await invitee.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await invitee.page.getByRole('button', { name: 'Từ chối' }).click()
    await expect(invitee.page.locator('[data-state="declined"]')).toBeVisible()
    expect(await rowOf(declined.membership_id)).toMatchObject({
      state: 'REJECTED',
      profile_id: null,
    })
    expect((await invitee.page.goto(`/projects/${v.id}/team`))?.status()).toBe(404)
    expect(
      (await (await invitee.request.get('/api/v1/me/venture-invitations')).json()).items,
    ).toEqual([])

    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    const pending = page.locator('[data-row-kind="PENDING_INVITATION"]')
    await expect(pending).toHaveCount(1)
    await pending.getByRole('button', { name: 'Huỷ lời mời' }).click()
    await expect(pending.getByRole('group')).toContainText('Huỷ lời mời này?')
    await pending.getByRole('button', { name: 'Huỷ lời mời' }).click()
    await expect(page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(0)
    expect((await rowOf(cancelled.membership_id)).state).toBe('REMOVED')
    await invitee.context.close()
  })

  test('Biên tập cannot manage the team: no control on the page, 403 on every team mutation', async ({
    browser,
    page,
  }) => {
    await member(page.request, 'owner3')
    const v = await newVenture(page.request)
    const editor = await persona(browser, 'editor')
    const other = await persona(browser, 'other')
    const joined = await invite(page.request, v.id, { email: editor.email, permission: 'EDIT' })
    expect((await accept(editor.request, v.id, joined.membership_id)).status()).toBe(200)
    const peer = await invite(page.request, v.id, { email: other.email, permission: 'VIEW' })
    expect((await accept(other.request, v.id, peer.membership_id)).status()).toBe(200)
    const waiting = await invite(page.request, v.id, { email: freshAddress('waiting') })

    await editor.page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
    await expect(editor.page.locator('[data-team-view]')).toHaveAttribute('data-viewer', 'MEMBER')
    await expect(editor.page.locator('[data-state="read-only"]')).toHaveText(
      'Chỉ chủ sở hữu mới quản lý được đội. Bạn đang xem danh sách đội.',
    )
    for (const control of ['Mời thành viên', 'Tuỳ chọn', 'Huỷ lời mời', 'Gỡ'])
      await expect(editor.page.getByRole('button', { name: control }), control).toHaveCount(0)
    await expect(editor.page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(0)
    await expect(editor.page.locator('[data-row-kind="ACTIVE_MEMBER"]')).toHaveCount(2)
    // Biên tập edits the venture itself (DEC-L2R-D7), nothing of the team.
    expect(
      (
        await editor.request.patch(`${VENTURES}/${v.id}`, { data: { name: `${v.name} 2` } })
      ).status(),
    ).toBe(200)

    const team = `${VENTURES}/${v.id}/team`
    for (const r of [
      await editor.request.post(`${team}/invitations`, {
        data: { email: freshAddress('x'), permission: 'VIEW' },
      }),
      await editor.request.patch(`${team}/${peer.membership_id}`, { data: { permission: 'EDIT' } }),
      await editor.request.patch(`${team}/${joined.membership_id}`, {
        data: { role_label: 'Owner' },
      }),
      await editor.request.delete(`${team}/${peer.membership_id}`),
      await editor.request.delete(`${team}/${waiting.membership_id}`),
    ]) {
      expect(r.status(), r.url()).toBe(403)
      expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
    }
    expect(await rowOf(peer.membership_id)).toMatchObject({ state: 'ACTIVE', permission: 'VIEW' })
    expect(await rowOf(joined.membership_id)).toMatchObject({ permission: 'EDIT' })
    expect((await rowOf(waiting.membership_id)).state).toBe('PENDING_CONFIRMATION')
    for (const c of [editor, other]) await c.context.close()
  })
})

test.describe('WF02-S06 API security', () => {
  test('IDOR, enumeration, privacy, cross-project, concurrency, team limit, audit', async ({
    browser,
    page,
  }) => {
    const owner = await member(page.request, 'own')
    const v = await newVenture(page.request, 'Sec A')
    const w = await newVenture(page.request, 'Sec B')
    const mate = await persona(browser, 'sec-mate')
    const stranger = await persona(browser, 'sec-stranger')
    const other = await persona(browser, 'sec-other')
    const team = `${VENTURES}/${v.id}/team`

    // Enumeration: a registered and an unknown address give the same answer shape.
    const a = await page.request.post(`${team}/invitations`, { data: { email: other.email } })
    const b = await page.request.post(`${team}/invitations`, {
      data: { email: freshAddress('never-registered') },
    })
    expect([a.status(), b.status()]).toEqual([201, 201])
    const [ja, jb] = [await a.json(), await b.json()]
    expect(Object.keys(ja).sort()).toEqual(Object.keys(jb).sort())
    expect(Object.keys(ja).sort()).toEqual([
      'email',
      'expired',
      'expires_at',
      'invited_at',
      'kind',
      'membership_id',
      'permission',
      'resent',
      'role_label',
    ])
    expect(ja.permission).toBe('VIEW')
    expect(JSON.stringify(ja)).not.toContain(other.profileId)

    // Mate joins through the real path, with a role label that sounds like authority.
    const joined = await invite(page.request, v.id, {
      email: mate.email,
      role_label: 'Owner',
      permission: 'EDIT',
    })
    // Another signed-in user cannot accept or decline it.
    for (const kind of ['accept', 'decline']) {
      const r = await other.request.post(`${team}/invitations/${joined.membership_id}/${kind}`)
      expect(r.status(), kind).toBe(404)
    }
    // Concurrent accepts: one ACTIVE row, one audit event.
    const accepts = await Promise.all(
      [0, 1, 2].map(() => accept(mate.request, v.id, joined.membership_id)),
    )
    expect(accepts.map((r) => r.status())).toEqual([200, 200, 200])
    const active = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
      [v.id, mate.profileId],
    )
    expect(active).toHaveLength(1)

    // A member sees no pending or declined address; no ids or metadata.
    const seen = await (await mate.request.get(team)).json()
    expect([seen.viewer, seen.can_manage, seen.counts.pending]).toEqual(['MEMBER', false, null])
    const json = JSON.stringify(seen)
    for (const leak of [other.email, 'never-registered', owner.email, mate.email])
      expect(json).not.toContain(leak)
    for (const leak of [owner.profileId, mate.profileId]) expect(json).not.toContain(leak)
    expect(json).not.toMatch(/"(email|metadata|slug|profile_id|invited_by_profile_id)"/)

    // Foreign project: the stranger gets 404 everywhere.
    for (const r of [
      await stranger.request.get(team),
      await stranger.request.post(`${team}/invitations`, { data: { email: freshAddress('y') } }),
      await stranger.request.patch(`${team}/${joined.membership_id}`, {
        data: { permission: 'VIEW' },
      }),
      await stranger.request.delete(`${team}/${joined.membership_id}`),
    ]) {
      expect(r.status(), r.url()).toBe(404)
    }
    expect((await stranger.page.goto(`/projects/${v.id}/team`))?.status()).toBe(404)
    // Random and cross-project membership ids → 404, nothing changes.
    for (const r of [
      await page.request.delete(`${team}/${NIL}`),
      await page.request.delete(`${team}/not-a-uuid`),
      await page.request.delete(`${VENTURES}/${w.id}/team/${joined.membership_id}`),
      await page.request.patch(`${VENTURES}/${w.id}/team/${joined.membership_id}`, {
        data: { permission: 'VIEW' },
      }),
    ]) {
      expect(r.status(), r.url()).toBe(404)
    }
    expect(await rowOf(joined.membership_id)).toMatchObject({ state: 'ACTIVE', permission: 'EDIT' })

    // The owner is never a row: inviting the owner's own address is refused.
    const self = await page.request.post(`${team}/invitations`, { data: { email: owner.email } })
    expect(self.status()).toBe(422)

    // Duplicate and concurrent duplicate invites: exactly one pending row. A
    // repeat re-sends it (DEC-S1I D4), at most 3 sends per address a day.
    const dupAddress = freshAddress('dup')
    const dup = await Promise.all(
      [0, 1, 2, 3].map(() =>
        page.request.post(`${team}/invitations`, { data: { email: dupAddress } }),
      ),
    )
    expect(dup.map((r) => r.status()).sort()).toEqual([200, 200, 201, 429])
    expect((await dup.find((r) => r.status() === 429)!.json()).error.code).toBe(
      'INVITATION_RATE_LIMITED',
    )
    const pending = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND invite_email_normalized = $2`,
      [v.id, dupAddress],
    )
    expect(pending).toHaveLength(1)

    // Team bound: 20 people, owner and live invitations counted (DEC-S1I D3,
    // superseding the 20-pending bound of DEC-L2R-D8).
    const { counts } = await (await page.request.get(`${VENTURES}/${w.id}/team`)).json()
    for (let i = counts.members + counts.pending; i < 20; i++)
      await invite(page.request, w.id, { email: freshAddress(`bulk${i}`) })
    const overflow = freshAddress('overflow')
    const tooMany = await page.request.post(`${VENTURES}/${w.id}/team/invitations`, {
      data: { email: overflow },
    })
    expect(tooMany.status()).toBe(409)
    expect((await tooMany.json()).error.code).toBe('TEAM_FULL')
    expect((await outbox(page.request, overflow)).status()).toBe(404)

    // Audit rows carry ids, states and levels only.
    const trail = await query<{ action: string; payload: string }>(
      `SELECT action, coalesce(before_data::text, '') || coalesce(after_data::text, '') AS payload
         FROM audit_events WHERE resource_type = 'project_member' AND after_data->>'project_id' = $1`,
      [v.id],
    )
    expect(new Set(trail.map((x) => x.action))).toEqual(
      new Set(['VENTURE_TEAM_INVITED', 'VENTURE_TEAM_INVITATION_RESENT', 'VENTURE_TEAM_JOINED']),
    )
    expect(trail.filter((x) => x.action === 'VENTURE_TEAM_JOINED')).toHaveLength(1)
    for (const x of trail) expect(x.payload).not.toMatch(/@|token|cookie|role_label|Owner/i)

    for (const c of [mate, stranger, other]) await c.context.close()
  })

  test('spoofed headers, query and body fields never raise a level', async ({ browser, page }) => {
    const owner = await member(page.request, 'spoof-owner')
    const v = await newVenture(page.request, 'Spoof')
    const editor = await persona(browser, 'spoof-edit')
    const viewer = await persona(browser, 'spoof-view')
    const stranger = await persona(browser, 'spoof-stranger')
    const e = await invite(page.request, v.id, { email: editor.email, permission: 'EDIT' })
    const r = await invite(page.request, v.id, { email: viewer.email, permission: 'VIEW' })
    expect((await accept(editor.request, v.id, e.membership_id)).status()).toBe(200)
    expect((await accept(viewer.request, v.id, r.membership_id)).status()).toBe(200)
    const team = `${VENTURES}/${v.id}/team`
    const headers = {
      'x-role': 'OWNER',
      'x-permission': 'OWNER',
      'x-venture-permission': 'OWNER',
      'x-profile-id': owner.profileId,
      'x-account-id': owner.accountId,
      'x-user-email': owner.email,
    }

    // OWNER is ownership, never a level given through the team (DEC-L2R-D7).
    for (const permission of ['OWNER', 'ADMIN', 'edit', null, 1]) {
      const invited = await page.request.post(`${team}/invitations`, {
        data: { email: freshAddress('lvl'), permission },
      })
      expect(invited.status(), String(permission)).toBe(422)
      expect((await invited.json()).error.fields).toEqual({ permission: 'invalid' })
      const changed = await page.request.patch(`${team}/${r.membership_id}`, {
        data: { permission },
      })
      expect(changed.status(), String(permission)).toBe(422)
    }
    // Owner, profile, inviter and state are always the server's.
    for (const key of ['owner_profile_id', 'profile_id', 'state', 'invited_by_profile_id']) {
      const invited = await page.request.post(`${team}/invitations`, {
        data: { email: freshAddress('key'), [key]: viewer.profileId },
      })
      expect(invited.status(), key).toBe(422)
      expect((await invited.json()).error.fields).toEqual({ [key]: 'not_accepted' })
      const changed = await page.request.patch(`${team}/${r.membership_id}`, {
        data: { [key]: viewer.profileId },
      })
      expect(changed.status(), key).toBe(422)
    }

    // Headers and query strings change nothing for a member or a stranger.
    for (const [who, expected] of [
      [editor, 403],
      [viewer, 403],
      [stranger, 404],
    ] as const) {
      for (const res of [
        await who.request.post(`${team}/invitations?as=owner&permission=OWNER`, {
          headers,
          data: { email: freshAddress('spoof'), permission: 'EDIT' },
        }),
        await who.request.patch(`${team}/${r.membership_id}?role=OWNER`, {
          headers,
          data: { permission: 'EDIT' },
        }),
        await who.request.delete(`${team}/${r.membership_id}`, { headers }),
      ]) {
        expect(res.status(), `${who.email} ${res.url()}`).toBe(expected)
      }
    }
    const viewerPatch = await viewer.request.patch(`${VENTURES}/${v.id}`, {
      headers,
      data: { name: 'Hijack' },
    })
    expect(viewerPatch.status()).toBe(403)
    const ownerRole = await editor.request.patch(`${VENTURES}/${v.id}`, {
      headers,
      data: { owner_role_label: 'Co-founder' },
    })
    expect(ownerRole.status()).toBe(403)
    // The listing reads the session only; a query parameter cannot point elsewhere.
    const listed = await (
      await stranger.request.get(`/api/v1/me/ventures?profile_id=${owner.profileId}`, { headers })
    ).json()
    expect(listed.items).toEqual([])
    const seen = await (await viewer.request.get(team, { headers })).json()
    expect([seen.viewer, seen.can_manage]).toEqual(['MEMBER', false])

    expect(await rowOf(r.membership_id)).toMatchObject({ state: 'ACTIVE', permission: 'VIEW' })
    expect(await rowOf(e.membership_id)).toMatchObject({ state: 'ACTIVE', permission: 'EDIT' })
    const [p] = await query<{ owner: string; role: string | null; name: string }>(
      'SELECT owner_profile_id::text AS owner, owner_role_label AS role, name FROM projects WHERE id = $1',
      [v.id],
    )
    expect(p).toEqual({ owner: owner.profileId, role: 'Founder', name: v.name })
    const [rbac] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments
        WHERE individual_profile_id = ANY($1::uuid[])`,
      [[editor.profileId, viewer.profileId]],
    )
    expect(rbac!.n).toBe(0)
    for (const c of [editor, viewer, stranger]) await c.context.close()
  })

  test('a11y: table semantics, labelled invite form, menu state, refusal as an alert', async ({
    page,
    browser,
  }) => {
    await member(page.request, 'a11y')
    const v = await newVenture(page.request, 'A11y')
    const mate = await persona(browser, 'a11y-mate')
    const joined = await invite(page.request, v.id, { email: mate.email, permission: 'EDIT' })
    expect((await accept(mate.request, v.id, joined.membership_id)).status()).toBe(200)
    await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })

    const table = page.getByRole('table', { name: 'Thành viên đội' })
    await expect(table.getByRole('row')).toHaveCount(3)
    await expect(table.getByRole('row').nth(1).getByRole('cell')).toHaveCount(5)

    const open = page.getByRole('button', { name: 'Mời thành viên' })
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await open.focus()
    await page.keyboard.press('Enter')
    await expect(open).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('textbox', { name: 'Email người được mời' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Vai trò (không bắt buộc)' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Quyền' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Email người được mời' }).fill('not-an-email')
    await page.getByRole('button', { name: 'Gửi lời mời' }).click()
    await expect(page.locator('[data-invite-form]').getByRole('alert')).toHaveText(
      'Email chưa hợp lệ.',
    )

    const menu = page.locator('[data-row-kind="ACTIVE_MEMBER"]').getByRole('button', {
      name: 'Tuỳ chọn',
    })
    await expect(menu).toHaveAttribute('aria-haspopup', 'menu')
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveCount(2)
    await menu.click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await mate.context.close()
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
          reason:
            'DEC-WF02-S06-G3: "Gửi lại" (resend) not rendered; one e-mail is sent when the invitation is created (DEC-L2R-D8)',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reference_region: ROW_ACTIONS,
          reason:
            'DEC-WF02-S06-G4/G6, DEC-L2R-D7: "Đổi quyền" becomes the "Tuỳ chọn" menu (Sửa vai trò và quyền, Gỡ khỏi đội); a pending row offers "Huỷ lời mời"',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-L2R-D7: "Quyền" shows Chủ sở hữu (ownership) / Biên tập / Xem with the labels of PRJ2 ("Xem" where the reference says "Chỉ xem"); the owner row "Tham gia từ" is "—"; glyphs masked',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 547, width: 646, height: 116 },
          reason:
            'DEC-L2R-D7: the levels card states the three levels without data room or submitting solutions (L5, DEC-WF02-H8); frame compared, text masked',
        },
        {
          class: 'INTENTIONAL-COPY',
          reference_region: { x: 730, y: 547, width: 646, height: 116 },
          reason:
            'history note keeps the canonical rule without WF05 milestones; frame compared, text masked',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-L2R-D7/D8: the invite form (e-mail, role, Quyền) opens from "Mời thành viên" and is closed in the approved state; not compared',
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
