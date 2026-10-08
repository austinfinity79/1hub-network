import { expect, test } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { query } from '../../../src/lib/db/client'

/**
 * PRODUCT-DETAIL-SMART-CAMPUS-01 — `/products/1hub-smart-campus-solution`, the
 * approved source blocks only (docs/data/product-detail-readiness-audit.md):
 * slogan, one-line description, problem, solution, vision, needs, site; stage
 * "Thử nghiệm" (PO). The quarantined claims (founding date, funding, highlights,
 * milestones, market, metrics) and the held customer voice never render.
 *
 * Data (isolated QA database): the canonical venture under its production id
 * (the overview is keyed by it), owned like production by a deactivated
 * catalogue profile, removed afterwards.
 */

const VENTURE = '0e366810-36ac-4de2-923a-fe5929cb02e3'
const OWNER_ACCOUNT = '5c000000-0000-4000-8000-0000000000a1'
const OWNER_PROFILE = '5c000000-0000-4000-8000-0000000000b1'
const URL = '/products/1hub-smart-campus-solution'
const MEMBER_ACCOUNT = '5c000000-0000-4000-8000-0000000000a2'
// S2-SMART-CAMPUS-DETAIL-ENRICH-01: "Đội ngũ" S3–U3, as written, in order.
const SOURCE_TEAM = [
  ['Nguyễn Quang Dũng', 'Tổng Giám đốc'],
  ['Nguyễn Duy Thanh', 'Giám đốc Công nghệ'],
  ['Vũ Tuấn Anh', 'Giám đốc Marketing'],
]

const QUARANTINED = [
  'Vòng đã hoàn tất',
  'Pre-seed',
  '5 tỷ',
  '0 VNĐ',
  '30 tỷ',
  '20+',
  '10+',
  '25.000',
  '200.000',
  '10.000',
  '3.000',
  '150 triệu',
  'CSAT',
  'App Store',
  'Campus Ambassador',
  'Tarot',
  'Thị trường',
  'Gọi vốn',
  'Dấu ấn',
  'Chia sẻ từ khách hàng',
  'Xem chỉ số',
  'dataroom',
  'tuyển dụng',
  'Từ 2026',
  'Growth',
  'Tăng trưởng',
]

async function clear() {
  await query(`DELETE FROM project_domains WHERE project_id = $1`, [VENTURE])
  await query(`DELETE FROM projects WHERE id = $1`, [VENTURE])
  await query(`DELETE FROM individual_profiles WHERE id = $1`, [OWNER_PROFILE])
  await query(`DELETE FROM user_sessions WHERE account_id = $1`, [MEMBER_ACCOUNT])
  await query(`DELETE FROM user_accounts WHERE id = ANY($1::uuid[])`, [
    [OWNER_ACCOUNT, MEMBER_ACCOUNT],
  ])
}

