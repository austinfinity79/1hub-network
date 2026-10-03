import { describe, expect, it } from 'vitest'

import type { FounderDTO, StartupDTO } from '@/lib/library/library-api'
import type { FoundersBody, ProblemsBody, StartupsBody } from '@/lib/library/library-bodies'
import type { LibraryProblemItem } from '@/lib/library/library-service'
import type { LibraryProblem } from '@/lib/library/problem-adapter'

import {
  cardsOf,
  founderCard,
  groupsOf,
  libraryUrl,
  matches,
  PROBLEM_QUICK,
  problemCard,
  problemTab,
  startupCard,
} from './library-model'

/**
 * TASK 24.1 / WF06-PROD-04 — the Library cards drawn from the API answers
 * (DEC-L15-D11 / D12, DEC-W6P-D03) and the one request per tab state.
 */

const startup = (over: Partial<StartupDTO> = {}): StartupDTO => ({
  key: 'a1b2c3d4e5f60718',
  name: 'Tracely',
  summary: 'Truy vết chuỗi giao vận.',
  stage: { code: 'MVP', label: 'MVP' },
  domains: [{ id: 'd-1', label: 'Logistics' }],
  domain_labels: ['Logistics', 'AgriTech', 'Dữ liệu', 'IoT'],
  region: 'Đà Nẵng',
  website: 'https://tracely.example.vn/',
  member_count: 2,
  ...over,
})

const founder = (over: Partial<FounderDTO> = {}): FounderDTO => ({
  key: '0f1e2d3c4b5a6978',
  display_name: 'Đặng Kim Chi',
  avatar_url: null,
  ventures: [
    { name: 'Tracely', role_label: 'Co-Founder, CEO', stage: { code: 'MVP', label: 'MVP' } },
  ],
  domain_ids: ['d-1'],
  ...over,
})

describe('startupCard (L15b)', () => {
  it('draws only what the answer holds', () => {
    const card = startupCard(startup())
    expect(card).toMatchObject({
      id: 'a1b2c3d4e5f60718',
      kind: 'STARTUP',
      mark: 'Tr',
      title: 'Tracely',
      pill: 'MVP',
      sub: '2 thành viên',
      summary: 'Truy vết chuỗi giao vận.',
      chips: ['Logistics', 'AgriTech', 'Dữ liệu'],
      cta: { label: 'Xem hồ sơ', href: 'https://tracely.example.vn/' },
      row: null,
    })
    // No city, verification, needs or programmes are drawn (the region is not on the card).
    expect(JSON.stringify(card)).not.toMatch(/Đà Nẵng|xác minh|Đang cần/)
  })

  it('a canonical startup: no website, no member count → no link, no member line', () => {
    const card = startupCard(startup({ website: null, member_count: null, stage: null }))
    expect(card).toMatchObject({ sub: null, pill: null, cta: { href: null } })
  })

  it('draws the marks as the frame does', () => {
    expect(
      ['Tracely', 'LogiSense', 'Kho Lạnh'].map((name) => startupCard(startup({ name })).mark),
    ).toEqual(['Tr', 'LS', 'KL'])
  })
})

describe('founderCard (L15c, DEC-W6P-D03)', () => {
  it('shows name, short role and the startup row, and nothing else', () => {
    expect(founderCard(founder())).toMatchObject({
      kind: 'FOUNDER',
      mark: 'KC',
      title: 'Đặng Kim Chi',
      pill: null,
      sub: 'Co-Founder · Tracely',
      chips: [],
      summary: null,
      row: { mark: 'Tr', name: 'Tracely', note: 'MVP', href: null },
      cta: { label: 'Xem hồ sơ', href: null },
    })
  })

  it('falls back to "Nhà sáng lập" without a role and counts the other startups', () => {
    const card = founderCard(
      founder({
        ventures: [
          { name: 'Alpha', role_label: null, stage: null },
          { name: 'Beta', role_label: 'CTO', stage: null },
        ],
      }),
    )
    expect(card).toMatchObject({
      sub: 'Nhà sáng lập · Alpha',
      head: 'Alpha +1',
      row: { name: 'Alpha +1', note: null },
    })
  })
})

describe('problemCard (L15)', () => {
  const problem: LibraryProblemItem = {
    key: '1234567890abcdef',
    title: 'Giảm ùn tắc',
    summary: null,
    org: 'Sở GTVT',
    stage: { code: 'sap_dien_ra', label: 'Sắp diễn ra' },
    prize: null,
    time: '10/2026',
    teams: null,
    domains: ['Giao thông'],
    areas: ['Hà Nội'],
    cover: 2,
  }
  it('draws the dark card with the cover tone and no action', () => {
    expect(problemCard(problem)).toMatchObject({
      kind: 'PROBLEM',
      tone: 'wine',
      head: 'Sở GTVT',
      pill: 'Sắp diễn ra',
      meta: ['10/2026'],
      cta: { label: 'Theo dõi bài toán', href: null },
    })
  })
})

