import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { REPO_ROOT } from '../pixel-qa/paths'
import { auditRevision } from '../pixel-qa/revision'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — the public Library (/library), L15 DIR1
 * (DEC-L15-D1..D7). "Bài toán" runs on the supplied problem dataset (LIBRARY
 * DATA UPDATE); "Startup" and "Nhà sáng lập" show startup.json as read by the
 * server; no tab names a data source. The homepage "Mạng lưới đổi mới sáng
 * tạo" opens it. Pixel QA compares the full 1440 × 2470 reference (A header …
 * L load more).
 */

type Problem = {
  ten: string
  ten_ngan: string
  mo_ta_ngan: string
  owner_org: { ten: string }
  giai_doan: string
  giai_thuong: unknown
  giai_thuong_hien_thi: string
  tags: { linh_vuc: string[]; dia_ban: string[] }
}
/** Expectations derive from the shipped dataset, never from fixed numbers. */
const PROBLEMS: Problem[] = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'src/lib/library/dir-bai-toan.json'), 'utf8'),
).problems
const withDomain = (d: string) => PROBLEMS.filter((p) => p.tags.linh_vuc.includes(d)).length
const fold = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
/** Public wording that names where Library data comes from ("nguồn" alone is ordinary content). */
const SOURCE_WORDS =
  /dữ liệu minh hoạ|startup\.1hub|nguồn dữ liệu|nguồn:|source data|demo fixture/iu

const REFERENCE = 'design-reference/final/revision/L2/L15__library__SOURCE.png'
/** Reference anchors measured once on the 1440 × 2470 frame. */
const REF = { tabs: 810, body: 873, row3: 1866, moreTop: 2340, moreLeft: 760, pageEnd: 2470 }
const CONTACT = /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+84|0)\d{9,10}/

let consoleErrors: string[] = []
let apiCalls: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  apiCalls = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url())
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

const cards = (page: Page) => page.locator('[data-anchor="grid"] > li')
const count = (page: Page) => page.locator('[data-section="directory"] [aria-live="polite"]')
const tabCount = async (page: Page, name: RegExp) =>
  Number(await page.getByRole('tab', { name }).locator('span').innerText())
/** Top edge in page coordinates (boundingBox is viewport-relative once the page scrolls). */
const top = async (page: Page, selector: string) =>
  Math.round(
    (await page.locator(selector).first().boundingBox())!.y +
      (await page.evaluate(() => window.scrollY)),
  )
/**
 * Data-driven text left out of the pixel audit: the facet values with their
 * counts. Checkboxes, group titles and the toolbar stay compared.
 */
const dataAreas = (page: Page) =>
  page.locator('[data-anchor="facets"] label > span').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x - 2, y: r.y + scrollY - 2, width: r.width + 4, height: r.height + 4 }
    }),
  )

