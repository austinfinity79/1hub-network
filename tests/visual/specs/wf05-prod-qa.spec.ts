import { randomUUID } from 'node:crypto'

import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

import {
  buildWf05Fixture,
  removeWf05Fixture,
  WF05_FIXTURE_EMAILS,
  type Wf05Fixture,
} from '../../../src/lib/application/testing'
import { closePool, query } from '../../../src/lib/db/client'
import { writeJsonReport } from '../pixel-qa/report'
import { login, watchConsole } from '../support/programmes'

/**
 * WF05-PROD-05 — functional and security QA of the hardened WF05 (WF05
 * production contract; API §21, §23, §24). Real server, real sessions, live
 * PostgreSQL, the deterministic WF05 fixture only. Adds what the PROD-03 /
 * PROD-04 suites did not prove yet: the 400-vs-422 matrix (carry-forward A),
 * the draft-save audit over HTTP (carry-forward B), PROJECT and STARTUP owner
 * journeys end to end, the negative-path matrix in one place, idempotency
 * retry after a refusal (no lockout), unsupported methods, ARCHIVED programmes
 * over HTTP and leakage checks. Every response is recorded; none may be a 5xx.
 */

const OWNER = WF05_FIXTURE_EMAILS.owner
const API = '/api/v1/applications'
const UNKNOWN = '00000000-0000-4000-8000-000000000000'
const LEAK =
  /stack|SELECT |INSERT |UPDATE |constraint|uq_|ck_|fkey|violates|at Object\.|node_modules/i

let fx: Wf05Fixture
let consoleErrors: string[] = []
let statuses: { url: string; status: number }[] = []

test.beforeAll(async () => {
  fx = await buildWf05Fixture()
})

test.afterAll(async () => {
  await removeWf05Fixture()
  await closePool()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = watchConsole(page)
  statuses = []
  page.on('response', (r) => statuses.push({ url: r.url(), status: r.status() }))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
  expect(
    statuses.filter((s) => s.status >= 500),
    'no 5xx',
  ).toEqual([])
})

type Sent = { method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string; data?: unknown }

async function send(
  request: APIRequestContext,
  { method, path, data }: Sent,
  headers: Record<string, string> = {},
): Promise<APIResponse> {
  const options: Parameters<APIRequestContext['post']>[1] = { headers }
  if (typeof data === 'string')
    Object.assign(options, { data, headers: { ...headers, 'Content-Type': 'application/json' } })
  else if (data !== undefined) Object.assign(options, { data })
  const response = await request[method](path, options)
  statuses.push({ url: path, status: response.status() })
  return response
}

/** Status, code and field reasons of a refusal; asserts the frozen envelope and no internals. */
async function outcome(response: APIResponse) {
  const text = await response.text()
  expect(text, 'no internal detail').not.toMatch(LEAK)
  if (response.status() < 400 || !text.startsWith('{')) return { status: response.status() }
  const body = JSON.parse(text) as { error: { code: string; fields?: Record<string, string> } }
  expect(Object.keys(body)).toEqual(['error'])
  return { status: response.status(), code: body.error.code, fields: body.error.fields ?? null }
}

async function rows() {
  return query<{ id: string; status: string; answers: unknown; updated_at: string }>(
    `SELECT id::text, status::text, answers, updated_at::text FROM applications
      WHERE venture_id = ANY($1::uuid[]) ORDER BY id`,
    [Object.values(fx.ventures)],
  )
}

