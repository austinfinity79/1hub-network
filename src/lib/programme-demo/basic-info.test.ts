import { describe, expect, it } from 'vitest'

import {
  basicInfoOf,
  buildDraft,
  dayToInstant,
  updateBasicInfo,
  validateBasicInfo,
  type BasicInfoInput,
} from './basic-info'
import { formatDemoDateRange } from './format'
import { DEMO_CHALLENGE_ID, demoFixture, isDemoFixtureId } from './fixtures'
import type { ProgrammeDemoDetail } from './types'
import { publishChecks, type ProgrammeScreen } from '@/lib/programme/view'

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

  it('a new CHALLENGE and a new PROGRAMME pass the production checklist (no problem rule, Q7)', () => {
    // DEC-W4P-D12 supersedes the demo H5 rule "a CHALLENGE needs a problem statement".
    const challenge = buildDraft(valid, CHAPTER_01, { id, now })
    expect(publishChecks(screenOf(challenge)).every((c) => c.ok)).toBe(true)
    const programme = buildDraft({ ...valid, type: 'PROGRAMME' }, CHAPTER_01, { id, now })
    expect(publishChecks(screenOf(programme)).every((c) => c.ok)).toBe(true)
  })
})

describe('WF04-S08 basic information edit', () => {
  const now = new Date('2026-09-28T01:00:00.000Z')
  const fixture = () => structuredClone(demoFixture(DEMO_CHALLENGE_ID)!) as ProgrammeDemoDetail

  it('round-trips the stored values into the form', () => {
    expect(basicInfoOf(fixture())).toEqual({
      type: 'CHALLENGE',
      name: 'Thử thách đổi mới (demo)',
      summary:
        'Challenge mẫu cho Internal Alpha: các đội đề xuất giải pháp cho bài toán của đơn vị.',
      starts_on: '2026-11-01',
      ends_on: '2027-01-31',
      organization_id: '10000000-0000-0000-0000-000000000101',
    })
  })

  it('updates name, summary and dates only; status, type, owner and setup untouched', () => {
    const d = fixture()
    const result = updateBasicInfo(
      d,
      { ...basicInfoOf(d), name: '  Tên mới  ', summary: '', starts_on: '', ends_on: '2027-02-01' },
      now,
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.detail.programme).toMatchObject({
      name: 'Tên mới',
      summary: null,
      starts_at: null,
      ends_at: '2027-02-01T16:59:00.000Z',
      type: 'CHALLENGE',
      status: 'DRAFT',
      organization_id: d.programme.organization_id,
      updated_at: now.toISOString(),
    })
    expect({ ...result.detail, programme: null }).toEqual({ ...d, programme: null })
  })

  it('refuses a type change, another owner, a blank name or reversed dates, changing nothing', () => {
    const d = fixture()
    const before = JSON.stringify(d)
    const base = basicInfoOf(d)
    expect(updateBasicInfo(d, { ...base, type: 'PROGRAMME' }, now)).toMatchObject({
      errors: { type: 'immutable' },
    })
    expect(
      updateBasicInfo(d, { ...base, organization_id: '10000000-0000-0000-0000-000000000102' }, now),
    ).toMatchObject({ errors: { organization_id: 'invalid' } })
    expect(updateBasicInfo(d, { ...base, name: ' ' }, now)).toMatchObject({
      errors: { name: 'required' },
    })
    expect(updateBasicInfo(d, { ...base, ends_on: '2026-10-01' }, now)).toMatchObject({
      errors: { dates: 'order' },
    })
    expect(JSON.stringify(d)).toBe(before)
  })
})

const screenOf = <
  T extends Omit<ProgrammeScreen, 'actions' | 'owner_archived' | 'form' | 'organization'>,
>(
  detail: T,
): ProgrammeScreen => ({
  organization: {
    id: '10000000-0000-0000-0000-000000000101',
    slug: 'chapter-01',
    name: 'Chapter 01',
    type: 'CHAPTER',
  },
  ...detail,
  actions: { edit: true, registration: true, publish: true, close: false },
  owner_archived: false,
  form: null,
})
