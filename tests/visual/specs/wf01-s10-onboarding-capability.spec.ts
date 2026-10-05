import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import {
  applyVocabularyFixture,
  QA,
  reach,
  saveProfile,
  signInFresh,
  stored,
  watchConsole,
} from '../support/onboarding'

/**
 * WF01-S10 / ACC-07 — onboarding stage 2, "Năng lực và lĩnh vực hoạt động"
 * (/onboarding/capability). Production. Decisions DEC-L1R-D3, D4, D7, D8
 * (docs/decisions/DECISION_LOG.md).
 *
 * Vocabulary comes from the QA-only fixture (D8), applied here and never part
 * of any production seed. Functional tests use a fresh account each.
 */

const PROFILE_API = '/api/v1/me/profile'
const STAGE_API = '/api/v1/me/onboarding/stage'

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

async function openCapability(page: Page) {
  await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Năng lực và lĩnh vực hoạt động')
}

const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' })
const domains = (page: Page) => page.locator('[data-anchor="domains"]')
const specializations = (page: Page) => page.locator('[data-anchor="specializations"]')
/** S1-UAT-05 (FB-09): the two fields are tag controls, free text with suggestions. */
const domainField = (page: Page) => page.getByRole('combobox', { name: 'Lĩnh vực quan tâm' })
const specializationField = (page: Page) => page.getByRole('combobox', { name: 'Chuyên môn' })
const tags = (field: ReturnType<typeof domains>) => field.locator('[data-tag]')
async function addTag(field: ReturnType<typeof domainField>, text: string) {
  await field.fill(text)
  await field.press('Enter')
}
/** Stage 2's minimum (FB-09): one domain and one specialisation. */
const MINIMUM = {
  domain_ids: [QA.domain.logistics],
  specialization_ids: [QA.specialization.operations],
}
const experience = (page: Page) => page.locator('[data-anchor="experience"]')
const dialog = (page: Page) => page.locator('dialog[data-dialog="experience"]')

/** The board's state: three fields, three specialisations, three skills, two records, LinkedIn. */
const BOARD = {
  headline: 'Đồng sáng lập · CEO tại Tracely',
  domain_ids: [QA.domain.logistics, QA.domain.agritech, QA.domain.climate],
  specialization_ids: [
    QA.specialization.operations,
    QA.specialization.technology,
    QA.specialization.finance,
  ],
  skill_ids: [QA.skill.data, QA.skill.b2b, QA.skill.pitching],
  experience: [
    {
      title: 'Đồng sáng lập · CEO',
      organization_name: 'Tracely',
      started_on: '2022-02',
      ended_on: null,
    },
    {
      title: 'Trưởng bộ phận vận hành chuỗi lạnh',
      organization_name: 'Minh Phát Agri',
      started_on: '2017-03',
      ended_on: '2022-01',
    },
  ],
  links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/dangkimchi' }],
}

