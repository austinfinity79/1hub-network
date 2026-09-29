import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { writeJsonReport } from '../pixel-qa/report'
import { completedAccount } from '../support/onboarding'
import { createVenture } from '../support/workspace'

/**
 * TASK 24.5 — L6 Ecosystem Data & Matching (DEC-L6-D1). The 29/09 L6 board
 * adds no screen (DEC-2809-D7: ALPHA 0 · FUTURE 9) and no matching; this spec
 * holds the L6 privacy rules on the discovery layer that exists — `/`,
 * `/about`, `/library`, `/organizations/:slug` and their APIs:
 *
 * - a PRIVATE profile, a DRAFT venture and even a PUBLIC profile or venture
 *   are never discoverable there (PUBLIC grants no read, DEC-PDF-D1);
 * - no e-mail, account, profile or venture id leaks;
 * - a forged visibility query or spoofed role header changes nothing;
 * - IDOR on ventures, members and events is the same 404 / 403;
 * - no L6 future route, matching or recommendation endpoint answers;
 * - no score, match or verification copy is rendered;
 * - runtime: no hydration error, 5xx, broken asset or console error.
 */

const CHAPTER = '10000000-0000-0000-0000-000000000101'
const DRAFT_EVENT = 'b0000000-0000-0000-0000-000000000002'
const PUBLISHED_EVENT = 'b0000000-0000-0000-0000-000000000001'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const ORGS = ['hub-network', 'chapter-01', 'chapter-02', 'club-01']
const MARK = `L6x${Date.now().toString(36)}`
const SCORE_COPY =
  /độ phù hợp|mức phù hợp|điểm phù hợp|% phù hợp|match score|best match|gợi ý cho bạn|đề xuất cho bạn|lượt ủng hộ|đã qua duyệt của HUB|nhóm \d+ đội dẫn đầu/i

type Person = { accountId: string; profileId: string; email: string }
const accounts: string[] = []

