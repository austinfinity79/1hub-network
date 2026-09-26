import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng, writeBuffer } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S06 — Onboarding Profile (/onboarding/profile). Production.
 * Decisions DEC-WF01-S06-D1..D6 (docs/decisions/DECISION_LOG.md).
 *
 * Vocabulary comes from the QA-only fixture (D6), applied here and never part
 * of any production seed. Functional tests use a fresh account each.
 */

const PROFILE_API = '/api/v1/me/profile'
const FIXTURE = path.join(REPO_ROOT, 'tests/visual/fixtures/wf01-s06-qa-vocabulary.sql')

/** Seed REGION ids and QA fixture DOMAIN/SKILL ids. */
const REGION = {
  hanoi: '20000000-0000-0000-0000-000000000001',
  danang: '20000000-0000-0000-0000-000000000002',
}
const qa = (n: number) => `e6000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const D = {
  supply: qa(1),
  logistics: qa(2),
  agri: qa(6),
  finance: qa(7),
  d9: qa(9),
  archived: qa(99),
}
const S = { data: qa(3), product: qa(4), b2b: qa(5), s8: qa(8) }

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await query(readFileSync(FIXTURE, 'utf8'))
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 422/500 answers are the scenario under test.
    if (m.type() === 'error' && !/status of (422|500)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

async function signInFresh(page: Page): Promise<string> {
  const email = `s06-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const response = await page.request.post('/dev/login', { data: { email } })
  expect(response.ok()).toBe(true)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return row!.id
}

type Stored = {
  status: string
  display_name: string | null
  headline: string | null
  region: string | null
  bio: string | null
  avatar: string | null
  completed: Date | null
  domains: string[]
  skills: string[]
}

async function stored(accountId: string): Promise<Stored | undefined> {
  const [row] = await query<Stored>(
    `SELECT p.status::text, p.display_name, p.headline, p.region_vocab_id::text AS region, p.bio,
            p.avatar_asset_id AS avatar, p.onboarding_completed_at AS completed,
            ARRAY(SELECT vocab_id::text FROM profile_domains WHERE profile_id = p.id ORDER BY 1) AS domains,
            ARRAY(SELECT vocab_id::text FROM profile_skills WHERE profile_id = p.id ORDER BY 1) AS skills
       FROM individual_profiles p WHERE p.account_id = $1`,
    [accountId],
  )
  return row
}

const REQUIRED = {
  display_name: 'Đặng Kim Chi',
  headline: 'Đồng sáng lập · CEO tại Tracely',
  region_id: REGION.danang,
}