test.describe('WF01-S10 functional and security', () => {
  test('a guest is sent to /auth; an account before stage 1 is sent to its step', async ({
    page,
  }) => {
    await page.goto('/onboarding/capability')
    await expect(page).toHaveURL('/auth')
    await signInFresh(page.request, 's10')
    await page.goto('/onboarding/capability')
    await expect(page).toHaveURL('/onboarding')
    // The stage cannot be passed by calling the API either.
    const refused = await page.request.put(STAGE_API, { data: { completed: 'CAPABILITY' } })
    expect(refused.status()).toBe(422)
    expect((await refused.json()).error).toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      fields: { basic_stage: 'missing' },
    })
  })

  test('FB-09: one domain and one specialisation are needed to continue, not to save for later', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await expect(page.locator('header')).toContainText('BƯỚC 2/4 · LĨNH VỰC VÀ CHUYÊN MÔN')
    await expect(page.locator('header ol li').nth(1)).toHaveAttribute('aria-current', 'step')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/capability')
    await expect(domains(page).getByRole('alert')).toHaveText('Vui lòng thêm ít nhất một lĩnh vực.')
    await expect(specializations(page).getByRole('alert')).toHaveText(
      'Vui lòng thêm ít nhất một chuyên môn.',
    )
    expect((await stored(accountId))!.capability_at).toBeNull()
    await addTag(domainField(page), 'Logistics')
    await addTag(specializationField(page), 'Vận hành')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    const row = await stored(accountId)
    expect(row).toMatchObject({
      domains: [QA.domain.logistics],
      specializations: [QA.specialization.operations],
      skills: [],
      role_at: null,
    })
    expect(row!.capability_at).toBeInstanceOf(Date)
  })

  test('FB-09: catalogue suggestions (at most eight, archived never) and free text', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await domainField(page).fill('Lĩnh vực QA')
    await expect(page.getByRole('option')).toHaveCount(8)
    await expect(page.getByRole('option', { name: 'Lĩnh vực QA lưu trữ' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Lĩnh vực QA 09' }).click()
    await domainField(page).fill('climate')
    await page.getByRole('option', { name: 'Climate Tech' }).click()
    await addTag(domainField(page), 'Kinh tế tuần hoàn')
    await expect(tags(domains(page))).toHaveText([
      'Lĩnh vực QA 09',
      'Climate Tech',
      'Kinh tế tuần hoàn',
    ])
    await domains(page).getByRole('button', { name: 'Bỏ Climate Tech' }).click()
    await addTag(specializationField(page), 'Vận hành')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    const profile = await (await page.request.get(PROFILE_API)).json()
    expect(
      profile.domains.map((d: { label: string; status: string }) => [d.label, d.status]),
    ).toEqual(
      expect.arrayContaining([
        ['Lĩnh vực QA 09', 'ACTIVE'],
        ['Kinh tế tuần hoàn', 'UNNORMALIZED'],
      ]),
    )
    expect((await stored(accountId))!.domains).toHaveLength(2)
  })

  test('at most five tags per field, on the screen and on the server', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    const note = specializations(page).getByText(/ĐÃ THÊM/)
    await expect(note).toHaveText('ĐÃ THÊM 0/5')
    for (const label of ['Vận hành', 'Công nghệ', 'Tài chính', 'Luật', 'Design']) {
      await addTag(specializationField(page), label)
    }
    await expect(note).toHaveText('ĐÃ THÊM 5/5')
    await addTag(specializationField(page), 'Marketing')
    await expect(specializations(page).getByRole('alert')).toHaveText('Tối đa 5 mục.')
    await expect(tags(specializations(page))).toHaveCount(5)
    await specializationField(page).fill('')

    const six = await page.request.patch(PROFILE_API, {
      data: { specialization_ids: Object.values(QA.specialization) },
    })
    expect(six.status()).toBe(422)
    expect((await six.json()).error.fields).toEqual({ specialization_ids: 'too_many' })

    await addTag(domainField(page), 'Logistics')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    expect((await stored(accountId))!.specializations).toHaveLength(5)
  })

  test('FB-10: no skill field; the API keeps validating skill ids for compatibility', async ({
    page,
  }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await expect(page.locator('[data-anchor="skills"]')).toHaveCount(0)
    await expect(page.getByText('Kỹ năng', { exact: true })).toHaveCount(0)
    const text = await page.request.patch(PROFILE_API, { data: { skill_ids: ['Pitching'] } })
    expect(text.status()).toBe(422)
  })

  test('a tag typed and not yet confirmed is added when the field is left, so it is saved', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await addTag(domainField(page), 'Logistics')
    await specializationField(page).fill('Vận hành')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    expect((await stored(accountId))!.specializations).toEqual([QA.specialization.operations])
  })

  test('the browser’s Back shows what was saved; saving again loses nothing', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await addTag(domainField(page), 'Logistics')
    await addTag(specializationField(page), 'Vận hành')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    await page.goBack()
    await expect(page).toHaveURL('/onboarding/capability')
    await expect(tags(domains(page))).toHaveText(['Logistics'])
    await expect(tags(specializations(page))).toHaveText(['Vận hành'])
    await page.locator('header').getByRole('button', { name: 'Lưu và hoàn tất sau' }).click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({
      domains: [QA.domain.logistics],
      specializations: [QA.specialization.operations],
    })
  })

  test('experience is edited in the dialog and saved with the stage', async ({ page }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await experience(page).getByRole('button', { name: '+ Thêm kinh nghiệm' }).click()
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByRole('heading', { level: 2 })).toHaveText('Thêm kinh nghiệm')
    await dialog(page).getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog(page).getByText('Vui lòng nhập chức danh.')).toBeVisible()
    await dialog(page).getByLabel('Chức danh').fill('Đồng sáng lập · CEO')
    await dialog(page).getByLabel('Tổ chức').fill('Tracely')
    // "Current" needs its start.
    await dialog(page).getByLabel('Tôi đang làm ở đây').check()
    await dialog(page).getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog(page).getByText('Vui lòng nhập thời gian bắt đầu.')).toBeVisible()
    await dialog(page).getByLabel('Tôi đang làm ở đây').uncheck()
    await dialog(page).getByLabel('Từ').fill('13/2022')
    await dialog(page).getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog(page).getByText('Nhập theo dạng MM/YYYY.')).toBeVisible()
    await dialog(page).getByLabel('Từ').fill('02/2022')
    await dialog(page).getByLabel('Tôi đang làm ở đây').check()
    await expect(dialog(page).getByLabel('Đến')).toBeDisabled()
    await dialog(page).getByLabel('Mô tả').fill('Dẫn đội 6 người.')
    // S1-UAT-05: "Loại hình" and "Địa điểm", optional free text.
    await dialog(page).getByLabel('Loại hình').fill('Toàn thời gian')
    await dialog(page).getByLabel('Địa điểm').fill('Đà Nẵng')
    await dialog(page).getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog(page)).toHaveCount(0)
    // The focus returns to the control that opened the dialog.
    await expect(experience(page).getByRole('button', { name: '+ Thêm kinh nghiệm' })).toBeFocused()
    await expect(experience(page).locator('li')).toHaveText([
      /Đồng sáng lập · CEO — Tracely\s*2022 – nay · Toàn thời gian · Đà Nẵng/,
    ])
    // Nothing is stored until the stage is saved.
    expect((await (await page.request.get(PROFILE_API)).json()).experience).toEqual([])

    await experience(page).getByRole('button', { name: 'Sửa Đồng sáng lập · CEO' }).click()
    await expect(dialog(page).getByRole('heading', { level: 2 })).toHaveText('Sửa kinh nghiệm')
    await expect(dialog(page).getByLabel('Từ')).toHaveValue('02/2022')
    await dialog(page).getByLabel('Tôi đang làm ở đây').uncheck()
    await dialog(page).getByLabel('Đến').fill('01/2022')
    await dialog(page).getByRole('button', { name: 'Lưu' }).click()
    await expect(
      dialog(page).getByText('Thời gian kết thúc phải sau thời gian bắt đầu.'),
    ).toBeVisible()
    await dialog(page).getByLabel('Đến').fill('06/2024')
    await expect(dialog(page).getByLabel('Loại hình')).toHaveValue('Toàn thời gian')
    await dialog(page).getByRole('button', { name: 'Lưu' }).click()
    await addTag(domainField(page), 'Logistics')
    await addTag(specializationField(page), 'Vận hành')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    expect((await (await page.request.get(PROFILE_API)).json()).experience).toMatchObject([
      {
        title: 'Đồng sáng lập · CEO',
        organization_name: 'Tracely',
        started_on: '2022-02',
        ended_on: '2024-06',
        description: 'Dẫn đội 6 người.',
        employment_type: 'Toàn thời gian',
        location: 'Đà Nẵng',
      },
    ])
  })

  test('"Bỏ", "Xoá mục này" and "Huỷ" in the experience list', async ({ page }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY', { experience: BOARD.experience, ...MINIMUM })
    await openCapability(page)
    await expect(experience(page).locator('li')).toHaveCount(2)
    await experience(page).getByRole('button', { name: 'Sửa Đồng sáng lập · CEO' }).click()
    await dialog(page).getByLabel('Chức danh').fill('Đổi rồi huỷ')
    await dialog(page).getByRole('button', { name: 'Huỷ' }).click()
    await expect(experience(page).locator('li').first()).toContainText('Đồng sáng lập · CEO')
    await experience(page).getByRole('button', { name: 'Sửa Đồng sáng lập · CEO' }).click()
    await dialog(page).getByRole('button', { name: 'Xoá mục này' }).click()
    await expect(experience(page).locator('li')).toHaveCount(1)
    await experience(page)
      .getByRole('button', { name: 'Bỏ Trưởng bộ phận vận hành chuỗi lạnh' })
      .click()
    await expect(experience(page).locator('li')).toHaveCount(0)
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    expect((await (await page.request.get(PROFILE_API)).json()).experience).toEqual([])
  })

  test('links are stored absolute; a script address is refused', async ({ page }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY', MINIMUM)
    await openCapability(page)
    await page.getByLabel('LinkedIn').fill('linkedin.com/in/dangkimchi')
    await page.getByLabel('Website/Portfolio').fill('javascript:alert(1)')
    await next(page).click()
    await expect(page.getByText('Liên kết chưa hợp lệ.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/capability')
    expect((await (await page.request.get(PROFILE_API)).json()).links).toEqual([])
    await page.getByLabel('Website/Portfolio').fill('https://tracely.example')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/purpose')
    const { links } = await (await page.request.get(PROFILE_API)).json()
    expect(links.map((l: { label: string; url: string }) => [l.label, l.url])).toEqual([
      ['LinkedIn', 'https://linkedin.com/in/dangkimchi'],
      ['Website', 'https://tracely.example'],
    ])
  })

  test('"Lưu và hoàn tất sau" saves without passing the stage; "Quay lại" keeps stage 1', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await addTag(domainField(page), 'Logistics')
    await page
      .locator('[data-anchor="footer"]')
      .getByRole('button', { name: 'Lưu và hoàn tất sau' })
      .click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({
      domains: [QA.domain.logistics],
      capability_at: null,
    })
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/capability')
    await expect(tags(domains(page))).toHaveText(['Logistics'])
    await page.getByRole('link', { name: 'Quay lại' }).click()
    await expect(page).toHaveURL('/onboarding/profile')
  })

  test('an archived item that is already selected stays; it cannot be newly selected', async ({
    page,
  }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    const refused = await page.request.patch(PROFILE_API, {
      data: { domain_ids: [QA.domain.archived] },
    })
    expect(refused.status()).toBe(422)
    expect((await refused.json()).error.code).toBe('VOCABULARY_ITEM_INACTIVE')
  })

  test('no AI banner or "AI đề xuất" mark is shown: nothing was suggested', async ({ page }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY', BOARD)
    await openCapability(page)
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/AI đã gợi ý|AI đề xuất/)
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await openCapability(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    // Each tag field is a labelled combobox driving a listbox (FB-09).
    const field = domainField(page)
    await expect(field).toHaveAttribute('aria-autocomplete', 'list')
    await expect(specializationField(page)).toBeVisible()
    await field.focus()
    await page.keyboard.type('logis')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'Logistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(field).toHaveAttribute('aria-activedescendant', /.+/)
    await page.keyboard.press('Enter')
    await expect(tags(domains(page))).toHaveText(['Logistics'])
    expect(await field.evaluate((el) => getComputedStyle(el.parentElement!).outlineStyle)).not.toBe(
      'none',
    )
    await page.keyboard.press('Backspace')
    await expect(tags(domains(page))).toHaveCount(0)
    // The dialog takes the focus and gives it up on Escape.
    await experience(page).getByRole('button', { name: '+ Thêm kinh nghiệm' }).click()
    await expect(dialog(page)).toBeVisible()
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
  })
})

