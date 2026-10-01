import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { applyVocabularyFixture, completedAccount } from '../support/onboarding'

/**
 * P1 mobile hotfix (DEC-MSHELL): every member-shell screen fits the viewport
 * below desktop. Deterministic layout assertions, not screenshots: the page
 * never scrolls sideways and the content column keeps a usable width.
 */
const SCREENS = ['/me/privacy', '/me/roles', '/me/settings', '/demo/projects']
const WIDTHS = [320, 390, 430, 768]
const LABEL = 'Điều khoản sử dụng & Chính sách quyền riêng tư'

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.afterAll(async () => {
  await closePool()
})

async function layout(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const main = document.querySelector('[data-shell="member"] main')!.getBoundingClientRect()
    return {
      overflow: root.scrollWidth - root.clientWidth,
      mainLeft: main.left,
      mainRight: main.right,
      viewport: root.clientWidth,
    }
  })
}

for (const width of WIDTHS) {
  test(`member shell fits ${width}px without sideways scroll`, async ({ page }) => {
    await completedAccount(page.request, `mshell-${width}`)
    await page.setViewportSize({ width, height: 900 })
    for (const path of SCREENS) {
      await page.goto(path, { waitUntil: 'networkidle' })
      const m = await layout(page)
      expect(m.overflow, path).toBeLessThanOrEqual(0)
      expect(m.mainLeft, path).toBeGreaterThanOrEqual(0)
      expect(m.mainRight, path).toBeLessThanOrEqual(m.viewport)
      // A usable column, not a collapsed one (the pre-hotfix 0px main).
      expect(m.mainRight - m.mainLeft, path).toBeGreaterThan(Math.min(width - 64, 400))
    }
  })
}

test('the re-acceptance link stays inside a 390px viewport', async ({ page }) => {
  await completedAccount(page.request, 'mshell-legal')
  const versions: string[] = []
  for (const [type, kind] of [
    ['TERMS_ACCEPTANCE', 'terms'],
    ['PRIVACY_DATA_PROCESSING', 'privacy'],
  ] as const) {
    const version = `mshell-${kind}-${Date.now()}`
    versions.push(version)
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ($1::consent_type, $2, $3, $4, now())`,
      [type, version, kind, `/legal/${kind}/${version}`],
    )
  }
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/me/privacy', { waitUntil: 'networkidle' })
    const link = page.locator('[data-reaccept] a')
    await expect(link).toHaveCount(1)
    await expect(link).toHaveText(LABEL)
    const lines = await link.evaluate((a) =>
      [...a.getClientRects()].map((r) => [r.left, r.right] as const),
    )
    for (const [left, right] of lines) {
      expect(left).toBeGreaterThanOrEqual(0)
      expect(right).toBeLessThanOrEqual(390)
    }
    for (const control of [
      page.locator('[data-reaccept]').getByRole('checkbox'),
      page.getByRole('button', { name: 'Đồng ý phiên bản mới' }),
    ]) {
      const box = (await control.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
    }
    expect((await layout(page)).overflow).toBeLessThanOrEqual(0)
  } finally {
    await query('UPDATE legal_documents SET retired_at = now() WHERE version = ANY($1)', [versions])
  }
})

test('desktop keeps the side-by-side frame at 1440', async ({ page }) => {
  await completedAccount(page.request, 'mshell-1440')
  for (const path of SCREENS) {
    await page.goto(path, { waitUntil: 'networkidle' })
    const m = await layout(page)
    expect(m.overflow, path).toBeLessThanOrEqual(0)
    // 64px gutter + 250px sidebar + 26px gap, as measured on the references.
    expect(m.mainLeft, path).toBe(340)
  }
})
