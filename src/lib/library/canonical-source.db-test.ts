import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool } from '@/lib/db/client'
import { getPublicOrganization } from '@/lib/public/organization'

import { listPublicStartups, listVisibleFounders, vocabularyForLibrary } from './canonical-source'
import { LibraryQueryError, opaqueKey } from './library-data'
import { listLibraryFounders, listLibraryStartups } from './library-service'
import {
  clearLibraryFixture,
  FX_EXCLUDED,
  FX_LISTED,
  FX_OWNERS,
  FX_PRIVATE,
  LIBRARY_FX,
  LIBRARY_FX_KEYWORD as Q,
  seedLibraryFixture,
  type LibraryFixture,
} from './testing'

/**
 * WF06-PROD-02 — the Library's canonical read path against live PostgreSQL
 * (DEC-W6P-D02 / D03 / D04): which ventures and founders a viewer may get,
 * from which record, with which key, and what never leaves the server.
 */

let fx: LibraryFixture

beforeAll(async () => {
  fx = await seedLibraryFixture()
})

afterEach(() => {
  vi.unstubAllGlobals()
  globalThis.__hubStartupDirectory = undefined
})

afterAll(async () => {
  await clearLibraryFixture()
  await closePool()
})

/** The external feed for one test (the real URL is never fetched here). */
function stubFeed(records: unknown[] | 'down') {
  globalThis.__hubStartupDirectory = undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (records === 'down') throw new Error('offline')
      return new Response(JSON.stringify(records), { status: 200 })
    }),
  )
}

const external = (ten_startup: string, over: Record<string, unknown> = {}) => ({
  ten_startup,
  linh_vuc: ['EdTech'],
  giai_doan_phat_trien: 'Idea',
  website: 'https://ngoai.example.vn/',
  mo_ta_ngan: 'Bản ghi ngoài',
  thanh_vien: [{ ho_ten: 'WF06 Người Ngoài', vai_tro: 'Founder' }],
  ...over,
})

const FEED = [
  external('WF06 Kho Lạnh', { linh_vuc: ['Logistics'], giai_doan_phat_trien: 'Growth' }), // canonical twin
  external('WF06 Ngoài Một'),
  external('WF06 ngoài một', { mo_ta_ngan: 'Bản trùng' }), // duplicate external name
  external('WF06 Ngoài Hai', { giai_doan_phat_trien: 'Unknown', website: 'javascript:alert(1)' }),
  external('   '), // unusable record
  null,
]

const fixtureNames = (rows: Array<{ name: string }>) =>
  rows.map((r) => r.name).filter((n) => n.startsWith('WF06 '))

const LISTED = FX_LISTED.map((v) => v.name)
const EXCLUDED = FX_EXCLUDED.map((v) => v.name)

describe('listPublicStartups — the canonical predicate in SQL', () => {
  it('returns PUBLIC ACTIVE STARTUP ventures only', async () => {
    const names = fixtureNames(await listPublicStartups())
    expect([...names].sort()).toEqual([...LISTED].sort())
    for (const hidden of EXCLUDED) expect(names).not.toContain(hidden)
  })

  it('reads stage, region and domain labels from the vocabulary; missing values stay empty', async () => {
    const rows = await listPublicStartups()
    const by = (name: string) => rows.find((r) => r.name === name)!
    expect(by('WF06 An Khang')).toMatchObject({
      ventureId: fx.ventures['WF06 An Khang'],
      stage: { id: LIBRARY_FX.stage.GROWTH, code: 'GROWTH', label: 'Tăng trưởng' },
      region: { id: LIBRARY_FX.region.hanoi, label: 'Hà Nội' },
      domains: [{ id: LIBRARY_FX.domain.govtech, label: 'Công nghệ khu vực công' }],
    })
    // Domains in vocabulary order (sort_order, then label).
    expect(by('WF06 Cầu Nối').domains.map((d) => d.id)).toEqual([
      LIBRARY_FX.domain.govtech,
      LIBRARY_FX.domain.edtech,
    ])
    expect(by('WF06 Đồng Xanh').region).toBeNull()
    expect(by('WF06 Gió Mới')).toMatchObject({ stage: null, region: null, domains: [] })
  })

  it('maps VENTURE_STAGE codes and ACTIVE DOMAIN slugs for the external records', async () => {
    const vocab = await vocabularyForLibrary()
    expect(vocab.stagesByCode.get('GROWTH')).toEqual({
      id: LIBRARY_FX.stage.GROWTH,
      code: 'GROWTH',
      label: 'Tăng trưởng',
    })
    expect(vocab.domainsBySlug.get('edtech')?.id).toBe(LIBRARY_FX.domain.edtech)
  })
})

