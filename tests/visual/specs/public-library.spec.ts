import { expect, test, type Page } from '@playwright/test'

import { auditRevision } from '../pixel-qa/revision'

/**
 * TASK 22-PREVIEW-LIBRARY — the public Library (/library), L15 DIR1 from the
 * L2-15 pack (DEC-L15-D1..D5). A static demo: the "Bài toán" directory runs on
 * a labelled fixture, Startup and Nhà sáng lập are "Sắp có", and nothing is
 * read from the API. The homepage "Mạng lưới đổi mới sáng tạo" opens it.
 */

const REF = {
  hero: 'design-reference/final/revision/L2/L15__library-hero__SOURCE.png',
  tabs: 'design-reference/final/revision/L2/L15__library-tabs__SOURCE.png',
  directory: 'design-reference/final/revision/L2/L15__library-directory__SOURCE.png',
  feedback: 'design-reference/final/revision/L2/L15__library-feedback__SOURCE.png',
}
/** "Thân" is exported without a background; the page draws it on the hero's ink. */
const INK: [number, number, number] = [22, 0, 2]

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

test.describe('PUBLIC-LIBRARY functional', () => {
  test('guests reach /library directly, on refresh and from the homepage', async ({ page }) => {
    const res = await page.goto('/library')
    expect(res!.status()).toBe(200)
    await expect(page).toHaveURL(/\/library$/)
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
    await expect(page.locator('[data-screen="PUBLIC-LIBRARY"]')).toBeVisible()
    expect(apiCalls, 'the Library reads no API').toEqual([])
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
    await expect(page.locator('[data-cta="login"]')).toHaveText('Đăng nhập')
    await expect(page.locator('[data-cta="login"]')).toHaveAttribute('href', '/auth')
  })

  test('directory: labelled demo data, derived counts, inert card CTAs', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByText('Dữ liệu minh hoạ', { exact: true })).toBeVisible()
    await expect(page.getByText('Số liệu minh hoạ từ dữ liệu demo')).toBeVisible()
    await expect(cards(page)).toHaveCount(6)
    await expect(count(page)).toHaveText('6 bài toán')
    const metrics = page.locator('[data-anchor="metrics"]')
    await expect(metrics.locator('dd').first()).toHaveText('4')
    await expect(metrics.locator('dd').nth(1)).toHaveText('Sắp có')
    await expect(page.getByRole('tab', { name: /Bài toán/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tab', { name: /Bài toán/ })).toContainText('6')
    const cta = cards(page).first().getByText('Xem bài toán')
    await expect(cta).toHaveAttribute('aria-disabled', 'true')
    await expect(cta).toHaveAttribute('title', /chưa có trong phiên bản này/i)
    expect(await page.locator('[data-anchor="grid"] a').count()).toBe(0)
    // Default order is "Sắp hết hạn": open problems by days left, then judging, upcoming.
    await expect(cards(page).locator('h2')).toHaveText([
      'Giảm hao hụt trong chặng giao cuối',
      'Dự báo nhu cầu kho theo mùa vụ',
      'Định tuyến xe tải liên tỉnh',
      'Truy xuất nguồn gốc nông sản',
      'Chấm điểm tín dụng hộ kinh doanh',
      'Quản lý hàng hoàn theo thời gian thực',
    ])
    // No personal data on a public page.
    expect(await page.locator('body').innerText()).not.toMatch(/@/)
  })

  test('filters: multi-select, chips, counts, clear all and the empty state', async ({ page }) => {
    await page.goto('/library')
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await facets.getByRole('checkbox', { name: /Logistics/ }).check()
    await expect(count(page)).toHaveText('4 bài toán')
    await facets.getByRole('checkbox', { name: /Đang mở nộp/ }).check()
    await expect(count(page)).toHaveText('3 bài toán')
    await expect(page.getByRole('button', { name: 'Bỏ lọc Logistics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bỏ lọc Đang mở nộp' })).toBeVisible()
    // A facet with no result still shows, with 0.
    await expect(facets.locator('label', { hasText: 'Giáo dục' })).toContainText('0')
    await page.getByRole('button', { name: 'Bỏ lọc Đang mở nộp' }).click()
    await expect(count(page)).toHaveText('4 bài toán')
    await facets.getByRole('checkbox', { name: /Logistics/ }).uncheck()
    await facets.getByRole('checkbox', { name: /Y tế/ }).check()
    await expect(page.getByText('Không có bài toán nào khớp bộ lọc.')).toBeVisible()
    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    await expect(cards(page)).toHaveCount(6)
    await expect(page.getByText('Dữ liệu minh hoạ', { exact: true })).toBeVisible()
  })

  test('search, quick filters and sort run on the demo data only', async ({ page }) => {
    await page.goto('/library')
    const quick = page.getByRole('group', { name: 'Tìm nhanh theo lĩnh vực' })
    await quick.getByRole('button', { name: 'Nông nghiệp' }).click()
    await expect(quick.getByRole('button', { name: 'Nông nghiệp' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(cards(page)).toHaveCount(1)
    await quick.getByRole('button', { name: 'Nông nghiệp' }).click()
    await expect(cards(page)).toHaveCount(6)
    const search = page.getByRole('search')
    await search.getByRole('searchbox').fill('tin dung')
    await search.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).locator('h2')).toHaveText('Chấm điểm tín dụng hộ kinh doanh')
    await search.getByRole('searchbox').fill('')
    await expect(cards(page)).toHaveCount(6)
    await page.getByLabel('Sắp xếp:').selectOption('PRIZE')
    await expect(cards(page).first().locator('h2')).toHaveText('Chấm điểm tín dụng hộ kinh doanh')
    expect(apiCalls).toEqual([])
  })

  test('Startup and Nhà sáng lập tabs are "Sắp có"; the selector follows the tab', async ({
    page,
  }) => {
    await page.goto('/library')
    await page.getByRole('tab', { name: /Startup/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText(
      'Danh bạ Startup chưa có trong phiên bản này.',
    )
    await expect(page.getByRole('combobox', { name: 'Tìm trong' })).toHaveValue('STARTUP')
    await expect(page.getByRole('searchbox')).toBeDisabled()
    await page.getByRole('tab', { name: /Startup/ }).press('ArrowRight')
    await expect(page.getByRole('tab', { name: /Nhà sáng lập/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tabpanel')).toContainText('Danh bạ Nhà sáng lập')
    await page.getByRole('combobox', { name: 'Tìm trong' }).selectOption('PROBLEM')
    await expect(cards(page)).toHaveCount(6)
  })

  test('the floating "Góp ý" is visible and inert (no form, no request)', async ({ page }) => {
    await page.goto('/library')
    const fb = page.locator('[data-anchor="feedback"] [data-cta-kind="INERT"]')
    await expect(fb).toHaveText(/Góp ý/)
    await expect(fb).toHaveAttribute('aria-disabled', 'true')
    const box = (await fb.boundingBox())!
    expect(box.x + box.width).toBeGreaterThan(1300)
    expect(box.y + box.height).toBeGreaterThan(820)
  })
})

test.describe('PUBLIC-LIBRARY pixel QA (L15, 1440×900 DPR1)', () => {
  /** Top edge in page coordinates (boundingBox is viewport-relative once the page scrolls). */
  const top = async (page: Page, selector: string) =>
    Math.round(
      (await page.locator(selector).first().boundingBox())!.y +
        (await page.evaluate(() => window.scrollY)),
    )

  test('hero and tab bar match Hero 16_9 and Thanh tab', async ({ page }) => {
    await page.goto('/library')
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-hero',
      reference: REF.hero,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 101 }, dy: 0 },
        { name: 'heading', reference: { x: 200, y: 205, width: 1040, height: 205 }, dy: 0 },
        { name: 'search', reference: { x: 250, y: 420, width: 940, height: 105 }, dy: 0 },
        { name: 'quick', reference: { x: 440, y: 532, width: 560, height: 48 }, dy: 0 },
        { name: 'glow', reference: { x: 0, y: 580, width: 1440, height: 110 }, dy: 0 },
      ],
      intentional: [
        {
          class: 'content',
          reason:
            'Metrics row not compared: it comes from the demo fixture (4 open problems; Startup and Nhà sáng lập "Sắp có", DEC-L15-D3) with a "Số liệu minh hoạ" caption, not the pack\'s 28 / 142 / 310, so the glyphs and dividers sit elsewhere',
        },
      ],
    })
    const tabsTop = await top(page, '[data-anchor="tabs"]')
    expect(tabsTop).toBe(810)
    // The floating button sits over the tab bar at the top of the page; it has its own audit.
    await page.addStyleTag({ content: '[data-anchor="feedback"] { display: none !important; }' })
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-tabs',
      reference: REF.tabs,
      segments: [{ name: 'tabs', reference: { x: 0, y: 0, width: 1440, height: 63 }, dy: tabsTop }],
      intentional: [
        {
          class: 'content',
          reason: 'Tab counts: 6 problems; "Sắp có" for Startup and Nhà sáng lập',
        },
      ],
    })
  })

  test('directory matches Thân (filtered state and second row)', async ({ page }) => {
    await page.goto('/library')
    await page.addStyleTag({ content: '[data-anchor="feedback"] { display: none !important; }' })
    const facets = page.getByRole('complementary', { name: 'Bộ lọc' })
    await facets.getByRole('checkbox', { name: /Logistics/ }).check()
    await facets.getByRole('checkbox', { name: /Đang mở nộp/ }).check()
    const bodyTop = await top(page, '[data-section="directory"]')
    const intentional = [
      {
        class: 'content',
        reason:
          'Demo fixture (DEC-L15-D2): neutral sector labels instead of company names; counts derived from six problems; the drawn filter state is the real result (3 cards)',
      },
      {
        class: 'accessibility',
        reason:
          'Facet labels, sort and load-more text are legible (the pack draws them dark red on black); the checked boxes show a tick',
      },
      {
        class: 'omission',
        reason:
          'The designer note under the facets and "Xem thêm 22 bài toán" (six problems fit one page) are not rendered',
      },
    ]
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-directory-filtered',
      reference: REF.directory,
      referenceBackdrop: INK,
      full: true,
      segments: [
        { name: 'facets', reference: { x: 56, y: 20, width: 270, height: 400 }, dy: bodyTop },
        { name: 'chips', reference: { x: 350, y: 24, width: 300, height: 44 }, dy: bodyTop },
        {
          name: 'cards-row-1',
          reference: { x: 350, y: 78, width: 1036, height: 445 },
          dy: bodyTop,
        },
      ],
      // Facet labels (legible here, dark on black in the pack) and their fixture
      // counts differ on purpose; the boxes and group titles are still compared.
      exclude: [
        { x: 86, y: bodyTop + 52, width: 200, height: 330 },
        { x: 292, y: bodyTop + 52, width: 26, height: 330 },
      ],
      intentional,
    })
    await page.getByRole('button', { name: 'Xoá tất cả', exact: true }).click()
    const row2 = await top(page, '[data-anchor="grid"] > li:nth-child(4)')
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-directory-row-2',
      reference: REF.directory,
      referenceBackdrop: INK,
      full: true,
      segments: [
        {
          name: 'cards-row-2',
          reference: { x: 350, y: 986, width: 1036, height: 445 },
          dy: row2 - 993,
        },
      ],
      intentional,
    })
  })

  test('floating feedback matches "Nút góp ý · nổi"', async ({ page }) => {
    await page.goto('/library')
    const pill = (await page
      .locator('[data-anchor="feedback"] [data-cta-kind="INERT"]')
      .boundingBox())!
    await auditRevision(page, {
      name: 'PUBLIC-LIBRARY.L15-feedback',
      reference: REF.feedback,
      segments: [
        {
          name: 'pill',
          // The pill body; its rounded ends carry the transparent shadow of the export.
          reference: { x: 40, y: 15, width: 72, height: 35 },
          dx: Math.round(pill.x) - 22,
          dy: Math.round(pill.y) - 10,
        },
      ],
    })
  })
})