test.describe('WF05-PROD-05 A — 400 vs 422', () => {
  test('every validation path answers the frozen rule: 422 for body / field / business, 404 for ids, 409 for state; no WF05 400', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const draft = `${API}/${fx.applications.draft}`
    const create = { method: 'post', path: API } as const
    const patch = { method: 'patch', path: draft } as const
    const cases: { name: string; sent: Sent; expect: { status: number; code?: string } }[] = [
      {
        name: 'malformed JSON (create)',
        sent: { ...create, data: '{"venture_id":' },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'malformed JSON (save)',
        sent: { ...patch, data: '{"answers": [' },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'array body (create)',
        sent: { ...create, data: [] },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'missing required field programme_id',
        sent: { ...create, data: { venture_id: fx.ventures.project } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'invalid field type (venture_id number)',
        sent: { ...create, data: { venture_id: 7, programme_id: fx.programmes.open } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'malformed id in the body',
        sent: { ...create, data: { venture_id: 'not-a-uuid', programme_id: fx.programmes.open } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'unknown field',
        sent: {
          ...create,
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly, extra: 1 },
        },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'forbidden field owner_profile_id',
        sent: {
          ...create,
          data: {
            venture_id: fx.ventures.project,
            programme_id: fx.programmes.teamOnly,
            owner_profile_id: fx.secondOwner.profileId,
          },
        },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'enum field not client-writable (primary_applicant_type)',
        sent: {
          ...create,
          data: {
            venture_id: fx.ventures.project,
            programme_id: fx.programmes.teamOnly,
            primary_applicant_type: 'INDIVIDUAL',
          },
        },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'invalid state payload (status SUBMITTED)',
        sent: { ...patch, data: { answers: [], status: 'SUBMITTED' } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'answers not an array',
        sent: { ...patch, data: { answers: 'x' } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'invalid answer shape (no value)',
        sent: { ...patch, data: { answers: [{ question_id: 'q-problem' }] } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'invalid answer type (value number)',
        sent: { ...patch, data: { answers: [{ question_id: 'q-problem', value: 5 }] } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'unknown question',
        sent: { ...patch, data: { answers: [{ question_id: 'q-x', value: 'a' }] } },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'answer over 2000 characters',
        sent: {
          ...patch,
          data: { answers: [{ question_id: 'q-problem', value: 'a'.repeat(2001) }] },
        },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'repeated question',
        sent: {
          ...patch,
          data: {
            answers: [
              { question_id: 'q-problem', value: 'a' },
              { question_id: 'q-problem', value: 'b' },
            ],
          },
        },
        expect: { status: 422, code: 'APPLICATION_VALIDATION_FAILED' },
      },
      {
        name: 'business: submit with a required answer missing',
        sent: { method: 'post', path: 'INCOMPLETE' },
        expect: { status: 422, code: 'APPLICATION_INCOMPLETE' },
      },
      {
        name: 'business: venture type (enum) invalid on POST /ventures',
        sent: {
          method: 'post',
          path: '/api/v1/ventures',
          data: { type: 'TEAM', name: 'x', summary: 'x', domain_ids: [], stage_id: null },
        },
        expect: { status: 422, code: 'PROFILE_VALIDATION_FAILED' },
      },
      {
        name: 'malformed JSON on POST /ventures (QuickTeam)',
        sent: { method: 'post', path: '/api/v1/ventures', data: '{' },
        expect: { status: 422, code: 'PROFILE_VALIDATION_FAILED' },
      },
      {
        name: 'malformed id in the path',
        sent: { method: 'get', path: `${API}/not-a-uuid` },
        expect: { status: 404 },
      },
      {
        name: 'unknown programme (well-formed)',
        sent: { ...create, data: { venture_id: fx.ventures.project, programme_id: UNKNOWN } },
        expect: { status: 404 },
      },
      {
        name: 'state: save a SUBMITTED application',
        sent: {
          method: 'patch',
          path: `${API}/${fx.applications.submitted}`,
          data: { answers: [] },
        },
        expect: { status: 409, code: 'APPLICATION_SUBMITTED' },
      },
      {
        name: 'state: duplicate pair',
        sent: {
          ...create,
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.open },
        },
        expect: { status: 409, code: 'APPLICATION_EXISTS' },
      },
    ]
    // An incomplete draft for the business case.
    const incomplete = await send(page.request, {
      ...create,
      data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
    })
    expect(incomplete.status()).toBe(201)
    const incompleteId = ((await incomplete.json()) as { id: string }).id

    const before = await rows()
    const matrix: Record<string, unknown>[] = []
    for (const c of cases) {
      const sent =
        c.sent.path === 'INCOMPLETE' ? { ...c.sent, path: `${API}/${incompleteId}/submit` } : c.sent
      const got = await outcome(await send(page.request, sent))
      matrix.push({ case: c.name, ...got })
      expect(got, c.name).toMatchObject(c.expect)
    }
    // The router's own 400 (undecodable path) is outside every WF05 handler (G14).
    const router = await send(page.request, { method: 'get', path: `${API}/%E0%A4%A` })
    matrix.push({ case: 'undecodable % in the path (router)', status: router.status() })
    expect(router.status()).toBe(400)
    expect(await router.text()).not.toMatch(LEAK)
    expect(await rows()).toEqual(before)
    writeJsonReport('WF05-PROD-05.validation-matrix.json', { cases: matrix })
    const by = (s: number) => matrix.filter((m) => m.status === s).map((m) => m.case)
    expect(by(400)).toEqual(['undecodable % in the path (router)'])
    expect(by(422)).toHaveLength(19)
  })
})

test.describe('WF05-PROD-05 B — draft-save audit over HTTP', () => {
  test('a changing save writes APPLICATION_DRAFT_UPDATED with the request id, ids and changed questions only; a no-op or refused save writes nothing', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const id = fx.applications.draft
    const updates = async () =>
      query<{ request_id: string; actor: string; after: Record<string, unknown> }>(
        `SELECT request_id, actor_account_id::text AS actor, after_data AS after FROM audit_events
          WHERE resource_id = $1 AND action = 'APPLICATION_DRAFT_UPDATED' ORDER BY created_at, id`,
        [id],
      )
    const start = (await updates()).length
    const secret = `Bí mật ${randomUUID().slice(0, 8)}`
    const changed = await send(page.request, {
      method: 'patch',
      path: `${API}/${id}`,
      data: { answers: [{ question_id: 'q-support', value: secret }] },
    })
    expect(changed.status()).toBe(200)
    const all = await updates()
    expect(all).toHaveLength(start + 1)
    expect(all.at(-1)).toEqual({
      request_id: changed.headers()['x-request-id'],
      actor: fx.owner.accountId,
      after: {
        programme_id: fx.programmes.open,
        venture_id: fx.ventures.project,
        status: 'DRAFT',
        changed_questions: ['q-support'],
      },
    })
    // The same save again (autosave, page hide with nothing typed): no row.
    await send(page.request, {
      method: 'patch',
      path: `${API}/${id}`,
      data: { answers: [{ question_id: 'q-support', value: secret }] },
    })
    // Refused saves: a stranger, a submitted application, a malformed body.
    await login(page.request, WF05_FIXTURE_EMAILS.other)
    expect(
      (
        await send(page.request, { method: 'patch', path: `${API}/${id}`, data: { answers: [] } })
      ).status(),
    ).toBe(404)
    await login(page.request, OWNER)
    await send(page.request, {
      method: 'patch',
      path: `${API}/${fx.applications.submitted}`,
      data: { answers: [] },
    })
    await send(page.request, { method: 'patch', path: `${API}/${id}`, data: '{' })
    expect(await updates()).toHaveLength(start + 1)
    // No answer text anywhere in the WF05 audit trail.
    const trail = await query<{ row: unknown }>(
      `SELECT to_jsonb(a) AS row FROM audit_events a WHERE resource_id = ANY($1::uuid[])`,
      [Object.values(fx.applications).concat(id)],
    )
    expect(JSON.stringify(trail)).not.toContain(secret)
    expect(JSON.stringify(trail)).not.toContain('Giảm thời gian giao hàng')
  })
})

/** QuickTeam → WF02 edit → apply → save → refresh → relogin → resume → submit → read. */
async function ownerJourney(
  page: Page,
  email: string,
  programmeId: string,
  type: 'PROJECT' | 'STARTUP',
) {
  await login(page.request, email)
  const [me] = await query<{ profile: string }>(
    `SELECT p.id::text AS profile FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
      WHERE a.email = $1`,
    [email],
  )
  await page.goto(`/programmes/${programmeId}/apply`)
  await expect(page.locator('[data-screen="L5-SUB0"]')).toBeVisible()
  await page.locator('#quick-name').fill(`QA ${type}`)
  await expect(page.getByRole('radio')).toHaveCount(0)
  await page.locator('[data-action="domain-picker"]').click()
  await page.locator('#quick-domain-list button').first().click()
  await page.locator('#quick-stage').selectOption({ index: 1 })
  await page.locator('#quick-summary').fill('Một dòng mô tả.')
  await page.locator('[data-action="quick-go"]').click()
  await expect(page).toHaveURL(new RegExp(`/applications/${programmeId}\\?tu=ds$`))
  const ventureId = new URL(page.url()).pathname.split('/')[2]!
  const owned = await query<{ id: string; type: string }>(
    'SELECT id::text, type::text FROM projects WHERE owner_profile_id = $1',
    [me!.profile],
  )
  expect(owned).toEqual([{ id: ventureId, type }])

  // WF02 edit of the same venture.
  await page.goto(`/projects/${ventureId}/edit`)
  await page.locator('#ve-name').fill(`QA ${type} (sửa)`)
  await page.locator('button[type="submit"]').click()
  await expect
    .poll(
      async () =>
        (await query<{ name: string }>('SELECT name FROM projects WHERE id = $1', [ventureId]))[0]!
          .name,
    )
    .toBe(`QA ${type} (sửa)`)

  // Start from S02, save, refresh.
  const form = `/projects/${ventureId}/applications/${programmeId}`
  await page.goto(`/demo/projects/${ventureId}`)
  await page.locator(`[data-programme="${programmeId}"] [data-action="apply"]`).click()
  await expect(page).toHaveURL(form)
  await page.locator('#q-q-problem').fill(`Trả lời ${type}`)
  await page.locator('#q-q-problem').blur()
  await expect(page.locator('[data-save-state]')).toHaveAttribute('data-save-state', 'idle')
  const [app] = await query<{ id: string }>(
    'SELECT id::text FROM applications WHERE venture_id = $1',
    [ventureId],
  )
  await page.reload()
  await expect(page.locator('#q-q-problem')).toHaveValue(`Trả lời ${type}`)

  // Relogin and resume the same draft.
  await page.context().clearCookies()
  await page.goto(form)
  await expect(page).toHaveURL(`/auth?redirect=${encodeURIComponent(form)}`)
  await login(page.request, email)
  await page.goto(form)
  await expect(page.locator('#q-q-problem')).toHaveValue(`Trả lời ${type}`)

  // Submit, then read the snapshot; a later venture edit never reaches it.
  await page.goto(`${form}/review`)
  await page.locator('[data-action="submit"]').click()
  await expect(page).toHaveURL(`${form}/submitted`)
  const snapshot = await (
    await send(page.request, { method: 'get', path: `${API}/${app!.id}` })
  ).json()
  expect(snapshot).toMatchObject({ id: app!.id, status: 'SUBMITTED', editable: false })
  const patched = await send(page.request, {
    method: 'patch',
    path: `/api/v1/ventures/${ventureId}`,
    data: { name: `QA ${type} (sau khi nộp)` },
  })
  expect(patched.status()).toBe(200)
  expect(
    await (await send(page.request, { method: 'get', path: `${API}/${app!.id}` })).json(),
  ).toEqual(snapshot)
  await page.goto(`/demo/projects/${ventureId}`)
  await page.locator(`[data-programme="${programmeId}"] [data-nav="application-view"]`).click()
  await expect(page.locator('[data-screen="L5-SUB3"]')).toContainText(`Trả lời ${type}`)

  // One venture, one application, the same ids everywhere.
  expect(
    (await query('SELECT id FROM projects WHERE owner_profile_id = $1', [me!.profile])).length,
  ).toBe(1)
  expect(
    await query<{ id: string; status: string; programme: string }>(
      `SELECT id::text, status::text, programme_id::text AS programme FROM applications WHERE venture_id = $1`,
      [ventureId],
    ),
  ).toEqual([{ id: app!.id, status: 'SUBMITTED', programme: programmeId }])
}

test.describe('WF05-PROD-05 happy paths', () => {
  test('PROJECT owner: create / edit venture, apply, save, refresh, relogin, resume, submit, read', async ({
    page,
  }) => {
    await ownerJourney(page, WF05_FIXTURE_EMAILS.other, fx.programmes.teamOnly, 'PROJECT')
  })

  test('STARTUP owner: the same journey', async ({ page }) => {
    await ownerJourney(page, WF05_FIXTURE_EMAILS.viewer, fx.programmes.startupOnly, 'STARTUP')
  })
})

test.describe('WF05-PROD-05 negative paths, IDOR and lifecycle', () => {
  test('every negative path is a controlled 4xx in the envelope and changes nothing', async ({
    page,
    playwright,
  }) => {
    const guest = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    const editor = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    await login(other, WF05_FIXTURE_EMAILS.secondOwner)
    await login(editor, WF05_FIXTURE_EMAILS.editor)
    await login(page.request, OWNER)
    const owner = page.request
    const d = `${API}/${fx.applications.draft}`
    const s = `${API}/${fx.applications.submitted}`
    const cd = `${API}/${fx.applications.closedDraft}`
    const answers = { answers: [{ question_id: 'q-problem', value: 'x' }] }
    const before = await rows()
    const cases: [string, APIRequestContext, Sent, number, string?][] = [
      [
        'guest create',
        guest,
        {
          method: 'post',
          path: API,
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
        },
        401,
      ],
      ['guest save', guest, { method: 'patch', path: d, data: answers }, 401],
      ['guest submit', guest, { method: 'post', path: `${d}/submit` }, 401],
      ['non-owner save', other, { method: 'patch', path: d, data: answers }, 404],
      ['non-owner submit', other, { method: 'post', path: `${d}/submit` }, 404],
      [
        'team member create (owner-only)',
        editor,
        {
          method: 'post',
          path: API,
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
        },
        403,
        'SCOPE_FORBIDDEN',
      ],
      ['team member save', editor, { method: 'patch', path: d, data: answers }, 404],
      ['foreign application read', other, { method: 'get', path: s }, 404],
      ['foreign application update', other, { method: 'patch', path: s, data: answers }, 404],
      ['foreign application submit', other, { method: 'post', path: `${s}/submit` }, 404],
      [
        'foreign venture in the body (IDOR)',
        other,
        {
          method: 'post',
          path: API,
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
        },
        404,
      ],
      [
        'invalid venture',
        owner,
        {
          method: 'post',
          path: API,
          data: { venture_id: UNKNOWN, programme_id: fx.programmes.open },
        },
        404,
      ],
      [
        'invalid programme',
        owner,
        {
          method: 'post',
          path: API,
          data: { venture_id: fx.ventures.project, programme_id: UNKNOWN },
        },
        404,
      ],
      ['invalid application', owner, { method: 'get', path: `${API}/${UNKNOWN}` }, 404],
      [
        'CLOSED programme create',
        owner,
        {
          method: 'post',
          path: API,
          data: { venture_id: fx.ventures.archived, programme_id: fx.programmes.closed },
        },
        404,
      ],
      [
        'CLOSED programme edit',
        owner,
        { method: 'patch', path: cd, data: answers },
        409,
        'APPLICATION_NOT_ELIGIBLE',
      ],
      [
        'CLOSED programme submit',
        owner,
        { method: 'post', path: `${cd}/submit` },
        409,
        'APPLICATION_NOT_ELIGIBLE',
      ],
      [
        'SUBMITTED edit',
        owner,
        { method: 'patch', path: s, data: answers },
        409,
        'APPLICATION_SUBMITTED',
      ],
      [
        'SUBMITTED resubmit',
        owner,
        { method: 'post', path: `${s}/submit` },
        409,
        'APPLICATION_SUBMITTED',
      ],
      ['SUBMITTED delete (no such method)', owner, { method: 'delete', path: s }, 405],
      ['DRAFT delete (no such method)', owner, { method: 'delete', path: d }, 405],
      ['PUT replace (no such method)', owner, { method: 'put', path: d, data: answers }, 405],
      [
        'invalid form answer',
        owner,
        { method: 'patch', path: d, data: { answers: [{ question_id: 'q-x', value: 'x' }] } },
        422,
        'APPLICATION_VALIDATION_FAILED',
      ],
      [
        'duplicate application',
        owner,
        {
          method: 'post',
          path: API,
          data: { venture_id: fx.ventures.project, programme_id: fx.programmes.open },
        },
        409,
        'APPLICATION_EXISTS',
      ],
      [
        'owner_profile_id in the body (IDOR)',
        owner,
        {
          method: 'post',
          path: API,
          data: {
            venture_id: fx.ventures.project,
            programme_id: fx.programmes.teamOnly,
            owner_profile_id: fx.secondOwner.profileId,
          },
        },
        422,
      ],
      [
        'created_by_account_id in the body',
        owner,
        {
          method: 'post',
          path: API,
          data: {
            venture_id: fx.ventures.project,
            programme_id: fx.programmes.teamOnly,
            created_by_account_id: fx.secondOwner.accountId,
          },
        },
        422,
      ],
      [
        'status in a save',
        owner,
        { method: 'patch', path: d, data: { ...answers, status: 'SUBMITTED' } },
        422,
      ],
      ['spoofed identity headers', other, { method: 'get', path: d }, 404],
    ]
    const matrix: Record<string, unknown>[] = []
    for (const [name, who, sent, status, code] of cases) {
      const headers: Record<string, string> =
        name === 'spoofed identity headers'
          ? {
              'x-account-id': fx.owner.accountId,
              'x-owner-profile-id': fx.owner.profileId,
              'x-role': 'PLATFORM_ADMIN',
            }
          : {}
      const got = await outcome(await send(who, sent, headers))
      matrix.push({ case: name, ...got })
      expect(got.status, name).toBe(status)
      if (code) expect(got.code, name).toBe(code)
    }

    // ARCHIVED programme (compatibility state, no endpoint): writes blocked, history readable.
    await query(`UPDATE programmes SET status = 'ARCHIVED' WHERE id = $1`, [fx.programmes.closed])
    try {
      for (const [name, sent, status] of [
        ['ARCHIVED programme edit', { method: 'patch', path: cd, data: answers }, 409],
        ['ARCHIVED programme submit', { method: 'post', path: `${cd}/submit` }, 409],
        [
          'ARCHIVED programme create',
          {
            method: 'post',
            path: API,
            data: { venture_id: fx.ventures.archived, programme_id: fx.programmes.closed },
          },
          404,
        ],
        ['ARCHIVED programme history read', { method: 'get', path: cd }, 200],
      ] as const) {
        const got = await outcome(await send(owner, sent as Sent))
        matrix.push({ case: name, ...got })
        expect(got.status, name).toBe(status)
      }
    } finally {
      await query(`UPDATE programmes SET status = 'CLOSED' WHERE id = $1`, [fx.programmes.closed])
    }
    expect(await rows()).toEqual(before)
    writeJsonReport('WF05-PROD-05.negative-matrix.json', { cases: matrix })
    await Promise.all([guest.dispose(), other.dispose(), editor.dispose()])
  })

  test('a refused submit never locks its key: the same key succeeds once the draft is complete, then replays', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const created = await send(page.request, {
      method: 'post',
      path: API,
      data: { venture_id: fx.ventures.startup, programme_id: fx.programmes.startupOnly },
    })
    expect(created.status()).toBe(201)
    const id = ((await created.json()) as { id: string }).id
    const key = { 'Idempotency-Key': randomUUID() }
    const submit = { method: 'post', path: `${API}/${id}/submit` } as const
    expect((await outcome(await send(page.request, submit, key))).code).toBe(
      'APPLICATION_INCOMPLETE',
    )
    await send(page.request, {
      method: 'patch',
      path: `${API}/${id}`,
      data: { answers: [{ question_id: 'q-problem', value: 'Đủ rồi' }] },
    })
    const first = await send(page.request, submit, key)
    expect(first.status()).toBe(200)
    const again = await send(page.request, submit, key) // a network retry of the same request
    expect(again.status()).toBe(200)
    expect(await again.json()).toEqual(await first.json())
    expect((await outcome(await send(page.request, submit))).code).toBe('APPLICATION_SUBMITTED')
    const [row] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1 AND action = 'APPLICATION_SUBMITTED'`,
      [id],
    )
    expect(row!.n).toBe(1)
  })

  test('no private data leaks: a submitted snapshot carries no e-mail, account id or session token', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const cookie = (await page.context().cookies()).map((c) => c.value).filter((v) => v.length > 16)
    const body = await (
      await send(page.request, { method: 'get', path: `${API}/${fx.applications.submitted}` })
    ).text()
    expect(body).not.toMatch(/@example\.test/)
    for (const id of [fx.owner.accountId, fx.editor.accountId, fx.viewer.accountId])
      expect(body).not.toContain(id)
    for (const value of cookie) expect(body).not.toContain(value)
    const list = await (
      await send(page.request, { method: 'get', path: '/api/v1/me/applications' })
    ).text()
    expect(list).not.toMatch(/@example\.test|answers/)
  })
})
