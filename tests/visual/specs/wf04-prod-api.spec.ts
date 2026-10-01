import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'

/**
 * WF04-PROD-03 — `/api/v1/programmes*` over HTTP (API 05 §22, amendment A5;
 * WF04 production contract §5, §12–§14, §17). Real route handlers, real
 * session cookies, live PostgreSQL: authentication, RBAC on the stored owner,
 * header / query / body spoofing, IDOR, malformed ids, the lifecycle, the
 * idempotency replay, the error envelope and field leakage. No response may be
 * a 5xx.
 */

const API = '/api/v1/programmes'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001' // PUBLISHED, Chapter 01, form v1
const MEMBER = 'member@example.test'
const LEADER = 'leader@example.test' // HUB_COMMUNITY_LEADER of Chapter 01
const ADMIN = 'ops@example.test' // PLATFORM_ADMIN

const created: string[] = []
let statuses: { url: string; status: number }[] = []

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
  await query('DELETE FROM applications WHERE programme_id = ANY($1::uuid[])', [created])
  await query('DELETE FROM programme_application_forms WHERE programme_id = ANY($1::uuid[])', [
    created,
  ])
  await query('DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])', [created])
  await query('DELETE FROM programmes WHERE id = ANY($1::uuid[])', [created])
  await query(`DELETE FROM idempotency_keys WHERE operation LIKE 'programme.%'`)
  await closePool()
})

type Method = 'get' | 'post' | 'patch' | 'put'

async function call(
  request: APIRequestContext,
  method: Method,
  path: string,
  options: { data?: unknown; headers?: Record<string, string> } = {},
): Promise<APIResponse> {
  const response = await request[method](path, options)
  statuses.push({ url: path, status: response.status() })
  return response
}

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function expectError(response: APIResponse, status: number, code: string) {
  expect(response.status(), await response.text()).toBe(status)
  const body = (await response.json()) as { error: { code: string; request_id: string } }
  expect(body.error.code).toBe(code)
  expect(body.error.request_id).toBe(response.headers()['x-request-id'])
}

const createBody = (name: string, organization_id = CHAPTER_01, type = 'PROGRAMME') => ({
  type,
  organization_id,
  name,
})

async function createAs(request: APIRequestContext, email: string, body: object) {
  await login(request, email)
  const response = await call(request, 'post', API, { data: body })
  expect(response.status(), await response.text()).toBe(201)
  const id = ((await response.json()) as { programme: { id: string } }).programme.id
  created.push(id)
  return id
}

const ENDPOINTS = (id: string): [Method, string, unknown][] => [
  ['get', `${API}/${id}`, undefined],
  ['patch', `${API}/${id}`, { name: 'Đổi tên' }],
  ['put', `${API}/${id}/registration`, { applicant_types: ['TEAM'], questions: [] }],
  ['post', `${API}/${id}/publish`, undefined],
  ['post', `${API}/${id}/close`, undefined],
]

