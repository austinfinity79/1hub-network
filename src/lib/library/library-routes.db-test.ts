import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as foundersRoute } from '@/app/api/v1/library/founders/route'
import { GET as problemsRoute } from '@/app/api/v1/library/problems/route'
import { GET as startupsRoute } from '@/app/api/v1/library/startups/route'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { createSession, revokeSession } from '@/lib/auth/sessions'
import { closePool, query } from '@/lib/db/client'
import { CHILDREN_LIMIT, getPublicOrganization } from '@/lib/public/organization'

import {
  clearLibraryFixture,
  FX_EXCLUDED,
  FX_LISTED,
  FX_OWNERS,
  FX_PRIVATE,
  LIBRARY_FX,
  seedLibraryFixture,
  type LibraryFixture,
} from './testing'

/**
 * WF06-PROD-03 — `GET /api/v1/library/{startups,founders,problems}` through
 * their route handlers, with real sessions, against live PostgreSQL: the
 * envelope and headers, visibility per actor, founder privacy, the canonical /
 * external merge, filters, sort, pagination, query bounds, normalisation,
 * external failure, data exclusion, direct-id attempts and query counts.
 */

// Every SQL statement of a request is counted (the real function still runs).
vi.mock('@/lib/db/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/db/client')>()
  return { ...real, query: vi.fn(real.query) }
})

type Route = (request: Request) => Promise<Response>
const STARTUPS = startupsRoute as Route
const FOUNDERS = foundersRoute as Route
const PROBLEMS = problemsRoute as Route

let fx: LibraryFixture
const tokens: Record<string, string> = {}

beforeAll(async () => {
  fx = await seedLibraryFixture()
  for (const key of ['stranger', 'lan', 'privateOnly', 'blocked'] as const) {
    tokens[key] = (await createSession(fx.accounts[key])).token
  }
  const revoked = await createSession(fx.accounts.stranger)
  await revokeSession(revoked.token)
  tokens.revoked = revoked.token
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  globalThis.__hubStartupDirectory = undefined
})

afterAll(async () => {
  await clearLibraryFixture()
  await closePool()
})

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
  external('WF06 Kho Lạnh', { giai_doan_phat_trien: 'Growth' }), // canonical twin
  external('WF06 Ngoài Một'),
  external('WF06 NGOÀI MỘT', { mo_ta_ngan: 'Bản trùng' }), // duplicate row
  external('WF06 Ngoài Hai', { giai_doan_phat_trien: 'Unknown', website: 'javascript:alert(1)' }),
  { ten_startup: 'WF06 Thiếu Trường' }, // missing fields
  external('   '), // no name
  null,
]

function stubFeed(feed: unknown[] | 'timeout' | 'html') {
  globalThis.__hubStartupDirectory = undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (feed === 'timeout') throw new DOMException('The operation timed out.', 'TimeoutError')
      if (feed === 'html') return new Response('<html>oops</html>', { status: 200 })
      return new Response(JSON.stringify(feed), { status: 200 })
    }),
  )
}

type Answer = { status: number; headers: Headers; body: any } // eslint-disable-line @typescript-eslint/no-explicit-any

async function get(route: Route, path: string, who?: string): Promise<Answer> {
  const headers: Record<string, string> = who
    ? { cookie: `${SESSION_COOKIE_NAME}=${tokens[who]}` }
    : {}
  const response = await route(new Request(`http://localhost/api/v1/library/${path}`, { headers }))
  return { status: response.status, headers: response.headers, body: await response.json() }
}
const names = (a: Answer) => a.body.items.map((i: { name: string }) => i.name)
const people = (a: Answer) => a.body.items.map((i: { display_name: string }) => i.display_name)
const refused = (a: Answer) => ({
  status: a.status,
  code: a.body.error?.code,
  fields: a.body.error?.fields,
})

const LISTED = FX_LISTED.map((v) => v.name)

