import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import {
  applyVocabularyFixture,
  completedAccount,
  IDS,
  QA,
  reach,
  saveProfile,
  signInFresh,
  watchConsole,
} from '../support/onboarding'
import { createVenture, invite } from '../support/workspace'

/**
 * WF02-S01 — /me, "Hồ sơ của tôi" (FP1-OWN). Production.
 * Decisions DEC-L2R-D1..D3, D11; screen contract l2-screen-contracts.md.
 *
 * Functional and security behaviour of the realigned page: the workspace
 * ProfileShell, the owner's own sections, the in-place dialogs (experience on
 * L12, education, basic and contact, expertise) and their PATCH /me/profile.
 * The pixel audits of FP1-OWN and L12 live in wf02-l2-revision.spec.ts.
 */

const PROFILE_API = '/api/v1/me/profile'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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

const section = (page: Page, anchor: string) => page.locator(`[data-anchor="${anchor}"]`)
const dialogOf = (page: Page, name: string) => page.locator(`dialog[data-dialog="${name}"]`)

async function openProfile(page: Page) {
  await page.goto('/me', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-screen="FP1-OWN"]')).toBeVisible()
}

/** Every PATCH /me/profile the page sends, with its body. */
function recordPatches(page: Page): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = []
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().endsWith(PROFILE_API)) sent.push(r.postDataJSON())
  })
  return sent
}

const nextPatch = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith(PROFILE_API) && r.request().method() === 'PATCH')

async function ownProfile(request: APIRequestContext) {
  const response = await request.get(PROFILE_API)
  expect(response.status()).toBe(200)
  return response.json()
}

/** The server's completion: percent and the incomplete groups in its order. */
async function serverCompletion(request: APIRequestContext) {
  const body = await (await request.get(`${PROFILE_API}/completion`)).json()
  return {
    percent: body.percent as number,
    missing: (body.groups as { code: string; complete: boolean }[])
      .filter((g) => !g.complete)
      .map((g) => g.code),
  }
}

async function suggestionsMatchServer(page: Page) {
  const server = await serverCompletion(page.request)
  const card = section(page, 'suggest')
  await expect(card.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(server.percent),
  )
  await expect(card).toContainText(
    `Hồ sơ hoàn thiện ${server.percent}% · còn thiếu ${server.missing.length} mục`,
  )
  expect(
    await card
      .locator('[data-suggestion]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-suggestion'))),
  ).toEqual(server.missing.slice(0, 2))
  return server
}

