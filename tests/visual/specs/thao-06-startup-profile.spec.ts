import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { query } from '../../../src/lib/db/client'
import {
  clearLibraryFixture,
  FX_PRIVATE,
  seedLibraryFixture,
  type LibraryFixture,
} from '../../../src/lib/library/testing'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * THAO-06 — Startup Profile v2, M3 slice (DEC-THAO-SP D1–D10): Tổng quan team
 * privacy, Chỉ số (Metrics v1), Cập nhật (Updates v1), Follow v1, on the built
 * server. Privacy is asserted on what the server sends (HTML and API bodies),
 * then the UI: tabs, editor controls only for owner / EDIT, responsive.
 *
 * Data (isolated QA database): the demo data (Tracely, its fictional team and
 * founder allow-list) and the WF06 Library fixture (real-like owners at every
 * visibility). Sessions are created directly; everything is removed afterwards.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')

let fx: LibraryFixture
const tokens: Record<string, string> = {}
let consoleErrors: string[] = []
/** WF06 An Khang: owner "WF06 Founder Lan", EDIT member "WF06 Founder Hải" (added here). */
let realSlug = ''
/** WF06 Ngân Hà: owner hidden (PROFILE_DISCOVERY PRIVATE). */
let hiddenOwnerSlug = ''
let privateSlug = ''

async function clearDemo() {
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
}

test.beforeAll(async () => {
  await query(`DELETE FROM profile_visibility_settings WHERE profile_id::text LIKE 'de710000-%'`)
  await query(readFileSync(path.join(REPO_ROOT, 'db/seed/demo_0710.sql'), 'utf8'))
  fx = await seedLibraryFixture()
  const slugOf = async (name: string) =>
    (await query<{ slug: string }>(`SELECT slug FROM projects WHERE name = $1`, [name]))[0]!.slug
  realSlug = await slugOf('WF06 An Khang')
  hiddenOwnerSlug = await slugOf('WF06 Ngân Hà')
  privateSlug = await slugOf('WF06 Kín Đáo')
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, permission, state)
     VALUES ($1, $2, 'CTO', 'EDIT', 'ACTIVE')`,
    [fx.ventures['WF06 An Khang'], fx.owners.hai],
  )
  for (const who of ['lan', 'hai', 'stranger', 'blocked'] as const)
    tokens[who] = (await createSession(fx.accounts[who])).token
  const [tracelyOwner] = await query<{ id: string }>(
    `SELECT ip.account_id::text AS id FROM projects p
       JOIN individual_profiles ip ON ip.id = p.owner_profile_id WHERE p.slug = 'tracely'`,
  )
  tokens.tracely = (await createSession(tracelyOwner!.id)).token
})

test.afterAll(async () => {
  // The fixture accounts' own audit rows (metrics, updates) go with them.
  await query(`DELETE FROM audit_events WHERE actor_account_id = ANY($1::uuid[])`, [
    Object.values(fx.accounts),
  ])
  await clearLibraryFixture()
  await clearDemo()
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

const signIn = (page: Page, baseURL: string | undefined, who: string) =>
  page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: tokens[who]!, url: baseURL! }])

const as = (who: string | null) =>
  who ? { headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokens[who]}` } } : {}

async function call(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  url: string,
  who: string | null,
  data?: unknown,
) {
  const res = await request[method](`/api/v1${url}`, { ...as(who), ...(data ? { data } : {}) })
  return { status: res.status(), body: await res.json().catch(() => null) }
}

const quarter = () => {
  const vn = new Date(Date.now() + 7 * 3_600_000)
  return { year: vn.getUTCFullYear(), quarter: Math.floor(vn.getUTCMonth() / 3) + 1 }
}

// ------------------------------------------------------------------ D1 team