describe('envelope, headers and inventory', () => {
  it('answers the three routes with the list envelope, never cached publicly', async () => {
    stubFeed(FEED)
    const answers = [
      await get(STARTUPS, 'startups'),
      await get(FOUNDERS, 'founders'),
      await get(FOUNDERS, 'founders', 'stranger'),
      await get(PROBLEMS, 'problems'),
    ]
    for (const a of answers) {
      expect(a.status).toBe(200)
      expect(a.headers.get('cache-control')).toBe('private, no-store')
      expect(a.headers.get('vary')).toBe('Cookie')
      expect(a.headers.get('x-request-id')).toMatch(/^req_/)
      expect(Object.keys(a.body.page).sort()).toEqual(['limit', 'next_cursor'])
      expect(a.body.page.limit).toBe(9)
      expect(a.body.page.next_cursor === null || typeof a.body.page.next_cursor === 'string').toBe(
        true,
      )
      expect(a.body.items.length).toBeLessThanOrEqual(9)
    }
    expect(Object.keys(answers[0]!.body).sort()).toEqual([
      'degraded',
      'facets',
      'items',
      'page',
      'total',
    ])
    expect(Object.keys(answers[1]!.body).sort()).toEqual([
      'facets',
      'items',
      'page',
      'restricted',
      'total',
    ])
    expect(Object.keys(answers[3]!.body).sort()).toEqual(['facets', 'items', 'page', 'total'])
  })

  it('serialises whitelisted DTO fields only', async () => {
    stubFeed(FEED)
    const s = (await get(STARTUPS, 'startups?q=WF06&limit=50')).body.items
    for (const item of s) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'domain_labels',
          'domains',
          'key',
          'member_count',
          'name',
          'region',
          'stage',
          'summary',
          'website',
        ].sort(),
      )
    }
    const f = (await get(FOUNDERS, 'founders?q=WF06', 'stranger')).body.items
    for (const item of f) {
      expect(Object.keys(item).sort()).toEqual([
        'avatar_url',
        'display_name',
        'domain_ids',
        'key',
        'ventures',
      ])
      for (const v of item.ventures)
        expect(Object.keys(v).sort()).toEqual(['name', 'role_label', 'stage'])
    }
    const p = (await get(PROBLEMS, 'problems?limit=50')).body.items
    for (const item of p) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'areas',
          'cover',
          'domains',
          'key',
          'org',
          'prize',
          'stage',
          'summary',
          'teams',
          'time',
          'title',
        ].sort(),
      )
    }
  })
})

describe('visibility and founder privacy (cross-actor)', () => {
  const matrix: Array<[string, string | undefined, string, (a: Answer) => void]> = [
    [
      'guest',
      undefined,
      'startups?q=WF06&limit=50',
      (a) =>
        expect(
          names(a)
            .filter((n: string) => !n.includes('Ngoài') && !n.includes('Thiếu'))
            .sort(),
        ).toEqual([...LISTED].sort()),
    ],
    [
      'guest',
      undefined,
      'founders?q=WF06',
      (a) => expect(a.body).toMatchObject({ items: [], total: 0, restricted: true }),
    ],
    ['revoked session', 'revoked', 'founders?q=WF06', (a) => expect(a.body.restricted).toBe(true)],
    ['blocked account', 'blocked', 'founders?q=WF06', (a) => expect(a.body.restricted).toBe(true)],
    [
      'member',
      'stranger',
      'founders?q=WF06',
      (a) => expect(people(a)).toEqual(['WF06 Founder Hải', 'WF06 Founder Lan']),
    ],
    ['member', 'stranger', 'startups?q=WF06 Kín Đáo', (a) => expect(a.body.items).toEqual([])],
    [
      'owner of a PRIVATE venture',
      'privateOnly',
      'startups?q=WF06 Riêng Tư',
      (a) => expect(a.body.items).toEqual([]),
    ],
    [
      'owner of a PRIVATE venture',
      'privateOnly',
      'founders?q=WF06 Riêng',
      (a) => expect(a.body.items).toEqual([]),
    ],
    [
      'founder viewing themself',
      'lan',
      'founders?q=WF06 Founder Lan',
      (a) => expect(people(a)).toEqual(['WF06 Founder Lan']),
    ],
  ]
  for (const [actor, who, path, expectation] of matrix) {
    it(`${actor} × ${path}`, async () => {
      stubFeed(FEED)
      const a = await get(path.startsWith('startups') ? STARTUPS : FOUNDERS, path, who)
      expect(a.status).toBe(200)
      expectation(a)
    })
  }

  it('a member sees a hidden owner’s PUBLIC venture, never the owner', async () => {
    stubFeed(FEED)
    expect(names(await get(STARTUPS, 'startups?q=WF06 Ngân Hà', 'stranger'))).toEqual([
      'WF06 Ngân Hà',
    ])
    const text = JSON.stringify((await get(FOUNDERS, 'founders?q=WF06&limit=50', 'stranger')).body)
    for (const key of ['hidden', 'deactivated', 'blocked', 'privateOnly', 'stranger'] as const) {
      expect(text).not.toContain(FX_OWNERS[key].displayName!)
    }
    expect(text).not.toContain('Ngân Hà')
  })

  it('the startup answer is the same for a guest and a member', async () => {
    stubFeed(FEED)
    const guest = await get(STARTUPS, 'startups?q=WF06&limit=50')
    const member = await get(STARTUPS, 'startups?q=WF06&limit=50', 'stranger')
    expect(member.body).toEqual(guest.body)
  })
})

