import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

import {
  buildWf05Fixture,
  removeWf05Fixture,
  type Wf05Fixture,
} from '../../../src/lib/application/testing'
import { closePool, query } from '../../../src/lib/db/client'

/**
 * WF05-PROD-03 — the WF05 API over HTTP (WF05 production contract: RBAC, API,
 * frontend; domain and lifecycle). Real route handlers, real session cookies,
 * live PostgreSQL, the deterministic WF05 fixture: authentication, the actor ×
 * resource × action matrix, IDOR and body / header spoofing, malformed ids and
 * bodies, the programme-state matrix, duplicates, idempotency per action and
 * concurrency. No response may be a 5xx.
 */

const LEADER = 'leader@example.test' // Chapter 01 leader: a programme operator, no application access
let fx: Wf05Fixture
let statuses: { url: string; status: number }[] = []

test.beforeAll(async () => {
  fx = await buildWf05Fixture()
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
  await removeWf05Fixture()
  await closePool()
})

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete'

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
  await request.post('/api/v1/auth/logout').catch(() => undefined)
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** A refusal in the frozen envelope only: code, message, request_id (fields); no internals. */
async function refused(response: APIResponse, status: number, code?: string) {
  const text = await response.text()
  expect(response.status(), text).toBe(status)
  const body = JSON.parse(text) as { error: Record<string, unknown> }
  expect(Object.keys(body)).toEqual(['error'])
  expect(Object.keys(body.error).sort()).toEqual(
    body.error.fields
      ? ['code', 'fields', 'message', 'request_id']
      : ['code', 'message', 'request_id'],
  )
  if (code) expect(body.error.code).toBe(code)
  expect(text).not.toMatch(/stack|SELECT |INSERT |constraint|uq_|ck_|fkey|violates|at Object\./i)
  return body.error as { code: string; fields?: Record<string, string> }
}

async function state(id: string) {
  const [row] = await query<{
    status: string
    answers: unknown
    venture_id: string
    programme_id: string
  }>(
    'SELECT status::text, answers, venture_id::text, programme_id::text FROM applications WHERE id = $1',
    [id],
  )
  return row
}

const key = (label: string) =>
  `wf05-api-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`