test.describe('WF02-S01 guards', () => {
  test('guest → /auth; the profile API is 401', async ({ page, request }) => {
    await page.goto('/me')
    await expect(page).toHaveURL('/auth')
    expect((await request.get(PROFILE_API)).status()).toBe(401)
    expect((await request.patch(PROFILE_API, { data: { headline: 'x' } })).status()).toBe(401)
  })

  test('onboarding open → the resolver step of the account', async ({ page }) => {
    await signInFresh(page.request, 's01-new')
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding')
    await reach(page.request, 'CAPABILITY')
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/capability')
    await reach(page.request, 'REVIEW')
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/privacy')
  })

  test('a completed member gets FP1-OWN in the workspace profile shell, not the member shell', async ({
    page,
  }) => {
    await completedAccount(page.request, 's01')
    await openProfile(page)
    await expect(page).toHaveURL('/me')
    await expect(page.locator('[data-shell="workspace"][data-frame="profile"]')).toBeVisible()
    await expect(page.locator('[data-shell="member"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kim Chi Đặng')
    for (const anchor of [
      'banner',
      'identity',
      'suggest',
      'about',
      'experience',
      'education',
      'expertise',
      'ventures',
    ]) {
      await expect(section(page, anchor), anchor).toBeVisible()
    }
    await expect(section(page, 'banner')).toContainText('Đây là hồ sơ của bạn.')
  })
})

test.describe('WF02-S01 content', () => {
  test('the sections show the member’s own data; right card lists at most three ventures', async ({
    page,
  }) => {
    const me = await completedAccount(page.request, 's01-content', {
      display_name: 'Đặng Kim Chi',
      headline: 'Đồng sáng lập · CEO tại Tracely',
      bio: 'Tám năm làm vận hành chuỗi cung ứng.',
      specialization_ids: [QA.specialization.operations, QA.specialization.technology],
      domain_ids: [QA.domain.logistics, QA.domain.agritech],
      skill_ids: [QA.skill.data, QA.skill.pitching],
    })
    await saveProfile(page.request, {
      experience: [
        {
          title: 'Đồng sáng lập · CEO',
          organization_name: 'Tracely',
          started_on: '2024-02',
          ended_on: null,
          description: '· Dẫn đội 6 người\n· Truy xuất nguồn gốc',
        },
      ],
      education: [
        {
          institution: 'Đại học Bách khoa Đà Nẵng',
          programme: 'Kỹ sư',
          started_on: '2012-09',
          ended_on: '2016-06',
        },
      ],
    })
    // Leadership has no member-side API: test rows, one ACTIVE and one ALUMNI.
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state)
       VALUES ($1, $2, 'Chapter Leader', 'ACTIVE'), ($1, $3, 'Cựu điều phối', 'ALUMNI')`,
      [me.profileId, CHAPTER_01, CHAPTER_02],
    )
    for (const name of ['S01 D', 'S01 A', 'S01 C', 'S01 B']) {
      await createVenture(page.request, { type: 'STARTUP', name, owner_role_label: 'Founder' })
    }
    const dto = await ownProfile(page.request)
    const network = await (await page.request.get('/api/v1/me/network')).json()
    const leader = network.leadership.find((l: { status: string }) => l.status === 'ACTIVE')
    const { items: ventures } = await (await page.request.get('/api/v1/me/ventures')).json()

    await openProfile(page)
    const identity = section(page, 'identity')
    await expect(identity.getByRole('heading', { level: 1 })).toHaveText('Đặng Kim Chi')
    await expect(identity).toContainText('Đồng sáng lập · CEO tại Tracely')
    const place = identity.locator('p:has(> button)')
    expect(
      await place.locator('span').evaluateAll((els) => els.map((el) => el.textContent)),
    ).toEqual([dto.region.label, `${leader.title} · ${leader.organization.name}`])
    await expect(place).not.toContainText('Cựu điều phối')
    // Up to three chips: specialisations first, then fields.
    const chips = identity.getByRole('list', { name: 'Chuyên môn' }).getByRole('listitem')
    expect(await chips.allTextContents()).toEqual(
      [...dto.specializations, ...dto.domains].slice(0, 3).map((r: { label: string }) => r.label),
    )

    await expect(section(page, 'about')).toContainText('Tám năm làm vận hành chuỗi cung ứng.')
    const experience = section(page, 'experience').locator('[data-record="experience"]')
    await expect(experience).toHaveCount(1)
    await expect(experience).toContainText('Đồng sáng lập · CEO')
    await expect(experience).toContainText('Tracely')
    await expect(experience).toContainText('Đang làm')
    await expect(experience).toContainText('02/2024 – nay')
    expect(await experience.locator('ul li').allTextContents()).toEqual([
      'Dẫn đội 6 người',
      'Truy xuất nguồn gốc',
    ])
    const education = section(page, 'education').locator('[data-record="education"]')
    await expect(education).toHaveCount(1)
    await expect(education).toContainText('Đại học Bách khoa Đà Nẵng')
    await expect(education).toContainText('Kỹ sư')
    await expect(education).toContainText('2012 – 2016')
    const expertise = section(page, 'expertise')
    for (const item of [...dto.specializations, ...dto.skills])
      await expect(expertise).toContainText(item.label)

    const side = section(page, 'ventures')
    const cards = side.locator('li a')
    await expect(cards).toHaveCount(3)
    expect(await cards.evaluateAll((els) => els.map((el) => el.getAttribute('href')))).toEqual(
      ventures.slice(0, 3).map((v: { id: string }) => `/projects/${v.id}/edit`),
    )
    await expect(cards.first()).toContainText(ventures[0].name)
    await expect(cards.first()).toContainText(
      [ventures[0].stage.label, ventures[0].domains[0].label, 'Founder'].join(' · '),
    )
    await expect(side.locator('[data-nav="create-project"]')).toHaveAttribute(
      'href',
      '/projects/new',
    )
    await expect(side.locator('[data-nav="projects"]')).toHaveAttribute('href', '/projects')

    // D-P1: what has no source is not drawn.
    const text = await page.locator('body').innerText()
    for (const banned of [
      'Hồ sơ đã duyệt',
      'Xem như Guest',
      'Ai đang xem',
      'Dự án trên HUB',
      'Tiến trình phát triển',
      'Chứng chỉ',
      'Mở với',
      'Tài nguyên',
    ]) {
      expect(text, banned).not.toContain(banned)
    }
  })

  test('empty sections and no venture show the empty texts', async ({ page }) => {
    await completedAccount(page.request, 's01-empty')
    await openProfile(page)
    await expect(section(page, 'about')).toContainText('Chưa có giới thiệu.')
    await expect(section(page, 'experience')).toContainText('Chưa có kinh nghiệm.')
    await expect(section(page, 'education')).toContainText('Chưa có học vấn.')
    await expect(section(page, 'expertise')).toContainText('Chưa chọn chuyên môn.')
    await expect(section(page, 'ventures')).toContainText('Bạn chưa thuộc đội nào.')
    await expect(section(page, 'identity').getByRole('list', { name: 'Chuyên môn' })).toHaveCount(0)
  })

  test('suggestions follow the server’s completion and leave at 100%', async ({ page }) => {
    await completedAccount(page.request, 's01-suggest')
    await openProfile(page)
    const first = await suggestionsMatchServer(page)
    expect(first.missing.slice(0, 2)).toEqual(['AVATAR', 'HEADLINE'])
    const card = section(page, 'suggest')
    await expect(card.locator('[data-suggestion="AVATAR"] a')).toHaveAttribute(
      'href',
      '/me/profile/edit',
    )

    // The HEADLINE suggestion opens the basic dialog; saving moves the list on.
    await card.locator('[data-suggestion="HEADLINE"]').getByRole('button').click()
    const dialog = dialogOf(page, 'basic')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Vai trò hiện tại').fill('Nhà sáng lập')
    const saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(card.locator('[data-suggestion="HEADLINE"]')).toHaveCount(0)
    const second = await suggestionsMatchServer(page)
    expect(second.percent).toBe(first.percent + 10)

    // Every group complete through the real APIs: the card is not drawn.
    const upload = await page.request.post(`${PROFILE_API}/avatar`, {
      multipart: { file: { name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 } },
    })
    expect(upload.ok()).toBe(true)
    await saveProfile(page.request, {
      bio: 'Giới thiệu.',
      domain_ids: [QA.domain.logistics],
      skill_ids: [QA.skill.data],
      experience: [{ title: 'Điều phối', organization_name: null }],
      development_goal: 'Mục tiêu',
      current_need: 'Nhu cầu',
    })
    expect((await serverCompletion(page.request)).percent).toBe(100)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(section(page, 'suggest')).toHaveCount(0)
  })
})

test.describe('WF02-S01 experience (L12 dialog)', () => {
  test('add, edit and delete persist through one PATCH each; refusals send nothing', async ({
    page,
  }) => {
    await completedAccount(page.request, 's01-exp')
    const patches = recordPatches(page)
    await openProfile(page)
    const card = section(page, 'experience')
    const records = card.locator('[data-record="experience"]')

    await card.getByRole('button', { name: 'Thêm kinh nghiệm', exact: true }).click()
    const dialog = dialogOf(page, 'experience')
    await expect(page.getByRole('dialog', { name: 'Thêm kinh nghiệm' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Xoá mục này' })).toHaveCount(0)

    // Client refusals keep the dialog open with the values and send nothing.
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Vui lòng nhập chức danh.')
    await dialog.getByLabel('Chức danh').fill('Trưởng nhóm sản phẩm')
    await dialog.getByLabel('Từ').fill('13/2024')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Nhập theo dạng MM/YYYY.')
    await dialog.getByLabel('Từ').fill('06/2024')
    await dialog.getByLabel('Đến').fill('01/2024')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog.getByRole('alert')).toHaveText(
      'Thời gian kết thúc phải sau thời gian bắt đầu.',
    )
    await expect(dialog.getByLabel('Chức danh')).toHaveValue('Trưởng nhóm sản phẩm')
    expect(patches).toEqual([])

    // Add.
    await dialog.getByLabel('Đến').fill('')
    await dialog.getByLabel('Tổ chức').fill('Tracely')
    await dialog.getByRole('checkbox', { name: 'Tôi đang làm ở đây' }).check()
    await dialog.getByLabel('Mô tả').fill('Dẫn đội sản phẩm\nLàm việc với HTX')
    let saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(records).toHaveCount(1)
    await expect(records).toContainText('Trưởng nhóm sản phẩm')
    await expect(records).toContainText('Đang làm')
    expect(patches).toHaveLength(1)
    expect(Object.keys(patches[0]!)).toEqual(['experience'])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(records).toHaveCount(1)
    expect((await ownProfile(page.request)).experience).toMatchObject([
      {
        title: 'Trưởng nhóm sản phẩm',
        organization_name: 'Tracely',
        started_on: '2024-06',
        ended_on: null,
        description: 'Dẫn đội sản phẩm\nLàm việc với HTX',
      },
    ])

    // Edit: the section pencil shows one button per record.
    const pencil = card.getByRole('button', { name: 'Sửa kinh nghiệm', exact: true })
    await expect(card.getByRole('button', { name: 'Sửa Trưởng nhóm sản phẩm' })).toHaveCount(0)
    await pencil.click()
    await expect(pencil).toHaveAttribute('aria-pressed', 'true')
    await card.getByRole('button', { name: 'Sửa Trưởng nhóm sản phẩm' }).click()
    await expect(page.getByRole('dialog', { name: 'Sửa kinh nghiệm' })).toBeVisible()
    await expect(dialog.getByLabel('Chức danh')).toHaveValue('Trưởng nhóm sản phẩm')
    await expect(dialog.getByLabel('Từ')).toHaveValue('06/2024')
    await dialog.getByLabel('Chức danh').fill('Giám đốc sản phẩm')
    await dialog.getByRole('checkbox', { name: 'Tôi đang làm ở đây' }).uncheck()
    await dialog.getByLabel('Đến').fill('03/2025')
    saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(records).toContainText('Giám đốc sản phẩm')
    await expect(records).toContainText('06/2024 – 03/2025')
    await expect(records).not.toContainText('Đang làm')
    expect((await ownProfile(page.request)).experience).toMatchObject([
      { title: 'Giám đốc sản phẩm', started_on: '2024-06', ended_on: '2025-03' },
    ])

    // Delete.
    await card.getByRole('button', { name: 'Sửa Giám đốc sản phẩm' }).click()
    saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Xoá mục này' }).click()
    expect((await saved).status()).toBe(200)
    await expect(records).toHaveCount(0)
    await expect(card).toContainText('Chưa có kinh nghiệm.')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(records).toHaveCount(0)
    expect((await ownProfile(page.request)).experience).toEqual([])
    expect(patches).toHaveLength(3)
  })

  test('a server refusal keeps the dialog open with its values; nothing is stored', async ({
    page,
  }) => {
    await completedAccount(page.request, 's01-exp-fail')
    await openProfile(page)
    await page.route(`**${PROFILE_API}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'PROFILE_VALIDATION_FAILED',
                message: 'x',
                request_id: 'r',
                fields: { experience: 'too_many' },
              },
            }),
          })
        : route.continue(),
    )
    const card = section(page, 'experience')
    await card.getByRole('button', { name: 'Thêm kinh nghiệm', exact: true }).click()
    const dialog = dialogOf(page, 'experience')
    await dialog.getByLabel('Chức danh').fill('Điều phối')
    const saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(422)
    // Pre-commit review: the entry is not lost; the dialog says why and stays open.
    await expect(dialog.getByRole('alert')).toContainText('Đã đạt số mục tối đa.')
    await expect(dialog.getByLabel('Chức danh')).toHaveValue('Điều phối')
    await dialog.getByRole('button', { name: 'Huỷ' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(card.getByRole('alert')).toContainText('Đã đạt số mục tối đa.')
    await expect(card.locator('[data-record="experience"]')).toHaveCount(0)
    await page.unroute(`**${PROFILE_API}`)
    expect((await ownProfile(page.request)).experience).toEqual([])
  })
})

