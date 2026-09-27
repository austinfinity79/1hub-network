import { describe, expect, it } from 'vitest'

import {
  DEMO_CHALLENGE_ID,
  DEMO_OWNER_ORGANIZATION_ID,
  DEMO_PROGRAMME_ID,
  demoFixture,
} from './fixtures'
import { canPublish, publishProgramme, publishReadiness } from './readiness'
import type { ProgrammeDemoDetail } from './types'

const copy = (id: string) => structuredClone(demoFixture(id)!) as ProgrammeDemoDetail
const failing = (d: ProgrammeDemoDetail, allowance: 'ALL' | string[] = 'ALL') =>
  publishReadiness(d, allowance)
    .filter((c) => !c.ok)
    .map((c) => c.item)

describe('WF04 demo publish checklist (DEC-WF04-H5)', () => {
  it('the DRAFT fixture Challenge is ready; the PUBLISHED Programme cannot be published again', () => {
    expect(failing(copy(DEMO_CHALLENGE_ID))).toEqual([])
    expect(canPublish(copy(DEMO_CHALLENGE_ID), [DEMO_OWNER_ORGANIZATION_ID])).toBe(true)
    expect(canPublish(copy(DEMO_PROGRAMME_ID), 'ALL')).toBe(false)
  })

  it('blocks an empty name, an owner outside the allowance and reversed dates', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    d.programme.name = '   '
    d.programme.ends_at = '2026-10-01T00:00:00.000Z'
    expect(failing(d, ['10000000-0000-0000-0000-000000000102'])).toEqual(['name', 'owner', 'dates'])
    expect(canPublish(d, 'ALL')).toBe(false)
  })

  it('dates are optional; an unparsable date fails', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    d.programme.starts_at = null
    d.programme.ends_at = null
    expect(failing(d)).toEqual([])
    d.programme.starts_at = 'not a date'
    expect(failing(d)).toEqual(['dates'])
  })

  it('a CHALLENGE needs one problem statement; a PROGRAMME is never asked for one', () => {
    const c = copy(DEMO_CHALLENGE_ID)
    c.problem_statements = []
    expect(failing(c)).toEqual(['problems'])
    const p = copy(DEMO_PROGRAMME_ID)
    expect(publishReadiness(p, 'ALL').map((x) => x.item)).toEqual([
      'name',
      'type',
      'owner',
      'dates',
    ])
  })

  it('never requires stages, events, registration or team', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    d.stages = []
    d.events = []
    d.team = []
    d.registration = { applicant_types: [], questions: [] }
    expect(failing(d)).toEqual([])
  })

  it('rejects a type outside the canonical set', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    ;(d.programme as { type: string }).type = 'SUMMIT'
    expect(failing(d)).toEqual(['type'])
  })
})

describe('WF04-S07 publish (DRAFT → PUBLISHED only)', () => {
  const now = new Date('2026-09-27T05:00:00.000Z')

  it('publishes a ready DRAFT, keeping every setup value', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    const result = publishProgramme(d, [DEMO_OWNER_ORGANIZATION_ID], now)
    if (!result.ok) throw new Error('expected ok')
    expect(result.detail.programme.status).toBe('PUBLISHED')
    expect(result.detail.programme.updated_at).toBe(now.toISOString())
    expect({ ...result.detail, programme: null }).toEqual({ ...d, programme: null })
    expect({
      ...result.detail.programme,
      status: 'DRAFT',
      updated_at: d.programme.updated_at,
    }).toEqual(d.programme)
    expect(d.programme.status).toBe('DRAFT')
  })

  it('refuses an incomplete DRAFT with the missing items, changing nothing', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    d.problem_statements = []
    d.programme.ends_at = '2026-01-01T00:00:00.000Z'
    const before = JSON.stringify(d)
    expect(publishProgramme(d, 'ALL', now)).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { missing: ['dates', 'problems'] },
    })
    expect(publishProgramme(d, ['10000000-0000-0000-0000-000000000102'], now)).toMatchObject({
      errors: { missing: ['owner', 'dates', 'problems'] },
    })
    expect(JSON.stringify(d)).toBe(before)
  })

  it('is idempotent: an already PUBLISHED programme is never changed (no unpublish either)', () => {
    const p = copy(DEMO_PROGRAMME_ID)
    expect(publishProgramme(p, 'ALL', now)).toEqual({ ok: false, reason: 'not_draft' })
    const once = publishProgramme(copy(DEMO_CHALLENGE_ID), 'ALL', now)
    if (!once.ok) throw new Error('expected ok')
    expect(publishProgramme(once.detail, 'ALL', now)).toEqual({ ok: false, reason: 'not_draft' })
  })
})
