import { query } from '../../../src/lib/db/client'
import { completedAccount, IDS } from '../../visual/support/onboarding'
import { expect, gap, test, uatHooks } from './uat'

/**
 * UC04 — User cập nhật kinh nghiệm và thông tin profile on "Hồ sơ của tôi"
 * (FP1-OWN): add, edit, cancel and delete an experience; edit the basic
 * information; blank required data refused; records the system confirmed
 * (leadership, an organization-verified membership) are shown, never edited.
 */
uatHooks()

const PROFILE_API = '/api/v1/me/profile'

test('UC04 · UI+API+DB · experience and basic information: add, edit, cancel, delete, reload', async ({
  page,
}) => {
  const me = await completedAccount(page.request, 'uat-uc04', { display_name: 'Người Dùng UC04' })
  await page.goto('/me', { waitUntil: 'networkidle' })
  const card = page.locator('[data-anchor="experience"]')
  const records = card.locator('[data-record="experience"]')
  const dialog = page.locator('dialog[data-dialog="experience"]')

  // Bỏ trống chức danh: refused on the screen and by the server.
  await card.getByRole('button', { name: 'Thêm kinh nghiệm', exact: true }).click()
  await dialog.getByLabel('Tổ chức').fill('HTX Nông Sản')
  await dialog.getByRole('button', { name: 'Lưu' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Vui lòng nhập chức danh.')
  const blank = await page.request.patch(PROFILE_API, {
    data: { experience: [{ title: '  ', organization_name: 'HTX' }] },
  })
  expect(blank.status()).toBe(422)

  // Add → stored and shown after reload.
  await dialog.getByLabel('Chức danh').fill('Điều phối vùng nguyên liệu')
  await dialog.getByLabel('Từ').fill('03/2023')
  await dialog.getByRole('button', { name: 'Lưu' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(records).toHaveCount(1)
  await expect(records).toContainText('Điều phối vùng nguyên liệu')
  await expect(records).toContainText('HTX Nông Sản')

  // Hủy thao tác: the change is typed, then cancelled: nothing is sent or stored.
  const pencil = card.getByRole('button', { name: 'Sửa kinh nghiệm', exact: true })
  await pencil.click()
  await card.getByRole('button', { name: 'Sửa Điều phối vùng nguyên liệu' }).click()
  await dialog.getByLabel('Chức danh').fill('Không lưu')
  await dialog.getByRole('button', { name: 'Huỷ' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(records).toContainText('Điều phối vùng nguyên liệu')

  // Edit.
  await card.getByRole('button', { name: 'Sửa kinh nghiệm', exact: true }).click()
  await card.getByRole('button', { name: 'Sửa Điều phối vùng nguyên liệu' }).click()
  await dialog.getByLabel('Chức danh').fill('Trưởng vùng nguyên liệu')
  await dialog.getByRole('button', { name: 'Lưu' }).click()
  await expect(records).toContainText('Trưởng vùng nguyên liệu')

  // Basic information from the identity pencil.
  await page.getByRole('button', { name: 'Sửa thông tin cơ bản' }).click()
  const basic = page.locator('dialog[open]')
  await basic.getByLabel('Vai trò hiện tại').fill('Điều phối HTX')
  await basic.getByLabel('Tỉnh/Thành phố').selectOption(IDS.hanoi)
  await basic.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('[data-screen="FP1-OWN"]')).toContainText('Điều phối HTX')

  // API and DB agree with the screen.
  const profile = await (await page.request.get(PROFILE_API)).json()
  expect(profile.experience).toMatchObject([
    { title: 'Trưởng vùng nguyên liệu', organization_name: 'HTX Nông Sản', started_on: '2023-03' },
  ])
  expect(profile.headline).toBe('Điều phối HTX')
  const [row] = await query<{ region: string; headline: string; titles: string[] }>(
    `SELECT region_vocab_id::text AS region, headline,
            ARRAY(SELECT title FROM profile_experience WHERE profile_id = p.id) AS titles
       FROM individual_profiles p WHERE id = $1`,
    [me.profileId],
  )
  expect(row).toEqual({
    region: IDS.hanoi,
    headline: 'Điều phối HTX',
    titles: ['Trưởng vùng nguyên liệu'],
  })

  // Xóa record.
  await card.getByRole('button', { name: 'Sửa kinh nghiệm', exact: true }).click()
  await card.getByRole('button', { name: 'Sửa Trưởng vùng nguyên liệu' }).click()
  await dialog.getByRole('button', { name: 'Xoá mục này' }).click()
  await expect(records).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(records).toHaveCount(0)
  expect((await (await page.request.get(PROFILE_API)).json()).experience).toEqual([])

  gap(
    'PRODUCT GAP',
    'Linking an experience to an organization already on HUB ("Có trên HUB · tự liên kết") is not built: the organization is free text (D-P1).',
  )
  gap(
    'PRODUCT GAP',
    'Activity history: a saved record is shown on the profile, but no activity history exists in L1 / L2 (WF-07, D-P1).',
  )
})

test('UC04 · exceptions · records the system confirmed are shown and cannot be edited by the member', async ({
  page,
}) => {
  const me = await completedAccount(page.request, 'uat-uc04-sys', {
    display_name: 'Người Có Vai Trò',
  })
  // What an operator records: a verified membership and a leadership record.
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
     VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED', now())`,
    [me.profileId, IDS.chapter01],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state)
     VALUES ($1, $2, 'Chapter Leader', 'ACTIVE')`,
    [me.profileId, IDS.chapter01],
  )
  const snapshot = () =>
    query(
      `SELECT 'm' AS kind, state::text AS state, source AS detail FROM community_memberships WHERE profile_id = $1
       UNION ALL SELECT 'l', state::text, role_label FROM leadership_records WHERE profile_id = $1
       ORDER BY 1`,
      [me.profileId],
    )
  const before = await snapshot()

  await page.goto('/me', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-screen="FP1-OWN"]')).toContainText('Chapter Leader · Chapter 01')
  // No control on the page edits them.
  await expect(page.getByRole('button', { name: /Sửa Chapter Leader/ })).toHaveCount(0)

  // The profile API accepts no relationship field; a new request cannot replace a verified one.
  for (const data of [
    { leadership: [{ title: 'Chủ tịch' }] },
    { memberships: [] },
    { role_assignments: ['PLATFORM_ADMIN'] },
  ]) {
    const res = await page.request.patch(PROFILE_API, { data })
    expect(res.status(), JSON.stringify(data)).toBe(422)
  }
  const again = await page.request.post('/api/v1/me/membership-requests', {
    data: { organization_id: IDS.chapter01 },
  })
  expect(again.status()).toBe(409)
  expect(await snapshot()).toEqual(before)
})
