import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import {
  applyVocabularyFixture,
  completedAccount,
  QA,
  reach,
  saveProfile,
  signInFresh,
  watchConsole,
} from '../support/onboarding'

/**
 * S1-UAT-05 — WF02 profile consistency (DEC-S1P): FB-09 free text with
 * suggestions, FB-10 no skills, "Loại hình" / "Địa điểm" on experience, one
 * twelve-item completion everywhere, privacy unchanged; 1440 / 768 / 390.
 */

const PROFILE_API = '/api/v1/me/profile'
const COMPLETION_API = '/api/v1/me/profile/completion'
let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

const percentApi = async (page: Page) =>
  (await (await page.request.get(COMPLETION_API)).json()).percent as number

const ownProfile = async (page: Page) => (await page.request.get(PROFILE_API)).json()

test.describe('FB-09 / FB-10 — onboarding stage 2', () => {
  test('suggestions, free text, duplicates, the fifth-tag limit, no "Kỹ năng"', async ({
    page,
  }) => {
    await signInFresh(page.request, 's1p-tags')
    await reach(page.request, 'CAPABILITY')
    await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
    await expect(page.getByText('Kỹ năng', { exact: true })).toHaveCount(0)
    await expect(page.getByPlaceholder('Thêm kỹ năng...')).toHaveCount(0)

    const domains = page.getByRole('combobox', { name: 'Lĩnh vực quan tâm' })
    // A suggestion from the catalogue, chosen with the keyboard.
    await domains.fill('logis')
    await expect(domains).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('option', { name: 'Logistics' })).toBeVisible()
    await domains.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'Logistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await domains.press('Enter')
    // Free text outside the catalogue: hinted, then added as typed.
    await domains.fill('Kinh tế tuần hoàn')
    await expect(page.getByText('Nhấn Enter để thêm ‘Kinh tế tuần hoàn’')).toBeVisible()
    await domains.press('Enter')
    const domainBlock = page.locator('[data-anchor="domains"]')
    await expect(domainBlock.locator('[data-tag]')).toHaveText(['Logistics', 'Kinh tế tuần hoàn'])
    // Duplicate (case and spaces ignored): refused with a message tied to the field.
    await domains.fill('  logistics ')
    await domains.press('Enter')
    await expect(domainBlock.getByRole('alert')).toHaveText('Đã có “logistics”.')
    await expect(domains).toHaveAttribute('aria-invalid', 'true')
    for (const extra of ['Năng lượng sạch', 'Kinh tế biển', 'Du lịch số']) {
      await domains.fill(extra)
      await domains.press('Enter')
    }
    await domains.fill('Thứ sáu')
    await domains.press('Enter')
    await expect(domainBlock.getByRole('alert')).toHaveText('Tối đa 5 mục.')
    await expect(domainBlock.locator('[data-tag]')).toHaveCount(5)
    await domains.fill('')

    // Continuing needs a specialisation too.
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page.locator('[data-anchor="specializations"]').getByRole('alert')).toHaveText(
      'Vui lòng thêm ít nhất một chuyên môn.',
    )
    await expect(page).toHaveURL('/onboarding/capability')
    const specs = page.getByRole('combobox', { name: 'Chuyên môn' })
    await specs.fill('Vận')
    await page.getByRole('option', { name: 'Vận hành' }).click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL('/onboarding/purpose')

    // Reload: everything kept; the free text is stored "chưa chuẩn hóa".
    const profile = await ownProfile(page)
    expect(profile.domains.map((d: { label: string }) => d.label).sort()).toEqual(
      ['Du lịch số', 'Kinh tế biển', 'Kinh tế tuần hoàn', 'Logistics', 'Năng lượng sạch'].sort(),
    )
    expect(
      profile.domains.find((d: { label: string }) => d.label === 'Kinh tế tuần hoàn').status,
    ).toBe('UNNORMALIZED')
    expect(profile.specializations).toEqual([
      { id: QA.specialization.operations, label: 'Vận hành', status: 'ACTIVE' },
    ])
    await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-anchor="domains"] [data-tag]')).toHaveCount(5)
  })

  test('step 4 lists no skills; the server refuses stage 2 without its minimum', async ({
    page,
  }) => {
    await signInFresh(page.request, 's1p-stage')
    await reach(page.request, 'CAPABILITY')
    const refused = await page.request.put('/api/v1/me/onboarding/stage', {
      data: { completed: 'CAPABILITY' },
    })
    expect(refused.status()).toBe(422)
    expect((await refused.json()).error.code).toBe('ONBOARDING_REQUIREMENTS_MISSING')
    await reach(page.request, 'REVIEW')
    await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
    await expect(page.getByText('Kỹ năng', { exact: true })).toHaveCount(0)
  })
})

