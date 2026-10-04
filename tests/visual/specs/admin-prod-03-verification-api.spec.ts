import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

import {
  ADM_FX,
  ADM_PEOPLE,
  clearAdminFixture,
  seedAdminFixture,
} from '../../../src/lib/admin/testing'
import { fileVerificationRequest } from '../../../src/lib/admin/verification'
import { closePool, query, withTransaction } from '../../../src/lib/db/client'

/**
 * ADMIN-PROD-03 — the role verification queue over HTTP (05 §26, A9): real
 * route handlers, real session cookies, live PostgreSQL, the deterministic
 * Admin fixture. Authentication, scope (IDOR), self-approval, idempotent
 * retries, validation and the frozen error envelope. No response may be a 5xx.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
type Person = keyof typeof P
const BASE = '/api/v1/ops/verification-requests'
let statuses: { url: string; status: number }[] = []

test.beforeAll(async () => {
  await seedAdminFixture()
})

test.beforeEach(() => {
  statuses = []
})

test.afterEach(() => {
  expect(
    statuses.filter((s) => s.status >= 500),
    'no 5xx',
  ).toEqual([])
})

test.afterAll(async () => {
  await clearAdminFixture()
  await closePool()
})

async function call(
  request: APIRequestContext,
  method: 'get' | 'post',
  path: string,
  options: { data?: unknown; headers?: Record<string, string> } = {},
): Promise<APIResponse> {
  const response = await request[method](path, options)
  statuses.push({ url: path, status: response.status() })
  return response
}

async function login(request: APIRequestContext, who: Person) {
  await request.post('/api/v1/auth/logout').catch(() => undefined)
  const email = `adm02-fx-${who.toLowerCase()}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function refused(response: APIResponse, status: number, code?: string) {
  const text = await response.text()
  expect(response.status(), text).toBe(status)
  const body = JSON.parse(text) as { error: Record<string, unknown> }
  expect(Object.keys(body)).toEqual(['error'])
  if (code) expect(body.error.code).toBe(code)
  expect(response.headers()['x-request-id']).toBeTruthy()
  expect(text).not.toMatch(/stack|SELECT |INSERT |constraint|uq_|ck_|fkey|violates/i)
  return body.error as { code: string; fields?: Record<string, string> }
}

async function file(who: Person, org: string, title = 'Chủ tịch') {
  return withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P[who].account,
      body: { organization_id: org, position_title: title, period_from: '2024-01' },
      requestId: 'adm03-spec',
    }),
  )
}

async function reset() {
  await query(`DELETE FROM notifications WHERE recipient_account_id::text LIKE 'ad020000-%'`)
  await query(
    `DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
  )
  await query(`DELETE FROM community_memberships WHERE profile_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM leadership_records WHERE profile_id::text LIKE 'ad020000-%'`)
}

test.describe('ADMIN-PROD-03 verification queue API', () => {
  test.beforeEach(reset)

  test('requires a session on every endpoint', async ({ request }) => {
    await request.post('/api/v1/auth/logout').catch(() => undefined)
    const id = '00000000-0000-4000-8000-000000000000'
    await refused(await call(request, 'get', BASE), 401)
    await refused(await call(request, 'get', `${BASE}/${id}`), 401)
    await refused(
      await call(request, 'post', `${BASE}/${id}/approve`, { data: { version: 1 } }),
      401,
    )
    await refused(
      await call(request, 'post', `${BASE}/${id}/reject`, { data: { version: 1 } }),
      401,
    )
  })

  test('scopes the queue and the detail on the server (IDOR)', async ({ request }) => {
    const chA = await file('memberA', O.CLB_A2) // → Chapter A by fallback
    const chB = await file('memberB', O.CH_B)
    await login(request, 'memberC')
    await refused(await call(request, 'get', BASE), 403, 'SCOPE_FORBIDDEN')
    await refused(await call(request, 'get', `${BASE}/${chA.id}`), 404)

    await login(request, 'chALeader')
    const list = await call(request, 'get', `${BASE}?organization_id=${O.CLB_A2}`)
    expect(list.status()).toBe(200)
    const body = (await list.json()) as {
      items: { id: string; fallback: boolean }[]
      page: { next_cursor: string | null; limit: number }
      counts: { pending: number }
    }
    expect(body.items.map((i) => [i.id, i.fallback])).toEqual([[chA.id, true]])
    expect(body.page).toEqual({ next_cursor: null, limit: 20 })
    expect(body.counts).toEqual({ pending: 1 })
    expect((await call(request, 'get', `${BASE}/${chA.id}`)).status()).toBe(200)
    await refused(await call(request, 'get', `${BASE}/${chB.id}`), 404)
    await refused(await call(request, 'get', `${BASE}?routed_to=${O.CH_B}`), 403, 'SCOPE_FORBIDDEN')
    await refused(
      await call(request, 'post', `${BASE}/${chB.id}/approve`, { data: { version: 1 } }),
      404,
    )
    // A spoofed scope in headers or the body changes nothing.
    await refused(
      await call(request, 'get', `${BASE}/${chB.id}`, {
        headers: { 'x-organization-id': O.CH_B, 'x-role': 'PLATFORM_ADMIN' },
      }),
      404,
    )
    const spoof = await refused(
      await call(request, 'post', `${BASE}/${chA.id}/approve`, {
        data: { version: 1, routed_to: O.CH_A },
      }),
      422,
      'PROFILE_VALIDATION_FAILED',
    )
    expect(spoof.fields).toEqual({ routed_to: 'not_accepted' })
  })

  test('approves once; an Idempotency-Key retry replays; a second approve is 409', async ({
    request,
  }) => {
    const target = await file('memberA', O.CH_A)
    await login(request, 'chALeader')
    const headers = { 'Idempotency-Key': `adm03-${target.id}` }
    const first = await call(request, 'post', `${BASE}/${target.id}/approve`, {
      data: { version: 1 },
      headers,
    })
    expect(first.status()).toBe(200)
    const approved = (await first.json()) as { status: string; version: number }
    expect(approved).toMatchObject({ status: 'APPROVED', version: 2 })
    const replay = await call(request, 'post', `${BASE}/${target.id}/approve`, {
      data: { version: 1 },
      headers,
    })
    expect(replay.status()).toBe(200)
    expect(await replay.json()).toEqual(await first.json())
    await refused(
      await call(request, 'post', `${BASE}/${target.id}/approve`, {
        data: { version: 2 },
        headers,
      }),
      409,
    )
    await refused(
      await call(request, 'post', `${BASE}/${target.id}/approve`, { data: { version: 2 } }),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM community_memberships WHERE profile_id = $1 AND organization_id = $2`,
      [P.memberA.profile, O.CH_A],
    )
    expect(n!.n).toBe(1)
  })

  test('rejects with an optional reason; validation is a controlled 422', async ({ request }) => {
    const target = await file('memberB', O.HUB)
    await login(request, 'hubLeader')
    await refused(
      await call(request, 'post', `${BASE}/${target.id}/reject`, {
        data: '{not json',
        headers: { 'content-type': 'application/json' },
      }),
      422,
    )
    await refused(
      await call(request, 'post', `${BASE}/${target.id}/reject`, {
        data: { version: 1, reason: 'x'.repeat(501) },
      }),
      422,
    )
    const done = await call(request, 'post', `${BASE}/${target.id}/reject`, {
      data: { version: 1, reason: 'Không có trong danh sách' },
    })
    expect(done.status()).toBe(200)
    expect(await done.json()).toMatchObject({
      status: 'REJECTED',
      reject_reason: 'Không có trong danh sách',
    })
    await refused(await call(request, 'get', `${BASE}?status=DONE`), 422)
    await refused(await call(request, 'get', `${BASE}/not-a-uuid`), 404)
  })

  test('never lets the requester decide their own request', async ({ request }) => {
    const own = await file('admin', O.HUB)
    await login(request, 'admin')
    const detail = await call(request, 'get', `${BASE}/${own.id}`)
    expect(await detail.json()).toMatchObject({ status: 'PENDING', can_act: false })
    await refused(
      await call(request, 'post', `${BASE}/${own.id}/approve`, { data: { version: 1 } }),
      403,
      'SCOPE_FORBIDDEN',
    )
    await refused(
      await call(request, 'post', `${BASE}/${own.id}/reject`, { data: { version: 1 } }),
      403,
      'SCOPE_FORBIDDEN',
    )
    // With an Idempotency-Key the refusal and its audit row happen before the idempotent run.
    await refused(
      await call(request, 'post', `${BASE}/${own.id}/approve`, {
        data: { version: 1 },
        headers: { 'Idempotency-Key': `adm03-self-${own.id}` },
      }),
      403,
      'SCOPE_FORBIDDEN',
    )
    const [audited] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events
        WHERE resource_id = $1 AND action = 'VERIFICATION_REQUEST_SELF_ACTION_REFUSED'`,
      [own.id],
    )
    expect(audited!.n).toBe(3)
  })
})
