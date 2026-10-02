import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  API,
  CHAPTER_01,
  CHAPTER_02,
  LEADER,
  MEMBER,
  SEED_VENTURE,
  auditActions,
  call,
  cleanupProgrammes,
  clubWithLeader,
  createProgramme,
  login,
  programmeRow,
  routes,
  track,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-PROD-05 — functional and security QA of the hardened WF04 (API 05 §22,
 * contract §5–§17, DEC-W4P-D11..D14). Real server, real session cookies, live
 * PostgreSQL. Adds the cases the PROD-03 / PROD-04 suites did not assert yet:
 * revoked roles, Challenge IDOR, leader-side spoofing, legacy ARCHIVED rows,
 * concurrent close, archived owners over HTTP, malformed Challenge payloads,
 * duplicate applications, the Event boundary, idempotency per action, audit
 * correlation, relogin, an expired session and the error surface.
 * Every response is recorded; none may be a 5xx.
 */

let consoleErrors: string[] = []
let statuses: number[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = watchConsole(page)
  statuses = []
  page.on('response', (r) => statuses.push(r.status()))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
  expect(
    statuses.filter((s) => s >= 500),
    'no 5xx',
  ).toEqual([])
})

test.afterAll(async () => {
  await cleanupProgrammes()
  await closePool()
})

async function send(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put',
  url: string,
  options: { data?: unknown; headers?: Record<string, string> } = {},
): Promise<APIResponse> {
  const response = await request[method](url, options)
  statuses.push(response.status())
  return response
}