test.describe('one twelve-item completion', () => {
  test('US-01.12: missing photo, website and phone → 75% on step 4, /me and the API', async ({
    page,
  }) => {
    await signInFresh(page.request, 's1p-75')
    const profile = {
      headline: 'CEO',
      bio: 'Giới thiệu',
      domain_ids: [QA.domain.logistics],
      specialization_ids: [QA.specialization.operations],
      experience: [{ title: 'Founder', organization_name: 'Tracely' }],
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/s1p' }],
    }
    await reach(page.request, 'ROLE', profile)
    // Stage 3: one ecosystem role, through the real stage API.
    const roles = await page.request.put('/api/v1/me/onboarding/roles', {
      data: { roles: ['STARTUP_FOUNDER'] },
    })
    expect(roles.status(), await roles.text()).toBe(200)
    await reach(page.request, 'REVIEW', profile)
    expect(await percentApi(page)).toBe(75)
    await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
    const box = page.locator('[data-completion]')
    await expect(box).toContainText('75%')
    for (const missing of ['Ảnh hồ sơ', 'Website/Portfolio', 'Số điện thoại']) {
      await expect(box).toContainText(missing)
    }
    await expect(box).not.toContainText('Học vấn')
  })

  test('/me shows the API figure; adding one item moves it at once; education adds nothing', async ({
    page,
  }) => {
    await completedAccount(page.request, 's1p-me')
    await page.goto('/me', { waitUntil: 'networkidle' })
    const before = await percentApi(page)
    await expect(page.getByText(new RegExp(`Hồ sơ hoàn thiện ${before}%`))).toBeVisible()
    await saveProfile(page.request, { education: [{ institution: 'ĐH Bách khoa' }] })
    expect(await percentApi(page)).toBe(before)
    await saveProfile(page.request, { phone: '0901234567' })
    const after = await percentApi(page)
    expect(after).toBe(Math.round(((Math.round((before * 12) / 100) + 1) * 100) / 12))
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText(new RegExp(`Hồ sơ hoàn thiện ${after}%`))).toBeVisible()
    await saveProfile(page.request, { phone: null })
    expect(await percentApi(page)).toBe(before)
  })
})

test.describe('/me — tags, experience type and place, skills gone', () => {
  test('edit domains and specialisations as tags; custom value edited and reloaded', async ({
    page,
  }) => {
    await completedAccount(page.request, 's1p-dialog')
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page.getByText('Kỹ năng', { exact: true })).toHaveCount(0)
    await page.locator('[data-anchor="expertise"]').getByRole('button').first().click()
    const dialog = page.getByRole('dialog', { name: 'Lĩnh vực và chuyên môn' })
    await expect(dialog).toBeVisible()
    const domains = dialog.getByRole('combobox', { name: /Lĩnh vực quan tâm/ })
    await domains.fill('Nông nghiệp tái sinh')
    await domains.press('Enter')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('[data-anchor="domains"]')).toContainText('Nông nghiệp tái sinh')
    // Edit the custom value: remove it, type another.
    await page.locator('[data-anchor="expertise"]').getByRole('button').first().click()
    await dialog.getByRole('button', { name: 'Bỏ Nông nghiệp tái sinh' }).click()
    await domains.fill('Nông nghiệp hữu cơ')
    await domains.press('Enter')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog).toBeHidden()
    await page.reload({ waitUntil: 'networkidle' })
    const area = page.locator('[data-anchor="domains"]')
    await expect(area).toContainText('Nông nghiệp hữu cơ')
    await expect(area).not.toContainText('Nông nghiệp tái sinh')
  })

  test('experience: create, display, reload, edit and clear "Loại hình" / "Địa điểm"', async ({
    page,
  }) => {
    await completedAccount(page.request, 's1p-exp')
    await page.goto('/me', { waitUntil: 'networkidle' })
    const section = page.locator('[data-anchor="experience"]')
    await section.getByRole('button', { name: /Thêm/ }).first().click()
    const dialog = page.locator('dialog[data-dialog="experience"]')
    await dialog.getByLabel('Chức danh').fill('Đồng sáng lập · CEO')
    await dialog.getByLabel('Tổ chức').fill('Tracely')
    await dialog.getByLabel('Loại hình').fill('Toàn thời gian')
    await dialog.getByLabel('Địa điểm').fill('Đà Nẵng')
    await dialog.getByLabel('Từ').fill('02/2024')
    await dialog.getByLabel('Tôi đang làm ở đây').check()
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog).toBeHidden()
    const record = section.locator('[data-record="experience"]').first()
    await expect(record).toContainText('Tracely · Toàn thời gian')
    await expect(record).toContainText('Đà Nẵng')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(record).toContainText('Tracely · Toàn thời gian')

    // Edit, then clear both optional fields.
    await section.getByRole('button', { name: /Sửa/ }).first().click()
    await record.getByRole('button', { name: /Sửa Đồng sáng lập/ }).click()
    await expect(dialog.getByLabel('Loại hình')).toHaveValue('Toàn thời gian')
    await dialog.getByLabel('Loại hình').fill('Bán thời gian')
    await dialog.getByLabel('Địa điểm').fill('')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog).toBeHidden()
    await expect(record).toContainText('Tracely · Bán thời gian')
    await expect(record).not.toContainText('Đà Nẵng')
    const [stored] = (await ownProfile(page)).experience
    expect(stored).toMatchObject({ employment_type: 'Bán thời gian', location: null })
  })

  test('legacy skills render nothing, crash nothing and survive an editor save', async ({
    page,
  }) => {
    const me = await completedAccount(page.request, 's1p-legacy')
    await saveProfile(page.request, { skill_ids: [QA.skill.data] })
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page.getByText('Kỹ năng', { exact: true })).toHaveCount(0)
    await page.goto('/me/profile/edit', { waitUntil: 'networkidle' })
    await expect(page.getByText('Nhóm chuyên môn')).toHaveCount(0)
    await page.getByLabel('Chức danh').fill('Chức danh mới')
    await page.getByRole('button', { name: 'Lưu' }).first().click()
    await expect(page.getByText(/đã lưu lúc/)).toBeVisible()
    const [row] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM profile_skills WHERE profile_id = $1',
      [me.profileId],
    )
    expect(row!.n).toBe(1)
  })
})

