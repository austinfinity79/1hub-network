import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import {
  createApplication,
  listOpenForms,
  saveApplicationAnswers,
} from '@/lib/application/application'
import { closePool, query } from '@/lib/db/client'

import {
  closeProgramme,
  createProgramme,
  getProgramme,
  listProgrammes,
  publishProgramme,
  putProgrammeRegistration,
  updateProgramme,
} from './programme'

/**
 * WF04-PROD-03 — the canonical Programme service against live PostgreSQL
 * (API 05 §22, contract §4–§14, DEC-W4P-D02 / D11 / D12): RBAC on the stored
 * owner, lifecycle, validation, audit, and the WF05 hand-off by data.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const SEED_CHALLENGE = 'c0000000-0000-0000-0000-000000000001' // DRAFT, Chapter 01, one linked event
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001' // PUBLISHED, Chapter 01, form v1
const LINKED_EVENT = 'b0000000-0000-0000-0000-000000000002'
const MEMBER = '30000000-0000-0000-0000-000000000001' // INDIVIDUAL_USER + HUB_MEMBER of Chapter 01
const LEADER = '30000000-0000-0000-0000-000000000002' // HUB_COMMUNITY_LEADER of Chapter 01
const ADMIN = '30000000-0000-0000-0000-000000000003' // PLATFORM_ADMIN
const NEWCOMER = '30000000-0000-0000-0000-000000000004' // onboarding not done
const VENTURE = '50000000-0000-0000-0000-000000000001' // STARTUP owned by MEMBER

let OTHER_LEADER = '' // HUB_COMMUNITY_LEADER of Chapter 02 only
let COMPANY = ''
const accounts: string[] = []
const profiles: string[] = []
const programmes: string[] = []
let seq = 0
const rid = () => `prod03-test-${Date.now()}-${seq++}`

beforeAll(async () => {
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [`prod03-${Date.now()}@example.test`],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'Leader 02', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state)
     VALUES ($1, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $2, 'ACTIVE')`,
    [p!.id, CHAPTER_02],
  )
  OTHER_LEADER = a!.id
  accounts.push(a!.id)
  profiles.push(p!.id)
  const [c] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ('COMPANY', $1, 'Company 03', 'PUBLISHED') RETURNING id::text`,
    [`prod03-company-${Date.now()}`],
  )
  COMPANY = c!.id
})

afterAll(async () => {
  await query('DELETE FROM applications WHERE programme_id = ANY($1::uuid[])', [programmes])
  await query('DELETE FROM programme_application_forms WHERE programme_id = ANY($1::uuid[])', [
    programmes,
  ])
  await query('DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])', [programmes])
  await query('DELETE FROM programmes WHERE id = ANY($1::uuid[])', [programmes])
  await query('DELETE FROM organizations WHERE id = $1', [COMPANY])
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    profiles,
  ])
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [profiles])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await closePool()
})

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error))
      return { code: error.code, status: error.status, fields: error.fields ?? null }
    throw error
  }
  throw new Error('expected a refusal')
}

const NOT_FOUND = { code: 'UNCONTRACTED_NOT_FOUND', status: 404, fields: null }
const FORBIDDEN = { code: 'SCOPE_FORBIDDEN', status: 403, fields: null }
const CONFLICT = { code: 'MEMBERSHIP_INVALID_TRANSITION', status: 409, fields: null }
const invalid = (fields: Record<string, string>) => ({
  code: 'PROFILE_VALIDATION_FAILED',
  status: 422,
  fields,
})

async function draft(
  accountId = LEADER,
  body: Record<string, unknown> = {},
): Promise<{ id: string; type: string }> {
  const detail = await createProgramme(
    accountId,
    { type: 'PROGRAMME', organization_id: CHAPTER_01, name: 'Chương trình 03', ...body },
    rid(),
  )
  programmes.push(detail.programme.id)
  return { id: detail.programme.id, type: detail.programme.type }
}

const audits = (id: string) =>
  query<{ action: string; actor: string; before: unknown; after: unknown }>(
    `SELECT action, actor_account_id::text AS actor, before_data AS before, after_data AS after
       FROM audit_events WHERE resource_type = 'programme' AND resource_id = $1 ORDER BY created_at, id`,
    [id],
  )

const statusOf = async (id: string) =>
  (await query<{ status: string }>('SELECT status::text FROM programmes WHERE id = $1', [id]))[0]
    ?.status

describe('WF04-PROD-03 reads: canonical rows, owner-scoped, no fixture', () => {
  it('lists the programmes of the actor’s organizations only', async () => {
    const own = await draft()
    const foreign = await draft(ADMIN, { organization_id: CHAPTER_02 })

    const byLeader = (await listProgrammes(LEADER)).map((p) => p.id)
    expect(byLeader).toEqual(expect.arrayContaining([SEED_CHALLENGE, SEED_PROGRAMME, own.id]))
    expect(byLeader).not.toContain(foreign.id)
    const byOther = await listProgrammes(OTHER_LEADER)
    expect(byOther.map((p) => p.id)).toContain(foreign.id)
    expect(new Set(byOther.map((p) => p.organization.id))).toEqual(new Set([CHAPTER_02]))
    expect((await listProgrammes(ADMIN)).map((p) => p.id)).toEqual(
      expect.arrayContaining([own.id, foreign.id, SEED_PROGRAMME]),
    )
  })

  it('refuses the list without `programme:read` anywhere, or before onboarding is done', async () => {
    expect(await refusal(listProgrammes(MEMBER))).toEqual(FORBIDDEN)
    expect(await refusal(listProgrammes(NEWCOMER))).toEqual(FORBIDDEN)
    // Onboarding gates every call, reads and writes alike.
    expect(await refusal(getProgramme(NEWCOMER, SEED_PROGRAMME))).toEqual(FORBIDDEN)
    expect(await refusal(updateProgramme(NEWCOMER, SEED_PROGRAMME, { name: 'x' }, rid()))).toEqual(
      FORBIDDEN,
    )
    expect(await refusal(publishProgramme(NEWCOMER, SEED_PROGRAMME, undefined, rid()))).toEqual(
      FORBIDDEN,
    )
  })

  it('summarises with counts and the owner reference, never the raw metadata', async () => {
    const challenge = (await listProgrammes(LEADER)).find((p) => p.id === SEED_CHALLENGE)!
    expect(Object.keys(challenge).sort()).toEqual(
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
    expect(challenge.organization).toEqual({
      id: CHAPTER_01,
      slug: 'chapter-01',
      name: 'Chapter 01',
      type: 'CHAPTER',
    })
    expect(challenge.counts).toEqual({ stages: 0, events: 1, problem_statements: 0 })
  })

  it('reads the detail: linked events read only, the WF05 form, problems on a CHALLENGE', async () => {
    const challenge = await getProgramme(LEADER, SEED_CHALLENGE)
    expect(Object.keys(challenge).sort()).toEqual(
      [
        'events',
        'organization',
        'problem_statements',
        'programme',
        'registration',
        'stages',
      ].sort(),
    )
    expect(challenge.events.map((e) => [e.id, e.programme_id])).toEqual([
      [LINKED_EVENT, SEED_CHALLENGE],
    ])
    expect(challenge.problem_statements).toEqual([])
    expect(challenge.registration).toBeNull()

    const programme = await getProgramme(ADMIN, SEED_PROGRAMME)
    expect(programme).not.toHaveProperty('problem_statements')
    expect(programme.registration).toMatchObject({
      applicant_types: ['TEAM', 'STARTUP'],
      version: 1,
    })
    expect(programme.registration!.questions.map((q) => [q.id, q.required, q.step])).toEqual([
      ['q-problem', true, 1],
      ['q-support', true, 4],
    ])
  })

  it('answers the same 404 for out-of-scope, unknown and malformed ids', async () => {
    for (const [actor, id] of [
      [MEMBER, SEED_PROGRAMME],
      [OTHER_LEADER, SEED_PROGRAMME],
      [LEADER, '99999999-9999-9999-9999-999999999999'],
      [LEADER, 'not-a-uuid'],
      [LEADER, ''],
      [LEADER, "' OR 1=1 --"],
    ]) {
      expect(await refusal(getProgramme(actor!, id!)), `${actor} ${id}`).toEqual(NOT_FOUND)
    }
  })
})

describe('WF04-PROD-03 create: the owner is a choice inside the actor’s scope', () => {
  it('creates a DRAFT for an organization the actor manages, with one audit event', async () => {
    const detail = await createProgramme(
      LEADER,
      {
        type: 'CHALLENGE',
        organization_id: CHAPTER_01,
        name: '  Thử thách mới ',
        starts_at: '2026-11-01T00:00:00+07:00',
      },
      rid(),
    )
    programmes.push(detail.programme.id)

    expect(detail.programme).toMatchObject({
      type: 'CHALLENGE',
      organization_id: CHAPTER_01,
      name: 'Thử thách mới',
      status: 'DRAFT',
      starts_at: '2026-10-31T17:00:00.000Z',
      ends_at: null,
    })
    expect(detail.programme.slug).toMatch(/^thu-thach-moi-[0-9a-f]{8}$/)
    expect(detail).toMatchObject({
      stages: [],
      problem_statements: [],
      events: [],
      registration: null,
    })
    expect(await audits(detail.programme.id)).toEqual([
      {
        action: 'PROGRAMME_CREATED',
        actor: LEADER,
        before: null,
        after: {
          programme_id: detail.programme.id,
          organization_id: CHAPTER_01,
          type: 'CHALLENGE',
          status: 'DRAFT',
        },
      },
    ])
  })

  it('lets a Platform Admin own a programme by any operational unit', async () => {
    for (const org of [HUB, CHAPTER_02]) {
      const { id } = await draft(ADMIN, { organization_id: org })
      expect((await getProgramme(ADMIN, id)).organization.id).toBe(org)
    }
  })

  it('refuses another unit, an unknown unit and a non-operational unit', async () => {
    const before = await query<{ n: number }>('SELECT count(*)::int AS n FROM programmes')
    const body = (organization_id: string) => ({
      type: 'PROGRAMME',
      organization_id,
      name: 'Không được',
    })
    // Same role, wrong organization; unknown ids look the same.
    expect(await refusal(createProgramme(LEADER, body(CHAPTER_02), rid()))).toEqual(FORBIDDEN)
    expect(
      await refusal(createProgramme(LEADER, body('99999999-9999-9999-9999-999999999999'), rid())),
    ).toEqual(FORBIDDEN)
    expect(await refusal(createProgramme(ADMIN, body(COMPANY), rid()))).toEqual(
      invalid({ organization_id: 'invalid' }),
    )
    // No `programme:manage` anywhere, or onboarding not done.
    expect(await refusal(createProgramme(MEMBER, body(CHAPTER_01), rid()))).toEqual(FORBIDDEN)
    expect(await refusal(createProgramme(NEWCOMER, body(CHAPTER_01), rid()))).toEqual(FORBIDDEN)
    expect(await query('SELECT count(*)::int AS n FROM programmes')).toEqual(before)
  })

  it('takes no role, scope or lifecycle from the body', async () => {
    for (const extra of [
      { role: 'PLATFORM_ADMIN' },
      { status: 'PUBLISHED' },
      { scope: 'PLATFORM' },
    ]) {
      const key = Object.keys(extra)[0]!
      expect(
        await refusal(
          createProgramme(
            MEMBER,
            { type: 'PROGRAMME', organization_id: CHAPTER_01, name: 'x', ...extra },
            rid(),
          ),
        ),
      ).toEqual(FORBIDDEN)
      expect(
        await refusal(
          createProgramme(
            LEADER,
            { type: 'PROGRAMME', organization_id: CHAPTER_01, name: 'x', ...extra },
            rid(),
          ),
        ),
      ).toEqual(invalid({ [key]: 'not_accepted' }))
    }
  })
})

describe('WF04-PROD-03 edit: allow-listed content, owner-scoped, DRAFT and PUBLISHED only', () => {
  it('replaces basic fields, stages and problem statements, auditing field names only', async () => {
    const { id } = await draft(LEADER, { type: 'CHALLENGE' })
    const detail = await updateProgramme(
      LEADER,
      id,
      {
        name: 'Tên mới',
        summary: 'Tóm tắt',
        ends_at: '2026-12-01T00:00:00Z',
        stages: [
          { name: 'Ươm tạo', starts_on: '2026-11-01', ends_on: '2026-11-30' },
          { name: 'Demo' },
        ],
        problem_statements: [{ title: 'Bài toán 1', summary: 'Mô tả' }],
      },
      rid(),
    )
    expect(detail.programme).toMatchObject({ name: 'Tên mới', summary: 'Tóm tắt' })
    expect(detail.stages.map((s) => [s.position, s.name])).toEqual([
      [1, 'Ươm tạo'],
      [2, 'Demo'],
    ])
    expect(detail.problem_statements!.map((p) => p.title)).toEqual(['Bài toán 1'])

    const [{ metadata }] = (await query<{ metadata: Record<string, { schema_version: number }> }>(
      'SELECT metadata FROM programmes WHERE id = $1',
      [id],
    )) as [{ metadata: Record<string, { schema_version: number }> }]
    expect(metadata.journey!.schema_version).toBe(1)
    expect(metadata.challenge!.schema_version).toBe(1)

    const [, updated] = await audits(id)
    expect(updated).toMatchObject({
      action: 'PROGRAMME_UPDATED',
      after: {
        status: 'DRAFT',
        changed_fields: ['name', 'summary', 'ends_at', 'stages', 'problem_statements'],
      },
    })
    expect(JSON.stringify(updated)).not.toContain('Tên mới')
    expect(JSON.stringify(updated)).not.toContain('Bài toán 1')
  })

  it('writes nothing for a request that changes nothing', async () => {
    const { id } = await draft()
    await updateProgramme(LEADER, id, { name: 'Chương trình 03' }, rid())
    expect((await audits(id)).map((a) => a.action)).toEqual(['PROGRAMME_CREATED'])
  })

  it('keeps type and owner immutable and problem statements on a CHALLENGE', async () => {
    const { id } = await draft()
    expect(await refusal(updateProgramme(LEADER, id, { type: 'CHALLENGE' }, rid()))).toEqual(
      invalid({ type: 'immutable' }),
    )
    expect(
      await refusal(updateProgramme(LEADER, id, { organization_id: CHAPTER_02 }, rid())),
    ).toEqual(invalid({ organization_id: 'immutable' }))
    expect(await refusal(updateProgramme(LEADER, id, { status: 'CLOSED' }, rid()))).toEqual(
      invalid({ status: 'not_accepted' }),
    )
    expect(
      await refusal(updateProgramme(LEADER, id, { problem_statements: [{ title: 'x' }] }, rid())),
    ).toEqual(invalid({ problem_statements: 'not_challenge' }))
    expect(
      await refusal(
        updateProgramme(
          LEADER,
          id,
          { starts_at: '2026-11-02T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
          rid(),
        ),
      ),
    ).toEqual(invalid({ ends_at: 'before_start' }))
  })

  it('refuses another unit’s programme as not found (IDOR)', async () => {
    const { id } = await draft()
    for (const actor of [OTHER_LEADER, MEMBER]) {
      expect(await refusal(updateProgramme(actor, id, { name: 'Chiếm' }, rid()))).toEqual(NOT_FOUND)
      expect(await refusal(publishProgramme(actor, id, undefined, rid()))).toEqual(NOT_FOUND)
      expect(await refusal(closeProgramme(actor, id, undefined, rid()))).toEqual(NOT_FOUND)
      expect(
        await refusal(
          putProgrammeRegistration(actor, id, { applicant_types: ['TEAM'], questions: [] }, rid()),
        ),
      ).toEqual(NOT_FOUND)
    }
    expect(await statusOf(id)).toBe('DRAFT')
    expect((await getProgramme(LEADER, id)).programme.name).toBe('Chương trình 03')
  })
})

describe('WF04-PROD-03 lifecycle: DRAFT → PUBLISHED → CLOSED, nothing else', () => {
  it('publishes a DRAFT once and closes a PUBLISHED programme once', async () => {
    const { id } = await draft()
    expect((await publishProgramme(LEADER, id, undefined, rid())).programme.status).toBe(
      'PUBLISHED',
    )
    expect(await refusal(publishProgramme(LEADER, id, undefined, rid()))).toEqual(CONFLICT)
    // Edits stay open while PUBLISHED.
    await updateProgramme(LEADER, id, { summary: 'Đang mở' }, rid())
    expect((await closeProgramme(ADMIN, id, {}, rid())).programme.status).toBe('CLOSED')
    expect(await refusal(closeProgramme(LEADER, id, undefined, rid()))).toEqual(CONFLICT)
    // No way back and no edit once CLOSED.
    expect(await refusal(publishProgramme(LEADER, id, undefined, rid()))).toEqual(CONFLICT)
    expect(await refusal(updateProgramme(LEADER, id, { name: 'Mở lại' }, rid()))).toEqual(CONFLICT)
    expect(
      await refusal(
        putProgrammeRegistration(LEADER, id, { applicant_types: ['TEAM'], questions: [] }, rid()),
      ),
    ).toEqual(CONFLICT)

    expect((await audits(id)).map((a) => [a.action, a.before, a.after])).toEqual([
      ['PROGRAMME_CREATED', null, expect.objectContaining({ status: 'DRAFT' })],
      [
        'PROGRAMME_PUBLISHED',
        expect.objectContaining({ status: 'DRAFT' }),
        expect.objectContaining({ status: 'PUBLISHED' }),
      ],
      [
        'PROGRAMME_UPDATED',
        expect.objectContaining({ status: 'PUBLISHED' }),
        expect.objectContaining({ changed_fields: ['summary'] }),
      ],
      [
        'PROGRAMME_CLOSED',
        expect.objectContaining({ status: 'PUBLISHED' }),
        expect.objectContaining({ status: 'CLOSED' }),
      ],
    ])
    const closer = (await audits(id)).at(-1)!
    expect(closer.actor).toBe(ADMIN)
  })

  it('refuses closing a DRAFT and a body on a transition', async () => {
    const { id } = await draft()
    expect(await refusal(closeProgramme(LEADER, id, undefined, rid()))).toEqual(CONFLICT)
    expect(await refusal(publishProgramme(LEADER, id, { status: 'PUBLISHED' }, rid()))).toEqual(
      invalid({ status: 'not_accepted' }),
    )
    expect(await statusOf(id)).toBe('DRAFT')
  })

  it('publishes a CHALLENGE without problem statements, dates, stages or a form (Q7)', async () => {
    const { id } = await draft(LEADER, { type: 'CHALLENGE' })
    expect((await publishProgramme(LEADER, id, undefined, rid())).programme.status).toBe(
      'PUBLISHED',
    )
  })

  it('lists every failing publish rule at once', async () => {
    const [row] = await query<{ id: string }>(
      `INSERT INTO programmes (organization_id, programme_type, slug, name)
       VALUES ($1, 'PROGRAMME', $2, '   ') RETURNING id::text`,
      [CHAPTER_01, `prod03-blank-${Date.now()}`],
    )
    programmes.push(row!.id)
    expect(await refusal(publishProgramme(LEADER, row!.id, undefined, rid()))).toEqual(
      invalid({ name: 'required' }),
    )
    expect(await statusOf(row!.id)).toBe('DRAFT')
  })

  it('serialises concurrent publishes: one succeeds, the other is a conflict', async () => {
    const { id } = await draft()
    const results = await Promise.allSettled([
      publishProgramme(LEADER, id, undefined, rid()),
      publishProgramme(ADMIN, id, undefined, rid()),
    ])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(isApiError(failed.reason) && failed.reason.status).toBe(409)
    expect((await audits(id)).filter((a) => a.action === 'PROGRAMME_PUBLISHED')).toHaveLength(1)
  })

  it('never writes ARCHIVED: no transition, route or SQL reaches it (DEC-W4P-D11)', () => {
    const service = readFileSync(join(process.cwd(), 'src/lib/programme/programme.ts'), 'utf8')
    expect(service).not.toMatch(/'ARCHIVED'/)
    const routes = readdirSync(join(process.cwd(), 'src/app/api/v1/programmes/[programmeId]'))
    expect(routes.sort()).toEqual(['close', 'publish', 'registration', 'route.ts'])
  })
})

describe('WF04-PROD-03 registration: the canonical WF05 form, versioned', () => {
  const form = (prompt: string) => ({
    applicant_types: ['STARTUP', 'TEAM'],
    questions: [{ id: 'q-1', prompt, required: true, step: 1 }],
  })

  it('creates version 1, bumps on change, keeps the version when nothing changes', async () => {
    const { id } = await draft()
    expect((await putProgrammeRegistration(LEADER, id, form('A?'), rid())).registration).toEqual({
      applicant_types: ['TEAM', 'STARTUP'],
      questions: [{ id: 'q-1', prompt: 'A?', required: true, step: 1 }],
      version: 1,
    })
    expect(
      (await putProgrammeRegistration(LEADER, id, form('A?'), rid())).registration!.version,
    ).toBe(1)
    expect(
      (await putProgrammeRegistration(LEADER, id, form('B?'), rid())).registration!.version,
    ).toBe(2)
    expect(
      (await audits(id))
        .filter((a) => a.action === 'PROGRAMME_REGISTRATION_UPDATED')
        .map((a) => [
          (a.before as { version: number | null }).version,
          (a.after as { version: number }).version,
        ]),
    ).toEqual([
      [null, 1],
      [1, 2],
    ])
  })

  it('refuses INDIVIDUAL and questions without their own required / step (Q3)', async () => {
    const { id } = await draft()
    expect(
      await refusal(
        putProgrammeRegistration(
          LEADER,
          id,
          { applicant_types: ['INDIVIDUAL'], questions: [] },
          rid(),
        ),
      ),
    ).toEqual(invalid({ applicant_types: 'invalid' }))
    expect(
      await refusal(
        putProgrammeRegistration(
          LEADER,
          id,
          { applicant_types: ['TEAM'], questions: [{ prompt: 'x' }] },
          rid(),
        ),
      ),
    ).toEqual(invalid({ 'questions.0.required': 'required' }))
  })

  it('hands a published programme to WF05 by data; closing it stops new applications', async () => {
    const { id } = await draft()
    await putProgrammeRegistration(LEADER, id, form('Vấn đề?'), rid())
    await publishProgramme(LEADER, id, undefined, rid())
    expect((await listOpenForms()).map((f) => f.programme.id)).toContain(id)

    const application = await createApplication(
      MEMBER,
      { venture_id: VENTURE, programme_id: id },
      rid(),
    )
    expect(application).toMatchObject({ status: 'DRAFT' })

    // Q3: once an application exists the form is not edited.
    expect(await refusal(putProgrammeRegistration(LEADER, id, form('Đổi?'), rid()))).toEqual(
      CONFLICT,
    )

    await closeProgramme(LEADER, id, undefined, rid())
    expect((await listOpenForms()).map((f) => f.programme.id)).not.toContain(id)
    expect(
      await refusal(
        saveApplicationAnswers(MEMBER, application.id, {
          answers: [{ question_id: 'q-1', value: 'x' }],
        }),
      ),
    ).toMatchObject({ code: 'APPLICATION_NOT_ELIGIBLE', status: 409 })
    // The application itself is untouched by the programme lifecycle.
    const [stored] = await query<{ status: string }>(
      'SELECT status::text FROM applications WHERE id = $1',
      [application.id],
    )
    expect(stored!.status).toBe('DRAFT')
  })
})