test.describe('WF01-S10 pixel QA (ACC-07)', () => {
  /**
   * ACC-07, measured once. The board draws the AI-filled state: an AI banner
   * above the guide and marks on suggested items. Without suggestions the
   * banner is absent, so every region is compared at its own anchor.
   */
  const REF = {
    cardTop: 113,
    guideTop: 353,
    domainsTop: 495,
    specializationsTop: 663,
    experienceTop: 951,
    linksTop: 1223,
    ruleTop: 1359,
  } as const

  test('1440×900: header, guide, pickers, records, links and footer match ACC-07', async ({
    page,
  }) => {
    await signInFresh(page.request, 's10')
    await reach(page.request, 'CAPABILITY')
    await saveProfile(page.request, BOARD)
    await openCapability(page)
    const at = (name: string) => topOf(page, `[data-anchor="${name}"]`)
    const card = await topOf(page, '[data-ui="surface"]')

    // Regions the board draws for suggested content, in capture coordinates: the chip rows,
    // the inside of the skill control, the records and the link fields with their labels.
    const exclude = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[data-anchor="domains"] > div:last-child, [data-anchor="specializations"] > div:last-child, [data-anchor="domains"] [aria-live], [data-anchor="specializations"] [aria-live], [data-anchor="experience"] li, [data-anchor="links"] input, [data-anchor="links"] label',
        ),
      ].map((el) => {
        const r = el.getBoundingClientRect()
        const inset = -3
        return {
          x: r.x + inset,
          y: r.y + scrollY + inset,
          width: r.width - 2 * inset,
          height: r.height - 2 * inset,
        }
      }),
    )

    await auditRevision(page, {
      name: 'WF01-S10.ACC-07',
      reference: 'design-reference/final/revision/L1/ACC-07__onboarding-capability__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 66 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 270, y: 100, width: 900, height: 140 },
          dy: card - REF.cardTop,
        },
        {
          name: 'guide',
          reference: { x: 310, y: 345, width: 820, height: 130 },
          dy: (await at('guide')) - REF.guideTop,
        },
        {
          name: 'domains-head',
          reference: { x: 310, y: 490, width: 820, height: 60 },
          dy: (await at('domains')) - REF.domainsTop,
        },
        {
          name: 'specializations-head',
          reference: { x: 310, y: 658, width: 820, height: 60 },
          dy: (await at('specializations')) - REF.specializationsTop,
        },
        {
          name: 'experience-head',
          reference: { x: 310, y: 945, width: 820, height: 62 },
          dy: (await at('experience')) - REF.experienceTop,
        },
        {
          name: 'links-head',
          reference: { x: 310, y: 1218, width: 820, height: 30 },
          dy: (await at('links')) - REF.linksTop,
        },
        {
          name: 'footer',
          reference: { x: 270, y: 1345, width: 900, height: 180 },
          dy: (await at('rule')) - REF.ruleTop,
        },
      ],
      exclude,
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason: '"Góp ý" is hidden for Alpha (PO decision 30/09), so its pill is not compared',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'S1-UAT-05 (FB-09, FB-10, DEC-S1P): the domain and specialisation chip rows are the free-text tag controls with their "ĐÃ THÊM n/5" counts, and the skill block is gone; those regions are excluded and the sections below are compared at their own anchors',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-A1: no AI provider, so the AI banner, the dashed suggested chip and the "AI đề xuất" tint and marks on chips, tags, records and the LinkedIn field are not drawn; the regions they occupy are compared by position only',
        },
        {
          class: 'INTENTIONAL-DATA',
          reason:
            'D-S1: the specialisation list is data (eight items from the board, where the frame repeats "Luật"); it wraps to a second row, so the regions below are compared at their own anchors',
        },
      ],
    })

    // Geometry of what the mask above leaves out: the tag controls take the old controls'
    // column, records and link fields keep the board's size.
    const box = async (selector: string) => {
      const b = (await page.locator(selector).first().boundingBox())!
      return { x: Math.round(b.x), width: Math.round(b.width), height: Math.round(b.height) }
    }
    expect(await box('[data-anchor="domains"] [data-tag]')).toMatchObject({ x: 364, height: 27 })
    expect(await box('[data-anchor="experience"] li')).toEqual({ x: 351, width: 738, height: 69 })
    expect(await box('[data-anchor="links"] input')).toMatchObject({
      x: 351,
      width: 361,
      height: 47,
    })
  })
})
