import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { closePool, query } from '../../../src/lib/db/client'
import {
  addVisibleFounder,
  clearLibraryFixture,
  FX_EXCLUDED,
  FX_LISTED,
  FX_OWNERS,
  FX_PRIVATE,
  LIBRARY_FX,
  seedLibraryFixture,
  type LibraryFixture,
} from '../../../src/lib/library/testing'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * WF06-PROD-05 — functional / security / quality QA of the frozen WF06 minimal
 * P0 (API §25, DEC-W6P) on the built server: happy paths, guest / member
 * privacy, data exclusion (including a real application answer), direct-id and
 * query bypass, filters, sort, pagination, organization visibility, the
 * session transition, data quality, query abuse and a keyboard smoke. Every
 * case is recorded in `WF06-PROD-05.qa-matrix.json`. Two cases need a server
 * started with a crafted or unreachable feed and run only when asked
 * (`WF06_QA_FEED=crafted`; the feed-down case is in wf06-prod-library).
 */

const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const APP_SECRET = `WF06-APP-SECRET-${Date.now().toString(36)}`
const LONG_NAME = `WF06 Dài ${'Đổi mới sáng tạo vùng 🚀 '.repeat(6)}`.trim()
const TWINS = ['WF06 Song Sinh', 'WF06 Song Sinh']

let fx: LibraryFixture
let member = ''
let appAnswers: string[] = []
const matrix: Array<{ section: string; case: string; result: string }> = []
let consoleErrors: string[] = []
let serverErrors: string[] = []

const record = (section: string, name: string, result: unknown) =>
  matrix.push({
    section,
    case: name,
    result: typeof result === 'string' ? result : JSON.stringify(result),
  })

test.beforeAll(async () => {
  fx = await seedLibraryFixture()
  await addVisibleFounder('Minh')
  member = (await createSession(fx.accounts.stranger)).token
  // Data quality: a long Unicode title without stage, region or domain; two same-name twins.
  const rows: Array<[string, string, string | null]> = [
    [LONG_NAME, 'wf06-fx-qa-long', null],
    [TWINS[0]!, 'wf06-fx-qa-twin-1', LIBRARY_FX.stage.PILOT],
    [TWINS[1]!, 'wf06-fx-qa-twin-2', LIBRARY_FX.stage.PILOT],
  ]
  for (const [name, slug, stage] of rows) {
    await query(
      `INSERT INTO projects (type, owner_profile_id, slug, name, summary, status, visibility, stage_id)
       VALUES ('STARTUP', $1, $2, $3, 'Fixture WF06 QA', 'ACTIVE', 'PUBLIC', $4)`,
      [fx.owners.lan, slug, name, stage],
    )
  }
  // A listed venture with an application whose answer must never surface.
  await query(
    `INSERT INTO applications (programme_id, venture_id, primary_applicant_type, answers, question_set_version, created_by_account_id)
     VALUES ($1, $2, 'STARTUP', $3::jsonb, 1, $4)`,
    [
      PROGRAMME,
      fx.ventures['WF06 An Khang'],
      JSON.stringify([{ question_id: 'q1', value: APP_SECRET }]),
      fx.accounts.lan,
    ],
  )
  const answers = await query<{ value: string }>(
    `SELECT DISTINCT a->>'value' AS value FROM applications, jsonb_array_elements(answers) a
      WHERE length(a->>'value') >= 12`,
  )
  appAnswers = answers.map((a) => a.value)
})

