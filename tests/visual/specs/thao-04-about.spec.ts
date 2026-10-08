import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { REGIONAL_HUBS } from '../../../src/components/about/about-hubs'
import { loadAboutNetwork, type AboutNetwork } from '../../../src/lib/public/about-network'
import { ECOSYSTEM_LINKS, FACEBOOK_URL } from '../../../src/lib/public/routes'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * THAO-04 — About HUB v2 production logic / data closure (no UI change).
 * Every count, unit name and board on /about comes from one source — the
 * published catalogue (`loadAboutNetwork`) and the S1-UAT-08A workbook — and
 * every unit it names links to its public page; partner links are the
 * approved external sites; unbuilt destinations are inert (READ_ONLY_APPROVED).
 */

let network: AboutNetwork
let consoleErrors: string[] = []

test.beforeAll(async () => {
  network = await loadAboutNetwork()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

const regional = () => REGIONAL_HUBS.filter((h) => network.chapters.some((c) => c.slug === h.slug))
const chapter = (slug: string) => network.chapters.find((c) => c.slug === slug)!
const humans = (page: Page) => page.locator('[data-section="humans"]')
const hubChips = (page: Page) => page.getByRole('list', { name: 'HUB Khu vực' }).getByRole('button')

test.describe('one source for every count', () => {
  test('hero, map, chips, CLB tab and timeline agree with the catalogue', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    const hubs = regional()
    const stats = page.locator('[data-section="hero"] li')
    await expect(stats.nth(1)).toHaveText(new RegExp(`^${hubs.length}\\s*HUB khu vực$`))
    await expect(stats.nth(2)).toHaveText(
      new RegExp(`^${network.clubCount}\\s*câu lạc bộ trực thuộc$`),
    )
    await expect(page.locator('#about-scale')).toHaveText(`${hubs.length} HUB Khu vực`)
    // One marker and one chip per regional HUB of the catalogue; no duplicate, no phantom.
    const markers = await page
      .locator('[data-marker]')
      .evaluateAll((e) => e.map((x) => (x as HTMLElement).dataset.marker))
    expect(markers).toEqual(hubs.map((h) => h.code))
    await expect(hubChips(page)).toHaveText(hubs.map((h) => new RegExp(`${h.short}$`)))
    // "Xem thêm": every published Chapter with its own CLB count.
    await page.getByRole('button', { name: 'Xem thêm' }).click()
    const groups = page.locator('#about-network-list section')
    await expect(groups.locator('h4')).toHaveText(network.chapters.map((c) => c.name))
    for (const [i, c] of network.chapters.entries())
      await expect(groups.nth(i).locator('li'), c.name).toHaveCount(c.clubs.length)
    // Câu lạc bộ tab: the same total, every CLB once.
    await humans(page).getByRole('tab', { name: 'Câu lạc bộ' }).click()
    await expect(humans(page)).toContainText(
      `${network.clubCount} câu lạc bộ trực thuộc các HUB Chapter`,
    )
    await humans(page).getByRole('button', { name: 'Xem tất cả câu lạc bộ' }).click()
    await expect(humans(page).locator('[data-humans-tab="CLB"] li')).toHaveCount(network.clubCount)
    // The timeline ends with every Chapter present.
    await page.getByRole('tab', { name: '2026', exact: true }).click()
    await expect(page.locator('[data-section="milestones"]')).toContainText(
      `${network.chapters.length}HUB đã có mặt`,
      { useInnerText: false },
    )
  })
})

test.describe('HUB popup', () => {
  test('each chip opens its own HUB with catalogue CLBs and board; close, Escape and switch work', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    for (const [i, h] of regional().entries()) {
      await hubChips(page).nth(i).click()
      const popup = page.getByRole('dialog')
      await expect(popup).toHaveCount(1)
      await expect(popup).toHaveAttribute('data-popup', h.slug)
      await expect(popup.locator('h3')).toHaveText(h.short)
      const clubs = chapter(h.slug).clubs
      await expect(popup.locator('dl > div').nth(0)).toHaveText(
        new RegExp(`^${clubs.length}\\s*CLB trực thuộc$`),
      )
      await expect(popup.locator('dl > div').nth(1)).toHaveText(
        new RegExp(`^${h.board.length}\\s*thành viên Ban điều hành$`),
      )
      const links = await popup
        .locator('ul a')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')))
      expect(links, h.short).toEqual(clubs.map((c) => `/organizations/${c.slug}`))
      await expect(popup.locator('[data-cta="hub-detail"]')).toHaveAttribute(
        'href',
        `/organizations/${h.slug}`,
      )
      if (i % 2) await page.keyboard.press('Escape')
      else await popup.getByRole('button', { name: 'Đóng' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
    // Every marker can be clicked: in the world view all but one sit clear; Quảng
    // Ninh (4.5 px from Hà Nội) gives way to the earlier HUB and is clicked in
    // the Việt Nam view (positions are presentation only).
    const hits = () =>
      page.locator('[data-marker]').evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          return [(el as HTMLElement).dataset.marker, (top as HTMLElement | null)?.dataset.marker]
        }),
      )
    await page.locator('[data-map-view]').scrollIntoViewIfNeeded()
    const world = await hits()
    expect(world.filter(([m, top]) => m !== top)).toEqual([['QN', 'HN']])
    await page.getByRole('tab', { name: 'Việt Nam' }).click()
    for (const [m, top] of await hits()) expect(top, m).toBe(m)
    await page.locator('[data-marker="QN"]').click()
    await expect(page.getByRole('dialog')).toHaveAttribute('data-popup', 'hub-network-quang-ninh')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Thế giới' }).click()
    // Marker → popup → overlay click closes; the detail CTA lands on the HUB page.
    await page.locator('[data-marker="HN"]').click()
    await page.mouse.click(5, 5)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('[data-marker="DN"]').click()
    await page.getByRole('dialog').locator('[data-cta="hub-detail"]').click()
    await expect(page).toHaveURL('/organizations/hub-network-da-nang')
  })
})

