import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { PROGRAMME_CARDS } from '../../../src/components/home/home-content'
import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { query } from '../../../src/lib/db/client'
import {
  addVisibleFounder,
  clearLibraryFixture,
  FX_EXCLUDED,
  FX_OWNERS,
  FX_PRIVATE,
  seedLibraryFixture,
  type LibraryFixture,
} from '../../../src/lib/library/testing'
import { LIBRARY_PROBLEMS } from '../../../src/lib/library/problem-source'
import { settle } from '../pixel-qa/capture'
import { REPO_ROOT, resolveOutputPath, resolveReferencePath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * THAO-05 — DIR0–DIR3 discovery (DEC-THAO-DIR): `/programmes`, `/problems`,
 * `/products`, `/talents`. Visibility and privacy are asserted on the HTML the
 * server sends (the boundary), then the shared contract: search, filters,
 * address, refresh, reset, empty, sort, Back, cards, nav and responsive.
 *
 * Data (isolated QA database only): the deterministic seed (one PUBLISHED
 * programme with its form), the demo data (`demo_0710.sql`), the WF06 Library
 * fixture (owners at every visibility, ventures at every status) and six
 * programme rows of this spec (`thao05-fx-*`), all removed afterwards.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const FX_PROGRAMMES = {
  open: 'a7050000-0000-0000-0000-000000000001',
  upcoming: 'a7050000-0000-0000-0000-000000000002',
  past: 'a7050000-0000-0000-0000-000000000003',
  closed: 'a7050000-0000-0000-0000-000000000004',
  draft: 'a7050000-0000-0000-0000-000000000005',
  hiddenHost: 'a7050000-0000-0000-0000-000000000006',
} as const
const DRAFT_NAME = 'THAO05 Bản nháp chưa công bố'

let fx: LibraryFixture
let memberToken = ''
let consoleErrors: string[] = []

async function clearProgrammes() {
  await query(`DELETE FROM programme_application_forms WHERE programme_id::text LIKE 'a7050000-%'`)
  await query(`DELETE FROM programmes WHERE id::text LIKE 'a7050000-%'`)
}

async function clearDemo() {
  await query(`DELETE FROM profile_visibility_settings WHERE profile_id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM project_members WHERE id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM project_domains WHERE project_id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM projects WHERE id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM individual_profiles WHERE id::text LIKE 'de710000-%'`)
  await query(`DELETE FROM user_accounts WHERE id::text LIKE 'de710000-%'`)
  await query(
    `DELETE FROM vocabulary_items v WHERE v.id::text LIKE 'de710000-%'
        AND NOT EXISTS (SELECT 1 FROM project_domains d WHERE d.vocabulary_item_id = v.id)`,
  )
}

test.beforeAll(async () => {
  await clearProgrammes()
  // Another spec may leave a PRIVATE override on a demo profile: start from the
  // demo's own levels.
  await query(`DELETE FROM profile_visibility_settings WHERE profile_id::text LIKE 'de710000-%'`)
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
  fx = await seedLibraryFixture()
  await addVisibleFounder('Minh')
  memberToken = (await createSession(fx.accounts.stranger)).token
  const draftOrg = (
    await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE slug = 'wf06-fx-org-draft'`,
    )
  )[0]!.id
  const rows: Array<
    [string, string, string, string, string, string, string | null, string | null]
  > = [
    // id, org, type, slug, name, status, starts, ends (relative to now: the phase is derived)
    [
      FX_PROGRAMMES.open,
      CHAPTER_01,
      'CHALLENGE',
      'thao05-fx-open',
      'THAO05 Thử thách đang mở',
      'PUBLISHED',
      '-10 days',
      '20 days',
    ],
    [
      FX_PROGRAMMES.upcoming,
      CHAPTER_01,
      'PROGRAMME',
      'thao05-fx-upcoming',
      'THAO05 Chương trình sắp tới',
      'PUBLISHED',
      '10 days',
      '40 days',
    ],
    [
      FX_PROGRAMMES.past,
      CHAPTER_01,
      'PROGRAMME',
      'thao05-fx-past',
      'THAO05 Chương trình đã qua',
      'PUBLISHED',
      '-40 days',
      '-5 days',
    ],
    [
      FX_PROGRAMMES.closed,
      CHAPTER_01,
      'CHALLENGE',
      'thao05-fx-closed',
      'THAO05 Thử thách đã đóng',
      'CLOSED',
      '-60 days',
      '-30 days',
    ],
    [
      FX_PROGRAMMES.draft,
      CHAPTER_01,
      'PROGRAMME',
      'thao05-fx-draft',
      DRAFT_NAME,
      'DRAFT',
      '-1 days',
      '30 days',
    ],
    [
      FX_PROGRAMMES.hiddenHost,
      draftOrg,
      'PROGRAMME',
      'thao05-fx-hidden-host',
      'THAO05 Chủ quản chưa công bố',
      'PUBLISHED',
      null,
      null,
    ],
  ]
  for (const [id, org, type, slug, name, status, starts, ends] of rows)
    await query(
      `INSERT INTO programmes (id, organization_id, programme_type, slug, name, summary, status, starts_at, ends_at)
       VALUES ($1, $2, $3::programme_type, $4, $5, 'THAO05 tóm tắt công khai.', $6::programme_status,
               CASE WHEN $7::text IS NULL THEN NULL ELSE now() + $7::interval END,
               CASE WHEN $8::text IS NULL THEN NULL ELSE now() + $8::interval END)`,
      [id, org, type, slug, name, status, starts, ends],
    )
  for (const id of [FX_PROGRAMMES.open, FX_PROGRAMMES.past])
    await query(
      `INSERT INTO programme_application_forms (programme_id, applicant_types) VALUES ($1, ARRAY['TEAM']::applicant_type[])`,
      [id],
    )
})

test.afterAll(async () => {
  await clearProgrammes()
  await clearLibraryFixture()
  await clearDemo()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

const signIn = (page: Page, baseURL: string | undefined) =>
  page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: memberToken, url: baseURL! }])

const cards = (page: Page, kind: string) => page.locator(`ul[role="list"] > li[data-${kind}]`)
const html = async (page: Page, url: string) => (await page.request.get(url)).text()

// ------------------------------------------------------------------ DIR0

// PROGRAMME-PRESENTATION-DATA-01: the list is the source-backed programmes only
// (the homepage's PROGRAMME_CARDS); no programme row — fixture or not — is
// projected, so the deterministic seed and this spec's rows must not appear.
const SOURCE_NAMES = PROGRAMME_CARDS.map((c) => c.title)
const FIXTURE_WORDS = ['(demo)', 'Internal Alpha', 'Chương trình mẫu', 'Chapter 01', 'THAO05']

test.describe('DIR0 /programmes', () => {
  test('source-backed only: the homepage programmes, no fixture row, wording or id', async ({
    page,
  }) => {
    const body = await html(page, '/programmes')
    for (const id of [SEED_PROGRAMME, ...Object.values(FX_PROGRAMMES)])
      expect(body, `no programme id ${id}`).not.toContain(id)
    await page.goto('/programmes', { waitUntil: 'networkidle' })
    const text = await page.locator('body').innerText()
    for (const word of FIXTURE_WORDS) expect(text, word).not.toContain(word)
    expect(text).not.toContain(DRAFT_NAME)
    await expect(cards(page, 'programme')).toHaveCount(SOURCE_NAMES.length)
    expect(await cards(page, 'programme').locator('h2').allInnerTexts()).toEqual(
      [...SOURCE_NAMES].sort((a, b) => a.localeCompare(b, 'vi')),
    )
    for (const c of PROGRAMME_CARDS) {
      // The homepage's own values: host, description, status and type; no invented dates.
      const card = cards(page, 'programme').filter({ hasText: c.title })
      await expect(card).toHaveAttribute('data-programme', 'sap-cong-bo')
      await expect(card.locator('[class*="progHost"]')).toHaveText(c.owner!)
      await expect(card.locator('[class*="progPhase"]')).toHaveText(c.status)
      await expect(card.locator('p')).toHaveText(c.description)
      await expect(card.locator('[class*="progTags"] li')).toHaveText(['Challenge'])
    }
    // Nothing is open; no card offers an apply entry (no programme record behind it).
    await expect(page.locator('h1 span')).toHaveText('0')
    await expect(page.locator('a[href*="/apply"]')).toHaveCount(0)
    await expect(cards(page, 'programme').locator('[data-cta-kind="INERT"]')).toHaveCount(
      SOURCE_NAMES.length,
    )
  })

  test('member: the same source-backed list, no apply entry; the API stays guarded', async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL)
    await page.goto('/programmes', { waitUntil: 'networkidle' })
    await expect(cards(page, 'programme')).toHaveCount(SOURCE_NAMES.length)
    await expect(page.locator('a[href*="/apply"]')).toHaveCount(0)
    expect(await page.locator('body').innerText()).not.toContain('(demo)')
    // The management API stays behind its capability: a guest reads nothing.
    await page.context().clearCookies()
    expect((await page.request.get('/api/v1/programmes')).status()).toBeGreaterThanOrEqual(400)
  })

  test('search, filters, address, refresh, reset, empty, sort and Back', async ({ page }) => {
    await page.goto('/programmes', { waitUntil: 'networkidle' })
    const total = await cards(page, 'programme').count()
    await page.getByRole('search').getByRole('searchbox').fill('vpbank')
    await page.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL(/\?q=vpbank$/)
    await expect(cards(page, 'programme')).toHaveCount(1)
    const rail = page.getByRole('complementary', { name: 'Bộ lọc' })
    await rail.getByLabel(/^Sắp công bố/).check()
    await expect(page).toHaveURL(/trang-thai=sap-cong-bo/)
    await expect(cards(page, 'programme')).toHaveCount(1)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(cards(page, 'programme')).toHaveCount(1)
    await expect(rail.getByLabel(/^Sắp công bố/)).toBeChecked()
    // A status the source has none of: the empty state, then reset.
    await rail.getByLabel(/^Sắp công bố/).uncheck()
    await rail.getByLabel(/^Đã kết thúc/).check()
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
    await page.getByRole('button', { name: 'Xoá tất cả bộ lọc' }).click()
    await expect(page).toHaveURL(/\/programmes$/)
    await expect(cards(page, 'programme')).toHaveCount(total)
    // Host and type facets come from the source rows.
    await rail.getByLabel(/^Net Zero Vietnam/).check()
    await expect(page).toHaveURL(/don-vi=net-zero-vietnam/)
    await expect(cards(page, 'programme')).toHaveCount(1)
    await rail.getByLabel(/^Programme/).check()
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
    await page.goto('/programmes?q=khong-co-chuong-trinh-nao', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
    await page.getByRole('button', { name: 'Xoá tất cả bộ lọc' }).click()
    await expect(page).toHaveURL(/\/programmes$/)
    await expect(cards(page, 'programme')).toHaveCount(total)
    await page.getByLabel('Sắp xếp:').selectOption('ten-a-z')
    await expect(page).toHaveURL(/sap-xep=ten-a-z/)
    const names = await cards(page, 'programme').locator('h2').allInnerTexts()
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'vi')))
    // Back returns to the list from a page reached through it.
    await page.locator('[data-cta="to-problems"]').click()
    await expect(page).toHaveURL('/problems')
    await page.goBack()
    await expect(page).toHaveURL(/\/programmes\?sap-xep=ten-a-z$/)
    await expect(page.getByLabel('Sắp xếp:')).toHaveValue('ten-a-z')
  })
})

// ------------------------------------------------------------------ DIR1

test.describe('DIR1 /problems', () => {
  test('the static dataset only: count, READ_ONLY cards, no programme relation', async ({
    page,
  }) => {
    const body = await html(page, '/problems')
    for (const challenge of ['ha-noi-30-bai-toan-lon-2026', 'mobifone-ioc-tay-ho-2026'])
      expect(body, challenge).not.toContain(challenge)
    expect(body).not.toContain(DRAFT_NAME)
    await page.goto('/problems', { waitUntil: 'networkidle' })
    await expect(page.locator('h1 span')).toHaveText(String(LIBRARY_PROBLEMS.length))
    await expect(cards(page, 'problem').locator('a, button')).toHaveCount(0)
    await expect(page.locator('[data-section="directory"] a[href^="/programmes"]')).toHaveCount(0)
  })

  test('search, facets from the file, address, refresh, empty, sort', async ({ page }) => {
    await page.goto('/problems', { waitUntil: 'networkidle' })
    const rail = page.getByRole('complementary', { name: 'Bộ lọc' })
    await rail.getByLabel(/^Giao thông/).check()
    await expect(page).toHaveURL(/linh-vuc=Giao\+th%C3%B4ng/)
    const n = LIBRARY_PROBLEMS.filter((p) => p.domains.includes('Giao thông')).length
    await expect(cards(page, 'problem')).toHaveCount(n)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(cards(page, 'problem')).toHaveCount(n)
    await page.goto('/problems?giai-doan=dang_cham', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
    await page.goto('/problems?sap-xep=ten-a-z&q=%C3%B9n+t%E1%BA%AFc', { waitUntil: 'networkidle' })
    await expect(cards(page, 'problem').first()).toContainText('ùn tắc')
  })
})

// ------------------------------------------------------------------ DIR2

test.describe('DIR2 /products', () => {
  test('PUBLIC + ACTIVE only; hidden slugs 404; no owner or internal id', async ({ page }) => {
    const body = await html(page, '/products')
    for (const v of FX_EXCLUDED) expect(body, v.name).not.toContain(v.name)
    for (const id of Object.values(fx.owners)) expect(body, 'owner id').not.toContain(id)
    for (const id of Object.values(fx.ventures)) expect(body, 'venture id').not.toContain(id)
    for (const value of Object.values(FX_PRIVATE)) expect(body).not.toContain(value)
    const hidden = await query<{ slug: string }>(
      `SELECT slug FROM projects WHERE slug LIKE 'wf06-fx-%'
          AND NOT (type = 'STARTUP' AND status = 'ACTIVE' AND visibility = 'PUBLIC')`,
    )
    expect(hidden.length).toBe(FX_EXCLUDED.length)
    for (const { slug } of hidden)
      expect((await page.request.get(`/products/${slug}`)).status(), slug).toBe(404)
  })

  test('location contract: country → region, invalid pair empty, legacy label rewritten', async ({
    page,
  }) => {
    await page.goto('/products?quoc-gia=vn&tinh=da-nang', { waitUntil: 'networkidle' })
    const rail = page.getByRole('complementary', { name: 'Bộ lọc' })
    await expect(rail.getByLabel(/^Việt Nam/)).toBeChecked()
    await expect(rail.getByLabel('Tỉnh/thành:')).toHaveValue('da-nang')
    for (const place of await cards(page, 'startup')
      .locator('[class*="cardName"] p')
      .allInnerTexts())
      expect(place).toBe('Đà Nẵng')
    // A region outside the chosen country, or an unknown slug: the controlled empty state.
    for (const bad of ['quoc-gia=sg&tinh=hanoi', 'tinh=khong-co', 'quoc-gia=zz']) {
      await page.goto(`/products?${bad}`, { waitUntil: 'networkidle' })
      await expect(page.locator('[data-state="empty"]'), bad).toContainText('Khu vực không có')
    }
    // DEMO-DIR2-01's label form is read and rewritten with the slugs.
    await page.goto('/products?tinh=TP.%20%C4%90%C3%A0%20N%E1%BA%B5ng', {
      waitUntil: 'networkidle',
    })
    await expect(page).toHaveURL(/\/products\?quoc-gia=vn&tinh=da-nang$/)
    // Abroad: choosing a country filters; none of these ventures is abroad.
    await page.goto('/products', { waitUntil: 'networkidle' })
    await rail.getByLabel(/^Quốc tế/).check()
    await rail.getByLabel('Quốc gia:').selectOption('sg')
    await expect(page).toHaveURL(/quoc-gia=sg/)
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
  })

  test('search, sort in the address, detail and Back', async ({ page }) => {
    await page.goto('/products?sap-xep=ten-a-z', { waitUntil: 'networkidle' })
    await expect(page.getByLabel('Sắp xếp:')).toHaveValue('ten-a-z')
    await page.getByRole('search').getByRole('searchbox').fill('WF06 An Khang')
    await page.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(cards(page, 'startup')).toHaveCount(1)
    // S2-PRODUCT-CATALOG-CLEANUP-01: no detail link on a card without an approved detail.
    await expect(cards(page, 'startup').getByRole('link', { name: 'Xem hồ sơ' })).toHaveCount(0)
    await page.goto('/products', { waitUntil: 'networkidle' })
    await page.goBack()
    await expect(page).toHaveURL(/q=WF06\+An\+Khang/)
  })
})

// ------------------------------------------------------------------ DIR3

const OWNER_NAMES = Object.values(FX_OWNERS)
  .map((o) => o.displayName)
  .filter((n): n is string => Boolean(n))
const DEMO_NAMES = ['Đặng Kim Chi', 'Nguyễn Minh Anh', 'Võ Thanh Hà']

test.describe('DIR3 /talents', () => {
  test('guest: the gate only; no name, avatar, card, count or filter', async ({ page }) => {
    const res = await page.request.get('/talents')
    expect(res.status()).toBe(200)
    const body = await res.text()
    for (const name of [...OWNER_NAMES, ...DEMO_NAMES]) expect(body, name).not.toContain(name)
    expect(body).not.toContain('/media/assets/')
    for (const id of Object.values(fx.owners)) expect(body).not.toContain(id)
    await page.goto('/talents', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="gate"]')).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Nhân tài trong mạng lưới')
    await expect(page.locator('h1 span, [data-talent], aside, [role="search"]')).toHaveCount(0)
    await expect(page.locator('[data-cta="talent-sign-in"]')).toHaveAttribute('href', '/auth')
    // Query parameters change nothing for a guest.
    const filtered = await (
      await page.request.get('/talents?linh-vuc=Gi%C3%A1o+d%E1%BB%A5c&q=WF06')
    ).text()
    for (const name of OWNER_NAMES) expect(filtered, name).not.toContain(name)
  })

  test('member: NETWORK_ONLY projection only; private, inactive and nameless absent; no private field', async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL)
    const body = await html(page, '/talents')
    for (const shown of ['WF06 Founder Lan', 'WF06 Founder Hải', 'WF06 Thành Viên Khác'])
      expect(body, shown).toContain(shown)
    // S2-TALENT-DIRECTORY-CLEANUP-01: the demo / seed personas are never listed.
    for (const persona of [...DEMO_NAMES, 'Demo Member', 'Demo Leader', 'Demo Pending'])
      expect(body, persona).not.toContain(persona)
    for (const hidden of ['WF06 Founder Ẩn', 'WF06 Founder Nghỉ', 'WF06 Founder Khóa'])
      expect(body, hidden).not.toContain(hidden)
    for (const value of [FX_PRIVATE.fullName, FX_PRIVATE.phone, FX_PRIVATE.bio])
      expect(body).not.toContain(value)
    for (const id of Object.values(fx.owners)) expect(body, 'profile id').not.toContain(id)
    expect(body).not.toMatch(/@example\.test|mailto:/)
    // D4: no skills or specialisations anywhere.
    await page.goto('/talents', { waitUntil: 'networkidle' })
    await expect(page.getByRole('complementary', { name: 'Bộ lọc' })).not.toContainText(
      /CHUYÊN MÔN|KỸ NĂNG/i,
    )
    // S2-TALENT-DIRECTORY-CLEANUP-01: the PO's wording, no count and no numeric summary.
    await expect(page.locator('h1')).toHaveText('các nhân tài trong mạng lưới')
    await expect(page.locator('[data-section="directory-hero"] dl')).toHaveCount(0)
  })

  test('member: detail only for the demo allow-list; direct handles and ids stay 404', async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL)
    // The shared QA database holds many profiles named like the demo founders
    // (journey specs): open the whole list, then read every profile link.
    await page.goto('/talents', { waitUntil: 'networkidle' })
    const more = page.getByRole('button', { name: /^Xem thêm \d+/ })
    while (await more.count()) await more.click()
    const hrefs = await cards(page, 'talent')
      .getByRole('link', { name: 'Xem hồ sơ' })
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    // S2-TALENT-DIRECTORY-CLEANUP-01: the demo founders are not listed any more.
    expect(hrefs).not.toContain('/talents/dang-kim-chi')
    for (const h of hrefs) expect(h, 'allow-listed handles only').toMatch(/^\/talents\/[a-z-]+$/)
    const handles = new Set(hrefs)
    expect(handles.size, 'one card per allow-listed founder').toBe(hrefs.length)
    await page.goto('/talents?q=WF06+Founder+Lan', { waitUntil: 'networkidle' })
    await expect(cards(page, 'talent').getByRole('link', { name: 'Xem hồ sơ' })).toHaveCount(0)
    await expect(
      cards(page, 'talent').locator('[data-cta="talent-profile-readonly"]'),
    ).toHaveAttribute('aria-disabled', 'true')
    for (const probe of [
      `/talents/${fx.owners.lan}`,
      `/talents/${fx.owners.hidden}`,
      '/talents/wf06-founder-lan',
      '/talents/de710000-0000-0000-0000-0000000000b1',
    ])
      expect((await page.request.get(probe)).status(), probe).toBe(404)
  })

  test('member: domain and place filters, address, refresh, invalid place, reset', async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL)
    await page.goto('/talents?quoc-gia=vn&tinh=da-nang', { waitUntil: 'networkidle' })
    // Every card shown is in Đà Nẵng (the demo founders that lived there are no
    // longer listed, so the list may be empty in the QA database).
    const places = await cards(page, 'talent')
      .locator('[class*="cardName"] p:last-child')
      .allInnerTexts()
    for (const p of places) expect(p).toBe('Đà Nẵng')
    await page.goto('/talents?quoc-gia=sg&tinh=da-nang', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="empty"]')).toContainText('Khu vực không có')
    await page.getByRole('button', { name: 'Xoá tất cả bộ lọc' }).click()
    await expect(page).toHaveURL(/\/talents$/)
    const rail = page.getByRole('complementary', { name: 'Bộ lọc' })
    // The first domain the listed people carry (the demo founders' "Giáo dục" left with them).
    const domains = rail.getByRole('group', { name: /LĨNH VỰC/i }).getByRole('checkbox')
    if (await domains.count()) {
      await domains.first().check()
      await expect(page).toHaveURL(/linh-vuc=/)
      const n = await cards(page, 'talent').count()
      await page.reload({ waitUntil: 'networkidle' })
      await expect(cards(page, 'talent')).toHaveCount(n)
    }
  })
})

// ------------------------------------------------------------------ nav

test.describe('navigation', () => {
  test('Chương trình → /programmes and Nhân tài → /talents, desktop, mobile and footer', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
    await expect(nav.locator('[data-nav="talents"] a')).toHaveAttribute('href', '/talents')
    await nav.getByRole('button', { name: 'Mở menu Chương trình' }).click()
    await expect(nav.getByRole('link', { name: 'Chương trình, cuộc thi' })).toHaveAttribute(
      'href',
      '/programmes',
    )
    await expect(nav.locator('[data-nav="programmes"] ul [data-cta-kind="INERT"]')).toHaveText(
      'Sự kiện',
    )
    await expect(nav.locator('[data-nav="news"] [data-nav-kind="LABEL"]')).toHaveCount(1)
    await nav.getByRole('link', { name: 'Chương trình, cuộc thi' }).click()
    await expect(page).toHaveURL('/programmes')
    await expect(nav.locator('[data-nav="programmes"] > span')).toHaveAttribute(
      'aria-current',
      'page',
    )
    const footer = page.locator('[data-shell="public-footer"]')
    await expect(footer.getByRole('link', { name: 'Chương trình' })).toHaveAttribute(
      'href',
      '/programmes',
    )
    await expect(footer.getByRole('link', { name: 'Nhân tài' })).toHaveAttribute('href', '/talents')
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/products', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Mở menu' }).click()
    await nav.locator('[data-nav="talents"] a').click()
    await expect(page).toHaveURL('/talents')
    await expect(page.locator('[data-state="gate"]')).toBeVisible()
  })
})

// ------------------------------------------------------------------ responsive

test.describe('responsive 1440 / 1280 / 1024 / 768 / 390', () => {
  for (const width of [1440, 1280, 1024, 768, 390]) {
    test(`${width}: four directories without overflow; search, rail and cards usable`, async ({
      page,
      baseURL,
    }) => {
      await signIn(page, baseURL)
      await page.setViewportSize({ width, height: 900 })
      for (const [url, kind] of [
        ['/programmes', 'programme'],
        ['/problems', 'problem'],
        ['/products', 'startup'],
        ['/talents', 'talent'],
      ] as const) {
        await page.goto(url, { waitUntil: 'networkidle' })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${url} overflow`,
        ).toBeLessThanOrEqual(width)
        const go = (await page.getByRole('button', { name: 'Tìm kiếm' }).boundingBox())!
        expect(go.x + go.width, `${url} search button`).toBeLessThanOrEqual(width)
        const card = (await cards(page, kind).first().boundingBox())!
        expect(card.x, `${url} card left`).toBeGreaterThanOrEqual(0)
        expect(card.x + card.width, `${url} card right`).toBeLessThanOrEqual(width)
        await expect(page.getByRole('complementary', { name: 'Bộ lọc' })).toBeVisible()
        await page.screenshot({
          path: path.join(ACTUAL, `thao-05-${url.slice(1)}-${width}.png`),
          fullPage: true,
        })
      }
      await page.context().clearCookies()
      await page.goto('/talents', { waitUntil: 'networkidle' })
      await page.screenshot({
        path: path.join(ACTUAL, `thao-05-talents-guest-${width}.png`),
        fullPage: true,
      })
    })
  }
})

