import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { createVenture, updateVenture } from '@/lib/venture/venture'

import {
  createApplication,
  createApplicationIn,
  getApplication,
  listMyApplications,
  saveApplicationAnswers,
  submitApplication,
  submitApplicationIn,
} from './application'

/**
 * TASK 24.4 — the server-side Application against live PostgreSQL (DEC-L5-D2 /
 * D3, migration 013). The seeded PUBLISHED programme accepts TEAM and STARTUP
 * with two required questions; two test programmes cover the closed and the
 * TEAM-only cases.
 */

const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const STAGE = '23000000-0000-0000-0000-000000000001'
const RID = 'req-application-test'
const CORE = { summary: 'Mô tả một dòng', domain_ids: [DOMAIN], stage_id: STAGE }

type Member = { accountId: string; profileId: string }
const accounts: string[] = []
const programmes: string[] = []

async function member(done = true): Promise<Member> {
  const email = `app-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'Người thử', $2, now(), $3) RETURNING id::text`,
    [a!.id, done ? 'ACTIVE' : 'DRAFT', done ? new Date() : null],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id }
}

async function venture(owner: Member, type: 'PROJECT' | 'STARTUP' = 'STARTUP') {
  return createVenture(owner.accountId, { type, name: `Đội ${Date.now()}`, ...CORE }, RID)
}

async function testProgramme(status: 'PUBLISHED' | 'DRAFT', types: string[]) {
  const [p] = await query<{ id: string }>(
    `INSERT INTO programmes (organization_id, programme_type, slug, name, status)
     VALUES ($1, 'PROGRAMME', $2, 'Chương trình thử', $3) RETURNING id::text`,
    [CHAPTER_01, `app-test-${Date.now()}-${Math.random().toString(36).slice(2)}`, status],
  )
  await query(
    `INSERT INTO programme_application_forms (programme_id, applicant_types, questions)
     VALUES ($1, $2::applicant_type[], '[{"id":"q","prompt":"Câu hỏi","required":true,"step":1}]')`,
    [p!.id, types],
  )
  programmes.push(p!.id)
  return p!.id
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status, fields: error.fields }
    throw error
  }
  throw new Error('expected a refusal')
}

const answer = (question_id: string, value: string) => ({ question_id, value })
const NOT_FOUND = { code: 'UNCONTRACTED_NOT_FOUND', status: 404 }

let owner: Member
let teammate: Member
let stranger: Member
let ventureId = ''

beforeAll(async () => {
  owner = await member()
  teammate = await member()
  stranger = await member()
  ventureId = (await venture(owner)).id
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
     VALUES ($1, $2, 'Kỹ thuật', 'ACTIVE', now())`,
    [ventureId, teammate.profileId],
  )
})

afterAll(async () => {
  const ventures = `(SELECT id FROM projects WHERE owner_profile_id IN (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[])))`
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (SELECT id FROM applications WHERE venture_id IN ${ventures})
        OR resource_id IN ${ventures}`,
    [accounts],
  )
  await query(`DELETE FROM applications WHERE venture_id IN ${ventures}`, [accounts])
  await query(`DELETE FROM project_members WHERE project_id IN ${ventures}`, [accounts])
  await query(`DELETE FROM project_domains WHERE project_id IN ${ventures}`, [accounts])
  await query(`DELETE FROM projects WHERE id IN ${ventures}`, [accounts])
  await query('DELETE FROM programme_application_forms WHERE programme_id = ANY($1::uuid[])', [
    programmes,
  ])
  await query('DELETE FROM programmes WHERE id = ANY($1::uuid[])', [programmes])
  await query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'app-test-%'")
  await query('DELETE FROM individual_profiles WHERE account_id = ANY($1::uuid[])', [accounts])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await closePool()
})

