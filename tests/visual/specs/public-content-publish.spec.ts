import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { clearLibraryFixture, seedLibraryFixture } from '../../../src/lib/library/testing'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * PUBLIC-CONTENT-PUBLISH-01 — the refreshed workbook on the public pages:
 * homepage programme cards, ticker and news pictures (sheet "Ảnh homepage"),
 * the homepage product blocks drawing public logos and the sheet's
 * "Startup sẵn sàng gặp nhà đầu tư" list after the demo pitch, and the About
 * milestone / portraits supplied by the refreshed folders. Nothing is drawn
 * that the source leaves empty.
 */

const MEDIA = path.join(REPO_ROOT, '.data/media')
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const LOGO = 'asset_' + 'd7'.repeat(16)
const FEATURED = 'drippy'

let consoleErrors: string[] = []
let featuredId = ''

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
  // The demo data (Tracely, its investor pitch) and the WF06 Library fixture.
  await query(`DELETE FROM profile_visibility_settings WHERE profile_id::text LIKE 'de710000-%'`)
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
  const fx = await seedLibraryFixture()
  featuredId = fx.ventures['WF06 An Khang']!
  // A published startup with a slug of the refreshed featured list and a logo.
  await query(`UPDATE projects SET slug = $2, logo_asset_id = $3 WHERE id = $1`, [
    fx.ventures['WF06 An Khang'],
    FEATURED,
    LOGO,
  ])
  mkdirSync(MEDIA, { recursive: true })
  writeFileSync(path.join(MEDIA, LOGO), PNG)
  writeFileSync(
    path.join(MEDIA, `${LOGO}.json`),
    JSON.stringify({
      owner_account_id: fx.accounts.lan,
      content_type: 'image/png',
      byte_size: PNG.byteLength,
      created_at: '2026-10-07T00:00:00.000Z',
    }),
  )
})

test.afterAll(async () => {
  // Renamed out of the fixture's slug prefix: removed by id first.
  await query(`DELETE FROM projects WHERE id = $1`, [featuredId])
  await clearLibraryFixture()
  await clearDemo()
  for (const f of [LOGO, `${LOGO}.json`]) rmSync(path.join(MEDIA, f), { force: true })
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

/** A picture in view has loaded (lazy pictures are polled). */
const loaded = async (img: import('@playwright/test').Locator) => {
  await img.scrollIntoViewIfNeeded()
  await expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
    .toBe(true)
  return true
}

test('programme cards and ticker: the four refreshed programmes, source fields only', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  // S2-HOME-INNOVATION-PROGRAMMES-01: the canonical records (UPCOMING_PROGRAMMES).
  const titles = [
    'APEC Innovation Challenge',
    'Data for Life',
    'Fintech Challenge Vietnam',
    'AI Thực chiến',
  ]
  const cards = page.locator('[data-section="programmes"] li[data-programme]')
  await expect(cards.locator('h3')).toHaveText(titles)
  const covers = [
    'programme-apec-innovation-challenge.webp',
    'data-for-life.webp',
    'fintech-challenge-vietnam.webp',
    'ai-thuc-chien.webp',
  ]
  for (let i = 0; i < 4; i++) {
    const card = cards.nth(i)
    // A type chip only where the source tags one (APEC: "Cuộc thi").
    await expect(card.locator('[class*="whiteChip"]')).toHaveCount(i === 0 ? 1 : 0)
    await expect(card).toContainText('Sắp công bố')
    expect(decodeURIComponent((await card.locator('img').getAttribute('src'))!)).toContain(
      covers[i],
    )
    // Only "Chủ quản" is in the source: no period, prize or scale is drawn.
    await expect(card.locator('dt')).toHaveText(['CHỦ QUẢN'])
    const cover = card.locator('img')
    await cover.scrollIntoViewIfNeeded()
    expect(await loaded(cover), titles[i]).toBe(true)
  }
  // APEC opens the PO's site in a new tab; the other cards are text.
  const apec = cards.nth(0).locator('h3 a')
  await expect(apec).toHaveAttribute('href', 'https://apec.1hub.cloud/')
  await expect(apec).toHaveAttribute('target', '_blank')
  await expect(apec).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('[data-section="programmes"] ul a')).toHaveCount(1)
  // No phase is claimed for the cards.
  await expect(page.locator('[data-section="programmes"] [aria-disabled="true"]')).toHaveCount(3)
  // S2-HOME-CONTENT-REFRESH-01: the ticker's own list (the cards are unchanged).
  for (const t of [
    'APEC Innovation Challenge',
    'Data for Life',
    'Fintech Challenge Vietnam',
    'Agritech Innovation Challenge',
  ])
    await expect(page.locator('[data-section="ticker"] p').first()).toContainText(t)
  for (const old of ['MBBank', 'VPBank Innovation Challenge', 'Cuộc thi Khởi nghiệp cùng Kawai'])
    await expect(page.locator('[data-section="ticker"]')).not.toContainText(old)
  // The weekly updates: exactly the PO's three lines, nothing invented.
  const updates = page.locator('[data-block="programme-updates"] li')
  await expect(updates.locator('p')).toHaveText([
    'Họp chiến lược lãnh đạo cấp cao xem xét triển khai APEC Innovation Challenge',
    'Data for Life Mùa 4 công bố Top 60 vào Vòng Phát triển giải pháp',
    'Ra mắt VietChallenge Capital',
  ])
  await expect(updates.locator('a, [class*="tag"]')).toHaveCount(0)
})

