import { afterEach, describe, expect, it, vi } from 'vitest'

import { adaptStartups, categorise, cleanText, safeUrl, stageOf } from './startup-adapter'
import { loadStartupDirectory } from './startup-source'

/** TASK 22-PREVIEW-LIBRARY-FIX — startup.json adapter and source (DEC-L15-D7). */

const record = (over: Record<string, unknown> = {}) => ({
  ten_startup: 'PSI Lab',
  san_pham_chinh: null,
  linh_vuc: ['Logistics'],
  giai_doan_phat_trien: 'Growth',
  website: 'https://psilab.example.vn/',
  chuong_trinh_tung_tham_gia: [],
  mo_ta_ngan: 'Xe máy điện chở hàng.',
  mo_ta_chi_tiet: 'Chi tiết',
  thanh_vien: [
    {
      ho_ten: 'Nguyễn Tùng',
      vai_tro: 'Co-Founder',
      don_vi_lam_viec_hoc_tap: 'FTU',
      kinh_nghiem_thanh_tich_khac: null,
    },
    {
      ho_ten: 'Lê Cố Vấn',
      vai_tro: 'Cố vấn',
      don_vi_lam_viec_hoc_tap: null,
      kinh_nghiem_thanh_tich_khac: null,
    },
  ],
  ...over,
})

describe('adaptStartups', () => {
  it('maps the remote fields to the Library view model', () => {
    const { startups, founders } = adaptStartups([record()])
    expect(startups).toEqual([
      {
        id: 'psi-lab',
        name: 'PSI Lab',
        tagline: 'Xe máy điện chở hàng.',
        product: null,
        // Founder roles only, for search (DEC-L15-D13); the advisor is left out.
        founderNames: ['Nguyễn Tùng'],
        domains: ['Logistics'],
        categories: ['LOGISTICS'],
        stage: 'GROWTH',
        website: 'https://psilab.example.vn/',
        memberCount: 2,
      },
    ])
    // Founder roles only; no affiliation or experience is carried.
    expect(founders).toEqual([
      {
        id: 'nguyen-tung',
        name: 'Nguyễn Tùng',
        role: 'Co-Founder',
        startups: [{ name: 'PSI Lab', website: 'https://psilab.example.vn/', stage: 'GROWTH' }],
        categories: ['LOGISTICS'],
      },
    ])
  })

  it('rejects a non-list payload and skips unusable records', () => {
    expect(() => adaptStartups({ data: [] })).toThrow()
    expect(() => adaptStartups('<html>')).toThrow()
    const { startups } = adaptStartups([null, 42, {}, { ten_startup: '   ' }, record()])
    expect(startups.map((s) => s.name)).toEqual(['PSI Lab'])
  })

  it('drops members whose name carries contact data and strips contact data elsewhere', () => {
    const { startups, founders } = adaptStartups([
      record({
        mo_ta_ngan: 'Liên hệ a.b@example.com hoặc 0912 345 678 để biết thêm',
        thanh_vien: [{ ho_ten: 'An - 0912345678 - an@example.com', vai_tro: 'Founder' }],
      }),
    ])
    expect(startups[0]!.tagline).not.toMatch(/@|0912/)
    expect(founders).toEqual([])
  })

  it('deduplicates founders across startups and keeps unknown stages empty', () => {
    const { startups, founders } = adaptStartups([
      record({
        ten_startup: 'A',
        giai_doan_phat_trien: 'Seed?',
        thanh_vien: [{ ho_ten: 'Vũ Hiếu', vai_tro: 'Founder' }],
      }),
      record({
        ten_startup: 'B',
        linh_vuc: ['FinTech,AI'],
        thanh_vien: [{ ho_ten: 'Vũ Hiếu', vai_tro: 'Founder, CEO' }],
      }),
    ])
    expect(startups[0]!.stage).toBeNull()
    expect(startups[1]!.domains).toEqual(['FinTech', 'AI'])
    expect(founders).toHaveLength(1)
    expect(founders[0]!.startups.map((s) => s.name)).toEqual(['A', 'B'])
    expect(founders[0]!.categories).toEqual(expect.arrayContaining(['LOGISTICS', 'FINTECH', 'AI']))
  })

  it('maps stages to the Alpha vocabulary only where deterministic (DEC-2909-L2H2)', () => {
    const stages = [
      'Ideation',
      'idea',
      'MVP',
      'Pilot',
      'Selling',
      'Revenue',
      'Commercial',
      'Growth',
      'Scale-up',
      'Prototype',
      'Seed',
      null,
    ].map((v) => stageOf(v))
    expect(stages).toEqual([
      'IDEA',
      'IDEA',
      'MVP',
      'PILOT',
      'SELLING',
      'SELLING',
      'SELLING',
      'GROWTH',
      'GROWTH',
      null,
      null,
      null,
    ])
  })

  it('keeps unique ids for startups with the same name', () => {
    const { startups } = adaptStartups([record(), record()])
    expect(startups.map((s) => s.id)).toEqual(['psi-lab', 'psi-lab-2'])
  })
})

describe('safeUrl / cleanText / categorise', () => {
  it('accepts only absolute http(s) URLs without credentials', () => {
    expect(safeUrl('https://aidia.vn/')).toBe('https://aidia.vn/')
    expect(safeUrl('http://inverted-lambda.com')).toBe('http://inverted-lambda.com/')
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://a.vn',
      '//a.vn',
      'https://u:p@a.vn',
      'localhost',
      null,
      3,
    ])
      expect(safeUrl(bad)).toBeNull()
  })

  it('keeps markup as text and caps length', () => {
    expect(cleanText('<img src=x onerror=alert(1)>', 200)).toBe('<img src=x onerror=alert(1)>')
    expect(cleanText('x'.repeat(300), 10)).toHaveLength(10)
    expect(cleanText('  a \n  b ', 10)).toBe('a b')
  })

  it('maps free-text domains to the filter categories', () => {
    expect(categorise(['Logistic'])).toEqual(['LOGISTICS'])
    expect(categorise(['Công nghệ tài chính'])).toEqual(['FINTECH'])
    expect(categorise(['HealthTech'])).toEqual(['HEALTH'])
    expect(categorise(['Agricultural Technology'])).toEqual(['AGRI'])
    expect(categorise(['Ed-Tech'])).toEqual(['EDU'])
    expect(categorise(['Trí tuệ nhân tạo'])).toEqual(['AI'])
    expect(categorise(['Giải trí'])).toEqual(['OTHER'])
    expect(categorise([])).toEqual(['OTHER'])
  })
})

describe('loadStartupDirectory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.__hubStartupDirectory = undefined
  })

  it('caches one fetch per TTL and serves an error state when the source fails', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([record()]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const first = await loadStartupDirectory(0)
    const second = await loadStartupDirectory(1000)
    expect(first.status).toBe('ok')
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    globalThis.__hubStartupDirectory = undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 })),
    )
    expect(await loadStartupDirectory()).toEqual({ status: 'error' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    )
    expect(await loadStartupDirectory()).toEqual({ status: 'error' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new DOMException('timeout', 'TimeoutError'))),
    )
    expect(await loadStartupDirectory()).toEqual({ status: 'error' })
  })

  it('serves the last good copy when a refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([record()]), { status: 200 })),
    )
    const good = await loadStartupDirectory(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )
    const later = await loadStartupDirectory(Date.now() + 11 * 60 * 1000)
    expect(later).toBe(good)
  })
})
