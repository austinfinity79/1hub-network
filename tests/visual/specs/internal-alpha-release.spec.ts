import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { inviteMember } from '../../../src/lib/venture/team'
import { seedVenture } from '../../../src/lib/venture/testing'
import { REPO_ROOT } from '../pixel-qa/paths'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * INTERNAL ALPHA release gate (PROCESS-P0-ACCELERATED-SAFE-V2): the
 * cross-workflow checks the per-workflow closure specs do not make on their
 * own. REL-AUTH (magic link one-time use, callback Referrer-Policy, no token in
 * HTML, sessions, logout); REL-SEC (10 actor roles × every workflow's pages and
 * APIs, plain and spoofed, with the policy invariants); REL-NAV (a crawl of the
 * whole navigation graph per actor: dead links, `#`, placeholders, dev or
 * future routes, technical copy, storage); REL-RESP (representative screens at
 * 1440 / 768 / 390); REL-DATA (schema-level invariants). Screen-level and
 * workflow-level cases stay in their own specs.
 */

const SEED_VENTURE = '50000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const PLACEHOLDER = /\bTODO\b|FIXME|lorem ipsum|\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/i
/** Seeded non-production data marks itself ("Fixture chapter", "FIXTURE" legal text): reported, not product copy. */
const SEED_MARK = /fixture/i
const TECHNICAL =
  /\bmock\b|sessionStorage|localStorage|\bDTO\b|\benum\b|owner_profile_id|account_id|profile_id|\bORM\b|stack trace/i
/** WF06 and other future-only runtime (DEC-WF06-INTERNAL-ALPHA-SCOPE). */
const FUTURE_ROUTE =
  /\/(discover|discovery|matching|match|recommend|investors?|dataroom|data-room|flywheel)\b/i

