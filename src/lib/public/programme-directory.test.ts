import { describe, expect, it } from 'vitest'

import { listPublicProgrammes } from './programme-directory'
import { PAST_PROGRAMMES, UPCOMING_PROGRAMMES } from './programme-event-source'

/** PROGRAMME-PRESENTATION-DATA-01 — `/programmes` shows the source-backed programmes only. */
describe('listPublicProgrammes', () => {
  const list = listPublicProgrammes()
  const current = list.slice(0, UPCOMING_PROGRAMMES.length)
  const past = list.slice(UPCOMING_PROGRAMMES.length)

  it('S2-PROGRAMME-CATALOG-REFRESH-01: the canonical upcoming set, source values, in order', () => {
    expect(current.map((p) => p.name)).toEqual([
      'APEC Innovation Challenge',
      'Cuộc thi Khởi nghiệp cùng Kawai',
      'Data for Life',
      'Fintech Challenge Vietnam',
      'AI Thực chiến',
      'Global Builder Camp',
      'VietChallenge',
    ])
    expect(current.map((p) => [p.summary, p.hosts, p.image, p.domain])).toEqual(
      UPCOMING_PROGRAMMES.map((c) => [c.description, [c.owner], c.image, c.domain]),
    )
    for (const p of current) expect(p.phase).toBe('sap-cong-bo')
    // A type only where the source tags one (APEC, Kawai: "Cuộc thi").
    expect(current.map((p) => p.kind)).toEqual([
      'challenge',
      'challenge',
      null,
      null,
      null,
      null,
      null,
    ])
    expect(list.map((p) => p.name)).not.toContain('VPBank Innovation Challenge')
    expect(list.map((p) => p.name)).not.toContain('Agritech Innovation Challenge')
  })

  it('invents nothing: no dates, no apply entry, no fixture wording, no duplicate', () => {
    for (const p of list) {
      expect([p.timeline, p.startsAt, p.applyHref]).toEqual([null, null, null])
      // The fixture's wording ("(demo)", "Internal Alpha", "Chương trình mẫu");
      // a source sentence may say "sản phẩm mẫu" (a prototype).
      expect(p.name).not.toMatch(/demo|internal alpha|mẫu|sample|test/i)
      expect(p.summary ?? '').not.toMatch(/\(demo\)|internal alpha|chương trình mẫu|sample/i)
    }
    expect(new Set(list.map((p) => p.slug)).size).toBe(list.length)
    expect(new Set(list.map((p) => p.name)).size).toBe(list.length)
  })

  it("S2-PROGRAMME-EVENT-CONTENT-01: the sheet's finished programmes, kept", () => {
    expect(past.map((p) => p.name)).toEqual(PAST_PROGRAMMES.map((p) => p.title))
    expect(past).toHaveLength(8)
    for (const p of past) {
      expect(p.phase).toBe('da-ket-thuc')
      expect(p.kind).toBeNull()
      expect(p.image).toMatch(/^\/programmes\/past\/[a-z0-9-]+\.webp$/)
      expect(p.hosts.length).toBeGreaterThan(0)
    }
  })
})