test.describe('Tổng quan team privacy (D1)', () => {
  test('guest: no real-person name, id or count; a sign-in hint instead', async ({ page }) => {
    const html = await (await page.request.get(`/products/${realSlug}`)).text()
    for (const name of ['WF06 Founder Lan', 'WF06 Founder Hải', FX_PRIVATE.fullName])
      expect(html, name).not.toContain(name)
    for (const id of Object.values(fx.owners)) expect(html).not.toContain(id)
    await page.goto(`/products/${realSlug}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="team-gate"]')).toBeVisible()
    await expect(page.locator('[data-state="team-gate"] a')).toHaveAttribute('href', '/auth')
  })

  test('member: owner and members through PROFILE_DISCOVERY; a PRIVATE owner is left out', async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL, 'stranger')
    const html = await (await page.request.get(`/products/${realSlug}`)).text()
    expect(html).toContain('WF06 Founder Lan')
    expect(html).toContain('WF06 Founder Hải')
    for (const value of [FX_PRIVATE.fullName, FX_PRIVATE.phone, FX_PRIVATE.bio])
      expect(html).not.toContain(value)
    for (const id of Object.values(fx.owners)) expect(html).not.toContain(id)
    const hidden = await (await page.request.get(`/products/${hiddenOwnerSlug}`)).text()
    expect(hidden).not.toContain('WF06 Founder Ẩn')
    await page.goto(`/products/${realSlug}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="team-gate"]')).toHaveCount(0)
    // Real people never link to a profile (allow-list only).
    await expect(page.locator('a[data-cta="founder"]')).toHaveCount(0)
  })

  test('demo founder flow unchanged: Tracely team for guests, allow-listed founder link', async ({
    page,
  }) => {
    await page.goto('/products/tracely', { waitUntil: 'networkidle' })
    await expect(page.locator('a[data-cta="founder"]').first()).toHaveAttribute(
      'href',
      /^\/talents\/[a-z-]+$/,
    )
    await page.locator('a[data-cta="founder"]').first().click()
    await expect(page).toHaveURL(/\/talents\//)
  })

  test('tabs are real links; unpublished or private slugs stay 404 on every tab', async ({
    page,
  }) => {
    await page.goto(`/products/${realSlug}`, { waitUntil: 'networkidle' })
    const tabs = page.getByRole('navigation', { name: 'Hồ sơ sản phẩm' })
    await tabs.getByRole('link', { name: 'Chỉ số' }).click()
    await expect(page).toHaveURL(`/products/${realSlug}/metrics`)
    await expect(tabs.locator('[aria-current="page"]')).toHaveText('Chỉ số')
    await tabs.getByRole('link', { name: 'Cập nhật' }).click()
    await expect(page).toHaveURL(`/products/${realSlug}/updates`)
    await page.goBack()
    await expect(page).toHaveURL(`/products/${realSlug}/metrics`)
    for (const tab of ['', '/metrics', '/updates'])
      for (const slug of [privateSlug, 'khong-ton-tai'])
        expect((await page.request.get(`/products/${slug}${tab}`)).status(), slug + tab).toBe(404)
  })
})

// ------------------------------------------------------------------ D2 metrics

test.describe('Chỉ số — Metrics v1 (D2)', () => {
  test('API: write by owner / EDIT only; PRIVATE never leaves to others; append-only quarters', async ({
    request,
  }) => {
    const q = quarter()
    const base = `/startups/${realSlug}/metrics`
    const body = (value: number, metric = 'customers') => ({ metric, ...q, value })
    expect((await call(request, 'post', base, null, body(1))).status).toBe(401)
    expect((await call(request, 'post', base, 'blocked', body(1))).status).toBe(401)
    expect((await call(request, 'post', base, 'stranger', body(1))).status).toBe(403)
    expect((await call(request, 'post', base, 'lan', body(10))).status).toBe(200)
    expect((await call(request, 'post', base, 'hai', body(4, 'revenue'))).status).toBe(200)
    // A correction appends; the current value of the quarter is the latest.
    const corrected = await call(request, 'post', base, 'lan', body(12))
    expect(
      corrected.body.metrics.find((m: { slug: string }) => m.slug === 'customers').history,
    ).toEqual([{ ...q, value: 12 }])
    const [rows] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM venture_metric_values WHERE venture_id = $1`,
      [fx.ventures['WF06 An Khang']],
    )
    expect(rows!.n).toBe(3)
    // Both are PRIVATE until published: nobody else sees them, whatever the query.
    for (const who of [null, 'stranger'] as const) {
      const seen = await call(request, 'get', `${base}?visibility=PRIVATE&all=1`, who)
      expect(seen.body).toEqual({ can_edit: false, metrics: [] })
    }
    expect(
      (await call(request, 'patch', `${base}/customers`, 'stranger', { visibility: 'PUBLIC' }))
        .status,
    ).toBe(403)
    expect(
      (await call(request, 'patch', `${base}/customers`, 'lan', { visibility: 'INVESTOR' })).status,
    ).toBe(422)
    expect(
      (await call(request, 'patch', `${base}/customers`, 'lan', { visibility: 'PUBLIC' })).status,
    ).toBe(200)
    const pub = await call(request, 'get', base, null)
    expect(pub.body.metrics.map((m: { slug: string }) => m.slug)).toEqual(['customers'])
    expect(JSON.stringify(pub.body)).not.toContain('revenue')
    expect(pub.body.catalogue).toBeUndefined()
    // Validation: catalogue only, no future quarter, no free-form key.
    const future =
      q.quarter === 4 ? { year: q.year + 1, quarter: 1 } : { ...q, quarter: q.quarter + 1 }
    for (const bad of [
      { ...body(1), metric: 'investor-irr' },
      { metric: 'customers', ...future, value: 1 },
      { ...body(1), visibility: 'PUBLIC' },
    ])
      expect((await call(request, 'post', base, 'lan', bad)).status, JSON.stringify(bad)).toBe(422)
    // Venture mismatch: Lan does not edit Tracely; a private startup is 404 to others.
    expect((await call(request, 'post', '/startups/tracely/metrics', 'lan', body(1))).status).toBe(
      403,
    )
    expect(
      (await call(request, 'get', `/startups/${privateSlug}/metrics`, 'stranger')).status,
    ).toBe(404)
  })

  test('UI: guests and members see PUBLIC values; editors see visibility and the form', async ({
    page,
    baseURL,
  }) => {
    const html = await (await page.request.get(`/products/${realSlug}/metrics`)).text()
    expect(html).not.toContain('Doanh thu')
    await page.goto(`/products/${realSlug}/metrics`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-section="metric-editor"]')).toHaveCount(0)
    await expect(page.locator('[data-visibility]')).toHaveCount(0)
    await signIn(page, baseURL, 'hai')
    await page.goto(`/products/${realSlug}/metrics`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-section="metric-editor"]')).toBeVisible()
    await expect(page.locator('[data-metric="revenue"] [data-visibility="PRIVATE"]')).toBeVisible()
    const form = page.locator('[data-section="metric-editor"] form')
    await form.getByLabel('Chỉ số').selectOption('pilots')
    await form.getByLabel('Giá trị').fill('2')
    await form.getByRole('button', { name: 'Lưu chỉ số' }).click()
    await expect(page.locator('[data-metric="pilots"]')).toContainText('2')
    await page.screenshot({
      path: path.join(ACTUAL, 'thao-06-metrics-editor-1440.png'),
      fullPage: true,
    })
  })
})

// ------------------------------------------------------------------ D3 updates

test.describe('Cập nhật — Updates v1 (D3)', () => {
  test('API: owner / EDIT write; others refused; soft delete; another venture’s id is 404', async ({
    request,
  }) => {
    const base = `/startups/${realSlug}/updates`
    expect((await call(request, 'post', base, null, { body: 'x' })).status).toBe(401)
    expect((await call(request, 'post', base, 'stranger', { body: 'x' })).status).toBe(403)
    expect((await call(request, 'post', base, 'lan', { body: '' })).status).toBe(422)
    const posted = await call(request, 'post', base, 'hai', { body: 'Cập nhật đầu tiên' })
    expect(posted.status).toBe(200)
    const id = posted.body.updates[0].id
    expect(Object.keys(posted.body.updates[0]).sort()).toEqual([
      'body',
      'edited',
      'id',
      'published_at',
    ])
    expect((await call(request, 'patch', `${base}/${id}`, 'stranger', { body: 'x' })).status).toBe(
      403,
    )
    expect(
      (await call(request, 'patch', `/startups/tracely/updates/${id}`, 'tracely', { body: 'x' }))
        .status,
    ).toBe(404)
    expect(
      (await call(request, 'patch', `${base}/${id}`, 'lan', { body: 'Đã sửa' })).body.updates[0],
    ).toMatchObject({ body: 'Đã sửa', edited: true })
    const guest = await call(request, 'get', base, null)
    expect(guest.body.can_edit).toBe(false)
    expect(guest.body.updates).toHaveLength(1)
    expect((await call(request, 'delete', `${base}/${id}`, 'lan')).body.updates).toEqual([])
    expect((await call(request, 'delete', `${base}/${id}`, 'lan')).status).toBe(404)
    expect((await call(request, 'get', `/startups/${privateSlug}/updates`, null)).status).toBe(404)
  })

  test('UI: editor posts plain text (escaped, line breaks kept), edits and deletes inline', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`/products/${realSlug}/updates`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-section="update-editor"]')).toHaveCount(0)
    await signIn(page, baseURL, 'lan')
    await page.goto(`/products/${realSlug}/updates`, { waitUntil: 'networkidle' })
    await page.getByLabel('Nội dung cập nhật').fill('Dòng một\n<script>alert(1)</script>')
    await page.getByRole('button', { name: 'Đăng cập nhật' }).click()
    const post = page.locator('[data-update]').first()
    await expect(post).toContainText('<script>alert(1)</script>')
    await expect(page.locator('[data-update] script')).toHaveCount(0)
    await post.getByRole('button', { name: 'Sửa' }).click()
    await post.getByLabel('Sửa nội dung cập nhật').fill('Nội dung mới')
    await post.getByRole('button', { name: 'Lưu' }).click()
    await expect(post).toContainText('đã chỉnh sửa')
    await page.screenshot({
      path: path.join(ACTUAL, 'thao-06-updates-editor-1440.png'),
      fullPage: true,
    })
    await post.getByRole('button', { name: 'Xoá' }).click()
    await post.getByRole('button', { name: 'Xác nhận xoá' }).click()
    await expect(page.locator('[data-update]')).toHaveCount(0)
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
  })
})

// ------------------------------------------------------------------ D4 follow

test.describe('Follow v1 (D4)', () => {
  test('API: signed-in ACTIVE only; idempotent; own state only; published startups only', async ({
    request,
  }) => {
    const base = `/startups/${realSlug}/follow`
    expect((await call(request, 'put', base, null)).status).toBe(401)
    expect((await call(request, 'put', base, 'blocked')).status).toBe(401)
    expect((await call(request, 'put', base, 'stranger')).body).toEqual({ following: true })
    expect((await call(request, 'put', base, 'stranger')).body).toEqual({ following: true })
    expect((await call(request, 'get', base, 'hai')).body).toEqual({ following: false })
    expect((await call(request, 'put', `/startups/${privateSlug}/follow`, 'stranger')).status).toBe(
      404,
    )
    const html = await (await request.get(`/products/${realSlug}`)).text()
    expect(html).not.toMatch(/người theo dõi|followers?/i)
    expect((await call(request, 'delete', base, 'stranger')).body).toEqual({ following: false })
  })

  test('UI: guest → sign in; member toggles Theo dõi / Đang theo dõi, kept after reload', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`/products/${realSlug}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-cta="follow"]')).toHaveAttribute('href', '/auth')
    await signIn(page, baseURL, 'stranger')
    await page.goto(`/products/${realSlug}`, { waitUntil: 'networkidle' })
    const button = page.getByRole('button', { name: 'Theo dõi' })
    await button.click()
    await expect(page.getByRole('button', { name: 'Đang theo dõi' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: 'Đang theo dõi' })).toBeVisible()
    await page.getByRole('button', { name: 'Đang theo dõi' }).click()
    await expect(page.getByRole('button', { name: 'Theo dõi' })).toBeVisible()
    // Connect stays inert (D5).
    await expect(page.locator('[data-cta="connect"]')).toHaveAttribute('aria-disabled', 'true')
  })
})