test.afterAll(async () => {
  writeJsonReport('WF06-PROD-05.qa-matrix.json', { cases: matrix.length, matrix })
  await query(
    `DELETE FROM applications WHERE venture_id IN (SELECT id FROM projects WHERE slug LIKE 'wf06-fx-%')`,
  )
  await clearLibraryFixture()
  await closePool()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  serverErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => {
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`)
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'console errors').toEqual([])
  expect(serverErrors, 'unexpected 5xx').toEqual([])
})

const asMember = (page: Page, baseURL: string | undefined) =>
  page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: member, url: baseURL! }])
const cookie = () => ({ cookie: `${SESSION_COOKIE_NAME}=${member}` })
const cards = (page: Page) => page.locator('[data-anchor="grid"] > li')
const count = (page: Page) => page.locator('[data-section="directory"] [aria-live="polite"]')
const settled = (page: Page) =>
  expect(page.locator('[data-section="directory"]')).not.toHaveAttribute('data-state', 'loading')
async function searchFor(page: Page, q: string) {
  const form = page.getByRole('search', { name: 'Tìm trong thư viện' })
  await form.getByRole('searchbox').fill(q)
  await form.getByRole('button', { name: 'Tìm kiếm' }).click()
}
async function api(request: APIRequestContext, path: string, headers: Record<string, string> = {}) {
  const r = await request.get(path, { headers })
  const text = await r.text()
  let body: { items?: Array<Record<string, unknown>>; [k: string]: unknown } = {}
  try {
    body = JSON.parse(text)
  } catch {
    body = {}
  }
  return { status: r.status(), text, body }
}
const keysOf = (a: { body: { items?: Array<Record<string, unknown>> } }) =>
  (a.body.items ?? []).map((i) => i.key as string)
const namesOf = (a: { body: { items?: Array<Record<string, unknown>> } }) =>
  (a.body.items ?? []).map((i) => (i.name ?? i.display_name ?? i.title) as string)

const LISTED = FX_LISTED.length + 1 + 3 // + Minh's startup, the long title and the twins

test.describe('WF06-PROD-05 QA', () => {
  test('4 · happy path: organization page, three tabs, canonical and external items, filters, pages', async ({
    page,
    request,
  }) => {
    const org = await page.goto('/organizations/chapter-01')
    expect(org!.status()).toBe(200)
    await expect(page.locator('[data-stat="children"]')).toBeVisible()
    record('4', 'organization page chapter-01', 200)

    const problems = await api(request, '/api/v1/library/problems?limit=50')
    expect(problems.status).toBe(200)
    expect(problems.body.total).toBe(47)
    const startups = await api(request, '/api/v1/library/startups?limit=50')
    const external = (startups.body.items ?? []).filter((i) => i.website !== null).length
    record('4', 'startups total / degraded / external with website', {
      total: startups.body.total,
      degraded: startups.body.degraded,
      external,
    })
    if (!startups.body.degraded) expect(external).toBeGreaterThan(0)

    await page.goto('/library?q=WF06')
    await page.getByRole('tab', { name: /^Startup/ }).click()
    await expect(count(page)).toHaveText(`${LISTED} startup`)
    await page.getByRole('button', { name: `Xem thêm ${LISTED - 9} startup` }).click()
    await expect(cards(page)).toHaveCount(LISTED)
    await page
      .getByRole('complementary', { name: 'Bộ lọc' })
      .getByRole('checkbox', { name: /^Pilot/ })
      .check()
    await expect(count(page)).toHaveText('4 startup') // Cầu Nối, Ngân Hà and the twins
    record('4', 'Library canonical list, page 2, stage filter', 'pass')
  })

  test('5 · 6 · guest / member privacy and private-data exclusion (API payloads and pages)', async ({
    page,
    request,
    baseURL,
  }) => {
    const forbidden = [
      ...Object.values(fx.ventures),
      ...Object.values(fx.owners),
      ...Object.values(fx.accounts),
      ...Object.values(FX_PRIVATE),
      ...FX_EXCLUDED.map((v) => v.name),
      ...(['hidden', 'deactivated', 'blocked', 'privateOnly'] as const).map(
        (k) => FX_OWNERS[k].displayName!,
      ),
      APP_SECRET,
      ...appAnswers,
      'wf06-fx-',
      '@example.test',
      'startup.1hub',
    ]
    const keys =
      /"(owner\w*|account\w*|profile_id|venture_id|slug|metadata|answers?|application\w*|snapshot|challenge\w*|full_name|phone|email|headline|bio|thanh_vien|ho_ten|vai_tro)"/
    const paths = [
      '/api/v1/library/startups?limit=50',
      '/api/v1/library/startups?q=WF06&limit=50',
      '/api/v1/library/founders?limit=50',
      '/api/v1/library/founders?q=WF06&limit=50',
      '/api/v1/library/problems?limit=50',
    ]
    for (const [actor, headers] of [
      ['guest', {}],
      ['member', cookie()],
    ] as const) {
      for (const path of paths) {
        const a = await api(request, path, headers)
        expect(a.status, path).toBe(200)
        for (const value of forbidden) expect(a.text, `${actor} ${path}`).not.toContain(value)
        expect(a.text, `${actor} ${path}`).not.toMatch(keys)
      }
      record(
        '6',
        `${actor}: 5 API payloads free of ids, private fields, application answers`,
        'pass',
      )
    }
    const guestFounders = await api(request, '/api/v1/library/founders?q=WF06')
    expect(guestFounders.body).toMatchObject({ items: [], total: 0, restricted: true })
    const memberFounders = await api(request, '/api/v1/library/founders?q=WF06', cookie())
    expect(namesOf(memberFounders)).toEqual([
      'WF06 Founder Hải',
      'WF06 Founder Lan',
      'WF06 Founder Minh',
    ])
    record('5', 'founders: guest restricted / member visible only', 'pass')

    for (const actor of ['guest', 'member'] as const) {
      if (actor === 'member') await asMember(page, baseURL)
      await page.goto('/library?q=WF06')
      for (const tab of [/^Startup/, /Nhà sáng lập/]) {
        await page.getByRole('tab', { name: tab }).click()
        await settled(page)
      }
      const html = await page.content()
      for (const value of forbidden) expect(html, `${actor} page`).not.toContain(value)
      if (actor === 'guest') expect(html).not.toContain('WF06 Founder Lan')
      record('6', `${actor}: /library HTML free of forbidden values`, 'pass')
    }
  })

  test('7 · direct-id and query bypass', async ({ request }) => {
    const hidden = fx.ventures['WF06 Kín Đáo']!
    const cases: Array<[string, Record<string, string>, number[]]> = [
      [`/api/v1/library/startups?domain_id=${hidden}`, {}, [422]],
      [`/api/v1/library/startups?stage_id=${fx.owners.hidden}`, {}, [422]],
      [`/api/v1/library/founders?domain_id=${fx.accounts.hidden}`, cookie(), [422]],
      [`/api/v1/library/startups/${hidden}`, {}, [404]],
      [`/api/v1/library/founders/${fx.owners.lan}`, cookie(), [404]],
      [`/api/v1/ventures/${hidden}`, cookie(), [404]],
      [`/api/v1/ventures/${hidden}`, {}, [401]],
      [`/api/v1/profiles/${fx.owners.hidden}`, cookie(), [404]],
      [`/api/v1/organizations/by-slug/wf06-fx-org-draft`, {}, [404]],
      [`/api/v1/organizations/by-slug/10000000-0000-0000-0000-000000000101`, {}, [404]],
      [`/organizations/wf06-fx-org-archived`, {}, [404]],
      [`/api/v1/library/startups?owner_profile_id=${fx.owners.lan}&visibility=PRIVATE`, {}, [422]],
      [`/api/v1/library/startups?organization_id=10000000-0000-0000-0000-000000000101`, {}, [422]],
      [`/api/v1/library/startups?cursor=${Buffer.from('o:-1').toString('base64url')}`, {}, [422]],
      [`/api/v1/library/startups?cursor=forged`, {}, [422]],
    ]
    for (const [path, headers, statuses] of cases) {
      const a = await api(request, path, headers)
      expect(statuses, path).toContain(a.status)
      expect(a.text, path).not.toContain('Kín Đáo')
      record('7', path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>'), a.status)
    }
    // An edited but well-formed cursor only moves inside the visible list.
    const all = keysOf(await api(request, '/api/v1/library/startups?q=WF06&limit=50'))
    const moved = await api(
      request,
      `/api/v1/library/startups?q=WF06&limit=5&cursor=${Buffer.from('o:5').toString('base64url')}`,
    )
    expect(keysOf(moved)).toEqual(all.slice(5, 10))
    record('7', 'edited cursor o:5 → the visible list from 5', 'pass')
  })

  test('8 · filters: valid, empty, whitespace, invalid, unknown, repeated, case, Unicode', async ({
    request,
  }) => {
    const s = (q: string) => `/api/v1/library/startups?q=${encodeURIComponent(q)}&limit=50`
    const base = keysOf(await api(request, s('WF06 Ổ Khóa')))
    expect(base).toHaveLength(1)
    const same = [
      'wf06 o khoa',
      '  WF06   Ổ   KHÓA  ',
      'WF06 Ổ Khóa'.normalize('NFD'),
      'wF06 ổ kHóA',
    ]
    for (const q of same) expect(keysOf(await api(request, s(q))), q).toEqual(base)
    record('8', 'keyword: case, accents, spaces, NFD → same result', 'pass')
    const none = await api(request, '/api/v1/library/startups?limit=50')
    for (const q of ['', '   ']) expect(keysOf(await api(request, s(q)))).toEqual(keysOf(none))
    record('8', 'empty / whitespace keyword = no keyword', 'pass')
    const refusals: Array<[string, Record<string, string>]> = [
      [`/api/v1/library/startups?q=a%01b`, { q: 'invalid' }],
      [
        `/api/v1/library/startups?domain_id=00000000-0000-0000-0000-000000000000`,
        { domain_id: 'unknown' },
      ],
      [`/api/v1/library/startups?domain_id=abc`, { domain_id: 'invalid' }],
      [`/api/v1/library/startups?q=a&q=b`, { q: 'duplicate' }],
      [`/api/v1/library/startups?category=EDU`, { category: 'not_accepted' }],
      [`/api/v1/library/problems?area=`, { area: 'invalid' }],
    ]
    for (const [path, fields] of refusals) {
      const a = await api(request, path)
      expect(a.status, path).toBe(422)
      expect((a.body.error as { fields: unknown }).fields, path).toEqual(fields)
      record('8', path, `422 ${JSON.stringify(fields)}`)
    }
    const dup = await api(
      request,
      `/api/v1/library/startups?q=WF06&domain_id=${LIBRARY_FX.domain.edtech}&domain_id=${LIBRARY_FX.domain.edtech.toUpperCase()}&limit=50`,
    )
    const once = await api(
      request,
      `/api/v1/library/startups?q=WF06&domain_id=${LIBRARY_FX.domain.edtech}&limit=50`,
    )
    expect(keysOf(dup)).toEqual(keysOf(once))
    record('8', 'repeated / upper-case id deduplicated', 'pass')
    const area = await api(
      request,
      `/api/v1/library/problems?area=${encodeURIComponent('Không có nơi này')}`,
    )
    expect(area.body.total).toBe(0)
    record('8', 'location (problem area) absent value → empty', 'pass')
    record(
      '8',
      'organization filter',
      'NOT_APPLICABLE: not in the frozen contract (refused as not_accepted)',
    )
  })

  test('9 · sort determinism, ties and viewers', async ({ request }) => {
    for (const sort of ['STAGE', 'NAME']) {
      const runs = await Promise.all(
        [0, 1, 2].map(() => api(request, `/api/v1/library/startups?q=WF06&sort=${sort}&limit=50`)),
      )
      expect(keysOf(runs[1]!)).toEqual(keysOf(runs[0]!))
      expect(keysOf(runs[2]!)).toEqual(keysOf(runs[0]!))
      const guest = await api(request, `/api/v1/library/startups?q=WF06&sort=${sort}&limit=50`)
      const signedIn = await api(
        request,
        `/api/v1/library/startups?q=WF06&sort=${sort}&limit=50`,
        cookie(),
      )
      expect(keysOf(signedIn)).toEqual(keysOf(guest))
      record('9', `${sort}: 3 runs and guest = member`, 'same order')
    }
    const twins = await api(
      request,
      `/api/v1/library/startups?q=${encodeURIComponent('WF06 Song Sinh')}`,
    )
    expect(namesOf(twins)).toEqual(TWINS)
    const again = await api(
      request,
      `/api/v1/library/startups?q=${encodeURIComponent('WF06 Song Sinh')}`,
    )
    expect(keysOf(again)).toEqual(keysOf(twins))
    record('9', 'same name and stage: the key breaks the tie, stably', 'pass')
  })

  test('10 · pagination: first, middle, last, past the end, bounds, duplicates', async ({
    request,
  }) => {
    const all = keysOf(await api(request, '/api/v1/library/startups?q=WF06&limit=50'))
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const a = await api(
        request,
        `/api/v1/library/startups?q=WF06&limit=4${cursor ? `&cursor=${cursor}` : ''}`,
      )
      seen.push(...keysOf(a))
      cursor = (a.body.page as { next_cursor: string | null }).next_cursor
      pages++
    } while (cursor)
    expect(seen).toEqual(all)
    record('10', `walk limit 4: ${pages} pages, ${seen.length} items, no gap or repeat`, 'pass')
    const past = await api(
      request,
      `/api/v1/library/startups?q=WF06&cursor=${Buffer.from('o:999999').toString('base64url')}`,
    )
    expect(past.body).toMatchObject({ items: [], page: { next_cursor: null } })
    const bounds: Array<[string, number, string | null]> = [
      ['limit=50', 200, null],
      ['limit=51', 422, 'too_many'],
      ['limit=0', 422, 'invalid'],
      ['limit=-1', 422, 'invalid'],
      ['limit=1e3', 422, 'invalid'],
      ['limit=9&limit=9', 422, 'duplicate'],
      ['cursor=b0o0&cursor=b0o0', 422, 'duplicate'],
      [`cursor=${Buffer.from('o:09').toString('base64url')}`, 422, 'invalid'],
    ]
    for (const [qs, status, reason] of bounds) {
      const a = await api(request, `/api/v1/library/startups?${qs}`)
      expect(a.status, qs).toBe(status)
      if (reason) expect(JSON.stringify(a.body), qs).toContain(reason)
      record('10', qs, status)
    }
  })

  test('12 · 13 · founder and organization visibility matrix', async ({ request }) => {
    const ask = (q: string, who: 'guest' | 'member') =>
      api(
        request,
        `/api/v1/library/founders?q=${encodeURIComponent(q)}`,
        who === 'member' ? cookie() : {},
      )
    const rows: Array<[string, string, string[]]> = [
      ['venture visible + founder visible', 'WF06 Founder Lan', ['WF06 Founder Lan']],
      ['venture visible + founder hidden (PRIVATE)', 'WF06 Ngân Hà', []],
      ['venture visible + owner deactivated', 'WF06 Ổ Khóa', []],
      ['venture hidden (owner of a PRIVATE venture only)', 'WF06 Riêng Tư', []],
    ]
    for (const [label, q, expected] of rows) {
      expect(namesOf(await ask(q, 'member')), label).toEqual(expected)
      const guest = await ask(q, 'guest')
      expect(guest.body.restricted, label).toBe(true)
      record('12', label, `member ${JSON.stringify(expected)} / guest restricted`)
    }
    for (const [slug, status] of [
      ['wf06-fx-org-published', 200],
      ['wf06-fx-org-draft', 404],
      ['wf06-fx-org-archived', 404],
      ['wf06-fx-org-company', 404],
    ] as const) {
      const a = await api(request, `/api/v1/organizations/by-slug/${slug}`)
      expect(a.status, slug).toBe(status)
      record('13', slug, status)
    }
    expect((await api(request, '/api/v1/ops/organizations')).status).toBe(401)
    expect([403, 404]).toContain((await api(request, '/api/v1/ops/organizations', cookie())).status)
    record('13', 'ops organization list: guest 401, plain member refused', 'pass')
    record(
      '13',
      'organization search / filter',
      'NOT_APPLICABLE: no public organization search in P0',
    )
  })

  test('14 · session: guest → login (magic link) → member → logout → guest reload', async ({
    page,
  }) => {
    await page.goto('/library')
    await page.getByRole('tab', { name: /Nhà sáng lập/ }).click()
    await expect(page.locator('[data-anchor="sign-in"]')).toBeVisible()
    const email = `wf06-qa-${Date.now().toString(36)}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await page.goto('/library?q=WF06')
    await page.getByRole('tab', { name: /Nhà sáng lập/ }).click()
    await expect(cards(page).locator('h2')).toHaveText([
      'WF06 Founder Hải',
      'WF06 Founder Lan',
      'WF06 Founder Minh',
    ])
    expect((await page.request.post('/api/v1/auth/logout')).status()).toBe(204)
    await page.reload()
    await page.getByRole('tab', { name: /Nhà sáng lập/ }).click()
    await expect(page.locator('[data-anchor="sign-in"]')).toBeVisible()
    expect(await page.content()).not.toContain('WF06 Founder Lan')
    record('14', 'guest → login → member → logout → reload', 'no stale founder')
  })

  test('16 · 17 · query abuse and resource bounds', async ({ request }) => {
    const cases: Array<[string, number[]]> = [
      [`/api/v1/library/startups?q=${'x'.repeat(10_000)}`, [422]],
      [
        `/api/v1/library/startups?${Array.from({ length: 1000 }, () => `domain_id=${LIBRARY_FX.domain.edtech}`).join('&')}`,
        [422, 414, 431],
      ],
      [
        `/api/v1/library/startups?${Array.from({ length: 200 }, () => `domain_id=${LIBRARY_FX.domain.edtech}`).join('&')}`,
        [422],
      ],
      ['/api/v1/library/startups?limit=1000000', [422]],
      ['/api/v1/library/startups?cursor=%25%25%25', [422]],
      ['/api/v1/library/startups?q=%25', [200]],
      ['/api/v1/library/startups?q=_', [200]],
      ['/api/v1/library/startups?q=.*', [200]],
      ['/api/v1/library/startups?q=%5C', [200]],
      ['/api/v1/library/startups?q=%27%20OR%201%3D1--', [200]],
      ['/api/v1/library/startups?sort=name;DROP', [422]],
      ['/api/v1/library/problems?domain=' + 'a'.repeat(121), [422]],
      ['/api/v1/library/startups?__proto__=1&constructor=1', [422]],
      [`/api/v1/library/startups?q=${'y'.repeat(30_000)}`, [414, 431, 422]],
    ]
    for (const [path, statuses] of cases) {
      const started = Date.now()
      const a = await api(request, path)
      expect(statuses, path.slice(0, 80)).toContain(a.status)
      expect(a.text).not.toMatch(/stack|select |\.ts:|node_modules/i)
      record('16', path.slice(0, 90), `${a.status} in ${Date.now() - started} ms`)
    }
    record(
      '17',
      'bounds',
      'page ≤ 50, q ≤ 120, ≤ 10 values per filter, canonical read ≤ 1000; no rate-limit layer (G14), none claimed',
    )
  })

  test('19 · 20 · data quality on the page and a keyboard smoke', async ({ page }) => {
    await page.goto('/library?q=WF06')
    await page.getByRole('tab', { name: /^Startup/ }).click()
    await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('NAME')
    await settled(page)
    await page.locator('[data-anchor="more"]').click()
    await expect(cards(page)).toHaveCount(LISTED)
    const long = cards(page).filter({ hasText: 'WF06 Dài' })
    await expect(long).toHaveCount(1)
    const widths = await cards(page).evaluateAll((els) => [
      ...new Set(els.map((e) => Math.round(e.getBoundingClientRect().width))),
    ])
    expect(widths).toHaveLength(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await expect(long.locator('[class*="pcardStage"]')).toHaveCount(0)
    record(
      '19',
      'long Unicode title, no stage / region / domain: same card width, no overflow',
      'pass',
    )
    await expect(cards(page).filter({ hasText: 'WF06 Song Sinh' })).toHaveCount(2)
    record('19', 'two canonical records with the same name: both, once each', 'pass')
    // Keyboard: Space toggles a facet, Enter submits the search, the empty state's control works.
    const facet = page
      .getByRole('complementary', { name: 'Bộ lọc' })
      .getByRole('checkbox', { name: /^Pilot/ })
    await facet.focus()
    await page.keyboard.press('Space')
    await expect(facet).toBeChecked()
    await expect(count(page)).toHaveText('4 startup')
    await page.keyboard.press('Space')
    await page.getByRole('searchbox').fill('WF06 khongcogi')
    await page.getByRole('searchbox').press('Enter')
    const clear = page.getByRole('button', { name: 'Xoá tất cả bộ lọc' })
    await clear.focus()
    await page.keyboard.press('Enter')
    await settled(page)
    await expect(cards(page).first()).toBeVisible()
    record('20', 'keyboard: facet Space, search Enter, empty-state control Enter', 'pass')
  })

  test('15 · crafted external rows: no script, no unsafe URL, no duplicate, canonical wins', async ({
    page,
    request,
  }) => {
    test.skip(process.env.WF06_QA_FEED !== 'crafted', 'run with the server on the crafted feed')
    const dialogs: string[] = []
    page.on('dialog', async (d) => {
      dialogs.push(d.message())
      await d.dismiss()
    })
    const payload = await api(request, '/api/v1/library/startups?q=WF06X&limit=50')
    expect(payload.body.degraded).toBe(false)
    expect(payload.text).not.toMatch(/thanh_vien|ho_ten|Người Ngoài|a@b\.com|javascript:|data:text/)
    await page.goto('/library?q=WF06X')
    await page.getByRole('tab', { name: /^Startup/ }).click()
    await settled(page)
    const titles = await cards(page).locator('h2').allInnerTexts()
    expect(titles.filter((t) => t === 'WF06X Ngoài Chỉ')).toHaveLength(1)
    expect(titles.some((t) => /a@b\.com/.test(t))).toBe(false)
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined()
    await expect(
      page.locator('[data-anchor="grid"] img, [data-anchor="grid"] script, [data-anchor="grid"] b'),
    ).toHaveCount(0)
    for (const href of await page
      .locator('[data-anchor="grid"] a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '')))
      expect(href).toMatch(/^https:\/\/[^/@]+\.[^/]+/)
    expect(dialogs).toEqual([])
    await searchFor(page, 'WF06 Kho Lạnh')
    await expect(cards(page).locator('h2')).toHaveText(['WF06 Kho Lạnh'])
    await expect(cards(page).locator('a')).toHaveCount(0)
    record(
      '15',
      'crafted feed: escaped text, safe links only, no dialog, dedup, canonical twin wins',
      { titles },
    )
  })
})
