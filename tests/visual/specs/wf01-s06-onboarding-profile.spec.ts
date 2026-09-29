import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import { BASIC, IDS, reach, signInFresh, stored, watchConsole } from '../support/onboarding'

/**
 * WF01-S06 / ACC-06 — onboarding stage 1, "Thông tin cơ bản"
 * (/onboarding/profile). Production. Decisions DEC-L1R-D3, D4, D7
 * (docs/decisions/DECISION_LOG.md).
 */

const PROFILE_API = '/api/v1/me/profile'

let consoleErrors: string[] = []

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

async function openBasic(page: Page) {
  await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thông tin cơ bản')
}

const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' })
const later = (page: Page) =>
  page.locator('[data-anchor="footer"]').getByRole('button', { name: 'Lưu và hoàn tất sau' })

async function fillRequired(page: Page) {
  await page.getByLabel('Họ và tên').fill(BASIC.full_name)
  await page.getByLabel('Tên hiển thị').fill(BASIC.display_name)
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
}

test.describe('WF01-S06 functional and security', () => {
  test('a guest is sent to /auth; the API refuses', async ({ page, request }) => {
    await page.goto('/onboarding/profile')
    await expect(page).toHaveURL('/auth')
    expect((await request.get(PROFILE_API)).status()).toBe(401)
    expect((await request.patch(PROFILE_API, { data: { full_name: 'X' } })).status()).toBe(401)
  })

  test('the header shows stage 1 of 4 and the e-mail is the account’s, read only', async ({
    page,
  }) => {
    const { email } = await signInFresh(page.request, 's06')
    await openBasic(page)
    await expect(page.locator('header')).toContainText('BƯỚC 1/4 · THÔNG TIN CƠ BẢN')
    await expect(page.locator('header ol li')).toHaveCount(4)
    await expect(page.locator('header ol li[aria-current="step"]')).toHaveCount(1)
    await expect(page.locator('header ol li').first()).toHaveAttribute('aria-current', 'step')
    const field = page.getByLabel('Email')
    await expect(field).toHaveValue(email)
    await expect(field).toHaveAttribute('readonly', '')
    // The address is never sent back: PATCH has no such field.
    const refused = await page.request.patch(PROFILE_API, { data: { email: 'other@example.test' } })
    expect(refused.status()).toBe(422)
  })

  test('required fields: nothing is sent until name, country and province are given', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    const writes: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'PATCH') writes.push(r.url())
    })
    await openBasic(page)
    // The province list belongs to the chosen country.
    await expect(page.getByLabel('Tỉnh/Thành phố')).toBeDisabled()
    await next(page).click()
    await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible()
    await expect(page.getByText('Vui lòng chọn quốc gia hoặc khu vực.')).toBeVisible()
    await expect(page.getByText('Vui lòng chọn tỉnh/thành phố.')).toBeVisible()
    await expect(page.getByLabel('Họ và tên')).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL('/onboarding/profile')
    expect(writes).toEqual([])
    expect(await stored(accountId)).toBeUndefined()
  })

  test('"Tiếp tục" saves stage 1, defaults the display name and opens stage 2', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    await openBasic(page)
    await page.getByLabel('Họ và tên').fill('  Đặng Kim Chi ')
    await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
    await expect(page.getByLabel('Tỉnh/Thành phố')).toBeEnabled()
    await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
    await page.getByLabel('Vai trò hiện tại').fill('Đồng sáng lập · CEO tại Tracely')
    await page.getByLabel('Giới thiệu ngắn').fill('Mười năm vận hành chuỗi lạnh.')
    await page.getByLabel('Số điện thoại').fill('+84 90 123 4567')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/capability')
    expect(await stored(accountId)).toMatchObject({
      status: 'DRAFT',
      full_name: 'Đặng Kim Chi',
      // "Mặc định lấy từ họ và tên".
      display_name: 'Đặng Kim Chi',
      headline: 'Đồng sáng lập · CEO tại Tracely',
      bio: 'Mười năm vận hành chuỗi lạnh.',
      phone: '+84901234567',
      country: IDS.country,
      region: IDS.danang,
      completed: null,
      capability_at: null,
      profiles: 1,
    })
    expect((await (await page.request.get('/api/v1/me/onboarding')).json()).current_step).toBe(
      'CAPABILITY',
    )
  })

  test('"Lưu và hoàn tất sau" keeps a partial draft and leaves; the account resumes here', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    await openBasic(page)
    await page.getByLabel('Họ và tên').fill('Đặng Kim Chi')
    await later(page).click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({
      status: 'DRAFT',
      full_name: 'Đặng Kim Chi',
      country: null,
      region: null,
      profiles: 1,
    })
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/profile')
    await expect(page.getByLabel('Họ và tên')).toHaveValue('Đặng Kim Chi')
    // The header action does the same.
    await page.getByLabel('Tên hiển thị').fill('Kim Chi')
    await page.locator('header').getByRole('button', { name: 'Lưu và hoàn tất sau' }).click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({ display_name: 'Kim Chi', profiles: 1 })
  })

  test('the browser’s Back shows what was saved; saving again loses nothing', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    await openBasic(page)
    await page.getByLabel('Họ và tên').fill('Đặng Kim Chi')
    await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
    await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/capability')
    await page.goBack()
    await expect(page).toHaveURL('/onboarding/profile')
    await expect(page.getByLabel('Họ và tên')).toHaveValue('Đặng Kim Chi')
    await expect(page.getByLabel('Tỉnh/Thành phố')).toHaveValue(IDS.danang)
    await later(page).click()
    await expect(page).toHaveURL('/')
    expect(await stored(accountId)).toMatchObject({
      full_name: 'Đặng Kim Chi',
      country: IDS.country,
      region: IDS.danang,
      profiles: 1,
    })
  })

  test('a stored province that was archived since stays shown and selected', async ({ page }) => {
    const region = 'e7000000-0000-0000-0000-0000000000a1'
    await query(
      `INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order, status, metadata)
       VALUES ($1, 'REGION', 'qa-acc06-tinh-luu-tru', 'Tỉnh QA lưu trữ', 900, 'ACTIVE',
               '{"qa_fixture": "WF01-ACC06"}')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
      [region],
    )
    try {
      await signInFresh(page.request, 's06')
      const saved = await page.request.patch(PROFILE_API, {
        data: { ...BASIC, country_id: IDS.country, region_id: region },
      })
      expect(saved.status()).toBe(200)
    } finally {
      await query(`UPDATE vocabulary_items SET status = 'ARCHIVED' WHERE id = $1`, [region])
    }
    await openBasic(page)
    const select = page.getByLabel('Tỉnh/Thành phố')
    await expect(select).toHaveValue(region)
    await expect(select.locator('option:checked')).toHaveText('Tỉnh QA lưu trữ')
    // Not offered to an account that does not hold it.
    await page.context().clearCookies()
    await signInFresh(page.request, 's06')
    await openBasic(page)
    await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
    await expect(
      page.getByLabel('Tỉnh/Thành phố').locator(`option[value="${region}"]`),
    ).toHaveCount(0)
  })

  test('a wrong phone number is refused by the server and nothing is saved', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    await openBasic(page)
    await fillRequired(page)
    await page.getByLabel('Số điện thoại').fill('12345')
    await next(page).click()
    await expect(page.getByText('Số điện thoại chưa đúng định dạng.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/profile')
    expect(await stored(accountId)).toBeUndefined()
    await page.getByLabel('Số điện thoại').fill('')
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/capability')
  })

  test('the phone number and full name are private: only the owner’s profile carries them', async ({
    page,
    browser,
  }) => {
    const owner = await signInFresh(page.request, 's06')
    await reach(page.request, 'DONE', { full_name: 'Tên Riêng Tư', phone: '+84901234567' })
    expect(await (await page.request.get(PROFILE_API)).json()).toMatchObject({
      full_name: 'Tên Riêng Tư',
      phone: '+84901234567',
    })
    for (const path of ['/api/v1/session', '/api/v1/me/network', '/api/v1/me/onboarding']) {
      expect(await (await page.request.get(path)).text(), path).not.toContain('84901234567')
    }
    // The unit's leader reads the member through the ops projection.
    const [profile] = await query<{ id: string }>(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       SELECT id, $2, 'PENDING_APPROVAL', 'SELF_DECLARED' FROM individual_profiles
        WHERE account_id = $1 RETURNING profile_id::text AS id`,
      [owner.accountId, IDS.chapter01],
    )
    const leader = await browser.newContext()
    try {
      expect(
        (await leader.request.post('/dev/login', { data: { email: 'leader@example.test' } })).ok(),
      ).toBe(true)
      const base = `/api/v1/ops/organizations/${IDS.chapter01}/members`
      // The list is read page by page: the unit's size is not this test's business.
      let listed = false
      let cursor: string | null = null
      do {
        const path: string = `${base}?limit=100${cursor ? `&cursor=${cursor}` : ''}`
        const response = await leader.request.get(path)
        expect(response.status(), path).toBe(200)
        const text = await response.text()
        expect(text, path).not.toContain('84901234567')
        expect(text, path).not.toContain('Tên Riêng Tư')
        listed ||= text.includes(profile!.id)
        cursor = (JSON.parse(text) as { page: { next_cursor: string | null } }).page.next_cursor
      } while (cursor && !listed)
      expect(listed, 'the member is in the unit’s list').toBe(true)

      const detail = await leader.request.get(`${base}/${profile!.id}`)
      expect(detail.status()).toBe(200)
      const text = await detail.text()
      expect(text).toContain(profile!.id)
      expect(text).not.toContain('84901234567')
      expect(text).not.toContain('Tên Riêng Tư')
    } finally {
      await leader.close()
    }
  })

  test('the server refuses what the form never sends', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    for (const data of [
      { status: 'ACTIVE' },
      { completion_percent: 100 },
      { onboarding_completed_at: '2020-01-01T00:00:00Z' },
      { capability_step_completed_at: '2020-01-01T00:00:00Z' },
      { account_id: accountId },
      { country_id: IDS.danang },
      { region_id: IDS.country },
      { country_id: 'vn' },
    ]) {
      const response = await page.request.patch(PROFILE_API, { data })
      expect(response.status(), JSON.stringify(data)).toBe(422)
    }
    expect(await stored(accountId)).toBeUndefined()
  })

  test('stage 1 stays open for edits later in the flow; a completed account goes to /me', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    await reach(page.request, 'REVIEW')
    await openBasic(page)
    await expect(page.getByLabel('Họ và tên')).toHaveValue(BASIC.full_name)
    await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.hanoi)
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/capability')
    expect(await stored(accountId)).toMatchObject({ region: IDS.hanoi, profiles: 1 })
    await reach(page.request, 'DONE')
    await page.goto('/onboarding/profile')
    await expect(page).toHaveURL('/me')
  })

  test('double submit sends one request; a failure keeps the form and can be retried', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's06')
    let calls = 0
    await page.route(`**${PROFILE_API}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      calls++
      if (calls === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
        })
      }
      await new Promise((r) => setTimeout(r, 300))
      return route.continue()
    })
    await openBasic(page)
    await fillRequired(page)
    await next(page).click()
    await expect(page.getByText('Chưa lưu được thông tin. Vui lòng thử lại.')).toBeVisible()
    await expect(page.getByLabel('Họ và tên')).toHaveValue(BASIC.full_name)
    expect(await stored(accountId)).toBeUndefined()

    await next(page).dblclick()
    await expect(page).toHaveURL('/onboarding/capability')
    expect(calls).toBe(2)
    expect(await stored(accountId)).toMatchObject({ profiles: 1 })
  })

  test('the AI block is drawn and sends nothing', async ({ page }) => {
    await signInFresh(page.request, 's06')
    const writes: string[] = []
    page.on('request', (r) => {
      if (r.method() !== 'GET') writes.push(`${r.method()} ${r.url()}`)
    })
    await openBasic(page)
    const ai = page.locator('[data-anchor="ai"]')
    await expect(ai.getByRole('heading', { level: 2 })).toHaveText('Tạo hồ sơ nhanh với AI')
    await expect(ai.locator('a, button, input, textarea')).toHaveCount(0)
    const inert = ai.locator('[data-cta-kind="INERT"]')
    await expect(inert).toHaveCount(5)
    for (const control of await inert.all()) {
      await expect(control).toHaveAttribute('aria-disabled', 'true')
      await control.click()
    }
    await expect(page).toHaveURL('/onboarding/profile')
    expect(writes).toEqual([])
    // Nothing on the page was filled in for the member.
    await expect(page.getByLabel('Họ và tên')).toHaveValue('')
    await expect(page.getByLabel('Vai trò hiện tại')).toHaveValue('')
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request, 's06')
    await openBasic(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    for (const label of [
      'Họ và tên',
      'Tên hiển thị',
      'Vai trò hiện tại',
      'Giới thiệu ngắn',
      'Quốc gia/Khu vực',
      'Tỉnh/Thành phố',
      'Email',
      'Số điện thoại',
    ]) {
      await expect(page.getByLabel(label), label).toHaveCount(1)
    }
    await page.getByLabel('Họ và tên').focus()
    expect(
      await page.getByLabel('Họ và tên').evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none')
    await page.keyboard.type('Đặng Kim Chi')
    await page.keyboard.press('Enter')
    // Enter submits; the missing fields are announced.
    await expect(page.getByRole('alert').first()).toBeVisible()
  })
})

test.describe('WF01-S06 pixel QA (ACC-06)', () => {
  /** ACC-06, measured once: the top of each block's box on the reference. */
  const REF = {
    cardTop: 113,
    aiTop: 218,
    manualTop: 601,
    displayTop: 645,
    aboutTop: 879,
    locationTop: 1154,
    contactTop: 1307,
    ruleTop: 1461,
  } as const

  test('1440×900: header, AI block, form sections and footer match ACC-06', async ({ page }) => {
    await signInFresh(page.request, 's06')
    await openBasic(page)
    const at = (name: string) => topOf(page, `[data-anchor="${name}"]`)
    const card = await topOf(page, '[data-ui="surface"]')

    await auditRevision(page, {
      name: 'WF01-S06.ACC-06',
      reference: 'design-reference/final/revision/L1/ACC-06__onboarding-basic__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 66 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 270, y: 100, width: 900, height: 110 },
          dy: card - REF.cardTop,
        },
        {
          name: 'ai-block',
          reference: { x: 310, y: 210, width: 820, height: 370 },
          dy: (await at('ai')) - REF.aiTop,
        },
        {
          name: 'manual-rule',
          reference: { x: 310, y: 590, width: 820, height: 40 },
          dy: (await at('manual')) - REF.manualTop,
        },
        {
          name: 'display',
          reference: { x: 310, y: 636, width: 820, height: 224 },
          dy: (await at('display')) - REF.displayTop,
        },
        {
          name: 'about',
          reference: { x: 310, y: 870, width: 820, height: 265 },
          dy: (await at('about')) - REF.aboutTop,
        },
        {
          name: 'location',
          reference: { x: 310, y: 1146, width: 820, height: 142 },
          dy: (await at('location')) - REF.locationTop,
        },
        {
          name: 'contact',
          reference: { x: 310, y: 1298, width: 820, height: 146 },
          dy: (await at('contact')) - REF.contactTop,
        },
        {
          name: 'footer',
          reference: { x: 270, y: 1450, width: 900, height: 230 },
          dy: (await at('rule')) - REF.ruleTop,
        },
        { name: 'feedback', reference: { x: 1290, y: 810, width: 150, height: 90 }, dy: 0 },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-A1: no AI provider is configured, so the AI block is drawn and has nothing to press; D-F1: "Góp ý" is drawn and inert',
        },
      ],
    })
  })
})
