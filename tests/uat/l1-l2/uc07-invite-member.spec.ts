import type { Browser } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { completedAccount } from '../../visual/support/onboarding'
import { createVenture, freshAddress, invite } from '../../visual/support/workspace'
import { expect, gap, test, uatHooks } from './uat'
import { VENTURES } from './ventures'

/**
 * UC07 — Owner mời thành viên vào Project/Startup, by e-mail (Alpha): the
 * owner chooses role and level, the invitation is PENDING, nobody joins yet.
 * Invitation by link is DEFERRED (DEC-PDF-D2).
 */
uatHooks()

async function member(browser: Browser, label: string) {
  const context = await browser.newContext()
  const account = await completedAccount(context.request, label, { display_name: label })
  return { context, request: context.request, account }
}

const rows = (ventureId: string) =>
  query<{ state: string; permission: string; role: string | null; profile: string | null }>(
    `SELECT state::text AS state, permission, role_label AS role, profile_id::text AS profile
       FROM project_members WHERE project_id = $1 ORDER BY invited_at NULLS FIRST, id`,
    [ventureId],
  )

test('UC07 · UI+API+DB · the owner invites by e-mail with role and level; PENDING, nobody joined', async ({
  page,
}) => {
  await completedAccount(page.request, 'uat-uc07', { display_name: 'Chủ UC07' })
  const v = await createVenture(page.request, {
    type: 'STARTUP',
    name: `UAT Mời ${Date.now()}`,
    owner_role_label: 'Founder',
  })
  // Mở hồ sơ → Mời thành viên.
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await page.locator(`[data-venture="${v.id}"] [data-nav="venture-invite"]`).click()
  await expect(page).toHaveURL(`/projects/${v.id}/team`)
  await page.getByRole('button', { name: 'Mời thành viên' }).click()
  const address = freshAddress('uat-uc07-invitee')
  await page.locator('#team-invite-email').fill(address)
  await page.locator('#team-invite-role').fill('CTO')
  await page.locator('#team-invite-permission').selectOption('EDIT')
  const sent = page.waitForResponse((r) => r.url().endsWith('/team/invitations'))
  await page.getByRole('button', { name: 'Gửi lời mời' }).click()
  expect((await sent).status()).toBe(201)
  const pending = page.locator('[data-row-kind="PENDING_INVITATION"]')
  await expect(pending).toContainText(address)
  await expect(pending).toContainText('CTO')
  await expect(pending).toContainText('Biên tập')

  // API: the owner's team shows the pending row; the owner is the only member.
  const team = await (await page.request.get(`${VENTURES}/${v.id}/team`)).json()
  expect(team.counts).toEqual({ members: 1, pending: 1 })
  // DB: one PENDING_CONFIRMATION row, no profile, no ACTIVE membership.
  expect(await rows(v.id)).toEqual([
    { state: 'PENDING_CONFIRMATION', permission: 'EDIT', role: 'CTO', profile: null },
  ])
  // The e-mail went out (dev outbox) with the approved copy and no token.
  const mail = await (
    await page.request.get(`/dev/outbox/invitations?email=${encodeURIComponent(address)}`)
  ).json()
  expect(mail.subject).toBe(`Bạn được mời tham gia ${v.name} trên 1hub.network`)
  expect(mail.text).toContain(`Chủ UC07 mời bạn tham gia ${v.name} với vai trò CTO.`)
  expect(mail.text).not.toMatch(/token|[0-9a-f]{8}-[0-9a-f]{4}-/i)

  // Invitation by link: drawn in the wizard, inert, no endpoint.
  await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-invite-link] [data-cta-kind="INERT"]')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  // No link endpoint: the path falls to the membership route, which has no POST.
  expect([404, 405]).toContain(
    (await page.request.post(`${VENTURES}/${v.id}/team/invite-links`)).status(),
  )
  gap('DEFERRED', 'Invitation by link and its expiry (DEC-PDF-D2).')
})

test('UC07 · exceptions · current member again, owner cancels, non-owners cannot invite, no escalation', async ({
  page,
  browser,
}) => {
  await completedAccount(page.request, 'uat-uc07-x')
  const v = await createVenture(page.request, { type: 'PROJECT', name: `UAT Mời X ${Date.now()}` })
  const mate = await member(browser, 'uat-uc07-mate')
  const viewer = await member(browser, 'uat-uc07-viewer')
  const outsider = await member(browser, 'uat-uc07-out')
  for (const who of [mate, viewer]) {
    const sent = await invite(page.request, v.id, {
      email: who.account.email,
      permission: who === mate ? 'EDIT' : 'VIEW',
    })
    const ok = await who.request.post(
      `${VENTURES}/${v.id}/team/invitations/${sent.membership_id}/accept`,
    )
    expect(ok.status()).toBe(200)
  }
  const before = await rows(v.id)

  // Email trùng thành viên hiện tại: no second membership can come of it.
  const again = await page.request.post(`${VENTURES}/${v.id}/team/invitations`, {
    data: { email: mate.account.email, permission: 'EDIT' },
  })
  const duplicate = again.status()
  if (duplicate === 201) {
    const { membership_id } = await again.json()
    const accept = await mate.request.post(
      `${VENTURES}/${v.id}/team/invitations/${membership_id}/accept`,
    )
    expect(accept.status()).toBe(409)
    gap(
      'PRODUCT GAP',
      'Inviting the address of a current member is not refused at invite time: a second PENDING invitation is created and e-mailed; accepting it is refused (409), so no duplicate membership results.',
    )
  } else {
    expect([409, 422]).toContain(duplicate)
  }
  const active = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM project_members WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
    [v.id, mate.account.profileId],
  )
  expect(active[0]!.n).toBe(1)

  // Owner hủy lời mời: the pending row is closed and leaves the list.
  const extra = await invite(page.request, v.id, { email: freshAddress('uat-uc07-cancel') })
  expect(
    (await page.request.delete(`${VENTURES}/${v.id}/team/${extra.membership_id}`)).status(),
  ).toBe(200)
  const [cancelled] = await query<{ state: string }>(
    'SELECT state::text AS state FROM project_members WHERE id = $1',
    [extra.membership_id],
  )
  expect(cancelled!.state).toBe('REMOVED')
  await page.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(
    duplicate === 201 ? 1 : 0,
  )

  // Unauthorized inviters: Biên tập and Xem 403, an outsider 404; spoofed headers change nothing.
  const spoof = { 'x-role': 'OWNER', 'x-permission': 'OWNER' }
  const target = { email: freshAddress('uat-uc07-spoof'), permission: 'EDIT' }
  expect(
    (
      await mate.request.post(`${VENTURES}/${v.id}/team/invitations`, {
        data: target,
        headers: spoof,
      })
    ).status(),
  ).toBe(403)
  expect(
    (await viewer.request.post(`${VENTURES}/${v.id}/team/invitations`, { data: target })).status(),
  ).toBe(403)
  expect(
    (
      await outsider.request.post(`${VENTURES}/${v.id}/team/invitations`, { data: target })
    ).status(),
  ).toBe(404)
  // No escalation through the invitation: OWNER is not a level anyone can give.
  const owner = await page.request.post(`${VENTURES}/${v.id}/team/invitations`, {
    data: { email: freshAddress('uat-uc07-owner'), permission: 'OWNER' },
  })
  expect(owner.status()).toBe(422)
  const after = await rows(v.id)
  expect(after.filter((r) => r.state === 'ACTIVE')).toEqual(
    before.filter((r) => r.state === 'ACTIVE'),
  )
  await Promise.all([mate.context.close(), viewer.context.close(), outsider.context.close()])
})