test('news keep their text and gain the refreshed pictures', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const news = page.locator('[data-section="news"] li')
  await expect(news.locator('h3')).toHaveText([
    '6 đội ký hợp đồng thử nghiệm với doanh nghiệp ĐBSCL',
    'HUB Network mở rộng cộng đồng kết nối tới TP. Quảng Ninh',
    'iHUB Ventures công bố danh mục đầu tư vòng pre-seed đầu tiên',
  ])
  for (let i = 0; i < 3; i++) {
    const img = news.nth(i).locator('img')
    await img.scrollIntoViewIfNeeded()
    expect(await loaded(img)).toBe(true)
  }
})

test('product blocks: a featured startup follows the demo pitch, logos replace initials', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const investors = page.locator('[data-section="investors"]')
  const pitch = investors.locator('article').first()
  await expect(pitch.getByRole('heading', { level: 3 })).toHaveText('Tracely')
  await expect(pitch).toContainText('ĐANG GỌI VỐN')
  await investors.getByRole('button', { name: 'Startup tiếp theo' }).click()
  const next = investors.locator('article').first()
  await expect(next.getByRole('heading', { level: 3 })).toHaveText('WF06 An Khang')
  // Not recorded as fundraising: no chip, no invented figures.
  await expect(next).not.toContainText('ĐANG GỌI VỐN')
  await expect(next.locator('dl')).toHaveCount(0)
  await expect(next.locator('img[data-logo]')).toHaveAttribute('src', `/media/assets/${LOGO}`)
  // S2-PRODUCT-CATALOG-CLEANUP-01: no detail link for a product without an approved detail.
  await expect(next.getByRole('link', { name: /Xem sản phẩm/ })).toHaveCount(0)
  const tile = page
    .locator('[data-section="all-products"] li')
    .filter({ hasText: 'WF06 An Khang' })
    .locator('img[data-logo]')
  await tile.scrollIntoViewIfNeeded()
  expect(await loaded(tile)).toBe(true)
  // Tracely keeps its initials.
  await expect(
    page
      .locator('[data-section="all-products"] li')
      .filter({ hasText: 'Tracely' })
      .locator('img[data-logo]'),
  ).toHaveCount(0)
})

test('About: the 11 · 2025 milestone photo and two exact-name portraits', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: '11 · 2025' }).click()
  const milestone = page.locator('img[src*="milestone-2025-11"]')
  await milestone.scrollIntoViewIfNeeded()
  expect(await loaded(milestone)).toBe(true)
  const long = page.locator('img[src*="pham-thanh-long"]')
  await long.scrollIntoViewIfNeeded()
  expect(await loaded(long)).toBe(true)
  await page.getByRole('tab', { name: 'HUB Khu vực' }).click()
  const anh = page.locator('img[src*="le-mai-anh"]')
  await anh.scrollIntoViewIfNeeded()
  expect(await loaded(anh)).toBe(true)
})

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`${width}: homepage and About without overflow or broken images`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const url of ['/', '/about']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        url,
      ).toBeLessThanOrEqual(width)
      // Bring every lazy picture in, then check none is broken.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 60))
        }
      })
      await page.waitForLoadState('networkidle')
      const broken = await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      )
      expect(broken, url).toEqual([])
    }
  })
}