describe('canonical / external merge', () => {
  it('canonical wins a duplicate, a repeated or unusable row adds nothing, items are unique', async () => {
    stubFeed(FEED)
    const a = await get(STARTUPS, 'startups?q=WF06&limit=50')
    expect(a.body.total).toBe(LISTED.length + 3)
    const kho = a.body.items.filter(
      (i: { name: string }) => i.name.toLowerCase() === 'wf06 kho lạnh',
    )
    expect(kho).toEqual([
      expect.objectContaining({ website: null, member_count: null, region: 'TP. Hồ Chí Minh' }),
    ])
    const keys = a.body.items.map((i: { key: string }) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(names(a).filter((n: string) => n.toLowerCase() === 'wf06 ngoài một')).toHaveLength(1)
    const hai = a.body.items.find((i: { name: string }) => i.name === 'WF06 Ngoài Hai')
    expect(hai).toMatchObject({ website: null, stage: null })
    const thieu = a.body.items.find((i: { name: string }) => i.name === 'WF06 Thiếu Trường')
    expect(thieu).toMatchObject({ summary: null, stage: null, domains: [], website: null })
  })

  it('serves canonical rows, degraded, when the feed times out or is not JSON; no 500, no payload logged', async () => {
    for (const failure of ['timeout', 'html'] as const) {
      stubFeed(failure)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const a = await get(STARTUPS, 'startups?q=WF06&limit=50')
      expect(a.status).toBe(200)
      expect(a.body.degraded).toBe(true)
      expect(names(a).sort()).toEqual([...LISTED].sort())
      expect(warn).toHaveBeenCalledWith('library startup source unavailable', expect.any(String))
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/oops|WF06|html/)
    }
  })
})

describe('filters, sort and normalisation', () => {
  it('filters by vocabulary ids, several values per group, with facet counts', async () => {
    stubFeed(FEED)
    const stages = `stage_id=${LIBRARY_FX.stage.GROWTH}&stage_id=${LIBRARY_FX.stage.SELLING}`
    const a = await get(STARTUPS, `startups?q=WF06&${stages}&limit=50`)
    expect(names(a)).toEqual([
      'WF06 An Khang',
      'WF06 Kho Lạnh',
      'WF06 Ổ Khóa',
      'WF06 Sao Mai',
      'WF06 Bình Minh',
    ])
    const growth = a.body.facets.stage.find((s: { code: string }) => s.code === 'GROWTH')
    expect(growth).toEqual({
      id: LIBRARY_FX.stage.GROWTH,
      code: 'GROWTH',
      label: 'Tăng trưởng',
      count: 4,
    })
    const f = await get(
      FOUNDERS,
      `founders?q=WF06&domain_id=${LIBRARY_FX.domain.govtech}`,
      'stranger',
    )
    expect(people(f)).toEqual(['WF06 Founder Lan'])
  })

  it('sorts deterministically: STAGE by default, NAME on request; same request → same order', async () => {
    stubFeed(FEED)
    const first = await get(STARTUPS, 'startups?q=WF06&limit=50')
    const again = await get(STARTUPS, 'startups?q=WF06&limit=50')
    expect(again.body).toEqual(first.body)
    expect(names(first).slice(0, 4)).toEqual([
      'WF06 An Khang',
      'WF06 Kho Lạnh',
      'WF06 Ổ Khóa',
      'WF06 Sao Mai',
    ])
    expect(names(await get(STARTUPS, 'startups?q=WF06&sort=NAME&limit=3'))).toEqual([
      'WF06 An Khang',
      'WF06 Bình Minh',
      'WF06 Cầu Nối',
    ])
  })

  it('normalises the keyword: trim, spaces, case, accents, Unicode form; blank means none', async () => {
    stubFeed(FEED)
    const plain = names(await get(STARTUPS, `startups?q=${encodeURIComponent('WF06 Ổ Khóa')}`))
    expect(plain).toEqual(['WF06 Ổ Khóa'])
    for (const q of ['  wf06   o   khoa ', 'WF06 Ổ KHÓA', 'WF06 Ổ Khóa'.normalize('NFD')]) {
      expect(names(await get(STARTUPS, `startups?q=${encodeURIComponent(q)}`))).toEqual(plain)
    }
    const blank = await get(STARTUPS, `startups?q=${encodeURIComponent('   ')}`)
    const none = await get(STARTUPS, 'startups')
    expect(blank.body).toEqual(none.body)
    // Wildcards are plain characters, not patterns.
    expect((await get(STARTUPS, 'startups?q=%25')).body.items).toEqual([])
    expect((await get(STARTUPS, 'startups?q=*')).body.items).toEqual([])
  })
})

