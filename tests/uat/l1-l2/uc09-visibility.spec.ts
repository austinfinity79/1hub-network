import { query } from '../../../src/lib/db/client'
import { completedAccount, IDS } from '../../visual/support/onboarding'
import { createVenture } from '../../visual/support/workspace'
import { expect, gap, test, uatHooks } from './uat'
import { assertNoLeak, VENTURES } from './ventures'

/**
 * UC09 — User đổi visibility của profile/entity. A: the profile's discovery
 * setting persists and filters what others read; contact and identity stay
 * private. B: a venture stays private while DRAFT and becomes PUBLIC only by
 * its owner's choice on a complete record. Where the UAT expects a Directory
 * or "Mạng lưới" view that the product has not connected, that part is a
 * PRODUCT GAP, not a pass.
 */
uatHooks()

const discovery = async (profileId: string) =>
  (
    await query<{ level: string }>(
      `SELECT COALESCE(v.group_overrides->>'PROFILE_DISCOVERY', v.default_level::text, 'NETWORK_ONLY') AS level
         FROM individual_profiles p LEFT JOIN profile_visibility_settings v ON v.profile_id = p.id
        WHERE p.id = $1`,
      [profileId],
    )
  )[0]!.level

test('UC09 A · UI+API+DB · profile visibility persists and filters others; contact stays private', async ({
  page,
  browser,
}) => {
  const name = `Hồ Sơ UC09 ${Date.now()}`
  const me = await completedAccount(page.request, 'uat-uc09', {
    display_name: name,
    headline: 'Điều phối UC09',
    phone: '0912345678',
  })
  // A join request, so a Chapter 01 operator has a reason to see this person.
  expect(
    (
      await page.request.post('/api/v1/me/membership-requests', {
        data: { organization_id: IDS.chapter01 },
      })
    ).status(),
  ).toBe(201)
  const leader = await browser.newContext()
  expect(
    (await leader.request.post('/dev/login', { data: { email: 'leader@example.test' } })).ok(),
  ).toBe(true)
  const seenByLeader = async () => {
    let row: { profile: unknown } | undefined
    let cursor = ''
    do {
      const page = await (
        await leader.request.get(
          `/api/v1/ops/organizations/${IDS.chapter01}/members?limit=50${cursor ? `&cursor=${cursor}` : ''}`,
        )
      ).json()
      row = page.items.find((i: { profile_id: string }) => i.profile_id === me.profileId)
      cursor = page.next_cursor ?? page.page?.next_cursor ?? ''
    } while (!row && cursor)
    expect(row, 'the requester in the Chapter 01 list').toBeTruthy()
    const detail = await (
      await leader.request.get(`/api/v1/ops/organizations/${IDS.chapter01}/members/${me.profileId}`)
    ).json()
    return { row, detail }
  }

  // Visible (the default): identity shown, contact never.
  let seen = await seenByLeader()
  expect(seen.row!.profile).toMatchObject({ display_name: name, headline: 'Điều phối UC09' })
  expect(JSON.stringify(seen)).not.toMatch(/0912345678|@example\.test/)

  // Tắt hiển thị hồ sơ on /me/privacy → PRIVATE, persisted.
  await page.goto('/me/privacy', { waitUntil: 'networkidle' })
  const toggle = page.getByRole('switch', { name: 'Hiện thẻ của tôi trong Thư viện' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/me/visibility') && r.request().method() === 'PUT',
  )
  await toggle.click()
  expect((await saved).status()).toBe(200)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await discovery(me.profileId)).toBe('PRIVATE')
  seen = await seenByLeader()
  expect(seen.row!.profile).toBeNull()
  expect(seen.detail.profile).toBeNull()
  expect(JSON.stringify(seen)).not.toContain(name)

  // Thay đổi một trường nhạy cảm: a new phone stays the member's alone.
  await page.request.patch('/api/v1/me/profile', { data: { phone: '0987654321' } })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  seen = await seenByLeader()
  expect(seen.row!.profile).toMatchObject({ display_name: name })
  expect(JSON.stringify(seen)).not.toMatch(/0987654321|0912345678|@example\.test/)
  const session = await (await leader.request.get('/api/v1/session')).json()
  expect(JSON.stringify(session)).not.toContain('0987654321')

  // Directory / "Mạng lưới": the switch names "Thư viện", but /library is fed by its
  // demo fixture and startup.json; member cards are not connected yet.
  const guest = await browser.newContext()
  const library = await (await guest.request.get('/library')).text()
  expect(library).not.toContain(name)
  gap(
    'PRODUCT GAP',
    'Profile Directory / Mạng lưới: /library does not read member profiles, so a visible profile appears in no directory; "Mạng lưới" is inert and FP1 for other viewers is not built.',
  )
  await Promise.all([leader.close(), guest.close()])
})

test('UC09 B · UI+API+DB · a venture is private while DRAFT and public only by its owner on a complete record', async ({
  page,
  browser,
}) => {
  await completedAccount(page.request, 'uat-uc09-v')
  const name = `UAT Hiển Thị ${Date.now()}`
  const v = await createVenture(page.request, { type: 'STARTUP', name })
  const outsider = await browser.newContext()
  await completedAccount(outsider.request, 'uat-uc09-out')

  // DRAFT: private, no leak through pages or APIs.
  await assertNoLeak(browser, outsider.request, { id: v.id, name })

  // Incomplete: the owner's "Công khai" is not offered and the server refuses.
  await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
  const section = page.locator('[data-publication]')
  await expect(section).toHaveAttribute('data-publication', 'PRIVATE')
  await expect(section.locator('[data-action="publish"]')).toBeDisabled()
  expect((await page.request.post(`${VENTURES}/${v.id}/publish`)).status()).toBe(422)
  expect((await outsider.request.post(`${VENTURES}/${v.id}/publish`)).status()).toBe(404)

  // Complete it, then the owner chooses "Công khai".
  await page.locator('#ve-role').selectOption('Founder')
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(page.locator('[data-status]')).toContainText('đã lưu lúc')
  await section.locator('[data-action="publish"]').click()
  await expect(section).toHaveAttribute('data-publication', 'PUBLIC')
  const [row] = await query<{ status: string; visibility: string }>(
    'SELECT status::text AS status, visibility::text AS visibility FROM projects WHERE id = $1',
    [v.id],
  )
  expect(row).toEqual({ status: 'ACTIVE', visibility: 'PUBLIC' })

  // The public read path: none exists yet, so nothing public shows the venture.
  expect((await outsider.request.get(`${VENTURES}/${v.id}`)).status()).toBe(404)
  const guest = await browser.newContext()
  expect(await (await guest.request.get('/library')).text()).not.toContain(name)
  gap(
    'PRODUCT GAP',
    'Venture Directory: a PUBLIC venture is not connected to /library (fed by startup.json) and no public venture page exists yet (DEC-PDF-D1).',
  )
  await Promise.all([outsider.close(), guest.close()])
})