describe('listVisibleFounders — DEC-W6P-D03', () => {
  it('a guest gets no founder', async () => {
    expect(await listVisibleFounders('GUEST')).toEqual([])
  })

  it('a member sees NETWORK_ONLY owners of listed ventures, with those ventures only', async () => {
    const founders = (await listVisibleFounders('NETWORK')).filter((f) =>
      f.displayName.startsWith('WF06 '),
    )
    expect(founders.map((f) => f.displayName).sort()).toEqual([
      'WF06 Founder Hải',
      'WF06 Founder Lan',
    ])
    const lan = founders.find((f) => f.profileId === fx.owners.lan)!
    expect(lan.ventures.map((v) => v.name).sort()).toEqual(
      FX_LISTED.filter((v) => v.owner === 'lan')
        .map((v) => v.name)
        .sort(),
    )
    expect(lan.ventures.find((v) => v.name === 'WF06 An Khang')?.roleLabel).toBe('Co-Founder')
  })

  it('omits a hidden, deactivated, blocked or nameless owner, and the owner of a hidden venture only', async () => {
    const ids = new Set((await listVisibleFounders('NETWORK')).map((f) => f.profileId))
    for (const key of ['hidden', 'deactivated', 'blocked', 'nameless', 'privateOnly'] as const) {
      expect(ids.has(fx.owners[key])).toBe(false)
    }
    // …while their PUBLIC ventures stay listed as ventures (the founder is not shown).
    const names = fixtureNames(await listPublicStartups())
    expect(names).toEqual(
      expect.arrayContaining(['WF06 Ngân Hà', 'WF06 Ổ Khóa', 'WF06 Quả Ngọt', 'WF06 Phố Cổ']),
    )
    expect(names).not.toContain('WF06 Riêng Tư')
  })
})

