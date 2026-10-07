import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { query } from '../../../src/lib/db/client'
import {
  clearLibraryFixture,
  seedLibraryFixture,
  type LibraryFixture,
} from '../../../src/lib/library/testing'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * DEMO-CONTENT-V2-PATCH-A (fix) — public Product logos on the built server:
 * the current logo of a published startup is served to guests and drawn on
 * its `/products` card and its page; every other asset keeps the session
 * rules (a private venture's logo, a PRIVATE profile's avatar), and a startup
 * without a logo keeps its initials.
 */

// The server's MEDIA_STORAGE_DIR (`.data/media`, relative to the repository).
const MEDIA = path.join(REPO_ROOT, '.data/media')
// 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const ids = {
  publicLogo: 'asset_' + 'c1'.repeat(16),
  privateLogo: 'asset_' + 'c2'.repeat(16),
  privateAvatar: 'asset_' + 'c3'.repeat(16),
}

let fx: LibraryFixture
let memberToken = ''
let publicSlug = ''
let privateSlug = ''
let consoleErrors: string[] = []

function store(id: string, owner: string) {
  mkdirSync(MEDIA, { recursive: true })
  writeFileSync(path.join(MEDIA, id), PNG)
  writeFileSync(
    path.join(MEDIA, `${id}.json`),
    JSON.stringify({
      owner_account_id: owner,
      content_type: 'image/png',
      byte_size: PNG.byteLength,
      created_at: '2026-10-07T00:00:00.000Z',
    }),
  )
}

test.beforeAll(async () => {
  fx = await seedLibraryFixture()
  const slugOf = async (name: string) =>
    (await query<{ slug: string }>(`SELECT slug FROM projects WHERE name = $1`, [name]))[0]!.slug
  publicSlug = await slugOf('WF06 An Khang')
  privateSlug = await slugOf('WF06 Kín Đáo')
  store(ids.publicLogo, fx.accounts.lan)
  store(ids.privateLogo, fx.accounts.lan)
  store(ids.privateAvatar, fx.accounts.hidden)
  await query(`UPDATE projects SET logo_asset_id = $2 WHERE slug = $1`, [
    publicSlug,
    ids.publicLogo,
  ])
  await query(`UPDATE projects SET logo_asset_id = $2 WHERE slug = $1`, [
    privateSlug,
    ids.privateLogo,
  ])
  await query(`UPDATE individual_profiles SET avatar_asset_id = $2 WHERE id = $1`, [
    fx.owners.hidden,
    ids.privateAvatar,
  ])
  memberToken = (await createSession(fx.accounts.stranger)).token
})

test.afterAll(async () => {
  await clearLibraryFixture()
  for (const id of Object.values(ids))
    for (const f of [id, `${id}.json`]) rmSync(path.join(MEDIA, f), { force: true })
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
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test('a published startup logo is public; private assets stay 404 for guests and members', async ({
  request,
}) => {
  const res = await request.get(`/media/assets/${ids.publicLogo}`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/png')
  expect(Buffer.from(await res.body()).equals(PNG)).toBe(true)
  for (const id of [ids.privateLogo, ids.privateAvatar, 'asset_' + 'ff'.repeat(16), 'nope'])
    expect((await request.get(`/media/assets/${id}`)).status(), id).toBe(404)
  const member = { headers: { Cookie: `${SESSION_COOKIE_NAME}=${memberToken}` } }
  for (const id of [ids.privateLogo, ids.privateAvatar])
    expect((await request.get(`/media/assets/${id}`, member)).status(), `member ${id}`).toBe(404)
})

test('card and page draw the logo; a startup without one keeps its initials', async ({ page }) => {
  await page.goto('/products?q=an+khang', { waitUntil: 'networkidle' })
  const card = page.locator(`li[data-startup="${publicSlug}"]`)
  const logo = card.locator('img[data-logo]')
  await expect(logo).toHaveAttribute('src', `/media/assets/${ids.publicLogo}`)
  expect(await logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
  const box = (await card.locator('span[aria-hidden="true"]').first().boundingBox())!
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([52, 52])

  // Another startup keeps its initials.
  await page.goto(`/products?q=${encodeURIComponent('Bình Minh')}`, { waitUntil: 'networkidle' })
  const other = page.locator('li[data-startup]').first()
  await expect(other).toContainText('WF06 Bình Minh')
  await expect(other.locator('img[data-logo]')).toHaveCount(0)
  expect((await other.locator('span[aria-hidden="true"]').first().innerText()).trim()).toMatch(
    /^\S{2}$/,
  )

  await page.goto(`/products/${publicSlug}`, { waitUntil: 'networkidle' })
  const head = page.locator('section[aria-labelledby="startup-name"] img[data-logo]')
  await expect(head).toHaveAttribute('src', `/media/assets/${ids.publicLogo}`)
  expect(await head.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
})

test('a logo stops being public when its startup leaves the directory', async ({ request }) => {
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE slug = $1`, [publicSlug])
  try {
    expect((await request.get(`/media/assets/${ids.publicLogo}`)).status()).toBe(404)
  } finally {
    await query(`UPDATE projects SET status = 'ACTIVE' WHERE slug = $1`, [publicSlug])
  }
  expect((await request.get(`/media/assets/${ids.publicLogo}`)).status()).toBe(200)
})