describe('POST /applications', () => {
  it('creates a DRAFT for the owner, referencing the venture, audited without answers', async () => {
    const app = await createApplication(
      owner.accountId,
      { venture_id: ventureId, programme_id: PROGRAMME },
      RID,
    )
    expect(app).toMatchObject({
      status: 'DRAFT',
      primary_applicant_type: 'STARTUP',
      programme: { id: PROGRAMME },
      venture: { id: ventureId, type: 'STARTUP', stage: { code: 'IDEA' } },
      answers: [],
      missing: ['q-problem', 'q-support'],
      submitted_at: null,
    })
    expect(app.questions.map((q) => [q.id, q.step, q.required])).toEqual([
      ['q-problem', 1, true],
      ['q-support', 4, true],
    ])
    expect(app.team.map((m) => m.relation)).toEqual(['OWNER', 'MEMBER'])
    const [row] = await query<{ answers: unknown; snapshot: unknown }>(
      'SELECT answers, snapshot FROM applications WHERE id = $1',
      [app.id],
    )
    expect(row).toEqual({ answers: [], snapshot: null })
    const audits = await query<{ action: string; after: Record<string, unknown> }>(
      'SELECT action, after_data AS after FROM audit_events WHERE resource_id = $1',
      [app.id],
    )
    expect(audits).toEqual([
      {
        action: 'APPLICATION_DRAFT_CREATED',
        after: { programme_id: PROGRAMME, venture_id: ventureId, status: 'DRAFT' },
      },
    ])
  })

  it('refuses a second active application for the same pair, with its id', async () => {
    const [existing] = await query<{ id: string }>(
      'SELECT id::text FROM applications WHERE venture_id = $1',
      [ventureId],
    )
    expect(
      await refusal(
        createApplication(owner.accountId, { venture_id: ventureId, programme_id: PROGRAMME }, RID),
      ),
    ).toEqual({ code: 'APPLICATION_EXISTS', status: 409, fields: { application_id: existing!.id } })
  })

  it('refuses a teammate, a stranger, a foreign venture and a pre-onboarding account', async () => {
    const body = { venture_id: ventureId, programme_id: PROGRAMME }
    expect(await refusal(createApplication(teammate.accountId, body, RID))).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
    expect(await refusal(createApplication(stranger.accountId, body, RID))).toMatchObject(NOT_FOUND)
    const drafting = await member(false)
    expect(await refusal(createApplication(drafting.accountId, body, RID))).toMatchObject({
      status: 403,
    })
  })

  it('refuses a closed or unknown programme, an archived venture and an unaccepted type', async () => {
    const other = (await venture(owner, 'STARTUP')).id
    const closed = await testProgramme('DRAFT', ['TEAM', 'STARTUP'])
    for (const programme_id of [closed, 'd4000000-0000-0000-0000-000000000099'])
      expect(
        await refusal(createApplication(owner.accountId, { venture_id: other, programme_id }, RID)),
      ).toMatchObject(NOT_FOUND)
    const teamOnly = await testProgramme('PUBLISHED', ['TEAM'])
    expect(
      await refusal(
        createApplication(owner.accountId, { venture_id: other, programme_id: teamOnly }, RID),
      ),
    ).toEqual({
      code: 'APPLICATION_NOT_ELIGIBLE',
      status: 409,
      fields: { reason: 'TYPE_NOT_ACCEPTED' },
    })
    await query("UPDATE projects SET status = 'ARCHIVED' WHERE id = $1", [other])
    expect(
      await refusal(
        createApplication(owner.accountId, { venture_id: other, programme_id: PROGRAMME }, RID),
      ),
    ).toEqual({ code: 'APPLICATION_NOT_ELIGIBLE', status: 409, fields: { reason: 'ARCHIVED' } })
  })

  it('validates the body and accepts nothing else', async () => {
    for (const [body, field] of [
      [null, 'body'],
      [{ venture_id: 'x', programme_id: PROGRAMME }, 'venture_id'],
      [{ venture_id: ventureId, programme_id: PROGRAMME, status: 'SUBMITTED' }, 'status'],
    ] as const)
      expect(await refusal(createApplication(owner.accountId, body, RID))).toMatchObject({
        code: 'APPLICATION_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: expect.any(String) },
      })
  })

  it('creates exactly one under a concurrent double create; the key replays the first', async () => {
    const fresh = (await venture(owner)).id
    const body = { venture_id: fresh, programme_id: PROGRAMME }
    const results = await Promise.allSettled([
      createApplication(owner.accountId, body, RID),
      createApplication(owner.accountId, body, RID),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: 'APPLICATION_EXISTS', status: 409 })

    const keyed = (await venture(owner)).id
    const run = () =>
      runIdempotent({
        key: `app-test-${keyed}`,
        operation: 'application.create',
        actorAccountId: owner.accountId,
        fingerprint: fingerprintRequest({ body: { venture_id: keyed, programme_id: PROGRAMME } }),
        run: async (exec) => ({
          status: 201,
          body: await createApplicationIn(
            exec,
            owner.accountId,
            { venture_id: keyed, programme_id: PROGRAMME },
            RID,
          ),
        }),
      })
    const first = await run()
    const again = await run()
    expect(again.body).toEqual(first.body)
    expect(await query('SELECT 1 FROM applications WHERE venture_id = $1', [keyed])).toHaveLength(1)
  })
})