const accounts: string[] = []
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await query(
    `DELETE FROM project_members WHERE project_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM projects WHERE owner_profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

const newEmail = (tag: string) =>
  `ia-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`

async function person(name: string) {
  const email = newEmail('p')
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id, email }
}

/** Outcome of a GET as the current cookie: status, and the final path when redirected. */
async function outcome(request: APIRequestContext, url: string, headers = {}) {
  const r = await request.get(url, { headers })
  const finalPath = new URL(r.url()).pathname
  const requested = new URL(url, 'http://x').pathname
  return {
    code: finalPath !== requested ? `${r.status()}→${finalPath}` : String(r.status()),
    body: await r.text(),
  }
}

// ---------------------------------------------------------------- REL-AUTH

test.describe('REL-AUTH magic link and session', () => {
  test('sign-in, one-time link, invalid link, callback Referrer-Policy, no token in HTML, sessions, logout, revoked session', async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = newEmail('auth')
    await page.goto('/auth', { waitUntil: 'networkidle' })
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
    await expect(page).toHaveURL('/auth/check-email')
    const { token } = await requestMagicLink(email, null)
    const callback = `/auth/callback?token=${encodeURIComponent(token)}`
    const response = page.waitForResponse((r) => r.url().includes('/auth/callback'))
    await page.goto(callback)
    const first = await response
    expect(first.headers()['referrer-policy']).toBe('no-referrer')
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
    await expect(page).toHaveURL('/onboarding')
    expect(await page.content()).not.toContain(token)
    const [row] = await query<{ id: string }>(
      `SELECT id::text FROM user_accounts WHERE email_normalized = $1`,
      [email],
    )
    accounts.push(row!.id)

    // One-time: the same link in another browser creates no session.
    const other = await browser.newContext({ baseURL })
    const again = await other.newPage()
    await again.goto(callback)
    await expect(again).toHaveURL('/auth/callback?status=used')
    expect(await again.content()).not.toContain(token)
    expect((await again.request.get('/api/v1/me/sessions')).status()).toBe(401)
    // An invalid link: no session, a way back to /auth.
    await again.goto('/auth/callback?token=not-a-real-token')
    await expect(again.locator('a[href="/auth"]').first()).toBeVisible()
    expect((await again.request.get('/api/v1/me/sessions')).status()).toBe(401)
    await other.close()

    // Sessions: the new one is listed, no token or hash in the response; logout revokes it.
    const sessions = await page.request.get('/api/v1/me/sessions')
    expect(sessions.status()).toBe(200)
    const body = await sessions.text()
    expect(body).not.toContain(token)
    expect(body).not.toMatch(/token_hash|hub_session/)
    const cookies = await page.context().cookies()
    const session = cookies.find((c) => /session/i.test(c.name))!
    expect(session.httpOnly).toBe(true)
    expect(['Lax', 'Strict']).toContain(session.sameSite)
    expect(body).not.toContain(session.value)
    expect((await page.request.post('/api/v1/auth/logout')).status()).toBe(204)
    await page.goto('/me')
    await expect(page).toHaveURL('/auth')
    // The revoked cookie value is dead even if presented again.
    const replay = await browser.newContext({ baseURL })
    await replay.addCookies([{ ...session }])
    expect((await replay.request.get('/api/v1/me/sessions')).status()).toBe(401)
    await replay.close()
    writeJsonReport('IA-REL.AUTH.json', {
      referrer_policy: first.headers()['referrer-policy'],
      cookie: {
        name: session.name,
        httpOnly: session.httpOnly,
        sameSite: session.sameSite,
        secure: session.secure,
      },
    })
  })
})

test.describe('REL-AUTH forwarded address (IA-P2-01)', () => {
  test('a malformed X-Forwarded-For never fails the sign-in request; only a plain IP is stored', async ({
    request,
  }) => {
    const cases: [string, string | null][] = [
      ['203.0.113.9', '203.0.113.9'],
      ['203.0.113.9, 10.0.0.1', '203.0.113.9'],
      ['2001:db8::1', '2001:db8::1'],
      ['unknown', null],
      ['203.0.113.9:4711', null],
      ['fe80::1%eth0', null],
    ]
    for (const [forwarded, stored] of cases) {
      const email = newEmail('xff')
      const r = await request.post('/api/v1/auth/magic-link', {
        headers: { 'x-forwarded-for': forwarded },
        data: { email },
      })
      expect(r.status(), forwarded).toBe(202)
      const [row] = await query<{ ip: string | null }>(
        `SELECT host(request_ip) AS ip FROM auth_magic_link_requests WHERE email_normalized = $1`,
        [email],
      )
      expect(row?.ip ?? null, forwarded).toBe(stored)
    }
  })
})

// ---------------------------------------------------------------- REL-SEC

test.describe('REL-SEC cross-workflow actor matrix', () => {
  test('9 identities (10 actor roles) × pages and APIs of every workflow, plain and spoofed: server-side scope only; no shortcut; no leak', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    // A second venture with an ACTIVE team member; a foreign member with nothing.
    const owner = await person('Chủ Dự Án IA')
    const teammate = await person('Thành Viên IA')
    const stranger = await person('Người Ngoài IA')
    const venture = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án IA' })
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
       VALUES ($1, $2, 'Founder', 'ACTIVE', now())`,
      [venture.id, teammate.profileId],
    )
    const [org] = await query<{ slug: string }>(`SELECT slug FROM organizations WHERE id = $1`, [
      CHAPTER_01,
    ])
    const pages: Record<string, string> = {
      landing: '/',
      me: '/me',
      profile: '/me/profile/edit',
      privacy: '/me/privacy',
      settings: '/me/settings',
      roles: '/me/roles',
      'venture-new': '/projects/new',
      'seed-venture-edit': `/projects/${SEED_VENTURE}/edit`,
      'seed-venture-team': `/projects/${SEED_VENTURE}/team`,
      'ia-venture-edit': `/projects/${venture.id}/edit`,
      'ops-network': '/ops/network',
      'ops-ch01': `/ops/org/${CHAPTER_01}`,
      'ops-ch01-members': `/ops/org/${CHAPTER_01}/members`,
      'ops-ch01-events': `/ops/org/${CHAPTER_01}/events`,
      'ops-ch02': `/ops/org/${CHAPTER_02}`,
      'public-org': `/organizations/${org!.slug}`,
      'wf04-list': '/demo/programmes',
      'wf04-detail': `/demo/programmes/${PROGRAMME}`,
      'wf05-list': '/demo/projects',
      'wf05-seed': `/demo/projects/${SEED_VENTURE}`,
      // TASK 24.4 (DEC-L5-D4): the application form is the L5 member route.
      'l5-seed-form': `/projects/${SEED_VENTURE}/applications/${PROGRAMME}`,
      'wf05-ia': `/demo/projects/${venture.id}`,
    }
    const apis: Record<string, string> = {
      'api:me-profile': '/api/v1/me/profile',
      'api:me-sessions': '/api/v1/me/sessions',
      'api:venture-seed': `/api/v1/ventures/${SEED_VENTURE}`,
      'api:venture-ia': `/api/v1/ventures/${venture.id}`,
      'api:ops-ch01-members': `/api/v1/ops/organizations/${CHAPTER_01}/members`,
      'api:ops-ch02-members': `/api/v1/ops/organizations/${CHAPTER_02}/members`,
      'api:demo-programmes': '/api/v1/demo/programmes',
      'api:demo-projects-seed': `/api/v1/demo/projects/${SEED_VENTURE}`,
      'api:me-applications': '/api/v1/me/applications',
    }
    const spoofs = {
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': CHAPTER_02,
      'x-owner-profile-id': owner.profileId,
      'x-profile-id': owner.profileId,
      'x-account-id': owner.accountId,
    }
    const q = `?owner_profile_id=${owner.profileId}&profile_id=${owner.profileId}&account_id=${owner.accountId}&orgId=${CHAPTER_02}&role=PLATFORM_ADMIN`
    const secrets = [
      owner.email,
      teammate.email,
      stranger.email,
      owner.accountId,
      teammate.accountId,
    ]
    const actors: [string, string | null][] = [
      ['guest', null],
      ['onboarding incomplete', 'newcomer@example.test'],
      ['member, seed STARTUP owner', 'member@example.test'],
      ['IA venture owner', owner.email],
      ['ACTIVE team member ("Founder" label)', teammate.email],
      ['pending invitee (seed venture) + Chapter 01 leader', 'leader@example.test'],
      ['platform admin', 'ops@example.test'],
      ['pending membership member', 'pending@example.test'],
      ['unrelated member', stranger.email],
    ]
    const matrix: Record<string, Record<string, string>> = {}
    for (const [actor, email] of actors) {
      await page.context().clearCookies()
      if (email) await login(page.request, email)
      const row: Record<string, string> = {}
      for (const [name, url] of [...Object.entries(pages), ...Object.entries(apis)]) {
        const plain = await outcome(page.request, url)
        const spoofed = await outcome(page.request, url + q, spoofs)
        expect(spoofed.code, `${actor} ${name} spoofed`).toBe(plain.code)
        if (actor !== 'IA venture owner' && actor !== 'ACTIVE team member ("Founder" label)')
          for (const s of secrets) expect(plain.body, `${actor} ${name}`).not.toContain(s)
        row[name] = plain.code
      }
      matrix[actor] = row
    }
    const at = (actor: string, name: string) => matrix[actor]![name]!
    const protectedPages = Object.keys(pages).filter((n) => !['landing', 'public-org'].includes(n))
    const protectedApis = Object.keys(apis)
    for (const n of protectedPages) {
      expect(at('guest', n), `guest ${n}`).toBe('200→/auth')
      expect(at('onboarding incomplete', n), `onboarding ${n}`).toMatch(/^200→\/onboarding(\/|$)/)
    }
    for (const n of protectedApis) expect(at('guest', n), `guest ${n}`).toBe('401')
    for (const n of ['landing', 'public-org']) expect(at('guest', n)).toBe('200')
    // Venture resources: owner or ACTIVE member only; everyone else the same 404.
    expect(at('member, seed STARTUP owner', 'seed-venture-edit')).toBe('200')
    expect(at('member, seed STARTUP owner', 'l5-seed-form')).toBe('200')
    for (const actor of [
      'pending invitee (seed venture) + Chapter 01 leader',
      'platform admin',
      'unrelated member',
      'ACTIVE team member ("Founder" label)',
      'IA venture owner',
    ]) {
      for (const n of ['seed-venture-edit', 'seed-venture-team', 'wf05-seed', 'l5-seed-form'])
        // DEC-WF02-S06-G2: the invitee opens the team page to accept or decline, nothing else.
        if (!(n === 'seed-venture-team' && actor.startsWith('pending invitee')))
          expect(at(actor, n), `${actor} ${n}`).toBe('404')
      for (const n of ['api:venture-seed', 'api:demo-projects-seed'])
        expect(at(actor, n), `${actor} ${n}`).toBe('404')
    }
    for (const actor of ['platform admin', 'unrelated member', 'member, seed STARTUP owner']) {
      expect(at(actor, 'ia-venture-edit'), `${actor} ia-venture-edit`).toBe('404')
      expect(at(actor, 'wf05-ia'), `${actor} wf05-ia`).toBe('404')
      expect(at(actor, 'api:venture-ia'), `${actor} api:venture-ia`).toBe('404')
    }
    expect(at('ACTIVE team member ("Founder" label)', 'wf05-ia')).toBe('200')
    expect(at('IA venture owner', 'wf05-ia')).toBe('200')
    // Operations: never for plain members, invitees or the pending member; scoped for the leader.
    for (const actor of [
      'member, seed STARTUP owner',
      'IA venture owner',
      'ACTIVE team member ("Founder" label)',
      'pending membership member',
      'unrelated member',
    ]) {
      for (const n of [
        'ops-ch01',
        'ops-ch01-members',
        'ops-ch01-events',
        'ops-ch02',
        'wf04-list',
        'wf04-detail',
      ])
        expect(at(actor, n), `${actor} ${n}`).not.toBe('200')
      for (const n of ['api:ops-ch01-members', 'api:ops-ch02-members', 'api:demo-programmes'])
        expect(['401', '403', '404'], `${actor} ${n}`).toContain(at(actor, n))
    }
    const leader = 'pending invitee (seed venture) + Chapter 01 leader'
    expect(at(leader, 'seed-venture-team')).toBe('200')
    expect(at(leader, 'ops-ch01')).toBe('200')
    expect(at(leader, 'ops-ch01-members')).toBe('200')
    expect(at(leader, 'api:ops-ch01-members')).toBe('200')
    expect(at(leader, 'ops-ch02')).not.toBe('200')
    expect(['403', '404']).toContain(at(leader, 'api:ops-ch02-members'))
    expect(at('platform admin', 'ops-ch01')).toBe('200')
    writeJsonReport('IA-REL.SEC.json', { pages, apis, matrix })
  })
})

