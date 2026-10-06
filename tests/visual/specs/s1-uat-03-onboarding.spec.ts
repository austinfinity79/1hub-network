import { expect, test, type Locator, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import {
  acceptLegal,
  ensureCapabilityMinimum,
  signInFresh,
  watchConsole,
} from '../support/onboarding'

/**
 * S1-UAT-03 (DEC-S1O) — onboarding corrections: US-01.07 location (FB-06,
 * FB-07), US-01.09 "Quay lại" keeps stage 2, US-01.10 one role minimum,
 * US-01.11 HUB position declarations (FB-11..13: catalogue, positions, term),
 * US-01.12 review order and "Sửa" → back to review; a declared position grants
 * nothing (UI + API); 1440 / 768 / 390.
 */

let consoleErrors: string[] = []

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

const COUNTRIES = [
  'Việt Nam',
  'Singapore',
  'Trung Quốc Đại lục',
  'Đài Loan',
  'Hồng Kông',
  'Vương quốc Anh',
  'Hoa Kỳ',
  'Úc',
  'Châu Âu',
  'Các Tiểu vương quốc Ả Rập Thống nhất',
  'Khác',
]
const CHAPTERS = [
  'HUB Network HighSchool',
  'HUB Network Business',
  'HUB Network Hà Nội',
  'HUB Network Đà Nẵng',
  'HUB Network Hồ Chí Minh',
  'HUB Network Quảng Ninh',
  'HUB Network Trung Quốc (China)',
  'HUB Network Singapore',
  'HUB Network Châu Âu (EU)',
  'HUB Network Vương quốc Anh (UK)',
  'HUB Network Hoa Kỳ (USA)',
  'HUB Network các Tiểu vương quốc Ả Rập Thống nhất (UAE)',
  'HUB Network Úc (Australia)',
]
const HIEC = 'HIEC - CLB Sáng tạo và Khởi nghiệp HUST'

/** The texts of a select's choices, without its placeholder. */
const choices = async (select: Locator) =>
  (await select.locator('option:not([disabled])').allTextContents()).map((t) => t.trim())

const vocab = async (type: string, label: string) =>
  (
    await query<{ id: string }>(
      `SELECT id::text FROM vocabulary_items WHERE type_code = $1 AND label = $2 AND status = 'ACTIVE'`,
      [type, label],
    )
  )[0]!.id

const org = async (name: string) =>
  (await query<{ id: string }>('SELECT id::text FROM organizations WHERE name = $1', [name]))[0]!.id

/** A new account in onboarding, at stage 1 (`started`). */
async function atStageOne(page: Page, label: string) {
  const account = await signInFresh(page.request, label)
  expect(
    (await page.request.patch('/api/v1/me/profile', { data: { full_name: 'Ngô Bảo Anh' } })).ok(),
  ).toBe(true)
  return account
}

/** Stages 1–2 done through the API, so stage 3 opens. */
async function atStageThree(page: Page, label: string) {
  const account = await atStageOne(page, label)
  const save = await page.request.patch('/api/v1/me/profile', {
    data: {
      display_name: 'Bảo Anh',
      country_id: await vocab('COUNTRY', 'Việt Nam'),
      region_id: await vocab('REGION', 'TP. Hà Nội'),
    },
  })
  expect(save.ok()).toBe(true)
  await ensureCapabilityMinimum(page.request)
  const stage = await page.request.put('/api/v1/me/onboarding/stage', {
    data: { completed: 'CAPABILITY' },
  })
  expect(stage.ok()).toBe(true)
  return account
}

/** One declaration row on stage 3, filled through the controls. */
async function fillPosition(
  row: Locator,
  p: {
    level: 'HUB Network Tổng' | 'HUB Network Chapter' | 'CLB'
    unit?: string
    chapter?: string
    club?: string
    position: string
    text?: string
    from: string
    to?: string
  },
) {
  await row.locator('select[name^="level-"]').selectOption({ label: p.level })
  if (p.unit) await row.locator('select[name^="unit-"]').selectOption({ label: p.unit })
  if (p.chapter) await row.locator('select[name^="chapter-"]').selectOption({ label: p.chapter })
  if (p.club) await row.locator('select[name^="club-"]').selectOption({ label: p.club })
  await row.locator('select[name^="position-"]').selectOption({ label: p.position })
  if (p.text) await row.getByLabel(/Tên Ban|Ghi rõ chức vụ/).fill(p.text)
  await row.getByLabel('Từ', { exact: true }).fill(p.from)
  if (p.to) await row.getByLabel('Đến', { exact: true }).fill(p.to)
  else await row.getByLabel('Tôi đang trong nhiệm kỳ hoạt động').check()
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('US-01.07 — location (FB-06, FB-07)', () => {
  test('11 countries in order; Việt Nam: 4 pinned + 30 + Khác; other countries type; Khác asks; a new country clears', async ({
    page,
  }) => {
    await atStageOne(page, 's103-loc')
    await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
    const country = page.locator('select[name="country_id"]')
    const region = page.locator('select[name="region_id"]')
    expect(await choices(country)).toEqual(COUNTRIES)
    await expect(region).toBeDisabled()

    await country.selectOption({ label: 'Việt Nam' })
    const provinces = await choices(region)
    expect(provinces).toHaveLength(35)
    expect(provinces.slice(0, 4)).toEqual([
      'TP. Hà Nội',
      'TP. Hồ Chí Minh',
      'TP. Đà Nẵng',
      'TP. Quảng Ninh',
    ])
    expect(provinces.slice(4, 6)).toEqual(['An Giang', 'Bắc Ninh'])
    expect(provinces.at(-2)).toBe('Vĩnh Long')
    expect(provinces.at(-1)).toBe('Khác')

    // Việt Nam + "Khác" asks for the place's name.
    await region.selectOption({ label: 'Khác' })
    const locality = page.getByLabel('Tên địa phương')
    await expect(locality).toHaveAttribute('maxlength', '60')
    await page.getByLabel('Họ và tên').fill('Ngô Bảo Anh')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page.getByText('Vui lòng nhập tên địa phương.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/profile')

    // Singapore: the province becomes a typed field and the old choice is cleared.
    await region.selectOption({ label: 'TP. Hà Nội' })
    await country.selectOption({ label: 'Singapore' })
    const typed = page.locator('input[name="locality"]')
    await expect(typed).toHaveValue('')
    await expect(typed).toHaveAttribute('maxlength', '60')
    await expect(page.locator('select[name="region_id"]')).toHaveCount(0)

    // "Khác" country: its name is required.
    await country.selectOption({ label: 'Khác' })
    await typed.fill('Bangkok')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page.getByText('Vui lòng nhập tên quốc gia.')).toBeVisible()
    await page.getByLabel('Tên quốc gia').fill('Thái Lan')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL('/onboarding/capability')

    // Kept on the server: stage 1 shows "Khác" + the typed names again.
    await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
    await expect(country).toHaveValue('OTHER')
    await expect(page.getByLabel('Tên quốc gia')).toHaveValue('Thái Lan')
    await expect(page.locator('input[name="locality"]')).toHaveValue('Bangkok')
    const profile = await (await page.request.get('/api/v1/me/profile')).json()
    expect(profile.country).toMatchObject({ label: 'Thái Lan', status: 'UNNORMALIZED' })
    expect(profile.region).toMatchObject({ label: 'Bangkok', status: 'UNNORMALIZED' })
  })
})

test.describe('US-01.09 / US-01.10 — stage 2 "Quay lại", stage 3 minimum', () => {
  test('"Quay lại" keeps stage 2; stage 3 needs a role; a HUB member needs a position', async ({
    page,
  }) => {
    await atStageOne(page, 's103-back')
    await page.request.patch('/api/v1/me/profile', {
      data: {
        display_name: 'Bảo Anh',
        country_id: await vocab('COUNTRY', 'Việt Nam'),
        region_id: await vocab('REGION', 'TP. Đà Nẵng'),
      },
    })
    await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
    await expect(page.getByText('Kỹ năng')).toHaveCount(0)
    const domains = page.getByRole('combobox', { name: 'Lĩnh vực quan tâm' })
    await domains.fill('Kinh tế tuần hoàn')
    await domains.press('Enter')
    await page.getByRole('link', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL('/onboarding/profile')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL('/onboarding/capability')
    await expect(page.locator('[data-tag]').filter({ hasText: 'Kinh tế tuần hoàn' })).toHaveCount(1)

    await ensureCapabilityMinimum(page.request)
    await page.request.put('/api/v1/me/onboarding/stage', { data: { completed: 'CAPABILITY' } })
    await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-role]')).toHaveCount(6)
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(
      page.locator('[role="alert"]', { hasText: 'Vui lòng chọn ít nhất một vai trò.' }),
    ).toBeVisible()
    await expect(page).toHaveURL('/onboarding/purpose')
    await page.locator('[data-role="HUB_MEMBER"]').click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page.getByText('Vui lòng khai ít nhất một vị trí tại HUB Network.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/purpose')
    // The API agrees: no role, or a HUB member without a position, does not pass.
    const refused = await page.request.put('/api/v1/me/onboarding/stage', {
      data: { completed: 'ROLE' },
    })
    expect(refused.status()).toBe(422)
  })
})

test.describe('US-01.11 — HUB positions (FB-11, FB-12, FB-13)', () => {
  test('catalogue: 13 Chapters; CLB level offers the 4 Chapters with CLBs (7 · 22 · 6 · 20); a new Chapter clears the CLB', async ({
    page,
  }) => {
    await atStageThree(page, 's103-cat')
    await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
    await page.locator('[data-role="HUB_MEMBER"]').click()
    const row = page.locator('[data-claim="0"]')
    expect(await choices(row.locator('select[name="level-0"]'))).toEqual([
      'HUB Network Tổng',
      'HUB Network Chapter',
      'CLB',
    ])
    await row.locator('select[name="level-0"]').selectOption({ label: 'HUB Network Chapter' })
    expect(await choices(row.locator('select[name="unit-0"]'))).toEqual(CHAPTERS)
    await row.locator('select[name="level-0"]').selectOption({ label: 'CLB' })
    const chapter = row.locator('select[name="chapter-0"]')
    expect(await choices(chapter)).toEqual([
      'HUB Network HighSchool',
      'HUB Network Hà Nội',
      'HUB Network Đà Nẵng',
      'HUB Network Hồ Chí Minh',
    ])
    const club = row.locator('select[name="club-0"]')
    for (const [name, n] of [
      ['HUB Network HighSchool', 7],
      ['HUB Network Hà Nội', 22],
      ['HUB Network Đà Nẵng', 6],
      ['HUB Network Hồ Chí Minh', 20],
    ] as const) {
      await chapter.selectOption({ label: name })
      expect(await choices(club), name).toHaveLength(n)
    }
    await chapter.selectOption({ label: 'HUB Network Hà Nội' })
    await club.selectOption({ label: HIEC })
    await chapter.selectOption({ label: 'HUB Network Đà Nẵng' })
    await expect(club).toHaveValue('')
    // Five positions, the same at every level; the texts appear with their choice.
    expect(await choices(row.locator('select[name="position-0"]'))).toEqual([
      'Chủ tịch',
      'Phó Chủ tịch',
      'Trưởng Ban',
      'Thành viên',
      'Khác',
    ])
    await row.locator('select[name="position-0"]').selectOption({ label: 'Trưởng Ban' })
    await expect(row.getByLabel('Tên Ban')).toHaveAttribute('maxlength', '60')
    await row.locator('select[name="position-0"]').selectOption({ label: 'Khác' })
    await expect(row.getByLabel('Ghi rõ chức vụ')).toBeVisible()
    // "Tôi đang trong nhiệm kỳ hoạt động": Đến reads "Hiện tại" and is locked.
    await row.getByLabel('Tôi đang trong nhiệm kỳ hoạt động').check()
    await expect(row.getByLabel('Đến', { exact: true })).toHaveValue('Hiện tại')
    await expect(row.getByLabel('Đến', { exact: true })).toBeDisabled()
  })

  test('U8: three levels → stage 4 in order, all "Chờ xác minh"; checks: future, order, overlap, 10 rows', async ({
    page,
  }) => {
    await atStageThree(page, 's103-u8')
    await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
    await page.locator('[data-role="HUB_MEMBER"]').click()
    const add = page.getByRole('button', { name: /Thêm vị trí khác/ })
    // Declared CLB first, HUB last: the review orders them HUB → Chapter → CLB.
    await fillPosition(page.locator('[data-claim="0"]'), {
      level: 'CLB',
      chapter: 'HUB Network Hà Nội',
      club: HIEC,
      position: 'Trưởng Ban',
      text: 'Truyền thông',
      from: '03/2024',
    })
    await add.click()
    await fillPosition(page.locator('[data-claim="1"]'), {
      level: 'HUB Network Chapter',
      unit: 'HUB Network Hà Nội',
      position: 'Chủ tịch',
      from: '01/2024',
    })
    await add.click()
    await fillPosition(page.locator('[data-claim="2"]'), {
      level: 'HUB Network Tổng',
      position: 'Phó Chủ tịch',
      from: '06/2023',
    })
    for (const n of [0, 1, 2]) {
      await expect(page.locator(`[data-claim="${n}"] [data-claim-status="PENDING"]`)).toHaveText(
        'Chờ xác minh',
      )
    }

    // Row checks: a future month, Đến before Từ, the same position overlapping.
    await add.click()
    const fourth = page.locator('[data-claim="3"]')
    await fillPosition(fourth, {
      level: 'HUB Network Chapter',
      unit: 'HUB Network Hà Nội',
      position: 'Chủ tịch',
      from: '01/2099',
    })
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(fourth.getByRole('alert')).toContainText('Không chọn tháng ở tương lai.')
    await fourth.getByLabel('Tôi đang trong nhiệm kỳ hoạt động').uncheck()
    await fourth.getByLabel('Từ', { exact: true }).fill('05/2022')
    await fourth.getByLabel('Đến', { exact: true }).fill('04/2022')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(fourth.getByRole('alert')).toContainText('“Đến” không được trước “Từ”.')
    await fourth.getByLabel('Đến', { exact: true }).fill('03/2024')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(fourth.getByRole('alert')).toContainText('Vị trí này đã khai.')
    // Another term at the same unit is allowed.
    await fourth.getByLabel('Đến', { exact: true }).fill('12/2023')

    // Up to ten rows; then "+ Thêm vị trí khác" is gone.
    for (let n = 4; n < 10; n++) await add.click()
    await expect(page.locator('[data-claim]')).toHaveCount(10)
    await expect(add).toHaveCount(0)
    for (let n = 9; n >= 4; n--)
      await page.getByRole('button', { name: `Bỏ vị trí ${n + 1}` }).click()
    await expect(page.locator('[data-claim]')).toHaveCount(4)

    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    const positions = page.locator('[data-hub-positions] [data-hub-position]')
    await expect(positions).toHaveCount(4)
    await expect(positions.nth(0)).toContainText(
      'Phó Chủ tịch · HUB Network Tổng · 06/2023 – Hiện tại',
    )
    await expect(positions.nth(1)).toContainText(
      'Chủ tịch · HUB Network Hà Nội · 01/2024 – Hiện tại',
    )
    await expect(positions.nth(2)).toContainText(
      'Chủ tịch · HUB Network Hà Nội · 05/2022 – 12/2023',
    )
    await expect(positions.nth(3)).toContainText(
      `Trưởng Ban Truyền thông · HUB Network Hà Nội ▸ ${HIEC} · 03/2024 – Hiện tại`,
    )
    for (let n = 0; n < 4; n++) await expect(positions.nth(n)).toContainText('Chờ xác minh')
    // The card others see: the pending HUB badge, no e-mail, no phone.
    const preview = page.locator('[data-preview]')
    await expect(preview.locator('[data-preview-roles]')).toContainText(
      'Thành viên HUB · Chờ xác minh',
    )
    await expect(preview).not.toContainText('@example.test')
    // A sent "Đã xác minh" changes nothing: the row stays pending.
    const declared = await (await page.request.get('/api/v1/me/onboarding/roles')).json()
    const forged = await page.request.put('/api/v1/me/onboarding/roles', {
      data: {
        roles: declared.roles,
        hub_claims: declared.hub_claims.map((c: Record<string, unknown>) => ({
          level: c.level,
          organization_id: (c.organization as { id: string }).id,
          position: c.position,
          board_name: c.board_name,
          position_other: c.position_other,
          from: c.from,
          to: c.to,
          current: c.current,
          status: 'VERIFIED',
          verified: true,
        })),
      },
    })
    expect(forged.status()).toBe(200)
    for (const c of (await forged.json()).hub_claims) expect(c.status).toBe('PENDING')
  })

  test('unticking "Thành viên HUB Network" asks first, then drops the positions', async ({
    page,
  }) => {
    await atStageThree(page, 's103-untick')
    await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
    await page.locator('[data-role="HUB_MEMBER"]').click()
    await fillPosition(page.locator('[data-claim="0"]'), {
      level: 'HUB Network Chapter',
      unit: 'HUB Network Singapore',
      position: 'Thành viên',
      from: '01/2025',
    })
    await page.locator('[data-role="HUB_MEMBER"]').click()
    const confirm = page.locator('[data-confirm-untick]')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Giữ lại' }).click()
    await expect(page.locator('[data-claim]')).toHaveCount(1)
    await page.locator('[data-role="HUB_MEMBER"]').click()
    await confirm.getByRole('button', { name: 'Bỏ chọn và xóa vị trí' }).click()
    await expect(page.locator('[data-anchor="hub"]')).toHaveCount(0)
    await expect(page.locator('[data-role="HUB_MEMBER"] input')).not.toBeChecked()
  })
})

test.describe('US-01.12 — review', () => {
  test('"Sửa" on group 02 → stage 2 → "Tiếp tục" returns to stage 4', async ({ page }) => {
    await atStageThree(page, 's103-edit')
    await page.request.put('/api/v1/me/onboarding/roles', {
      data: { roles: ['INNOVATOR'], hub_claims: [] },
    })
    await page.request.put('/api/v1/me/onboarding/stage', { data: { completed: 'ROLE' } })
    await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
    await expect(page.getByText('Kỹ năng')).toHaveCount(0)
    await page.getByRole('link', { name: 'Sửa Lĩnh vực và chuyên môn' }).click()
    await expect(page).toHaveURL('/onboarding/capability?from=review')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    await page.getByRole('link', { name: 'Sửa Thông tin cơ bản' }).click()
    await expect(page).toHaveURL('/onboarding/profile?from=review')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL('/onboarding/privacy')
  })
})

test.describe('US-01.11 — a declared position grants nothing', () => {
  test('"Chủ tịch HUB Network Hà Nội" cannot open that Chapter in ops (UI + API)', async ({
    page,
  }) => {
    await atStageThree(page, 's103-auth')
    const hn = await org('HUB Network Hà Nội')
    const saved = await page.request.put('/api/v1/me/onboarding/roles', {
      data: {
        roles: ['HUB_MEMBER'],
        hub_claims: [
          {
            level: 'CHAPTER',
            organization_id: hn,
            position: 'CHAIR',
            from: '2024-01',
            current: true,
          },
        ],
      },
    })
    expect(saved.status()).toBe(200)
    expect(
      (await page.request.put('/api/v1/me/onboarding/stage', { data: { completed: 'ROLE' } })).ok(),
    ).toBe(true)
    await acceptLegal(page.request)
    expect((await page.request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)

    for (const path of ['', '/dashboard', '/members']) {
      const response = await page.request.get(`/api/v1/ops/organizations/${hn}${path}`)
      expect([403, 404], path).toContain(response.status())
    }
    await page.goto(`/ops/org/${hn}`)
    await expect(page.locator('[data-shell="ops"]')).toHaveCount(0)
  })
})

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: stage 1 typed location, stage 3 with ten rows, stage 4 review fit`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await atStageThree(page, `s103-r${width}`)
      await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
      await page.locator('select[name="country_id"]').selectOption({ label: 'Khác' })
      await page
        .getByLabel('Tên quốc gia')
        .fill('Các Tiểu vương quốc Ả Rập Thống nhất và vùng lân cận')
      await page.locator('input[name="locality"]').fill('x'.repeat(60))
      await page.getByRole('button', { name: 'Tiếp tục' }).click()
      await expect(page).toHaveURL('/onboarding/capability')
      await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
      await noOverflow(page)
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-03/stage1-${width}.png`,
        fullPage: true,
      })

      await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
      await page.locator('[data-role="HUB_MEMBER"]').click()
      await fillPosition(page.locator('[data-claim="0"]'), {
        level: 'CLB',
        chapter: 'HUB Network Hồ Chí Minh',
        club: 'CLB Khởi nghiệp Đổi mới Sáng tạo Khoa học trường Khoa học tự nhiên, ĐHQG-HCM',
        position: 'Khác',
        text: 'Điều phối viên chương trình cộng đồng khởi nghiệp sinh viên',
        from: '01/2023',
      })
      const add = page.getByRole('button', { name: /Thêm vị trí khác/ })
      for (let n = 1; n < 10; n++) {
        await add.click()
        await fillPosition(page.locator(`[data-claim="${n}"]`), {
          level: 'HUB Network Chapter',
          unit: CHAPTERS[n]!,
          position: 'Thành viên',
          from: `0${(n % 9) + 1}/2020`,
          to: '12/2021',
        })
      }
      await page.getByRole('button', { name: 'Tiếp tục' }).click()
      await expect(page).toHaveURL('/onboarding/privacy')
      await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
      await expect(page.locator('[data-claim]')).toHaveCount(10)
      await noOverflow(page)
      for (const name of ['Tiếp tục', 'Lưu và hoàn tất sau']) {
        const box = (await page.getByRole('button', { name }).last().boundingBox())!
        expect(box.x + box.width, name).toBeLessThanOrEqual(width)
      }
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-03/stage3-${width}.png`,
        fullPage: true,
      })

      await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
      await expect(page.locator('[data-hub-position]')).toHaveCount(10)
      await noOverflow(page)
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-03/stage4-${width}.png`,
        fullPage: true,
      })
    })
  }
})
