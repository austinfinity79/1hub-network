import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query, withTransaction } from '@/lib/db/client'
import { putProgrammeRegistration } from '@/lib/programme/programme'
import { getVenture } from '@/lib/venture/venture'
import { seedVenture } from '@/lib/venture/testing'

import {
  createApplication,
  createApplicationIn,
  getApplication,
  getApplicationContext,
  listMyApplications,
  saveApplicationAnswers,
  submitApplication,
} from './application'
import { buildWf05Fixture, removeWf05Fixture, type Wf05Fixture } from './testing'

/**
 * WF05-PROD-03 — lifecycle / API / RBAC hardening of the server-side Application
 * (WF05 production contract: domain and lifecycle, RBAC / API / frontend; handoff
 * P3-1 … P3-8). Runs on the deterministic WF05 fixture.
 */

const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002' // Chapter 01 leader (WF04 operator)
const RID = 'req-wf05-prod03'
let fx: Wf05Fixture

beforeAll(async () => {
  fx = await buildWf05Fixture()
}, 60_000)

afterAll(async () => {
  await removeWf05Fixture()
  await closePool()
}, 60_000)

/** The ApiError code (and its field / reason) a call refuses with. */
async function refusal(work: Promise<unknown>) {
  const error = await work.then(
    () => null,
    (e: unknown) => e,
  )
  if (!isApiError(error)) throw new Error(`expected an ApiError, got ${String(error)}`)
  return { status: error.status, code: error.code, details: error.fields ?? null }
}

async function row(id: string) {
  const [r] = await query<{ status: string; answers: unknown; updated_at: string }>(
    'SELECT status::text, answers, updated_at::text FROM applications WHERE id = $1',
    [id],
  )
  return r
}

