import { describe, expect, it } from 'vitest'

import {
  NO_LOCATION,
  matchesLocation,
  matchesQuery,
  readLocation,
  searchKey,
  writeLocation,
  type Places,
} from './discovery-query'
import { PROGRAMME_SORTS, pickSort } from './discovery-sorts'
import { paramsOf, readProductView, readProgrammeView } from './discovery-views'
import { phaseOf } from './programme-phase'

/** THAO-05 — the shared discovery contract (DEC-THAO-DIR-D1, D6). */
const PLACES: Places = {
  countries: [
    { slug: 'vn', label: 'Việt Nam' },
    { slug: 'sg', label: 'Singapore' },
  ],
  regions: [
    { slug: 'hanoi', label: 'TP. Hà Nội', country: 'vn' },
    { slug: 'da-nang', label: 'TP. Đà Nẵng', country: 'vn' },
  ],
}

describe('location contract (D6)', () => {
  it('reads country → region; region alone implies its country', () => {
    expect(readLocation({ 'quoc-gia': 'vn', tinh: 'da-nang' }, PLACES)).toEqual({
      country: 'vn',
      region: 'da-nang',
      invalid: false,
    })
    expect(readLocation({ tinh: 'hanoi' }, PLACES)).toEqual({
      country: 'vn',
      region: 'hanoi',
      invalid: false,
    })
    expect(readLocation({}, PLACES)).toEqual(NO_LOCATION)
  })

  it('marks a region outside the country and unknown slugs invalid (controlled empty state)', () => {
    for (const params of [
      { 'quoc-gia': 'sg', tinh: 'hanoi' },
      { tinh: 'khong-co' },
      { 'quoc-gia': 'zz' },
    ]) {
      const loc = readLocation(params, PLACES)
      expect(loc.invalid, JSON.stringify(params)).toBe(true)
      expect(matchesLocation(loc, { country: 'vn', region: 'hanoi' })).toBe(false)
    }
  })

  it('reads the legacy label once and writes slugs, country first', () => {
    const loc = readLocation({ tinh: 'TP. Đà Nẵng' }, PLACES)
    const params = new URLSearchParams()
    writeLocation(params, loc)
    expect(params.toString()).toBe('quoc-gia=vn&tinh=da-nang')
  })

  it('filters by country, then region', () => {
    const vn = { country: 'vn', region: null, invalid: false }
    expect(matchesLocation(vn, { country: 'vn', region: 'hanoi' })).toBe(true)
    expect(matchesLocation(vn, { country: null, region: null })).toBe(false)
    expect(matchesLocation(NO_LOCATION, { country: null, region: null })).toBe(true)
  })
})

describe('search and views', () => {
  it('matches every word, accent- and case-insensitively', () => {
    const text = searchKey('Thử thách Đổi mới Hà Nội')
    expect(matchesQuery(text, 'thu thach ha noi')).toBe(true)
    expect(matchesQuery(text, 'Đổi mới')).toBe(true)
    expect(matchesQuery(text, 'logistics')).toBe(false)
  })

  it('drops values the data does not hold; unknown sorts fall back', () => {
    const view = readProductView(
      paramsOf('?linh-vuc=AI&linh-vuc=Kh%C3%B4ng+c%C3%B3&giai-doan=MVP&giai-doan=X&sap-xep=zzz'),
      { domains: ['AI'], stages: ['MVP'], places: PLACES },
    )
    expect(view).toMatchObject({ domains: ['AI'], stages: ['MVP'], sort: 'hoat-dong' })
    expect(readProgrammeView({ 'trang-thai': ['dang-mo', 'x'], loai: 'challenge' }, [])).toEqual({
      q: '',
      phases: ['dang-mo'],
      kinds: ['challenge'],
      hosts: [],
      sort: 'sap-dien-ra',
    })
    expect(pickSort('ten-a-z', PROGRAMME_SORTS, 'sap-dien-ra')).toBe('ten-a-z')
  })
})

describe('programme phase (D1): derived for display, never written', () => {
  const now = new Date('2026-10-07T00:00:00Z')
  const day = (d: number) => new Date(now.getTime() + d * 86_400_000)
  it('CLOSED or past end is ended; future start is upcoming; otherwise open', () => {
    expect(phaseOf('CLOSED', day(-5), day(5), now)).toBe('da-ket-thuc')
    expect(phaseOf('PUBLISHED', day(-40), day(-1), now)).toBe('da-ket-thuc')
    expect(phaseOf('PUBLISHED', day(3), day(30), now)).toBe('sap-toi')
    expect(phaseOf('PUBLISHED', day(-3), day(30), now)).toBe('dang-mo')
    expect(phaseOf('PUBLISHED', null, null, now)).toBe('dang-mo')
  })
})
