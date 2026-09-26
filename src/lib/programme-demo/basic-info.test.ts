import { describe, expect, it } from 'vitest'

import { buildDraft, dayToInstant, validateBasicInfo, type BasicInfoInput } from './basic-info'
import { formatDemoDateRange } from './format'
import { publishReadiness } from './readiness'
import { isDemoFixtureId } from './fixtures'

const CHAPTER_01 = {
  id: '10000000-0000-0000-0000-000000000101',
  slug: 'chapter-01',
  name: 'Chapter 01',
  type: 'CHAPTER',
}
const CHAPTER_02 = {
  id: '10000000-0000-0000-0000-000000000102',
  slug: 'chapter-02',
  name: 'Chapter 02',
  type: 'CHAPTER',
}

const valid: BasicInfoInput = {
  type: 'CHALLENGE',
  name: '  Thử thách mới  ',
  summary: '  ',
  starts_on: '2026-10-01',
  ends_on: '2026-12-31',
  organization_id: CHAPTER_01.id,
}

describe('WF04-S02 basic information rules', () => {
  it('accepts a valid input', () => {
    expect(validateBasicInfo(valid, [CHAPTER_01])).toEqual({})
    expect(
      validateBasicInfo({ ...valid, type: 'PROGRAMME', starts_on: '', ends_on: '' }, [CHAPTER_01]),
    ).toEqual({})
  })

  it('requires a type, a non-blank name and an owner', () => {
    expect(
      validateBasicInfo({ ...valid, type: '', name: ' \t ', organization_id: '' }, [CHAPTER_01]),
    ).toEqual({ type: 'required', name: 'required', organization_id: 'required' })
  })

  it('rejects a type outside PROGRAMME / CHALLENGE and any type change of an existing programme', () => {
    expect(validateBasicInfo({ ...valid, type: 'SUMMIT' }, [CHAPTER_01]).type).toBe('invalid')
    expect(validateBasicInfo({ ...valid, type: 'challenge' }, [CHAPTER_01]).type).toBe('invalid')
    expect(validateBasicInfo({ ...valid, type: 'PROGRAMME' }, [CHAPTER_01], 'CHALLENGE').type).toBe(
      'immutable',
    )
    expect(validateBasicInfo(valid, [CHAPTER_01], 'CHALLENGE')).toEqual({})
  })

  it('rejects an owner the server did not list (spoofed organization)', () => {
    expect(
      validateBasicInfo({ ...valid, organization_id: CHAPTER_02.id }, [CHAPTER_01]).organization_id,
    ).toBe('invalid')
    expect(validateBasicInfo(valid, []).organization_id).toBe('invalid')
  })

  it('dates are optional; the end is not before the start; impossible days are invalid', () => {
    expect(validateBasicInfo({ ...valid, ends_on: '' }, [CHAPTER_01])).toEqual({})
    expect(validateBasicInfo({ ...valid, starts_on: '' }, [CHAPTER_01])).toEqual({})
    expect(validateBasicInfo({ ...valid, ends_on: '2026-10-01' }, [CHAPTER_01])).toEqual({})
    expect(validateBasicInfo({ ...valid, ends_on: '2026-09-30' }, [CHAPTER_01]).dates).toBe('order')
    expect(validateBasicInfo({ ...valid, starts_on: '2026-02-30' }, [CHAPTER_01]).dates).toBe(
      'invalid',
    )
    expect(validateBasicInfo({ ...valid, starts_on: '01/10/2026' }, [CHAPTER_01]).dates).toBe(
      'invalid',
    )
  })

  it('maps calendar days to Vietnam start / end of day', () => {
    expect(dayToInstant('2026-10-01', 'start')).toBe('2026-09-30T17:00:00.000Z')
    expect(dayToInstant('2026-12-31', 'end')).toBe('2026-12-31T16:59:00.000Z')
    expect(dayToInstant('', 'start')).toBeNull()
    expect(
      formatDemoDateRange(dayToInstant('2026-10-01', 'start'), dayToInstant('2026-12-31', 'end')),
    ).toBe('01/10/2026 – 31/12/2026')
  })
})

describe('WF04-S02 new draft', () => {
  const id = 'b2c3d4e5-0000-4000-8000-000000000001'
  const now = new Date('2026-09-27T03:00:00.000Z')

  it('is a DRAFT with trimmed values, the chosen owner, and empty setup', () => {
    const draft = buildDraft(valid, CHAPTER_01, { id, now })
    expect(draft.programme).toEqual({
      id,
      type: 'CHALLENGE',
      organization_id: CHAPTER_01.id,
      slug: 'demo-b2c3d4e5',
      name: 'Thử thách mới',
      summary: null,
      status: 'DRAFT',
      starts_at: '2026-09-30T17:00:00.000Z',
      ends_at: '2026-12-31T16:59:00.000Z',
      created_at: '2026-09-27T03:00:00.000Z',
      updated_at: '2026-09-27T03:00:00.000Z',
    })
    expect(draft.organization).toEqual(CHAPTER_01)
    expect(draft.demo).toBe(true)
    expect([draft.stages, draft.events, draft.team, draft.problem_statements]).toEqual([
      [],
      [],
      [],
      [],
    ])
    expect(draft.application_counts).toEqual({})
    expect(isDemoFixtureId(draft.programme.id)).toBe(false)
  })

  it('a PROGRAMME has no problem-statement section (H4)', () => {
    const draft = buildDraft({ ...valid, type: 'PROGRAMME' }, CHAPTER_01, { id, now })
    expect(draft).not.toHaveProperty('problem_statements')
  })

  it('a new CHALLENGE is not yet publishable (no problem statement); a PROGRAMME is (H5)', () => {
    const challenge = buildDraft(valid, CHAPTER_01, { id, now })
    expect(
      publishReadiness(challenge, [CHAPTER_01.id])
        .filter((c) => !c.ok)
        .map((c) => c.item),
    ).toEqual(['problems'])
    const programme = buildDraft({ ...valid, type: 'PROGRAMME' }, CHAPTER_01, { id, now })
    expect(publishReadiness(programme, [CHAPTER_01.id]).every((c) => c.ok)).toBe(true)
  })
})