// ---------------------------------------------------------------- REL-NAV

type Crawl = {
  routes: Set<string>
  links: Set<string>
  visited: number
  findings: string[]
  seedMarked: Set<string>
}

/** Breadth-first over same-origin anchors; at most 2 visits per route pattern. */
async function crawl(page: Page, actor: string, starts: string[], out: Crawl) {
  const queue = [...starts]
  const perPattern = new Map<string, number>()
  const seen = new Set<string>()
  while (queue.length > 0 && out.visited < 400) {
    const url = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    const pattern = new URL(url, 'http://x').pathname.replace(UUID, ':id')
    if ((perPattern.get(pattern) ?? 0) >= 2) continue
    perPattern.set(pattern, (perPattern.get(pattern) ?? 0) + 1)
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    out.visited++
    const status = response?.status() ?? 0
    const landed = new URL(page.url()).pathname
    if (status !== 200) out.findings.push(`${actor}: ${url} → ${status}`)
    out.routes.add(landed.replace(UUID, ':id'))
    const text = await page.locator('body').innerText()
    if (PLACEHOLDER.test(text))
      out.findings.push(`${actor}: placeholder on ${landed}: ${text.match(PLACEHOLDER)}`)
    if (TECHNICAL.test(text))
      out.findings.push(`${actor}: technical copy on ${landed}: ${text.match(TECHNICAL)}`)
    if (SEED_MARK.test(text)) out.seedMarked.add(landed.replace(UUID, ':id'))
    const hrefs = await page
      .locator('a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      if (href === '' || href === '#' || href.startsWith('javascript:'))
        out.findings.push(`${actor}: bad href "${href}" on ${landed}`)
      if (href.startsWith('#')) continue
      const target = new URL(href, page.url())
      if (target.origin !== new URL(page.url()).origin) continue
      if (target.pathname.startsWith('/dev'))
        out.findings.push(`${actor}: dev link ${href} on ${landed}`)
      if (FUTURE_ROUTE.test(target.pathname))
        out.findings.push(`${actor}: future route ${href} on ${landed}`)
      out.links.add(target.pathname)
      if (!target.pathname.startsWith('/api')) queue.push(target.pathname)
    }
  }
}