// ------------------------------------------------------------------ /products card

test.describe('/products card Follow (THAO-M3-QA-01: no dead CTA)', () => {
  const card = (page: Page) => page.locator(`[data-startup="${realSlug}"] [data-cta="follow"]`)

  test('each member sees only their own state; guests are sent to sign in', async ({
    page,
    baseURL,
    request,
  }) => {
    expect((await call(request, 'put', `/startups/${realSlug}/follow`, 'stranger')).status).toBe(
      200,
    )
    await page.goto('/products?q=an+khang', { waitUntil: 'networkidle' })
    await expect(card(page)).toHaveAttribute('href', '/auth')
    await signIn(page, baseURL, 'hai')
    await page.goto('/products?q=an+khang', { waitUntil: 'networkidle' })
    await expect(card(page)).toHaveAttribute('aria-pressed', 'false')
    await page.context().clearCookies()
    await signIn(page, baseURL, 'stranger')
    await page.goto('/products?q=an+khang', { waitUntil: 'networkidle' })
    await expect(card(page)).toHaveAttribute('aria-pressed', 'true')
    const html = await (await page.request.get('/products')).text()
    expect(html).not.toMatch(/người theo dõi|followers?/i)
    await card(page).click()
    await expect(card(page)).toHaveText('Theo dõi')
    expect((await call(request, 'get', `/startups/${realSlug}/follow`, 'stranger')).body).toEqual({
      following: false,
    })
  })

  for (const width of [1440, 1280, 1024, 768, 390]) {
    test(`${width}: both states fit the card`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 900 })
      await signIn(page, baseURL, 'stranger')
      await page.goto('/products?q=an+khang', { waitUntil: 'networkidle' })
      for (const label of ['Theo dõi', 'Đang theo dõi']) {
        if (label === 'Đang theo dõi') await card(page).click()
        await expect(card(page)).toHaveText(label)
        const box = (await card(page).boundingBox())!
        const host = (await page.locator(`[data-startup="${realSlug}"]`).boundingBox())!
        expect(box.x + box.width, label).toBeLessThanOrEqual(host.x + host.width + 0.5)
        expect(box.height, label).toBeLessThanOrEqual(48)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        )
        await page.screenshot({
          path: path.join(
            ACTUAL,
            `thao-06-products-card-${label === 'Theo dõi' ? 'off' : 'on'}-${width}.png`,
          ),
        })
      }
      await card(page).click()
      await expect(card(page)).toHaveText('Theo dõi')
    })
  }
})

// ------------------------------------------------------------------ responsive

test.describe('responsive 1440 / 1280 / 1024 / 768 / 390', () => {
  for (const width of [1440, 1280, 1024, 768, 390]) {
    test(`${width}: three tabs without overflow, guest and editor`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const who of [null, 'tracely'] as const) {
        await page.context().clearCookies()
        if (who) await signIn(page, baseURL, who)
        for (const tab of ['', '/metrics', '/updates']) {
          await page.goto(`/products/tracely${tab}`, { waitUntil: 'networkidle' })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
            `${who ?? 'guest'} ${tab} overflow`,
          ).toBeLessThanOrEqual(width)
          for (const el of await page
            .locator('main a, main button, main select, main input, main textarea')
            .all()) {
            const b = await el.boundingBox()
            if (!b || b.width === 0) continue
            expect(b.x + b.width, `${who ?? 'guest'} ${tab} control inside`).toBeLessThanOrEqual(
              width + 1,
            )
          }
          await page.screenshot({
            path: path.join(
              ACTUAL,
              `thao-06-${who ?? 'guest'}${tab.replace('/', '-') || '-overview'}-${width}.png`,
            ),
            fullPage: true,
          })
        }
      }
    })
  }
})