describe('listLibraryStartups — canonical plus the TEMPORARY_EXTERNAL remainder', () => {
  it('merges, suppresses the canonical twin, drops duplicates and unusable records, and sorts by stage', async () => {
    stubFeed(FEED)
    const page = await listLibraryStartups({ q: Q, limit: 50 })
    expect(page.external).toBe('ok')
    expect(page.total).toBe(16)
    expect(page.items.map((i) => [i.name, i.provenance === 'CANONICAL' ? 'C' : 'X'])).toEqual([
      ['WF06 An Khang', 'C'],
      ['WF06 Kho Lạnh', 'C'],
      ['WF06 Ổ Khóa', 'C'],
      ['WF06 Sao Mai', 'C'],
      ['WF06 Bình Minh', 'C'],
      ['WF06 Cầu Nối', 'C'],
      ['WF06 Ngân Hà', 'C'],
      ['WF06 Dòng Chảy', 'C'],
      ['WF06 Lúa Vàng', 'C'],
      ['WF06 Phố Cổ', 'C'],
      ['WF06 Đồng Xanh', 'C'],
      ['WF06 Hạt Giống', 'C'],
      ['WF06 Ngoài Một', 'X'],
      ['WF06 Quả Ngọt', 'C'],
      ['WF06 Gió Mới', 'C'],
      ['WF06 Ngoài Hai', 'X'],
    ])
    const hai = page.items.find((i) => i.name === 'WF06 Ngoài Hai')!
    // Invalid external website and unknown stage are dropped, not guessed.
    expect(hai).toMatchObject({ website: null, stage: null })
    const mot = page.items.find((i) => i.name === 'WF06 Ngoài Một')!
    expect(mot.domains).toEqual([{ id: LIBRARY_FX.domain.edtech, label: 'Giáo dục' }])
  })

  it('pages 9 at a time with an opaque cursor, without gaps or repeats', async () => {
    stubFeed(FEED)
    const all = (await listLibraryStartups({ q: Q, limit: 50 })).items.map((i) => i.key)
    const first = await listLibraryStartups({ q: Q })
    expect(first.items).toHaveLength(9)
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/)
    const second = await listLibraryStartups({ q: Q, cursor: first.nextCursor! })
    expect(second.items).toHaveLength(7)
    expect(second.nextCursor).toBeNull()
    expect([...first.items, ...second.items].map((i) => i.key)).toEqual(all)
    await expect(listLibraryStartups({ q: Q, cursor: 'forged' })).rejects.toBeInstanceOf(
      LibraryQueryError,
    )
  })

  it('filters by DOMAIN and VENTURE_STAGE ids; an unknown id is refused, a no-match is empty', async () => {
    stubFeed(FEED)
    const edtech = await listLibraryStartups({
      q: Q,
      domainIds: [LIBRARY_FX.domain.edtech],
      limit: 50,
    })
    expect(edtech.items.map((i) => i.name).sort()).toEqual(
      [
        ...FX_LISTED.filter((v) => v.domains.includes('edtech')).map((v) => v.name),
        // Both kept external records say "EdTech": mapped to the ACTIVE edtech DOMAIN.
        'WF06 Ngoài Một',
        'WF06 Ngoài Hai',
      ].sort(),
    )
    const growth = await listLibraryStartups({
      q: Q,
      stageIds: [LIBRARY_FX.stage.GROWTH],
      limit: 50,
    })
    expect(growth.items.map((i) => i.name)).toEqual([
      'WF06 An Khang',
      'WF06 Kho Lạnh',
      'WF06 Ổ Khóa',
      'WF06 Sao Mai',
    ])
    // Several values in a group: any of them (the page's facet rule).
    const either = await listLibraryStartups({
      q: Q,
      stageIds: [LIBRARY_FX.stage.GROWTH, LIBRARY_FX.stage.SELLING],
      limit: 50,
    })
    expect(either.total).toBe(5)
    await expect(
      listLibraryStartups({ q: Q, domainIds: ['00000000-0000-0000-0000-000000000000'] }),
    ).rejects.toMatchObject({ field: 'domain_id', reason: 'unknown' })
    const none = await listLibraryStartups({ q: `${Q} khong co gi` })
    expect(none).toMatchObject({ items: [], nextCursor: null, total: 0 })
    const NAME = await listLibraryStartups({ q: Q, sort: 'NAME', limit: 2 })
    expect(NAME.items.map((i) => i.name)).toEqual(['WF06 An Khang', 'WF06 Bình Minh'])
  })

  it('keeps serving canonical ventures when the external feed is down', async () => {
    stubFeed('down')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const page = await listLibraryStartups({ q: Q, limit: 50 })
    expect(page.external).toBe('unavailable')
    expect(page.items.every((i) => i.provenance === 'CANONICAL')).toBe(true)
    expect(page.total).toBe(LISTED.length)
  })

  it('never makes a founder name searchable, canonical or external', async () => {
    stubFeed(FEED)
    for (const q of ['WF06 Founder Lan', 'WF06 Người Ngoài']) {
      expect((await listLibraryStartups({ q })).items).toEqual([])
    }
  })

  it('keys a venture by its canonical id, stably, and exposes no id, slug or owner', async () => {
    stubFeed(FEED)
    const first = await listLibraryStartups({ q: Q, limit: 50 })
    const again = await listLibraryStartups({ q: Q, limit: 50 })
    const an = first.items.find((i) => i.name === 'WF06 An Khang')!
    expect(an.key).toBe(opaqueKey('venture', fx.ventures['WF06 An Khang']!))
    expect(again.items.map((i) => i.key)).toEqual(first.items.map((i) => i.key))
    expect(new Set(first.items.map((i) => i.key)).size).toBe(first.items.length)
    const text = JSON.stringify(first)
    for (const id of [...Object.values(fx.ventures), ...Object.values(fx.owners)]) {
      expect(text).not.toContain(id)
    }
    expect(text).not.toMatch(/wf06-fx-|owner|slug|@example/)
    expect(Object.keys(an).sort()).toEqual(
      [
        'domainLabels',
        'domains',
        'key',
        'memberCount',
        'name',
        'provenance',
        'region',
        'stage',
        'summary',
        'website',
      ].sort(),
    )
  })
})