async function refused(response: APIResponse, status: number, code: string) {
  expect(response.status(), await response.text()).toBe(status)
  const body = (await response.json()) as { error: Record<string, unknown> }
  expect(body.error.code).toBe(code)
  // The frozen envelope only: no stack, SQL, cause or internal field.
  expect(Object.keys(body.error).sort()).toEqual(
    ['code', 'message', 'request_id', ...('fields' in body.error ? ['fields'] : [])].sort(),
  )
  expect(JSON.stringify(body)).not.toMatch(/stack|select |insert |update |postgres|pg_|at \w+ \(/i)
  return body.error
}

/** A programme of a CLB led by someone else (organization B for the Chapter 01 leader). */
async function foreignChallenge(request: APIRequestContext) {
  const club = await clubWithLeader()
  await login(request, club.leader)
  const { programme } = await createProgramme(request, {
    type: 'CHALLENGE',
    organization_id: club.id,
    name: 'Thử thách tổ chức B',
  })
  await call(request, 'patch', `/${programme.id}`, {
    problem_statements: [{ title: 'Bài toán của B' }],
    stages: [{ name: 'Giai đoạn của B' }],
  })
  await call(request, 'put', `/${programme.id}/registration`, {
    applicant_types: ['STARTUP'],
    questions: [{ id: 'q-b', prompt: 'Câu của B', required: true, step: 1 }],
  })
  await call(request, 'post', `/${programme.id}/publish`)
  return { club, id: programme.id }
}

async function state(id: string) {
  const row = (await programmeRow(id))!
  const [form] = await query<{ version: number }>(
    'SELECT version FROM programme_application_forms WHERE programme_id = $1',
    [id],
  )
  return { status: row.status, name: row.name, metadata: row.metadata, form: form?.version ?? null }
}

test.describe('QA-RBAC — server-side authority only', () => {
  test('a leader whose assignment is revoked loses list and write access at once', async ({
    page,
  }) => {
    const club = await clubWithLeader()
    await login(page.request, club.leader)
    const { programme } = await createProgramme(page.request, { organization_id: club.id })
    await query(
      `UPDATE role_assignments SET state = 'CLOSED'
        WHERE individual_profile_id = (SELECT p.id FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id WHERE a.email = $1)`,
      [club.leader],
    )
    await refused(await send(page.request, 'get', API), 403, 'SCOPE_FORBIDDEN')
    await refused(
      await send(page.request, 'get', `${API}/${programme.id}`),
      404,
      'UNCONTRACTED_NOT_FOUND',
    )
    await refused(
      await send(page.request, 'patch', `${API}/${programme.id}`, {
        data: { name: 'Sau thu hồi' },
      }),
      404,
      'UNCONTRACTED_NOT_FOUND',
    )
    await refused(
      await send(page.request, 'post', API, {
        data: { type: 'PROGRAMME', organization_id: club.id, name: 'x' },
      }),
      403,
      'SCOPE_FORBIDDEN',
    )
    expect((await programmeRow(programme.id))!.name).not.toBe('Sau thu hồi')
    expect((await page.goto(routes.list))?.status()).toBe(404)
  })
})

test.describe('QA-IDOR — organization A on organization B (0 successes)', () => {
  test('the Chapter 01 leader cannot read or change B’s programme, Challenge data, form or lifecycle', async ({
    request,
  }) => {
    const { id } = await foreignChallenge(request)
    const before = await state(id)
    await login(request, LEADER)
    const attempts: [string, 'get' | 'patch' | 'put' | 'post', string, unknown][] = [
      ['read', 'get', `${API}/${id}`, undefined],
      ['rename', 'patch', `${API}/${id}`, { name: 'Chiếm' }],
      ['challenge', 'patch', `${API}/${id}`, { problem_statements: [{ title: 'Bài toán chiếm' }] }],
      ['stages', 'patch', `${API}/${id}`, { stages: [] }],
      ['form', 'put', `${API}/${id}/registration`, { applicant_types: ['TEAM'], questions: [] }],
      ['publish', 'post', `${API}/${id}/publish`, undefined],
      ['close', 'post', `${API}/${id}/close`, undefined],
    ]
    let successes = 0
    for (const [label, method, url, data] of attempts) {
      const response = await send(request, method, url, data === undefined ? {} : { data })
      if (response.status() < 400) successes += 1
      await refused(response, 404, 'UNCONTRACTED_NOT_FOUND')
      expect(label).toBeTruthy()
    }
    expect(successes).toBe(0)
    const list = (await (await send(request, 'get', API)).json()) as { items: { id: string }[] }
    expect(list.items.map((p) => p.id)).not.toContain(id)
    expect(await state(id)).toEqual(before)
  })
})

test.describe('QA-SPOOF — client-controlled authority is ignored', () => {
  test('a leader spoofing headers, query and body gains nothing on B and changes no owner or status', async ({
    request,
  }) => {
    const { club, id } = await foreignChallenge(request)
    const before = await state(id)
    await login(request, LEADER)
    const headers = {
      'x-role': 'PLATFORM_ADMIN',
      'x-capabilities': 'programme:manage',
      'x-scope-type': 'PLATFORM',
      'x-organization-id': club.id,
      'x-owner-id': club.id,
    }
    await refused(
      await send(request, 'patch', `${API}/${id}?organization_id=${club.id}&role=PLATFORM_ADMIN`, {
        headers,
        data: { name: 'Giả mạo' },
      }),
      404,
      'UNCONTRACTED_NOT_FOUND',
    )
    await refused(
      await send(request, 'post', `${API}/${id}/close?scope=PLATFORM`, { headers }),
      404,
      'UNCONTRACTED_NOT_FOUND',
    )
    await refused(
      await send(request, 'post', API, {
        headers,
        data: { type: 'PROGRAMME', organization_id: CHAPTER_02, name: 'Lấn sân' },
      }),
      403,
      'SCOPE_FORBIDDEN',
    )
    for (const key of ['role', 'capability', 'owner', 'scope']) {
      const error = await refused(
        await send(request, 'post', API, {
          headers,
          data: {
            type: 'PROGRAMME',
            organization_id: CHAPTER_01,
            name: 'x',
            [key]: 'PLATFORM_ADMIN',
          },
        }),
        422,
        'PROFILE_VALIDATION_FAILED',
      )
      expect(error.fields).toEqual({ [key]: 'not_accepted' })
    }
    const own = await createProgramme(request, { name: 'Của Chapter 01' })
    for (const [data, fields] of [
      [{ organization_id: club.id }, { organization_id: 'immutable' }],
      [{ type: 'CHALLENGE' }, { type: 'immutable' }],
      [{ status: 'PUBLISHED' }, { status: 'not_accepted' }],
      [{ owner: club.id }, { owner: 'not_accepted' }],
    ] as const) {
      const error = await refused(
        await send(request, 'patch', `${API}/${own.programme.id}`, { headers, data }),
        422,
        'PROFILE_VALIDATION_FAILED',
      )
      expect(error.fields).toEqual(fields)
    }
    const [owner] = await query<{ organization_id: string; status: string }>(
      'SELECT organization_id::text, status::text FROM programmes WHERE id = $1',
      [own.programme.id],
    )
    expect(owner).toEqual({ organization_id: CHAPTER_01, status: 'DRAFT' })
    const listed = (await (
      await send(request, 'get', `${API}?organization_id=${club.id}&role=PLATFORM_ADMIN`, {
        headers,
      })
    ).json()) as { items: { organization_id: string }[] }
    expect(listed.items.every((p) => p.organization_id === CHAPTER_01)).toBe(true)
    expect(await state(id)).toEqual(before)
  })
})

test.describe('QA-LIFE — DRAFT → PUBLISHED → CLOSED only; ARCHIVED read only', () => {
  test('DRAFT cannot jump to CLOSED; CLOSED cannot reopen or be edited', async ({ request }) => {
    await login(request, LEADER)
    const { programme } = await createProgramme(request)
    const id = programme.id
    await refused(
      await send(request, 'post', `${API}/${id}/close`),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    expect((await programmeRow(id))!.status).toBe('DRAFT')
    await call(request, 'post', `/${id}/publish`)
    await refused(
      await send(request, 'post', `${API}/${id}/publish`),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    await call(request, 'post', `/${id}/close`)
    for (const [method, url, data] of [
      ['post', `${API}/${id}/publish`, undefined],
      ['post', `${API}/${id}/close`, undefined],
      ['patch', `${API}/${id}`, { name: 'Mở lại' }],
      ['put', `${API}/${id}/registration`, { applicant_types: ['TEAM'], questions: [] }],
    ] as const) {
      await refused(
        await send(request, method, url, data === undefined ? {} : { data }),
        409,
        'MEMBERSHIP_INVALID_TRANSITION',
      )
    }
    expect((await programmeRow(id))!.status).toBe('CLOSED')
  })

  test('a legacy ARCHIVED row is readable, has no action, and every write is a conflict', async ({
    request,
  }) => {
    const [row] = await query<{ id: string }>(
      `INSERT INTO programmes (organization_id, programme_type, slug, name, status)
       VALUES ($1, 'PROGRAMME', $2, 'Chương trình lưu trữ cũ', 'ARCHIVED') RETURNING id::text`,
      [CHAPTER_01, `wf04-qa-archived-${Date.now()}`],
    )
    track(row!.id)
    await login(request, LEADER)
    const detail = (await (await send(request, 'get', `${API}/${row!.id}`)).json()) as {
      programme: { status: string }
      actions: Record<string, boolean>
    }
    expect(detail.programme.status).toBe('ARCHIVED')
    expect(detail.actions).toEqual({
      edit: false,
      registration: false,
      publish: false,
      close: false,
    })
    for (const [method, url, data] of [
      ['patch', `${API}/${row!.id}`, { name: 'x' }],
      ['put', `${API}/${row!.id}/registration`, { applicant_types: ['TEAM'], questions: [] }],
      ['post', `${API}/${row!.id}/publish`, undefined],
      ['post', `${API}/${row!.id}/close`, undefined],
    ] as const) {
      await refused(
        await send(request, method, url, data === undefined ? {} : { data }),
        409,
        'MEMBERSHIP_INVALID_TRANSITION',
      )
    }
    expect((await programmeRow(row!.id))!.status).toBe('ARCHIVED')
    // No archive route exists.
    expect((await send(request, 'post', `${API}/${row!.id}/archive`)).status()).toBe(404)
  })

  test('two concurrent closes: one transition, one conflict, one audit event', async ({
    request,
  }) => {
    await login(request, LEADER)
    const { programme } = await createProgramme(request)
    await call(request, 'post', `/${programme.id}/publish`)
    const results = await Promise.all([
      send(request, 'post', `${API}/${programme.id}/close`),
      send(request, 'post', `${API}/${programme.id}/close`),
    ])
    expect(results.map((r) => r.status()).sort()).toEqual([200, 409])
    expect((await auditActions(programme.id)).filter((a) => a === 'PROGRAMME_CLOSED')).toHaveLength(
      1,
    )
  })
})

test.describe('QA-ARCH — an ARCHIVED owning organization over direct API calls', () => {
  test('create, edit, form, publish and close are 409; reads stay available', async ({
    request,
  }) => {
    const club = await clubWithLeader()
    await login(request, club.leader)
    const draft = await createProgramme(request, { organization_id: club.id, name: 'Nháp CLB' })
    const live = await createProgramme(request, { organization_id: club.id, name: 'Đang mở CLB' })
    await call(request, 'post', `/${live.programme.id}/publish`)
    await club.archive()
    await refused(
      await send(request, 'post', API, {
        data: { type: 'PROGRAMME', organization_id: club.id, name: 'Mới' },
      }),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    for (const [method, url, data] of [
      ['patch', `${API}/${draft.programme.id}`, { name: 'Sửa' }],
      [
        'put',
        `${API}/${draft.programme.id}/registration`,
        { applicant_types: ['TEAM'], questions: [] },
      ],
      ['post', `${API}/${draft.programme.id}/publish`, undefined],
      ['post', `${API}/${live.programme.id}/close`, undefined],
    ] as const) {
      await refused(
        await send(request, method, url, data === undefined ? {} : { data }),
        409,
        'MEMBERSHIP_INVALID_TRANSITION',
      )
    }
    const read = await send(request, 'get', `${API}/${live.programme.id}`)
    expect(read.status()).toBe(200)
    expect(((await read.json()) as { owner_archived: boolean }).owner_archived).toBe(true)
    const list = (await (await send(request, 'get', API)).json()) as { items: { id: string }[] }
    expect(list.items.map((p) => p.id)).toEqual(
      expect.arrayContaining([draft.programme.id, live.programme.id]),
    )
    expect((await programmeRow(draft.programme.id))!.status).toBe('DRAFT')
    expect((await programmeRow(live.programme.id))!.status).toBe('PUBLISHED')
  })
})

test.describe('QA-CHAL — Challenge data in programmes.metadata.challenge', () => {
  test('persists through PATCH, is read back, and malformed payloads are 422 with nothing stored', async ({
    request,
  }) => {
    await login(request, LEADER)
    const { programme } = await createProgramme(request, { type: 'CHALLENGE' })
    const id = programme.id
    await call(request, 'patch', `/${id}`, {
      problem_statements: [{ title: 'Bài toán 1', summary: 'Mô tả' }, { title: 'Bài toán 2' }],
    })
    const stored = (await programmeRow(id))!.metadata
    expect(stored.challenge).toMatchObject({ schema_version: 1 })
    expect(stored.challenge!.problem_statements).toHaveLength(2)
    const read = (await (await send(request, 'get', `${API}/${id}`)).json()) as {
      problem_statements: { title: string }[]
    }
    expect(read.problem_statements.map((p) => p.title)).toEqual(['Bài toán 1', 'Bài toán 2'])
    for (const [data, fields] of [
      [{ problem_statements: 'x' }, { problem_statements: 'invalid' }],
      [{ problem_statements: [{ title: 5 }] }, { 'problem_statements.0.title': 'invalid' }],
      [
        { problem_statements: [{ title: 'a', score: 1 }] },
        { 'problem_statements.0.score': 'not_accepted' },
      ],
      [
        { problem_statements: [{ title: 'x'.repeat(201) }] },
        { 'problem_statements.0.title': 'too_long' },
      ],
      [
        { problem_statements: [{ title: 'a', id: 'p-1' }] },
        { 'problem_statements.0.id': 'invalid' },
      ],
      [{ metadata: { challenge: { problem_statements: [] } } }, { metadata: 'not_accepted' }],
      [{ challenge: { problem_statements: [] } }, { challenge: 'not_accepted' }],
    ] as const) {
      const error = await refused(
        await send(request, 'patch', `${API}/${id}`, { data }),
        422,
        'PROFILE_VALIDATION_FAILED',
      )
      expect(error.fields, JSON.stringify(data)).toEqual(fields)
    }
    expect((await programmeRow(id))!.metadata).toEqual(stored)
    const [tables] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name ~ '(challenge|problem|stage|journey|wf04)'`,
    )
    expect(tables!.n).toBe(0)
  })
})

test.describe('QA-APP — the canonical WF05 Application flow', () => {
  test('a WF04 programme accepts one application per venture; a repeat is APPLICATION_EXISTS; the key replays', async ({
    request,
  }) => {
    await login(request, LEADER)
    const { programme } = await createProgramme(request, { name: 'Nhận hồ sơ QA' })
    const id = programme.id
    await call(request, 'put', `/${id}/registration`, {
      applicant_types: ['STARTUP'],
      questions: [{ id: 'q-a', prompt: 'Vấn đề?', required: true, step: 1 }],
    })
    await call(request, 'post', `/${id}/publish`)
    await login(request, MEMBER)
    const key = `qa-app-${Date.now()}`
    const body = { venture_id: SEED_VENTURE, programme_id: id }
    const first = await send(request, 'post', '/api/v1/applications', {
      data: body,
      headers: { 'Idempotency-Key': key },
    })
    expect(first.status()).toBe(201)
    const applicationId = ((await first.json()) as { id: string }).id
    const replay = await send(request, 'post', '/api/v1/applications', {
      data: body,
      headers: { 'Idempotency-Key': key },
    })
    expect(replay.status()).toBe(201)
    expect(((await replay.json()) as { id: string }).id).toBe(applicationId)
    const duplicate = await refused(
      await send(request, 'post', '/api/v1/applications', { data: body }),
      409,
      'APPLICATION_EXISTS',
    )
    expect(duplicate.fields).toMatchObject({ application_id: applicationId })
    const mine = await (await send(request, 'get', '/api/v1/me/applications')).text()
    expect(mine).toContain(applicationId)
    const [count] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM applications WHERE programme_id = $1',
      [id],
    )
    expect(count!.n).toBe(1)

    // The form is locked; after close no new application, the draft is kept.
    await login(request, LEADER)
    await refused(
      await send(request, 'put', `${API}/${id}/registration`, {
        data: { applicant_types: ['TEAM'], questions: [] },
      }),
      409,
      'MEMBERSHIP_INVALID_TRANSITION',
    )
    await call(request, 'post', `/${id}/close`)
    await login(request, MEMBER)
    await refused(
      await send(request, 'patch', `/api/v1/applications/${applicationId}`, {
        data: { answers: [{ question_id: 'q-a', value: 'x' }] },
      }),
      409,
      'APPLICATION_NOT_ELIGIBLE',
    )
    const [kept] = await query<{ status: string }>(
      'SELECT status::text FROM applications WHERE id = $1',
      [applicationId],
    )
    expect(kept!.status).toBe('DRAFT')
  })
})

test.describe('QA-EVT — WF04 writes no Event', () => {
  test('a full operator journey leaves the events table untouched; no WF04 runtime file writes events', async ({
    request,
  }) => {
    const snapshot = () =>
      query<{ n: number; at: string | null; linked: number }>(
        `SELECT count(*)::int AS n, max(updated_at)::text AS at,
                count(*) FILTER (WHERE programme_id IS NOT NULL)::int AS linked FROM events`,
      )
    const before = await snapshot()
    await login(request, LEADER)
    const { programme } = await createProgramme(request, { type: 'CHALLENGE' })
    await call(request, 'patch', `/${programme.id}`, {
      stages: [{ name: 'A' }],
      problem_statements: [{ title: 'B' }],
    })
    await call(request, 'put', `/${programme.id}/registration`, {
      applicant_types: ['TEAM'],
      questions: [],
    })
    await call(request, 'post', `/${programme.id}/publish`)
    await call(request, 'post', `/${programme.id}/close`)
    expect(await snapshot()).toEqual(before)

    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(name) && !/test\.ts$/.test(name)) files.push(full)
      }
    }
    for (const root of [
      'src/lib/programme',
      'src/components/programme-demo',
      'src/app/api/v1/programmes',
      'src/app/(demo)/demo/programmes',
    ])
      walk(path.join(REPO_ROOT, root))
    // API paths and SQL only: a type import from '@/lib/ops/events' writes nothing.
    for (const file of files)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /INSERT INTO events|UPDATE events|DELETE FROM events|['"`]\/ops\/events|\/ops\/organizations\/[^'"`]*\/events/,
      )
  })
})

test.describe('QA-IDEM — repeat safety per action', () => {
  test('create: the key replays one row; without a key each request is a new DRAFT (I5)', async ({
    request,
  }) => {
    await login(request, LEADER)
    const name = `Idem ${Date.now()}`
    const body = { type: 'PROGRAMME', organization_id: CHAPTER_01, name }
    const key = `qa-create-${Date.now()}`
    const a = await send(request, 'post', API, { data: body, headers: { 'Idempotency-Key': key } })
    const b = await send(request, 'post', API, { data: body, headers: { 'Idempotency-Key': key } })
    const ids = [a, b].map(
      async (r) => ((await r.json()) as { programme: { id: string } }).programme.id,
    )
    const [ida, idb] = await Promise.all(ids)
    track(ida!)
    expect(idb).toBe(ida)
    const [keyed] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM programmes WHERE name = $1',
      [name],
    )
    expect(keyed!.n).toBe(1)
    const c = await send(request, 'post', API, { data: { ...body, name: `${name} (no key)` } })
    const d = await send(request, 'post', API, { data: { ...body, name: `${name} (no key)` } })
    for (const r of [c, d]) track(((await r.json()) as { programme: { id: string } }).programme.id)
    const [unkeyed] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM programmes WHERE name = $1',
      [`${name} (no key)`],
    )
    expect(unkeyed!.n).toBe(2)
  })

  test('edit and form: an identical repeat changes nothing and audits nothing', async ({
    request,
  }) => {
    await login(request, LEADER)
    const { programme } = await createProgramme(request, { type: 'CHALLENGE' })
    const patch = {
      name: 'Lặp lại',
      stages: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'A' }],
    }
    await call(request, 'patch', `/${programme.id}`, patch)
    await call(request, 'patch', `/${programme.id}`, patch)
    const form = {
      applicant_types: ['TEAM'],
      questions: [{ id: 'q-a', prompt: 'A?', required: true, step: 1 }],
    }
    const v1 = await call(request, 'put', `/${programme.id}/registration`, form)
    const v2 = await call(request, 'put', `/${programme.id}/registration`, form)
    expect([v1.registration!.version, v2.registration!.version]).toEqual([1, 1])
    expect(await auditActions(programme.id)).toEqual([
      'PROGRAMME_CREATED',
      'PROGRAMME_UPDATED',
      'PROGRAMME_REGISTRATION_UPDATED',
    ])
  })

  test('publish and close: the key replays 200 once; a repeat without the key is 409; one audit each', async ({
    request,
  }) => {
    await login(request, LEADER)
    const { programme } = await createProgramme(request)
    for (const action of ['publish', 'close']) {
      const key = `qa-${action}-${Date.now()}`
      for (let i = 0; i < 2; i += 1)
        expect(
          (
            await send(request, 'post', `${API}/${programme.id}/${action}`, {
              headers: { 'Idempotency-Key': key },
            })
          ).status(),
        ).toBe(200)
      await refused(
        await send(request, 'post', `${API}/${programme.id}/${action}`),
        409,
        'MEMBERSHIP_INVALID_TRANSITION',
      )
    }
    const actions = await auditActions(programme.id)
    expect(actions.filter((a) => a === 'PROGRAMME_PUBLISHED')).toHaveLength(1)
    expect(actions.filter((a) => a === 'PROGRAMME_CLOSED')).toHaveLength(1)
  })
})