test.describe('WF04-PROD-03 programme API — authentication and RBAC', () => {
  test('a guest gets 401 on every endpoint and nothing is written', async ({ request }) => {
    const before = await query('SELECT count(*)::int AS n FROM programmes')
    await expectError(await call(request, 'get', API), 401, 'UNCONTRACTED_UNAUTHENTICATED')
    await expectError(
      await call(request, 'post', API, { data: createBody('Khách') }),
      401,
      'UNCONTRACTED_UNAUTHENTICATED',
    )
    for (const [method, path, data] of ENDPOINTS(SEED_PROGRAMME)) {
      await expectError(
        await call(request, method, path, { data }),
        401,
        'UNCONTRACTED_UNAUTHENTICATED',
      )
    }
    expect(await query('SELECT count(*)::int AS n FROM programmes')).toEqual(before)
  })

  test('a member: list 403, every programme 404, create 403 — spoofed headers, query and body change nothing', async ({
    request,
  }) => {
    await login(request, MEMBER)
    const spoof = {
      'x-role': 'PLATFORM_ADMIN',
      'x-roles': 'PLATFORM_ADMIN',
      'x-capabilities': 'programme:manage,programme:read',
      'x-scope-type': 'PLATFORM',
      'x-organization-id': CHAPTER_01,
    }
    const [seed] = await query(
      'SELECT name, status::text, updated_at FROM programmes WHERE id = $1',
      [SEED_PROGRAMME],
    )
    for (const headers of [{}, spoof]) {
      await expectError(
        await call(request, 'get', `${API}?role=PLATFORM_ADMIN&scope=PLATFORM`, { headers }),
        403,
        'SCOPE_FORBIDDEN',
      )
      await expectError(
        await call(request, 'post', API, {
          headers,
          data: { ...createBody('Giả mạo'), role: 'PLATFORM_ADMIN' },
        }),
        403,
        'SCOPE_FORBIDDEN',
      )
      for (const [method, path, data] of ENDPOINTS(SEED_PROGRAMME)) {
        await expectError(
          await call(request, method, path, { data, headers }),
          404,
          'UNCONTRACTED_NOT_FOUND',
        )
      }
    }
    expect(
      await query('SELECT name, status::text, updated_at FROM programmes WHERE id = $1', [
        SEED_PROGRAMME,
      ]),
    ).toEqual([seed])
  })

  test('a leader of another unit gets the same 404 on a programme it does not own (IDOR)', async ({
    request,
  }) => {
    const foreign = await createAs(request, ADMIN, createBody('Chapter 02 programme', CHAPTER_02))
    await login(request, LEADER)
    for (const [method, path, data] of ENDPOINTS(foreign)) {
      await expectError(await call(request, method, path, { data }), 404, 'UNCONTRACTED_NOT_FOUND')
    }
    await expectError(
      await call(request, 'post', API, { data: createBody('Lấn sân', CHAPTER_02) }),
      403,
      'SCOPE_FORBIDDEN',
    )
    const list = (await (await call(request, 'get', API)).json()) as { items: { id: string }[] }
    expect(list.items.map((p) => p.id)).not.toContain(foreign)
    const [row] = await query<{ status: string; name: string }>(
      'SELECT status::text, name FROM programmes WHERE id = $1',
      [foreign],
    )
    expect(row).toEqual({ status: 'DRAFT', name: 'Chapter 02 programme' })
  })
})