test.describe('REL-NAV navigation graph', () => {
  test('crawl as guest, member, leader, admin: every link resolves; no #, placeholder, dev, future or technical copy; storage clean', async ({
    page,
  }) => {
    test.setTimeout(600_000)
    const out: Crawl = {
      routes: new Set(),
      links: new Set(),
      visited: 0,
      findings: [],
      seedMarked: new Set(),
    }
    await crawl(page, 'guest', ['/'], out)
    for (const [actor, email, starts] of [
      ['member', 'member@example.test', ['/', '/me', '/demo/projects']],
      ['leader', 'leader@example.test', ['/', '/ops/network', '/demo/programmes']],
      ['admin', 'ops@example.test', ['/', '/ops/network']],
    ] as const) {
      await page.context().clearCookies()
      await login(page.request, email)
      await crawl(page, actor, [...starts], out)
      const storage = await page.evaluate(() =>
        JSON.stringify({ ...sessionStorage, ...localStorage }),
      )
      const session = (await page.context().cookies()).find((c) => /session/i.test(c.name))
      if (
        /@example\.test|hub_session|token/i.test(storage) ||
        (session && storage.includes(session.value))
      )
        out.findings.push(`${actor}: storage holds personal / secret data`)
    }
    writeJsonReport('IA-REL.NAV.json', {
      visited: out.visited,
      routes: [...out.routes].sort(),
      links: out.links.size,
      findings: out.findings,
      seed_marked_pages: [...out.seedMarked].sort(),
    })
    expect(out.findings).toEqual([])
  })
})

