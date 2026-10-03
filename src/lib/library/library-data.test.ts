import { describe, expect, it } from 'vitest'

import type { CanonicalFounderRow, CanonicalStartupRow, StageRef } from './canonical-source'
import {
  filterEntries,
  founderEntries,
  LibraryQueryError,
  mergeStartups,
  opaqueKey,
  paginate,
  PAGE_DEFAULT,
  PAGE_MAX,
  sortFounders,
  sortStartups,
  type LibraryVocabulary,
} from './library-data'
import { adaptStartups } from './startup-adapter'

/** WF06-PROD-02 — the Library's pure data rules (DEC-W6P-D02 / D03 / D04). */

const EDTECH = { id: 'd-edtech', label: 'Giáo dục' }
const GOVTECH = { id: 'd-govtech', label: 'Công nghệ khu vực công' }
const stage = (code: StageRef['code'], label: string): StageRef => ({
  id: `s-${code}`,
  code,
  label,
})
const IDEA = stage('IDEA', 'Ý tưởng')
const GROWTH = stage('GROWTH', 'Tăng trưởng')

const vocab: LibraryVocabulary = {
  domainsBySlug: new Map([
    ['edtech', EDTECH],
    ['govtech', GOVTECH],
  ]),
  stagesByCode: new Map([
    ['IDEA', IDEA],
    ['GROWTH', GROWTH],
  ]),
}

const canonical = (over: Partial<CanonicalStartupRow> & { name: string }): CanonicalStartupRow => ({
  ventureId: `00000000-0000-0000-0000-${over.name.length.toString().padStart(12, '0')}`,
  summary: null,
  stage: null,
  region: null,
  domains: [],
  ...over,
})

const feed = (records: Array<Record<string, unknown>>) =>
  adaptStartups(
    records.map((r) => ({
      ten_startup: 'X',
      linh_vuc: [],
      giai_doan_phat_trien: null,
      website: null,
      mo_ta_ngan: null,
      thanh_vien: [],
      ...r,
    })),
  ).startups

describe('mergeStartups', () => {
  const rows = [
    canonical({
      ventureId: '11111111-1111-1111-1111-111111111111',
      name: 'Kho Lạnh',
      summary: 'Chuỗi lạnh',
      stage: GROWTH,
      region: { id: 'r-hn', label: 'Hà Nội' },
      domains: [GOVTECH],
    }),
  ]
  const external = feed([
    { ten_startup: 'KHO LANH', linh_vuc: ['Giáo dục'] },
    { ten_startup: 'Học Vui', linh_vuc: ['EdTech'], giai_doan_phat_trien: 'Idea' },
    { ten_startup: 'Học  vui', linh_vuc: ['Fintech'] },
    {
      ten_startup: 'Nông Sạch',
      linh_vuc: ['Nông nghiệp'],
      thanh_vien: [{ ho_ten: 'Võ Thanh Hà', vai_tro: 'Founder' }],
    },
  ])

  const merged = mergeStartups(rows, external, vocab)

  it('keeps canonical rows and suppresses an external record with the same folded name', () => {
    expect(merged.map((e) => [e.item.name, e.item.provenance])).toEqual([
      ['Kho Lạnh', 'CANONICAL'],
      ['Học Vui', 'TEMPORARY_EXTERNAL'],
      ['Nông Sạch', 'TEMPORARY_EXTERNAL'],
    ])
  })

  it('keeps the first of repeated external names only', () => {
    expect(merged.filter((e) => e.item.name.toLowerCase().startsWith('học'))).toHaveLength(1)
  })

  it('builds canonical items from the canonical record, with an opaque key and no id', () => {
    const item = merged[0]!.item
    expect(item).toEqual({
      key: opaqueKey('venture', '11111111-1111-1111-1111-111111111111'),
      provenance: 'CANONICAL',
      name: 'Kho Lạnh',
      summary: 'Chuỗi lạnh',
      stage: { code: 'GROWTH', label: 'Tăng trưởng' },
      domains: [GOVTECH],
      domainLabels: ['Công nghệ khu vực công'],
      region: 'Hà Nội',
      website: null,
      memberCount: null,
    })
    expect(JSON.stringify(merged.map((e) => e.item))).not.toContain('1111-1111')
  })

  it('maps external categories to DOMAIN items that exist and stages to VENTURE_STAGE items', () => {
    const hoc = merged[1]!
    expect(hoc.item.domains).toEqual([EDTECH])
    expect(hoc.domainIds).toEqual(['d-edtech'])
    expect(hoc.item.stage).toEqual({ code: 'IDEA', label: 'Ý tưởng' })
    expect(hoc.stageId).toBe('s-IDEA')
    // AGRI → 'agritech' has no ACTIVE DOMAIN here: no facet value, label kept as written.
    const nong = merged[2]!
    expect(nong.item.domains).toEqual([])
    expect(nong.item.domainLabels).toEqual(['Nông nghiệp'])
  })

  it('never makes an external founder name searchable (DEC-W6P-D03)', () => {
    expect(filterEntries(merged, { q: 'vo thanh ha' })).toEqual([])
    expect(filterEntries(merged, { q: 'nong sach' }).map((e) => e.item.name)).toEqual(['Nông Sạch'])
  })
})