test.describe('PUBLIC-LIBRARY functional', () => {
  test('guests reach /library directly, on refresh and from the homepage', async ({ page }) => {
    const res = await page.goto('/library')
    expect(res!.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /Bài toán đang mở, những đội đang giải,\s*và những người đứng sau\./,
    )
    await page.reload()
    await expect(page).toHaveURL(/\/library$/)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Trang chủ' })
    await expect(nav.getByRole('link', { name: 'Về HUB Network' })).toHaveAttribute(
      'href',
      '/about',
    )
    await nav.getByRole('link', { name: 'Mạng lưới đổi mới sáng tạo' }).click()
    await expect(page).toHaveURL(/\/library$/)
    expect(apiCalls, 'the Library reads no API of ours').toEqual([])
  })

  test('header: Thư viện is current, the items without a destination are plain labels', async ({
    page,
  }) => {
    await page.goto('/library')
    const nav = page.getByRole('navigation', { name: 'Thư viện' })
    await expect(nav.getByRole('link', { name: 'Thư viện' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // PO decision (Alpha interaction gap fix): not a link, not a disabled control, no tooltip.
    await expect(nav.getByRole('link')).toHaveCount(1)
    for (const label of ['Chương trình', 'Sự kiện', 'Tin tức']) {
      const item = nav.getByText(label, { exact: true })
      await expect(item).toHaveAttribute('data-nav-kind', 'LABEL')
      await expect(item).not.toHaveAttribute('aria-disabled')
      await expect(item).not.toHaveAttribute('title')
    }
    await expect(page.locator('[data-cta="login"]')).toHaveAttribute('href', '/auth')
  })

  test('Bài toán: every dataset record, no dead CTA, derived counts, no invented values', async ({
    page,
  }) => {
    const total = PROBLEMS.length
    await page.goto('/library')
    await expect(cards(page)).toHaveCount(Math.min(9, total))
    await expect(count(page)).toHaveText(`${total} bài toán`)
    expect(await tabCount(page, /Bài toán/)).toBe(total)
    const metrics = page.locator('[data-anchor="metrics"] dd')
    await expect(metrics.first()).toHaveText(
      String(PROBLEMS.filter((p) => p.giai_doan === 'dang_mo_nop').length),
    )
    const startups = await tabCount(page, /Startup/)
    const founders = await tabCount(page, /Nhà sáng lập/)
    expect(startups).toBeGreaterThan(0)
    expect(founders).toBeGreaterThan(0)
    await expect(metrics.nth(1)).toHaveText(String(startups))
    await expect(metrics.nth(2)).toHaveText(String(founders))
    // PO decision (Alpha interaction gap fix): a problem has no page, so its card draws no action.
    await expect(cards(page).locator('a, button, [aria-disabled]')).toHaveCount(0)
    // Every record is reachable through "Xem thêm", in the dataset order.
    while (await page.locator('[data-anchor="more"]').isVisible())
      await page.locator('[data-anchor="more"]').click()
    await expect(cards(page).locator('h2')).toHaveText(PROBLEMS.map((p) => p.ten))
    await expect(cards(page).first().locator('[class*="org"]').last()).toHaveText(
      PROBLEMS[0]!.owner_org.ten,
    )
    // No prize, team or deadline is invented: only supplied prizes show.
    const prizes = PROBLEMS.filter(
      (p) => p.giai_thuong !== null && !/^[\s—–-]*$/.test(p.giai_thuong_hien_thi),
    )
    await expect(page.locator('[data-anchor="grid"] [class*="prize"]')).toHaveCount(prizes.length)
    const grid = await page.locator('[data-anchor="grid"]').innerText()
    expect(grid).not.toMatch(/Còn \d+ ngày|\d+ đội|triệu/)
  })

  test('no tab names a data source', async ({ page }) => {
    await page.goto('/library')
    for (const name of [/^Bài toán/, /^Startup/, /^Nhà sáng lập/]) {
      await page.getByRole('tab', { name }).click()
      await expect(cards(page).first()).toBeVisible()
      expect(await page.locator('body').innerText(), `${name}`).not.toMatch(SOURCE_WORDS)
    }
  })

  test('Startup: real startup.json records, paging, safe external links', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('tab', { name: /Startup/ }).click()
    const total = await tabCount(page, /Startup/)
    await expect(cards(page)).toHaveCount(Math.min(9, total))
    await expect(count(page)).toHaveText(`${total} startup`)
    if (total > 9) {
      await page.getByRole('button', { name: `Xem thêm ${total - 9} startup` }).click()
      await expect(cards(page)).toHaveCount(Math.min(18, total))
    }
    for (const a of await page.locator('[data-anchor="grid"] a[target="_blank"]').all()) {
      expect(await a.getAttribute('href')).toMatch(/^https?:\/\/[^/@]+\./)
      await expect(a).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    }
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await expect(facets.getByText('ĐỊA BÀN')).toHaveCount(0)
    await facets.getByRole('checkbox', { name: /^MVP/ }).check()
    await expect(cards(page).first().locator('[class*="pcardStage"]')).toHaveText('MVP')
    // DEC-L15-D11: the white card. PO decision (Alpha interaction gap fix): "Xem hồ sơ" is
    // drawn only as the startup's own website; "Theo dõi" is never drawn (no follow exists).
    const first = cards(page).first()
    await expect(first).toHaveAttribute('data-kind', 'STARTUP')
    await expect(first.locator('[class*="pcardSub"]')).toHaveText(/^\d+ thành viên$/)
    await expect(cards(page).getByText('Theo dõi', { exact: true })).toHaveCount(0)
    await expect(cards(page).locator('[aria-disabled]')).toHaveCount(0)
    for (const view of await cards(page).getByText('Xem hồ sơ', { exact: true }).all()) {
      expect(await view.evaluate((n) => n.tagName)).toBe('A')
      await expect(view).toHaveAttribute('target', '_blank')
    }
    // Nothing the source lacks is drawn: no verified mark, city, needs or programmes.
    const text = await page.locator('[data-section="directory"]').innerText()
    expect(text).not.toMatch(CONTACT)
    expect(text).not.toMatch(/ĐANG CẦN|Đang cần|xác minh|do hệ thống ghi nhận/)
    await expect(facets.getByText(/ĐANG CẦN|NGUỒN HỒ SƠ/)).toHaveCount(0)
  })

  test('Nhà sáng lập: deduplicated founders from startup.json, no contact data', async ({
    page,
  }) => {
    await page.goto('/library')
    await page.getByRole('tab', { name: /Nhà sáng lập/ }).click()
    const total = await tabCount(page, /Nhà sáng lập/)
    await expect(count(page)).toHaveText(`${total} nhà sáng lập`)
    await expect(cards(page)).toHaveCount(Math.min(9, total))
    const names = await cards(page).locator('h2').allInnerTexts()
    expect(new Set(names).size).toBe(names.length)
    // DEC-L15-D12: name, "role · startup", the startup row. PO decision (Alpha interaction gap
    // fix): a founder has no profile page or connection, so no "Xem hồ sơ" / "Kết nối"; the
    // startup row links its website or is plain text.
    const first = cards(page).first()
    await expect(first).toHaveAttribute('data-kind', 'FOUNDER')
    await expect(first.locator('[class*="pcardSub"]')).toHaveText(/ · /)
    await expect(first.locator('[class*="pcardRowName"]')).not.toBeEmpty()
    await expect(cards(page).getByText(/^(Xem hồ sơ|Kết nối)$/)).toHaveCount(0)
    await expect(cards(page).locator('[aria-disabled]')).toHaveCount(0)
    for (const row of await cards(page)
      .locator('[class*="pcardRow"]:not([class*="pcardRow"] *)')
      .all()) {
      const tag = await row.evaluate((n) => n.tagName)
      expect(['A', 'SPAN']).toContain(tag)
      if (tag === 'A') await expect(row).toHaveAttribute('target', '_blank')
    }
    const text = await page.locator('[data-section="directory"]').innerText()
    expect(text).not.toMatch(CONTACT)
    expect(text).not.toMatch(/ĐANG MỞ CHO|Đang mở cho|Đề nghị kết nối/)
  })

  test('filters: built from the dataset, multi-select, chips, zero kept, clear all', async ({
    page,
  }) => {
    await page.goto('/library')
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    const group = (title: string) => facets.locator('fieldset', { hasText: title })
    // Every domain and area value, with its count, comes from the records.
    const facetCounts = async (title: string) =>
      Object.fromEntries(
        await group(title)
          .locator('label')
          .evaluateAll((ls) =>
            ls.map((l) => [
              l.querySelector('[class*="facetLabel"]')!.textContent,
              Number(l.querySelector('[class*="facetCount"]')!.textContent),
            ]),
          ),
      )
    const tally = (pick: (p: Problem) => string[]) =>
      PROBLEMS.flatMap(pick).reduce<Record<string, number>>(
        (m, v) => ({ ...m, [v]: (m[v] ?? 0) + 1 }),
        {},
      )
    expect(await facetCounts('LĨNH VỰC')).toEqual(tally((p) => p.tags.linh_vuc))
    expect(await facetCounts('ĐỊA BÀN')).toEqual(tally((p) => p.tags.dia_ban))
    const stages = await facetCounts('GIAI ĐOẠN')
    expect(Object.keys(stages)).toEqual(['Đang mở nộp', 'Sắp diễn ra', 'Đang chấm', 'Đã công bố'])
    const byStage = (code: string) => PROBLEMS.filter((p) => p.giai_doan === code).length
    expect(Object.values(stages)).toEqual(
      ['dang_mo_nop', 'sap_dien_ra', 'dang_cham', 'cong_bo'].map(byStage),
    )

    const logistics = withDomain('Logistics')
    await facets.getByRole('checkbox', { name: /^Logistics/ }).check()
    await expect(count(page)).toHaveText(`${logistics} bài toán`)
    await facets.getByRole('checkbox', { name: /^Giao thông/ }).check()
    await expect(count(page)).toHaveText(
      `${PROBLEMS.filter((p) => p.tags.linh_vuc.some((d) => ['Logistics', 'Giao thông'].includes(d))).length} bài toán`,
    )
    await expect(page.getByRole('button', { name: 'Bỏ lọc Logistics' })).toBeVisible()
    await page.getByRole('button', { name: 'Bỏ lọc Giao thông' }).click()
    await expect(count(page)).toHaveText(`${logistics} bài toán`)
    const empty = Object.entries(stages).find(([, n]) => n === 0)
    if (empty) {
      await expect(group('GIAI ĐOẠN').locator('label', { hasText: empty[0] })).toHaveAttribute(
        'data-empty',
        'true',
      )
      await facets.getByRole('checkbox', { name: new RegExp(`^${empty[0]}`) }).check()
      await expect(page.getByText('Không có bài toán nào khớp bộ lọc.')).toBeVisible()
    }
    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    await expect(count(page)).toHaveText(`${PROBLEMS.length} bài toán`)
  })

  test('search, quick filters and sort run in the browser', async ({ page }) => {
    await page.goto('/library')
    const quick = page.getByRole('group', { name: 'Tìm nhanh theo lĩnh vực' })
    await quick.getByRole('button', { name: 'Nông nghiệp' }).click()
    await expect(quick.getByRole('button', { name: 'Nông nghiệp' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(count(page)).toHaveText(`${withDomain('Nông nghiệp')} bài toán`)
    await quick.getByRole('button', { name: 'Nông nghiệp' }).click()
    // Search runs accent-free over title, short title, summary, organisation and domains.
    const search = page.getByRole('search')
    const found = (q: string) =>
      PROBLEMS.filter((p) =>
        fold(q)
          .split(/\s+/)
          .every((w) =>
            fold(
              [p.ten, p.ten_ngan, p.mo_ta_ngan, p.owner_org.ten, ...p.tags.linh_vuc].join(' '),
            ).includes(w),
          ),
      )
    for (const q of ['un tac giao thong', 'mobifone', 'du lieu ai']) {
      await search.getByRole('searchbox').fill(q)
      await search.getByRole('button', { name: 'Tìm kiếm' }).click()
      const expected = found(q)
      expect(expected.length, q).toBeGreaterThan(0)
      await expect(count(page)).toHaveText(`${expected.length} bài toán`)
      await expect(cards(page).first().locator('h2')).toHaveText(expected[0]!.ten)
    }
    await search.getByRole('searchbox').fill('')
    // No prize in the data: "Giải thưởng cao nhất" keeps the dataset order.
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('PRIZE')
    await expect(cards(page).first().locator('h2')).toHaveText(PROBLEMS[0]!.ten)
    await page.getByRole('combobox', { name: 'Tìm trong' }).selectOption('STARTUP')
    await expect(page.getByRole('tab', { name: /Startup/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(apiCalls).toEqual([])
  })

  test('390 px: filters fold behind a button, no page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/library')
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await expect(facets).toBeHidden()
    await page.getByRole('button', { name: /^Bộ lọc/ }).click()
    await expect(facets).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })

  test('"Góp ý" is hidden for Alpha (PO decision; no feedback channel)', async ({ page }) => {
    await page.goto('/library')
    await expect(page.locator('[data-anchor="feedback"]')).toHaveCount(0)
    await expect(page.getByText('Góp ý')).toHaveCount(0)
  })
})

test.describe('PUBLIC-LIBRARY layout: filters and results', () => {
  /** L15 and the 29/09 Startup / Nhà sáng lập frames at 1440: 64 · 249 · 45 · 1018 · 64. */
  const box = async (page: Page, selector: string) => {
    const b = (await page.locator(selector).first().boundingBox())!
    return { left: Math.round(b.x), right: Math.round(b.x + b.width), width: Math.round(b.width) }
  }

  test('the gutter stays 45px at 1440 and wider; three equal columns; sort on the results edge', async ({
    page,
  }) => {
    for (const width of [1440, 1728, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/library', { waitUntil: 'networkidle' })
      for (const name of [/^Bài toán/, /^Startup/, /^Nhà sáng lập/]) {
        await page.getByRole('tab', { name }).click()
        await expect(cards(page).first()).toBeVisible()
        const facets = await box(page, '[data-anchor="facets"]')
        const grid = await box(page, '[data-anchor="grid"]')
        const sort = await box(page, 'label:has-text("Sắp xếp:")')
        const columns = await cards(page).evaluateAll((els) =>
          els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().width)),
        )
        const where = `${width} ${name}`
        expect(facets, where).toMatchObject({ left: 64, width: 249 })
        expect(grid.left - facets.right, `${where} gutter`).toBe(45)
        expect(grid.right, `${where} right edge`).toBe(width - 64)
        expect(sort.right, `${where} sort`).toBe(grid.right)
        expect(new Set(columns).size, `${where} equal columns`).toBe(1)
        expect(columns[0], `${where} column`).toBe(Math.round((width - 128 - 249 - 45 - 46) / 3))
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      }
    }
    // At 1440 the columns are the frames' own: 358, 705, 1052, each 324 wide.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/library', { waitUntil: 'networkidle' })
    expect(
      await cards(page).evaluateAll((els) =>
        els.slice(0, 3).map((e) => {
          const b = e.getBoundingClientRect()
          return [Math.round(b.x), Math.round(b.width)]
        }),
      ),
    ).toEqual([
      [358, 324],
      [705, 324],
      [1052, 324],
    ])
  })

  test('below 1440 the narrower layouts are unchanged and nothing overflows', async ({ page }) => {
    for (const [width, facetsWidth, firstCard] of [
      [1280, 220, 320],
      [1024, 220, 320],
      [768, 0, 20],
      [390, 0, 20],
    ] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/library', { waitUntil: 'networkidle' })
      await expect(cards(page).first()).toBeVisible()
      const first = await box(page, '[data-anchor="grid"] > li')
      expect(first.left, `${width} first card`).toBe(firstCard)
      if (facetsWidth) expect((await box(page, '[data-anchor="facets"]')).width).toBe(facetsWidth)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    }
  })
})

test.describe('PUBLIC-LIBRARY pixel QA (L15, 1440 DPR1, full reference)', () => {
  test('A–F: header, hero, heading, search, metrics, tab bar', async ({ page }) => {
    await page.goto('/library')
    // B: the hero ends where the reference's tab bar starts.
    expect(await top(page, '[data-anchor="tabs"]')).toBe(REF.tabs)
    const numbers = await page.locator('[data-anchor="metrics"] > div').evaluateAll((cols) =>
      cols.map((c) => {
        const r = c.getBoundingClientRect()
        return {
          x: Math.round(r.x) - 30,
          y: Math.round(r.y) - 4,
          width: Math.round(r.width) + 60,
          height: 48,
        }
      }),
    )
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-hero',
      reference: REFERENCE,
      segments: [
        { name: 'A-header', reference: { x: 0, y: 0, width: 1440, height: 101 }, dy: 0 },
        { name: 'C-heading', reference: { x: 200, y: 205, width: 1040, height: 205 }, dy: 0 },
        { name: 'D-search', reference: { x: 250, y: 420, width: 940, height: 105 }, dy: 0 },
        { name: 'D-quick', reference: { x: 440, y: 532, width: 560, height: 48 }, dy: 0 },
        { name: 'B-hero-glow', reference: { x: 0, y: 580, width: 1440, height: 110 }, dy: 0 },
        { name: 'E-metrics', reference: { x: 420, y: 700, width: 600, height: 90 }, dy: 0 },
        { name: 'F-tabs', reference: { x: 0, y: 810, width: 1289, height: 63 }, dy: 0 },
      ],
      exclude: numbers,
      intentional: [
        {
          class: 'content',
          reason:
            "Metric and tab counts are the data (4 open demo problems; startups and founders from startup.json), not the pack's 28 / 142 / 310; the digits are excluded, the columns, dividers and labels are compared",
        },
      ],
    })
  })

  test('G–K: sidebar, toolbar, grid and cards (Bài toán, filtered as drawn)', async ({ page }) => {
    await page.goto('/library')
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    // The pack draws three cards; Logistics gives three in the dataset too.
    await facets.getByRole('checkbox', { name: /^Logistics/ }).check()
    await expect(cards(page)).toHaveCount(Math.min(3, withDomain('Logistics')))
    const body = await top(page, '[data-section="directory"]')
    expect(body).toBe(REF.body)
    const grid = (await cards(page).first().boundingBox())!
    const second = (await cards(page).nth(1).boundingBox())!
    // H–J: grid start, card size, gutter.
    expect([Math.round(grid.x), Math.round(grid.width), Math.round(grid.height)]).toEqual([
      358, 324, 431,
    ])
    expect(Math.round(second.x - grid.x - grid.width)).toBe(23)
    const intentional = [
      {
        class: 'content',
        reason:
          'Problem dataset (LIBRARY DATA UPDATE): facet values and counts are the data, not the pack’s; the drawn state is three Logistics cards. Card surfaces (colour band per record, text, chips) are data too, so card rows are checked by geometry instead of pixels',
      },
    ]
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-directory-filtered',
      reference: REFERENCE,
      full: true,
      segments: [
        { name: 'G-facets', reference: { x: 56, y: 893, width: 270, height: 560 }, dy: 0 },
        { name: 'K-toolbar', reference: { x: 350, y: 897, width: 1040, height: 44 }, dy: 0 },
      ],
      exclude: await dataAreas(page),
      intentional,
    })
    // I: three rows as drawn — same columns and card size, 23 px gaps, row 3 where the pack has it.
    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    const boxes = await cards(page).evaluateAll((els) =>
      els.slice(0, 9).map((e) => {
        const b = e.getBoundingClientRect()
        return { x: Math.round(b.x), y: Math.round(b.y + scrollY), size: `${b.width}x${b.height}` }
      }),
    )
    expect(boxes.map((b) => b.x)).toEqual([358, 705, 1052, 358, 705, 1052, 358, 705, 1052])
    expect(new Set(boxes.map((b) => b.size))).toEqual(new Set(['324x431']))
    expect(boxes[3]!.y - boxes[0]!.y).toBe(431 + 23)
    expect(boxes[6]!.y).toBe(REF.row3)
  })

  // L15 draws the Bài toán tab; Startup and Nhà sáng lập have their own frames (L15b, L15c).
  test('L: load more and page end (Bài toán tab, three rows as drawn)', async ({ page }) => {
    await page.goto('/library')
    test.skip((await tabCount(page, /Bài toán/)) <= 9, 'needs more than one page of problems')
    const more = page.locator('[data-anchor="more"]')
    const box = (await more.boundingBox())!
    const y = Math.round(box.y + (await page.evaluate(() => window.scrollY)))
    expect(Math.abs(y - REF.moreTop), 'load-more top').toBeLessThanOrEqual(2)
    expect(
      Math.abs(Math.round(box.x + box.width / 2) - 867),
      'load-more centre',
    ).toBeLessThanOrEqual(2)
    const end = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(Math.abs(end - REF.pageEnd), 'page end').toBeLessThanOrEqual(2)
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-load-more',
      reference: REFERENCE,
      full: true,
      segments: [
        { name: 'L-below-grid', reference: { x: 350, y: 2300, width: 1036, height: 170 }, dy: 0 },
      ],
      // The label is the data ("Xem thêm N bài toán"); the pill's width follows it.
      exclude: [
        { x: Math.round(box.x) - 4, y: y - 4, width: Math.round(box.width) + 8, height: 58 },
      ],
      intentional: [
        { class: 'content', reason: 'Load-more label and width follow the real count' },
      ],
    })
  })

  /**
   * TASK 24.1 — Startup (L15b) and Nhà sáng lập (L15c), DEC-L15-D10…D13. The records'
   * text, marks, stages and chip values are data, and the sections the source lacks
   * (verified mark, city, needs, programmes, badges, expertise, openness, the note above
   * the grid) are not drawn, so card rows are checked by geometry. PO decision (Alpha
   * interaction gap fix 30/09): the card actions without a destination ("Theo dõi",
   * "Kết nối", a "Xem hồ sơ" without a website) are not drawn, so the action row of the
   * frames is no longer compared; a drawn "Xem hồ sơ" keeps the frame's 44 px height.
   */
  for (const [tab, file, kind] of [
    ['Startup', 'L2/L15b__library-startup__SOURCE.png', 'STARTUP'],
    ['Nhà sáng lập', 'L2/L15c__library-founder__SOURCE.png', 'FOUNDER'],
  ] as const) {
    test(`${kind}: hero, tab bar, card geometry and chrome match ${file.split('/')[1]}`, async ({
      page,
    }) => {
      await page.goto('/library')
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await expect(cards(page).first()).toHaveAttribute('data-kind', kind)
      const boxes = await cards(page).evaluateAll((els) =>
        els.slice(0, 3).map((e) => {
          const b = e.getBoundingClientRect()
          const cs = getComputedStyle(e)
          return [Math.round(b.x), Math.round(b.width), cs.borderTopLeftRadius, cs.borderTopColor]
        }),
      )
      expect(boxes).toEqual([358, 705, 1052].map((x) => [x, 324, '18px', 'rgb(227, 221, 221)']))
      const primaries = cards(page).locator('[class*="pcardPrimary"]')
      if (kind === 'FOUNDER') await expect(primaries).toHaveCount(0)
      for (const primary of await primaries.all()) {
        expect(await primary.evaluate((n) => n.tagName)).toBe('A')
        expect(Math.round((await primary.boundingBox())!.height)).toBe(44)
      }
      const scroll = await page.evaluate(() => window.scrollY)
      // The founder placeholder keeps its text: the frame's promises expertise search (no data).
      const query = (await page.getByRole('searchbox').boundingBox())!
      const placeholder =
        kind === 'FOUNDER'
          ? [{ x: query.x, y: query.y + scroll, width: query.width, height: query.height }]
          : []
      await auditRevision(page, {
        name: `PUBLIC-LIBRARY.${file.split('__')[0]!.split('/')[1]}-${kind.toLowerCase()}`,
        reference: `design-reference/final/revision/${file}`,
        full: true,
        segments: [
          { name: 'D-search', reference: { x: 250, y: 420, width: 940, height: 105 }, dy: 0 },
        ],
        exclude: placeholder,
        intentional: [
          {
            class: 'content',
            reason:
              'Record text, marks, stages, chips and counts are data; sections without source data are not drawn (DEC-L15-D11…D13), so the grid starts 37 px higher than the frame, where its note is omitted',
          },
          {
            class: 'design-inconsistency',
            reason:
              'The tab bar keeps the L15 style (checked in A–F): L15b / L15c draw the active tab regular with a coral count and leave the inactive "Bài toán" bold, a copy of L15',
          },
          {
            class: 'INTENTIONAL-SCOPE',
            reason:
              'PO decision (Alpha interaction gap fix 30/09): "Theo dõi", "Kết nối" and a "Xem hồ sơ" without a website are not drawn; "Góp ý" is hidden for Alpha',
          },
        ],
      })
    })
  }
})
