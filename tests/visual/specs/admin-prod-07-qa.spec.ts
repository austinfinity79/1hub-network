import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

import { requestAccountDeletion } from '../../../src/lib/account/settings'
import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { grantAccess, revokeAccess } from '../../../src/lib/admin/delegation'
import { submitVentureForReview } from '../../../src/lib/admin/venture-submission'
import {
  ADM_FX,
  ADM_PEOPLE,
  clearAdminFixture,
  insertGrant,
  seedAdminFixture,
} from '../../../src/lib/admin/testing'
import { fileVerificationRequest } from '../../../src/lib/admin/verification'
import { closePool, query, withTransaction } from '../../../src/lib/db/client'
import { LIBRARY_FX } from '../../../src/lib/library/testing'

/**
 * ADMIN-PROD-07 — final functional / security QA of the Admin Portal P0 over
 * the real server: the actor × endpoint and actor × route matrices,
 * ADMIN-DECISION-02 (exact-scope revoke) and -04 (no leader account
 * escalation) end to end, immediate revocation, session invalidation, the
 * error contract, deep links, responsive and accessibility smoke. Every test
 * also counts console errors, hydration errors and 5xx responses; the totals
 * are written to `tests/visual/reports/admin-prod-07-summary.json`.
 */

const P = ADM_PEOPLE
const O = ADM_FX.org
type Person = keyof typeof P
const NOW = new Date('2026-10-04T05:00:00Z')
const V = (n: number) => `ad020000-0000-4000-8000-000000000e${n.toString(16).padStart(2, '0')}`
const PREFIX = 'ADM07'
const ZERO = '00000000-0000-4000-8000-000000000000'
const API = '/api/v1'

const totals = { console: 0, hydration: 0, fiveXX: 0, responses: 0 }
const matrix: Record<string, unknown> = {}
let consoleErrors: string[] = []
let fiveXX: string[] = []

test.beforeAll(async () => {
  await seedAdminFixture()
})

test.beforeEach(async ({ page }) => {
  await seedAdminFixture()
  consoleErrors = []
  fiveXX = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (/hydrat/i.test(m.text())) totals.hydration += 1
    if (!/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => {
    totals.responses += 1
    if (r.status() >= 500) fiveXX.push(`${r.status()} ${r.url()}`)
  })
  await page.context().clearCookies()
})

test.afterEach(() => {
  totals.console += consoleErrors.length
  totals.fiveXX += fiveXX.length
  expect(consoleErrors, 'browser console errors').toEqual([])
  expect(fiveXX, 'no 5xx').toEqual([])
})

test.afterAll(async () => {
  const dir = join(process.cwd(), 'tests', 'visual', 'reports')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'admin-prod-07-summary.json'),
    JSON.stringify({ totals, matrix }, null, 2),
  )
  await query(
    `DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
  )
  await query(
    `DELETE FROM venture_reviews WHERE venture_id IN (SELECT id FROM projects WHERE owner_profile_id::text LIKE 'ad020000-%')`,
  )
  await query(`DELETE FROM projects WHERE owner_profile_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM feedback_submissions WHERE body LIKE '${PREFIX}%'`)
  await query(`DELETE FROM account_deletion_requests WHERE account_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM user_sessions WHERE account_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM auth_magic_link_requests WHERE email_normalized LIKE 'adm02-fx-%'`)
  await clearAdminFixture()
  await closePool()
})

const email = (who: Person) => `adm02-fx-${who.toLowerCase()}@example.test`

async function login(request: APIRequestContext, who: Person) {
  await request.post(`${API}/auth/logout`).catch(() => undefined)
  expect((await request.post('/dev/login', { data: { email: email(who) } })).ok()).toBe(true)
}

async function logout(request: APIRequestContext) {
  await request.post(`${API}/auth/logout`).catch(() => undefined)
}

/** Asserts the frozen error envelope: `{ error }` only, no stack, no SQL. */
async function envelope(response: APIResponse, status: number, code?: string) {
  const text = await response.text()
  expect(response.status(), text).toBe(status)
  if (status === 404 && !text.startsWith('{')) return
  const body = JSON.parse(text) as { error: Record<string, unknown> }
  expect(Object.keys(body)).toEqual(['error'])
  expect(Object.keys(body.error).sort()).toEqual(
    expect.arrayContaining(['code', 'message', 'request_id']),
  )
  if (code) expect(body.error.code).toBe(code)
  expect(text).not.toMatch(/stack|at \w+ \(|SELECT |UPDATE |INSERT |constraint|ck_|fkey|violates/i)
}

async function fileVerification(who: Person, org: string) {
  return withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P[who].account,
      body: { organization_id: org, position_title: 'Chủ tịch', period_from: '2024-01' },
      requestId: 'adm07-file',
      now: NOW,
    }),
  )
}

async function ventureAndReview(n: number, owner: Person) {
  const id = V(n)
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, region_id,
                           owner_role_label, status, visibility, website)
     VALUES ($1, 'STARTUP', $2, $3, $4, 'Một dòng mô tả', $5, $6, 'Founder', 'DRAFT', 'PRIVATE', 'https://live.example')`,
    [
      id,
      P[owner].profile,
      `adm07-fx-${n}`,
      `ADM07 Venture ${n}`,
      LIBRARY_FX.stage.MVP,
      LIBRARY_FX.region.hanoi,
    ],
  )
  await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
    id,
    LIBRARY_FX.domain.govtech,
  ])
  const review = await withTransaction((exec) =>
    submitVentureForReview(exec, {
      accountId: P[owner].account,
      ventureId: id,
      requestId: 'adm07-submit',
    }),
  )
  return review.id
}

