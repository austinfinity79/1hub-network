import { describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'

import {
  PROGRAMME_LIMITS,
  parseCreate,
  parseEmptyBody,
  parseProblems,
  parseRegistration,
  parseStages,
  parseUpdate,
  readProblems,
  readStages,
} from './rules'

/** WF04-PROD-03 — server-side Programme input rules (API 05 §22, contract §8, §11). */

const ORG = '10000000-0000-0000-0000-000000000101'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function refusal(fn: () => unknown) {
  try {
    fn()
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status, fields: error.fields }
    throw error
  }
  throw new Error('expected a refusal')
}

const field = (fn: () => unknown) => refusal(fn).fields

describe('parseCreate', () => {
  const valid = { type: 'CHALLENGE', organization_id: ORG, name: '  Thử thách  ' }

  it('accepts the canonical basic fields and trims text', () => {
    expect(
      parseCreate({
        ...valid,
        summary: ' ',
        starts_at: '2026-11-01T00:00:00+07:00',
        ends_at: '2026-11-01T00:00:00+07:00',
      }),
    ).toEqual({
      type: 'CHALLENGE',
      organization_id: ORG,
      name: 'Thử thách',
      summary: null,
      starts_at: '2026-10-31T17:00:00.000Z',
      ends_at: '2026-10-31T17:00:00.000Z',
    })
  })

  it('refuses with the ops validation envelope (422 PROFILE_VALIDATION_FAILED)', () => {
    expect(refusal(() => parseCreate({ ...valid, name: '' }))).toEqual({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
      fields: { name: 'required' },
    })
  })

  it.each([
    [{ ...valid, type: undefined }, { type: 'required' }],
    [{ ...valid, type: 'EVENT' }, { type: 'invalid' }],
    [{ ...valid, organization_id: undefined }, { organization_id: 'required' }],
    [{ ...valid, organization_id: 'chapter-01' }, { organization_id: 'invalid' }],
    [{ ...valid, name: 'x'.repeat(PROGRAMME_LIMITS.name + 1) }, { name: 'too_long' }],
    [{ ...valid, name: 7 }, { name: 'invalid' }],
    [{ ...valid, starts_at: '2026-11-01' }, { starts_at: 'invalid' }],
    [
      { ...valid, starts_at: '2026-11-02T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
      { ends_at: 'before_start' },
    ],
    // Server-owned and spoofable keys are refused by name, never ignored.
    [{ ...valid, status: 'PUBLISHED' }, { status: 'not_accepted' }],
    [{ ...valid, slug: 'x' }, { slug: 'not_accepted' }],
    [{ ...valid, metadata: {} }, { metadata: 'not_accepted' }],
    [{ ...valid, role: 'PLATFORM_ADMIN' }, { role: 'not_accepted' }],
    [{ ...valid, stages: [] }, { stages: 'not_accepted' }],
  ])('refuses %j', (body, fields) => {
    expect(field(() => parseCreate(body))).toEqual(fields)
  })

  it.each([null, [], 'x', 3])('refuses a body that is not an object (%j)', (body) => {
    expect(field(() => parseCreate(body))).toEqual({ body: 'invalid' })
  })
})

describe('parseUpdate', () => {
  it('keeps type and owner immutable and refuses every key outside the allow-list', () => {
    expect(field(() => parseUpdate({ type: 'PROGRAMME' }, 'CHALLENGE'))).toEqual({
      type: 'immutable',
    })
    expect(field(() => parseUpdate({ organization_id: ORG }, 'PROGRAMME'))).toEqual({
      organization_id: 'immutable',
    })
    for (const key of ['status', 'slug', 'metadata', 'id', 'registration', 'events']) {
      expect(field(() => parseUpdate({ [key]: 'x' }, 'PROGRAMME'))).toEqual({
        [key]: 'not_accepted',
      })
    }
    expect(field(() => parseUpdate({}, 'PROGRAMME'))).toEqual({ body: 'empty' })
  })

  it('accepts problem statements on a CHALLENGE only', () => {
    expect(field(() => parseUpdate({ problem_statements: [] }, 'PROGRAMME'))).toEqual({
      problem_statements: 'not_challenge',
    })
    expect(parseUpdate({ problem_statements: [] }, 'CHALLENGE')).toEqual({
      problem_statements: [],
    })
  })

  it('takes a null summary or date as a clear, and a blank name as missing', () => {
    expect(parseUpdate({ summary: null, starts_at: null }, 'PROGRAMME')).toEqual({
      summary: null,
      starts_at: null,
    })
    expect(field(() => parseUpdate({ name: '   ' }, 'PROGRAMME'))).toEqual({ name: 'required' })
  })
})

describe('parseStages (contract §11 journey)', () => {
  it('orders by the list sent, keeps valid ids and mints the missing ones', () => {
    const kept = '4c1b2a8e-5d3f-4a6b-9c7d-0e1f2a3b4c5d'
    const stages = parseStages([
      { name: ' Ươm tạo ', starts_on: '2026-11-01', ends_on: '2026-11-30' },
      { id: kept.toUpperCase(), name: 'Demo day', summary: '' },
    ])
    expect(stages).toHaveLength(2)
    expect(stages[0]).toMatchObject({
      position: 1,
      name: 'Ươm tạo',
      summary: null,
      starts_on: '2026-11-01',
      ends_on: '2026-11-30',
    })
    expect(stages[0]!.id).toMatch(UUID)
    expect(stages[1]).toEqual({
      id: kept,
      position: 2,
      name: 'Demo day',
      summary: null,
      starts_on: null,
      ends_on: null,
    })
  })

  it.each([
    [{}, { stages: 'invalid' }],
    [[{ summary: 'x' }], { 'stages.0.name': 'required' }],
    [[{ name: 'a', position: 3 }], { 'stages.0.position': 'not_accepted' }],
    [[{ name: 'a', starts_on: '2026-02-30' }], { 'stages.0.starts_on': 'invalid' }],
    [
      [{ name: 'a', starts_on: '2026-11-02', ends_on: '2026-11-01' }],
      { 'stages.0.ends_on': 'before_start' },
    ],
    [[{ name: 'a', id: 'stage-1' }], { 'stages.0.id': 'invalid' }],
    [
      [
        { name: 'a', id: '4c1b2a8e-5d3f-4a6b-9c7d-0e1f2a3b4c5d' },
        { name: 'b', id: '4c1b2a8e-5d3f-4a6b-9c7d-0e1f2a3b4c5d' },
      ],
      { 'stages.1.id': 'duplicate' },
    ],
    [
      Array.from({ length: PROGRAMME_LIMITS.stages + 1 }, () => ({ name: 'a' })),
      { stages: 'too_many' },
    ],
  ])('refuses %j', (input, fields) => {
    expect(field(() => parseStages(input))).toEqual(fields)
  })
})

describe('parseProblems (contract §3 option A)', () => {
  it('needs a title; the summary is optional', () => {
    expect(parseProblems([{ title: ' Bài toán ' }])).toEqual([
      { id: expect.stringMatching(UUID), title: 'Bài toán', summary: null },
    ])
    expect(field(() => parseProblems([{ summary: 'x' }]))).toEqual({
      'problem_statements.0.title': 'required',
    })
    expect(field(() => parseProblems([{ title: 'x', score: 3 }]))).toEqual({
      'problem_statements.0.score': 'not_accepted',
    })
  })

  it('has no minimum: an empty list is valid (contract Q7)', () => {
    expect(parseProblems([])).toEqual([])
  })
})

describe('parseRegistration (canonical form, migration 013)', () => {
  const question = { id: 'q-problem', prompt: 'Vấn đề?', required: true, step: 1 }

  it('stores the canonical applicant types in canonical order', () => {
    expect(
      parseRegistration({ applicant_types: ['STARTUP', 'TEAM'], questions: [question] }),
    ).toEqual({ applicant_types: ['TEAM', 'STARTUP'], questions: [question] })
  })

  it('mints a question id when none is sent', () => {
    const { questions } = parseRegistration({
      applicant_types: ['TEAM'],
      questions: [{ prompt: 'Cần gì?', required: false, step: 4 }],
    })
    expect(questions[0]).toEqual({
      id: expect.stringMatching(/^q-[0-9a-f]{8}$/),
      prompt: 'Cần gì?',
      required: false,
      step: 4,
    })
  })

  it.each([
    [{ questions: [] }, { applicant_types: 'required' }],
    [{ applicant_types: ['TEAM'] }, { questions: 'required' }],
    [{ applicant_types: [], questions: [] }, { applicant_types: 'required' }],
    // INDIVIDUAL is FUTURE (DEC-WF05-G4); the canonical enum is TEAM / STARTUP.
    [{ applicant_types: ['INDIVIDUAL'], questions: [] }, { applicant_types: 'invalid' }],
    [{ applicant_types: ['TEAM', 'TEAM'], questions: [] }, { applicant_types: 'duplicate' }],
    // No default is approved for `required` or `step` (contract Q3).
    [
      { applicant_types: ['TEAM'], questions: [{ prompt: 'x', step: 1 }] },
      { 'questions.0.required': 'required' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [{ prompt: 'x', required: true }] },
      { 'questions.0.step': 'required' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [{ prompt: 'x', required: 'yes', step: 1 }] },
      { 'questions.0.required': 'invalid' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [{ prompt: 'x', required: true, step: 5 }] },
      { 'questions.0.step': 'invalid' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [{ prompt: ' ', required: true, step: 1 }] },
      { 'questions.0.prompt': 'required' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [{ ...question, id: 'Q 1' }] },
      { 'questions.0.id': 'invalid' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [question, question] },
      { 'questions.1.id': 'duplicate' },
    ],
    [
      { applicant_types: ['TEAM'], questions: [{ ...question, type: 'upload' }] },
      { 'questions.0.type': 'not_accepted' },
    ],
    [{ applicant_types: ['TEAM'], questions: [], open: true }, { open: 'not_accepted' }],
  ])('refuses %j', (body, fields) => {
    expect(field(() => parseRegistration(body))).toEqual(fields)
  })
})

describe('parseEmptyBody (publish, close)', () => {
  it('accepts no body or an empty object and refuses any key', () => {
    expect(() => parseEmptyBody(undefined)).not.toThrow()
    expect(() => parseEmptyBody(null)).not.toThrow()
    expect(() => parseEmptyBody({})).not.toThrow()
    expect(field(() => parseEmptyBody({ status: 'CLOSED' }))).toEqual({ status: 'not_accepted' })
    expect(field(() => parseEmptyBody([]))).toEqual({ body: 'invalid' })
  })
})

describe('stored content readers', () => {
  it('read the documented shapes in order and skip malformed entries', () => {
    const metadata = {
      journey: {
        schema_version: 1,
        stages: [
          { id: 'b', position: 2, name: 'Hai' },
          null,
          { id: 'a', position: 1, name: 'Một', summary: 's', starts_on: '2026-11-01' },
          { position: 3 },
        ],
      },
      challenge: { schema_version: 1, problem_statements: [{ id: 'p', title: 'T' }, 'x'] },
    }
    expect(readStages(metadata).map((s) => s.id)).toEqual(['a', 'b'])
    expect(readProblems(metadata)).toEqual([{ id: 'p', title: 'T', summary: null }])
    expect(readStages({})).toEqual([])
    expect(readProblems(null)).toEqual([])
  })
})

describe('review hardening: input PostgreSQL cannot store is a 422, never a 500', () => {
  const valid = { type: 'PROGRAMME', organization_id: ORG, name: 'Chương trình' }

  it.each([
    [{ ...valid, name: 'a\u0000b' }, { name: 'invalid' }],
    [{ ...valid, summary: 'x\ud800' }, { summary: 'invalid' }],
    [{ ...valid, summary: '\udc00x' }, { summary: 'invalid' }],
    // A real calendar day and time, an offset that exists, years 1–9999.
    [{ ...valid, starts_at: '2026-02-30T10:00Z' }, { starts_at: 'invalid' }],
    [{ ...valid, starts_at: '2026-01-01T24:00Z' }, { starts_at: 'invalid' }],
    [{ ...valid, starts_at: '2026-01-01T10:60Z' }, { starts_at: 'invalid' }],
    [{ ...valid, starts_at: '2026-01-01T10:00+15:00' }, { starts_at: 'invalid' }],
    [{ ...valid, starts_at: '0000-01-01T00:00Z' }, { starts_at: 'invalid' }],
    [{ ...valid, ends_at: '0001-01-01T00:30+01:00' }, { ends_at: 'invalid' }],
  ])('refuses %j', (body, fields) => {
    expect(field(() => parseCreate(body))).toEqual(fields)
  })

  it('keeps well-formed Unicode, including surrogate pairs', () => {
    expect(parseCreate({ ...valid, name: 'Ươm tạo 🚀' }).name).toBe('Ươm tạo 🚀')
    expect(parseCreate({ ...valid, starts_at: '2028-02-29T23:59:59.5+07:00' }).starts_at).toBe(
      '2028-02-29T16:59:59.500Z',
    )
  })

  it('refuses unstorable text inside stages, problems and questions', () => {
    expect(field(() => parseStages([{ name: 'a\u0000' }]))).toEqual({ 'stages.0.name': 'invalid' })
    expect(field(() => parseProblems([{ title: '\ud83d' }]))).toEqual({
      'problem_statements.0.title': 'invalid',
    })
    expect(
      field(() =>
        parseRegistration({
          applicant_types: ['TEAM'],
          questions: [{ prompt: 'x\u0000', required: true, step: 1 }],
        }),
      ),
    ).toEqual({ 'questions.0.prompt': 'invalid' })
  })
})

describe('review hardening: a retried whole-list replacement writes the same ids', () => {
  it('derives the id of an item sent without one from its position and content', () => {
    const stages = [{ name: 'Một' }, { name: 'Hai', starts_on: '2026-11-01' }]
    expect(parseStages(stages)).toEqual(parseStages(stages))
    expect(parseStages([{ name: 'Một' }])[0]!.id).not.toBe(
      parseStages([{ name: 'Khác' }, { name: 'Một' }])[1]!.id,
    )
    const problems = [{ title: 'Bài toán' }]
    expect(parseProblems(problems)).toEqual(parseProblems(problems))
    const form = {
      applicant_types: ['TEAM'],
      questions: [
        { prompt: 'A?', required: true, step: 1 },
        { prompt: 'A?', required: true, step: 1 },
      ],
    }
    const once = parseRegistration(form)
    expect(parseRegistration(form)).toEqual(once)
    // Same content at two positions: two different ids, no duplicate.
    expect(new Set(once.questions.map((q) => q.id)).size).toBe(2)
  })
})
