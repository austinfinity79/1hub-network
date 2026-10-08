import { expect, test } from '@playwright/test'

import { PAST_EVENTS, UPCOMING_EVENTS } from '../../../src/lib/public/programme-event-source'

/**
 * S2-PROGRAMME-EVENT-CONTENT-01 — `/events`: the PO's event sheet only. The
 * first upcoming row is featured, the other six are cards, the 40 past rows
 * list newest first (9, then "Xem thêm"). No registration / calendar action
 * and no invented field (no year, weekday or seat count beyond the sheet).
 */

for (const width of [1440, 390]) {
  test(`${width}: source rows only, pictures load, no overflow, no console error`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    const res = await page.goto('/events', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Sự kiện')

    const [featured, ...rest] = UPCOMING_EVENTS
    const top = page.locator('[data-block="featured"]')
    await expect(top).toHaveAttribute('data-event', featured!.slug)
    await expect(top.locator('h2')).toHaveText(featured!.name)
    await expect(top).toContainText(featured!.info!)
    await expect(top).toContainText(featured!.venue!)
    const upcoming = page.locator('[data-block="upcoming"] li[data-event]')
    expect(await upcoming.locator('h3').allInnerTexts()).toEqual(rest.map((e) => e.name))
    for (const e of rest) {
      const card = upcoming.filter({ has: page.locator(`[data-event-date="${e.date}"]`) }).filter({
        hasText: e.name,
      })
      await expect(card).toHaveCount(1)
      if (e.seats) await expect(card).toContainText(e.seats)
      if (e.status) await expect(card).toContainText(e.status)
    }
    // No action the sheet does not give.
    for (const label of ['Đăng ký', 'Thêm vào lịch', 'Xem recap', 'Theo dõi'])
      await expect(page.locator('main').getByRole('link', { name: label })).toHaveCount(0)
    await expect(page.locator('main a')).toHaveCount(0)
    expect(await page.locator('main').innerText()).not.toMatch(
      /Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ nhật/,
    )

    const past = page.locator('[data-block="past"] li[data-event]')
    await expect(past).toHaveCount(9)
    await page.getByRole('button', { name: /^Xem thêm \d+ sự kiện$/ }).click()
    await expect(past).toHaveCount(18)
    const ordered = [...PAST_EVENTS].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
    expect(await past.locator('h3').allInnerTexts()).toEqual(
      ordered.slice(0, 18).map((e) => e.name),
    )
    // Every slug once (no duplicate).
    const slugs = await page
      .locator('[data-event]')
      .evaluateAll((n) => n.map((x) => x.getAttribute('data-event')))
    expect(new Set(slugs).size).toBe(slugs.length)

    await page.evaluate(async () => {
      for (const img of document.images) img.loading = 'eager'
      await Promise.all(
        [...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))),
      )
    })
    expect(
      await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      ),
    ).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    expect(errors).toEqual([])
  })
}

test('the invalid source date is not shown; the header opens /events', async ({ page }) => {
  const bad = PAST_EVENTS.find((e) => e.date === null)!
  expect(bad).toBeTruthy()
  await page.goto('/events', { waitUntil: 'networkidle' })
  while (await page.getByRole('button', { name: /^Xem thêm/ }).count())
    await page.getByRole('button', { name: /^Xem thêm/ }).click()
  await expect(page.locator('[data-block="past"] li[data-event]')).toHaveCount(PAST_EVENTS.length)
  expect(await page.locator('main').innerText()).not.toContain('21/22/2024')
  await page.goto('/programmes', { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await nav.getByRole('button', { name: 'Mở menu Chương trình' }).click()
  await nav.getByRole('link', { name: 'Sự kiện', exact: true }).click()
  await expect(page).toHaveURL('/events')
})