test.afterAll(async () => {
  const owned = `(SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
                   WHERE i.account_id = ANY($1::uuid[]))`
  await query(`DELETE FROM project_domains WHERE project_id IN ${owned}`, [accounts])
  await query(`DELETE FROM project_members WHERE project_id IN ${owned}`, [accounts])
  await query(
    `DELETE FROM projects WHERE owner_profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM community_memberships WHERE profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** An onboarded member of Chapter 01 whose profile defaults to `level`. */
async function member(name: string, level: 'PRIVATE' | 'PUBLIC'): Promise<Person> {
  const email = `l6-${level.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, full_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, $2, 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  await query(
    `INSERT INTO profile_visibility_settings (profile_id, default_level) VALUES ($1, $2::visibility_level)
     ON CONFLICT (profile_id) DO UPDATE SET default_level = EXCLUDED.default_level`,
    [p!.id, level],
  )
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, started_at)
     VALUES ($1, $2, 'ACTIVE', now())`,
    [p!.id, CHAPTER],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id, email }
}

/** A private and a public member; a DRAFT and a PUBLIC venture of the public one. */
async function world(request: APIRequestContext) {
  const hidden = await member(`Riêng Tư ${MARK}`, 'PRIVATE')
  const open = await member(`Công Khai ${MARK}`, 'PUBLIC')
  await login(request, open.email)
  const draft = await createVenture(request, { type: 'STARTUP', name: `Nháp ${MARK}` })
  const published = await createVenture(request, {
    type: 'STARTUP',
    name: `Công bố ${MARK}`,
    owner_role_label: 'Founder',
  })
  const made = await request.post(`/api/v1/ventures/${published.id}/publish`)
  expect(made.status(), await made.text()).toBe(200)
  const [state] = await query<{ status: string; visibility: string }>(
    `SELECT status::text, visibility::text FROM projects WHERE id = $1`,
    [published.id],
  )
  expect(state).toEqual({ status: 'ACTIVE', visibility: 'PUBLIC' })
  return { hidden, open, draft, published }
}

const spoofs = (w: Awaited<ReturnType<typeof world>>) => ({
  'x-role': 'PLATFORM_ADMIN',
  'x-visibility': 'PUBLIC',
  'x-account-id': w.hidden.accountId,
  'x-profile-id': w.hidden.profileId,
  'x-organization-id': CHAPTER,
})
const forged = (w: Awaited<ReturnType<typeof world>>) =>
  `?visibility=PUBLIC&include_private=true&status=DRAFT&profile_id=${w.hidden.profileId}&owner_profile_id=${w.open.profileId}&venture_id=${w.draft.id}&role=PLATFORM_ADMIN&preview=1`

// ------------------------------------------------------------------ privacy

test.describe('L6-P discovery privacy', () => {
  test('private profile, DRAFT venture, public profile and PUBLIC venture: 0 discoverable; 0 sensitive fields; forged visibility query and role headers change nothing', async ({
    page,
    browser,
    baseURL,
  }) => {
    const w = await world(page.request)
    const secrets = [
      MARK,
      w.hidden.email,
      w.open.email,
      w.hidden.accountId,
      w.hidden.profileId,
      w.open.accountId,
      w.open.profileId,
      w.draft.id,
      w.published.id,
    ]
    const pages = ['/', '/about', '/library', ...ORGS.map((s) => `/organizations/${s}`)]
    const apis = ORGS.map((s) => `/api/v1/organizations/by-slug/${s}`)
    const report: { actor: string; url: string; status: number; leaks: string[] }[] = []

    const scan = async (actor: string, request: APIRequestContext) => {
      for (const url of [...pages, ...apis]) {
        const plain = await request.get(url)
        expect(plain.status(), `${actor} ${url}`).toBe(200)
        const body = await plain.text()
        const leaks = secrets.filter((s) => body.includes(s))
        report.push({ actor, url, status: plain.status(), leaks })
        expect(leaks, `${actor} ${url}`).toEqual([])
        const spoofed = await request.get(url + forged(w), { headers: spoofs(w) })
        expect(spoofed.status(), `${actor} ${url} forged`).toBe(200)
        const forgedBody = await spoofed.text()
        // A page echoes its own query string in the route payload; the forged ids are
        // those of the query, so only the persons' names and e-mails are checked there.
        const named = [MARK, w.hidden.email, w.open.email]
        expect(
          named.filter((s) => forgedBody.includes(s)),
          `${actor} ${url} forged`,
        ).toEqual([])
        if (url.startsWith('/api/')) expect(forgedBody, `${actor} ${url} forged`).toBe(body)
      }
    }

    // Guest, the public member themself and an unrelated member see the same public layer.
    const guest = await browser.newContext({ baseURL })
    await scan('guest', guest.request)
    await guest.close()
    await scan('public member (owner)', page.request)
    const other = await browser.newContext({ baseURL })
    await completedAccount(other.request, 'l6-stranger')
    await scan('unrelated member', other.request)
    await other.close()

    // The public organisation still counts both members: counted, never named.
    const chapter = await (
      await page.request.get('/api/v1/organizations/by-slug/chapter-01')
    ).json()
    expect(chapter.stats.active_members).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(chapter)).not.toMatch(/profile|account|email|display_name/i)

    writeJsonReport('L6.privacy.json', {
      private_profile_leaks: report.filter((r) => r.leaks.length).length,
      checks: report.length,
      report,
    })
  })

  test('IDOR and role spoof: ventures (DRAFT, PUBLIC), chapter members, member detail and events stay 401 / 403 / 404 for anyone but their holders', async ({
    page,
    browser,
    baseURL,
  }) => {
    const w = await world(page.request)
    const outsider = await browser.newContext({ baseURL })
    await completedAccount(outsider.request, 'l6-idor')
    const guest = await browser.newContext({ baseURL })
    const cases = [
      `/api/v1/ventures/${w.draft.id}`,
      `/api/v1/ventures/${w.published.id}`,
      `/api/v1/ventures/${w.published.id}/team`,
      `/api/v1/ops/organizations/${CHAPTER}/members`,
      `/api/v1/ops/organizations/${CHAPTER}/members/${w.hidden.profileId}`,
      `/api/v1/events/${DRAFT_EVENT}`,
      `/api/v1/events/${PUBLISHED_EVENT}`,
    ]
    const matrix: { url: string; guest: number; member: number; spoofed: number }[] = []
    for (const url of cases) {
      const asGuest = (await guest.request.get(url)).status()
      const asMember = (await outsider.request.get(url)).status()
      const spoofed = (await outsider.request.get(url + forged(w), { headers: spoofs(w) })).status()
      matrix.push({ url, guest: asGuest, member: asMember, spoofed })
      expect(asGuest, `guest ${url}`).toBe(401)
      expect([403, 404], `member ${url}`).toContain(asMember)
      expect(spoofed, `spoofed ${url}`).toBe(asMember)
    }
    // A PUBLIC venture grants no read (DEC-PDF-D1): the same 404 as a DRAFT one.
    expect(matrix[0]!.member).toBe(404)
    expect(matrix[1]!.member).toBe(404)
    // The owner reads both; nothing in their own network names the private member.
    expect((await page.request.get(cases[0]!)).status()).toBe(200)
    expect((await page.request.get(cases[1]!)).status()).toBe(200)
    expect(await (await outsider.request.get('/api/v1/me/network')).text()).not.toContain(MARK)
    // Ops screens stay out of reach with a spoofed role.
    const ops = await outsider.request.get('/ops/network', { headers: spoofs(w) })
    expect(new URL(ops.url()).pathname === '/ops/network' && ops.status() === 200).toBe(false)
    await outsider.close()
    await guest.close()
    writeJsonReport('L6.idor.json', { matrix })
  })

  test('no L6 future route, matching or recommendation endpoint answers; no score, match or verification copy on the discovery layer', async ({
    page,
    browser,
    baseURL,
  }) => {
    const w = await world(page.request)
    const future = [
      '/workspace',
      '/phong-lam-viec',
      `/events/${PUBLISHED_EVENT}`,
      `/su-kien/${PUBLISHED_EVENT}`,
      '/startups',
      `/startups/${w.published.id}`,
      `/library/startups/${w.published.id}`,
      `/library/${w.published.id}`,
      '/admin',
      '/admin/accounts',
      '/admin/organizations',
      '/discover',
      '/matching',
      '/recommendations',
      '/investors',
      '/dataroom',
      '/status',
      '/api/v1/matching',
      '/api/v1/matches',
      '/api/v1/recommendations',
      '/api/v1/search?q=Tracely',
      '/api/v1/discovery/ventures',
      '/api/v1/public/ventures',
      `/api/v1/public/ventures/${w.published.id}`,
    ]
    const guest = await browser.newContext({ baseURL })
    for (const [actor, request] of [
      ['guest', guest.request],
      ['member', page.request],
    ] as const)
      for (const url of future)
        expect((await request.get(url)).status(), `${actor} ${url}`).toBe(404)
    await guest.close()

    // Every Library tab and the public pages: no score, match or verification wording.
    await page.context().clearCookies()
    for (const url of ['/', '/about', '/organizations/chapter-01']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      expect(await page.locator('body').innerText(), url).not.toMatch(SCORE_COPY)
    }
    await page.goto('/library', { waitUntil: 'networkidle' })
    const tabs = page.getByRole('tab')
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click()
      expect(await page.locator('body').innerText(), `library tab ${i}`).not.toMatch(SCORE_COPY)
      // A record links out to its own site at most: no internal profile or venture page.
      for (const href of await page
        .locator('[role="tabpanel"] a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '')))
        expect(href, `library tab ${i}`).not.toMatch(/^\/(startups|members|profiles|ventures)\//)
    }
  })
})

// ------------------------------------------------------------------ runtime

type Runtime = { url: string; errors: string[]; server: string[]; assets: string[] }

async function probe(page: Page, url: string, act?: () => Promise<void>): Promise<Runtime> {
  const errors: string[] = []
  const server: string[] = []
  const assets: string[] = []
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === 'error') errors.push(m.text())
  }
  const onError = (e: Error) => errors.push(`pageerror ${e.message}`)
  const onResponse = (r: {
    status(): number
    url(): string
    request(): { resourceType(): string }
  }) => {
    if (r.status() >= 500) server.push(`${r.status()} ${r.url()}`)
    else if (
      r.status() >= 400 &&
      ['stylesheet', 'script', 'image', 'font', 'media'].includes(r.request().resourceType())
    )
      assets.push(`${r.status()} ${r.url()}`)
  }
  const onFailed = (r: { url(): string; failure(): { errorText: string } | null }) => {
    if (!/net::ERR_ABORTED/.test(r.failure()?.errorText ?? '')) assets.push(`failed ${r.url()}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onError)
  page.on('response', onResponse)
  page.on('requestfailed', onFailed)
  await page.goto(url, { waitUntil: 'networkidle' })
  if (act) await act()
  await page.waitForLoadState('networkidle')
  page.off('console', onConsole)
  page.off('pageerror', onError)
  page.off('response', onResponse)
  page.off('requestfailed', onFailed)
  return { url, errors, server, assets }
}

test.describe('L6-R runtime', () => {
  test('discovery and neighbouring pages, guest and member: no hydration error (#418), no 5xx, no broken asset, no console error', async ({
    page,
  }) => {
    const results: Runtime[] = []
    await page.context().clearCookies()
    for (const url of ['/', '/about', '/auth', ...ORGS.map((s) => `/organizations/${s}`)])
      results.push(await probe(page, url))
    results.push(
      await probe(page, '/library', async () => {
        const tabs = page.getByRole('tab')
        for (let i = 0; i < (await tabs.count()); i++) await tabs.nth(i).click()
      }),
    )
    await completedAccount(page.request, 'l6-runtime')
    for (const url of ['/me', '/projects', `/programmes/${PROGRAMME}/apply`, '/library', '/'])
      results.push(await probe(page, url))
    writeJsonReport('L6.runtime.json', { results })
    for (const r of results) {
      expect(r.errors, `${r.url} console`).toEqual([])
      expect(
        r.errors.filter((e) => /#418|hydrat/i.test(e)),
        `${r.url} hydration`,
      ).toEqual([])
      expect(r.server, `${r.url} 5xx`).toEqual([])
      expect(r.assets, `${r.url} assets`).toEqual([])
    }
  })
})
