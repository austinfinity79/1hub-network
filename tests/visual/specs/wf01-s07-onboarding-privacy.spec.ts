import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng, writeBuffer } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S07 — Privacy & Visibility (/onboarding/privacy). Production.
 * Decisions DEC-WF01-S07-D1..D8 (docs/decisions/DECISION_LOG.md).
 *
 * Legal versions are read from the database in every assertion, never
 * written as literals, so the tests hold when release configuration changes.
 */

const VIS_API = '/api/v1/me/visibility'
const ACCEPT_API = '/api/v1/me/consents/accept'
const TYPES = ['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'] as const
const FIXTURE = path.join(REPO_ROOT, 'tests/visual/fixtures/wf01-s06-qa-vocabulary.sql')

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await query(readFileSync(FIXTURE, 'utf8'))
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 409/422/500 answers are the scenario under test.
    if (m.type() === 'error' && !/status of (409|422|500)/.test(m.text()))
      consoleErrors.push(m.text())
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

async function signInFresh(request: APIRequestContext): Promise<string> {
  const email = `s07-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const response = await request.post('/dev/login', { data: { email } })
  expect(response.ok()).toBe(true)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return row!.id
}

/** A second, unrelated signed-in member in its own browser context. */
async function otherMember(browser: Browser) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  await signInFresh(context.request)
  return context
}

type Current = { id: string; type: string; version: string; content_uri: string }

async function currentDocs(): Promise<Current[]> {
  return query<Current>(
    `SELECT DISTINCT ON (document_type) id::text, document_type::text AS type, version, content_uri
       FROM legal_documents WHERE effective_at <= now() AND retired_at IS NULL
      ORDER BY document_type, effective_at DESC, created_at DESC`,
  )
}

async function consents(accountId: string) {
  return query<{ type: string; version: string }>(
    `SELECT c.consent_type::text AS type, d.version
       FROM consent_records c JOIN legal_documents d ON d.id = c.legal_document_id
      WHERE c.account_id = $1 ORDER BY 1, 2`,
    [accountId],
  )
}

async function audits(accountId: string, action: string) {
  return query<{
    resource_type: string
    before_data: unknown
    after_data: unknown
    request_id: string | null
  }>(
    `SELECT resource_type, before_data, after_data, request_id FROM audit_events
      WHERE actor_account_id = $1 AND action = $2 ORDER BY created_at`,
    [accountId, action],
  )
}

/** Publishes a new current Terms version for a race test; retire it in `finally`. */
async function publishTermsV2(): Promise<{ version: string; retire: () => Promise<void> }> {
  const version = `qa-s07-${Date.now()}`
  await query(
    `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
     VALUES ('TERMS_ACCEPTANCE', $1, 'Điều khoản sử dụng', $2, now())`,
    [version, `/legal/terms/${version}`],
  )
  return {
    version,
    retire: async () => {
      await query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version])
    },
  }
}

async function openPrivacy(page: Page) {
  await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ai được thấy gì')
}

const discoverySwitch = (page: Page) =>
  page.getByRole('switch', { name: 'Hiện thẻ của tôi trong Thư viện' })
const legalBox = (page: Page) => page.getByRole('checkbox')
const cta = (page: Page) => page.getByRole('button', { name: 'Xong, vào HUB' })

/** A 1x1 PNG, generated so no binary lives in the repo. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('WF01-S07 functional and security', () => {
  test('a guest is sent to /auth and every S07 API refuses', async ({ page, request }) => {
    await page.goto('/onboarding/privacy')
    await expect(page).toHaveURL('/auth')
    for (const [method, url] of [
      ['GET', '/api/v1/me/consents'],
      ['GET', VIS_API],
      ['PUT', VIS_API],
      ['POST', ACCEPT_API],
    ] as const) {
      const response = await request.fetch(url, { method, data: {} })
      expect(response.status(), `${method} ${url}`).toBe(401)
    }
  })

  test('current legal documents come from the server, with working content links', async ({
    page,
  }) => {
    await signInFresh(page.request)
    const body = await (await page.request.get('/api/v1/legal/current')).json()
    const docs = await currentDocs()
    expect(body.documents.map((d: { type: string }) => d.type)).toEqual([...TYPES])
    for (const doc of body.documents) {
      const row = docs.find((d) => d.type === doc.type)!
      expect(doc).toEqual({
        type: row.type,
        version: row.version,
        title: expect.any(String),
        required: true,
        content_url: row.content_uri,
      })
    }
    await openPrivacy(page)
    for (const doc of body.documents) {
      await expect(page.getByRole('link', { name: doc.title })).toHaveAttribute(
        'href',
        doc.content_url,
      )
      const content = await page.request.get(doc.content_url)
      expect(content.status()).toBe(200)
      // Local content is the marked non-production fixture, never legal prose.
      expect(await content.text()).toContain('KHÔNG PHẢI VĂN BẢN PHÁP LÝ')
    }
    expect((await page.request.get('/legal/terms/no-such-version')).status()).toBe(404)
  })

  test('D1: one acknowledgement creates two canonical records; S07 does not complete onboarding', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await openPrivacy(page)
    await legalBox(page).check()
    await cta(page).click()
    await expect(page).toHaveURL('/onboarding/complete')
    const docs = await currentDocs()
    expect(await consents(accountId)).toEqual(
      [...TYPES]
        .sort()
        .map((type) => ({ type, version: docs.find((d) => d.type === type)!.version })),
    )
    const [profile] = await query<{ status: string; completed: Date | null }>(
      `SELECT status::text, onboarding_completed_at AS completed
         FROM individual_profiles WHERE account_id = $1`,
      [accountId],
    )
    expect(profile).toEqual({ status: 'DRAFT', completed: null })
  })

  test('D1: without the acknowledgement nothing is accepted and S07 stays', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    let accepts = 0
    page.on('request', (r) => {
      if (r.url().endsWith(ACCEPT_API)) accepts++
    })
    await openPrivacy(page)
    await cta(page).click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Vui lòng đồng ý với các văn bản bên dưới để tiếp tục.',
    )
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(accepts).toBe(0)
    expect(await consents(accountId)).toEqual([])
  })

  test('repeated submits accept each document once', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    await openPrivacy(page)
    await legalBox(page).check()
    let accepts = 0
    await page.route(`**${ACCEPT_API}`, async (route) => {
      accepts++
      await new Promise((done) => setTimeout(done, 300))
      await route.continue()
    })
    await page.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
      form.requestSubmit()
      form.requestSubmit()
    })
    await expect(page).toHaveURL('/onboarding/complete')
    expect(accepts).toBe(2)
    expect(await consents(accountId)).toHaveLength(2)
  })

  test('accept is idempotent and duplicate-safe; replays keep one record', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    const terms = (await currentDocs()).find((d) => d.type === 'TERMS_ACCEPTANCE')!
    const data = { consent_type: 'TERMS_ACCEPTANCE', policy_version: terms.version }
    const first = await page.request.post(ACCEPT_API, {
      data,
      headers: { 'Idempotency-Key': 'k-1' },
    })
    expect(first.status()).toBe(201)
    const replay = await page.request.post(ACCEPT_API, {
      data,
      headers: { 'Idempotency-Key': 'k-1' },
    })
    expect(replay.status()).toBe(201)
    const again = await page.request.post(ACCEPT_API, {
      data,
      headers: { 'Idempotency-Key': 'k-2' },
    })
    expect(again.status()).toBe(200)
    const ids = [first, replay, again].map(async (r) => (await r.json()).id)
    expect(new Set(await Promise.all(ids)).size).toBe(1)
    expect(await consents(accountId)).toHaveLength(1)
    // One audit event for the one record, with no personal data.
    const events = await audits(accountId, 'CONSENT_ACCEPTED')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      resource_type: 'consent_record',
      after_data: { consent_type: 'TERMS_ACCEPTANCE', policy_version: terms.version },
      request_id: expect.any(String),
    })
  })

  test('D8: a stale or unknown version is refused with 409', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    for (const version of ['old-version', '', null]) {
      const response = await page.request.post(ACCEPT_API, {
        data: { consent_type: 'PRIVACY_DATA_PROCESSING', policy_version: version },
      })
      expect(response.status()).toBe(409)
      expect((await response.json()).error.code).toBe('LEGAL_DOCUMENT_VERSION_STALE')
    }
    const unknown = await page.request.post(ACCEPT_API, {
      data: { consent_type: 'MARKETING', policy_version: 'x' },
    })
    expect(unknown.status()).toBe(404)
    expect(await consents(accountId)).toEqual([])
  })

  test('race A: Terms accepted, Privacy fails, retry completes without duplicating Terms', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await openPrivacy(page)
    await page.route(`**${ACCEPT_API}`, (route) =>
      route.request().postDataJSON().consent_type === 'PRIVACY_DATA_PROCESSING'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
          })
        : route.continue(),
    )
    await legalBox(page).check()
    await cta(page).click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Chưa lưu được lựa chọn. Vui lòng thử lại.',
    )
    await expect(page).toHaveURL('/onboarding/privacy')
    expect((await consents(accountId)).map((c) => c.type)).toEqual(['TERMS_ACCEPTANCE'])

    await page.unroute(`**${ACCEPT_API}`)
    await cta(page).click()
    await expect(page).toHaveURL('/onboarding/complete')
    expect((await consents(accountId)).map((c) => c.type)).toEqual([...TYPES].sort())
    expect(await audits(accountId, 'CONSENT_ACCEPTED')).toHaveLength(2)
  })

  test('race B: the version changes while S07 is open; V1 refused, docs reload, V2 required', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await openPrivacy(page)
    const v1Link = await page.getByRole('link', { name: 'Điều khoản sử dụng' }).getAttribute('href')
    const v2 = await publishTermsV2()
    try {
      await legalBox(page).check()
      await cta(page).click()
      await expect(page.locator('form').getByRole('alert')).toHaveText(
        'Văn bản vừa được cập nhật. Vui lòng xem lại và đồng ý với phiên bản mới.',
      )
      await expect(page.getByRole('link', { name: 'Điều khoản sử dụng' })).toHaveAttribute(
        'href',
        `/legal/terms/${v2.version}`,
      )
      expect(v1Link).not.toBe(`/legal/terms/${v2.version}`)
      await expect(legalBox(page)).not.toBeChecked()
      expect(await consents(accountId)).toEqual([])

      await legalBox(page).check()
      await cta(page).click()
      await expect(page).toHaveURL('/onboarding/complete')
      const rows = await consents(accountId)
      expect(rows.find((r) => r.type === 'TERMS_ACCEPTANCE')!.version).toBe(v2.version)
      expect(rows).toHaveLength(2)
    } finally {
      await v2.retire()
    }
  })

  test('race C / revisit: both current acceptances exist; satisfied state, nothing re-sent', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    for (const doc of await currentDocs()) {
      const response = await page.request.post(ACCEPT_API, {
        data: { consent_type: doc.type, policy_version: doc.version },
      })
      expect(response.status()).toBe(201)
    }
    let accepts = 0
    page.on('request', (r) => {
      if (r.url().endsWith(ACCEPT_API)) accepts++
    })
    await openPrivacy(page)
    await expect(legalBox(page)).toBeChecked()
    await expect(legalBox(page)).toBeDisabled()
    await cta(page).click()
    await expect(page).toHaveURL('/onboarding/complete')
    expect(accepts).toBe(0)
    expect(await consents(accountId)).toHaveLength(2)
  })

  test('D4: PROFILE_DISCOVERY defaults to NETWORK_ONLY, shown ON', async ({ page }) => {
    await signInFresh(page.request)
    expect(await (await page.request.get(VIS_API)).json()).toEqual({
      groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }],
    })
    await openPrivacy(page)
    await expect(discoverySwitch(page)).toHaveAttribute('aria-checked', 'true')
  })

  test('D2/D4: OFF persists PRIVATE as an override; ON again removes it; changes audited', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await openPrivacy(page)
    await discoverySwitch(page).click()
    await expect(discoverySwitch(page)).toHaveAttribute('aria-checked', 'false')
    await legalBox(page).check()
    await cta(page).click()
    await expect(page).toHaveURL('/onboarding/complete')
    const stored = async () =>
      (
        await query<{ default_level: string; group_overrides: unknown }>(
          `SELECT v.default_level::text, v.group_overrides FROM profile_visibility_settings v
             JOIN individual_profiles p ON p.id = v.profile_id WHERE p.account_id = $1`,
          [accountId],
        )
      )[0]
    expect(await stored()).toEqual({
      default_level: 'NETWORK_ONLY',
      group_overrides: { PROFILE_DISCOVERY: 'PRIVATE' },
    })
    await page.request.put(VIS_API, {
      data: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }] },
    })
    expect(await stored()).toEqual({ default_level: 'NETWORK_ONLY', group_overrides: {} })
    // A no-op PUT writes no event.
    await page.request.put(VIS_API, {
      data: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }] },
    })
    const events = await audits(accountId, 'PROFILE_VISIBILITY_CHANGED')
    expect(events.map((e) => [e.before_data, e.after_data])).toEqual([
      [{ PROFILE_DISCOVERY: 'NETWORK_ONLY' }, { PROFILE_DISCOVERY: 'PRIVATE' }],
      [{ PROFILE_DISCOVERY: 'PRIVATE' }, { PROFILE_DISCOVERY: 'NETWORK_ONLY' }],
    ])
    expect(events.every((e) => e.resource_type === 'individual_profile' && e.request_id)).toBe(true)
  })

  test('D8: unknown groups and unsupported levels are refused with 422', async ({ page }) => {
    await signInFresh(page.request)
    for (const groups of [
      [{ group_code: 'BASIC_PUBLIC', level: 'NETWORK_ONLY' }],
      [{ group_code: 'INVESTOR_CONTACT', level: 'NETWORK_ONLY' }],
      [{ group_code: 'RECRUITMENT', level: 'PRIVATE' }],
      [{ group_code: 'PROFILE_DISCOVERY', level: 'PUBLIC' }],
      [{ group_code: 'PROFILE_DISCOVERY', level: 'PROGRAMME_ACCESS' }],
      [{ group_code: 'PROFILE_DISCOVERY', level: 'GRANTED_ACCESS' }],
      [{ group_code: 'PROFILE_DISCOVERY', level: 'network_only' }],
      [{ group_code: 'PROFILE_DISCOVERY' }],
      [],
    ]) {
      const response = await page.request.put(VIS_API, { data: { groups } })
      expect(response.status(), JSON.stringify(groups)).toBe(422)
      expect((await response.json()).error.code).toBe('VISIBILITY_VALIDATION_FAILED')
    }
    expect((await (await page.request.get(VIS_API)).json()).groups[0].level).toBe('NETWORK_ONLY')
  })

  test("a member cannot change another profile's visibility", async ({ page, browser }) => {
    await signInFresh(page.request)
    const other = await otherMember(browser)
    const [victim] = await query<{ id: string }>(
      `SELECT p.id::text FROM individual_profiles p
         JOIN user_accounts a ON a.id = p.account_id
        WHERE a.email_normalized = 'member@example.test'`,
    )
    const response = await other.request.put(VIS_API, {
      data: {
        profile_id: victim!.id,
        groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'PRIVATE' }],
      },
    })
    // Only the caller's own profile can ever be addressed.
    expect(response.status()).toBe(200)
    const [row] = await query<{ group_overrides: unknown }>(
      'SELECT group_overrides FROM profile_visibility_settings WHERE profile_id = $1',
      [victim!.id],
    )
    expect(row!.group_overrides).toEqual({})
    await other.close()
  })

  test('DTOs carry no contact data and no raw consent metadata', async ({ page }) => {
    await signInFresh(page.request)
    const doc = (await currentDocs())[0]!
    const created = await (
      await page.request.post(ACCEPT_API, {
        data: { consent_type: doc.type, policy_version: doc.version },
      })
    ).json()
    expect(Object.keys(created).sort()).toEqual(
      ['accepted_at', 'id', 'policy_version', 'revoked_at', 'status', 'type'].sort(),
    )
    const list = await (await page.request.get('/api/v1/me/consents')).json()
    for (const item of list.items) {
      expect(Object.keys(item).sort()).toEqual(Object.keys(created).sort())
    }
    const bodies = [
      JSON.stringify(created),
      JSON.stringify(list),
      JSON.stringify(await (await page.request.get(VIS_API)).json()),
      JSON.stringify(await (await page.request.get('/api/v1/legal/current')).json()),
    ].join('\n')
    expect(bodies).not.toMatch(/@example\.test|metadata|legal_document_id|account_id|email/)
  })

  test('D5: avatar visibility is enforced at the media boundary', async ({ page, browser }) => {
    await signInFresh(page.request)
    const upload = await page.request.post('/api/v1/me/profile/avatar', {
      multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 } },
    })
    expect(upload.status()).toBe(200)
    const { url } = await upload.json()
    const other = await otherMember(browser)
    const guest = await browser.newContext({ baseURL: test.info().project.use.baseURL })

    expect((await page.request.get(url)).status(), 'owner').toBe(200)
    expect((await other.request.get(url)).status(), 'member, NETWORK_ONLY').toBe(200)
    expect((await guest.request.get(url)).status(), 'guest').toBe(404)

    await page.request.put(VIS_API, {
      data: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'PRIVATE' }] },
    })
    expect((await page.request.get(url)).status(), 'owner, PRIVATE').toBe(200)
    expect((await other.request.get(url)).status(), 'member, PRIVATE').toBe(404)
    expect((await guest.request.get(url)).status(), 'guest, PRIVATE').toBe(404)
    await other.close()
    await guest.close()
  })

  test('D3/D6: no skip and no Future purpose control or mutation', async ({ page }) => {
    await signInFresh(page.request)
    await openPrivacy(page)
    await expect(page.getByText('Bỏ qua, làm sau')).toHaveCount(0)
    // Only the P0-SHELL wordmark → / link (DEC-P0-SHELL-D1); no skip or step link.
    await expect(page.locator('header').getByRole('link')).toHaveCount(1)
    await expect(page.locator('header [data-nav="home"]')).toHaveAttribute('href', '/')
    await expect(page.getByRole('switch')).toHaveCount(1)
    const text = (await page.locator('main').innerText()).toLowerCase()
    for (const future of ['quỹ đầu tư', 'đặt bài toán liên hệ', 'tuyển dụng', 'google']) {
      expect(text, future).not.toContain(future)
    }
  })

  test('D7: the lede emphasises "mục đích" without Markdown asterisks', async ({ page }) => {
    await signInFresh(page.request)
    await openPrivacy(page)
    await expect(page.locator('p strong')).toHaveText('mục đích')
    expect(await page.locator('main').innerText()).not.toContain('**')
  })

  test('keyboard and a11y: switch, acknowledgement, links, CTA', async ({ page }) => {
    await signInFresh(page.request)
    await openPrivacy(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    // P0-SHELL (DEC-P0-SHELL-D1): the wordmark → / is the first Tab stop.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="home"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(discoverySwitch(page)).toBeFocused()
    expect(
      await discoverySwitch(page).evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none')
    await page.keyboard.press('Space')
    await expect(discoverySwitch(page)).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Space')
    await expect(discoverySwitch(page)).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Tab')
    await expect(legalBox(page)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(legalBox(page)).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Điều khoản sử dụng' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Chính sách quyền riêng tư' })).toBeFocused()
    await cta(page).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/onboarding/complete')
  })

  test('key text colours match the approved inks', async ({ page }) => {
    await signInFresh(page.request)
    await openPrivacy(page)
    const colours = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const rgb = (el: Element | null) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = getComputedStyle(el!).color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const text = (t: string) =>
        [...document.querySelectorAll('p')].find((p) => p.textContent!.startsWith(t)) ?? null
      return {
        title: rgb(document.querySelector('h1')),
        lede: rgb(document.querySelector('h1 + p')),
        option: rgb(document.getElementById('discovery-title')),
        hint: rgb(document.getElementById('discovery-hint')),
        warning: rgb(text('Tắt thì')),
        progress: rgb(text('Bước 3 trong 3')),
        cta: rgb(document.querySelector('button[type="submit"]')),
      }
    })
    // Inks read from the approved WF01-S07 bitmap; +-3 per channel for raster rounding.
    const APPROVED: Record<keyof typeof colours, [number, number, number]> = {
      title: [0x17, 0x00, 0x02],
      lede: [0x53, 0x40, 0x41],
      option: [0x17, 0x00, 0x02],
      hint: [0x53, 0x40, 0x41],
      warning: [0xb9, 0x16, 0x10],
      progress: [0x53, 0x40, 0x41],
      cta: [0x16, 0x00, 0x02],
    }
    for (const key of Object.keys(APPROVED) as (keyof typeof colours)[]) {
      colours[key].forEach((channel, i) => {
        expect(Math.abs(channel - APPROVED[key][i]!), `${key} channel ${i}`).toBeLessThanOrEqual(3)
      })
    }
  })
})

test.describe('WF01-S07 pixel QA', () => {
  /**
   * Measured once from the frozen reference. The baseline is a scrolled
   * viewport with the card over the header band (card top y=30); the runtime
   * card sits under the header, so card regions are compared on a full-page
   * capture at their own offsets. Reference y 300-620 (investor,
   * challenge-owner and recruitment toggles) is INTENTIONAL-P0-SCOPE, and the
   * runtime legal acknowledgement in its place is INTENTIONAL-LEGAL-REQUIREMENT.
   */
  const REF = {
    cardTop: 30,
    previewTop: 630,
    skip: { x: 1290, y: 0, width: 150, height: 62 },
    removed: { x: 340, y: 300, width: 760, height: 320 },
    /** Baseline copy omitted by D2 because it would misstate visibility. */
    omittedCopy: {
      google: { x: 640, y: 228, width: 200, height: 18 },
      guests: { x: 550, y: 646, width: 262, height: 18 },
    },
  } as const

  test('manifest-driven capture, typography contract and segment comparison', async ({ page }) => {
    const { screens } = loadManifest()
    const reports = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S07'),
      qaConfigFor('WF01-S07')!,
      {
        beforeNavigate: async (p) => {
          // Reference example state; values are fixture content, not business data.
          const profile = await p.request.patch('/api/v1/me/profile', {
            data: {
              display_name: 'Đặng Kim Chi',
              headline: 'Đồng sáng lập · CEO tại Tracely',
              region_id: '20000000-0000-0000-0000-000000000002',
              domain_ids: [
                'e6000000-0000-0000-0000-000000000001',
                'e6000000-0000-0000-0000-000000000002',
              ],
              skill_ids: [],
            },
          })
          expect(profile.status()).toBe(200)
          const vis = await p.request.put(VIS_API, {
            data: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }] },
          })
          expect(vis.status()).toBe(200)
        },
        afterLoad: async (p) => {
          await expect(discoverySwitch(p)).toHaveAttribute('aria-checked', 'true')
        },
      },
    )
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.conditions).toEqual({
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      fonts: 'loaded',
    })
    expect(viewport.typography!.violations).toEqual([])

    const fullBuffer = await page.screenshot({ fullPage: true, animations: 'disabled' })
    const fullPath = resolveOutputPath('actual', 'WF01-S07.full_page.png')
    writeBuffer(fullPath, fullBuffer)
    const actual = decodePng(fullBuffer)

    const card = (await page.locator('[data-ui="surface"]').boundingBox())!
    const preview = (await page.locator('[data-preview]').boundingBox())!
    const upperDy = Math.round(card.y) - REF.cardTop
    const lowerDy = Math.round(preview.y) - REF.previewTop

    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const add = (r: DOMRect, pad = 2) =>
        rects.push({
          x: r.x - pad,
          y: r.y - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        })
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (!node.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of range.getClientRects()) add(r)
      }
      for (const svg of document.querySelectorAll('svg')) add(svg.getBoundingClientRect(), 1)
      // Preview chips: their width follows the label in the frozen font.
      for (const li of document.querySelectorAll('[data-preview] li')) {
        const r = li.getBoundingClientRect()
        add(new DOMRect(r.x + 10, r.y, r.width - 10, r.height), 1)
      }
      return rects
    })

    // RASTER-NOISE: baseline boxes sit on half pixels (smeared 1px horizontal
    // edges); only those edge rows leave the count, the boxes are asserted instead.
    const rasterRows: Rect[] = []
    const geometry = []
    for (const [name, selector, refTop, refHeight, dy] of [
      ['discovery option', 'form > div:has(> [role="switch"])', 182, 110, upperDy],
      ['preview card', '[data-preview] > div', 675, 107, lowerDy],
      ['back button', 'a.ui-button', 848, 47, lowerDy],
      ['cta', 'button[type="submit"]', 848, 47, lowerDy],
    ] as const) {
      const box = (await page.locator(selector).first().boundingBox())!
      geometry.push({ name, actual_top: Math.round(box.y), expected_top: refTop + dy })
      expect(Math.abs(Math.round(box.y) - (refTop + dy)), `${name} top`).toBeLessThanOrEqual(1)
      expect(Math.abs(Math.round(box.height) - refHeight), `${name} height`).toBeLessThanOrEqual(2)
      for (const y of [box.y - 2, box.y + box.height - 2]) {
        rasterRows.push({ x: box.x, y: Math.round(y), width: box.width, height: 4 })
      }
    }
    const omitted: Rect[] = [
      { ...REF.omittedCopy.google, y: REF.omittedCopy.google.y + upperDy },
      { ...REF.omittedCopy.guests, y: REF.omittedCopy.guests.y + lowerDy },
    ]

    const segments: Segment[] = [
      { name: 'header-left', reference: { x: 0, y: 0, width: 300, height: 64 }, dy: 0 },
      { name: 'header-right', reference: { x: 1140, y: 0, width: 150, height: 64 }, dy: 0 },
      { name: 'canvas-left', reference: { x: 0, y: 64, width: 300, height: 836 }, dy: 0 },
      { name: 'canvas-right', reference: { x: 1140, y: 64, width: 300, height: 836 }, dy: 0 },
      {
        name: 'card-upper',
        reference: { x: 340, y: REF.cardTop, width: 760, height: REF.removed.y - REF.cardTop },
        dy: upperDy,
      },
      {
        name: 'card-lower',
        reference: { x: 340, y: 620, width: 760, height: 280 },
        dy: lowerDy,
      },
    ]

    const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
    const diffPath = resolveOutputPath('diff', 'WF01-S07.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      segments,
      [...textMask, ...rasterRows, ...omitted],
      {
        diffPath,
      },
    )

    writeJsonReport('WF01-S07.segments.json', {
      screen_id: 'WF01-S07',
      state: 'reference example profile, discovery ON, acknowledgement unchecked',
      images: {
        REFERENCE: viewport.images.REFERENCE,
        ACTUAL: viewport.images.ACTUAL,
        ACTUAL_FULL_PAGE: path.relative(REPO_ROOT, fullPath),
        DIFF_FULL: viewport.images.DIFF,
        DIFF_SEGMENTS: path.relative(REPO_ROOT, diffPath),
      },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: REF.removed,
          reason: 'DEC-WF01-S07-D3: investor, challenge-owner and recruitment toggles not rendered',
        },
        {
          class: 'INTENTIONAL-LEGAL-REQUIREMENT',
          reason:
            'DEC-WF01-S07-D1: required acknowledgement with links to the current documents, in place of the removed toggles; D6: skip omitted',
          reference_region: REF.skip,
        },
        {
          class: 'INTENTIONAL-LEGAL-REQUIREMENT',
          reason:
            'DEC-WF01-S07-D2: copy that would misstate visibility omitted ("Thẻ này Google tìm thấy được", "người chưa đăng nhập thấy đúng ngần này"); those text regions only',
          reference_regions: REF.omittedCopy,
        },
        {
          class: 'INTENTIONAL-COMPOSITION',
          reason:
            'baseline is a scrolled viewport with the card over the header band (stepper hidden under it); card compared on a full-page capture; stepper not compared',
          vertical_effect_px: { card_upper_dy: upperDy, card_lower_dy: lowerDy },
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason:
            'text glyphs masked, checked by the DOM typography contract; D7 renders the lede emphasis as bold',
        },
        { class: 'RASTER-NOISE', rows: rasterRows, geometry },
      ],
      segments: results,
      text_mask: textMask,
      product_pixel_pass_claimed: false,
    })

    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