// ------------------------------------------------------------------ pixel 1440

async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent!.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const r of range.getClientRects())
        rects.push({
          x: r.x - 2,
          y: r.y + window.scrollY - 2,
          width: r.width + 4,
          height: r.height + 4,
        })
    }
    for (const input of document.querySelectorAll('input')) {
      const r = input.getBoundingClientRect()
      rects.push({ x: r.x + 8, y: r.y + scrollY + 6, width: r.width - 16, height: r.height - 12 })
    }
    return rects
  })
}

const rectsOf = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }
    }),
  )

test.describe('pixel QA 1440 × DPR1: hero gated, results reported (canonical data)', () => {
  for (const [id, url, reference, member] of [
    [
      'THAO-05.DM06',
      '/programmes',
      'design-reference/final/demo-0710/DM06__programme-directory__SOURCE.png',
      false,
    ],
    [
      'THAO-05.DM09',
      '/talents',
      'design-reference/final/demo-0710/DM09__talent-directory__SOURCE.png',
      true,
    ],
  ] as const) {
    test(`${id} ${url}`, async ({ page, baseURL }) => {
      if (member) await signIn(page, baseURL)
      await page.goto(url, { waitUntil: 'networkidle' })
      await settle(page)
      const full = decodePng(await page.screenshot({ fullPage: true }))
      await page.screenshot({ path: path.join(ACTUAL, `${id}-1440.png`), fullPage: true })
      // Live counts (INTENTIONAL-DATA); the nav row (DEC-THAO-NAV-D1: the frames
      // draw "Giới thiệu ▾"); the signed-in header's account cluster (the frames
      // draw a guest).
      const exclude = [
        ...(await rectsOf(page, '[data-pixel="data"]')),
        ...(await rectsOf(page, 'header[data-shell="public"] nav[aria-label="Điều hướng chính"]')),
        ...(member ? [{ x: 1000, y: 0, width: 440, height: 64 }] : []),
      ]
      const results = compareSegments(
        readPng(resolveReferencePath(reference)),
        full,
        [
          { name: '01-header-hero', reference: { x: 0, y: 0, width: 1440, height: 810 }, dy: 0 },
          { name: '02-results', reference: { x: 0, y: 810, width: 1440, height: 560 }, dy: 0 },
        ],
        [...(await textRects(page)), ...exclude],
        {
          diffPath: resolveOutputPath('diff', `${id}.segments.diff.png`),
          shiftTolerance: 2,
          exclude,
        },
      )
      writeJsonReport(`${id}.pixel.json`, {
        screen_id: id,
        reference,
        viewport: '1440x900',
        dpr: 1,
        thresholds: { outside_ratio: 0.015, beyond_shift_ratio: 0.02 },
        gated: ['01-header-hero'],
        segments: results,
      })
      const hero = results.find((r) => r.name === '01-header-hero')!
      expect.soft(hero.outside_ratio, `${id} hero outside-text`).toBeLessThan(0.015)
      expect.soft(hero.beyond_shift_ratio!, `${id} hero beyond ±2px`).toBeLessThan(0.02)
    })
  }
})
