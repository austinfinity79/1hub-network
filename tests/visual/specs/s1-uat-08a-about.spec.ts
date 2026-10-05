import { expect, test, type Page } from '@playwright/test'

/**
 * S1-UAT-08A — /about from the PO workbook "Thông tin About Hub.xlsx":
 * Humans of HUB (34 current-term people, workbook order) and the 43
 * representative activities; the omitted link column never shown; missing
 * fields stay "Chờ cập nhật"; 16:9 banners; 1440 / 768 / 390.
 */

let consoleErrors: string[] = []

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

async function open(page: Page) {
  const res = await page.goto('/about', { waitUntil: 'networkidle' })
  expect(res?.status()).toBe(200)
}

const humans = (page: Page) => page.locator('[data-human-order]')
const activities = (page: Page) => page.locator('[data-activity-row]')

test.describe('Humans of HUB', () => {
  test('34 current-term people in the workbook order; previous-generation rows absent', async ({
    page,
  }) => {
    await open(page)
    await expect(humans(page)).toHaveCount(34)
    const orders = await humans(page).evaluateAll((els) =>
      els.map((e) => Number(e.getAttribute('data-human-order'))),
    )
    expect(orders).toEqual(Array.from({ length: 34 }, (_, i) => i + 1))
    await expect(humans(page).first()).toContainText('Trần Quang Hưng')
    await expect(humans(page).first()).toContainText('Chủ tịch HUB Network Tổng')
    await expect(humans(page).last()).toContainText('Trần T. Bích Ngọc')
    await expect(humans(page).first()).toContainText('NHIỆM KỲ HIỆN TẠI')
    for (const gone of ['Ngô Trí Nguyên', 'Phùng Thị Ngọc Linh', 'Ngo Tri Nguyen']) {
      await expect(page.getByText(gone)).toHaveCount(0)
    }
    // "Các thế hệ trước": no previous-generation person is published.
    await page.getByRole('button', { name: 'Các thế hệ trước' }).click()
    await expect(humans(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Nhiệm kỳ hiện tại' }).click()
    await expect(humans(page)).toHaveCount(34)
  })

  test('a person without a supplied portrait keeps the placeholder, never another photo', async ({
    page,
  }) => {
    await open(page)
    const card = page.locator('[data-human-order="33"]')
    await expect(card).toContainText('Lê Mai Anh')
    await expect(card.locator('img')).toHaveCount(0)
    await expect(page.locator('[data-human-order="1"] img')).toHaveCount(1)
  })
})

test.describe('organisation diagram', () => {
  test('HN lead from the workbook link; China keeps the placeholder', async ({ page }) => {
    await open(page)
    const diagram = page.locator('[aria-label^="Sơ đồ HUB Tổng"]')
    await diagram.scrollIntoViewIfNeeded()
    await expect(
      page.locator('aside[aria-live="polite"]').filter({ hasText: 'TRƯỞNG HUB' }),
    ).toContainText('Vũ Minh Tâm')
    await diagram.getByText('CN', { exact: true }).click()
    await expect(
      page.locator('aside[aria-live="polite"]').filter({ hasText: 'TRƯỞNG HUB' }),
    ).not.toContainText('Phan Phương')
    await expect(
      page.locator('aside[aria-live="polite"]').filter({ hasText: 'TRƯỞNG HUB' }),
    ).not.toContainText('Lê Đức Anh')
  })
})

test.describe('Hoạt động tiêu biểu', () => {
  test('all 43 workbook rows, their images, their facts; the omitted link column never shown', async ({
    page,
  }) => {
    await open(page)
    await expect(activities(page)).toHaveCount(43)
    const first = activities(page).first()
    await expect(first).toContainText('UNIVERSITY MEETUP #2 DUE')
    await expect(first).toContainText('09/01/2026')
    await expect(first).toContainText('Cardano Vietnam')
    await expect(first).toContainText('Đại học Kinh tế – Đại học Đà Nẵng (DUE), Đà Nẵng')
    await expect(first).toContainText('Đơn vị tổ chức')
    await expect(first.locator('img')).toHaveAttribute('src', /activity-01\.webp/)
    await expect(page.locator('a[href*="facebook"]')).toHaveCount(0)
    await expect(page.getByText(/Link liên quan/)).toHaveCount(0)
  })

  test('missing location / HUB role read "Chờ cập nhật"; a malformed date is shown as written', async ({
    page,
  }) => {
    await open(page)
    await expect(page.locator('[data-activity-row="10"]')).toContainText(/ĐỊA ĐIỂM\s*Chờ cập nhật/)
    await expect(page.locator('[data-activity-row="34"]')).toContainText(
      /VAI TRÒ HUB\s*Chờ cập nhật/,
    )
    await expect(page.locator('[data-activity-row="36"]')).toContainText('21/22/2024')
  })

  test('filters: "Chuỗi sự kiện" lists the 3 series; "Chương trình" has none yet', async ({
    page,
  }) => {
    await open(page)
    await page.getByRole('button', { name: 'Chuỗi sự kiện' }).click()
    await expect(activities(page)).toHaveCount(3)
    await page.getByRole('button', { name: 'Chương trình' }).click()
    await expect(activities(page)).toHaveCount(0)
    await expect(page.getByText('Chờ cập nhật').first()).toBeVisible()
    await page.getByRole('button', { name: 'Cuộc thi' }).click()
    await expect(activities(page)).toHaveCount(11)
    await page.getByRole('button', { name: 'Tất cả' }).last().click()
    await expect(activities(page)).toHaveCount(43)
  })
})

test.describe('responsive (1440 / 768 / 390)', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: no horizontal scroll; 16:9 banners; titles and roles not clipped`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await open(page)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      const banner = page.locator('[data-activity-row="1"] > div').first()
      await banner.scrollIntoViewIfNeeded()
      const box = (await banner.boundingBox())!
      expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02)
      // Text inside cards wraps instead of being cut off.
      const clipped = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-human-order] p, [data-activity-row] dd, [data-activity-row] h3',
          ),
        ]
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => (el.textContent ?? '').slice(0, 40)),
      )
      expect(clipped).toEqual([])
      await page.screenshot({ path: `tests/visual/diff/s1-uat-08a/activities-${width}.png` })
      await humans(page).first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: `tests/visual/diff/s1-uat-08a/humans-${width}.png` })
    })
  }
})

test.describe('route and navigation', () => {
  test('/about still reached from the homepage and keeps its sections', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('a[href="/about"]').first().click()
    await expect(page).toHaveURL('/about')
    await expect(page.getByRole('heading', { name: 'Humans of HUB' })).toBeVisible()
    await expect(page.locator('[aria-label="Danh sách hoạt động"]')).toBeVisible()
  })
})