// ---------------------------------------------------------------- REL-RESP

test.describe('REL-RESP responsive sweep', () => {
  test('landing, auth, onboarding, member home, WF02 profile / venture, WF03 dashboard, WF04 detail, WF05 detail at 1440 / 768 / 390', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    const screens: {
      name: string
      who: string | null
      url: string
      key: string
      certified: boolean
    }[] = [
      { name: 'landing', who: null, url: '/', key: '[data-cta="primary"]', certified: true },
      { name: 'auth', who: null, url: '/auth', key: 'input[type="email"]', certified: true },
      {
        name: 'onboarding',
        who: 'newcomer@example.test',
        url: '/onboarding',
        key: '[data-nav="start"]',
        certified: false,
      },
      // DEC-L2R-D1: /me is FP1-OWN (no sidebar); the WF05 demo entry sits in the
      // sidebar of /projects.
      {
        name: 'member-home',
        who: 'member@example.test',
        url: '/me',
        key: '[data-nav="create-project"]',
        certified: false,
      },
      {
        name: 'wf02-projects',
        who: 'member@example.test',
        url: '/projects',
        key: '[data-nav="project-demo"]',
        certified: false,
      },
      {
        name: 'wf02-profile',
        who: 'member@example.test',
        url: '/me/profile/edit',
        key: 'button[type="submit"]',
        certified: false,
      },
      {
        name: 'wf02-venture',
        who: 'member@example.test',
        url: `/projects/${SEED_VENTURE}/edit`,
        key: 'button[type="submit"]',
        certified: false,
      },
      {
        name: 'wf03-dashboard',
        who: 'leader@example.test',
        url: `/ops/org/${CHAPTER_01}`,
        key: 'h1',
        certified: false,
      },
      {
        name: 'wf04-detail',
        who: 'leader@example.test',
        url: `/demo/programmes/${PROGRAMME}`,
        key: 'h1',
        certified: false,
      },
      {
        name: 'wf05-detail',
        who: 'member@example.test',
        url: `/demo/projects/${SEED_VENTURE}`,
        key: '[data-action="apply"]',
        certified: true,
      },
    ]
    const results: Record<string, unknown>[] = []
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const s of screens) {
        await page.context().clearCookies()
        if (s.who) await login(page.request, s.who)
        await page.goto(s.url, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        const key = page.locator(s.key).first()
        await key.scrollIntoViewIfNeeded()
        const box = await key.boundingBox()
        const reachable = !!box && box.x >= 0 && box.x + box.width <= width
        await page.screenshot({
          path: path.join(ACTUAL, `ia-resp-${s.name}-${width}.png`),
          fullPage: true,
        })
        results.push({ screen: s.name, width, overflow, reachable, certified: s.certified })
        if (width === 1440 || s.certified) {
          expect(overflow, `${s.name} ${width} overflow`).toBe(0)
          expect(reachable, `${s.name} ${width} key action`).toBe(true)
        }
      }
    }
    writeJsonReport('IA-REL.RESP.json', { results })
  })

  test('IA-P2-03 pointer reachability: WF02 / WF03 row, table and form actions at 1440 / 1024 / 768 / 390; nothing clipped, covered or hidden', async ({
    page,
  }) => {
    test.setTimeout(420_000)
    // A venture with a pending invitation, so the team table shows its row action.
    const owner = await person('Chủ Đội IA')
    const invitee = await person('Khách Mời IA')
    const venture = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án đội IA' })
    await inviteMember(owner.accountId, venture.id, { email: invitee.email }, 'ia-resp')
    await login(page.request, 'leader@example.test')
    await page.goto(`/ops/org/${CHAPTER_01}/members`)
    const memberDetail = await page.locator('a', { hasText: 'Mở' }).first().getAttribute('href')
    const M = 'member@example.test'
    const L = 'leader@example.test'
    const screens: { who: string; url: string; must?: string }[] = [
      { who: M, url: '/me' },
      { who: M, url: '/me/profile/edit' },
      { who: M, url: '/me/privacy' },
      { who: M, url: '/me/roles' },
      { who: M, url: '/me/settings' },
      { who: M, url: '/projects/new' },
      { who: M, url: `/projects/${SEED_VENTURE}/edit` },
      {
        who: owner.email,
        url: `/projects/${venture.id}/team`,
        must: 'button:has-text("Huỷ lời mời")',
      },
      { who: 'ops@example.test', url: '/ops/network' },
      { who: L, url: `/ops/org/${CHAPTER_01}` },
      { who: L, url: `/ops/org/${CHAPTER_01}/members`, must: 'a:has-text("Mở →")' },
      { who: L, url: memberDetail! },
      { who: L, url: `/ops/org/${CHAPTER_01}/events`, must: '[data-action="open"]' },
      { who: L, url: `/ops/org/${CHAPTER_01}/profile` },
      { who: L, url: `/ops/org/${CHAPTER_01}/settings` },
    ]
    const results: Record<string, unknown>[] = []
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const s of screens) {
        await page.context().clearCookies()
        await login(page.request, s.who)
        await page.goto(s.url, { waitUntil: 'networkidle' })
        if (s.must)
          expect(await page.locator(s.must).count(), `${s.url} ${width}`).toBeGreaterThan(0)
        const found = await page.evaluate(pointerProblems)
        expect(found.problems, `${s.url} ${width}`).toEqual([])
        results.push({ url: s.url.replace(UUID, ':id'), width, ...found })
        // A direct refresh keeps the screen.
        expect(
          (await page.reload({ waitUntil: 'networkidle' }))?.status(),
          `${s.url} refresh`,
        ).toBe(200)
      }
      // Real pointer clicks (no force): the event row opens its form beside or under the list, and the
      // create action stays clickable; the first member row opens by keyboard.
      await page.context().clearCookies()
      await login(page.request, L)
      await page.goto(`/ops/org/${CHAPTER_01}/events`, { waitUntil: 'networkidle' })
      await page.locator('[data-action="open"]').first().click()
      expect((await page.evaluate(pointerProblems)).problems, `events form ${width}`).toEqual([])
      await page.locator('[data-action="new-event"]').click({ trial: true })
      await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
      await page.locator('a', { hasText: 'Mở →' }).first().focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}$/)
    }
    writeJsonReport('IA-REL.RESP-POINTER.json', { results })
  })
})

