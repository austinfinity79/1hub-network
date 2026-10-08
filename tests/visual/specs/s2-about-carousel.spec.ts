import { expect, test } from '@playwright/test'

import { ACTIVITY_PICTURES, HUB_COVERS } from '../../../src/components/about/about-carousel'

/**
 * S2-ABOUT-HUB-CAROUSEL-01 — the two picture rows under the About map: the
 * manifest's 8 HUB covers running left (a card opens the HUB popup) and its 6
 * activity pictures running right (a card opens /events); still under reduced
 * motion.
 */

for (const width of [1440, 390]) {
  test(`${width}: manifest rows, directions, pictures, no overflow`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/about', { waitUntil: 'networkidle' })
    const block = page.locator('[data-block="hub-carousel"]')
    await expect(block).toContainText(
      'Mỗi HUB được dựng nên bởi những người sáng lập ở địa phương đó.',
    )
    const covers = block.locator('[data-cover]')
    await expect(covers).toHaveCount(HUB_COVERS.length)
    expect(await covers.evaluateAll((n) => n.map((x) => x.getAttribute('data-cover')))).toEqual(
      HUB_COVERS.map((c) => c.slug),
    )
    expect(
      await covers.locator('img').evaluateAll((n) => n.map((x) => x.getAttribute('alt'))),
    ).toEqual(HUB_COVERS.map((c) => c.alt))
    expect(await covers.locator('[class*="coverLabel"]').allInnerTexts()).toEqual(
      HUB_COVERS.map((c) => c.label),
    )
    const acts = block.locator('[data-activity]')
    await expect(acts).toHaveCount(ACTIVITY_PICTURES.length)
    // The second copy (seamless loop) is hidden from assistive technology and Tab.
    await expect(
      block.locator(
        '[aria-hidden="true"] a:not([tabindex="-1"]), [aria-hidden="true"] button:not([tabindex="-1"])',
      ),
    ).toHaveCount(0)
    const anim = (row: string) =>
      block.locator(`[data-row="${row}"] ul`).evaluate((el) => getComputedStyle(el).animationName)
    expect(await anim('hubs')).toContain('marquee-left')
    expect(await anim('activities')).toContain('marquee-right')
    await page.evaluate(async () => {
      for (const i of document.images) i.loading = 'eager'
      await Promise.all(
        [...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => 0))),
      )
    })
    expect(
      await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      ),
    ).toEqual([])
    expect(
      await block.locator('picture source[type="image/webp"]').first().getAttribute('srcset'),
    ).toMatch(/\.webp$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    expect(errors).toEqual([])
  })
}

test('a HUB cover opens its popup; an activity opens /events; reduced motion is still', async ({
  page,
}) => {
  await page.goto('/about', { waitUntil: 'networkidle' })
  const block = page.locator('[data-block="hub-carousel"]')
  expect(
    await block
      .locator('[data-row="hubs"] ul')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
  await block.locator('[data-cover="hub-network-da-nang"] button').click()
  await expect(page.locator('[data-popup="hub-network-da-nang"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-popup]')).toHaveCount(0)
  await block.locator('[data-activity="01-hoat-dong"] a').click()
  await expect(page).toHaveURL('/events')
})