test.describe('privacy — unchanged boundaries', () => {
  test('the owner reads the new fields; a guest is sent to sign-in; no other route shows them', async ({
    page,
    browser,
  }) => {
    await completedAccount(page.request, 's1p-owner', {
      experience: [{ title: 'PM', employment_type: 'Toàn thời gian', location: 'Huế' }],
    })
    expect((await ownProfile(page)).experience[0]).toMatchObject({ location: 'Huế' })
    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    const res = await guestPage.request.get(PROFILE_API)
    expect(res.status()).toBe(401)
    await guestPage.goto('/me')
    await expect(guestPage).toHaveURL(/\/auth/)
    // Another member's own read never carries this member's experience.
    const other = await browser.newContext()
    await signInFresh(other.request, 's1p-other')
    expect(JSON.stringify(await (await other.request.get(PROFILE_API)).json())).not.toContain('Huế')
    await guest.close()
    await other.close()
  })
})

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: stage 2 tags, the tag dialog and experience dialog fit, nothing clipped`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await signInFresh(page.request, `s1p-r${width}`)
      await reach(page.request, 'CAPABILITY', {
        domains: ['Lĩnh vực có tên dài đúng bốn mươi ký tự!', 'Logistics'],
      })
      const overflow = async () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
      await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
      expect(await overflow()).toBeLessThanOrEqual(0)
      const tag = page.locator('[data-anchor="domains"] [data-tag]').first()
      const box = (await tag.boundingBox())!
      const field = (await page.locator('[data-anchor="domains"]').boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(field.x + field.width + 1)
      await page.screenshot({ path: `tests/visual/diff/s1-uat-05/capability-${width}.png` })

      await page.request.put('/api/v1/me/onboarding/stage', { data: { completed: 'CAPABILITY' } })
      await reach(page.request, 'DONE', { specialization_ids: [QA.specialization.operations] })
      await page.goto('/me', { waitUntil: 'networkidle' })
      expect(await overflow()).toBeLessThanOrEqual(0)
      await expect(page.locator('[role="progressbar"], [aria-valuenow]').first()).toBeVisible()
      await page.screenshot({ path: `tests/visual/diff/s1-uat-05/me-${width}.png`, fullPage: true })
      await page.locator('[data-anchor="expertise"]').getByRole('button').first().click()
      const dialog = page.getByRole('dialog', { name: 'Lĩnh vực và chuyên môn' })
      const d = (await dialog.boundingBox())!
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x + d.width).toBeLessThanOrEqual(width)
      await page.screenshot({ path: `tests/visual/diff/s1-uat-05/tags-dialog-${width}.png` })
      await page.keyboard.press('Escape')
      await page
        .locator('[data-anchor="experience"]')
        .getByRole('button', { name: /Thêm/ })
        .first()
        .click()
      const exp = page.locator('dialog[data-dialog="experience"]')
      await expect(exp.getByLabel('Loại hình')).toBeVisible()
      const e = (await exp.boundingBox())!
      expect(e.x + e.width).toBeLessThanOrEqual(width)
      await page.screenshot({ path: `tests/visual/diff/s1-uat-05/experience-dialog-${width}.png` })
    })
  }
})