describe('groupsOf / cardsOf', () => {
  const page = { next_cursor: null, limit: 9 }
  it('turns API facets into the page groups, ids as values for canonical tabs', () => {
    const body: StartupsBody = {
      items: [startup()],
      page,
      total: 1,
      facets: {
        domain: [{ id: 'd-1', label: 'Logistics', count: 1 }],
        stage: [{ id: 's-1', code: 'IDEA', label: 'Ý tưởng', count: 0 }],
      },
      degraded: false,
    }
    expect(groupsOf('STARTUP', body)).toEqual([
      {
        key: 'domain',
        title: 'LĨNH VỰC',
        values: [{ value: 'd-1', label: 'Logistics', count: 1 }],
      },
      { key: 'stage', title: 'GIAI ĐOẠN', values: [{ value: 's-1', label: 'Ý tưởng', count: 0 }] },
    ])
    expect(cardsOf('STARTUP', body).map((c) => c.title)).toEqual(['Tracely'])
    const restricted: FoundersBody = {
      items: [],
      page,
      total: 0,
      facets: { domain: [] },
      restricted: true,
    }
    expect(cardsOf('FOUNDER', restricted)).toEqual([])
    const problems: ProblemsBody = {
      items: [],
      page,
      total: 0,
      facets: {
        domain: [],
        stage: [{ value: 'cong_bo', label: 'Đã công bố', count: 0 }],
        area: [],
      },
    }
    expect(groupsOf('PROBLEM', problems).map((g) => g.title)).toEqual([
      'LĨNH VỰC',
      'GIAI ĐOẠN',
      'ĐỊA BÀN',
    ])
  })
})

describe('libraryUrl', () => {
  it('builds one deterministic request per state, with the API parameter names', () => {
    const a = libraryUrl('STARTUP', {
      q: '  kho lanh ',
      filters: { stage: ['s-2', 's-1'], domain: ['d-1'] },
      sort: 'NAME',
    })
    const b = libraryUrl('STARTUP', {
      q: 'kho lanh',
      filters: { domain: ['d-1'], stage: ['s-1', 's-2'] },
      sort: 'NAME',
    })
    expect(a).toBe(b)
    expect(a).toBe(
      '/api/v1/library/startups?q=kho+lanh&domain_id=d-1&stage_id=s-1&stage_id=s-2&sort=NAME&limit=9',
    )
    expect(libraryUrl('PROBLEM', { q: '', filters: { area: ['Hà Nội'] }, sort: 'DEADLINE' })).toBe(
      '/api/v1/library/problems?area=H%C3%A0+N%E1%BB%99i&sort=DEADLINE&limit=9',
    )
    expect(
      libraryUrl(
        'FOUNDER',
        { q: '', filters: { domain: ['d-1'], stage: ['x'] }, sort: 'NAME' },
        'b0o5',
      ),
    ).toBe('/api/v1/library/founders?domain_id=d-1&sort=NAME&cursor=b0o5&limit=9')
  })
})

describe('problemTab (the file rules the problems service runs)', () => {
  const problem = (id: string, areas: string[], domains: string[]): LibraryProblem => ({
    id,
    title: `Bài toán ${id}`,
    shortTitle: null,
    summary: null,
    org: null,
    stage: 'dang_mo_nop',
    stageLabel: 'Đang mở nộp',
    prize: null,
    prizeValue: null,
    deadline: null,
    time: null,
    teams: null,
    domains,
    areas,
    cover: null,
    challengeId: null,
  })
  const tab = problemTab([
    problem('a', ['Hà Nội'], ['Giáo dục']),
    problem('b', ['Đà Nẵng'], ['Giáo dục']),
    problem('c', [], ['Nông nghiệp']),
  ])
  const hit = (filters: Record<string, string[]>) =>
    tab.items!.filter((i) => matches(i, '', filters)).map((i) => i.id)

  it('filters by area (the file’s location values) and by domain', () => {
    expect(hit({ area: ['Hà Nội'] })).toEqual(['a'])
    expect(hit({ area: ['Hà Nội', 'Đà Nẵng'] })).toEqual(['a', 'b'])
    expect(hit({ area: ['Hà Nội'], domain: ['Nông nghiệp'] })).toEqual([])
    expect(hit({})).toEqual(['a', 'b', 'c'])
  })

  it('keeps its quick chips as category labels matched to the tags as text', () => {
    expect(tab.quick).toBe(PROBLEM_QUICK)
    expect(PROBLEM_QUICK.map((q) => q.label)).toEqual([
      'Logistics',
      'Tài chính số',
      'Nông nghiệp',
      'AI',
      'Y tế',
    ])
  })
})
