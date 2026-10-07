import { IDS, QA, stored } from '../../visual/support/onboarding'
import { expect, gap, identity, requestLink, test, uatHooks, unique } from './uat'

/**
 * UC02 — User quay lại onboarding đang dở. An authenticated member whose
 * onboarding is open signs in again and continues at the right stage with
 * everything saved so far; no second account or profile. Left several times,
 * and entered through a CTA.
 */
uatHooks()

/** FB-09 (S1-UAT-05): stage 2's fields are free-text tag controls. */
async function addTag(page: import('@playwright/test').Page, field: string, text: string) {
  const box = page.getByRole('combobox', { name: field })
  await box.fill(text)
  await box.press('Enter')
}

test('UC02 · UI+API+DB · leaving twice and signing in again resumes the right stage with the saved data', async ({
  page,
}) => {
  const email = unique('uc02')
  await page.goto(await requestLink(page, email))
  await page.getByRole('link', { name: 'Bắt đầu' }).click()
  await page.getByLabel('Họ và tên').fill('Người Dùng UC02')
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/capability')
  await addTag(page, 'Lĩnh vực quan tâm', 'Logistics')
  // "Lưu và hoàn tất sau": saved, then the member leaves.
  await page
    .locator('[data-anchor="footer"]')
    .getByRole('button', { name: 'Lưu và hoàn tất sau' })
    .click()
  await expect(page).toHaveURL('/')

  // First return: sign out, sign in again by e-mail.
  await page.context().clearCookies()
  await page.goto(await requestLink(page, email))
  await expect(page).toHaveURL('/onboarding/capability')
  await expect(page.locator('[data-anchor="domains"] [data-tag]')).toHaveText(['Logistics'])
  expect((await (await page.request.get('/api/v1/me/onboarding')).json()).current_step).toBe(
    'CAPABILITY',
  )
  await page.getByRole('link', { name: 'Quay lại' }).click()
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Người Dùng UC02')
  await expect(page.getByLabel('Tỉnh/Thành phố')).toHaveValue(IDS.danang)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/capability')
  await addTag(page, 'Chuyên môn', 'Vận hành')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/purpose')

  // Second departure without a word; the next sign-in lands on stage 3.
  await page.context().clearCookies()
  await page.goto(await requestLink(page, email))
  await expect(page).toHaveURL('/onboarding/purpose')
  expect((await (await page.request.get('/api/v1/me/onboarding')).json()).current_step).toBe('ROLE')

  const { account_id } = await identity(email)
  const row = (await stored(account_id!))!
  expect(row).toMatchObject({
    full_name: 'Người Dùng UC02',
    region: IDS.danang,
    domains: [QA.domain.logistics],
    profiles: 1,
  })
  expect(row.completed).toBeNull()
  expect(await identity(email)).toMatchObject({ accounts: 1, profiles: 1 })
})

test('UC02 · exceptions · entering through a CTA resumes the open stage; programme / event CTAs', async ({
  page,
}) => {
  const email = unique('uc02-cta')
  await page.goto(await requestLink(page, email))
  await page.getByRole('link', { name: 'Bắt đầu' }).click()
  await page.getByLabel('Họ và tên').fill('Người Dùng CTA')
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.hanoi)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/capability')

  // The homepage's live entry CTA (DM01 "Tham gia cộng đồng HUB Network", the
  // resolver's route since DEMO-HOME-ABOUT-01) sends the open account to its
  // stage, not to an error and not past onboarding.
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.locator('[data-cta="primary"]').click()
  await expect(page).toHaveURL('/onboarding/capability')
  await expect(page.locator('[data-anchor="domains"] [data-tag]')).toHaveCount(0)
  expect(await identity(email)).toMatchObject({ accounts: 1, profiles: 1 })

  // THAO-05 (DEC-THAO-DIR-D1): "Chương trình, cuộc thi" opens the public
  // programme list; it is a public page, so an open account reaches it as is,
  // without being sent into onboarding or to an error. Events have no page yet.
  await page.goto('/', { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await nav.getByRole('button', { name: 'Mở menu Chương trình' }).click()
  for (const label of ['Chương trình', 'Sự kiện'])
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0)
  await nav.getByRole('link', { name: 'Chương trình, cuộc thi', exact: true }).click()
  await expect(page).toHaveURL('/programmes')
  await expect(page.locator('[data-screen="PUBLIC-PROGRAMMES"]')).toBeVisible()
  gap(
    'NOT APPLICABLE',
    'Entry from an event CTA: no public event page in L1 / L2; "Sự kiện" is a plain label.',
  )
  // The guest return to "Tạo hồ sơ startup" after sign-in / onboarding (BD-02 rule) is
  // covered by tests/visual/specs/alpha-interaction-gaps.spec.ts.
})