describe('listLibraryFounders', () => {
  it('a guest gets restricted: true and no item', async () => {
    expect(await listLibraryFounders('GUEST', { q: Q })).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
      facets: { domain: [] },
      restricted: true,
    })
  })

  it('a member gets visible founders by name, searchable by name and listed venture only', async () => {
    const page = await listLibraryFounders('NETWORK', { q: Q })
    expect(page.restricted).toBe(false)
    expect(page.items.map((f) => f.displayName)).toEqual(['WF06 Founder Hải', 'WF06 Founder Lan'])
    expect(page.items[1]!.key).toBe(opaqueKey('founder', fx.owners.lan))
    expect(
      (await listLibraryFounders('NETWORK', { q: 'WF06 Sao Mai' })).items.map((f) => f.displayName),
    ).toEqual(['WF06 Founder Hải'])
    // A hidden owner's venture and a member's private venture find no founder.
    for (const q of ['WF06 Ngân Hà', 'WF06 Kín Đáo']) {
      expect((await listLibraryFounders('NETWORK', { q })).items).toEqual([])
    }
    const govtech = await listLibraryFounders('NETWORK', {
      q: Q,
      domainIds: [LIBRARY_FX.domain.govtech],
    })
    expect(govtech.items.map((f) => f.displayName)).toEqual(['WF06 Founder Lan'])
  })

  it('carries no private profile field, id, e-mail or hidden person', async () => {
    const text = JSON.stringify(await listLibraryFounders('NETWORK', { q: Q, limit: 50 }))
    for (const value of Object.values(FX_PRIVATE)) expect(text).not.toContain(value)
    for (const id of [...Object.values(fx.ventures), ...Object.values(fx.owners)]) {
      expect(text).not.toContain(id)
    }
    for (const key of ['hidden', 'deactivated', 'blocked', 'privateOnly'] as const) {
      expect(text).not.toContain(FX_OWNERS[key].displayName!)
    }
    expect(text).not.toMatch(/@example|wf06-fx-|Kín Đáo|Bản Nháp|Lưu Trữ|Dự Án/)
  })
})

describe('organization page data (unchanged read, fixture data quality)', () => {
  it('shows a PUBLISHED CLB and the same 404 for DRAFT, ARCHIVED or non-network organizations', async () => {
    const org = await getPublicOrganization('wf06-fx-org-published')
    expect(org).toMatchObject({
      slug: 'wf06-fx-org-published',
      type: 'CLB',
      parent: null,
      children: [],
    })
    for (const slug of ['wf06-fx-org-draft', 'wf06-fx-org-archived', 'wf06-fx-org-company']) {
      const error = await getPublicOrganization(slug).then(
        () => null,
        (e: unknown) => e,
      )
      expect(isApiError(error) && error.status).toBe(404)
    }
  })
})
