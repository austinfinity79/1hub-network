import { query } from '../../../src/lib/db/client'
import { completedAccount, reach } from '../../visual/support/onboarding'
import { createVenture, invite } from '../../visual/support/workspace'
import { expect, requestLink, test, uatHooks, unique } from './uat'
import { VENTURES } from './ventures'

/**
 * UC08 — Invitee chấp nhận lời mời. The invited address opens the e-mail,
 * creates its account when it has none, reads the role and the level, and
 * joins only by accepting; both sides then see the ACTIVE relationship.
 */
uatHooks()

const state = async (membershipId: string) =>
  (
    await query<{ state: string; profile: string | null; permission: string }>(
      `SELECT state::text AS state, profile_id::text AS profile, permission
         FROM project_members WHERE id = $1`,
      [membershipId],
    )
  )[0]!

test('UC08 · UI+API+DB · an address without an account signs up, sees role and level, accepts; both sides see it', async ({
  page,
  browser,
}) => {
  const owner = await browser.newContext()
  await completedAccount(owner.request, 'uat-uc08-owner', { display_name: 'Chủ UC08' })
  const v = await createVenture(owner.request, { type: 'PROJECT', name: `UAT Nhận ${Date.now()}` })
  const email = unique('uc08-invitee')
  const sent = await invite(owner.request, v.id, {
    email,
    role_label: 'Cố vấn',
    permission: 'VIEW',
  })

  // Mở email: the link leads to /projects, which asks a guest to sign in.
  const mail = await (
    await page.request.get(`/dev/outbox/invitations?email=${encodeURIComponent(email)}`)
  ).json()
  await page.goto(mail.link)
  await expect(page).toHaveURL('/auth')

  // Tạo account: open sign-up; before onboarding is done the invitation cannot be accepted.
  await page.goto(await requestLink(page, email))
  await expect(page).toHaveURL('/onboarding')
  const early = await page.request.post(
    `${VENTURES}/${v.id}/team/invitations/${sent.membership_id}/accept`,
  )
  expect(early.status()).toBe(403)
  expect(await state(sent.membership_id)).toMatchObject({ state: 'PENDING_CONFIRMATION' })
  await reach(page.request, 'DONE', { display_name: 'Người Được Mời UC08' })

  // Xem vai trò và quyền → Chấp nhận, on ME7.
  await page.goto('/projects', { waitUntil: 'networkidle' })
  const banner = page.locator(`[data-invitation="${sent.membership_id}"]`)
  await expect(banner).toContainText(`${v.name} mời bạn vào đội với vai trò Cố vấn · quyền Xem`)
  await banner.getByRole('button', { name: 'Chấp nhận' }).click()
  await expect(page.locator(`[data-venture="${v.id}"]`)).toBeVisible()
  await expect(page.locator(`[data-venture="${v.id}"] [data-kind="permission"]`)).toHaveText('Xem')

  // API: the invitee reads the venture as a member; the owner's team lists them.
  expect(await (await page.request.get(`${VENTURES}/${v.id}`)).json()).toMatchObject({
    relation: 'MEMBER',
    permission: 'VIEW',
    role_label: 'Cố vấn',
  })
  const team = await (await owner.request.get(`${VENTURES}/${v.id}/team`)).json()
  expect(
    team.rows.map((r: { kind: string; display_name?: string }) => [r.kind, r.display_name ?? null]),
  ).toEqual([
    ['OWNER', 'Chủ UC08'],
    ['ACTIVE_MEMBER', 'Người Được Mời UC08'],
  ])
  // DB: ACTIVE, bound to the invitee's profile, at the invited level.
  const [invitee] = await query<{ id: string }>(
    `SELECT p.id::text FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
      WHERE a.email_normalized = $1`,
    [email],
  )
  expect(await state(sent.membership_id)).toEqual({
    state: 'ACTIVE',
    profile: invitee!.id,
    permission: 'VIEW',
  })
  // The owner's team page shows the member.
  const ownerPage = await owner.newPage()
  await ownerPage.goto(`/projects/${v.id}/team`, { waitUntil: 'networkidle' })
  await expect(ownerPage.locator('[data-row-kind="ACTIVE_MEMBER"]')).toContainText(
    'Người Được Mời UC08',
  )
  await owner.close()
})

test('UC08 · exceptions · wrong account, revoked, declined; expiry', async ({ page, browser }) => {
  const owner = await browser.newContext()
  await completedAccount(owner.request, 'uat-uc08-o2')
  const v = await createVenture(owner.request, {
    type: 'STARTUP',
    name: `UAT Nhận X ${Date.now()}`,
  })
  const invitee = await completedAccount(page.request, 'uat-uc08-i2')
  const wrong = await browser.newContext()
  await completedAccount(wrong.request, 'uat-uc08-wrong')

  // User đăng nhập sai account: sees nothing of it and cannot answer it.
  const first = await invite(owner.request, v.id, { email: invitee.email })
  const wrongPage = await wrong.newPage()
  await wrongPage.goto('/projects', { waitUntil: 'networkidle' })
  await expect(wrongPage.locator('[data-invitation]')).toHaveCount(0)
  for (const action of ['accept', 'decline']) {
    const res = await wrong.request.post(
      `${VENTURES}/${v.id}/team/invitations/${first.membership_id}/${action}`,
    )
    expect(res.status(), action).toBe(404)
  }
  expect(await state(first.membership_id)).toMatchObject({ state: 'PENDING_CONFIRMATION' })

  // Từ chối: REJECTED, no membership, the venture stays out of reach.
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await page
    .locator(`[data-invitation="${first.membership_id}"]`)
    .getByRole('button', { name: 'Từ chối' })
    .click()
  await expect(page.locator('[data-invitation]')).toHaveCount(0)
  expect(await state(first.membership_id)).toMatchObject({ state: 'REJECTED', profile: null })
  expect((await page.request.get(`${VENTURES}/${v.id}`)).status()).toBe(404)

  // Lời mời bị thu hồi: the owner cancels while the invitee's page is open.
  const second = await invite(owner.request, v.id, { email: invitee.email })
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await expect(page.locator(`[data-invitation="${second.membership_id}"]`)).toBeVisible()
  expect(
    (await owner.request.delete(`${VENTURES}/${v.id}/team/${second.membership_id}`)).status(),
  ).toBe(200)
  await page
    .locator(`[data-invitation="${second.membership_id}"]`)
    .getByRole('button', { name: 'Chấp nhận' })
    .click()
  await expect(page.getByText('Lời mời này không còn hiệu lực.')).toBeVisible()
  expect(await state(second.membership_id)).toMatchObject({ state: 'REMOVED', profile: null })
  expect(
    await query('SELECT 1 FROM project_members WHERE project_id = $1 AND state = $2', [
      v.id,
      'ACTIVE',
    ]),
  ).toEqual([])

  // Invitation expiry exists since S1-UAT-07 (DEC-S1I D4, superseding the
  // "no expiry" of DEC-PDF-D2): every invitation carries its 7-day end.
  const [ends] = await query<{ ends: Date | null }>(
    'SELECT invite_expires_at AS ends FROM project_members WHERE id = $1',
    [second.membership_id],
  )
  expect(ends!.ends).not.toBeNull()
  await Promise.all([owner.close(), wrong.close()])
})
