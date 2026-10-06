import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page, type Response } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * DEMO-QA-PREP-B — the 07/10 review journey as one guest flow
 * (docs/demo-0710/DEMO_SOT_v1.md "Review journey", docs/demo-0710/qa/).
 *
 *   / → "Sản phẩm" → /products → /products/tracely → Đặng Kim Chi →
 *   /talents/<id> ("Đã xác thực danh tính qua 1Hub", DEMO) → "Giới thiệu" →
 *   /about → logo → /
 *
 * Steps that exist on the prepared base (4c9e7b7, DEMO-HOME-ABOUT-01) run
 * always. Steps owned by DEMO-DIR2-01 / DEMO-SP1-FOUNDER-01 are written from
 * the frozen SOT (routes, demo data, approved copy) and stay `fixme`
 * (AWAITING_A_IMPLEMENTATION) until DEMO-QA-B-SYNC runs the suite with
 * DEMO_QA_SYNC=1 on the accepted candidate. They never skip silently: with
 * the flag set, a missing screen is a failure. No selector is assumed for an
 * unbuilt screen; those steps use roles, routes and SOT text only.
 */

const SYNC = process.env.DEMO_QA_SYNC === '1'
const AWAITING = 'AWAITING_A_IMPLEMENTATION: set DEMO_QA_SYNC=1 at DEMO-QA-B-SYNC'

/** Demo data (docs/demo-0710/DEMO_DATA_CONTRACT.md, db/seed/demo_0710.sql). */
const DEMO = {
  startups: ['Tracely', 'AgriTrace', 'Kho Lạnh Miền Tây'],
  tracely: '/products/tracely',
  founder: { name: 'Đặng Kim Chi', id: 'de710000-0000-0000-0000-0000000000b1' },
  verifiedToo: 'de710000-0000-0000-0000-0000000000b5',
  unverified: 'de710000-0000-0000-0000-0000000000b6',
  verifiedCopy: 'Đã xác thực danh tính qua 1Hub',
} as const

/** OUT_OF_SCOPE_POST_DEMO "Wording guard": none of these actions exists. */
const BANNED = /đã xác minh|đã kết nối|đã theo dõi|đã gửi yêu cầu/i

let problems: string[] = []

test.beforeAll(async () => {
  // The deterministic demo ventures, idempotent (as demo-home-about-01).
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
})