test.describe('WF02-S01 education dialog', () => {
  test('add, edit and delete persist; validation refuses and sends nothing', async ({ page }) => {
    await completedAccount(page.request, 's01-edu')
    const patches = recordPatches(page)
    await openProfile(page)
    const card = section(page, 'education')
    const records = card.locator('[data-record="education"]')

    await card.getByRole('button', { name: 'Thêm học vấn', exact: true }).click()
    const dialog = dialogOf(page, 'education')
    await expect(page.getByRole('dialog', { name: 'Thêm học vấn' })).toBeVisible()
    const alerts = dialog.getByRole('alert')

    // Missing Trường.
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(alerts).toHaveText(['Trường này là bắt buộc.'])
    // Bad MM/YYYY.
    await dialog.getByLabel('Trường').fill('Đại học Bách khoa Đà Nẵng')
    await dialog.getByLabel('Từ').fill('2012/09')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(alerts).toHaveText(['Nhập theo dạng MM/YYYY.'])
    // End before start.
    await dialog.getByLabel('Từ').fill('09/2016')
    await dialog.getByLabel('Đến').fill('06/2012')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(alerts).toHaveText(['Thời gian kết thúc phải sau thời gian bắt đầu.'])
    // An end without a start.
    await dialog.getByLabel('Từ').fill('')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(alerts).toHaveText(['Vui lòng nhập thời gian bắt đầu.'])
    await expect(dialog.getByLabel('Trường')).toHaveValue('Đại học Bách khoa Đà Nẵng')
    expect(patches).toEqual([])
    expect((await ownProfile(page.request)).education).toEqual([])

    // Add.
    await dialog.getByLabel('Ngành / chương trình').fill('Kỹ sư')
    await dialog.getByLabel('Từ').fill('09/2012')
    await dialog.getByLabel('Đến').fill('06/2016')
    let saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(records).toHaveCount(1)
    await expect(records).toContainText('2012 – 2016')
    expect(patches.map((p) => Object.keys(p))).toEqual([['education']])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(records).toContainText('Kỹ sư')
    expect((await ownProfile(page.request)).education).toMatchObject([
      {
        institution: 'Đại học Bách khoa Đà Nẵng',
        programme: 'Kỹ sư',
        started_on: '2012-09',
        ended_on: '2016-06',
      },
    ])

    // Edit.
    await card.getByRole('button', { name: 'Sửa học vấn', exact: true }).click()
    await card.getByRole('button', { name: 'Sửa Đại học Bách khoa Đà Nẵng' }).click()
    await expect(page.getByRole('dialog', { name: 'Sửa học vấn' })).toBeVisible()
    await expect(dialog.getByLabel('Từ')).toHaveValue('09/2012')
    await dialog.getByLabel('Ngành / chương trình').fill('Thạc sĩ · Quản trị chuỗi cung ứng')
    await dialog.getByLabel('Đến').fill('')
    saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(records).toContainText('Thạc sĩ · Quản trị chuỗi cung ứng')
    await expect(records).toContainText('2012 – nay')
    expect((await ownProfile(page.request)).education).toMatchObject([
      { programme: 'Thạc sĩ · Quản trị chuỗi cung ứng', started_on: '2012-09', ended_on: null },
    ])

    // Delete.
    await card.getByRole('button', { name: 'Sửa Đại học Bách khoa Đà Nẵng' }).click()
    saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Xoá mục này' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(records).toHaveCount(0)
    await expect(card).toContainText('Chưa có học vấn.')
    expect((await ownProfile(page.request)).education).toEqual([])
  })

  test('a server refusal keeps the dialog open with its values and stores nothing', async ({
    page,
  }) => {
    await completedAccount(page.request, 's01-edu-fail')
    await openProfile(page)
    await page.route(`**${PROFILE_API}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'PROFILE_VALIDATION_FAILED',
                message: 'x',
                request_id: 'r',
                fields: { education: 'invalid_period' },
              },
            }),
          })
        : route.continue(),
    )
    await section(page, 'education').getByRole('button', { name: 'Thêm học vấn' }).click()
    const dialog = dialogOf(page, 'education')
    await dialog.getByLabel('Trường').fill('Đại học Kinh tế')
    const saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(422)
    await expect(dialog.getByRole('alert')).toHaveText(
      'Thời gian kết thúc phải sau thời gian bắt đầu.',
    )
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Trường')).toHaveValue('Đại học Kinh tế')
    await page.unroute(`**${PROFILE_API}`)
    expect((await ownProfile(page.request)).education).toEqual([])
  })

  test('the server validates education on its own and stores nothing it refuses', async ({
    request,
  }) => {
    await completedAccount(request, 's01-edu-api')
    for (const [education, reason] of [
      [[{ institution: '  ' }], 'institution_required'],
      [[{ institution: 'X', started_on: '2016-09', ended_on: '2012-06' }], 'invalid_period'],
      [[{ institution: 'X', ended_on: '2016-06' }], 'invalid_period'],
      [[{ institution: 'X', started_on: '09/2012' }], undefined],
      [[{ institution: 'X', profile_id: 'x' }], 'invalid'],
    ] as const) {
      const response = await request.patch(PROFILE_API, { data: { education } })
      expect(response.status(), JSON.stringify(education)).toBe(422)
      const body = await response.json()
      expect(body.error.code).toBe('PROFILE_VALIDATION_FAILED')
      if (reason) expect(body.error.fields).toEqual({ education: reason })
    }
    expect((await ownProfile(request)).education).toEqual([])
  })
})

test.describe('WF02-S01 basic and contact dialog', () => {
  test('saves full name, display name, headline, country, region and phone', async ({ page }) => {
    await completedAccount(page.request, 's01-basic')
    const patches = recordPatches(page)
    await openProfile(page)
    await section(page, 'identity').getByRole('button', { name: 'Sửa thông tin cơ bản' }).click()
    const dialog = dialogOf(page, 'basic')
    await expect(page.getByRole('dialog', { name: 'Thông tin cơ bản và liên hệ' })).toBeVisible()
    await expect(dialog.getByLabel('Họ và tên')).toHaveValue('Đặng Kim Chi')
    await expect(dialog.getByLabel('Tỉnh/Thành phố')).toHaveValue(IDS.danang)

    // Client refusals: required names, invalid phone; nothing sent.
    await dialog.getByLabel('Họ và tên').fill('')
    await dialog.getByLabel('Số điện thoại').fill('abc')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(dialog.getByRole('alert')).toHaveText([
      'Trường này là bắt buộc.',
      'Số điện thoại chưa hợp lệ.',
    ])
    expect(patches).toEqual([])

    await dialog.getByLabel('Họ và tên').fill('Nguyễn Văn An')
    await dialog.getByLabel('Tên hiển thị').fill('An Nguyễn')
    await dialog.getByLabel('Vai trò hiện tại').fill('Cố vấn vận hành')
    await dialog.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
    await dialog.getByLabel('Tỉnh/Thành phố').selectOption(IDS.hanoi)
    await dialog.getByLabel('Số điện thoại').fill('0905 123 456')
    const saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    expect(patches).toEqual([
      {
        full_name: 'Nguyễn Văn An',
        display_name: 'An Nguyễn',
        headline: 'Cố vấn vận hành',
        country_id: IDS.country,
        region_id: IDS.hanoi,
        phone: '0905 123 456',
      },
    ])
    const dto = await ownProfile(page.request)
    expect(dto).toMatchObject({
      full_name: 'Nguyễn Văn An',
      display_name: 'An Nguyễn',
      headline: 'Cố vấn vận hành',
      country: { id: IDS.country },
      region: { id: IDS.hanoi },
      phone: '0905123456',
    })
    const identity = section(page, 'identity')
    await expect(identity.getByRole('heading', { level: 1 })).toHaveText('An Nguyễn')
    await expect(identity).toContainText('Cố vấn vận hành')
    await expect(identity).toContainText(dto.region.label)
    await expect(page.locator('header')).toContainText('An Nguyễn')
    // The phone is the owner's: shown in the dialog only, never on the page.
    await expect(page.locator('[data-screen="FP1-OWN"]')).not.toContainText('0905123456')
    await identity.getByRole('button', { name: 'Thông tin liên hệ' }).click()
    await expect(dialog.getByLabel('Số điện thoại')).toHaveValue('0905123456')
  })

  test('the phone never reaches another member or the session', async ({ page, browser }) => {
    const owner = await completedAccount(page.request, 's01-phone', { phone: '+84 905 777 888' })
    const venture = await createVenture(page.request, { type: 'PROJECT', name: 'Đội S01' })
    const context = await browser.newContext()
    const mate = await context.newPage()
    try {
      const other = await completedAccount(mate.request, 's01-mate')
      const { membership_id } = await invite(page.request, venture.id, {
        email: other.email,
        permission: 'VIEW',
      })
      const accepted = await mate.request.post(
        `/api/v1/ventures/${venture.id}/team/invitations/${membership_id}/accept`,
      )
      expect(accepted.status()).toBe(200)
      const secret = '84905777888'
      expect((await ownProfile(page.request)).phone).toBe(`+${secret}`)

      const reads = [
        await page.request.get('/api/v1/session'),
        await page.request.get('/api/v1/me/network'),
        await mate.request.get(`/api/v1/ventures/${venture.id}/team`),
        await mate.request.get(`/api/v1/ventures/${venture.id}`),
        await mate.request.get(
          `${PROFILE_API}?profile_id=${owner.profileId}&account_id=${owner.accountId}`,
          { headers: { 'x-profile-id': owner.profileId, 'x-account-id': owner.accountId } },
        ),
      ]
      for (const response of reads) {
        expect(response.status(), response.url()).toBe(200)
        const raw = await response.text()
        expect(raw, response.url()).not.toContain(secret)
        expect(raw, response.url()).not.toContain('905 777 888')
      }
      const session = await (await page.request.get('/api/v1/session')).json()
      expect(JSON.stringify(session)).not.toMatch(/"phone"/)
      // The teammate's own profile read is the teammate's, not the owner's.
      const mine = await (await mate.request.get(PROFILE_API)).json()
      expect(mine.id).toBe(other.profileId)
      expect(mine.phone).toBeNull()
      for (const path of ['/me', `/projects/${venture.id}/team`, `/projects/${venture.id}/edit`]) {
        await mate.goto(path, { waitUntil: 'networkidle' })
        expect(await mate.content(), path).not.toContain(secret)
      }
    } finally {
      await context.close()
    }
  })
})

test.describe('WF02-S01 expertise dialog', () => {
  test('at most five specialisations; skills saved with them', async ({ page }) => {
    await completedAccount(page.request, 's01-exp5')
    const patches = recordPatches(page)
    await openProfile(page)
    await section(page, 'expertise').getByRole('button', { name: 'Thêm chuyên môn' }).click()
    const dialog = dialogOf(page, 'expertise')
    await expect(page.getByRole('dialog', { name: 'Chuyên môn và kỹ năng' })).toBeVisible()
    const specs = dialog.getByRole('group', { name: /^Chuyên môn · đã chọn/ }).getByRole('button')
    const skills = dialog.getByRole('group', { name: 'Kỹ năng' }).getByRole('button')
    expect(await specs.count()).toBeGreaterThanOrEqual(6)
    await expect(dialog.getByRole('group', { name: 'Chuyên môn · đã chọn 0/5' })).toBeVisible()

    for (let i = 0; i < 5; i++) await specs.nth(i).click()
    await expect(dialog.getByRole('group', { name: 'Chuyên môn · đã chọn 5/5' })).toBeVisible()
    await expect(dialog).toContainText('Chọn tối đa 5 chuyên môn.')
    await expect(specs.nth(5)).toHaveAttribute('aria-pressed', 'false')
    await expect(specs.nth(5)).toBeDisabled()
    // Releasing one frees the others.
    await specs.nth(4).click()
    await expect(specs.nth(5)).toBeEnabled()
    await specs.nth(5).click()
    await expect(specs.nth(4)).toBeDisabled()
    await skills.first().click()
    await expect(skills.first()).toHaveAttribute('aria-pressed', 'true')

    const saved = nextPatch(page)
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    expect((await saved).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    expect(patches).toHaveLength(1)
    expect(Object.keys(patches[0]!).sort()).toEqual(['skill_ids', 'specialization_ids'])
    expect(patches[0]!.specialization_ids).toHaveLength(5)
    expect(patches[0]!.skill_ids).toHaveLength(1)
    const dto = await ownProfile(page.request)
    expect(dto.specializations).toHaveLength(5)
    expect(dto.skills).toHaveLength(1)
    const rows = section(page, 'expertise')
    for (const item of dto.specializations) await expect(rows).toContainText(item.label)

    // The server holds the limit on its own.
    const six = Object.values(QA.specialization)
    const refused = await page.request.patch(PROFILE_API, { data: { specialization_ids: six } })
    expect(refused.status()).toBe(422)
    expect((await ownProfile(page.request)).specializations).toHaveLength(5)
  })
})

test.describe('WF02-S01 navigation', () => {
  test('header, banner and section links lead to existing routes; inert items stay put', async ({
    page,
  }) => {
    await completedAccount(page.request, 's01-nav')
    await openProfile(page)
    const header = page.locator('[data-frame="profile"] header')
    await expect(header.locator('[data-nav="home"]')).toHaveAttribute('href', '/')
    await expect(header.locator('[data-nav="home"]')).toHaveText('HUB NETWORK')
    const nav = header.getByRole('navigation', { name: 'Khám phá' })
    expect(
      await nav
        .getByRole('link')
        .evaluateAll((els) =>
          els.map((el) => [
            el.textContent,
            el.getAttribute('href'),
            el.getAttribute('aria-current'),
          ]),
        ),
    ).toEqual([['Thư viện', '/library', 'page']])
    const inert = header.locator('[data-nav-kind="INERT"]')
    expect(
      await inert.evaluateAll((els) =>
        els.map((el) => [el.textContent, el.tagName, el.getAttribute('aria-disabled')]),
      ),
    ).toEqual([
      ['Chương trình', 'SPAN', 'true'],
      ['Sự kiện', 'SPAN', 'true'],
      ['Tin tức', 'SPAN', 'true'],
      ['VN · EN', 'SPAN', 'true'],
    ])
    for (const item of await inert.all()) {
      await expect(item).toHaveAttribute('aria-label', /— .+/)
      await item.click()
      await expect(page).toHaveURL('/me')
    }
    // The cover pencil is drawn and inert (D-P1); "Góp ý" is hidden for Alpha (PO decision 30/09).
    const cover = page.locator('[data-cta-kind="INERT"][aria-label^="Ảnh bìa — "]')
    await expect(cover).toHaveCount(1)
    await expect(cover).toHaveAttribute('aria-disabled', 'true')
    await cover.click()
    await expect(page).toHaveURL('/me')
    // S1-UAT-02 (FB-01, DEC-S1F-D1): "Góp ý" is the one shared launcher.
    await expect(page.locator('[data-feedback-launcher]')).toHaveCount(1)
    await expect(header).toContainText('Kim Chi Đặng')
    await expect(page.locator('[data-nav="ops-entry"]')).toHaveCount(0)

    const links: [Locator, string][] = [
      [page.locator('[data-nav="profile-settings"]'), '/me/settings'],
      [page.locator('[data-nav="profile-edit"]'), '/me/profile/edit'],
      [section(page, 'about').getByRole('link', { name: 'Sửa giới thiệu' }), '/me/profile/edit'],
      [page.locator('[data-nav="create-project"]'), '/projects/new'],
      [page.locator('[data-nav="projects"]'), '/projects'],
    ]
    for (const [link, href] of links) await expect(link).toHaveAttribute('href', href)
    await expect(page.locator('[data-nav="profile-settings"]')).toHaveText('Cài đặt hồ sơ')
    await expect(page.locator('[data-nav="profile-edit"]')).toHaveText('+ Thêm mục vào hồ sơ')

    for (const [link, href] of links) {
      await link.click()
      await expect(page).toHaveURL(href)
      await openProfile(page)
    }
    await nav.getByRole('link', { name: 'Thư viện' }).click()
    await expect(page).toHaveURL('/library')
  })

  test('an account with an ops scope gets "Vận hành tổ chức" in the header', async ({ page }) => {
    // Read-only use of the seeded leader persona.
    expect(
      (await page.request.post('/dev/login', { data: { email: 'leader@example.test' } })).ok(),
    ).toBe(true)
    await openProfile(page)
    const entry = page.locator('[data-frame="profile"] header [data-nav="ops-entry"]')
    await expect(entry).toHaveText('Vận hành tổ chức')
    await expect(entry).toHaveAttribute('href', '/ops/network')
  })
})

test.describe('WF02-S01 keyboard', () => {
  test('every dialog opens from the keyboard, holds focus, closes on Escape and returns focus', async ({
    page,
  }) => {
    await completedAccount(page.request, 's01-kbd', {
      experience: [{ title: 'Điều phối', organization_name: 'Bưu điện' }],
    })
    const patches = recordPatches(page)
    await openProfile(page)
    await section(page, 'experience').getByRole('button', { name: 'Sửa kinh nghiệm' }).click()
    const openers: [Locator, string][] = [
      [section(page, 'experience').getByRole('button', { name: 'Thêm kinh nghiệm' }), 'experience'],
      [section(page, 'experience').getByRole('button', { name: 'Sửa Điều phối' }), 'experience'],
      [section(page, 'education').getByRole('button', { name: 'Thêm học vấn' }), 'education'],
      [section(page, 'expertise').getByRole('button', { name: 'Sửa chuyên môn' }), 'expertise'],
      [section(page, 'identity').getByRole('button', { name: 'Sửa thông tin cơ bản' }), 'basic'],
      [section(page, 'identity').getByRole('button', { name: 'Thông tin liên hệ' }), 'basic'],
    ]
    for (const [opener, name] of openers) {
      await opener.focus()
      await page.keyboard.press('Enter')
      const dialog = dialogOf(page, name)
      await expect(dialog, name).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]'))))
        .toBe(true)
      // Tab stays inside the modal dialog.
      for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
      expect(
        await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]'))),
      ).toBe(true)
      await page.keyboard.press('Escape')
      await expect(dialog, name).toHaveCount(0)
      await expect(opener, name).toBeFocused()
    }
    // "Huỷ" and "Đóng" close without saving too.
    for (const button of ['Huỷ', 'Đóng']) {
      await section(page, 'education').getByRole('button', { name: 'Thêm học vấn' }).click()
      await dialogOf(page, 'education').getByLabel('Trường').fill('Không lưu')
      await dialogOf(page, 'education').getByRole('button', { name: button }).click()
      await expect(dialogOf(page, 'education')).toHaveCount(0)
    }
    expect(patches).toEqual([])
    expect((await ownProfile(page.request)).education).toEqual([])
  })
})

test.describe('WF02-S01 security', () => {
  test('another account can neither read nor write this profile; ids and headers are ignored', async ({
    page,
    browser,
  }) => {
    const owner = await completedAccount(page.request, 's01-own', {
      headline: 'Chủ hồ sơ',
      bio: 'Nội dung riêng của chủ hồ sơ',
    })
    const context = await browser.newContext()
    const intruder = await context.newPage()
    try {
      const other = await completedAccount(intruder.request, 's01-intruder')
      const spoof = {
        'x-account-id': owner.accountId,
        'x-profile-id': owner.profileId,
        'x-forwarded-user': owner.email,
      }
      const qs = `?profile_id=${owner.profileId}&account_id=${owner.accountId}`

      // Reads with the owner's ids return the caller's own profile.
      const read = await (
        await intruder.request.get(`${PROFILE_API}${qs}`, { headers: spoof })
      ).json()
      expect(read.id).toBe(other.profileId)
      expect(JSON.stringify(read)).not.toContain('Nội dung riêng của chủ hồ sơ')

      // A write with the owner's ids lands on the caller's own profile.
      const write = await intruder.request.patch(`${PROFILE_API}${qs}`, {
        headers: spoof,
        data: { headline: 'Đã bị sửa', education: [{ institution: 'Trường giả' }] },
      })
      expect(write.status()).toBe(200)
      expect((await write.json()).id).toBe(other.profileId)
      // Ids in the body are refused, not honoured.
      for (const key of ['id', 'profile_id', 'account_id']) {
        const refused = await intruder.request.patch(PROFILE_API, {
          data: { [key]: owner.profileId, headline: 'Đã bị sửa 2' },
        })
        expect(refused.status(), key).toBe(422)
      }
      const [ownerRow] = await query<{ headline: string; n: number }>(
        `SELECT p.headline, (SELECT count(*)::int FROM profile_education e WHERE e.profile_id = p.id) AS n
           FROM individual_profiles p WHERE p.id = $1`,
        [owner.profileId],
      )
      expect(ownerRow).toEqual({ headline: 'Chủ hồ sơ', n: 0 })
      const ownerDto = await ownProfile(page.request)
      expect(ownerDto.headline).toBe('Chủ hồ sơ')
      expect(ownerDto.education).toEqual([])

      // The page is always the session's own.
      await intruder.goto(`/me${qs}`, { waitUntil: 'networkidle' })
      await expect(intruder.getByRole('heading', { level: 1 })).toHaveText('Kim Chi Đặng')
      await expect(section(intruder, 'identity')).toContainText('Đã bị sửa')
      const html = await intruder.content()
      for (const secret of ['Chủ hồ sơ', 'Nội dung riêng của chủ hồ sơ', owner.email])
        expect(html, secret).not.toContain(secret)
    } finally {
      await context.close()
    }
  })

  test('loading the page writes nothing: no audit, analytics or membership rows', async ({
    page,
  }) => {
    const me = await completedAccount(page.request, 's01-ro')
    const count = async () =>
      (
        await query<{ m: number; a: number; e: number }>(
          `SELECT (SELECT count(*)::int FROM community_memberships WHERE profile_id = $1) AS m,
                  (SELECT count(*)::int FROM analytics_events WHERE account_id = $2) AS a,
                  (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $2) AS e`,
          [me.profileId, me.accountId],
        )
      )[0]
    const before = await count()
    await openProfile(page)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await count()).toEqual(before)
    const html = await page.content()
    for (const leak of ['owner_profile_id', 'account_id', '"metadata"', 'slug'])
      expect(html, leak).not.toContain(leak)
  })
})