describe('pagination and bounds', () => {
  it('walks every page without a gap or a repeat', async () => {
    stubFeed(FEED)
    const all = (await get(STARTUPS, 'startups?q=WF06&limit=50')).body.items.map(
      (i: { key: string }) => i.key,
    )
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const a: Answer = await get(
        STARTUPS,
        `startups?q=WF06&limit=4${cursor ? `&cursor=${cursor}` : ''}`,
      )
      seen.push(...a.body.items.map((i: { key: string }) => i.key))
      cursor = a.body.page.next_cursor
    } while (cursor)
    expect(seen).toEqual(all)
  })

  it('refuses malformed, oversized or repeated parameters with the 422 envelope, all fields at once', async () => {
    stubFeed(FEED)
    const cases: Array<[string, Record<string, string>]> = [
      ['startups?limit=51', { limit: 'too_many' }],
      ['startups?limit=0&sort=score', { limit: 'invalid', sort: 'invalid' }],
      ['startups?limit=abc', { limit: 'invalid' }],
      ['startups?cursor=%24%24', { cursor: 'invalid' }],
      ['startups?cursor=forged', { cursor: 'invalid' }],
      [`startups?q=${'x'.repeat(121)}`, { q: 'too_long' }],
      ['startups?q=a%00b', { q: 'invalid' }],
      ['startups?q=a&q=b', { q: 'duplicate' }],
      [
        `startups?${Array.from({ length: 11 }, () => `domain_id=${LIBRARY_FX.domain.edtech}`).join('&')}`,
        { domain_id: 'too_many' },
      ],
      ['startups?domain_id=not-a-uuid', { domain_id: 'invalid' }],
      [
        'startups?owner_profile_id=x&visibility=PRIVATE',
        { owner_profile_id: 'not_accepted', visibility: 'not_accepted' },
      ],
      ['startups?%3Cscript%3E=1', { query: 'not_accepted' }],
      ['founders?sort=STAGE', { sort: 'invalid' }],
      ['problems?sort=STAGE&area=', { sort: 'invalid', area: 'invalid' }],
    ]
    for (const [path, fields] of cases) {
      const route = path.startsWith('startups')
        ? STARTUPS
        : path.startsWith('founders')
          ? FOUNDERS
          : PROBLEMS
      const a = await get(route, path)
      expect(refused(a), path).toEqual({ status: 422, code: 'PROFILE_VALIDATION_FAILED', fields })
      expect(JSON.stringify(a.body), path).not.toMatch(/stack|select |from |at \/|\.ts:/i)
    }
    // The largest page is served.
    expect((await get(PROBLEMS, 'problems?limit=50')).body.items.length).toBe(47)
  })

  it('an offset past the end is an empty last page', async () => {
    stubFeed(FEED)
    const far = Buffer.from('o:999999').toString('base64url')
    const a = await get(STARTUPS, `startups?q=WF06&cursor=${far}`)
    expect(a.body).toMatchObject({ items: [], page: { next_cursor: null } })
  })
})