describe('authority: the owner only, server side', () => {
  it('an ACTIVE EDIT or VIEW member cannot start an application (403), nor read, save or submit one (404)', async () => {
    for (const member of [fx.editor, fx.viewer]) {
      expect(
        await refusal(
          createApplication(
            member.accountId,
            { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
            RID,
          ),
        ),
      ).toMatchObject({ status: 403, code: 'SCOPE_FORBIDDEN' })
      expect(await refusal(getApplication(member.accountId, fx.applications.draft))).toMatchObject({
        status: 404,
      })
      expect(
        await refusal(
          saveApplicationAnswers(member.accountId, fx.applications.draft, { answers: [] }),
        ),
      ).toMatchObject({ status: 404 })
      expect(
        await refusal(submitApplication(member.accountId, fx.applications.draft, RID)),
      ).toMatchObject({ status: 404 })
    }
  })

  it('another user and a programme operator read and change nothing (IDOR: the same 404)', async () => {
    const before = await row(fx.applications.draft)
    for (const accountId of [fx.other.accountId, fx.secondOwner.accountId, LEADER_ACCOUNT]) {
      expect(await refusal(getApplication(accountId, fx.applications.draft))).toMatchObject({
        status: 404,
      })
      expect(await refusal(getApplication(accountId, fx.applications.submitted))).toMatchObject({
        status: 404,
      })
      expect(
        await refusal(
          saveApplicationAnswers(accountId, fx.applications.draft, {
            answers: [{ question_id: 'q-problem', value: 'Chiếm' }],
          }),
        ),
      ).toMatchObject({ status: 404 })
      expect(await refusal(submitApplication(accountId, fx.applications.draft, RID))).toMatchObject(
        {
          status: 404,
        },
      )
      expect(
        await refusal(
          createApplication(
            accountId,
            { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
            RID,
          ),
        ),
      ).toMatchObject({ status: 404 })
    }
    expect(await row(fx.applications.draft)).toEqual(before)
  })

  it('takes no owner, status or applicant field from the body', async () => {
    for (const key of [
      'status',
      'owner_profile_id',
      'created_by_account_id',
      'primary_applicant_type',
    ]) {
      expect(
        await refusal(
          createApplication(
            fx.owner.accountId,
            { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly, [key]: 'x' },
            RID,
          ),
        ),
      ).toMatchObject({
        status: 422,
        code: 'APPLICATION_VALIDATION_FAILED',
        details: { [key]: 'not_accepted' },
      })
    }
  })

  it('answers a malformed 36-character venture id with 404, never a 500 (G06)', async () => {
    for (const id of ['0'.repeat(36), '-'.repeat(36), 'ffffffff-ffff-ffff-ffff-fffffffffffg'])
      expect(await refusal(getVenture(fx.owner.accountId, id))).toMatchObject({ status: 404 })
  })
})

describe('programme state and venture state (contract matrix)', () => {
  it('a CLOSED programme: no create, save or submit; the owner reads the draft read only and the snapshot', async () => {
    expect(
      await refusal(
        createApplication(
          fx.owner.accountId,
          { venture_id: fx.ventures.secondOwner, programme_id: fx.programmes.closed },
          RID,
        ),
      ),
    ).toMatchObject({ status: 404 })
    expect(
      await refusal(
        saveApplicationAnswers(fx.owner.accountId, fx.applications.closedDraft, {
          answers: [{ question_id: 'q-support', value: 'x' }],
        }),
      ),
    ).toMatchObject({
      status: 409,
      code: 'APPLICATION_NOT_ELIGIBLE',
      details: { reason: 'NOT_PUBLISHED' },
    })
    expect(
      await refusal(submitApplication(fx.owner.accountId, fx.applications.closedDraft, RID)),
    ).toMatchObject({ status: 409, code: 'APPLICATION_NOT_ELIGIBLE' })

    const draft = await getApplication(fx.owner.accountId, fx.applications.closedDraft)
    expect(draft).toMatchObject({ status: 'DRAFT', editable: false, reason: 'NOT_PUBLISHED' })
    expect(draft.questions.map((q) => q.id)).toEqual(['q-problem', 'q-support'])
    expect(draft.answers).toEqual([
      { question_id: 'q-problem', value: 'Giảm thời gian giao hàng chặng cuối.' },
    ])
    const submitted = await getApplication(fx.owner.accountId, fx.applications.closedSubmitted)
    expect(submitted).toMatchObject({ status: 'SUBMITTED', editable: false, reason: 'SUBMITTED' })
    expect(submitted.answers).toHaveLength(1)
  })

  it('the SUB1 page context of a CLOSED programme: the owner draft read only; no new entry (WF05-PROD-04)', async () => {
    const context = await getApplicationContext(
      fx.owner.accountId,
      fx.ventures.project,
      fx.programmes.closed,
    )
    expect(context.eligibility).toEqual({ eligible: false, reason: 'NOT_PUBLISHED' })
    expect(context.application).toMatchObject({
      id: fx.applications.closedDraft,
      status: 'DRAFT',
      editable: false,
      reason: 'NOT_PUBLISHED',
    })
    expect(context.form.questions.map((q) => q.id)).toEqual(['q-problem', 'q-support'])
    // No application of this venture to the closed programme: the same 404 as before.
    expect(
      await refusal(
        getApplicationContext(fx.owner.accountId, fx.ventures.archived, fx.programmes.closed),
      ),
    ).toMatchObject({ status: 404 })
    // Anyone but the owner: 404, whatever the programme state.
    expect(
      await refusal(
        getApplicationContext(fx.editor.accountId, fx.ventures.project, fx.programmes.closed),
      ),
    ).toMatchObject({ status: 404 })
    // An open programme is unchanged.
    expect(
      (await getApplicationContext(fx.owner.accountId, fx.ventures.project, fx.programmes.open))
        .eligibility,
    ).toEqual({ eligible: true })
  })

  it('an ARCHIVED programme behaves as CLOSED; a DRAFT programme takes no application', async () => {
    await query(`UPDATE programmes SET status = 'ARCHIVED' WHERE id = $1`, [fx.programmes.closed])
    try {
      expect(await getApplication(fx.owner.accountId, fx.applications.closedDraft)).toMatchObject({
        editable: false,
        reason: 'NOT_PUBLISHED',
      })
      expect(
        await refusal(submitApplication(fx.owner.accountId, fx.applications.closedDraft, RID)),
      ).toMatchObject({ status: 409 })
    } finally {
      await query(`UPDATE programmes SET status = 'CLOSED' WHERE id = $1`, [fx.programmes.closed])
    }
    await query(`UPDATE programmes SET status = 'DRAFT' WHERE id = $1`, [fx.programmes.noForm])
    expect(
      await refusal(
        createApplication(
          fx.owner.accountId,
          { venture_id: fx.ventures.project, programme_id: fx.programmes.noForm },
          RID,
        ),
      ),
    ).toMatchObject({ status: 404 })
  })

  it('an ARCHIVED venture: create, save and submit refused; its draft reads as read only (G09)', async () => {
    expect(
      await refusal(
        createApplication(
          fx.owner.accountId,
          { venture_id: fx.ventures.archived, programme_id: fx.programmes.open },
          RID,
        ),
      ),
    ).toMatchObject({
      status: 409,
      code: 'APPLICATION_NOT_ELIGIBLE',
      details: { reason: 'ARCHIVED' },
    })

    const venture = (
      await seedVenture(fx.owner.accountId, {
        type: 'STARTUP',
        name: 'WF05 Fixture Later Archived',
      })
    ).id
    const draft = await createApplication(
      fx.owner.accountId,
      { venture_id: venture, programme_id: fx.programmes.startupOnly },
      RID,
    )
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [venture])
    expect(
      await refusal(
        saveApplicationAnswers(fx.owner.accountId, draft.id, {
          answers: [{ question_id: 'q-problem', value: 'x' }],
        }),
      ),
    ).toMatchObject({
      status: 409,
      code: 'APPLICATION_NOT_ELIGIBLE',
      details: { reason: 'ARCHIVED' },
    })
    expect(await refusal(submitApplication(fx.owner.accountId, draft.id, RID))).toMatchObject({
      status: 409,
    })
    expect(await getApplication(fx.owner.accountId, draft.id)).toMatchObject({
      editable: false,
      reason: 'ARCHIVED',
    })
  })

  it('lists every own application in every programme state, with the programme status', async () => {
    const mine = await listMyApplications(fx.owner.accountId)
    const byId = new Map(mine.map((a) => [a.id, a]))
    expect(byId.get(fx.applications.closedSubmitted)?.programme.status).toBe('CLOSED')
    expect(byId.get(fx.applications.closedDraft)?.programme.status).toBe('CLOSED')
    expect(byId.get(fx.applications.draft)?.programme.status).toBe('PUBLISHED')
  })
})

describe('validation (allowlists)', () => {
  it.each([
    ['an unknown question', [{ question_id: 'q-x', value: 'a' }], 'answers', 'unknown_question'],
    [
      'the same question twice',
      [
        { question_id: 'q-problem', value: 'a' },
        { question_id: 'q-problem', value: 'b' },
      ],
      'answers',
      'duplicate',
    ],
    [
      'more entries than questions',
      [
        { question_id: 'q-problem', value: 'a' },
        { question_id: 'q-support', value: 'b' },
        { question_id: 'q-support', value: 'c' },
      ],
      'answers',
      'too_many',
    ],
    ['a non-string value', [{ question_id: 'q-problem', value: 7 }], 'q-problem', 'invalid'],
    [
      'an oversized value',
      [{ question_id: 'q-problem', value: 'x'.repeat(2001) }],
      'q-problem',
      'too_long',
    ],
  ])('refuses %s with 422 and changes nothing', async (_case, answers, field, reason) => {
    const before = await row(fx.applications.draft)
    expect(
      await refusal(saveApplicationAnswers(fx.owner.accountId, fx.applications.draft, { answers })),
    ).toMatchObject({
      status: 422,
      code: 'APPLICATION_VALIDATION_FAILED',
      details: { [field]: reason },
    })
    expect(await row(fx.applications.draft)).toEqual(before)
  })

  it('refuses an extra body key, a malformed id and an unknown programme', async () => {
    expect(
      await refusal(
        saveApplicationAnswers(fx.owner.accountId, fx.applications.draft, {
          answers: [],
          status: 'SUBMITTED',
        }),
      ),
    ).toMatchObject({ status: 422, details: { status: 'not_accepted' } })
    expect(
      await refusal(
        createApplication(
          fx.owner.accountId,
          { venture_id: 'nope', programme_id: fx.programmes.open },
          RID,
        ),
      ),
    ).toMatchObject({ status: 422, details: { venture_id: 'invalid' } })
    expect(
      await refusal(
        createApplication(
          fx.owner.accountId,
          { venture_id: fx.ventures.project, programme_id: '00000000-0000-4000-8000-000000000000' },
          RID,
        ),
      ),
    ).toMatchObject({ status: 404 })
  })
})

describe('concurrency, the form lock and pool use', () => {
  it('two concurrent creates for one pair: one DRAFT, one APPLICATION_EXISTS', async () => {
    const body = { venture_id: fx.ventures.startup, programme_id: fx.programmes.startupOnly }
    const results = await Promise.allSettled([
      createApplication(fx.owner.accountId, body, RID),
      createApplication(fx.owner.accountId, body, RID),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(isApiError(rejected.reason) && rejected.reason.code).toBe('APPLICATION_EXISTS')
    const [count] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM applications WHERE venture_id = $1 AND programme_id = $2',
      [body.venture_id, body.programme_id],
    )
    expect(count!.n).toBe(1)
  })

  it('two concurrent submits, and a save racing them: one SUBMITTED, the others refused', async () => {
    const [created] = await query<{ id: string }>(
      'SELECT id::text FROM applications WHERE venture_id = $1 AND programme_id = $2',
      [fx.ventures.startup, fx.programmes.startupOnly],
    )
    await saveApplicationAnswers(fx.owner.accountId, created!.id, {
      answers: [{ question_id: 'q-problem', value: 'Sẵn sàng nộp.' }],
    })
    const results = await Promise.allSettled([
      submitApplication(fx.owner.accountId, created!.id, RID),
      submitApplication(fx.owner.accountId, created!.id, RID),
      saveApplicationAnswers(fx.owner.accountId, created!.id, {
        answers: [{ question_id: 'q-support', value: 'Đua.' }],
      }),
    ])
    const submits = results.slice(0, 2)
    expect(submits.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const final = await getApplication(fx.owner.accountId, created!.id)
    expect(final.status).toBe('SUBMITTED')
    const [audits] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1 AND action = 'APPLICATION_SUBMITTED'`,
      [created!.id],
    )
    expect(audits!.n).toBe(1)
  })

  it('a registration change waits for an application being created, then refuses (G10)', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((done) => {
      release = done
    })
    let createdId = ''
    const create = withTransaction(async (exec) => {
      createdId = (
        await createApplicationIn(
          exec,
          fx.owner.accountId,
          { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
          RID,
        )
      ).id
      await gate
    })
    await new Promise((done) => setTimeout(done, 150))
    let settled = false
    const change = putProgrammeRegistration(
      LEADER_ACCOUNT,
      fx.programmes.teamOnly,
      {
        applicant_types: ['TEAM'],
        questions: [{ id: 'q-new', prompt: 'Câu mới?', required: true, step: 2 }],
      },
      RID,
    ).then(
      () => ({ ok: true as const }),
      (e: unknown) => ({ ok: false as const, e }),
    )
    void change.then(() => {
      settled = true
    })
    await new Promise((done) => setTimeout(done, 400))
    expect(settled).toBe(false)
    release()
    await create
    const outcome = await change
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && isApiError(outcome.e) && outcome.e.status).toBe(409)
    const [form] = await query<{ version: number }>(
      'SELECT version FROM programme_application_forms WHERE programme_id = $1',
      [fx.programmes.teamOnly],
    )
    expect(form!.version).toBe(1)
    expect((await getApplication(fx.owner.accountId, createdId)).question_set_version).toBe(1)
  })

  it('twelve concurrent creates complete: a transaction never borrows a second connection (G13)', async () => {
    const ventures: string[] = []
    for (let i = 0; i < 12; i += 1)
      ventures.push(
        (await seedVenture(fx.owner.accountId, { type: 'PROJECT', name: `WF05 Fixture Pool ${i}` }))
          .id,
      )
    const results = await Promise.allSettled(
      ventures.map((venture_id) =>
        createApplication(
          fx.owner.accountId,
          { venture_id, programme_id: fx.programmes.open },
          RID,
        ),
      ),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(12)
  }, 30_000)
})

describe('audit', () => {
  it('records create and submit with actor, target, context and result, never answers; a save is not audited', async () => {
    const rows = await query<{ action: string; actor: string; after: Record<string, unknown> }>(
      `SELECT action, actor_account_id::text AS actor, after_data AS after FROM audit_events
        WHERE resource_id = $1 ORDER BY created_at, id`,
      [fx.applications.submitted],
    )
    expect(rows.map((r) => r.action)).toEqual([
      'APPLICATION_DRAFT_CREATED',
      'APPLICATION_SUBMITTED',
    ])
    for (const r of rows) {
      expect(r.actor).toBe(fx.owner.accountId)
      expect(r.after).toMatchObject({
        programme_id: fx.programmes.open,
        venture_id: fx.ventures.startup,
      })
      expect(JSON.stringify(r.after)).not.toContain('Giảm thời gian')
    }
  })
})
