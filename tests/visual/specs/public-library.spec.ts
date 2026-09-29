import { expect, test, type Page } from '@playwright/test'

import { auditRevision } from '../pixel-qa/revision'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — the public Library (/library), L15 DIR1
 * (DEC-L15-D1..D7). "Bài toán" runs on a labelled DEMO FIXTURE; "Startup" and
 * "Nhà sáng lập" show startup.json as read by the server. The homepage "Mạng
 * lưới đổi mới sáng tạo" opens it. Pixel QA compares the full 1440 × 2470
 * reference (A header … L load more).
 */

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
const hideFeedback = (page: Page) =>
  page.addStyleTag({ content: '[data-anchor="feedback"] { display: none !important; }' })

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

  test('header: Thư viện is current, other destinations are inert with a reason', async ({
    page,
  }) => {
    await page.goto('/library')
    const nav = page.getByRole('navigation', { name: 'Thư viện' })
    await expect(nav.getByRole('link', { name: 'Thư viện' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const label of ['Chương trình', 'Sự kiện', 'Tin tức']) {
      const item = nav.getByText(label, { exact: true })
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      await expect(item).toHaveAttribute('title', /chưa có trong phiên bản này/i)
    }
    await expect(page.locator('[data-cta="login"]')).toHaveAttribute('href', '/auth')
  })

  test('Bài toán: labelled demo fixture, inert CTAs, derived counts', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByText('Dữ liệu minh hoạ', { exact: true })).toBeVisible()
    await expect(cards(page)).toHaveCount(6)
    await expect(count(page)).toHaveText('6 bài toán')
    expect(await tabCount(page, /Bài toán/)).toBe(6)
    const metrics = page.locator('[data-anchor="metrics"] dd')
    await expect(metrics.first()).toHaveText('4')
    const startups = await tabCount(page, /Startup/)
    const founders = await tabCount(page, /Nhà sáng lập/)
    expect(startups).toBeGreaterThan(0)
    expect(founders).toBeGreaterThan(0)
    await expect(metrics.nth(1)).toHaveText(String(startups))
    await expect(metrics.nth(2)).toHaveText(String(founders))
    const cta = cards(page).first().getByText('Xem bài toán')
    await expect(cta).toHaveAttribute('aria-disabled', 'true')
    await expect(cards(page).locator('h2')).toHaveText([
      'Giảm hao hụt trong chặng giao cuối',
      'Dự báo nhu cầu kho theo mùa vụ',
      'Định tuyến xe tải liên tỉnh',
      'Truy xuất nguồn gốc nông sản',
      'Chấm điểm tín dụng hộ kinh doanh',
      'Quản lý hàng hoàn theo thời gian thực',
    ])
  })

  test('Startup: real startup.json records, paging, safe external links', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('tab', { name: /Startup/ }).click()
    const total = await tabCount(page, /Startup/)
    await expect(page.getByText('Nguồn: startup.1hub.cloud')).toBeVisible()
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
    await expect(cards(page).first().locator('[class*="stage"]')).toHaveText('MVP')
    expect(await page.locator('[data-section="directory"]').innerText()).not.toMatch(CONTACT)
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
    expect(await page.locator('[data-section="directory"]').innerText()).not.toMatch(CONTACT)
  })

  test('filters: multi-select, chips, zero kept, clear all, empty state', async ({ page }) => {
    await page.goto('/library')
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await facets.getByRole('checkbox', { name: /Logistics/ }).check()
    await expect(count(page)).toHaveText('4 bài toán')
    await facets.getByRole('checkbox', { name: /Đang mở nộp/ }).check()
    await expect(count(page)).toHaveText('3 bài toán')
    await expect(page.getByRole('button', { name: 'Bỏ lọc Logistics' })).toBeVisible()
    await expect(facets.locator('label', { hasText: 'Giáo dục' })).toHaveAttribute(
      'data-empty',
      'true',
    )
    await page.getByRole('button', { name: 'Bỏ lọc Đang mở nộp' }).click()
    await expect(count(page)).toHaveText('4 bài toán')
    await facets.getByRole('checkbox', { name: /Logistics/ }).uncheck()
    await facets.getByRole('checkbox', { name: /Y tế/ }).check()
    await expect(page.getByText('Không có bài toán nào khớp bộ lọc.')).toBeVisible()
    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    await expect(cards(page)).toHaveCount(6)
  })

  test('search, quick filters and sort run in the browser', async ({ page }) => {
    await page.goto('/library')
    const quick = page.getByRole('group', { name: 'Tìm nhanh theo lĩnh vực' })
    await quick.getByRole('button', { name: 'Nông nghiệp' }).click()
    await expect(quick.getByRole('button', { name: 'Nông nghiệp' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(cards(page)).toHaveCount(1)
    await quick.getByRole('button', { name: 'Nông nghiệp' }).click()
    const search = page.getByRole('search')
    await search.getByRole('searchbox').fill('tin dung')
    await search.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(cards(page).locator('h2')).toHaveText(['Chấm điểm tín dụng hộ kinh doanh'])
    await search.getByRole('searchbox').fill('')
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('PRIZE')
    await expect(cards(page).first().locator('h2')).toHaveText('Chấm điểm tín dụng hộ kinh doanh')
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

  test('the floating "Góp ý" is visible and inert', async ({ page }) => {
    await page.goto('/library')
    const fb = page.locator('[data-anchor="feedback"] [data-cta-kind="INERT"]')
    await expect(fb).toHaveText(/Góp ý/)
    await expect(fb).toHaveAttribute('aria-disabled', 'true')
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
    await hideFeedback(page)
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
    await hideFeedback(page)
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await facets.getByRole('checkbox', { name: /Logistics/ }).check()
    await facets.getByRole('checkbox', { name: /Đang mở nộp/ }).check()
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
          "Demo fixture (DEC-L15-D2): neutral sector labels instead of company names; facet counts are the fixture's; the drawn filter state gives 3 cards",
      },
    ]
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-directory-filtered',
      reference: REFERENCE,
      full: true,
      segments: [
        { name: 'G-facets', reference: { x: 56, y: 893, width: 270, height: 560 }, dy: 0 },
        { name: 'K-toolbar', reference: { x: 350, y: 897, width: 1040, height: 44 }, dy: 0 },
        { name: 'I-cards-row-1', reference: { x: 350, y: 951, width: 1036, height: 445 }, dy: 0 },
      ],
      // Facet counts are fixture data (the pack draws 12, 8, 5 …).
      exclude: [{ x: 290, y: 925, width: 30, height: 400 }],
      intentional,
    })
    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    const row2 = await top(page, '[data-anchor="grid"] > li:nth-child(4)')
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-directory-row-2',
      reference: REFERENCE,
      full: true,
      segments: [
        {
          name: 'I-cards-row-2-vs-3',
          reference: { x: 350, y: REF.row3 - 7, width: 1036, height: 445 },
          dy: row2 - REF.row3,
        },
      ],
      intentional,
    })
  })

  test('L: load more and page end (Startup tab, three rows as drawn)', async ({ page }) => {
    await page.goto('/library')
    await hideFeedback(page)
    await page.getByRole('tab', { name: /Startup/ }).click()
    test.skip((await tabCount(page, /Startup/)) <= 9, 'needs more than one page of startups')
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
      // The label is the data ("Xem thêm N startup"); the pill's width follows it.
      exclude: [
        { x: Math.round(box.x) - 4, y: y - 4, width: Math.round(box.width) + 8, height: 58 },
      ],
      intentional: [
        { class: 'content', reason: 'Load-more label and width follow the real count' },
      ],
    })
  })

  test('floating feedback matches the reference', async ({ page }) => {
    await page.goto('/library')
    const pill = (await page
      .locator('[data-anchor="feedback"] [data-cta-kind="INERT"]')
      .boundingBox())!
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-feedback',
      reference: REFERENCE,
      segments: [
        {
          name: 'pill',
          reference: { x: 1330, y: 835, width: 72, height: 35 },
          dx: Math.round(pill.x) - 1312,
          dy: Math.round(pill.y) - 830,
        },
      ],
    })
  })
})