test.afterAll(async () => {
  // Leave the visual-QA database as the other suites expect it.
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

test.beforeEach(async ({ page }) => {
  problems = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('response', (r: Response) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    if (/\.(png|jpe?g|webp|svg|woff2?)($|\?)/.test(r.url())) problems.push(`asset: ${r.url()}`)
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(problems, 'console / hydration errors, 5xx, missing assets').toEqual([])
})

const header = (page: Page) => page.locator('header[data-shell="public"]')

/** No dead link, no fake success (DEMO-D6) on the visible page. */
async function expectCleanPage(page: Page) {
  await expect(page.locator('a[href="#"], a[href=""], a[href^="javascript:"]')).toHaveCount(0)
  expect(await page.locator('main, [data-screen]').first().innerText()).not.toMatch(BANNED)
  const broken = await page
    .locator('img')
    .evaluateAll((imgs) =>
      imgs
        .filter(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0,
        )
        .map((i) => (i as HTMLImageElement).currentSrc),
    )
  expect(broken, 'broken images').toEqual([])
}

test.describe('vertical flow — base (DEMO-HOME-ABOUT-01)', () => {
  test('1–2 · Homepage loads as guest; public nav renders', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute(
      'data-revision',
      'DM01',
    )
    await expect(header(page)).toHaveAttribute('data-viewer', 'GUEST')
    await expect(header(page).locator('[data-cta="logo"]')).toHaveAttribute('href', '/')
    await expect(header(page).locator('[data-nav="about"] a').first()).toHaveAttribute(
      'href',
      '/about',
    )
    await expectCleanPage(page)
  })

  test('10–11 · "Giới thiệu" opens About; the logo returns Home; refresh and Back hold', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await header(page).locator('[data-nav="about"] a').first().click()
    await expect(page).toHaveURL('/about')
    await expect(page.locator('[data-screen="PUBLIC-ABOUT"]')).toHaveAttribute(
      'data-revision',
      'DM02',
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-screen="PUBLIC-ABOUT"]')).toBeVisible()
    await expectCleanPage(page)
    await header(page).locator('[data-cta="logo"]').click()
    await expect(page).toHaveURL('/')
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL('/about')
  })
})

test.describe('vertical flow — products and founder (DIR2 / SP1-FOUNDER)', () => {
  test.fixme(!SYNC, AWAITING)

  test('3–5 · "Sản phẩm" → /products lists the three demo startups', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await header(page).getByRole('link', { name: 'Sản phẩm', exact: true }).click()
    await expect(page).toHaveURL(/\/products(\?.*)?$/)
    for (const name of DEMO.startups)
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    expect(await page.content()).not.toMatch(/de710000-0000-0000-0000-0000000000c/)
    await expectCleanPage(page)
  })

  test('6–9 · Tracely → founder Đặng Kim Chi → public profile with the DEMO verified state', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'networkidle' })
    const card = page.locator('li, article').filter({ hasText: 'Tracely' }).first()
    await card.getByRole('link', { name: /Xem hồ sơ/ }).click()
    await expect(page).toHaveURL(DEMO.tracely)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tracely')
    await expectCleanPage(page)
    await page
      .getByRole('link', { name: new RegExp(DEMO.founder.name) })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/talents/${DEMO.founder.id}$`))
    await expect(page.getByRole('heading', { level: 1 })).toContainText(DEMO.founder.name)
    await expect(page.getByText(DEMO.verifiedCopy)).toBeVisible()
    await expectCleanPage(page)
    await page.goBack({ waitUntil: 'networkidle' })
    await expect(page).toHaveURL(DEMO.tracely)
  })

  test('direct URLs and refresh: products, startup, founder answer 200; others 404', async ({
    page,
  }) => {
    for (const url of ['/products', DEMO.tracely, `/talents/${DEMO.founder.id}`]) {
      expect((await page.goto(url, { waitUntil: 'networkidle' }))?.status(), url).toBe(200)
      await page.reload({ waitUntil: 'networkidle' })
      await expectCleanPage(page)
    }
    // DEMO-D5: only the allow-list renders; DEMO-D10: the flag is per profile.
    expect((await page.request.get('/products/not-a-demo-startup')).status()).toBe(404)
    expect((await page.request.get('/talents/00000000-0000-0000-0000-000000000000')).status()).toBe(
      404,
    )
    await page.goto(`/talents/${DEMO.verifiedToo}`, { waitUntil: 'networkidle' })
    await expect(page.getByText(DEMO.verifiedCopy)).toBeVisible()
    await page.goto(`/talents/${DEMO.unverified}`, { waitUntil: 'networkidle' })
    await expect(page.getByText(DEMO.verifiedCopy)).toHaveCount(0)
  })
})

test.describe('containment 1440 / 768 / 390', () => {
  const BASE = ['/', '/about']
  const AWAITED = ['/products', DEMO.tracely, `/talents/${DEMO.founder.id}`]
  for (const width of [1440, 768, 390]) {
    for (const url of [...BASE, ...AWAITED]) {
      test(`${width} ${url}: no horizontal overflow, header visible`, async ({ page }) => {
        test.fixme(AWAITED.includes(url) && !SYNC, AWAITING)
        await page.setViewportSize({ width, height: 900 })
        await page.goto(url, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0)
        const box = (await header(page).boundingBox())!
        expect(box.width).toBeLessThanOrEqual(width)
        await expectCleanPage(page)
      })
    }
  }
})
