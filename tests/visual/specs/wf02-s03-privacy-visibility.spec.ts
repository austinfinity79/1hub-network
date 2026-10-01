import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S03 — Privacy & Visibility (/me/privacy). Production.
 * Decisions DEC-WF02-H3/H4, DEC-WF02-S03-D1..D6; WF01-S07 services reused.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 500 and the stale-version 409 are scenarios under test.
    if (m.type() === 'error' && !/status of (409|500)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

type Member = { email: string; accountId: string; profileId: string }

async function completedMember(request: APIRequestContext, label = 's03'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        data: {
          full_name: 'Đặng Kim Chi',
          display_name: 'Đặng Kim Chi',
          country_id: COUNTRY,
          headline: 'QA',
          region_id: REGION,
          domain_ids: [DOMAIN],
        },
      })
    ).status(),
  ).toBe(200)
  await acceptCurrent(request)
  for (const completed of ['CAPABILITY', 'ROLE']) {
    const stage = await request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect(stage.ok()).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

async function acceptCurrent(request: APIRequestContext, only?: string) {
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    if (only && doc.type !== only) continue
    const r = await request.post('/api/v1/me/consents/accept', {
      data: { consent_type: doc.type, policy_version: doc.version },
    })
    expect(r.ok()).toBe(true)
  }
}