async function openProfile(page: Page) {
  await page.goto('/onboarding/profile', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bạn là ai')
}

const chip = (page: Page, label: string) => page.getByRole('checkbox', { name: label, exact: true })
const continueButton = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' })

async function fillRequired(page: Page) {
  await page.getByLabel('Họ và tên').fill(REQUIRED.display_name)
  await page.getByLabel('Chức danh hiện tại').fill(REQUIRED.headline)
  await page.getByLabel('Tỉnh / thành phố').selectOption(REQUIRED.region_id)
  await chip(page, 'Logistics').check({ force: true })
}

/** A 1x1 PNG, generated so no binary lives in the repo. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('WF01-S06 functional', () => {
  test('a guest is sent to /auth by the server', async ({ page }) => {
    await page.goto('/onboarding/profile')
    await expect(page).toHaveURL('/auth')
  })

  test('an authenticated account with open onboarding sees S06, step 2 current', async ({
    page,
  }) => {
    await signInFresh(page)
    await openProfile(page)
    await expect(page.locator('[aria-current="step"]')).toHaveText(/Thông tin/)
  })

  test('D5: S06 has no skip action', async ({ page }) => {
    await signInFresh(page)
    await openProfile(page)
    await expect(page.getByText('Bỏ qua, làm sau')).toHaveCount(0)
    await expect(page.locator('header').getByRole('link')).toHaveCount(0)
    await expect(page.locator('header').getByRole('button')).toHaveCount(0)
  })

  test('an existing profile preloads every field', async ({ page }) => {
    await signInFresh(page)
    const patch = await page.request.patch(PROFILE_API, {
      data: { ...REQUIRED, bio: 'Bio', domain_ids: [D.supply], skill_ids: [S.data] },
    })
    expect(patch.status()).toBe(200)
    await openProfile(page)
    await expect(page.getByLabel('Họ và tên')).toHaveValue(REQUIRED.display_name)
    await expect(page.getByLabel('Chức danh hiện tại')).toHaveValue(REQUIRED.headline)
    await expect(page.getByLabel('Tỉnh / thành phố')).toHaveValue(REGION.danang)
    await expect(page.getByLabel('Giới thiệu ngắn')).toHaveValue('Bio')
    await expect(chip(page, 'Vận hành chuỗi cung ứng')).toBeChecked()
    await expect(chip(page, 'Phân tích dữ liệu')).toBeChecked()
    await expect(chip(page, 'Logistics')).not.toBeChecked()
  })

  test('D2: name, headline, region and one expertise are required; nothing is sent', async ({
    page,
  }) => {
    await signInFresh(page)
    let writes = 0
    page.on('request', (r) => {
      if (r.url().endsWith(PROFILE_API) && r.method() === 'PATCH') writes++
    })
    await openProfile(page)
    await continueButton(page).click()
    await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible()
    await expect(page.getByText('Vui lòng nhập chức danh hiện tại.')).toBeVisible()
    await expect(page.getByText('Vui lòng chọn tỉnh / thành phố.')).toBeVisible()
    await expect(page.getByText('Vui lòng chọn ít nhất 1 chuyên môn.')).toBeVisible()
    await expect(page.getByLabel('Họ và tên')).toHaveAttribute('aria-invalid', 'true')

    // Each rule on its own: all but one filled still blocks.
    for (const omit of ['name', 'headline', 'region', 'expertise'] as const) {
      await page.reload({ waitUntil: 'networkidle' })
      if (omit !== 'name') await page.getByLabel('Họ và tên').fill(REQUIRED.display_name)
      if (omit !== 'headline') await page.getByLabel('Chức danh hiện tại').fill(REQUIRED.headline)
      if (omit !== 'region') await page.getByLabel('Tỉnh / thành phố').selectOption(REGION.hanoi)
      if (omit !== 'expertise') await chip(page, 'Logistics').check({ force: true })
      await continueButton(page).click()
      await expect(page.getByRole('alert').filter({ hasText: /^Vui lòng/ })).toHaveCount(1)
    }
    expect(writes).toBe(0)
  })

  test('D2/lifecycle: avatar and bio optional; save → S07, profile stays DRAFT', async ({
    page,
  }) => {
    const accountId = await signInFresh(page)
    await openProfile(page)
    await fillRequired(page)
    await continueButton(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(await stored(accountId)).toMatchObject({
      status: 'DRAFT',
      display_name: REQUIRED.display_name,
      headline: REQUIRED.headline,
      region: REGION.danang,
      bio: null,
      avatar: null,
      completed: null,
      domains: [D.logistics],
      skills: [],
    })
    const onboarding = await (await page.request.get('/api/v1/me/onboarding')).json()
    expect(onboarding).toMatchObject({ completed: false })
  })

  test('D1: one picker, each id saved to its own canonical relation', async ({ page }) => {
    const accountId = await signInFresh(page)
    await openProfile(page)
    await fillRequired(page)
    await chip(page, 'Phân tích dữ liệu').check({ force: true })
    await chip(page, 'Nông nghiệp').check({ force: true })
    const request = page.waitForRequest(
      (r) => r.url().endsWith(PROFILE_API) && r.method() === 'PATCH',
    )
    await continueButton(page).click()
    const body = (await request).postDataJSON() as Record<string, unknown>
    expect(body).toEqual({
      display_name: REQUIRED.display_name,
      headline: REQUIRED.headline,
      region_id: REGION.danang,
      bio: '',
      domain_ids: [D.logistics, D.agri],
      skill_ids: [S.data],
    })
    await expect(page).toHaveURL('/onboarding/privacy')
    const row = await stored(accountId)
    expect(row!.region).toBe(REGION.danang)
    expect(row!.domains).toEqual([D.logistics, D.agri].sort())
    expect(row!.skills).toEqual([S.data])
  })

  test('D4: the picker stops at 5 in total across DOMAIN and SKILL', async ({ page }) => {
    await signInFresh(page)
    await openProfile(page)
    for (const label of [
      'Vận hành chuỗi cung ứng',
      'Logistics',
      'Phân tích dữ liệu',
      'Quản lý sản phẩm',
      'Thương lượng B2B',
    ]) {
      await chip(page, label).check({ force: true })
    }
    await expect(chip(page, 'Nông nghiệp')).toBeDisabled()
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(5)
    await chip(page, 'Logistics').uncheck({ force: true })
    await expect(chip(page, 'Nông nghiệp')).toBeEnabled()
  })

  test('D4: the API rejects more than 5 in total', async ({ page }) => {
    const accountId = await signInFresh(page)
    const response = await page.request.patch(PROFILE_API, {
      data: { domain_ids: [D.supply, D.logistics, D.agri], skill_ids: [S.data, S.product, S.b2b] },
    })
    expect(response.status()).toBe(422)
    expect((await response.json()).error.code).toBe('PROFILE_VALIDATION_FAILED')
    expect(await stored(accountId)).toBeUndefined()
  })

  test('D1: the API rejects a wrong vocabulary type on every field', async ({ page }) => {
    await signInFresh(page)
    for (const data of [
      { region_id: D.supply },
      { domain_ids: [S.data] },
      { skill_ids: [D.supply] },
    ]) {
      const response = await page.request.patch(PROFILE_API, { data })
      expect(response.status(), JSON.stringify(data)).toBe(422)
      expect((await response.json()).error.code).toBe('PROFILE_VALIDATION_FAILED')
    }
  })

  test('D1: an archived item cannot be newly selected', async ({ page }) => {
    await signInFresh(page)
    const response = await page.request.patch(PROFILE_API, { data: { domain_ids: [D.archived] } })
    expect(response.status()).toBe(422)
    expect((await response.json()).error.code).toBe('VOCABULARY_ITEM_INACTIVE')
    await openProfile(page)
    await expect(chip(page, 'Nhóm QA lưu trữ')).toHaveCount(0)
  })

  test('D1: an existing archived relation stays readable and selected', async ({ page }) => {
    const accountId = await signInFresh(page)
    await page.request.patch(PROFILE_API, { data: { display_name: 'X' } })
    await query(
      `INSERT INTO profile_domains (profile_id, vocab_id)
       SELECT id, $2 FROM individual_profiles WHERE account_id = $1`,
      [accountId, D.archived],
    )
    const dto = await (await page.request.get(PROFILE_API)).json()
    expect(dto.domains).toEqual([{ id: D.archived, label: 'Nhóm QA lưu trữ', status: 'ARCHIVED' }])
    await openProfile(page)
    await expect(chip(page, 'Nhóm QA lưu trữ')).toBeChecked()
  })

  test('PATCH is atomic: one bad id changes nothing', async ({ page }) => {
    await signInFresh(page)
    await page.request.patch(PROFILE_API, {
      data: { ...REQUIRED, domain_ids: [D.supply], skill_ids: [S.data] },
    })
    const before = await (await page.request.get(PROFILE_API)).json()
    const response = await page.request.patch(PROFILE_API, {
      data: {
        display_name: 'Changed',
        headline: 'Changed',
        domain_ids: [D.agri],
        skill_ids: [S.product, D.finance],
      },
    })
    expect(response.status()).toBe(422)
    expect(await (await page.request.get(PROFILE_API)).json()).toEqual(before)
  })

  test('the client cannot submit completion_percent', async ({ page }) => {
    await signInFresh(page)
    const response = await page.request.patch(PROFILE_API, { data: { completion_percent: 100 } })
    expect(response.status()).toBe(422)
    expect((await response.json()).error.fields).toEqual({ completion_percent: 'not_accepted' })
  })

  test('D3: avatar upload stores only an opaque id, served privately', async ({
    page,
    browser,
  }) => {
    const accountId = await signInFresh(page)
    await openProfile(page)
    const upload = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/profile/avatar'))
    await page.locator('input[type="file"]').setInputFiles({
      name: 'me.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    })
    const result = await (await upload).json()
    expect(result.asset_id).toMatch(/^asset_[0-9a-f]{32}$/)
    expect(result.url).toBe(`/media/assets/${result.asset_id}`)
    await expect(page.getByRole('img', { name: 'Ảnh đại diện hiện tại' })).toBeVisible()

    // Canonical data is the id alone: no URL, host or path is stored.
    expect((await stored(accountId))!.avatar).toBe(result.asset_id)
    const media = await page.request.get(result.url)
    expect(media.status()).toBe(200)
    expect(media.headers()['content-type']).toBe('image/png')
    expect(media.headers()['cache-control']).toBe('private, no-store')
    // A guest cannot read it.
    const guest = await browser.newContext()
    expect((await guest.request.get(new URL(result.url, page.url()).toString())).status()).toBe(404)
    await guest.close()

    // Counts for completion (group AVATAR).
    const completion = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(completion.groups[1]).toEqual({ code: 'AVATAR', complete: true, weight: 10 })
  })

  test('D3: a non-image upload is refused with a recoverable message', async ({ page }) => {
    const accountId = await signInFresh(page)
    await openProfile(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    })
    await expect(page.getByText('Chỉ nhận ảnh PNG, JPEG hoặc WebP.')).toBeVisible()
    expect(await stored(accountId)).toBeUndefined()
  })

  test('an API failure is recoverable: message shown, retry succeeds', async ({ page }) => {
    const accountId = await signInFresh(page)
    await openProfile(page)
    await page.route(`**${PROFILE_API}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
          })
        : route.continue(),
    )
    await fillRequired(page)
    await continueButton(page).click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Chưa lưu được thông tin. Vui lòng thử lại.',
    )
    await expect(page.getByLabel('Họ và tên')).toHaveValue(REQUIRED.display_name)
    expect(await stored(accountId)).toBeUndefined()

    await page.unroute(`**${PROFILE_API}`)
    await continueButton(page).click()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect((await stored(accountId))!.display_name).toBe(REQUIRED.display_name)
  })

  test('repeated submits send one request', async ({ page }) => {
    await signInFresh(page)
    await openProfile(page)
    await fillRequired(page)
    let writes = 0
    await page.route(`**${PROFILE_API}`, async (route) => {
      writes++
      await new Promise((done) => setTimeout(done, 400))
      await route.continue()
    })
    await page.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
      form.requestSubmit()
      form.requestSubmit()
    })
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(writes).toBe(1)
  })

  test('keyboard and a11y: labelled fields, named group, visible focus', async ({ page }) => {
    await signInFresh(page)
    await openProfile(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('group', { name: 'Chuyên môn · chọn tối đa 5' })).toBeVisible()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Tải ảnh' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Họ và tên')).toBeFocused()
    await page.keyboard.type(REQUIRED.display_name)
    await page.keyboard.press('Tab')
    await page.keyboard.type(REQUIRED.headline)
    await page.keyboard.press('Tab')
    const region = page.getByLabel('Tỉnh / thành phố')
    await expect(region).toBeFocused()
    await region.selectOption(REGION.hanoi)
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Giới thiệu ngắn')).toBeFocused()
    await page.keyboard.press('Tab')
    const first = chip(page, 'Vận hành chuỗi cung ứng')
    await expect(first).toBeFocused()
    expect(await first.evaluate((el) => getComputedStyle(el.parentElement!).outlineStyle)).not.toBe(
      'none',
    )
    await page.keyboard.press('Space')
    await expect(first).toBeChecked()
    await continueButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/onboarding/privacy')
  })

  test('"+ N nhóm khác" reveals the rest of the data-driven list', async ({ page }) => {
    await signInFresh(page)
    await openProfile(page)
    const more = page.getByRole('button', { name: /^\+ \d+ nhóm khác$/ })
    const hidden = Number((await more.innerText()).match(/\d+/)![0])
    const before = await page.locator('input[type="checkbox"]').count()
    await more.click()
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(before + hidden)
    await expect(more).toHaveCount(0)
  })

  test('completion: /session, /me/profile and /me/profile/completion agree', async ({ page }) => {
    await signInFresh(page)
    await page.request.patch(PROFILE_API, {
      data: { ...REQUIRED, bio: 'Bio', domain_ids: [D.supply], skill_ids: [S.data] },
    })
    const session = await (await page.request.get('/api/v1/session')).json()
    const profile = await (await page.request.get(PROFILE_API)).json()
    const completion = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(completion.groups.map((g: { code: string }) => g.code)).toEqual([
      'DISPLAY_NAME',
      'AVATAR',
      'HEADLINE',
      'REGION',
      'BIO',
      'DOMAIN',
      'SKILLS',
      'EXPERIENCE',
      'DEVELOPMENT_GOAL',
      'CURRENT_NEED',
    ])
    expect(completion.percent).toBe(60)
    expect(profile.completion.percent).toBe(60)
    expect(session.profile.completion_percent).toBe(60)
  })

  test('key text colours match the approved inks', async ({ page }) => {
    await signInFresh(page)
    await page.request.patch(PROFILE_API, {
      data: { ...REQUIRED, domain_ids: [D.supply], skill_ids: [] },
    })
    await openProfile(page)
    const colours = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const rgb = (el: Element | null) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = getComputedStyle(el!).color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const chipOf = (checked: boolean) =>
        [...document.querySelectorAll('label[data-type]')].find(
          (el) => el.querySelector('input')!.checked === checked,
        )!
      return {
        title: rgb(document.querySelector('h1')),
        lede: rgb(document.querySelector('h1 + p')),
        label: rgb(document.querySelector('.ui-label')),
        input: rgb(document.querySelector('input[name="display_name"]')),
        chipSelected: rgb(chipOf(true)),
        chip: rgb(chipOf(false)),
        caption: rgb(document.querySelector('#expertise-help')),
        back: rgb(document.querySelector('a.ui-button')),
        cta: rgb(document.querySelector('button[type="submit"]')),
      }
    })
    // Inks read from the approved WF01-S06 bitmap; +-3 per channel for raster rounding.
    const APPROVED: Record<keyof typeof colours, [number, number, number]> = {
      title: [0x17, 0x00, 0x02],
      lede: [0x53, 0x40, 0x41],
      label: [0x17, 0x00, 0x02],
      input: [0x17, 0x00, 0x02],
      chipSelected: [0x16, 0x00, 0x02],
      chip: [0x53, 0x40, 0x41],
      caption: [0x53, 0x40, 0x41],
      back: [0x17, 0x00, 0x02],
      cta: [0x16, 0x00, 0x02],
    }
    for (const key of Object.keys(APPROVED) as (keyof typeof colours)[]) {
      colours[key].forEach((channel, i) => {
        expect(Math.abs(channel - APPROVED[key][i]!), `${key} channel ${i}`).toBeLessThanOrEqual(3)
      })
    }
  })
})

test.describe('WF01-S06 pixel QA', () => {
  /**
   * Measured once from the frozen reference, not from the implementation.
   * The baseline is a viewport scrolled 65px with the card drawn over the
   * header band (card top y=43); the runtime card starts at y=108 under the
   * header, so card content is compared on a full-page capture at dy=+65
   * (INTENTIONAL-COMPOSITION). The lede wraps to two lines in the frozen font,
   * moving everything below it a further line (INTENTIONAL-TYPOGRAPHY-MIGRATION).
   */
  const REF = {
    cardTop: 43,
    avatarTop: 170,
    skip: { x: 1290, y: 0, width: 150, height: 62 },
    discs: [544, 661, 798],
    connectors: [625, 762],
    /** Control boxes (top, height) on the baseline, in card-lower coordinates. */
    controls: [
      { name: 'upload', selector: 'button.ui-button[type="button"]', top: 184, height: 49 },
      { name: 'display_name', selector: 'input[name="display_name"]', top: 288, height: 48 },
      { name: 'headline', selector: 'input[name="headline"]', top: 377, height: 48 },
      { name: 'region', selector: 'div:has(> select[name="region_id"])', top: 466, height: 48 },
      { name: 'bio', selector: 'textarea[name="bio"]', top: 555, height: 85 },
    ],
  } as const

  test('manifest-driven capture, typography contract and segment comparison', async ({ page }) => {
    const { screens } = loadManifest()
    const reports = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S06'),
      qaConfigFor('WF01-S06')!,
      {
        beforeNavigate: async (p) => {
          // The reference example state; values are fixture content, not business data.
          const response = await p.request.patch(PROFILE_API, {
            data: {
              ...REQUIRED,
              bio: 'Tám năm làm vận hành chuỗi cung ứng trước khi lập Tracely…',
              domain_ids: [D.supply, D.logistics],
              skill_ids: [S.data],
            },
          })
          expect(response.status()).toBe(200)
        },
        afterLoad: async (p) => {
          await expect(chip(p, 'Logistics')).toBeChecked()
        },
      },
    )
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.conditions).toEqual({
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      fonts: 'loaded',
    })
    expect(viewport.typography!.violations).toEqual([])
    expect(viewport.typography!.checked).toBeGreaterThan(20)

    const fullBuffer = await page.screenshot({ fullPage: true, animations: 'disabled' })
    const fullPath = resolveOutputPath('actual', 'WF01-S06.full_page.png')
    writeBuffer(fullPath, fullBuffer)
    const actual = decodePng(fullBuffer)

    const card = (await page.locator('[data-ui="surface"]').boundingBox())!
    const avatar = (await page.locator('[data-avatar]').boundingBox())!
    const upperDy = Math.round(card.y) - REF.cardTop
    const lowerDy = Math.round(avatar.y) - REF.avatarTop
    const discs = await page
      .locator('ol li > span:first-child')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)))
    const steps = await page
      .locator('ol li')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)))

    // Glyphs of text nodes and form values, and icon SVGs (INTENTIONAL-ICON-RENDERING);
    // fills, borders, discs and chip shapes stay compared.
    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const add = (r: DOMRect, pad = 2) =>
        rects.push({
          x: r.x - pad,
          y: r.y - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        })
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (!node.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of range.getClientRects()) add(r)
      }
      for (const el of document.querySelectorAll(
        'input:not([type]), input[type="text"], textarea',
      )) {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth)
        add(new DOMRect(r.x + padX, r.y + padY, r.width - padX * 2, r.height - padY * 2))
      }
      for (const svg of document.querySelectorAll('svg')) add(svg.getBoundingClientRect(), 1)
      // Chips: the label text sets each chip's width, so its right end moves with the font.
      for (const el of document.querySelectorAll('label[data-type], form button[type="button"]')) {
        const r = el.getBoundingClientRect()
        if (r.height < 40) add(new DOMRect(r.x + 12, r.y, r.width - 12, r.height), 1)
      }
      return rects
    })

    // RASTER-NOISE: the baseline rasterised these controls at half-pixel y, so
    // each 1px horizontal edge is smeared over two rows; a CSS border is crisp.
    // Those edge rows (and only those) leave the outside-text count. Their
    // geometry is asserted instead: every box within 1px of the baseline.
    const rasterRows: Rect[] = []
    const geometry = []
    for (const control of REF.controls) {
      const box = (await page.locator(control.selector).first().boundingBox())!
      const expectedTop = control.top + lowerDy
      geometry.push({ ...control, actual_top: Math.round(box.y), expected_top: expectedTop })
      expect(Math.abs(Math.round(box.y) - expectedTop), `${control.name} top`).toBeLessThanOrEqual(
        1,
      )
      expect(
        Math.abs(Math.round(box.height) - control.height),
        `${control.name} height`,
      ).toBeLessThanOrEqual(1)
      for (const y of [box.y - 1, box.y + box.height - 2]) {
        rasterRows.push({ x: box.x, y: Math.round(y), width: box.width, height: 3 })
      }
    }

    const segments: Segment[] = [
      { name: 'header-left', reference: { x: 0, y: 0, width: 300, height: 64 }, dy: 0 },
      { name: 'header-right', reference: { x: 1140, y: 0, width: 150, height: 64 }, dy: 0 },
      ...REF.discs.map((x, i) => ({
        name: `step-${i + 1}-disc`,
        reference: { x: x - 4, y: 17, width: 30, height: 26 },
        dy: 0,
        dx: discs[i]! - x,
      })),
      ...REF.connectors.map((x, i) => ({
        name: `connector-${i + 1}`,
        reference: { x: x - 2, y: 27, width: 30, height: 8 },
        dy: 0,
        dx: steps[i + 1]! + 12 - x,
      })),
      { name: 'canvas-left', reference: { x: 0, y: 64, width: 300, height: 836 }, dy: 0 },
      { name: 'canvas-right', reference: { x: 1140, y: 64, width: 300, height: 836 }, dy: 0 },
      {
        name: 'card-upper',
        // Card only: beside it, the baseline's header band runs under the card's top.
        reference: { x: 340, y: REF.cardTop, width: 760, height: 160 - REF.cardTop },
        dy: upperDy,
      },
      {
        name: 'card-lower',
        reference: { x: 300, y: 160, width: 840, height: 900 - 160 },
        dy: lowerDy,
      },
    ]

    const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
    const diffPath = resolveOutputPath('diff', 'WF01-S06.segments.diff.png')
    const results = compareSegments(reference, actual, segments, [...textMask, ...rasterRows], {
      diffPath,
    })

    writeJsonReport('WF01-S06.segments.json', {
      screen_id: 'WF01-S06',
      state: 'reference example values via PATCH, 3 expertise chips selected, no avatar',
      images: {
        REFERENCE: viewport.images.REFERENCE,
        ACTUAL: viewport.images.ACTUAL,
        ACTUAL_FULL_PAGE: path.relative(REPO_ROOT, fullPath),
        DIFF_FULL: viewport.images.DIFF,
        DIFF_SEGMENTS: path.relative(REPO_ROOT, diffPath),
      },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reference_region: REF.skip,
          reason:
            'DEC-WF01-S06-D5: S06 has no skip action; the header "Bỏ qua, làm sau" is not rendered',
        },
        {
          class: 'INTENTIONAL-COMPOSITION',
          reason:
            'baseline is a 65px-scrolled viewport with the card over the header band (y 21-62 at x 300-1140 excluded); runtime card starts under the header and is compared on a full-page capture',
          vertical_effect_px: { card_upper_dy: upperDy },
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason:
            'frozen font wraps the lede onto a second line (everything below moves one line); wider labels move stepper discs 2-3 and chip ends; text glyphs masked and checked by the DOM typography contract',
          vertical_effect_px: { card_lower_dy: lowerDy },
          step_dx: segments.filter((s) => s.name.startsWith('step-')).map((s) => s.dx),
        },
        {
          class: 'INTENTIONAL-ICON-RENDERING',
          reason: 'check marks are inline SVG (DEC-WF01-S03-ICON), the baseline uses a glyph',
        },
        {
          class: 'RASTER-NOISE',
          reason:
            'baseline control edges sit on half pixels (two smeared rows per 1px horizontal edge); those rows are excluded and the control boxes asserted within 1px instead',
          rows: rasterRows,
          geometry,
        },
        {
          class: 'INTENTIONAL-DATA-FIXTURE',
          reason: 'DEC-WF01-S06-D6: chip labels come from the QA-only fixture, not launch taxonomy',
        },
      ],
      segments: results,
      text_mask: textMask,
      product_pixel_pass_claimed: false,
    })

    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
