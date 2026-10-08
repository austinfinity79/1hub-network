import { describe, expect, it } from 'vitest'

import { PROGRAMME_CARDS } from '@/components/home/home-content'

import { listPublicProgrammes } from './programme-directory'
import { PAST_PROGRAMMES } from './programme-event-source'

/** PROGRAMME-PRESENTATION-DATA-01 — `/programmes` shows the source-backed programmes only. */
describe('listPublicProgrammes', () => {
  const list = listPublicProgrammes()
  const current = list.slice(0, PROGRAMME_CARDS.length)
  const past = list.slice(PROGRAMME_CARDS.length)

  it('is the homepage programmes, same names, descriptions, hosts and covers, in order', () => {
    expect(current.map((p) => [p.name, p.summary, p.hosts, p.image])).toEqual(
      PROGRAMME_CARDS.map((c) => [c.title, c.description, [c.owner], c.image?.src]),
    )
  })

  it('invents nothing: the sheet status, no dates, no apply entry, no fixture wording', () => {
    for (const p of current) {
      expect(p.phase).toBe('sap-cong-bo')
      expect(p.kind).toBe('challenge')
    }
    for (const p of list) {
      expect([p.timeline, p.startsAt, p.applyHref]).toEqual([null, null, null])
      // The fixture's wording ("(demo)", "Internal Alpha", "Chương trình mẫu");
      // a source sentence may say "sản phẩm mẫu" (a prototype).
      expect(p.name).not.toMatch(/demo|internal alpha|mẫu|sample|test/i)
      expect(p.summary ?? '').not.toMatch(/\(demo\)|internal alpha|chương trình mẫu|sample/i)
    }
    expect(new Set(list.map((p) => p.slug)).size).toBe(list.length)
  })

  it("S2-PROGRAMME-EVENT-CONTENT-01: the sheet's finished programmes, no type, own cover", () => {
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