describe('GET / PATCH /applications/{id}', () => {
  let id = ''
  beforeAll(async () => {
    ;[{ id }] = (await query<{ id: string }>(
      'SELECT id::text FROM applications WHERE venture_id = $1',
      [ventureId],
    )) as [{ id: string }]
  })

  it('reads for the owner only; a teammate, a stranger and a malformed id get the same 404', async () => {
    expect((await getApplication(owner.accountId, id)).id).toBe(id)
    for (const [actor, target] of [
      [teammate.accountId, id],
      [stranger.accountId, id],
      [owner.accountId, 'not-a-uuid'],
      [owner.accountId, '00000000-0000-0000-0000-000000000000'],
    ] as const)
      expect(await refusal(getApplication(actor, target))).toMatchObject(NOT_FOUND)
  })

  it('saves answers; an empty value clears one; unknown questions and long values are refused', async () => {
    const saved = await saveApplicationAnswers(owner.accountId, id, {
      answers: [answer('q-problem', 'Hao hụt ở chặng giao cuối.'), answer('q-support', 'Dữ liệu')],
    })
    expect(saved.missing).toEqual([])
    const cleared = await saveApplicationAnswers(owner.accountId, id, {
      answers: [answer('q-support', '   ')],
    })
    expect(cleared.answers).toEqual([answer('q-problem', 'Hao hụt ở chặng giao cuối.')])
    expect(cleared.missing).toEqual(['q-support'])
    expect(
      await refusal(saveApplicationAnswers(owner.accountId, id, { answers: [answer('q-x', 'a')] })),
    ).toMatchObject({ code: 'APPLICATION_VALIDATION_FAILED', status: 422 })
    expect(
      await refusal(
        saveApplicationAnswers(owner.accountId, id, {
          answers: [answer('q-problem', 'x'.repeat(2001))],
        }),
      ),
    ).toMatchObject({ code: 'APPLICATION_VALIDATION_FAILED', fields: { 'q-problem': 'too_long' } })
    expect(
      await refusal(
        saveApplicationAnswers(teammate.accountId, id, { answers: [answer('q-problem', 'x')] }),
      ),
    ).toMatchObject(NOT_FOUND)
  })

  it('lists the owner’s applications and nobody else’s', async () => {
    expect((await listMyApplications(owner.accountId)).map((a) => a.id)).toContain(id)
    expect(await listMyApplications(teammate.accountId)).toEqual([])
    expect(await listMyApplications(stranger.accountId)).toEqual([])
  })
})