async function feedback() {
  const [row] = await query<{ id: string }>(
    `INSERT INTO feedback_submissions (account_id, profile_id, body, type)
     VALUES ($1, $2, $3, 'BUG') RETURNING id::text`,
    [P.memberA.account, P.memberA.profile, `${PREFIX} nút lưu không phản hồi`],
  )
  return row!.id
}

async function deletionRequest(who: Person) {
  await requestAccountDeletion(P[who].account, `adm07-del-${who}`)
  const [row] = await query<{ id: string }>(
    `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
    [P[who].account],
  )
  return row!.id
}

/** memberC held `verification:review` on CLB_A1 and lost it: the revoked-capability actor. */
async function revokedCapabilityUser() {
  const g = await grantAccess(
    P.admin.account,
    {
      organizationId: O.CLB_A1,
      granteeProfileId: P.memberC.profile,
      capability: 'verification:review',
    },
    'adm07-grant',
  )
  await revokeAccess(P.admin.account, { organizationId: O.CLB_A1, grantId: g.id }, 'adm07-revoke')
}

type Actor = Person | 'anon'
const ACTORS: Actor[] = [
  'admin',
  'hubLeader',
  'chALeader',
  'clbA1Leader',
  'memberA',
  'memberC',
  'anon',
]
const LEADERS = ['hubLeader', 'chALeader', 'clbA1Leader'] as const

async function as(request: APIRequestContext, actor: Actor) {
  if (actor === 'anon') await logout(request)
  else await login(request, actor)
}

test.describe('ADMIN-PROD-07 §3 actor × endpoint matrix (server-side)', () => {
  test('reads: every actor gets exactly its contract status', async ({ request }) => {
    await revokedCapabilityUser()
    const PLATFORM_ONLY = { admin: 200, anon: 401, default: 403 }
    const REVIEWERS = {
      admin: 200,
      hubLeader: 200,
      chALeader: 200,
      clbA1Leader: 200,
      anon: 401,
      default: 403,
    }
    const CH_A_ACCESS = { admin: 200, hubLeader: 200, chALeader: 200, anon: 401, default: 403 }
    const reads: [string, Record<string, number>][] = [
      [`${API}/ops/verification-requests`, REVIEWERS],
      [`${API}/ops/venture-reviews`, PLATFORM_ONLY],
      [`${API}/ops/organizations/${O.CH_A}/access`, CH_A_ACCESS],
      [`${API}/ops/organizations/${O.CH_A}/access/history`, CH_A_ACCESS],
      [`${API}/ops/feedback`, PLATFORM_ONLY],
      [`${API}/ops/feedback/summary`, PLATFORM_ONLY],
      [`${API}/ops/categories/DOMAIN`, PLATFORM_ONLY],
      [`${API}/ops/account-requests`, PLATFORM_ONLY],
    ]
    const seen: Record<string, Record<string, number>> = {}
    for (const actor of ACTORS) {
      await as(request, actor)
      for (const [path, expected] of reads) {
        const response = await request.get(path)
        ;(seen[path] ??= {})[actor] = response.status()
        const want = expected[actor] ?? expected.default!
        if (want === 200) expect(response.status(), `${actor} GET ${path}`).toBe(200)
        else await envelope(response, want)
      }
    }
    matrix.reads = seen
  })

  test('mutations: every non-authorized actor is refused and nothing changes', async ({
    request,
  }) => {
    await revokedCapabilityUser()
    const verification = await fileVerification('memberA', O.CH_B)
    const review = await ventureAndReview(0x70, 'memberB')
    const fb = await feedback()
    const del = await deletionRequest('memberB')
    const [item] = await query<{ id: string }>(
      `SELECT id::text FROM vocabulary_items WHERE type_code = 'SKILL' AND status = 'ACTIVE' ORDER BY sort_order LIMIT 1`,
    )
    const probes: [string, 'post' | 'patch', string, unknown][] = [
      [
        'verification approve (CH_B)',
        'post',
        `${API}/ops/verification-requests/${verification.id}/approve`,
        { version: 1 },
      ],
      ['venture approve', 'post', `${API}/ops/venture-reviews/${review}/approve`, { version: 1 }],
      [
        'grant on CH_B',
        'post',
        `${API}/ops/organizations/${O.CH_B}/access`,
        { grantee_profile_id: P.memberB.profile, capability: 'member:read' },
      ],
      ['feedback patch', 'patch', `${API}/ops/feedback/${fb}`, { status: 'IN_REVIEW' }],
      ['category patch', 'patch', `${API}/ops/categories/SKILL/${item!.id}`, { label: 'X' }],
      ['lock memberB', 'post', `${API}/ops/accounts/${P.memberB.profile}/lock`, {}],
      ['deactivate memberB', 'post', `${API}/ops/accounts/${P.memberB.profile}/deactivate`, {}],
      ['process deletion', 'post', `${API}/ops/account-requests/${del}/process`, {}],
      ['decline deletion', 'post', `${API}/ops/account-requests/${del}/decline`, { reason: 'x' }],
    ]
    const seen: Record<string, Record<string, number>> = {}
    for (const actor of ['chALeader', 'clbA1Leader', 'memberA', 'memberC', 'anon'] as const) {
      await as(request, actor)
      for (const [name, method, path, data] of probes) {
        const response = await request[method](path, { data })
        ;(seen[name] ??= {})[actor] = response.status()
        expect([401, 403, 404], `${actor} ${name}`).toContain(response.status())
        await envelope(response, response.status())
      }
    }
    // hubLeader holds verification:review on HUB only: CH_B's request is out of scope.
    await as(request, 'hubLeader')
    await envelope(await request.post(probes[0]![2], { data: { version: 1 } }), 404)
    matrix.mutations = seen

    const [v] = await query<{ status: string }>(
      `SELECT status::text FROM role_verification_requests WHERE id = $1`,
      [verification.id],
    )
    const [r] = await query<{ status: string }>(
      `SELECT status::text FROM venture_reviews WHERE id = $1`,
      [review],
    )
    const [f] = await query<{ status: string }>(
      `SELECT status::text FROM feedback_submissions WHERE id = $1`,
      [fb],
    )
    const [d] = await query<{ status: string }>(
      `SELECT status::text FROM account_deletion_requests WHERE id = $1`,
      [del],
    )
    const [a] = await query<{ status: string }>(
      `SELECT status::text FROM user_accounts WHERE id = $1`,
      [P.memberB.account],
    )
    const grants = await query(
      `SELECT 1 FROM role_assignments WHERE scope_id = $1 AND individual_profile_id = $2`,
      [O.CH_B, P.memberB.profile],
    )
    expect([v!.status, r!.status, f!.status, d!.status, a!.status, grants.length]).toEqual([
      'PENDING',
      'PENDING',
      'NEW',
      'PENDING',
      'ACTIVE',
      0,
    ])
  })
})

const ADMIN_ROUTES = [
  '/ops/admin',
  '/ops/admin/verification',
  '/ops/admin/ventures',
  '/ops/admin/access',
  '/ops/admin/feedback',
  '/ops/admin/categories',
  '/ops/admin/accounts',
]

test.describe('ADMIN-PROD-07 §3–4 actor × route and OpsShell navigation', () => {
  test('route visibility and nav follow capabilities; hidden UI is never the guard', async ({
    page,
  }) => {
    await revokedCapabilityUser()
    const LEADER_ROUTES = ['/ops/admin', '/ops/admin/verification', '/ops/admin/access']
    const NAV = [
      'admin-home',
      'admin-verification',
      'admin-ventures',
      'admin-access',
      'admin-feedback',
      'admin-categories',
      'admin-accounts',
    ]
    const seen: Record<string, Record<string, number | string>> = {}
    for (const actor of ACTORS) {
      await page.context().clearCookies()
      if (actor !== 'anon') await login(page.request, actor)
      for (const route of ADMIN_ROUTES) {
        const response = await page.goto(route)
        const status = response?.status() ?? 0
        ;(seen[route] ??= {})[actor] = page.url().includes('/auth') ? 'redirect:/auth' : status
        if (actor === 'anon') expect(page.url(), route).toContain('/auth')
        else if (actor === 'admin') expect(status, `admin ${route}`).toBe(200)
        else if ((LEADERS as readonly string[]).includes(actor))
          expect(status, `${actor} ${route}`).toBe(LEADER_ROUTES.includes(route) ? 200 : 404)
        else expect(status, `${actor} ${route}`).toBe(404)
      }
      if (actor === 'admin' || (LEADERS as readonly string[]).includes(actor)) {
        await page.goto('/ops/admin')
        const shown: string[] = []
        for (const key of NAV)
          if ((await page.locator(`[data-nav-key="${key}"]`).count()) > 0) shown.push(key)
        expect(shown, `${actor} nav`).toEqual(
          actor === 'admin' ? NAV : ['admin-home', 'admin-verification', 'admin-access'],
        )
        ;(seen.nav ??= {})[actor] = shown.join(',')
      }
    }
    matrix.routes = seen
  })

  test('a capability-only grantee without any admin capability or network:read gets no /ops', async ({
    page,
  }) => {
    await grantAccess(
      P.chALeader.account,
      { organizationId: O.CH_A, granteeProfileId: P.memberB.profile, capability: 'member:read' },
      'adm07-grant',
    )
    await login(page.request, 'memberB')
    expect((await page.goto('/ops/admin'))?.status()).toBe(404)
    expect((await page.goto('/ops'))?.status()).toBe(404)
  })
})

test.describe('ADMIN-PROD-07 §10–12 delegation over HTTP (DEC-ADM-D02)', () => {
  const access = (org: string) => `${API}/ops/organizations/${org}/access`

  test('revoke matrix: exact unit and current capability only; PLATFORM_ADMIN platform-wide', async ({
    request,
  }) => {
    const g = (who: Person, org: string, grantee: Person, capability: string | null) =>
      grantAccess(
        P[who].account,
        { organizationId: org, granteeProfileId: P[grantee].profile, capability },
        'adm07',
      )
    const co = await g('chALeader', O.CH_A, 'memberB', null)
    const target = await g('chALeader', O.CH_A, 'memberC', 'member:read')
    const onClb = await g('chALeader', O.CLB_A1, 'memberA', 'org:read')
    const revoke = async (who: Person, org: string, id: string) => {
      await login(request, who)
      return request.post(`${access(org)}/${id}/revoke`)
    }
    const seen: Record<string, number> = {}
    const deny = async (name: string, who: Person, org: string, id: string, status = 403) => {
      const response = await revoke(who, org, id)
      seen[name] = response.status()
      await envelope(response, status)
    }
    await deny('parent → child (HUB on CH_A)', 'hubLeader', O.CH_A, target.id)
    await deny('child → parent (CLB_A1 on CH_A)', 'clbA1Leader', O.CH_A, target.id)
    await deny('sibling (CH_B on CH_A)', 'chBLeader', O.CH_A, target.id)
    await deny('forged path (CH_B names its own unit)', 'chBLeader', O.CH_B, target.id, 404)
    await deny('parent grantor (CH_A on CLB_A1)', 'chALeader', O.CLB_A1, onClb.id)
    await deny('no capability on unit (memberC)', 'memberC', O.CH_A, target.id)
    await insertGrant('memberA', O.CH_A, 'access:delegate')
    await deny('forged stored access:delegate', 'memberA', O.CH_A, target.id)

    const ok = await revoke('memberB', O.CH_A, target.id)
    seen['same-unit co-leader with capability'] = ok.status()
    expect(ok.status()).toBe(200)
    expect((await revoke('clbA1Leader', O.CLB_A1, onClb.id)).status()).toBe(200)

    // Original grantor after losing access:delegate on the unit.
    const own = await g('memberB', O.CH_A, 'memberA', 'event:manage')
    expect((await revoke('chALeader', O.CH_A, co.id)).status()).toBe(200)
    await deny('grantor after capability loss', 'memberB', O.CH_A, own.id)

    const adminRevoke = await revoke('admin', O.CH_A, own.id)
    seen['PLATFORM_ADMIN'] = adminRevoke.status()
    expect(adminRevoke.status()).toBe(200)
    matrix.revoke = seen

    const audits = await query<{ action: string; n: number }>(
      `SELECT action, count(*)::int AS n FROM audit_events
        WHERE resource_id = ANY($1::uuid[]) GROUP BY action ORDER BY action`,
      [[co.id, target.id, onClb.id, own.id]],
    )
    expect(audits).toEqual([
      { action: 'ACCESS_GRANTED', n: 4 },
      { action: 'ACCESS_REVOKED', n: 4 },
    ])
  })

  test('two revokes of one grant at once: one 200, one 409; grant reach unchanged', async ({
    request,
    playwright,
  }) => {
    const grant = await grantAccess(
      P.chALeader.account,
      { organizationId: O.CH_A, granteeProfileId: P.memberC.profile, capability: 'member:read' },
      'adm07',
    )
    const second = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    await login(request, 'chALeader')
    await login(second, 'admin')
    const [a, b] = await Promise.all([
      request.post(`${access(O.CH_A)}/${grant.id}/revoke`),
      second.post(`${access(O.CH_A)}/${grant.id}/revoke`),
    ])
    expect([a.status(), b.status()].sort()).toEqual([200, 409])
    await second.dispose()

    for (const [who, org, capability, status] of [
      ['hubLeader', O.CH_A, 'org:read', 201],
      ['chALeader', O.CLB_A1, 'org:read', 201],
      ['clbA1Leader', O.CLB_A1, 'event:manage', 201],
      ['chALeader', O.HUB, 'org:read', 403],
      ['chALeader', O.CH_B, 'org:read', 403],
      ['clbA1Leader', O.CLB_A2, 'org:read', 403],
      ['hubLeader', O.CLB_A1, 'member:read', 403],
    ] as const) {
      await login(request, who)
      const response = await request.post(access(org), {
        data: { grantee_profile_id: P.memberA.profile, capability },
      })
      expect(response.status(), `${who} → ${org}`).toBe(status)
    }
    await login(request, 'chALeader')
    for (const capability of ['venture:review', 'access:delegate', 'account:escalate'])
      await envelope(
        await request.post(access(O.CH_A), {
          data: { grantee_profile_id: P.memberB.profile, capability },
        }),
        422,
      )
  })

  test('UI: the revoke control follows the server rule (parent unit reads, never revokes)', async ({
    page,
  }) => {
    await grantAccess(
      P.chALeader.account,
      { organizationId: O.CLB_A1, granteeProfileId: P.memberA.profile, capability: 'org:read' },
      'adm07',
    )
    await login(page.request, 'chALeader')
    await page.goto(`/ops/admin/access/${O.CLB_A1}`)
    await expect(page.locator('[data-grant-row]').first()).toBeVisible()
    await expect(page.locator('[data-action="revoke"]')).toHaveCount(0)
    await login(page.request, 'clbA1Leader')
    await page.goto(`/ops/admin/access/${O.CLB_A1}`)
    await expect(page.locator('[data-action="revoke"]').first()).toBeVisible()
  })

  test('a revoked grantee loses access on the very next request (API and page)', async ({
    page,
  }) => {
    const grant = await grantAccess(
      P.admin.account,
      {
        organizationId: O.CLB_A1,
        granteeProfileId: P.memberC.profile,
        capability: 'verification:review',
      },
      'adm07',
    )
    await login(page.request, 'memberC')
    expect((await page.request.get(`${API}/ops/verification-requests`)).status()).toBe(200)
    expect((await page.goto('/ops/admin/verification'))?.status()).toBe(200)
    await revokeAccess(P.admin.account, { organizationId: O.CLB_A1, grantId: grant.id }, 'adm07')
    await envelope(await page.request.get(`${API}/ops/verification-requests`), 403)
    expect((await page.goto('/ops/admin/verification'))?.status()).toBe(404)
  })
})

test.describe('ADMIN-PROD-07 §18 ADMIN-DECISION-04 end to end', () => {
  test('leaders have no account request anywhere; PLATFORM_ADMIN Account Ops still work', async ({
    page,
  }) => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
       VALUES ($1, $2, 'ACTIVE', 'PRESEED', now())`,
      [P.memberA.profile, O.CH_A],
    )
    for (const who of LEADERS) {
      await page.context().clearCookies()
      await login(page.request, who)
      const route = `${API}/ops/organizations/${O.CH_A}/members/${P.memberA.profile}/account-requests`
      for (const action of ['LOCK', 'DEACTIVATE', 'SOFT_DELETE']) {
        const response = await page.request.post(route, { data: { action } })
        expect([404, 405], `${who} ${action}`).toContain(response.status())
      }
      expect((await page.goto('/ops/admin/accounts'))?.status()).toBe(404)
    }
    await login(page.request, 'chALeader')
    await page.goto(`/ops/org/${O.CH_A}/members/${P.memberA.profile}`)
    await expect(page.locator('main')).toBeVisible()
    await expect(
      page.getByText(/khoá tài khoản|khóa tài khoản|vô hiệu hoá|vô hiệu hóa|đề nghị khoá/i),
    ).toHaveCount(0)
    const [n] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM account_action_requests`)
    expect(n!.n).toBe(0)

    const id = await deletionRequest('memberC')
    await login(page.request, 'admin')
    await page.goto(`/ops/admin/accounts/${id}`)
    await page.locator('[data-action="direct-lock"]').click()
    await page.locator('[data-direct-confirm] button', { hasText: 'Xác nhận' }).click()
    await expect
      .poll(
        async () =>
          (
            await query<{ s: string }>(
              `SELECT status::text AS s FROM user_accounts WHERE id = $1`,
              [P.memberC.account],
            )
          )[0]!.s,
      )
      .toBe('BLOCKED')
  })
})

test.describe('ADMIN-PROD-07 §19–20 session invalidation and self-action', () => {
  async function consume(request: APIRequestContext, who: Person) {
    const { token } = await requestMagicLink(email(who), null)
    return request.post(`${API}/auth/magic-link/consume`, { data: { token } })
  }

  test('LOCK / DEACTIVATE end the live session and refuse a new sign-in; UNLOCK / REACTIVATE restore sign-in', async ({
    request,
    playwright,
  }) => {
    const target = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    await login(request, 'admin')
    for (const [off, on] of [
      ['lock', 'unlock'],
      ['deactivate', 'reactivate'],
    ] as const) {
      await login(target, 'memberB')
      expect((await target.get(`${API}/me/profile`)).status()).toBe(200)
      expect(
        (
          await request.post(`${API}/ops/accounts/${P.memberB.profile}/${off}`, { data: {} })
        ).status(),
      ).toBe(200)
      await envelope(await target.get(`${API}/me/profile`), 401)
      const again = await consume(target, 'memberB')
      expect(again.ok(), `${off}: new sign-in refused`).toBe(false)
      await envelope(again, again.status())
      expect(
        (
          await request.post(`${API}/ops/accounts/${P.memberB.profile}/${on}`, { data: {} })
        ).status(),
      ).toBe(200)
      expect((await consume(target, 'memberB')).status(), `${on}: sign-in works again`).toBe(200)
    }
    await target.dispose()
  })

  test('an admin cannot lock, deactivate or soft-delete their own account', async ({ request }) => {
    await login(request, 'admin')
    for (const op of ['lock', 'deactivate', 'soft-delete'])
      await envelope(
        await request.post(`${API}/ops/accounts/${P.admin.profile}/${op}`, { data: {} }),
        403,
      )
    const [a] = await query<{ s: string }>(
      `SELECT status::text AS s FROM user_accounts WHERE id = $1`,
      [P.admin.account],
    )
    expect(a!.s).toBe('ACTIVE')
  })
})

test.describe('ADMIN-PROD-07 §25 error contract', () => {
  test('400 / 401 / 403 / 404 / 409 / 422 are controlled envelopes, never a 500', async ({
    request,
  }) => {
    await envelope(
      await request.post(`${API}/auth/magic-link`, { data: { email: 'not-an-email' } }),
      400,
      'AUTH_EMAIL_INVALID',
    )
    await logout(request)
    await envelope(await request.get(`${API}/ops/feedback`), 401)
    await login(request, 'memberA')
    await envelope(await request.get(`${API}/ops/feedback`), 403, 'SCOPE_FORBIDDEN')
    await login(request, 'admin')
    await envelope(await request.get(`${API}/ops/feedback/${ZERO}`), 404)
    await envelope(await request.get(`${API}/ops/feedback/not-a-uuid`), 404)
    const fb = await feedback()
    await envelope(
      await request.patch(`${API}/ops/feedback/${fb}`, { data: { status: 'BOGUS' } }),
      422,
    )
    await envelope(await request.get(`${API}/ops/feedback?limit=999`), 422)
    await envelope(
      await request.patch(`${API}/ops/feedback/${fb}`, {
        data: '{not json',
        headers: { 'content-type': 'application/json' },
      }),
      422,
    )
    const del = await deletionRequest('memberB')
    expect(
      (
        await request.post(`${API}/ops/account-requests/${del}/decline`, {
          data: { reason: 'Nghĩa vụ lưu giữ' },
        })
      ).status(),
    ).toBe(200)
    await envelope(
      await request.post(`${API}/ops/account-requests/${del}/process`, { data: {} }),
      409,
    )
    const other = await deletionRequest('memberC')
    await envelope(
      await request.post(`${API}/ops/account-requests/${other}/decline`, { data: {} }),
      422,
    )
  })
})

async function detailIds() {
  const verification = (await fileVerification('memberC', O.CH_A)).id
  const venture = await ventureAndReview(0x71, 'memberB')
  const fb = await feedback()
  const account = await deletionRequest('memberA')
  return { verification, venture, fb, account }
}

function screens(ids: Awaited<ReturnType<typeof detailIds>>) {
  return [
    ...ADMIN_ROUTES,
    `/ops/admin/verification/${ids.verification}`,
    `/ops/admin/ventures/${ids.venture}`,
    `/ops/admin/access/${O.CH_A}`,
    `/ops/admin/feedback/${ids.fb}`,
    `/ops/admin/accounts/${ids.account}`,
  ]
}

async function settled(page: Page) {
  await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
  await expect(page.locator('main')).not.toBeEmpty()
  expect(await page.locator('main').innerText()).not.toMatch(/^\s*[{[]|"error":|undefined|NaN/)
}

test.describe('ADMIN-PROD-07 §27–28 UI states and deep links', () => {
  test('every screen deep-links, reloads and settles; filtered URLs are safe; unauthorized deep links 404', async ({
    page,
  }) => {
    const ids = await detailIds()
    await login(page.request, 'admin')
    for (const route of screens(ids)) {
      expect((await page.goto(route))?.status(), route).toBe(200)
      await settled(page)
      await page.reload()
      await settled(page)
    }
    for (const route of [
      '/ops/admin/feedback?status=DONE&priority=HIGH',
      '/ops/admin/accounts?status=DECLINED&kind=SELF_DELETION',
      '/ops/admin/verification?status=bogus',
      '/ops/admin/ventures?cursor=garbage',
    ]) {
      expect((await page.goto(route))?.status(), route).toBe(200)
      await settled(page)
    }
    for (const [route, state] of [
      [`/ops/admin/feedback/${ZERO}`, 'load-not_found'],
      [`/ops/admin/verification/${ZERO}`, 'load-not_found'],
      [`/ops/admin/accounts/${ZERO}`, 'load-not_found'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(`[data-state="${state}"]`), route).toBeVisible()
    }
    await login(page.request, 'memberA')
    for (const route of screens(ids)) expect((await page.goto(route))?.status(), route).toBe(404)
    await login(page.request, 'chALeader')
    await page.goto(`/ops/admin/access/${O.CH_B}`)
    await expect(page.locator('[data-state^="load-"]')).toBeVisible()
    await expect(page.locator('[data-grant-row]')).toHaveCount(0)
  })

  test('empty states render as text, never blank', async ({ page }) => {
    // No P0 path writes ESCALATION rows (DEC-ADM-D04): that filter is always empty.
    await login(page.request, 'admin')
    await page.goto('/ops/admin/accounts')
    await settled(page)
    await page.locator('[data-filter="kind"]').selectOption('ESCALATION')
    await expect(page.locator('[data-state="empty"]')).toBeVisible()
    await expect(page.locator('[data-request-row]')).toHaveCount(0)
  })
})

test.describe('ADMIN-PROD-07 §29 responsive smoke', () => {
  test('1440 / 1024 / 768: no horizontal overflow on any admin screen; 390 measured and classified', async ({
    page,
  }) => {
    const ids = await detailIds()
    await login(page.request, 'admin')
    const at390: Record<string, { page: number; main: number }> = {}
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      for (const route of screens(ids)) {
        await page.goto(route)
        await settled(page)
        const overflow = await page.evaluate(() => {
          const main = document.querySelector('main')!
          return {
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            main: main.scrollWidth - main.clientWidth,
          }
        })
        if (width === 390) at390[route.replace(/[0-9a-f-]{36}/, ':id')] = overflow
        // Every width, 390 included: the page itself never scrolls sideways; at
        // 390 a screen wider than the shell's ~174 px column scrolls inside it.
        expect(overflow.page, `${route} @ ${width}`).toBeLessThanOrEqual(0)
      }
    }
    // The pre-existing WF03 screen under the same shell, as the 390 baseline.
    await page.goto(`/ops/org/${O.CH_A}`)
    at390.wf03Baseline = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main:
        document.querySelector('main')!.scrollWidth - document.querySelector('main')!.clientWidth,
    }))
    matrix.responsive390 = at390
  })
})

test.describe('ADMIN-PROD-07 §30 accessibility smoke', () => {
  test('names, labels, keyboard reach and focus on every screen', async ({ page }) => {
    const ids = await detailIds()
    await login(page.request, 'admin')
    const findings: Record<string, unknown> = {}
    for (const route of screens(ids)) {
      await page.goto(route)
      await settled(page)
      const result = await page.evaluate(() => {
        const named = (el: Element) =>
          (el.textContent ?? '').trim() !== '' ||
          el.hasAttribute('aria-label') ||
          el.hasAttribute('aria-labelledby') ||
          el.hasAttribute('title')
        const unnamedButtons = [...document.querySelectorAll('main button, main a[href]')]
          .filter((el) => !named(el))
          .map((el) => el.outerHTML.slice(0, 80))
        const unlabelled = [...document.querySelectorAll('main input, main select, main textarea')]
          .filter((el) => (el as HTMLInputElement).type !== 'hidden')
          .filter(
            (el) =>
              ((el as HTMLInputElement).labels?.length ?? 0) === 0 &&
              !el.hasAttribute('aria-label') &&
              !el.hasAttribute('aria-labelledby'),
          )
          .map((el) => el.outerHTML.slice(0, 80))
        return { unnamedButtons, unlabelled, h1: document.querySelectorAll('main h1').length }
      })
      expect(result.unnamedButtons, `${route} unnamed buttons/links`).toEqual([])
      expect(result.unlabelled, `${route} unlabelled controls`).toEqual([])
      expect(result.h1, `${route} one h1`).toBe(1)
      // Keyboard: Tab reaches the main content, and the focused element shows a focus style.
      await page.locator('body').click({ position: { x: 1, y: 1 } })
      let reached = false
      for (let i = 0; i < 60 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await page.evaluate(() => !!document.activeElement?.closest('main'))
      }
      expect(reached, `${route} keyboard reaches main`).toBe(true)
      const focusStyle = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement!)
        return s.outlineStyle !== 'none' || s.boxShadow !== 'none'
      })
      expect(focusStyle, `${route} visible focus`).toBe(true)
      findings[route.replace(/[0-9a-f-]{36}/, ':id')] = 'ok'
    }
    matrix.a11y = findings
  })

  test('destructive actions confirm first; keyboard focus lands in the confirm form', async ({
    page,
  }) => {
    const ids = await detailIds()
    await login(page.request, 'admin')
    await grantAccess(
      P.admin.account,
      { organizationId: O.CH_A, granteeProfileId: P.memberC.profile, capability: 'org:read' },
      'adm07',
    )
    const cases: [string, string, string][] = [
      [`/ops/admin/access/${O.CH_A}`, '[data-action="revoke"]', '[data-revoke-confirm]'],
      [
        `/ops/admin/verification/${ids.verification}`,
        '[data-action="reject"]',
        '[data-reject-form]',
      ],
      [`/ops/admin/ventures/${ids.venture}`, '[data-action="reject"]', '[data-reject-form]'],
      [`/ops/admin/accounts/${ids.account}`, '[data-action="decline"]', '[data-decline-form]'],
      [
        `/ops/admin/accounts/${ids.account}`,
        '[data-action="direct-lock"]',
        '[data-direct-confirm]',
      ],
    ]
    for (const [route, trigger, form] of cases) {
      await page.goto(route)
      await settled(page)
      await page.locator(trigger).first().focus()
      await page.keyboard.press('Enter')
      await expect(page.locator(form), `${route} ${trigger}`).toBeVisible()
      const inside = await page.evaluate((sel) => !!document.activeElement?.closest(sel), form)
      expect(inside, `${route} ${trigger}: focus moves into the confirm form`).toBe(true)
    }
    // Nothing was decided by opening a confirm form.
    const [v] = await query<{ s: string }>(
      `SELECT status::text AS s FROM role_verification_requests WHERE id = $1`,
      [ids.verification],
    )
    const [a] = await query<{ s: string }>(
      `SELECT status::text AS s FROM user_accounts WHERE id = $1`,
      [P.memberA.account],
    )
    expect([v!.s, a!.s]).toEqual(['PENDING', 'ACTIVE'])
  })
})

test.describe('ADMIN-PROD-07 §21 audit hygiene', () => {
  test('admin audit rows carry ids, codes and reasons only — no secrets or private payloads', async ({
    request,
  }) => {
    const ids = await detailIds()
    await login(request, 'admin')
    const version = async (path: string) =>
      ((await (await request.get(path)).json()) as { version: number }).version
    const vPath = `${API}/ops/verification-requests/${ids.verification}`
    const rPath = `${API}/ops/venture-reviews/${ids.venture}`
    expect(
      (
        await request.post(`${vPath}/reject`, {
          data: { reason: 'Thiếu căn cứ', version: await version(vPath) },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await request.post(`${rPath}/approve`, { data: { version: await version(rPath) } })
      ).status(),
    ).toBe(200)
    await request.patch(`${API}/ops/feedback/${ids.fb}`, {
      data: { status: 'IN_REVIEW', priority: 'HIGH' },
    })
    await request.post(`${API}/ops/account-requests/${ids.account}/decline`, {
      data: { reason: 'Nghĩa vụ lưu giữ' },
    })
    const rows = await query<{
      action: string
      actor: string
      before_data: unknown
      after_data: unknown
    }>(
      `SELECT action, actor_account_id::text AS actor, before_data, after_data FROM audit_events
        WHERE actor_account_id = $1 ORDER BY created_at`,
      [P.admin.account],
    )
    expect(rows.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        'VERIFICATION_REQUEST_REJECTED',
        'VENTURE_REVIEW_APPROVED',
        'ACCOUNT_REQUEST_DECLINED',
      ]),
    )
    expect(rows.some((r) => r.action.startsWith('FEEDBACK_'))).toBe(true)
    const text = JSON.stringify(rows)
    expect(text).not.toMatch(
      /@example\.test|token|session|password|cookie|nút lưu không phản hồi|base64|data:image/i,
    )
  })
})