describe('filterEntries', () => {
  const entries = mergeStartups(
    [
      canonical({
        ventureId: 'a',
        name: 'Alpha Edu',
        summary: 'Lớp học số',
        domains: [EDTECH],
        stage: IDEA,
      }),
      canonical({ ventureId: 'b', name: 'Beta Gov', domains: [GOVTECH], stage: GROWTH }),
      canonical({ ventureId: 'c', name: 'Gamma', summary: 'Không lĩnh vực' }),
    ],
    [],
    vocab,
  )
  const names = (f: Parameters<typeof filterEntries>[1]) =>
    filterEntries(entries, f).map((e) => e.item.name)

  it('matches every keyword word, case- and accent-folded, over name, summary and domain labels', () => {
    expect(names({ q: 'LOP HOC' })).toEqual(['Alpha Edu'])
    expect(names({ q: 'giao duc' })).toEqual(['Alpha Edu'])
    expect(names({ q: 'alpha gov' })).toEqual([])
    expect(names({ q: '   ' })).toEqual(['Alpha Edu', 'Beta Gov', 'Gamma'])
  })

  it('filters by DOMAIN and VENTURE_STAGE id exactly; an unknown id matches nothing', () => {
    expect(names({ domainId: 'd-govtech' })).toEqual(['Beta Gov'])
    expect(names({ stageId: 's-IDEA' })).toEqual(['Alpha Edu'])
    expect(names({ domainId: 'd-edtech', stageId: 's-GROWTH' })).toEqual([])
    expect(names({ domainId: 'nope' })).toEqual([])
  })

  it('caps the keyword at 120 characters', () => {
    expect(names({ q: `gamma${' '.repeat(120)}zzz` })).toEqual(['Gamma'])
  })
})

describe('sortStartups', () => {
  const entries = mergeStartups(
    [
      canonical({ ventureId: 'a', name: 'Bình', stage: IDEA }),
      canonical({ ventureId: 'b', name: 'An', stage: null }),
      canonical({ ventureId: 'c', name: 'Đông', stage: GROWTH }),
      canonical({ ventureId: 'd', name: 'Cúc', stage: GROWTH }),
    ],
    feed([{ ten_startup: 'Ánh', giai_doan_phat_trien: 'Growth' }]),
    vocab,
  )

  it('STAGE: the most advanced stage first, no stage last, then name (vi)', () => {
    expect(sortStartups(entries, 'STAGE').map((i) => i.name)).toEqual([
      'Ánh',
      'Cúc',
      'Đông',
      'Bình',
      'An',
    ])
  })

  it('NAME: name (vi), then canonical before external, then key', () => {
    expect(sortStartups(entries, 'NAME').map((i) => i.name)).toEqual([
      'An',
      'Ánh',
      'Bình',
      'Cúc',
      'Đông',
    ])
    const twins = mergeStartups([], feed([{ ten_startup: 'Twin' }]), vocab).concat(
      mergeStartups([canonical({ ventureId: 't', name: 'Twin' })], [], vocab),
    )
    expect(sortStartups(twins, 'NAME').map((i) => i.provenance)).toEqual([
      'CANONICAL',
      'TEMPORARY_EXTERNAL',
    ])
  })

  it('is deterministic for any input order', () => {
    const reversed = [...entries].reverse()
    expect(sortStartups(reversed, 'STAGE')).toEqual(sortStartups(entries, 'STAGE'))
  })
})

