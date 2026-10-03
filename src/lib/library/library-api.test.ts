import { describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'

import { libraryParams, MAX_FILTER_VALUES } from './library-api'

/** WF06-PROD-03 — query parsing at the Library API edge (API §25.2). */

const ACCEPTED = { single: ['q', 'sort', 'cursor', 'limit'], multi: ['domain_id', 'area'] }
const params = (query: string) =>
  libraryParams(`http://x/api/v1/library/startups?${query}`, ACCEPTED)
const ID = '20000000-0000-0000-0000-000000000011'

function failure(run: () => void) {
  try {
    run()
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  return null
}

describe('libraryParams', () => {
  it('normalises the keyword: NFC, collapsed whitespace, trimmed; blank is none', () => {
    expect(params(`q=${encodeURIComponent('  Ổ\t  Khóa \n')}`).keyword()).toBe('Ổ Khóa')
    expect(params(`q=${encodeURIComponent('Ổ Khóa'.normalize('NFD'))}`).keyword()).toBe(
      'Ổ Khóa'.normalize('NFC'),
    )
    expect(params('q=%20%20').keyword()).toBeUndefined()
    expect(params('').keyword()).toBeUndefined()
  })

  it('bounds the keyword: 120 characters after normalisation, no control character', () => {
    const ok = params(`q=${'a'.repeat(120)}`)
    expect(ok.keyword()).toHaveLength(120)
    expect(failure(() => ok.check())).toBeNull()
    const long = params(`q=${'a'.repeat(121)}`)
    long.keyword()
    expect(failure(() => long.check())?.fields).toEqual({ q: 'too_long' })
    const control = params('q=a%07b')
    control.keyword()
    expect(failure(() => control.check())?.fields).toEqual({ q: 'invalid' })
  })

  it('reads ids as lower-case UUIDs, deduplicated, at most 10 values', () => {
    expect(params(`domain_id=${ID.toUpperCase()}&domain_id=${ID}`).ids('domain_id')).toEqual([ID])
    const many = params(
      Array.from({ length: MAX_FILTER_VALUES + 1 }, () => `domain_id=${ID}`).join('&'),
    )
    expect(many.ids('domain_id')).toEqual([])
    expect(failure(() => many.check())?.fields).toEqual({ domain_id: 'too_many' })
    const bad = params('domain_id=1%27%20OR%201%3D1')
    bad.ids('domain_id')
    expect(failure(() => bad.check())?.fields).toEqual({ domain_id: 'invalid' })
  })

  it('reads plain text values trimmed and deduplicated; an empty one is invalid', () => {
    expect(
      params('area=H%C3%A0%20N%E1%BB%99i&area=%20H%C3%A0%20N%E1%BB%99i%20').texts('area'),
    ).toEqual(['Hà Nội'])
    const empty = params('area=')
    empty.texts('area')
    expect(failure(() => empty.check())?.fields).toEqual({ area: 'invalid' })
  })

  it('accepts a listed sort only, and a limit of 1 – 50 (9 by default)', () => {
    expect(params('').choice('sort', ['STAGE', 'NAME'] as const, 'STAGE')).toBe('STAGE')
    expect(params('sort=NAME').choice('sort', ['STAGE', 'NAME'] as const, 'STAGE')).toBe('NAME')
    expect(params('').page()).toEqual({ cursor: undefined, limit: 9 })
    expect(params('limit=50&cursor=b0o5').page()).toEqual({ cursor: 'b0o5', limit: 50 })
    const p = params('sort=name&limit=51&cursor=a.b')
    p.choice('sort', ['STAGE', 'NAME'] as const, 'STAGE')
    p.page()
    expect(failure(() => p.check())).toEqual({
      status: 422,
      code: 'PROFILE_VALIDATION_FAILED',
      fields: { sort: 'invalid', limit: 'too_many', cursor: 'invalid' },
    })
  })

  it('refuses unknown and repeated single parameters, echoing plain names only', () => {
    const p = params('owner_profile_id=x&q=a&q=b&%3Cb%3E=1')
    expect(failure(() => p.check())?.fields).toEqual({
      owner_profile_id: 'not_accepted',
      q: 'duplicate',
      query: 'not_accepted',
    })
  })
})