describe('POST /applications/{id}/submit', () => {
  let id = ''
  beforeAll(async () => {
    ;[{ id }] = (await query<{ id: string }>(
      'SELECT id::text FROM applications WHERE venture_id = $1',
      [ventureId],
    )) as [{ id: string }]
  })

  it('refuses an incomplete draft with each missing id, and a foreign actor with 404', async () => {
    expect(await refusal(submitApplication(owner.accountId, id, RID))).toEqual({
      code: 'APPLICATION_INCOMPLETE',
      status: 422,
      fields: { 'q-support': 'required' },
    })
    expect(await refusal(submitApplication(stranger.accountId, id, RID))).toMatchObject(NOT_FOUND)
    expect(await refusal(submitApplication(teammate.accountId, id, RID))).toMatchObject(NOT_FOUND)
  })

  it('submits once with a snapshot; later edits never reach it; everything after is 409', async () => {
    await saveApplicationAnswers(owner.accountId, id, {
      answers: [answer('q-support', 'Kết nối doanh nghiệp')],
    })
    const done = await submitApplication(owner.accountId, id, RID)
    expect(done).toMatchObject({ status: 'SUBMITTED', missing: [] })
    expect(done.submitted_at).not.toBeNull()
    const [row] = await query<{ snapshot: Record<string, unknown>; by: string }>(
      'SELECT snapshot, submitted_by_account_id::text AS by FROM applications WHERE id = $1',
      [id],
    )
    expect(row!.by).toBe(owner.accountId)
    expect(row!.snapshot).toMatchObject({
      schema_version: 1,
      programme: { id: PROGRAMME, question_set_version: 1 },
      answers: [
        answer('q-problem', 'Hao hụt ở chặng giao cuối.'),
        answer('q-support', 'Kết nối doanh nghiệp'),
      ],
      venture: { id: ventureId },
    })
    expect(JSON.stringify(row!.snapshot)).not.toMatch(/@|account_id|email/)

    const before = done.venture.name
    await updateVenture(owner.accountId, ventureId, { name: 'Tên mới sau khi nộp' }, RID)
    expect((await getApplication(owner.accountId, id)).venture.name).toBe(before)

    expect(await refusal(submitApplication(owner.accountId, id, RID))).toMatchObject({
      code: 'APPLICATION_SUBMITTED',
      status: 409,
    })
    expect(
      await refusal(
        saveApplicationAnswers(owner.accountId, id, { answers: [answer('q-problem', 'đổi')] }),
      ),
    ).toMatchObject({ code: 'APPLICATION_SUBMITTED', status: 409 })
    const audits = await query<{ action: string; after: Record<string, unknown> }>(
      `SELECT action, after_data AS after FROM audit_events WHERE resource_id = $1 ORDER BY created_at`,
      [id],
    )
    expect(audits.map((a) => a.action)).toEqual([
      'APPLICATION_DRAFT_CREATED',
      'APPLICATION_SUBMITTED',
    ])
    expect(JSON.stringify(audits)).not.toMatch(/Hao hụt|Kết nối/)
  })

  it('replays a keyed double submit instead of answering 409', async () => {
    const fresh = (await venture(owner)).id
    const app = await createApplication(
      owner.accountId,
      { venture_id: fresh, programme_id: PROGRAMME },
      RID,
    )
    await saveApplicationAnswers(owner.accountId, app.id, {
      answers: [answer('q-problem', 'a'), answer('q-support', 'b')],
    })
    const run = () =>
      runIdempotent({
        key: `app-test-submit-${app.id}`,
        operation: 'application.submit',
        actorAccountId: owner.accountId,
        fingerprint: fingerprintRequest({ id: app.id }),
        run: async (exec) => ({
          status: 200,
          body: await submitApplicationIn(exec, owner.accountId, app.id, RID),
        }),
      })
    const first = await run()
    expect((await run()).body).toEqual(first.body)
    expect(
      await query(
        "SELECT 1 FROM audit_events WHERE resource_id = $1 AND action = 'APPLICATION_SUBMITTED'",
        [app.id],
      ),
    ).toHaveLength(1)
  })

  it('the database itself refuses to change a submitted row or submit without a snapshot', async () => {
    await expect(
      query("UPDATE applications SET answers = '[]'::jsonb WHERE id = $1", [id]),
    ).rejects.toThrow(/final/)
    const fresh = (await venture(owner)).id
    const app = await createApplication(
      owner.accountId,
      { venture_id: fresh, programme_id: PROGRAMME },
      RID,
    )
    await expect(
      query("UPDATE applications SET status = 'SUBMITTED' WHERE id = $1", [app.id]),
    ).rejects.toThrow(/ck_applications_submitted/)
  })
})