describe('founderEntries / sortFounders', () => {
  const rows: CanonicalFounderRow[] = [
    {
      profileId: 'p-2',
      displayName: 'Trần Bảo',
      avatarUrl: null,
      ventures: [{ ventureId: 'v-2', name: 'Beta Gov', roleLabel: 'CEO', stage: GROWTH }],
      domainIds: ['d-govtech'],
    },
    {
      profileId: 'p-1',
      displayName: 'Lê An',
      avatarUrl: '/media/assets/abc',
      ventures: [{ ventureId: 'v-1', name: 'Alpha Edu', roleLabel: null, stage: null }],
      domainIds: ['d-edtech'],
    },
  ]
  const entries = founderEntries(rows)

  it('exposes name, avatar, venture names / roles / stage labels and an opaque key only', () => {
    expect(sortFounders(entries)).toEqual([
      {
        key: opaqueKey('founder', 'p-1'),
        displayName: 'Lê An',
        avatarUrl: '/media/assets/abc',
        ventures: [{ name: 'Alpha Edu', roleLabel: null, stage: null }],
        domainIds: ['d-edtech'],
      },
      {
        key: opaqueKey('founder', 'p-2'),
        displayName: 'Trần Bảo',
        avatarUrl: null,
        ventures: [{ name: 'Beta Gov', roleLabel: 'CEO', stage: 'Tăng trưởng' }],
        domainIds: ['d-govtech'],
      },
    ])
    expect(JSON.stringify(sortFounders(entries))).not.toMatch(/p-1"|p-2"|v-1|v-2/)
  })

  it('searches display name and venture names; filters by the ventures’ domains', () => {
    expect(filterEntries(entries, { q: 'tran bao' }).map((e) => e.item.displayName)).toEqual([
      'Trần Bảo',
    ])
    expect(filterEntries(entries, { q: 'alpha' }).map((e) => e.item.displayName)).toEqual(['Lê An'])
    expect(filterEntries(entries, { domainId: 'd-govtech' })).toHaveLength(1)
  })
})

describe('opaqueKey', () => {
  it('is stable per record, distinct per kind and never contains the id', () => {
    const id = '7f1c2d3e-0000-4000-8000-000000000001'
    expect(opaqueKey('venture', id)).toBe(opaqueKey('venture', id))
    expect(opaqueKey('venture', id)).not.toBe(opaqueKey('founder', id))
    expect(opaqueKey('venture', id)).toMatch(/^[0-9a-f]{16}$/)
    expect(opaqueKey('venture', id)).not.toContain('7f1c2d3e')
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 23 }, (_, i) => i)

  it('returns 9 by default with an opaque cursor, and walks the list without gaps or repeats', () => {
    const seen: number[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const page = paginate(items, cursor)
      expect(page.items.length).toBeLessThanOrEqual(PAGE_DEFAULT)
      seen.push(...page.items)
      cursor = page.nextCursor ?? undefined
      pages += 1
    } while (cursor)
    expect(seen).toEqual(items)
    expect(pages).toBe(3)
  })

  it('clamps the limit to 1..50 and falls back to 9 for an invalid one', () => {
    const many = Array.from({ length: 80 }, (_, i) => i)
    expect(paginate(many, undefined, 200).items).toHaveLength(PAGE_MAX)
    expect(paginate(many, undefined, 0).items).toHaveLength(PAGE_DEFAULT)
    expect(paginate(many, undefined, 2.5).items).toHaveLength(PAGE_DEFAULT)
    expect(paginate(many, undefined, 3).items).toEqual([0, 1, 2])
  })

  it('returns an empty page without a cursor for an empty list or past the end', () => {
    expect(paginate([], undefined)).toEqual({ items: [], nextCursor: null })
    const last = paginate(items, paginate(items, undefined, 20).nextCursor!, 20)
    expect(last).toEqual({ items: [20, 21, 22], nextCursor: null })
  })

  it('rejects a malformed or forged cursor', () => {
    for (const bad of [
      '!!',
      'o:5',
      Buffer.from('o:-1').toString('base64url'),
      Buffer.from('o:09').toString('base64url'),
      Buffer.from('x:1').toString('base64url'),
      Buffer.from('o:1234567').toString('base64url'),
    ]) {
      expect(() => paginate(items, bad)).toThrow(LibraryQueryError)
    }
  })
})