test.beforeAll(async () => {
  await clear()
  await query(
    `INSERT INTO user_accounts (id, email, email_normalized, status)
     VALUES ($1, 'sc-catalogue@example.test', 'sc-catalogue@example.test', 'DEACTIVATED')`,
    [OWNER_ACCOUNT],
  )
  await query(
    `INSERT INTO individual_profiles (id, account_id, status, display_name)
     VALUES ($1, $2, 'DEACTIVATED', 'HUB Network Catalogue')`,
    [OWNER_PROFILE, OWNER_ACCOUNT],
  )
  await query(
    `INSERT INTO user_accounts (id, email, email_normalized, status)
     VALUES ($1, 'sc-member@example.test', 'sc-member@example.test', 'ACTIVE')`,
    [MEMBER_ACCOUNT],
  )
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, status, visibility, region_id, stage_id)
     VALUES ($1, 'STARTUP', $2, '1hub-smart-campus-solution', '1Hub - Smart Campus Solution',
             'Hạ tầng định danh toàn diện cho hệ sinh thái giáo dục Việt Nam', 'ACTIVE', 'PUBLIC',
             (SELECT id FROM vocabulary_items WHERE type_code = 'REGION' AND slug = 'hanoi'),
             (SELECT id FROM vocabulary_items WHERE type_code = 'VENTURE_STAGE' AND slug = 'PILOT'))`,
    [VENTURE, OWNER_PROFILE],
  )
  await query(
    `INSERT INTO project_domains (project_id, vocabulary_item_id)
     SELECT $1, id FROM vocabulary_items WHERE type_code = 'DOMAIN' AND slug = 'edtech'`,
    [VENTURE],
  )
})

test.afterAll(clear)

for (const width of [1440, 390]) {
  test(`${width}: the approved blocks, stage "Thử nghiệm", no quarantined claim`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    const res = await page.goto(URL, { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1#startup-name')).toHaveText('1Hub - Smart Campus Solution')
    await expect(page.locator('[class*="status"]').first()).toHaveText('Thử nghiệm')
    const text = (await page.locator('main').textContent()) ?? ''
    for (const want of [
      'Smart Campus Today. Smart Society Tomorrow.',
      '1Hub là nền tảng kết nối danh tính số đáng tin cậy',
      'Bài toán',
      'Người dùng thiếu lý do để chủ động quay lại',
      'Giải pháp',
      'Tích hợp mini-app phục vụ học tập',
      'Tầm nhìn',
      'Từ Smart Campus đến Smart Society',
      'Nhu cầu',
      'Kết nối đối tác trường học và đơn vị phát triển mini-app',
      'Hà Nội',
      'Giáo dục',
    ])
      expect(text, want).toContain(want)
    for (const claim of QUARANTINED) expect(text, claim).not.toContain(claim)
    const site = page.locator('a[data-cta="website"]')
    await expect(site).toHaveAttribute('href', 'https://1hub.global/en')
    await expect(site).toHaveAttribute('target', '_blank')
    // A guest sees no real person (DEC-THAO-SP-D1).
    await expect(page.locator('[data-state="team-gate"]')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    expect(
      await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      ),
    ).toEqual([])
    expect(errors).toEqual([])
  })
}

test('team: the source list for members only; a guest gets the gate and no name', async ({
  page,
  baseURL,
}) => {
  // Guest: the gate, and no team name anywhere in the HTML.
  const html = await (await page.request.get(URL)).text()
  for (const [name] of SOURCE_TEAM) expect(html, name).not.toContain(name)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="team-gate"]')).toHaveCount(1)
  // Member: the three people in source order, with their roles; nobody without
  // a profile links anywhere (no profile is created).
  const { token } = await createSession(MEMBER_ACCOUNT)
  await page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: token, url: baseURL! }])
  await page.goto(URL, { waitUntil: 'networkidle' })
  const rows = page.locator('[aria-labelledby="sp-team"] li')
  await expect(rows).toHaveCount(3)
  for (const [i, [name, role]] of SOURCE_TEAM.entries()) {
    await expect(rows.nth(i)).toContainText(name!)
    await expect(rows.nth(i)).toContainText(role!)
  }
  for (const name of ['Nguyễn Quang Dũng', 'Nguyễn Duy Thanh'])
    await expect(rows.filter({ hasText: name }).locator('a')).toHaveCount(0)
})

test('metrics and updates: no verified source, the honest empty states stay', async ({ page }) => {
  await page.goto(`${URL}/metrics`, { waitUntil: 'networkidle' })
  await expect(page.locator('main')).toContainText('Startup chưa công bố chỉ số nào.')
  await page.goto(`${URL}/updates`, { waitUntil: 'networkidle' })
  await expect(page.locator('main')).toContainText('Startup chưa có cập nhật nào.')
  for (const claim of ['3.000', '150 triệu', 'CSAT', '15/07/2026', 'Tarot'])
    expect(await page.locator('main').textContent(), claim).not.toContain(claim)
})
