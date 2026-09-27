import { describe, expect, it } from 'vitest'

import {
  applicationKey,
  applicationOf,
  emptyProjectDemoState,
  parseProjectDemoState,
  projectDemoStoreKey,
  readProjectDemoState,
  saveAnswers,
  startApplication,
  submitApplication,
  type ProjectDemoState,
} from './application-store'
import { applicantTypeFor, applicationEligibility } from './eligibility'
import type { ProgrammeContext, VentureContext } from './types'

const V = '50000000-0000-4000-8000-000000000001'
const P = 'd4000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-10-01T02:00:00.000Z')
const LATER = new Date('2026-10-01T03:00:00.000Z')

const startup: VentureContext = { id: V, type: 'STARTUP', status: 'ACTIVE', relation: 'OWNER' }
const programme: ProgrammeContext = {
  id: P,
  status: 'PUBLISHED',
  applicant_types: ['TEAM', 'STARTUP'],
  questions: ['Câu 1?', 'Câu 2?'],
}

function started(state = emptyProjectDemoState()): ProjectDemoState {
  const result = startApplication(state, startup, programme, NOW)
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

describe('WF05 applicant mapping and eligibility (DEC-WF05-G3..G5)', () => {
  it('PROJECT derives TEAM and STARTUP derives STARTUP (never INDIVIDUAL)', () => {
    expect(applicantTypeFor('PROJECT')).toBe('TEAM')
    expect(applicantTypeFor('STARTUP')).toBe('STARTUP')
  })

  it('the owner of a non-archived venture of an accepted type is eligible', () => {
    expect(applicationEligibility(startup, programme)).toEqual({ eligible: true })
    expect(
      applicationEligibility({ ...startup, type: 'PROJECT' }, programme), // TEAM ∈ types
    ).toEqual({ eligible: true })
  })

  it('refuses a non-published programme, a member, an archived venture and a type not accepted', () => {
    expect(applicationEligibility(startup, { ...programme, status: 'DRAFT' })).toEqual({
      eligible: false,
      reason: 'NOT_PUBLISHED',
    })
    expect(applicationEligibility({ ...startup, relation: 'MEMBER' }, programme)).toEqual({
      eligible: false,
      reason: 'NOT_OWNER',
    })
    expect(applicationEligibility({ ...startup, status: 'ARCHIVED' }, programme)).toEqual({
      eligible: false,
      reason: 'ARCHIVED',
    })
    expect(
      applicationEligibility(
        { ...startup, type: 'PROJECT' },
        {
          ...programme,
          applicant_types: ['STARTUP', 'INDIVIDUAL'],
        },
      ),
    ).toEqual({ eligible: false, reason: 'TYPE_NOT_ACCEPTED' })
  })
})

describe('WF05 demo application store (DEC-WF05-G5, T00-D1)', () => {
  it('1. start creates one DRAFT with the derived type and empty answers, referencing the venture id', () => {
    const state = started()
    const key = applicationKey(V, P)
    expect(Object.keys(state.applications)).toEqual([key])
    expect(state.applications[key]).toEqual({
      primary_applicant_type: 'STARTUP',
      primary_applicant_id: V,
      programme_id: P,
      status: 'DRAFT',
      programme_specific_answers: ['', ''],
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
      submitted_at: null,
    })
  })

  it('2/3. the (venture, programme) key is unique: a second start is refused and changes nothing', () => {
    const state = started()
    expect(applicationKey(V, P)).toBe(`${V}:${P}`)
    expect(startApplication(state, startup, programme, LATER)).toEqual({
      ok: false,
      reason: 'EXISTS',
    })
    const other = { ...programme, id: 'd4000000-0000-0000-0000-000000000009' }
    const second = startApplication(state, startup, other, LATER)
    expect(second.ok && Object.keys(second.state.applications)).toHaveLength(2)
  })

  it('4/5. a PROJECT applies as TEAM, a STARTUP as STARTUP', () => {
    const team = startApplication(
      emptyProjectDemoState(),
      { ...startup, type: 'PROJECT' },
      programme,
      NOW,
    )
    expect(team.ok && team.application.primary_applicant_type).toBe('TEAM')
    expect(applicationOf(started(), V, P)!.primary_applicant_type).toBe('STARTUP')
  })

  it('6. an archived venture, a team member or a closed type cannot start, save or submit', () => {
    const empty = emptyProjectDemoState()
    for (const [venture, reason] of [
      [{ ...startup, status: 'ARCHIVED' }, 'ARCHIVED'],
      [{ ...startup, relation: 'MEMBER' as const }, 'NOT_OWNER'],
    ] as const) {
      expect(startApplication(empty, venture, programme, NOW)).toEqual({ ok: false, reason })
      expect(saveAnswers(started(), venture, programme, ['a', 'b'], NOW)).toEqual({
        ok: false,
        reason,
      })
      expect(submitApplication(started(), venture, programme, NOW)).toEqual({ ok: false, reason })
    }
  })

  it('answers: one per question; a DRAFT may be incomplete; submit needs every answer; SUBMITTED is final', () => {
    let state = started()
    expect(saveAnswers(state, startup, programme, ['only one'], NOW)).toEqual({
      ok: false,
      reason: 'INVALID_ANSWERS',
    })
    expect(saveAnswers(state, startup, programme, [1, 2], NOW)).toEqual({
      ok: false,
      reason: 'INVALID_ANSWERS',
    })
    const partial = saveAnswers(state, startup, programme, ['Trả lời 1', '   '], LATER)
    expect(partial.ok).toBe(true)
    state = partial.ok ? partial.state : state
    expect(submitApplication(state, startup, programme, LATER)).toEqual({
      ok: false,
      reason: 'INCOMPLETE',
    })
    const full = saveAnswers(state, startup, programme, ['Trả lời 1', 'Trả lời 2'], LATER)
    state = full.ok ? full.state : state
    const submitted = submitApplication(state, startup, programme, LATER)
    expect(submitted.ok && submitted.application).toMatchObject({
      status: 'SUBMITTED',
      submitted_at: LATER.toISOString(),
      programme_specific_answers: ['Trả lời 1', 'Trả lời 2'],
    })
    state = submitted.ok ? submitted.state : state
    // Final: no second submit, no edit, no restart.
    expect(submitApplication(state, startup, programme, LATER)).toEqual({
      ok: false,
      reason: 'SUBMITTED',
    })
    expect(saveAnswers(state, startup, programme, ['x', 'y'], LATER)).toEqual({
      ok: false,
      reason: 'SUBMITTED',
    })
    expect(startApplication(state, startup, programme, LATER)).toEqual({
      ok: false,
      reason: 'EXISTS',
    })
    expect(saveAnswers(emptyProjectDemoState(), startup, programme, ['a', 'b'], NOW)).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    })
  })

  it('7/8. storage: the key is per actor and opaque; a round trip keeps the state; reset (remove) empties it', () => {
    const key = projectDemoStoreKey('0123456789abcdef')
    expect(key).toBe('hub.wf05-demo.v1.0123456789abcdef')
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    const state = started()
    storage.setItem(key, JSON.stringify(state))
    expect(readProjectDemoState(storage, key)).toEqual(state)
    storage.removeItem(key)
    expect(readProjectDemoState(storage, key)).toEqual(emptyProjectDemoState())
    expect(readProjectDemoState(null, key)).toEqual(emptyProjectDemoState())
  })

  it('9. no venture snapshot survives: unknown fields are dropped; mismatched or malformed entries are ignored', () => {
    const state = started()
    const key = applicationKey(V, P)
    const tampered = {
      version: 1,
      applications: {
        [key]: {
          ...state.applications[key],
          name: 'Tên dự án',
          summary: 'Tóm tắt',
          owner_profile_id: '40000000-0000-0000-0000-000000000001',
          venture: { name: 'copy' },
        },
        [`${V}:d4000000-0000-0000-0000-000000000002`]: state.applications[key], // key mismatch
        'x:y': { primary_applicant_id: 'x', programme_id: 'y' },
        [applicationKey(V, 'd4000000-0000-0000-0000-000000000003')]: {
          ...state.applications[key],
          programme_id: 'd4000000-0000-0000-0000-000000000003',
          primary_applicant_type: 'INDIVIDUAL',
        },
      },
    }
    const parsed = parseProjectDemoState(JSON.stringify(tampered))
    expect(Object.keys(parsed.applications)).toEqual([key])
    expect(parsed.applications[key]).toEqual(state.applications[key])
    expect(JSON.stringify(parsed)).not.toMatch(/Tên dự án|Tóm tắt|owner_profile_id|venture/)
    for (const raw of [null, '', '{', '[]', '{"version":2,"applications":{}}', '{"version":1}'])
      expect(parseProjectDemoState(raw)).toEqual(emptyProjectDemoState())
  })

  it('10. nothing personal in the state: ids, derived type, status, answers and times only', () => {
    const json = JSON.stringify(started())
    expect(json).not.toMatch(/@|token|cookie|session|display_name|email/i)
    const [entry] = Object.values(started().applications)
    expect(Object.keys(entry!).sort()).toEqual([
      'created_at',
      'primary_applicant_id',
      'primary_applicant_type',
      'programme_id',
      'programme_specific_answers',
      'status',
      'submitted_at',
      'updated_at',
    ])
  })
})
