import { describe, expect, it } from 'vitest'

import { adaptStartups } from '@/lib/library/startup-adapter'

import type { LibraryProblem } from '@/lib/library/problem-adapter'

import { founderTab, matches, problemTab, startupTab } from './library-model'

/** TASK 24.1 — the white Startup and Nhà sáng lập cards (DEC-L15-D11…D13). */

const member = (ho_ten: string, vai_tro: string) => ({
  ho_ten,
  vai_tro,
  don_vi_lam_viec_hoc_tap: 'Trường X',
  kinh_nghiem_thanh_tich_khac: 'Kinh nghiệm riêng',
})
const record = (over: Record<string, unknown>) => ({
  ten_startup: 'Tracely',
  san_pham_chinh: 'Tracely Scan',
  linh_vuc: ['Logistics', 'AgriTech', 'Dữ liệu', 'IoT'],
  giai_doan_phat_trien: 'MVP',
  website: 'https://tracely.example.vn/',
  chuong_trinh_tung_tham_gia: ['Giải Nhì HUB Challenge 2024'],
  mo_ta_ngan: 'Truy vết chuỗi giao vận.',
  mo_ta_chi_tiet: 'Chi tiết',
  thanh_vien: [member('Đặng Kim Chi', 'Co-Founder, CEO'), member('Lê Cố Vấn', 'Cố vấn')],
  ...over,
})
const dir = {
  status: 'ok' as const,
  ...adaptStartups([
    record({}),
    record({ ten_startup: 'LogiSense', website: null, san_pham_chinh: null, thanh_vien: [] }),
    record({
      ten_startup: 'Kho Lạnh Miền Tây',
      san_pham_chinh: null,
      thanh_vien: [member('Võ Thanh Hà', 'Founder')],
    }),
  ]),
}

describe('startupTab', () => {
  const items = startupTab(dir).items!

  it('draws only what the source holds', () => {
    const [tracely] = items
    expect(tracely).toMatchObject({
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
    // No city, verification, needs or programmes: nothing of the kind is in the source.
    expect(JSON.stringify(tracely)).not.toMatch(/HUB Challenge|Đà Nẵng|xác minh|Đang cần/)
  })

  it('draws the marks as the frame does and stays inert without a website', () => {
    expect(items.map((i) => i.mark)).toEqual(['Tr', 'LS', 'KL'])
    expect(items[1]!.cta.href).toBeNull()
  })

  it('searches the product too, never founder names (DEC-W6P-D03)', () => {
    const hit = (q: string) => items.filter((i) => matches(i, q, {})).map((i) => i.title)
    expect(hit('tracely scan')).toEqual(['Tracely'])
    expect(hit('vo thanh ha')).toEqual([])
    expect(hit('co van')).toEqual([])
  })
})

describe('founderTab', () => {
  const items = founderTab(dir).items!

  it('shows name, short role and the startup row, and never a contact or experience', () => {
    const chi = items.find((i) => i.title === 'Đặng Kim Chi')!
    expect(chi).toMatchObject({
      kind: 'FOUNDER',
      mark: 'KC',
      pill: null,
      sub: 'Co-Founder · Tracely',
      chips: [],
      cta: { label: 'Xem hồ sơ', href: null },
    })
    expect(chi.row).toEqual({
      mark: 'Tr',
      name: 'Tracely',
      note: 'MVP',
      href: 'https://tracely.example.vn/',
    })
    expect(JSON.stringify(items)).not.toMatch(/Trường X|Kinh nghiệm riêng|Lê Cố Vấn/)
  })
})

describe('problemTab (WF06-PROD-02 location and content-type filters)', () => {
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

  it('filters by area (the temporary file’s location values) and by domain', () => {
    expect(hit({ area: ['Hà Nội'] })).toEqual(['a'])
    expect(hit({ area: ['Hà Nội', 'Đà Nẵng'] })).toEqual(['a', 'b'])
    expect(hit({ area: ['Hà Nội'], domain: ['Nông nghiệp'] })).toEqual([])
    // A problem without an area matches no area filter, and still lists unfiltered.
    expect(hit({})).toEqual(['a', 'b', 'c'])
  })

  it('keeps each tab to its own content type', () => {
    expect(tab.entity).toBe('PROBLEM')
    expect(tab.items!.every((i) => i.kind === 'PROBLEM')).toBe(true)
    expect(startupTab(dir).items!.every((i) => i.kind === 'STARTUP')).toBe(true)
    expect(founderTab(dir).items!.every((i) => i.kind === 'FOUNDER')).toBe(true)
  })
})