/**
 * What a mouse or touch user can reach: page scroll and user-scrollable (auto / scroll) containers only,
 * never an overflow:hidden one; each visible control's first line box must then be hit by the pointer.
 * Also reports overflow:hidden / clip containers that hide part of their content (not text ellipsis).
 * Playwright's own click scrolls hidden containers programmatically, so it cannot see this class (IA-P2-03).
 */
function pointerProblems() {
  const name = (el: Element) =>
    `${el.tagName.toLowerCase()}:${((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 24)}`
  const clips = (value: string) => value === 'hidden' || value === 'clip'
  const scrolls = (value: string) => value === 'auto' || value === 'scroll'
  const problems: string[] = []
  let controls = 0
  let scrollers = 0
  for (const box of document.querySelectorAll<HTMLElement>('body *')) {
    const style = getComputedStyle(box)
    const wider = box.scrollWidth > box.clientWidth + 1
    if (scrolls(style.overflowX) && wider) scrollers++
    if (
      clips(style.overflowX) &&
      wider &&
      box.children.length > 1 &&
      style.textOverflow !== 'ellipsis'
    )
      problems.push(
        `${box.tagName.toLowerCase()}.${String(box.className).split(' ')[0]} hides ${box.scrollWidth - box.clientWidth}px`,
      )
  }
  const selector =
    'a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary'
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    window.scrollTo(0, 0)
    const style = getComputedStyle(el)
    let rect = el.getBoundingClientRect()
    if (
      rect.width < 4 ||
      rect.height < 4 ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    )
      continue
    if (
      el.closest('[hidden],[aria-hidden="true"],[inert]') ||
      (rect.right <= 0 && rect.bottom <= 0)
    )
      continue
    controls++
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
      const s = getComputedStyle(box)
      rect = el.getBoundingClientRect()
      const outer = box.getBoundingClientRect()
      if (scrolls(s.overflowX) && rect.right > outer.right)
        box.scrollLeft += rect.right - outer.right + 8
      if (scrolls(s.overflowX) && rect.left < outer.left)
        box.scrollLeft -= outer.left - rect.left + 8
      if (scrolls(s.overflowY) && rect.bottom > outer.bottom)
        box.scrollTop += rect.bottom - outer.bottom + 8
      if (scrolls(s.overflowY) && rect.top < outer.top) box.scrollTop -= outer.top - rect.top + 8
    }
    rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    let problem = ''
    for (
      let box = el.parentElement;
      box && box !== document.body && !problem;
      box = box.parentElement
    ) {
      const s = getComputedStyle(box)
      const outer = box.getBoundingClientRect()
      if (
        (clips(s.overflowX) && (x < outer.left || x > outer.right)) ||
        (clips(s.overflowY) && (y < outer.top || y > outer.bottom))
      )
        problem = `clipped by ${box.tagName.toLowerCase()}.${String(box.className).split(' ')[0]}`
    }
    const page = document.documentElement
    if (
      !problem &&
      (x + scrollX < 0 || x + scrollX > page.scrollWidth || y + scrollY > page.scrollHeight)
    )
      problem = 'outside the page'
    if (!problem) {
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight)
        window.scrollTo(
          Math.max(0, x + scrollX - innerWidth / 2),
          Math.max(0, y + scrollY - innerHeight / 2),
        )
      const line = el.getClientRects()[0] ?? el.getBoundingClientRect()
      const hit = document.elementFromPoint(line.left + line.width / 2, line.top + line.height / 2)
      const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
      const reached =
        !!hit &&
        (hit === el ||
          el.contains(hit) ||
          (hit.contains(el) && !!hit.closest('label')) ||
          !!label?.contains(hit))
      if (!reached) problem = `covered by ${hit ? name(hit) : 'nothing'}`
    }
    if (problem) problems.push(`${name(el)} ${problem}`)
  }
  window.scrollTo(0, 0)
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    controls,
    scrollers,
    problems,
  }
}