test.describe('WF04-PROD-03 programme API — lifecycle, idempotency, validation', () => {
  test('create → edit → registration → publish → close, with idempotent replays and 409 repeats', async ({
    request,
  }) => {
    await login(request, LEADER)
    const key = `prod03-${Date.now()}`
    const body = createBody('Chương trình HTTP', CHAPTER_01, 'CHALLENGE')

    const first = await call(request, 'post', API, {
      data: body,
      headers: { 'Idempotency-Key': key },
    })
    expect(first.status()).toBe(201)
    const id = ((await first.json()) as { programme: { id: string } }).programme.id
    created.push(id)
    const replay = await call(request, 'post', API, {
      data: body,
      headers: { 'Idempotency-Key': key },
    })
    expect(replay.status()).toBe(201)
    expect(((await replay.json()) as { programme: { id: string } }).programme.id).toBe(id)
    await expectError(
      await call(request, 'post', API, {
        data: { ...body, name: 'Khác' },
        headers: { 'Idempotency-Key': key },
      }),
      409,
      'UNCONTRACTED_IDEMPOTENCY_CONFLICT',
    )
    expect(
      await query(`SELECT count(*)::int AS n FROM programmes WHERE name = 'Chương trình HTTP'`),
    ).toEqual([{ n: 1 }])

    const edited = await call(request, 'patch', `${API}/${id}`, {
      data: {
        stages: [{ name: 'Giai đoạn 1', starts_on: '2026-11-01', ends_on: '2026-11-30' }],
        problem_statements: [{ title: 'Bài toán HTTP' }],
      },
    })
    expect(edited.status(), await edited.text()).toBe(200)
    const registration = await call(request, 'put', `${API}/${id}/registration`, {
      data: {
        applicant_types: ['TEAM', 'STARTUP'],
        questions: [{ id: 'q-http', prompt: 'Vấn đề?', required: true, step: 1 }],
      },
    })
    expect(registration.status(), await registration.text()).toBe(200)

    const publishKey = `${key}-publish`
    const published = await call(request, 'post', `${API}/${id}/publish`, {
      headers: { 'Idempotency-Key': publishKey },
    })
    expect(published.status(), await published.text()).toBe(200)
    expect(
      (
        await call(request, 'post', `${API}/${id}/publish`, {
          headers: { 'Idempotency-Key': publishKey },
        })
      ).status(),
    ).toBe(200)
    await expectError(
      await call(request, 'post', `${API}/${id}/publish`),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )

    const closeKey = `${key}-close`
    expect(
      (
        await call(request, 'post', `${API}/${id}/close`, {
          headers: { 'Idempotency-Key': closeKey },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await call(request, 'post', `${API}/${id}/close`, {
          headers: { 'Idempotency-Key': closeKey },
        })
      ).status(),
    ).toBe(200)
    await expectError(
      await call(request, 'post', `${API}/${id}/close`),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    await expectError(
      await call(request, 'patch', `${API}/${id}`, { data: { name: 'Sau khi đóng' } }),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )

    const detail = (await (await call(request, 'get', `${API}/${id}`)).json()) as {
      programme: { status: string }
      stages: unknown[]
      problem_statements: unknown[]
      registration: { version: number }
    }
    expect(detail.programme.status).toBe('CLOSED')
    expect(detail.stages).toHaveLength(1)
    expect(detail.problem_statements).toHaveLength(1)
    expect(detail.registration.version).toBe(1)

    // One audit event per state change, replays included.
    const actions = await query<{ action: string; n: number }>(
      `SELECT action, count(*)::int AS n FROM audit_events WHERE resource_id = $1 GROUP BY action ORDER BY action`,
      [id],
    )
    expect(actions).toEqual([
      { action: 'PROGRAMME_CLOSED', n: 1 },
      { action: 'PROGRAMME_CREATED', n: 1 },
      { action: 'PROGRAMME_PUBLISHED', n: 1 },
      { action: 'PROGRAMME_REGISTRATION_UPDATED', n: 1 },
      { action: 'PROGRAMME_UPDATED', n: 1 },
    ])
  })

  test('validation answers 422 with the failing field; type and owner are immutable', async ({
    request,
  }) => {
    const id = await createAs(request, LEADER, createBody('Kiểm tra dữ liệu'))
    const cases: [Method, string, unknown, Record<string, string>][] = [
      ['post', API, { ...createBody(''), name: '' }, { name: 'required' }],
      // Input PostgreSQL cannot store is a 422, never a 500 (review M1 / L5).
      ['post', API, { ...createBody('a\u0000b') }, { name: 'invalid' }],
      [
        'post',
        API,
        { ...createBody('x'), starts_at: '0000-01-01T00:00Z' },
        { starts_at: 'invalid' },
      ],
      [
        'post',
        API,
        { ...createBody('x'), starts_at: '2026-02-30T10:00Z' },
        { starts_at: 'invalid' },
      ],
      ['patch', `${API}/${id}`, { stages: [{ name: 'x\ud800' }] }, { 'stages.0.name': 'invalid' }],
      ['post', API, { ...createBody('x'), type: 'EVENT' }, { type: 'invalid' }],
      ['post', API, { ...createBody('x'), status: 'PUBLISHED' }, { status: 'not_accepted' }],
      ['patch', `${API}/${id}`, { type: 'CHALLENGE' }, { type: 'immutable' }],
      ['patch', `${API}/${id}`, { organization_id: CHAPTER_02 }, { organization_id: 'immutable' }],
      ['patch', `${API}/${id}`, { metadata: { challenge: {} } }, { metadata: 'not_accepted' }],
      [
        'patch',
        `${API}/${id}`,
        { problem_statements: [] },
        { problem_statements: 'not_challenge' },
      ],
      [
        'put',
        `${API}/${id}/registration`,
        { applicant_types: ['INDIVIDUAL'], questions: [] },
        { applicant_types: 'invalid' },
      ],
      ['post', `${API}/${id}/publish`, { status: 'PUBLISHED' }, { status: 'not_accepted' }],
    ]
    for (const [method, path, data, fields] of cases) {
      const response = await call(request, method, path, { data })
      expect(response.status(), `${method} ${path} ${JSON.stringify(data)}`).toBe(422)
      const body = (await response.json()) as { error: { code: string; fields: unknown } }
      expect(body.error).toMatchObject({ code: 'PROFILE_VALIDATION_FAILED', fields })
    }
    // A body that is not JSON is a validation failure, not a crash.
    const raw = await request.fetch(`${API}/${id}`, {
      method: 'PATCH',
      data: '{not json',
      headers: { 'content-type': 'application/json' },
    })
    statuses.push({ url: 'raw', status: raw.status() })
    expect(raw.status()).toBe(422)
    expect((await query('SELECT status::text FROM programmes WHERE id = $1', [id]))[0]).toEqual({
      status: 'DRAFT',
    })
  })

  test('malformed, unknown and traversal ids are the canonical 404, never a 5xx', async ({
    request,
  }) => {
    await login(request, LEADER)
    for (const id of [
      'not-a-uuid',
      '%E0%A4%A',
      '%25',
      '..%2F..%2Fsession',
      '99999999-9999-9999-9999-999999999999',
      `${SEED_PROGRAMME.slice(0, -1)}Z`,
      "'%20OR%201=1--",
    ]) {
      for (const [method, path, data] of ENDPOINTS(id)) {
        const response = await call(request, method, path, { data })
        expect(response.status(), `${method} ${path}`).toBeLessThan(500)
        expect([400, 404], `${method} ${path}`).toContain(response.status())
        if (response.status() === 404 && response.headers()['content-type']?.includes('json'))
          expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
            'UNCONTRACTED_NOT_FOUND',
          )
      }
    }
  })
})

test.describe('WF04-PROD-03 programme API — response shape and leakage', () => {
  test('list and detail expose the DTO fields only: no metadata, application or account data', async ({
    request,
  }) => {
    await login(request, LEADER)
    const list = await call(request, 'get', API)
    expect(list.status()).toBe(200)
    const envelope = (await list.json()) as { items: Record<string, unknown>[]; page: unknown }
    expect(envelope.page).toEqual({ next_cursor: null, limit: 200 })
    for (const item of envelope.items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'counts',
          'created_at',
          'ends_at',
          'id',
          'name',
          'organization',
          'organization_id',
          'slug',
          'starts_at',
          'status',
          'summary',
          'type',
          'updated_at',
        ].sort(),
      )
    }

    const detail = await call(request, 'get', `${API}/${SEED_PROGRAMME}`)
    expect(detail.status()).toBe(200)
    const text = await detail.text()
    for (const secret of [
      'metadata',
      '@example.test',
      'account',
      'answers',
      'snapshot',
      'venture',
      'role_code',
      'before_data',
    ])
      expect(text, secret).not.toContain(secret)
    const body = JSON.parse(text) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(
      [
        'actions',
        'events',
        'organization',
        'owner_archived',
        'programme',
        'registration',
        'stages',
      ].sort(),
    )
  })

  test('the session lists programme:manage for a leader and an admin, never for a member', async ({
    request,
  }) => {
    for (const [email, held] of [
      [LEADER, true],
      [ADMIN, true],
      [MEMBER, false],
    ] as const) {
      await login(request, email)
      const session = (await (await call(request, 'get', '/api/v1/session')).json()) as {
        capabilities?: string[]
      }
      expect((session.capabilities ?? []).includes('programme:manage'), email).toBe(held)
    }
  })
})
