import { describe, expect, it } from 'vitest'

import { PROGRAMME_CARDS } from '@/components/home/home-content'

import { listPublicProgrammes } from './programme-directory'

/** PROGRAMME-PRESENTATION-DATA-01 — `/programmes` shows the source-backed programmes only. */
describe('listPublicProgrammes', () => {
  const list = listPublicProgrammes()

  it('is the homepage programmes, same names, descriptions and hosts, in order', () => {
    expect(list.map((p) => [p.name, p.summary, p.host?.name])).toEqual(
      PROGRAMME_CARDS.map((c) => [c.title, c.description, c.owner]),
    )
  })

  it('invents nothing: the sheet status, no dates, no apply entry, no fixture wording', () => {
    for (const p of list) {
      expect(p.phase).toBe('sap-cong-bo')
      expect(p.kind).toBe('challenge')
      expect([p.timeline, p.startsAt, p.applyHref]).toEqual([null, null, null])
      expect(`${p.name} ${p.summary}`).not.toMatch(/demo|internal alpha|mẫu|sample|test/i)
    }
    expect(new Set(list.map((p) => p.slug)).size).toBe(list.length)
    expect(list.map((p) => p.host?.slug)).toEqual([
      'apec',
      'vpbank-ngan-hang-nha-nuoc',
      'clb-nha-doanh-nhan-tuong-lai-tec-ftu',
      'net-zero-vietnam',
    ])
  })
})