// ---------------------------------------------------------------- REL-DATA

test.describe('REL-DATA schema-level invariants', () => {
  test('1:1 account / profile, no duplicate root profile, separate membership / leadership / roles / consent / visibility, no stored completion, no demo or future tables', async () => {
    const [dupes] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM (SELECT account_id FROM individual_profiles GROUP BY account_id HAVING count(*) > 1) x`,
    )
    expect(dupes!.n).toBe(0)
    const [orphans] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM individual_profiles p LEFT JOIN user_accounts a ON a.id = p.account_id WHERE a.id IS NULL`,
    )
    expect(orphans!.n).toBe(0)
    const unique = await query<{ def: string }>(
      `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
        WHERE c.conrelid = 'individual_profiles'::regclass AND c.contype IN ('u', 'p')`,
    )
    const uniqueIdx = await query<{ def: string }>(
      `SELECT indexdef AS def FROM pg_indexes WHERE tablename = 'individual_profiles' AND indexdef ILIKE '%UNIQUE%'`,
    )
    expect(
      [...unique, ...uniqueIdx].some((r) => /\(account_id\)/.test(r.def)),
      'account_id is unique on individual_profiles',
    ).toBe(true)
    const tables = (
      await query<{ t: string }>(
        `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`,
      )
    ).map((r) => r.t)
    for (const t of [
      'community_memberships',
      'leadership_records',
      'role_assignments',
      'consent_records',
      'profile_visibility_settings',
      'projects',
      'project_members',
      'programmes',
      'events',
    ])
      expect(tables).toContain(t)
    // TASK 24.4 (DEC-L5-D2, migration 013): the approved L5 application tables, nothing more.
    const l5 = ['applications', 'programme_application_forms']
    for (const t of l5) expect(tables).toContain(t)
    expect(
      tables.filter(
        (t) =>
          !l5.includes(t) &&
          /application|founder|startup_profile|investor|data_?room|match|recommend/i.test(t),
      ),
    ).toEqual([])
    const completion = await query<{ c: string }>(
      `SELECT column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public' AND (column_name ILIKE '%percent%' OR column_name ILIKE '%completion_score%' OR column_name ILIKE 'profile_completion%')`,
    )
    expect(completion).toEqual([])
    writeJsonReport('IA-REL.DATA.json', { tables })
  })
})
