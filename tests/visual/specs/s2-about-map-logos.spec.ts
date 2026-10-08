import { expect, test } from '@playwright/test'

/**
 * S2-ABOUT-MAP-HUB-LOGOS-01 — a map point's quick card shows the HUB's approved
 * logo (the same HUB_LOGOS file as its chip, S2-ABOUT-ASSETS-01) on hover and
 * on keyboard focus; a HUB without one keeps its initials. Positions unchanged.
 */

const MAPPED = ['HN', 'HCM', 'DN', 'QN', 'SG', 'CN', 'UK', 'US', 'EU']

test('every map point: its chip logo on focus, else the initials; hover too', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/about', { waitUntil: 'networkidle' })
  const chipLogo = async (code: string) =>
    page.locator(`ul[aria-label="HUB Khu vực"] img[data-hub-logo="${code}"]`).getAttribute('src')
  let matched = 0
  let unmatched = 0
  for (const view of ['Thế giới', 'Việt Nam']) {
    await page.getByRole('tab', { name: view }).click()
    const markers = page.locator('[data-marker]')
    const n = await markers.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const m = markers.nth(i)
      const code = (await m.getAttribute('data-marker'))!
      const before = await m.evaluate((el) => [el.style.left, el.style.top])
      await m.focus()
      const quick = page.locator(`[data-quick="${code}"]`)
      await expect(quick).toBeVisible()
      const logo = quick.locator('img[data-quick-logo]')
      if (MAPPED.includes(code)) {
        await expect(logo).toHaveAttribute('data-quick-logo', code)
        expect(await logo.getAttribute('src')).toBe(await chipLogo(code))
        await expect
          .poll(() => logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
          .toBeGreaterThan(0)
        if (view === 'Thế giới') matched++
      } else {
        await expect(logo).toHaveCount(0)
        await expect(quick.locator('[class*="quickMark"]')).not.toHaveText('')
        if (view === 'Thế giới') unmatched++
      }
      // Position data unchanged by the state.
      expect(await m.evaluate((el) => [el.style.left, el.style.top])).toEqual(before)
      await m.blur()
    }
  }
  expect(matched).toBe(9)
  expect(unmatched).toBe(2)
  // Mouse hover shows the same card.
  await page.getByRole('tab', { name: 'Thế giới' }).click()
  await page.locator('[data-marker="SG"]').hover()
  await expect(page.locator('[data-quick="SG"] img[data-quick-logo="SG"]')).toBeVisible()
})
