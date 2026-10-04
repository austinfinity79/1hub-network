import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

import {
  ADM_FX,
  ADM_PEOPLE,
  clearAdminFixture,
  seedAdminFixture,
} from '../../../src/lib/admin/testing'
import { saveVentureCore, submitVentureForReview } from '../../../src/lib/admin/venture-submission'
import { closePool, query, withTransaction } from '../../../src/lib/db/client'
import { LIBRARY_FX } from '../../../src/lib/library/testing'
import { removeAsset, saveAvatarAsset } from '../../../src/lib/media/avatar-storage'

/**
 * ADMIN-PROD-04 — venture review and organization access over HTTP (05 §27,
 * A10): real handlers, session cookies, live PostgreSQL, the Admin fixture.
 * Authentication, scope / IDOR, idempotent decisions, the reviewer's logo view,
 * validation and the frozen envelope. No response may be a 5xx.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
type Person = keyof typeof P
const VR = '/api/v1/ops/venture-reviews'
const access = (org: string) => `/api/v1/ops/organizations/${org}/access`
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9])
let statuses: { url: string; status: number }[] = []
const assets: string[] = []

test.beforeAll(async () => {
  await seedAdminFixture()
})

test.beforeEach(async () => {
  statuses = []
  await query(`DELETE FROM venture_reviews WHERE venture_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM projects WHERE id::text LIKE 'ad020000-%'`)
  await query(
    `DELETE FROM role_assignments WHERE individual_profile_id::text LIKE 'ad020000-%' AND assigned_by IS NOT NULL`,
  )
})

test.afterEach(() => {
  expect(
    statuses.filter((s) => s.status >= 500),
    'no 5xx',
  ).toEqual([])
})

test.afterAll(async () => {
  for (const id of assets) await removeAsset(id)
  await query(`DELETE FROM venture_reviews WHERE venture_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM projects WHERE id::text LIKE 'ad020000-%'`)
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
  if (status === 404 && !text.startsWith('{')) return
  const body = JSON.parse(text) as { error: Record<string, unknown> }
  expect(Object.keys(body)).toEqual(['error'])
  if (code) expect(body.error.code).toBe(code)
  expect(text).not.toMatch(/stack|SELECT |INSERT |constraint|uq_|ck_|fkey|violates/i)
}

/** A PUBLIC venture of memberA with a pending core change (new name and logo). */
async function pendingChange(n: number) {
  const id = `ad020000-0000-4000-8000-000000000e0${n}`
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, owner_role_label,
                           status, visibility)
     VALUES ($1, 'STARTUP', $2, $3, 'ADM04 Http', 'Mô tả', $4, 'Founder', 'ACTIVE', 'PUBLIC')`,
    [id, P.memberA.profile, `adm04-http-${n}`, LIBRARY_FX.stage.MVP],
  )
  const logo = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
  assets.push(logo)
  const result = await withTransaction((exec) =>
    saveVentureCore(exec, {
      accountId: P.memberA.account,
      ventureId: id,
      body: { name: 'ADM04 Http 2', logo_asset_id: logo },
      requestId: 'adm04-spec',
    }),
  )
  return { ventureId: id, reviewId: (result as { review: { id: string } }).review.id, logo }
}

test.describe('ADMIN-PROD-04 venture review API', () => {
  test('requires a session and the platform reviewer', async ({ request }) => {
    const { reviewId } = await pendingChange(1)
    await request.post('/api/v1/auth/logout').catch(() => undefined)
    await refused(await call(request, 'get', VR), 401)
    await refused(await call(request, 'get', `${VR}/${reviewId}`), 401)
    await refused(
      await call(request, 'post', `${VR}/${reviewId}/approve`, { data: { version: 1 } }),
      401,
    )
    await login(request, 'chALeader')
    await refused(await call(request, 'get', VR), 403, 'SCOPE_FORBIDDEN')
    await refused(await call(request, 'get', `${VR}/${reviewId}`), 404)
    await refused(
      await call(request, 'post', `${VR}/${reviewId}/reject`, { data: { version: 1 } }),
      404,
    )
  })

  test('the reviewer sees the diff and the logo, approves once (idempotent retry)', async ({
    request,
  }) => {
    const { reviewId, logo, ventureId } = await pendingChange(2)
    await login(request, 'memberC')
    await refused(await call(request, 'get', `/media/assets/${logo}`), 404)
    await login(request, 'admin')
    expect((await call(request, 'get', `/media/assets/${logo}`)).status()).toBe(200)
    const detail = await call(request, 'get', `${VR}/${reviewId}`)
    expect(await detail.json()).toMatchObject({
      kind: 'CORE_CHANGE',
      public_version: { name: 'ADM04 Http' },
      proposed: { name: 'ADM04 Http 2', logo_asset_id: logo },
      diff: [
        { field: 'name', before: 'ADM04 Http', after: 'ADM04 Http 2' },
        { field: 'logo_asset_id', before: null, after: logo },
      ],
    })
    const headers = { 'Idempotency-Key': `adm04-${reviewId}` }
    const first = await call(request, 'post', `${VR}/${reviewId}/approve`, {
      data: { version: 1 },
      headers,
    })
    expect(first.status()).toBe(200)
    const replay = await call(request, 'post', `${VR}/${reviewId}/approve`, {
      data: { version: 1 },
      headers,
    })
    expect(await replay.json()).toEqual(await first.json())
    await refused(
      await call(request, 'post', `${VR}/${reviewId}/approve`, { data: { version: 2 } }),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    const [row] = await query<{ name: string; logo: string }>(
      `SELECT name, logo_asset_id AS logo FROM projects WHERE id = $1`,
      [ventureId],
    )
    expect(row).toEqual({ name: 'ADM04 Http 2', logo })
  })

  test('validates bodies and parameters with a controlled 422', async ({ request }) => {
    const { reviewId } = await pendingChange(3)
    await login(request, 'admin')
    for (const data of [{}, { version: 1, scope: 'x' }, { version: 1, reason: 'x'.repeat(501) }]) {
      await refused(await call(request, 'post', `${VR}/${reviewId}/reject`, { data }), 422)
    }
    await refused(
      await call(request, 'post', `${VR}/${reviewId}/approve`, {
        data: '{oops',
        headers: { 'content-type': 'application/json' },
      }),
      422,
    )
    await refused(await call(request, 'get', `${VR}?status=OPEN`), 422)
    await refused(await call(request, 'get', `${VR}/not-a-uuid`), 404)
  })

  test('submission stays the owner-side writer; the admin cannot review own work', async ({
    request,
  }) => {
    const own = 'ad020000-0000-4000-8000-000000000e09'
    await query(
      `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, owner_role_label)
       VALUES ($1, 'PROJECT', $2, 'adm04-http-own', 'ADM04 Own', 'Mô tả', $3, 'Founder')`,
      [own, P.admin.profile, LIBRARY_FX.stage.IDEA],
    )
    await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
      own,
      LIBRARY_FX.domain.govtech,
    ])
    const review = await withTransaction((exec) =>
      submitVentureForReview(exec, {
        accountId: P.admin.account,
        ventureId: own,
        requestId: 'adm04-spec',
      }),
    )
    await login(request, 'admin')
    await refused(
      await call(request, 'post', `${VR}/${review.id}/approve`, {
        data: { version: 1 },
        headers: { 'Idempotency-Key': `adm04-own-${review.id}` },
      }),
      403,
      'SCOPE_FORBIDDEN',
    )
  })
})

test.describe('ADMIN-PROD-04 organization access API', () => {
  test('lists, grants, revokes within scope; IDOR and forged bodies refused', async ({
    request,
  }) => {
    await request.post('/api/v1/auth/logout').catch(() => undefined)
    await refused(await call(request, 'get', access(O.CLB_A1)), 401)

    await login(request, 'chBLeader')
    await refused(await call(request, 'get', access(O.CLB_A1)), 403, 'SCOPE_FORBIDDEN')
    await refused(
      await call(request, 'post', access(O.CLB_A1), {
        data: { grantee_profile_id: P.memberA.profile, capability: 'member:read' },
      }),
      403,
      'SCOPE_FORBIDDEN',
    )

    await login(request, 'chALeader')
    const created = await call(request, 'post', access(O.CLB_A1), {
      data: { grantee_profile_id: P.memberA.profile, capability: 'member:read' },
      headers: { 'Idempotency-Key': 'adm04-grant-1' },
    })
    expect(created.status()).toBe(201)
    const grant = (await created.json()) as { id: string }
    const replay = await call(request, 'post', access(O.CLB_A1), {
      data: { grantee_profile_id: P.memberA.profile, capability: 'member:read' },
      headers: { 'Idempotency-Key': 'adm04-grant-1' },
    })
    expect(replay.status()).toBe(201)
    expect(await replay.json()).toEqual(grant)
    await refused(
      await call(request, 'post', access(O.CLB_A1), {
        data: { grantee_profile_id: P.memberA.profile, capability: 'member:read' },
      }),
      409,
    )
    await refused(
      await call(request, 'post', access(O.CLB_A1), {
        data: { grantee_profile_id: P.memberA.profile, capability: 'access:delegate' },
      }),
      422,
    )
    await refused(
      await call(request, 'post', access(O.CLB_A1), {
        data: { grantee_profile_id: P.memberA.profile, scope_id: O.HUB },
      }),
      422,
    )
    await refused(
      await call(request, 'post', access(O.HUB), {
        data: { grantee_profile_id: P.memberA.profile },
      }),
      403,
    )

    const listed = await call(request, 'get', access(O.CLB_A1))
    expect(((await listed.json()) as { items: { id: string }[] }).items.map((i) => i.id)).toContain(
      grant.id,
    )
    await refused(await call(request, 'post', `${access(O.CLB_A2)}/${grant.id}/revoke`), 404)
    const revoked = await call(request, 'post', `${access(O.CLB_A1)}/${grant.id}/revoke`)
    expect(revoked.status()).toBe(200)
    expect(await revoked.json()).toMatchObject({ state: 'CLOSED' })
    await refused(await call(request, 'post', `${access(O.CLB_A1)}/${grant.id}/revoke`), 409)
    const history = await call(request, 'get', `${access(O.CLB_A1)}/history`)
    expect(
      ((await history.json()) as { items: { event: string; grant_id: string }[] }).items
        .filter((h) => h.grant_id === grant.id)
        .map((h) => h.event),
    ).toEqual(['GRANTED', 'REVOKED'])
  })
})
