import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * HOME-LOGO-HOTFIX-01 — the PO's approved logo (HUB_Network_FINAL_white_transparent.png,
 * sha256 ebee6841…) in the dark public header: served byte for byte, drawn in the
 * unchanged 33 × 34 slot, never on the light header (white on light would vanish
 * and may not be recoloured).
 */

const SHA = 'ebee6841572033c1b1d114037e3110fdc32b51f87c4cc6fe2fd09490836ea85c'
const SRC = '/brand/hub-network-logo-white.png'

test.beforeAll(async () => {
  await query(`DELETE FROM profile_visibility_settings WHERE profile_id::text LIKE 'de710000-%'`)
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
})

test.afterAll(async () => {
  // The demo rows go again, as in the other specs that load them.
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
})

test('the asset is the approved file, unmodified', async ({ request }) => {
  const res = await request.get(SRC)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/png')
  expect(
    createHash('sha256')
      .update(await res.body())
      .digest('hex'),
  ).toBe(SHA)
})

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`${width}: dark header draws the approved logo in the same slot`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.setViewportSize({ width, height: 900 })
    for (const url of ['/', '/about', '/products', '/library']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const slot = page.locator('header[data-shell="public"] a[data-cta="logo"]')
      const box = (await slot.boundingBox())!
      expect([Math.round(box.width), Math.round(box.height)], url).toEqual([33, 34])
      const img = slot.locator('img[data-logo="brand"]')
      await expect(img).toHaveAttribute('src', new RegExp(encodeURIComponent(SRC)))
      expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(
        true,
      )
      await expect(slot.locator('svg')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
    }
    // The light header (startup page) keeps the drawn symbol.
    await page.goto('/products/tracely', { waitUntil: 'networkidle' })
    const light = page.locator('header[data-shell="public"] a[data-cta="logo"]')
    await expect(light.locator('svg')).toHaveCount(1)
    await expect(light.locator('img')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