test.describe('Humans of HUB', () => {
  test('HUB Khu vực boards carry the catalogue name and CLB count; domestic HUBs from the catalogue', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    await humans(page).getByRole('tab', { name: 'HUB Khu vực' }).click()
    const domestic = regional()
      .filter((h) => h.place.endsWith('Việt Nam'))
      .map((h) => chapter(h.slug))
      .sort((x, y) => x.order - y.order)
      .map((c) => c.name.replace(/^HUB Network /, '').toLocaleUpperCase('vi'))
    await expect(humans(page)).toContainText(['HUB KHU VỰC TRONG NƯỚC', ...domestic].join(' · '))
    for (const h of regional()) {
      await humans(page).getByRole('tab', { name: h.short, exact: true }).click()
      const board = humans(page).locator(`[data-region="${h.slug}"]`)
      await expect(board.locator('h3')).toHaveText(`Ban điều hành ${chapter(h.slug).name}`)
      await expect(board).toContainText(`· ${chapter(h.slug).clubs.length} CLB`)
      await expect(board.getByRole('link', { name: /Chi tiết HUB Khu vực/ })).toHaveAttribute(
        'href',
        `/organizations/${h.slug}`,
      )
    }
  })
})

test.describe('links', () => {
  test('every internal link resolves; units link to their pages; nothing dead', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Xem thêm' }).click()
    await humans(page).getByRole('tab', { name: 'Câu lạc bộ' }).click()
    await humans(page).getByRole('button', { name: 'Xem tất cả câu lạc bộ' }).click()
    await expect(page.locator('a[href="#"], a[href=""], a[href^="javascript:"]')).toHaveCount(0)
    const internal = await page
      .locator('a[href^="/"]')
      .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))])
    const units = [
      ...network.chapters.map((c) => c.slug),
      ...network.chapters.flatMap((c) => c.clubs.map((k) => k.slug)),
    ].map((s) => `/organizations/${s}`)
    for (const u of units) expect(internal, u).toContain(u)
    for (const href of internal) expect((await page.request.get(href)).status(), href).toBe(200)
  })

  test('partner links: approved URLs only, new tab with noopener noreferrer; unbuilt targets inert', async ({
    page,
  }) => {
    await page.goto('/about', { waitUntil: 'networkidle' })
    const approved = new Set(
      [FACEBOOK_URL, ...Object.values(ECOSYSTEM_LINKS)].filter((u): u is string => Boolean(u)),
    )
    const external = await page
      .locator('a[href^="http"]')
      .evaluateAll((as) =>
        as.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]),
      )
    expect(external.length).toBeGreaterThan(0)
    for (const [href, target, rel] of external) {
      expect(approved.has(href!), href!).toBe(true)
      expect(target, href!).toBe('_blank')
      expect(rel, href!).toBe('noopener noreferrer')
    }
    // READ_ONLY_APPROVED: no screen or no confirmed URL.
    for (const el of await page.locator('[data-cta-kind="INERT"]').all()) {
      await expect(el).toHaveAttribute('aria-disabled', 'true')
      await expect(el).not.toHaveAttribute('href')
    }
    const eco = page.locator('[data-section="ecosystem"] li')
    await expect(eco).toHaveCount(7)
    // ABOUT-PARTNERS-PRESENTATION-01: a row without a supplied URL is plain
    // text — no arrow, no INERT control, no hover target.
    const plain = eco.filter({ has: page.locator('[data-eco="static"]') })
    // S2-QUICKFIX-234-01: APEC Innovation Challenge links to the PO's URL.
    await expect(plain).toHaveText([/iHUB Incubator/])
    await expect(plain.locator('svg, a, [data-cta-kind="INERT"], [title]')).toHaveCount(0)
    await expect(eco.locator('a')).toHaveCount(6)
    await expect(eco.filter({ hasText: 'APEC Innovation Challenge' }).locator('a')).toHaveAttribute(
      'href',
      'https://apec.1hub.cloud/',
    )
  })

  test('no placeholder partner wall: no approved partner data, nothing illustrative shown', async ({
    page,
  }) => {
    // ABOUT-PARTNERS-PRESENTATION-01 (DEC-THAO-ABOUT-D4: real partners await PO data).
    await page.goto('/about', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-section="partners"]')).toHaveCount(0)
    const text = await page.locator('body').innerText()
    for (const placeholder of [
      'Dữ liệu minh hoạ',
      'Doanh nghiệp A',
      'Tập đoàn C',
      'Đại học A',
      'Hiệp hội B',
      'Chương trình A',
      'ĐỐI TÁC ĐỒNG HÀNH',
    ])
      expect(text, placeholder).not.toContain(placeholder)
  })
})

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: no overflow; map, popup and tabs usable; shell intact`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/about', { waitUntil: 'networkidle' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
      const map = (await page.locator('[data-map-view]').boundingBox())!
      for (const m of await page.locator('[data-marker]').all()) {
        const b = (await m.boundingBox())!
        expect(b.x + b.width / 2).toBeGreaterThanOrEqual(map.x)
        expect(b.x + b.width / 2).toBeLessThanOrEqual(map.x + map.width)
      }
      // Việt Nam view: every domestic marker can be clicked at this width.
      await page.getByRole('tab', { name: 'Việt Nam' }).click()
      const covered = await page.locator('[data-marker]').evaluateAll(
        (els) =>
          els.filter((el) => {
            const r = el.getBoundingClientRect()
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            return top !== el
          }).length,
      )
      expect(covered, 'covered markers in the Việt Nam view').toBe(0)
      await page.getByRole('tab', { name: 'Thế giới' }).click()
      await hubChips(page).nth(2).click()
      const popup = page.getByRole('dialog')
      const p = (await popup.boundingBox())!
      expect(p.x, 'popup left').toBeGreaterThanOrEqual(0)
      expect(p.x + p.width, 'popup right').toBeLessThanOrEqual(width)
      await expect(popup.getByRole('button', { name: 'Đóng' })).toBeInViewport()
      await popup.locator('[data-cta="hub-detail"]').scrollIntoViewIfNeeded()
      await expect(popup.locator('[data-cta="hub-detail"]')).toBeInViewport()
      await page.keyboard.press('Escape')
      for (const tab of ['HUB Khu vực', 'Câu lạc bộ', 'HUB Tổng']) {
        const t = humans(page).getByRole('tab', { name: tab, exact: true })
        await t.click()
        await expect(t).toHaveAttribute('aria-selected', 'true')
      }
      await expect(page.locator('header[data-shell="public"]')).toHaveCount(1)
      await expect(page.locator('[data-shell="public-footer"]')).toHaveCount(1)
      await page.screenshot({
        path: path.join(REPO_ROOT, 'tests/visual/actual', `thao-04-about-${width}.png`),
        fullPage: true,
      })
    })
  }
})

test('S2-ABOUT-ASSETS-01: chapter chips draw the approved logo where one maps, initials otherwise', async ({
  page,
}) => {
  await page.goto('/about', { waitUntil: 'networkidle' })
  const chips = page.locator('ul[aria-label="HUB Khu vực"] li')
  const mapped: Record<string, string> = {
    'HUB Hà Nội': 'HN',
    'HUB TP.HCM': 'HCM',
    'HUB Đà Nẵng': 'DN',
    'HUB Quảng Ninh': 'QN',
    'HUB Singapore': 'SG',
    'HUB Trung Quốc': 'CN',
    'HUB Vương quốc Anh': 'UK',
    'HUB Hoa Kỳ': 'US',
    'HUB Châu Âu': 'EU',
  }
  const rows = await chips.evaluateAll((lis) =>
    lis.map((li) => {
      const img = li.querySelector('img[data-hub-logo]') as HTMLImageElement | null
      return {
        name: (li as HTMLElement).innerText.trim().split('\n').pop()!.trim(),
        code: img?.dataset.hubLogo ?? null,
        ok: img ? img.complete && img.naturalWidth > 0 : null,
      }
    }),
  )
  expect(rows.length).toBeGreaterThan(0)
  for (const r of rows) {
    // A chip names its HUB; only a mapped HUB carries a logo, and the right one.
    expect(r.code, r.name).toBe(mapped[r.name] ?? null)
    if (r.code) expect(r.ok, r.name).toBe(true)
  }
})
