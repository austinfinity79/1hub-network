import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

import { requestAccountDeletion } from '../../../src/lib/account/settings'
import {
  ADM_FX,
  ADM_PEOPLE,
  clearAdminFixture,
  seedAdminFixture,
} from '../../../src/lib/admin/testing'
import { closePool, query } from '../../../src/lib/db/client'
import { removeAsset, saveAvatarAsset } from '../../../src/lib/media/avatar-storage'

/**
 * ADMIN-PROD-05 — feedback, categories and account operations over HTTP (05 §28,
 * A11): real handlers, session cookies, live PostgreSQL. Authentication,
 * PLATFORM_ADMIN-only access, a locked account's live session refused, the
 * screenshot media rule, idempotent account actions, validation and the frozen
 * envelope. No response may be a 5xx.
 */

const P = ADM_PEOPLE
const O = ADM_FX.org
type Person = keyof typeof P
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 5])
let statuses: { url: string; status: number }[] = []
const assets: string[] = []

test.beforeAll(async () => {
  await seedAdminFixture()
})

test.beforeEach(async () => {
  statuses = []
  await seedAdminFixture()
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'ADM05 HTTP%'`)
})

test.afterEach(() => {
  expect(
    statuses.filter((s) => s.status >= 500),
    'no 5xx',
  ).toEqual([])
})

test.afterAll(async () => {
  for (const id of assets) await removeAsset(id)
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'ADM05 HTTP%'`)
  await clearAdminFixture()
  await closePool()
})

async function call(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put',
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
  if (status === 404 && !text.startsWith('{')) return
  const body = JSON.parse(text) as { error: Record<string, unknown> }
  expect(Object.keys(body)).toEqual(['error'])
  if (code) expect(body.error.code).toBe(code)
  expect(text).not.toMatch(/stack|SELECT |UPDATE |constraint|ck_|fkey|violates/i)
}

async function feedback(screenshot: string | null = null) {
  const [row] = await query<{ id: string }>(
    `INSERT INTO feedback_submissions (account_id, profile_id, body, type, screenshot_asset_id)
     VALUES ($1, $2, 'ADM05 HTTP lỗi lưu', 'BUG', $3) RETURNING id::text`,
    [P.memberA.account, P.memberA.profile, screenshot],
  )
  return row!.id
}

