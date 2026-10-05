import { IDS, QA, signInFresh, stored } from '../../visual/support/onboarding'
import { expect, gap, NO_PRIVILEGE, privilege, test, uatHooks } from './uat'

/**
 * UC03 — User hoàn thiện Individual Profile. BASIC → CAPABILITY → ROLE →
 * REVIEW → COMPLETE through the screens; completion is the server's; the
 * declared role is not an official role. The AI path is out of Alpha: the
 * manual path is authoritative.
 */
uatHooks()

const PROFILE_API = '/api/v1/me/profile'
/** FB-09 (S1-UAT-05): stage 2's fields are free-text tag controls. */
async function addTag(page: import('@playwright/test').Page, field: string, text: string) {
  const box = page.getByRole('combobox', { name: field })
  await box.fill(text)
  await box.press('Enter')
}

test('UC03 · UI+API+DB · the four stages with validation; completion server-derived; /me shows the profile', async ({
  page,
}) => {
  const { accountId } = await signInFresh(page.request, 'uat-uc03')
  await page.goto('/onboarding', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Bắt đầu' }).click()

  // BASIC: required fields block the stage and nothing is saved.
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible()
  await expect(page).toHaveURL('/onboarding/profile')
  expect(await stored(accountId)).toBeUndefined()
  await page.getByLabel('Họ và tên').fill('Người Dùng UC03')
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/capability')

  // CAPABILITY: tags (FB-09), at most five specialisations, a malformed URL refused.
  await addTag(page, 'Lĩnh vực quan tâm', 'Logistics')
  const note = page.locator('[data-anchor="specializations"]').getByText(/ĐÃ THÊM/)
  for (const label of ['Vận hành', 'Công nghệ', 'Tài chính', 'Luật', 'Design']) {
    await addTag(page, 'Chuyên môn', label)
  }
  await expect(note).toHaveText('ĐÃ THÊM 5/5')
  await addTag(page, 'Chuyên môn', 'Marketing')
  await expect(page.locator('[data-anchor="specializations"]').getByRole('alert')).toHaveText(
    'Tối đa 5 mục.',
  )
  await page.getByRole('combobox', { name: 'Chuyên môn' }).fill('')
  const six = await page.request.patch(PROFILE_API, {
    data: { specialization_ids: [...Object.values(QA.specialization)] },
  })
  expect(six.status()).toBe(422)
  expect((await six.json()).error.fields).toEqual({ specialization_ids: 'too_many' })
  // An id outside the controlled vocabulary is refused too (free text goes as text, FB-09).
  const free = await page.request.patch(PROFILE_API, {
    data: { specialization_ids: ['00000000-0000-0000-0000-000000000000'] },
  })
  expect(free.status()).toBe(422)

  await page.getByLabel('Website/Portfolio').fill('not a url')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page.getByText('Liên kết chưa hợp lệ.')).toBeVisible()
  await expect(page).toHaveURL('/onboarding/capability')
  for (const url of ['javascript:alert(1)', 'ftp://x.example', 'https://']) {
    const bad = await page.request.patch(PROFILE_API, { data: { links: [{ label: 'Web', url }] } })
    expect(bad.status(), url).toBe(422)
  }
  await page.getByLabel('Website/Portfolio').fill('https://uc03.example')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/purpose')

  // ROLE: declared roles and a HUB unit.
  await page.getByRole('checkbox', { name: /Innovator/ }).check({ force: true })
  await page.getByRole('checkbox', { name: /Thành viên HUB Network/ }).check({ force: true })
  await page.locator('[data-anchor="hub"]').getByLabel('Đơn vị').selectOption(IDS.chapter02)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/privacy')

  // REVIEW: the client never submits completion; the server's number is shown.
  const before = await (await page.request.get(`${PROFILE_API}/completion`)).json()
  expect(
    (await page.request.patch(PROFILE_API, { data: { completion_percent: 100 } })).status(),
  ).toBe(422)
  await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check({ force: true })
  await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
  await expect(page).toHaveURL('/onboarding/complete')
  await page.getByRole('link', { name: 'Vào Tài khoản của tôi' }).click()
  await expect(page).toHaveURL('/me')

  // /me shows what was stored; completion is the server's group count.
  const completion = await (await page.request.get(`${PROFILE_API}/completion`)).json()
  expect(completion.percent).toBeGreaterThanOrEqual(before.percent)
  await expect(page.locator('[data-screen="FP1-OWN"]')).toContainText('Người Dùng UC03')
  await expect(page.locator('[data-screen="FP1-OWN"]')).toContainText('Vận hành')
  const row = (await stored(accountId))!
  expect(row.specializations).toHaveLength(5)
  expect(row.domains).toEqual([QA.domain.logistics])
  expect(row.roles).toEqual(['HUB_MEMBER', 'INNOVATOR'])
  expect(row.completed).not.toBeNull()

  // Role chính thức chỉ có từ relationship record hợp lệ: the declaration grants nothing.
  expect(await privilege(page.request, accountId)).toEqual(NO_PRIVILEGE)
  gap(
    'NOT APPLICABLE',
    'AI content confirmation: no AI provider in Alpha (D-A1); the manual path is complete and nothing is written by AI.',
  )
})
