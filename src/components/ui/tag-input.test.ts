import { describe, expect, it } from 'vitest'

import { suggestFor, TAG_RULES } from './tag-input'

/** S1-UAT-05 — FB-09 suggestion ranking of the one tag control. */

const CATALOGUE = ['Fintech', 'Giáo dục', 'EdTech', 'Công nghệ tài chính', 'AI', 'Tài chính']

describe('suggestFor', () => {
  it('"fin" suggests Fintech; "fin tech" puts the canonical Fintech first', () => {
    expect(suggestFor('fin', CATALOGUE, [])).toEqual(['Fintech'])
    expect(suggestFor('fin tech', CATALOGUE, [])[0]).toBe('Fintech')
  })

  it('ignores accents and case, exact before prefix before substring', () => {
    expect(suggestFor('tai chinh', CATALOGUE, [])).toEqual(['Tài chính', 'Công nghệ tài chính'])
    expect(suggestFor('GIAO', CATALOGUE, [])).toEqual(['Giáo dục'])
  })

  it('never suggests a value already added, nothing for empty text', () => {
    expect(suggestFor('tech', CATALOGUE, ['fintech '])).toEqual(['EdTech'])
    expect(suggestFor('   ', CATALOGUE, [])).toEqual([])
  })

  it('at most eight suggestions; unknown text has none (Enter adds it as typed)', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Mục ${i}`)
    expect(suggestFor('mục', many, [])).toHaveLength(TAG_RULES.suggestions)
    expect(suggestFor('Kinh tế tuần hoàn', CATALOGUE, [])).toEqual([])
  })

  it('FB-09 limits', () => {
    expect(TAG_RULES).toMatchObject({ min: 2, max: 40, count: 5, suggestions: 8 })
  })
})
