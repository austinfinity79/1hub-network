import type { Browser } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { completedAccount } from '../../visual/support/onboarding'
import { createVenture, freshAddress, invite } from '../../visual/support/workspace'
import { expect, gap, test, uatHooks } from './uat'
import { VENTURES } from './ventures'

/**
 * UC10 — User không có quyền sửa entity của người khác. An outsider, a Xem
 * member and a Biên tập member try to edit, delete, invite, change visibility,
 * take ownership and spoof a role. The backend refuses; the stored venture,
 * team and visibility do not change. Hidden buttons are not the proof.
 */
uatHooks()

async function person(browser: Browser, label: string) {
  const context = await browser.newContext()
  const account = await completedAccount(context.request, label, { display_name: label })
  return { context, request: context.request, account }
}

const snapshot = async (ventureId: string) => ({
  venture: await query(
    `SELECT name, summary, status::text AS status, visibility::text AS visibility,
            owner_profile_id::text AS owner, owner_role_label, stage_id::text AS stage
       FROM projects WHERE id = $1`,
    [ventureId],
  ),
  team: await query(
    `SELECT id::text, state::text AS state, permission, role_label, profile_id::text AS profile
       FROM project_members WHERE project_id = $1 ORDER BY id`,
    [ventureId],
  ),
})

test('UC10 · UI+API+DB · outsider, Xem and Biên tập cannot edit, delete, invite, publish, take ownership or spoof', async ({
  page,
  browser,
}) => {
  await completedAccount(page.request, 'uat-uc10-owner')
  const v = await createVenture(page.request, {
    type: 'STARTUP',
    name: `UAT Quyền ${Date.now()}`,
    owner_role_label: 'Founder',
  })
  const editor = await person(browser, 'uat-uc10-edit')
  const viewer = await person(browser, 'uat-uc10-view')
  const outsider = await person(browser, 'uat-uc10-out')
  for (const [who, permission] of [
    [editor, 'EDIT'],
    [viewer, 'VIEW'],
  ] as const) {
    const sent = await invite(page.request, v.id, { email: who.account.email, permission })
    expect(
      (
        await who.request.post(`${VENTURES}/${v.id}/team/invitations/${sent.membership_id}/accept`)
      ).status(),
    ).toBe(200)
  }
  const before = await snapshot(v.id)
  const editorRow = (before.team as { id: string; permission: string }[]).find(
    (r) => r.permission === 'EDIT',
  )!
  const spoof = {
    'x-role': 'PLATFORM_ADMIN',
    'x-permission': 'OWNER',
    'x-profile-id': editor.account.profileId,
    'x-account-id': editor.account.accountId,
  }

  // Each attempt, by each actor, with the status the backend must answer.
  const attempts: [string, typeof viewer, () => Promise<number>, number[]][] = []
  for (const [who, level] of [
    [outsider, 'outsider'],
    [viewer, 'VIEW'],
    [editor, 'EDIT'],
  ] as const) {
    const r = who.request
    const deny = level === 'outsider' ? [404] : [403]
    attempts.push(
      [
        `${level} edit`,
        who,
        async () =>
          (
            await r.patch(`${VENTURES}/${v.id}`, { data: { name: 'Bị sửa' }, headers: spoof })
          ).status(),
        level === 'EDIT' ? [] : deny,
      ],
      [
        `${level} delete`,
        who,
        async () => (await r.delete(`${VENTURES}/${v.id}`, { headers: spoof })).status(),
        [404, 405],
      ],
      [
        `${level} invite`,
        who,
        async () =>
          (
            await r.post(`${VENTURES}/${v.id}/team/invitations`, {
              data: { email: freshAddress('uc10'), permission: 'EDIT' },
              headers: spoof,
            })
          ).status(),
        deny,
      ],
      [
        `${level} publish`,
        who,
        async () => (await r.post(`${VENTURES}/${v.id}/publish`, { headers: spoof })).status(),
        deny,
      ],
      [
        `${level} visibility`,
        who,
        async () =>
          (await r.patch(`${VENTURES}/${v.id}`, { data: { visibility: 'PUBLIC' } })).status(),
        level === 'outsider' ? [404, 422] : [403, 422],
      ],
      [
        `${level} ownership`,
        who,
        async () =>
          (
            await r.patch(`${VENTURES}/${v.id}`, {
              data: { owner_profile_id: who.account.profileId },
            })
          ).status(),
        level === 'outsider' ? [404, 422] : [403, 422],
      ],
      [
        `${level} own level`,
        who,
        async () =>
          (
            await r.patch(`${VENTURES}/${v.id}/team/${editorRow.id}`, {
              data: { permission: 'OWNER', role_label: 'Owner' },
              headers: spoof,
            })
          ).status(),
        deny,
      ],
      [
        `${level} remove a member`,
        who,
        async () => (await r.delete(`${VENTURES}/${v.id}/team/${editorRow.id}`)).status(),
        deny,
      ],
      [
        `${level} creator role`,
        who,
        async () =>
          (await r.patch(`${VENTURES}/${v.id}`, { data: { owner_role_label: 'CEO' } })).status(),
        level === 'outsider' ? [404] : [403],
      ],
    )
  }
  const results: string[] = []
  for (const [label, , attempt, allowed] of attempts) {
    if (allowed.length === 0) continue
    const status = await attempt()
    if (!allowed.includes(status))
      results.push(`${label}: ${status} (expected ${allowed.join('/')})`)
  }
  expect(results, 'unauthorized mutations the backend let through').toEqual([])
  // The owner cannot give ownership away through the team or the venture either.
  expect(
    (
      await page.request.patch(`${VENTURES}/${v.id}/team/${editorRow.id}`, {
        data: { permission: 'OWNER' },
      })
    ).status(),
  ).toBe(422)
  expect(
    (
      await page.request.patch(`${VENTURES}/${v.id}`, {
        data: { owner_profile_id: editor.account.profileId },
      })
    ).status(),
  ).toBe(422)
  expect(await snapshot(v.id)).toEqual(before)

  // The screens offer each actor only what they may do (a check, not the proof).
  const viewerPage = await viewer.context.newPage()
  await viewerPage.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
  await expect(viewerPage.locator('[data-state="read-only"]')).toBeVisible()
  await expect(viewerPage.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0)
  await expect(viewerPage.locator('[data-publication]')).toHaveCount(0)
  await viewerPage.goto('/projects', { waitUntil: 'networkidle' })
  await expect(
    viewerPage.locator(`[data-venture="${v.id}"] [data-nav="venture-view"]`),
  ).toBeVisible()
  await expect(
    viewerPage.locator(`[data-venture="${v.id}"] [data-nav="venture-invite"]`),
  ).toHaveCount(0)
  const outsiderPage = await outsider.context.newPage()
  expect((await outsiderPage.goto(`/projects/${v.id}/edit`))?.status()).toBe(404)

  // Another member's profile: there is no route to write it; own-profile writes ignore ids.
  const other = await outsider.request.patch('/api/v1/me/profile', {
    data: { profile_id: editor.account.profileId, display_name: 'Chiếm hồ sơ' },
  })
  expect(other.status()).toBe(422)
  expect(
    (
      await outsider.request.patch(`/api/v1/profiles/${editor.account.profileId}`, {
        data: { display_name: 'Chiếm hồ sơ' },
      })
    ).status(),
  ).toBe(404)
  // A profile id in the query is ignored: the write lands on the caller's own profile.
  const own = await outsider.request.patch(
    `/api/v1/me/profile?profile_id=${editor.account.profileId}`,
    { data: { headline: 'Thử IDOR' } },
  )
  expect(own.status()).toBe(200)
  const [outsiderProfile] = await query<{ headline: string }>(
    'SELECT headline FROM individual_profiles WHERE id = $1',
    [outsider.account.profileId],
  )
  expect(outsiderProfile!.headline).toBe('Thử IDOR')
  const [editorProfile] = await query<{ display_name: string }>(
    'SELECT display_name FROM individual_profiles WHERE id = $1',
    [editor.account.profileId],
  )
  expect(editorProfile!.display_name).toBe('uat-uc10-edit')

  gap(
    'PRODUCT GAP',
    'Owner-side "xóa entity" and "chuyển quyền sở hữu" are not built (no delete or transfer endpoint; DEC-WF02-H8): nobody, the owner included, can delete or transfer a venture.',
  )
  await Promise.all([editor.context.close(), viewer.context.close(), outsider.context.close()])
})

