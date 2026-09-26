import { describe, expect, it } from 'vitest'

import { DEMO_CHALLENGE_ID, DEMO_PROGRAMME_ID, demoFixture } from './fixtures'
import { publishReadiness } from './readiness'
import { registrationConfigured, updateRegistration, validateRegistration } from './registration'
import type { ProgrammeDemoDetail } from './types'

const now = new Date('2026-09-27T05:00:00.000Z')
const copy = (id: string) => structuredClone(demoFixture(id)!) as ProgrammeDemoDetail

describe('WF04-S05 registration configuration', () => {
  it('saves applicant types in canonical order, once, with trimmed questions; counts untouched', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const result = updateRegistration(
      d,
      {
        applicant_types: ['STARTUP', 'INDIVIDUAL', 'STARTUP'],
        questions: ['  Vì sao?  ', 'Cần gì?'],
      },
      now,
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.detail.registration).toEqual({
      applicant_types: ['INDIVIDUAL', 'STARTUP'],
      questions: ['Vì sao?', 'Cần gì?'],
    })
    expect(result.detail.application_counts).toEqual(d.application_counts)
    expect(result.detail.programme.updated_at).toBe(now.toISOString())
    expect(d.registration.applicant_types).toEqual(['TEAM', 'STARTUP'])
  })

  it('accepts only INDIVIDUAL / TEAM / STARTUP and refuses blank questions, changing nothing', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    const before = JSON.stringify(d)
    expect(validateRegistration({ applicant_types: ['INVESTOR'], questions: [] })).toEqual({
      applicant_types: 'invalid',
    })
    expect(validateRegistration({ applicant_types: ['team'], questions: [] })).toEqual({
      applicant_types: 'invalid',
    })
    expect(
      updateRegistration(d, { applicant_types: ['TEAM'], questions: ['Ok', '  ', ''] }, now),
    ).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { questions: [1, 2] },
    })
    expect(JSON.stringify(d)).toBe(before)
  })

  it('an empty configuration is allowed and reads as "not configured"', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    expect(registrationConfigured(d)).toBe(true)
    const result = updateRegistration(d, { applicant_types: [], questions: [] }, now)
    if (!result.ok) throw new Error('expected ok')
    expect(registrationConfigured(result.detail)).toBe(false)
  })

  it('H5 is unchanged: registration is never a publish prerequisite', () => {
    const c = copy(DEMO_CHALLENGE_ID)
    const result = updateRegistration(c, { applicant_types: [], questions: [] }, now)
    if (!result.ok) throw new Error('expected ok')
    expect(publishReadiness(result.detail, 'ALL').every((x) => x.ok)).toBe(true)
  })
})
