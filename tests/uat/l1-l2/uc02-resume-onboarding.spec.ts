import { IDS, QA, stored } from '../../visual/support/onboarding'
import { expect, gap, identity, requestLink, test, uatHooks, unique } from './uat'

/**
 * UC02 — User quay lại onboarding đang dở. An authenticated member whose
 * onboarding is open signs in again and continues at the right stage with
 * everything saved so far; no second account or profile. Left several times,
 * and entered through a CTA.
 */
uatHooks()

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
  await page.getByRole('checkbox', { name: 'Logistics', exact: true }).check({ force: true })
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
  await expect(page.getByRole('checkbox', { name: 'Logistics', exact: true })).toBeChecked()
  expect((await (await page.request.get('/api/v1/me/onboarding')).json()).current_step).toBe(
    'CAPABILITY',
  )
  await page.getByRole('link', { name: 'Quay lại' }).click()
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Người Dùng UC02')
  await expect(page.getByLabel('Tỉnh/Thành phố')).toHaveValue(IDS.danang)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
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

  // The homepage's live CTA ("Tạo hồ sơ startup" → /projects/new) sends the open
  // account to its stage, not to an error and not past onboarding.
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.locator('[data-cta="startup"]').click()
  await expect(page).toHaveURL('/onboarding/capability')
  await expect(page.getByRole('checkbox', { name: 'Logistics', exact: true })).not.toBeChecked()
  expect(await identity(email)).toMatchObject({ accounts: 1, profiles: 1 })

  // Programme and event CTAs are inert in Alpha: nothing leads a guest from a
  // programme or an event into onboarding, and no return address is carried.
  await page.goto('/', { waitUntil: 'networkidle' })
  for (const label of ['Chương trình', 'Sự kiện']) {
    const cta = page.locator('[data-cta-kind="INERT"]', { hasText: label }).first()
    await expect(cta).toHaveAttribute('aria-disabled', 'true')
    await expect(cta).not.toHaveAttribute('href', /.+/)
  }
  gap(
    'NOT APPLICABLE',
    'Entry from a programme / event CTA: those CTAs are inert in Alpha (no public programme or event page in L1 / L2).',
  )
  gap(
    'PRODUCT GAP',
    'Return to the CTA target after sign-in / onboarding is not built (the link always returns to the resolver; DEC-2809-D1 approved it for later).',
  )
})