test.describe('authentication', () => {
  test('a guest gets 401 on every WF05 endpoint and nothing is written', async ({ request }) => {
    await request.post('/api/v1/auth/logout').catch(() => undefined)
    const before = await query<{ n: number }>('SELECT count(*)::int AS n FROM applications')
    const calls: [Method, string, unknown?][] = [
      ['get', '/api/v1/me/applications'],
      [
        'post',
        '/api/v1/applications',
        { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
      ],
      ['get', `/api/v1/applications/${fx.applications.draft}`],
      ['patch', `/api/v1/applications/${fx.applications.draft}`, { answers: [] }],
      ['post', `/api/v1/applications/${fx.applications.draft}/submit`],
      ['get', '/api/v1/demo/projects'],
      ['get', `/api/v1/demo/projects/${fx.ventures.project}`],
      ['get', `/api/v1/ventures/${fx.ventures.project}`],
      ['get', `/api/v1/ventures/${fx.ventures.project}/team`],
    ]
    for (const [method, path, data] of calls)
      await refused(await call(request, method, path, data === undefined ? {} : { data }), 401)
    expect(await query<{ n: number }>('SELECT count(*)::int AS n FROM applications')).toEqual(
      before,
    )
  })
})

test.describe('authority: actor × resource × action, server side', () => {
  test('applications belong to the venture owner only; members 403 / 404, everyone else 404', async ({
    request,
  }) => {
    const draftBefore = await state(fx.applications.draft)
    const actors: [string, number, number][] = [
      // email, POST /applications status, read / save / submit status
      [fx.editor.email, 403, 404],
      [fx.viewer.email, 403, 404],
      [fx.other.email, 404, 404],
      [fx.secondOwner.email, 404, 404],
      [LEADER, 404, 404],
    ]
    for (const [email, createStatus, rest] of actors) {
      await login(request, email)
      await refused(
        await call(request, 'post', '/api/v1/applications', {
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
        }),
        createStatus,
      )
      await refused(
        await call(request, 'get', `/api/v1/applications/${fx.applications.draft}`),
        rest,
      )
      await refused(
        await call(request, 'get', `/api/v1/applications/${fx.applications.submitted}`),
        rest,
      )
      await refused(
        await call(request, 'patch', `/api/v1/applications/${fx.applications.draft}`, {
          data: { answers: [{ question_id: 'q-problem', value: 'Chiếm' }] },
        }),
        rest,
      )
      await refused(
        await call(request, 'post', `/api/v1/applications/${fx.applications.draft}/submit`),
        rest,
      )
      const mine = (await (await call(request, 'get', '/api/v1/me/applications')).json()) as {
        items: { id: string }[]
      }
      expect(mine.items.map((a) => a.id)).not.toContain(fx.applications.draft)
    }
    expect(await state(fx.applications.draft)).toEqual(draftBefore)

    await login(request, fx.owner.email)
    expect(
      (await call(request, 'get', `/api/v1/applications/${fx.applications.draft}`)).status(),
    ).toBe(200)
    const created = await call(request, 'post', '/api/v1/applications', {
      data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
    })
    expect(created.status(), await created.text()).toBe(201)
  })

  test('venture and team: owner and members read; EDIT edits; only the owner manages the team', async ({
    request,
  }) => {
    const venture = `/api/v1/ventures/${fx.ventures.project}`
    const [editorRow] = await query<{ id: string }>(
      `SELECT m.id::text FROM project_members m WHERE m.project_id = $1 AND m.profile_id = $2`,
      [fx.ventures.project, fx.editor.profileId],
    )
    const expectations: [string, number, number, number][] = [
      // email, read venture / team / S02, PATCH venture, team mutation
      [fx.owner.email, 200, 200, 0],
      [fx.editor.email, 200, 200, 403],
      [fx.viewer.email, 200, 403, 403],
      [fx.other.email, 404, 404, 404],
      [LEADER, 404, 404, 404],
    ]
    for (const [email, read, patch, team] of expectations) {
      await login(request, email)
      for (const path of [
        venture,
        `${venture}/team`,
        `/api/v1/demo/projects/${fx.ventures.project}`,
      ]) {
        const response = await call(request, 'get', path)
        if (read === 200) expect(response.status(), path).toBe(200)
        else await refused(response, read)
      }
      const edit = await call(request, 'patch', venture, { data: { summary: 'Mô tả một dòng' } })
      if (patch === 200) expect(edit.status(), await edit.text()).toBe(200)
      else await refused(edit, patch)
      if (team) {
        await refused(
          await call(request, 'post', `${venture}/team/invitations`, {
            data: {
              email: 'wf05-fx-invitee@example.test',
              role_label: 'Thành viên',
              permission: 'VIEW',
            },
          }),
          team,
        )
        await refused(
          await call(request, 'patch', `${venture}/team/${editorRow!.id}`, {
            data: { permission: 'VIEW' },
          }),
          team,
        )
      }
    }
    const [member] = await query<{ permission: string; state: string }>(
      'SELECT permission, state::text FROM project_members WHERE id = $1',
      [editorRow!.id],
    )
    expect(member).toEqual({ permission: 'EDIT', state: 'ACTIVE' })
  })
})

test.describe('IDOR, spoofing and malformed input', () => {
  test('foreign ventures, injected owner / status fields and spoofed headers change nothing', async ({
    request,
  }) => {
    const before = await state(fx.applications.draft)
    await login(request, fx.secondOwner.email)
    await refused(
      await call(request, 'post', '/api/v1/applications', {
        data: { venture_id: fx.ventures.startup, programme_id: fx.programmes.startupOnly },
        headers: { 'x-role': 'PLATFORM_ADMIN', 'x-owner-profile-id': fx.owner.profileId },
      }),
      404,
    )
    await refused(
      await call(request, 'patch', `/api/v1/applications/${fx.applications.draft}`, {
        data: { answers: [] },
        headers: { 'x-account-id': fx.owner.accountId },
      }),
      404,
    )
    await login(request, fx.owner.email)
    await refused(
      await call(request, 'post', '/api/v1/applications', {
        data: { venture_id: fx.ventures.secondOwner, programme_id: fx.programmes.startupOnly },
      }),
      404,
    )
    for (const injected of [
      'owner_profile_id',
      'status',
      'created_by_account_id',
      'primary_applicant_type',
    ]) {
      const error = await refused(
        await call(request, 'post', '/api/v1/applications', {
          data: {
            venture_id: fx.ventures.project,
            programme_id: fx.programmes.open,
            [injected]: 'x',
          },
        }),
        422,
        'APPLICATION_VALIDATION_FAILED',
      )
      expect(error.fields).toEqual({ [injected]: 'not_accepted' })
    }
    await refused(
      await call(request, 'patch', `/api/v1/applications/${fx.applications.draft}`, {
        data: { answers: [], status: 'SUBMITTED' },
      }),
      422,
    )
    expect(await state(fx.applications.draft)).toEqual(before)
  })

  test('malformed ids are the same 404 and malformed bodies a 422, never a 500', async ({
    request,
  }) => {
    await login(request, fx.owner.email)
    for (const path of [
      '/api/v1/applications/not-a-uuid',
      `/api/v1/applications/${'0'.repeat(36)}`,
      `/api/v1/ventures/${'0'.repeat(36)}`,
      `/api/v1/ventures/${'-'.repeat(36)}`,
      `/api/v1/ventures/${'0'.repeat(36)}/team`,
      `/api/v1/demo/projects/${'0'.repeat(36)}`,
    ])
      await refused(await call(request, 'get', path), 404)
    await refused(
      await call(request, 'patch', `/api/v1/applications/${fx.applications.draft}`, {
        headers: { 'content-type': 'application/json' },
        data: '{"answers": [',
      }),
      422,
    )
    await refused(await call(request, 'post', '/api/v1/applications', { data: [1, 2] }), 422)
  })
})

test.describe('lifecycle and programme state', () => {
  test('CLOSED: no create, save or submit; the owner reads the draft read only and the snapshot', async ({
    request,
  }) => {
    await login(request, fx.owner.email)
    // A CLOSED programme offers no form to apply to: the same 404 as an unknown one.
    await refused(
      await call(request, 'post', '/api/v1/applications', {
        data: { venture_id: fx.ventures.archived, programme_id: fx.programmes.closed },
      }),
      404,
    )
    const save = await refused(
      await call(request, 'patch', `/api/v1/applications/${fx.applications.closedDraft}`, {
        data: { answers: [{ question_id: 'q-support', value: 'x' }] },
      }),
      409,
      'APPLICATION_NOT_ELIGIBLE',
    )
    expect(save.fields).toEqual({ reason: 'NOT_PUBLISHED' })
    await refused(
      await call(request, 'post', `/api/v1/applications/${fx.applications.closedDraft}/submit`),
      409,
      'APPLICATION_NOT_ELIGIBLE',
    )
    const draft = (await (
      await call(request, 'get', `/api/v1/applications/${fx.applications.closedDraft}`)
    ).json()) as {
      editable: boolean
      reason: string
      answers: unknown[]
    }
    expect(draft).toMatchObject({ editable: false, reason: 'NOT_PUBLISHED' })
    expect(draft.answers).toHaveLength(1)
    const submitted = (await (
      await call(request, 'get', `/api/v1/applications/${fx.applications.closedSubmitted}`)
    ).json()) as { status: string; editable: boolean; reason: string }
    expect(submitted).toMatchObject({ status: 'SUBMITTED', editable: false, reason: 'SUBMITTED' })

    const mine = (await (await call(request, 'get', '/api/v1/me/applications')).json()) as {
      items: { id: string; programme: { status: string } }[]
    }
    expect(mine.items.find((a) => a.id === fx.applications.closedSubmitted)?.programme.status).toBe(
      'CLOSED',
    )
    expect(mine.items.find((a) => a.id === fx.applications.draft)?.programme.status).toBe(
      'PUBLISHED',
    )
  })

  test('SUBMITTED is terminal; a duplicate pair is APPLICATION_EXISTS with the existing id', async ({
    request,
  }) => {
    await login(request, fx.owner.email)
    await refused(
      await call(request, 'patch', `/api/v1/applications/${fx.applications.submitted}`, {
        data: { answers: [{ question_id: 'q-support', value: 'x' }] },
      }),
      409,
      'APPLICATION_SUBMITTED',
    )
    await refused(
      await call(request, 'post', `/api/v1/applications/${fx.applications.submitted}/submit`),
      409,
      'APPLICATION_SUBMITTED',
    )
    const duplicate = await refused(
      await call(request, 'post', '/api/v1/applications', {
        data: { venture_id: fx.ventures.project, programme_id: fx.programmes.open },
      }),
      409,
      'APPLICATION_EXISTS',
    )
    expect(duplicate.fields).toEqual({ application_id: fx.applications.draft })
  })
})

test.describe('idempotency and concurrency', () => {
  test('create, save and submit: the same key replays, a different body conflicts, no key is deterministic', async ({
    request,
  }) => {
    await login(request, fx.owner.email)
    const body = { venture_id: fx.ventures.startup, programme_id: fx.programmes.startupOnly }
    const createKey = key('create')
    const first = await call(request, 'post', '/api/v1/applications', {
      data: body,
      headers: { 'idempotency-key': createKey },
    })
    expect(first.status(), await first.text()).toBe(201)
    const created = (await first.json()) as { id: string }
    const replay = await call(request, 'post', '/api/v1/applications', {
      data: body,
      headers: { 'idempotency-key': createKey },
    })
    expect(replay.status()).toBe(201)
    expect(((await replay.json()) as { id: string }).id).toBe(created.id)
    await refused(
      await call(request, 'post', '/api/v1/applications', {
        data: { venture_id: fx.ventures.project, programme_id: fx.programmes.startupOnly },
        headers: { 'idempotency-key': createKey },
      }),
      409,
    )
    await refused(
      await call(request, 'post', '/api/v1/applications', { data: body }),
      409,
      'APPLICATION_EXISTS',
    )

    const answers = { answers: [{ question_id: 'q-problem', value: 'Lặp lại an toàn.' }] }
    const saveA = (await (
      await call(request, 'patch', `/api/v1/applications/${created.id}`, { data: answers })
    ).json()) as {
      answers: unknown
    }
    const saveB = (await (
      await call(request, 'patch', `/api/v1/applications/${created.id}`, { data: answers })
    ).json()) as {
      answers: unknown
    }
    expect(saveB.answers).toEqual(saveA.answers)

    const submitKey = key('submit')
    const submits = await Promise.all([
      call(request, 'post', `/api/v1/applications/${created.id}/submit`, {
        headers: { 'idempotency-key': submitKey },
      }),
      call(request, 'post', `/api/v1/applications/${created.id}/submit`, {
        headers: { 'idempotency-key': submitKey },
      }),
    ])
    expect(submits.map((r) => r.status())).toEqual([200, 200])
    const [a, b] = await Promise.all(submits.map((r) => r.json()))
    expect(a).toEqual(b)
    await refused(
      await call(request, 'post', `/api/v1/applications/${created.id}/submit`),
      409,
      'APPLICATION_SUBMITTED',
    )
    const [audits] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1 AND action = 'APPLICATION_SUBMITTED'`,
      [created.id],
    )
    expect(audits!.n).toBe(1)
  })

  test('concurrent creates and concurrent submits without a key: one success, one controlled 409', async ({
    request,
  }) => {
    await login(request, fx.owner.email)
    const venture = await call(request, 'post', '/api/v1/ventures', {
      data: {
        type: 'PROJECT',
        name: 'WF05 Fixture Concurrency',
        summary: 'Một dòng',
        domain_ids: ['20000000-0000-0000-0000-000000000011'],
        stage_id: '23000000-0000-0000-0000-000000000001',
      },
      headers: { 'idempotency-key': key('venture') },
    })
    expect(venture.status(), await venture.text()).toBe(201)
    const ventureBody = (await venture.json()) as { id?: string; venture?: { id: string } }
    const ventureId = ventureBody.id ?? ventureBody.venture!.id
    const body = { venture_id: ventureId, programme_id: fx.programmes.open }
    const creates = await Promise.all([
      call(request, 'post', '/api/v1/applications', { data: body }),
      call(request, 'post', '/api/v1/applications', { data: body }),
    ])
    expect(creates.map((r) => r.status()).sort()).toEqual([201, 409])
    const id = ((await creates.find((r) => r.status() === 201)!.json()) as { id: string }).id
    await call(request, 'patch', `/api/v1/applications/${id}`, {
      data: { answers: [{ question_id: 'q-problem', value: 'Đồng thời.' }] },
    })
    const submits = await Promise.all([
      call(request, 'post', `/api/v1/applications/${id}/submit`),
      call(request, 'post', `/api/v1/applications/${id}/submit`),
    ])
    expect(submits.map((r) => r.status()).sort()).toEqual([200, 409])
    expect((await state(id))!.status).toBe('SUBMITTED')
    const [count] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM applications WHERE venture_id = $1',
      [ventureId],
    )
    expect(count!.n).toBe(1)
  })
})