test('UC10 · exceptions · a Biên tập member removed while the editor is open cannot save', async ({
  page,
  browser,
}) => {
  await completedAccount(page.request, 'uat-uc10-o2')
  const v = await createVenture(page.request, {
    type: 'PROJECT',
    name: `UAT Thu Hồi ${Date.now()}`,
  })
  const editor = await person(browser, 'uat-uc10-e2')
  const sent = await invite(page.request, v.id, { email: editor.account.email, permission: 'EDIT' })
  await editor.request.post(`${VENTURES}/${v.id}/team/invitations/${sent.membership_id}/accept`)
  const editorPage = await editor.context.newPage()
  await editorPage.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
  await expect(editorPage.getByRole('button', { name: 'Lưu', exact: true })).toBeVisible()

  // The owner revokes the membership while that page is open.
  expect(
    (await page.request.delete(`${VENTURES}/${v.id}/team/${sent.membership_id}`)).status(),
  ).toBe(200)
  const before = await snapshot(v.id)
  await editorPage.locator('#ve-name').fill('Sửa sau khi bị gỡ')
  const saved = editorPage.waitForResponse(
    (r) => r.url().endsWith(`/ventures/${v.id}`) && r.request().method() === 'PATCH',
  )
  await editorPage.getByRole('button', { name: 'Lưu', exact: true }).click()
  expect((await saved).status()).toBe(404)
  await expect(editorPage.getByText('Chưa lưu được thay đổi. Vui lòng thử lại.')).toBeVisible()
  expect(await snapshot(v.id)).toEqual(before)
  await editor.context.close()
})