/** Publishes a new current version of a document type; always retire in `finally`. */
async function publish(type: 'TERMS_ACCEPTANCE' | 'PRIVACY_DATA_PROCESSING') {
  const version = `qa-s03-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const kind = type === 'TERMS_ACCEPTANCE' ? 'terms' : 'privacy'
  const title = type === 'TERMS_ACCEPTANCE' ? 'Điều khoản sử dụng' : 'Chính sách quyền riêng tư'
  await query(
    `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
     VALUES ($1::consent_type, $2, $3, $4, now())`,
    [type, version, title, `/legal/${kind}/${version}`],
  )
  return {
    version,
    retire: () =>
      query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version]),
  }
}

const card = (page: Page, name: 'visibility' | 'legal' | 'history') =>
  page.locator(`[data-card="${name}"]`)
const toggle = (page: Page) => page.getByRole('switch', { name: 'Hiện thẻ của tôi trong Thư viện' })

async function openPrivacy(page: Page) {
  await page.goto('/me/privacy', { waitUntil: 'networkidle' })
  await expect(toggle(page)).toBeEnabled()
  await expect(card(page, 'history').locator('li, p').first()).toBeVisible()
}

async function profileState(m: Member) {
  const [row] = await query<{ status: string; completed: Date | null; level: string | null }>(
    `SELECT p.status::text AS status, p.onboarding_completed_at AS completed,
            COALESCE(v.group_overrides->>'PROFILE_DISCOVERY', v.default_level::text, 'NETWORK_ONLY') AS level
       FROM individual_profiles p LEFT JOIN profile_visibility_settings v ON v.profile_id = p.id
      WHERE p.id = $1`,
    [m.profileId],
  )
  return row!
}

const consentCount = async (m: Member) =>
  (
    await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM consent_records WHERE account_id = $1',
      [m.accountId],
    )
  )[0]!.n

test.describe('WF02-S03 guards', () => {
  test('12. guest: page → /auth; visibility and consent APIs 401', async ({ page, request }) => {
    await page.goto('/me/privacy')
    await expect(page).toHaveURL('/auth')
    for (const [method, url] of [
      ['GET', '/api/v1/me/visibility'],
      ['PUT', '/api/v1/me/visibility'],
      ['GET', '/api/v1/me/consents'],
      ['POST', '/api/v1/me/consents/accept'],
    ] as const) {
      const r = await request.fetch(url, { method, data: {} })
      expect(r.status(), `${method} ${url}`).toBe(401)
    }
  })

  test('an account that has not finished onboarding → its resolver step', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s03-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/me/privacy')
    await expect(page).toHaveURL('/onboarding')
  })
})

test.describe('WF02-S03 state matrix', () => {
  test('1. NETWORK_ONLY + current consents; only P0 controls are rendered', async ({ page }) => {
    await completedMember(page.request)
    await openPrivacy(page)
    await expect(page.locator('[aria-current="page"]')).toHaveText('Quyền riêng tư & hiển thị')
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'true')
    await expect(card(page, 'legal').locator('[data-accepted="true"]')).toHaveCount(2)
    await expect(page.locator('[data-reaccept]')).toHaveCount(0)
    await expect(card(page, 'history').locator('[data-history="CURRENT"]')).toHaveCount(2)
    // One switch only; no Future purposes, viewer log, export, preview or revoke.
    await expect(page.getByRole('switch')).toHaveCount(1)
    const text = await page.locator('main').innerText()
    for (const banned of [
      'Google',
      'quỹ',
      'tuyển dụng',
      'Ai đã xem',
      'Tải toàn bộ',
      'như người khác thấy',
      'Rút lại',
      'công khai',
      'public',
    ]) {
      expect(text, banned).not.toContain(banned)
    }
  })

  test('2/10/14. visibility update: PRIVATE persists, writes one audit, survives refresh', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await openPrivacy(page)
    const put = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/me/visibility') && r.request().method() === 'PUT',
    )
    await toggle(page).click()
    expect((await put).status()).toBe(200)
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'false')
    expect((await profileState(m)).level).toBe('PRIVATE')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'false')
    const audits = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'PROFILE_VISIBILITY_CHANGED'`,
      [m.accountId],
    )
    expect(audits[0]!.n).toBeGreaterThanOrEqual(1)
    // Visibility never touches consent.
    expect(await consentCount(m)).toBe(2)
    await toggle(page).click()
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'true')
    expect((await profileState(m)).level).toBe('NETWORK_ONLY')
  })

  test('3/7/8. stale Terms → re-acceptance creates only the missing record; profile untouched', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    const before = await profileState(m)
    const terms = await publish('TERMS_ACCEPTANCE')
    try {
      await openPrivacy(page)
      const legal = card(page, 'legal')
      await expect(
        legal.locator('[data-doc="TERMS_ACCEPTANCE"] [data-accepted="false"]'),
      ).toContainText(terms.version)
      await expect(
        legal.locator('[data-doc="PRIVACY_DATA_PROCESSING"] [data-accepted="true"]'),
      ).toBeVisible()
      await expect(page.locator('[data-reaccept]')).toContainText('Điều khoản sử dụng')
      await expect(page.locator('[data-reaccept]')).not.toContainText('Chính sách quyền riêng tư')

      // Without the acknowledgement nothing is sent.
      let posts = 0
      page.on('request', (r) => {
        if (r.url().endsWith('/api/v1/me/consents/accept')) posts++
      })
      await page.getByRole('button', { name: 'Đồng ý phiên bản mới' }).click()
      await expect(legal.getByRole('alert')).toContainText('Vui lòng đánh dấu đồng ý trước.')
      expect(posts).toBe(0)

      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Đồng ý phiên bản mới' }).click()
      await expect(page.locator('[data-reaccept]')).toHaveCount(0)
      expect(posts).toBe(1)
      await expect(legal.locator('[data-accepted="true"]')).toHaveCount(2)
      await expect(card(page, 'history').locator('[data-history="STALE"]')).toHaveCount(1)
      await expect(card(page, 'history').locator('[data-history="CURRENT"]')).toHaveCount(2)
      expect(await consentCount(m)).toBe(3)
      const after = await profileState(m)
      expect(after).toEqual(before)
      expect(after.status).toBe('ACTIVE')

      // 9. Repeat acceptance is idempotent: 200 and no new row.
      const again = await page.request.post('/api/v1/me/consents/accept', {
        data: { consent_type: 'TERMS_ACCEPTANCE', policy_version: terms.version },
      })
      expect(again.status()).toBe(200)
      expect(await consentCount(m)).toBe(3)
      const audits = await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'CONSENT_ACCEPTED'`,
        [m.accountId],
      )
      expect(audits[0]!.n).toBe(3)
      // Still completed: /me stays reachable, onboarding is not re-entered.
      await page.goto('/me')
      await expect(page).toHaveURL('/me')
    } finally {
      await terms.retire()
    }
  })

  test('4/5/6. stale Privacy, both stale, then Terms only accepted', async ({ page }) => {
    await completedMember(page.request)
    const privacy = await publish('PRIVACY_DATA_PROCESSING')
    try {
      await openPrivacy(page)
      await expect(page.locator('[data-reaccept]')).toContainText('Chính sách quyền riêng tư')
      await expect(page.locator('[data-reaccept]')).not.toContainText('Điều khoản sử dụng')
      const terms = await publish('TERMS_ACCEPTANCE')
      try {
        await page.reload({ waitUntil: 'networkidle' })
        await expect(card(page, 'legal').locator('[data-accepted="false"]')).toHaveCount(2)
        // Both due: one combined link (DEC-LEGAL-V1-D5).
        const links = page.locator('[data-reaccept] a')
        await expect(links).toHaveCount(1)
        await expect(links).toHaveText('Điều khoản sử dụng & Chính sách quyền riêng tư')
        await expect(links).toHaveAttribute('href', '/legal/terms')
        await acceptCurrent(page.request, 'TERMS_ACCEPTANCE')
        await page.reload({ waitUntil: 'networkidle' })
        await expect(card(page, 'legal').locator('[data-accepted="false"]')).toHaveCount(1)
        await expect(page.locator('[data-reaccept]')).toContainText('Chính sách quyền riêng tư')
      } finally {
        await terms.retire()
      }
    } finally {
      await privacy.retire()
    }
  })

  test('a version replaced while the page is open → 409 is shown as stale and reloaded', async ({
    page,
  }) => {
    await completedMember(page.request)
    const v2 = await publish('TERMS_ACCEPTANCE')
    let v3: Awaited<ReturnType<typeof publish>> | undefined
    try {
      await openPrivacy(page)
      await expect(page.locator('[data-reaccept]')).toBeVisible()
      v3 = await publish('TERMS_ACCEPTANCE')
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Đồng ý phiên bản mới' }).click()
      await expect(card(page, 'legal').getByRole('alert')).toContainText(
        'Văn bản vừa được cập nhật',
      )
      await expect(card(page, 'legal').locator('[data-accepted="false"]')).toContainText(v3.version)
    } finally {
      await v2.retire()
      await v3?.retire()
    }
  })

  test('16. API failures: visibility load/save and legal load fail independently, retry recovers', async ({
    page,
  }) => {
    await completedMember(page.request)
    const fail = (route: import('@playwright/test').Route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
      })
    await page.route('**/api/v1/me/consents', fail)
    await page.route('**/api/v1/me/visibility', (r) =>
      r.request().method() === 'GET' ? fail(r) : r.continue(),
    )
    await page.goto('/me/privacy', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="visibility-failed"]')).toBeVisible()
    await expect(page.locator('[data-state="legal-failed"]')).toBeVisible()
    await expect(page.locator('[data-state="history-failed"]')).toBeVisible()
    await page.unroute('**/api/v1/me/consents')
    await page.unroute('**/api/v1/me/visibility')
    await page.locator('[data-state="visibility-failed"]').getByRole('button').click()
    await page.locator('[data-state="legal-failed"]').getByRole('button').click()
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'true')
    await expect(card(page, 'history').locator('[data-history]')).toHaveCount(2)

    // A failed save keeps the server's state and says so.
    await page.route('**/api/v1/me/visibility', (r) =>
      r.request().method() === 'PUT' ? fail(r) : r.continue(),
    )
    await toggle(page).click()
    await expect(card(page, 'visibility').getByRole('alert')).toContainText('Chưa lưu được')
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('WF02-S03 security', () => {
  test('11. forged levels and groups are refused; foreign ids cannot redirect the write', async ({
    playwright,
    page,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's03-other')
    const self = await completedMember(page.request, 's03-self')
    for (const [group_code, level] of [
      ['PROFILE_DISCOVERY', 'PUBLIC'],
      ['PROFILE_DISCOVERY', 'PROGRAMME_ACCESS'],
      ['PROFILE_DISCOVERY', 'GRANTED_ACCESS'],
      ['CONTACT_EMAIL', 'PRIVATE'],
    ]) {
      const r = await page.request.put('/api/v1/me/visibility', {
        data: { groups: [{ group_code, level }] },
      })
      expect(r.status(), `${group_code}=${level}`).toBe(422)
      expect((await r.json()).error.code).toBe('VISIBILITY_VALIDATION_FAILED')
    }
    const forged = await page.request.put('/api/v1/me/visibility', {
      data: {
        profile_id: other.profileId,
        account_id: other.accountId,
        groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'PRIVATE' }],
      },
    })
    expect(forged.ok()).toBe(true)
    expect((await profileState(self)).level).toBe('PRIVATE')
    expect((await profileState(other)).level).toBe('NETWORK_ONLY')
    await otherCtx.dispose()
  })

  test('history belongs to the owner only; no other member or raw data on the page', async ({
    playwright,
    page,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's03-hist')
    const self = await completedMember(page.request, 's03-own')
    await page.goto(`/me/privacy?account_id=${other.accountId}`, { waitUntil: 'networkidle' })
    await expect(card(page, 'history').locator('[data-history]')).toHaveCount(2)
    const own = await (await page.request.get('/api/v1/me/consents')).json()
    expect(own.items.map((i: { id: string }) => i.id).sort()).toEqual(
      (
        await query<{ id: string }>('SELECT id::text FROM consent_records WHERE account_id = $1', [
          self.accountId,
        ])
      )
        .map((r) => r.id)
        .sort(),
    )
    const html = await page.content()
    for (const leak of [
      other.email,
      self.email,
      'legal_document_id',
      '"metadata"',
      'request_id":"',
      'ip_address',
      'user_agent',
    ]) {
      expect(html, leak).not.toContain(leak)
    }
    expect(Object.keys(own.items[0]).sort()).toEqual([
      'accepted_at',
      'id',
      'policy_version',
      'revoked_at',
      'status',
      'type',
    ])
    await otherCtx.dispose()
  })

  test('13. avatar follows effective discovery after an S03 change', async ({
    playwright,
    page,
    request,
  }) => {
    const owner = await completedMember(page.request, 's03-av')
    const upload = await page.request.post('/api/v1/me/profile/avatar', {
      multipart: { file: { name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 } },
    })
    const { url } = await upload.json()
    const viewerCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(viewerCtx, 's03-viewer')

    expect((await page.request.get(url)).status()).toBe(200)
    expect((await viewerCtx.get(url)).status()).toBe(200)
    expect((await request.get(url)).status()).toBe(404)

    await openPrivacy(page)
    await toggle(page).click()
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'false')
    expect((await profileState(owner)).level).toBe('PRIVATE')
    expect((await viewerCtx.get(url)).status()).toBe(404)
    expect((await page.request.get(url)).status()).toBe(200)
    expect((await request.get(url)).status()).toBe(404)
    await viewerCtx.dispose()
  })
})

test.describe('WF02-S03 pixel QA', () => {
  test('viewport against the approved reference (shell, header, discovery card)', async ({
    page,
  }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S03')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S03')!, {
      afterLoad: async (p) => {
        await expect(p.getByRole('switch')).toBeEnabled()
        await expect(p.locator('[data-card="history"] [data-history]')).toHaveCount(2)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.typography?.violations).toEqual([])

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const r of range.getClientRects())
          rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
      }
      for (const svg of document.querySelectorAll('header svg')) {
        const r = svg.getBoundingClientRect()
        rects.push({ x: r.x - 1, y: r.y - 1, width: r.width + 2, height: r.height + 2 })
      }
      return rects
    })
    const REF_TEXT: Rect[] = [
      { x: 60, y: 18, width: 400, height: 24 },
      { x: 1236, y: 18, width: 100, height: 24 },
      { x: 60, y: 88, width: 110, height: 18 },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      { x: 336, y: 90, width: 725, height: 70 }, // title + lede
      { x: 362, y: 200, width: 320, height: 72 }, // eyebrow, row title, row hint
    ]
    const BELL: Rect = { x: 1196, y: 16, width: 36, height: 28 }
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S03.segments.diff.png')
    const segments = [
      // Down to the first divider of the discovery card: rows 2-4 are Future.
      {
        name: 'shell+header+discovery',
        reference: { x: 0, y: 0, width: 1440, height: 296 },
        dy: 0,
      },
      { name: 'sidebar-rest', reference: { x: 0, y: 296, width: 330, height: 604 }, dy: 0 },
    ]
    const results = compareSegments(reference, actual, segments, [...textMask, ...REF_TEXT, BELL], {
      diffPath,
    })
    writeJsonReport('WF02-S03.segments.json', {
      screen_id: 'WF02-S03',
      state: qaConfigFor('WF02-S03')!.state,
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 340, y: 297, width: 1036, height: 291 },
          reason:
            'DEC-WF01-S07-D3 / DEC-WF02-H4: investor, challenge-owner and recruitment toggles and their footnote not rendered',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 340, y: 607, width: 1036, height: 324 },
          reason: 'DEC-WF02-H4: viewer history ("Ai đã xem hồ sơ của bạn") not rendered',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 340, y: 950, width: 1036, height: 119 },
          reason:
            'DEC-WF02-H3/H4: "Xem hồ sơ như người khác thấy" and "Tải toàn bộ dữ liệu" not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            "DEC-WF02-S03-D1: current-document and consent-history cards (H4 scope, no approved geometry) in the freed area, reusing this screen's card/row pattern; not compared",
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S03-D2: "Google tìm thấy được" and the revoke claim reworded; eyebrow "HIỂN THỊ HỒ SƠ" (visibility is not consent)',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: BELL,
          reason: 'DEC-WF02-H9/H10: bell counter omitted; SVG bell (ICON-RENDERING)',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'text glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