test.describe('ADMIN-PROD-05 operations API', () => {
  test('requires a session; leaders and members are refused everywhere', async ({ request }) => {
    const id = await feedback()
    await request.post('/api/v1/auth/logout').catch(() => undefined)
    for (const path of [
      '/api/v1/ops/feedback',
      `/api/v1/ops/feedback/${id}`,
      '/api/v1/ops/categories/DOMAIN',
      '/api/v1/ops/account-requests',
    ])
      await refused(await call(request, 'get', path), 401)
    await refused(
      await call(request, 'post', `/api/v1/ops/accounts/${P.memberB.profile}/lock`),
      401,
    )

    await login(request, 'chALeader')
    await refused(await call(request, 'get', '/api/v1/ops/feedback'), 403, 'SCOPE_FORBIDDEN')
    await refused(await call(request, 'get', `/api/v1/ops/feedback/${id}`), 404)
    await refused(
      await call(request, 'patch', `/api/v1/ops/feedback/${id}`, { data: { status: 'IN_REVIEW' } }),
      404,
    )
    await refused(await call(request, 'get', '/api/v1/ops/categories/DOMAIN'), 403)
    await refused(
      await call(request, 'post', `/api/v1/ops/accounts/${P.memberB.profile}/lock`),
      403,
    )
    await refused(
      await call(request, 'post', '/api/v1/ops/accounts/00000000-0000-4000-8000-000000000000/lock'),
      403,
    )
    await refused(await call(request, 'get', '/api/v1/ops/account-requests'), 403)
  })

  test('ADMIN-DECISION-04: no leader account-escalation route exists, for anyone', async ({
    request,
  }) => {
    const path = `/api/v1/ops/organizations/${O.CH_A}/members/${P.memberB.profile}/account-requests`
    for (const who of ['chALeader', 'hubLeader', 'clbA1Leader', 'memberA', 'admin'] as const) {
      await login(request, who)
      for (const action of ['LOCK', 'DEACTIVATE', 'SOFT_DELETE']) {
        const response = await call(request, 'post', path, { data: { action, reason: 'x' } })
        expect([404, 405], `${who} ${action}`).toContain(response.status())
        expect(await response.text()).not.toMatch(/stack|SELECT |constraint/i)
      }
    }
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM account_action_requests WHERE target_account_id = $1`,
      [P.memberB.account],
    )
    expect(n!.n).toBe(0)
  })

  test('triages feedback and reads the weekly summary; managers see the screenshot', async ({
    request,
  }) => {
    const shot = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    assets.push(shot)
    const id = await feedback(shot)
    await login(request, 'memberC')
    await refused(await call(request, 'get', `/media/assets/${shot}`), 404)
    // Not even its uploader: a screenshot is for feedback managers only.
    await login(request, 'memberA')
    await refused(await call(request, 'get', `/media/assets/${shot}`), 404)
    await login(request, 'admin')
    expect((await call(request, 'get', `/media/assets/${shot}`)).status()).toBe(200)
    const updated = await call(request, 'patch', `/api/v1/ops/feedback/${id}`, {
      data: { status: 'IN_REVIEW', priority: 'HIGH', owner_profile_id: P.admin.profile },
    })
    expect(updated.status()).toBe(200)
    expect(await updated.json()).toMatchObject({
      status: 'IN_REVIEW',
      priority: 'HIGH',
      owner: { profile_id: P.admin.profile },
    })
    await refused(
      await call(request, 'patch', `/api/v1/ops/feedback/${id}`, { data: { status: 'NEW' } }),
      409,
    )
    await refused(
      await call(request, 'patch', `/api/v1/ops/feedback/${id}`, {
        data: '{bad',
        headers: { 'content-type': 'application/json' },
      }),
      422,
    )
    const summary = await call(request, 'get', '/api/v1/ops/feedback/summary')
    expect(summary.status()).toBe(200)
    expect(Object.keys(await summary.json())).toEqual([
      'week',
      'from',
      'to',
      'total',
      'by_type',
      'by_priority',
      'by_owner',
    ])
    await refused(await call(request, 'get', '/api/v1/ops/feedback/summary?week=2025-W53'), 422)
  })

  test('categories: list, archive / activate, refuse a whole-type order that is incomplete', async ({
    request,
  }) => {
    await login(request, 'admin')
    const list = await call(request, 'get', '/api/v1/ops/categories/SKILL')
    const items = ((await list.json()) as { items: { id: string; label: string }[] }).items
    const first = items[0]!
    const archived = await call(request, 'patch', `/api/v1/ops/categories/SKILL/${first.id}`, {
      data: { status: 'ARCHIVED' },
    })
    expect(await archived.json()).toMatchObject({ id: first.id, status: 'ARCHIVED' })
    const active = await call(request, 'patch', `/api/v1/ops/categories/SKILL/${first.id}`, {
      data: { status: 'ACTIVE' },
    })
    expect(await active.json()).toMatchObject({ status: 'ACTIVE' })
    await refused(
      await call(request, 'put', '/api/v1/ops/categories/SKILL/order', {
        data: { ids: [first.id] },
      }),
      422,
    )
    await refused(await call(request, 'get', '/api/v1/ops/categories/INDUSTRY'), 404)
  })

  test('locking ends the target’s live session; idempotent retry; never oneself', async ({
    request,
    playwright,
  }) => {
    const target = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    await login(target, 'memberB')
    expect((await target.get('/api/v1/me/profile')).status()).toBe(200)

    await login(request, 'admin')
    const headers = { 'Idempotency-Key': `adm05-lock-${P.memberB.profile}` }
    const locked = await call(request, 'post', `/api/v1/ops/accounts/${P.memberB.profile}/lock`, {
      data: { reason: 'Spam' },
      headers,
    })
    expect(locked.status()).toBe(200)
    expect(await locked.json()).toMatchObject({ account_status: 'BLOCKED', changed: true })
    const replay = await call(request, 'post', `/api/v1/ops/accounts/${P.memberB.profile}/lock`, {
      data: { reason: 'Spam' },
      headers,
    })
    expect(await replay.json()).toEqual(await locked.json())
    expect((await target.get('/api/v1/me/profile')).status()).toBe(401)
    const session = (await (await target.get('/api/v1/session')).json()) as {
      capabilities?: unknown
    }
    expect(session.capabilities).toBeUndefined()
    // A new sign-in is refused too (AUTH_ACCOUNT_BLOCKED, proven in account-ops.db-test.ts).
    expect(
      (await target.post('/dev/login', { data: { email: 'adm02-fx-memberb@example.test' } })).ok(),
    ).toBe(false)
    await target.dispose()

    await refused(
      await call(request, 'post', `/api/v1/ops/accounts/${P.admin.profile}/deactivate`),
      403,
      'SCOPE_FORBIDDEN',
    )
    await refused(
      await call(request, 'post', `/api/v1/ops/accounts/${P.admin.profile}/lock`, {
        headers: { 'Idempotency-Key': 'adm05-self' },
      }),
      403,
    )
    await refused(
      await call(request, 'post', `/api/v1/ops/accounts/${P.memberB.profile}/lock`, {
        data: { delete: true },
      }),
      422,
    )
  })

  test('a deletion request is rejected only with a reason; the decision is final; leaders cannot decide', async ({
    request,
  }) => {
    await requestAccountDeletion(P.memberC.account, 'adm05-http')
    const [row] = await query<{ id: string }>(
      `SELECT id::text FROM account_deletion_requests WHERE account_id = $1`,
      [P.memberC.account],
    )
    const decline = `/api/v1/ops/account-requests/${row!.id}/decline`
    await login(request, 'chALeader')
    await refused(await call(request, 'post', decline, { data: { reason: 'Không' } }), 404)

    await login(request, 'admin')
    const missing = await call(request, 'post', decline)
    await refused(missing, 422)
    expect(((await missing.json()) as { error: { fields: unknown } }).error.fields).toEqual({
      reason: 'required',
    })
    await refused(await call(request, 'post', decline, { data: { reason: '  ' } }), 422)
    const headers = { 'Idempotency-Key': `adm05-decline-${row!.id}` }
    const data = { reason: 'Nghĩa vụ lưu giữ pháp lý: hồ sơ đang có tranh chấp.' }
    const rejected = await call(request, 'post', decline, { data, headers })
    expect(rejected.status()).toBe(200)
    expect(await rejected.json()).toMatchObject({ kind: 'SELF_DELETION', status: 'DECLINED' })
    const replay = await call(request, 'post', decline, { data, headers })
    expect(await replay.json()).toEqual(await rejected.json())
    await refused(
      await call(request, 'post', `/api/v1/ops/account-requests/${row!.id}/process`),
      409,
    )
    const [account] = await query<{ status: string }>(
      `SELECT status::text AS status FROM user_accounts WHERE id = $1`,
      [P.memberC.account],
    )
    expect(account!.status).toBe('ACTIVE')
  })
})