test.describe('QA-AUDIT — who, what, which programme and organization, when, resulting state', () => {
  test('each write is one audit row correlated to its response request id', async ({ request }) => {
    await login(request, LEADER)
    const create = await send(request, 'post', API, {
      data: { type: 'CHALLENGE', organization_id: CHAPTER_01, name: 'Audit QA' },
    })
    const detail = (await create.json()) as { programme: { id: string } }
    const id = detail.programme.id
    track(id)
    const requestIds: [string, string][] = [
      ['PROGRAMME_CREATED', create.headers()['x-request-id']!],
    ]
    for (const [action, method, url, data] of [
      ['PROGRAMME_UPDATED', 'patch', `${API}/${id}`, { problem_statements: [{ title: 'B' }] }],
      [
        'PROGRAMME_REGISTRATION_UPDATED',
        'put',
        `${API}/${id}/registration`,
        { applicant_types: ['TEAM'], questions: [] },
      ],
      ['PROGRAMME_PUBLISHED', 'post', `${API}/${id}/publish`, undefined],
      ['PROGRAMME_CLOSED', 'post', `${API}/${id}/close`, undefined],
    ] as const) {
      const response = await send(request, method, url, data === undefined ? {} : { data })
      expect(response.status()).toBe(200)
      requestIds.push([action, response.headers()['x-request-id']!])
    }
    const [leader] = await query<{ id: string }>(
      `SELECT id::text FROM user_accounts WHERE email = $1`,
      [LEADER],
    )
    const rows = await query<{
      action: string
      actor: string
      resource_type: string
      request_id: string
      created_at: Date
      after: { programme_id: string; organization_id: string; status: string; type: string }
    }>(
      `SELECT action, actor_account_id::text AS actor, resource_type, request_id, created_at, after_data AS after
         FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
      [id],
    )
    expect(rows.map((r) => [r.action, r.request_id])).toEqual(requestIds)
    for (const row of rows) {
      expect(row.actor).toBe(leader!.id)
      expect(row.resource_type).toBe('programme')
      expect(row.created_at).toBeInstanceOf(Date)
      expect(row.after).toMatchObject({
        programme_id: id,
        organization_id: CHAPTER_01,
        type: 'CHALLENGE',
      })
    }
    expect(rows.map((r) => r.after.status)).toEqual([
      'DRAFT',
      'DRAFT',
      'DRAFT',
      'PUBLISHED',
      'CLOSED',
    ])
    expect(JSON.stringify(rows)).not.toMatch(/Audit QA|"B"|@example/)
  })
})

test.describe('QA-PERS — relogin and an expired session', () => {
  test('logout and login again: the persisted programme is unchanged', async ({ page }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request, {
      type: 'CHALLENGE',
      name: 'Sau đăng nhập lại',
    })
    await call(page.request, 'patch', `/${programme.id}`, {
      stages: [{ name: 'A' }],
      problem_statements: [{ title: 'B' }],
    })
    await call(page.request, 'post', `/${programme.id}/publish`)
    const before = await (await send(page.request, 'get', `${API}/${programme.id}`)).json()
    expect((await send(page.request, 'post', '/api/v1/auth/logout')).status()).toBeLessThan(300)
    await refused(
      await send(page.request, 'get', `${API}/${programme.id}`),
      401,
      'UNCONTRACTED_UNAUTHENTICATED',
    )
    await login(page.request, LEADER)
    expect(await (await send(page.request, 'get', `${API}/${programme.id}`)).json()).toEqual(before)
    await page.goto(routes.detail(programme.id))
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await expect(page.locator('[data-detail="journey"]')).toContainText('1 giai đoạn')
  })

  test('a session that expires while editing: the save goes back through sign-in to the same page', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'journey'))
    await page.context().clearCookies()
    await page.locator('[data-action="add-stage"]').click()
    await page.locator('#st-name-new').fill('Hết phiên')
    await page.locator('[data-action="save-stage"]').click()
    await expect(page).toHaveURL(/\/auth\?redirect=/)
    expect(decodeURIComponent(new URL(page.url()).searchParams.get('redirect')!)).toBe(
      routes.setup(programme.id, 'journey'),
    )
    expect((await programmeRow(programme.id))!.metadata.journey).toBeUndefined()
  })
})

test.describe('QA-SEC — error surface and removed surfaces', () => {
  test('every refusal is the frozen envelope; oversized or malformed input is never a 500', async ({
    request,
  }) => {
    await refused(await send(request, 'get', API), 401, 'UNCONTRACTED_UNAUTHENTICATED')
    await login(request, LEADER)
    const { programme } = await createProgramme(request)
    await refused(await send(request, 'get', `${API}/not-a-uuid`), 404, 'UNCONTRACTED_NOT_FOUND')
    await refused(
      await send(request, 'patch', `${API}/${programme.id}`, {
        data: { name: 'x'.repeat(10_000) },
      }),
      422,
      'PROFILE_VALIDATION_FAILED',
    )
    await refused(
      await send(request, 'patch', `${API}/${programme.id}`, {
        data: { stages: Array.from({ length: 51 }, () => ({ name: 'a' })) },
      }),
      422,
      'PROFILE_VALIDATION_FAILED',
    )
    await refused(
      await send(request, 'patch', `${API}/${programme.id}`, {
        data: { name: "'; DROP TABLE programmes; --\u0000" },
      }),
      422,
      'PROFILE_VALIDATION_FAILED',
    )
    const raw = await request.fetch(`${API}/${programme.id}/registration`, {
      method: 'PUT',
      data: '{"applicant_types": [',
      headers: { 'content-type': 'application/json' },
    })
    statuses.push(raw.status())
    await refused(raw, 422, 'PROFILE_VALIDATION_FAILED')
    for (const removed of ['/api/v1/demo/programmes', `/api/v1/demo/programmes/${programme.id}`])
      expect((await send(request, 'get', removed)).status(), removed).toBe(404)
    const detail = await (await send(request, 'get', `${API}/${programme.id}`)).text()
    expect(detail).not.toMatch(/session|token|cookie|password|@example|metadata|account_id/i)
  })
})