describe('direct-id attempts and data exclusion', () => {
  it('a record id where a vocabulary id is expected is refused, never resolved', async () => {
    stubFeed(FEED)
    for (const id of [fx.ventures['WF06 Kín Đáo']!, fx.owners.hidden, fx.accounts.hidden]) {
      for (const [route, path] of [
        [STARTUPS, `startups?domain_id=${id}`],
        [STARTUPS, `startups?stage_id=${id}`],
        [FOUNDERS, `founders?domain_id=${id}`],
      ] as const) {
        const a = await get(route, path, 'stranger')
        expect(refused(a)).toMatchObject({ status: 422, code: 'PROFILE_VALIDATION_FAILED' })
        expect(JSON.stringify(a.body)).not.toContain('Kín Đáo')
      }
    }
  })

  it('no answer carries a record UUID, private field, e-mail, application or excluded venture', async () => {
    stubFeed(FEED)
    const bodies = [
      await get(STARTUPS, 'startups?q=WF06&limit=50', 'stranger'),
      await get(FOUNDERS, 'founders?q=WF06&limit=50', 'stranger'),
      await get(PROBLEMS, 'problems?limit=50', 'stranger'),
    ].map((a) => JSON.stringify(a.body))
    const vocabulary = new Set(
      (await query<{ id: string }>(`SELECT id::text FROM vocabulary_items`)).map((r) => r.id),
    )
    for (const text of bodies) {
      const uuids =
        text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []
      expect(uuids.filter((u) => !vocabulary.has(u.toLowerCase()))).toEqual([])
      for (const value of Object.values(FX_PRIVATE)) expect(text).not.toContain(value)
      expect(text).not.toMatch(
        /@example|wf06-fx-|"(answers?|application\w*|email|phone|full_name|owner\w*|account\w*|profile_id|slug|metadata|challenge\w*|headline|bio)"/,
      )
      for (const v of FX_EXCLUDED) expect(text).not.toContain(v.name)
    }
  })
})

describe('query count and determinism', () => {
  const statements = async (run: () => Promise<unknown>) => {
    const spy = vi.mocked(query)
    const before = spy.mock.calls.length
    await run()
    return spy.mock.calls.length - before
  }

  it('runs a fixed number of statements per request, whatever the row count (no N+1)', async () => {
    stubFeed(FEED)
    expect(await statements(() => get(STARTUPS, 'startups?q=WF06&limit=50'))).toBe(2)
    expect(await statements(() => get(FOUNDERS, 'founders?q=WF06&limit=50', 'stranger'))).toBe(6)
    expect(await statements(() => get(FOUNDERS, 'founders?q=WF06'))).toBe(0)
    expect(await statements(() => get(PROBLEMS, 'problems?limit=50'))).toBe(0)
    expect(await statements(() => get(STARTUPS, 'startups?limit=abc'))).toBe(0)
  })

  it('a fresh module instance (restart) gives the same order and pages', async () => {
    stubFeed(FEED)
    const before = await get(STARTUPS, 'startups?q=WF06&limit=5')
    vi.resetModules()
    globalThis.__hubStartupDirectory = undefined
    const fresh = (await import('@/app/api/v1/library/startups/route')).GET as Route
    const after = await get(fresh, 'startups?q=WF06&limit=5')
    expect(after.body).toEqual(before.body)
    const next = await get(fresh, `startups?q=WF06&limit=5&cursor=${before.body.page.next_cursor}`)
    const direct = await get(
      STARTUPS,
      `startups?q=WF06&limit=5&cursor=${before.body.page.next_cursor}`,
    )
    expect(next.body).toEqual(direct.body)
  })
})

describe('organization page bound (P3-4)', () => {
  it('lists the first 200 PUBLISHED children by name and counts them all', async () => {
    const [parent] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CHAPTER', 'wf06-fx-org-parent', 'WF06 Cha', 'PUBLISHED') RETURNING id::text`,
    )
    const children = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status)
       SELECT 'CLB', 'wf06-fx-org-child-' || lpad(g::text, 3, '0'), 'WF06 Con ' || lpad(g::text, 3, '0'),
              CASE WHEN g = 202 THEN 'DRAFT' ELSE 'PUBLISHED' END::publication_status
         FROM generate_series(1, 202) g RETURNING id::text`,
    )
    await query(
      `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type)
       SELECT $1::uuid, unnest($2::uuid[]), 'PARENT'`,
      [parent!.id, children.map((c) => c.id)],
    )
    const org = await getPublicOrganization('wf06-fx-org-parent')
    expect(org.children).toHaveLength(CHILDREN_LIMIT)
    expect(org.stats.children).toBe(201)
    expect(org.children[0]!.name).toBe('WF06 Con 001')
    expect(org.children.at(-1)!.name).toBe('WF06 Con 200')
    expect(JSON.stringify(org)).not.toContain('WF06 Con 202')
  })
})
