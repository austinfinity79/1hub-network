import { describe, expect, it } from 'vitest'

import { problemTab, sortItems } from '@/components/library/library-model'

import dataset from './dir-bai-toan.json'
import { PROBLEM_STAGES, adaptProblems } from './problem-adapter'
import { LIBRARY_PROBLEMS } from './problem-source'

/** LIBRARY DATA UPDATE — the "Bài toán" tab runs on the supplied problem dataset. */

type Raw = (typeof dataset.problems)[number]
const raw: Raw[] = dataset.problems
const base = raw[0]!
const one = (over: Record<string, unknown>) =>
  adaptProblems({ problems: [{ ...base, ...over }] })[0]

const distinct = (lists: string[][]) => new Set(lists.flat())

describe('adaptProblems', () => {
  it('keeps every supplied problem, in order, with its text unchanged', () => {
    expect(LIBRARY_PROBLEMS).toHaveLength(raw.length)
    expect(LIBRARY_PROBLEMS.map((p) => p.id)).toEqual(raw.map((p) => p.id))
    for (const [i, p] of LIBRARY_PROBLEMS.entries()) {
      const r = raw[i]!
      expect(p.title).toBe(r.ten)
      expect(p.shortTitle).toBe(r.ten_ngan)
      expect(p.summary).toBe(r.mo_ta_ngan)
      expect(p.org).toBe(r.owner_org.ten)
      expect(p.stage).toBe(r.giai_doan)
      expect(p.stageLabel).toBe(r.giai_doan_hien_thi)
      expect(p.time).toBe(r.thoi_gian_hien_thi)
      expect(p.domains).toEqual(r.tags.linh_vuc)
      expect(p.areas).toEqual(r.tags.dia_ban)
      expect(p.cover).toBe(r.bia_dai_mau_id)
      expect(p.challengeId).toBe(r.challenge_id)
    }
  })

  it('invents nothing for a missing prize, deadline or team count', () => {
    for (const [i, p] of LIBRARY_PROBLEMS.entries()) {
      const r = raw[i]!
      if (r.giai_thuong === null) expect(p.prize).toBeNull()
      if (r.so_doi_du_kien === null) expect(p.teams).toBeNull()
      if (r.han_nop === null) expect(p.deadline).toBeNull()
    }
    expect(one({ giai_thuong: null, giai_thuong_hien_thi: 'Đang đàm phán' })!.prize).toBeNull()
    expect(one({ giai_thuong: 50_000_000, giai_thuong_hien_thi: '—' })!.prize).toBeNull()
    expect(one({ giai_thuong: 50_000_000, giai_thuong_hien_thi: '50 triệu' })).toMatchObject({
      prize: '50 triệu',
      prizeValue: 50_000_000,
    })
    expect(one({ so_doi_du_kien: 12 })!.teams).toBe('12 đội')
    expect(one({ han_nop: '2026-11-30' })!.deadline).toBe(Date.UTC(2026, 10, 30) / 86_400_000)
    expect(one({ han_nop: '2026-11-30' })!.time).toBe(base.thoi_gian_hien_thi)
  })

  it('drops records without an id or a title, and repeated ids', () => {
    const problems = [base, { ...base }, { ...base, id: 'x-2', ten: ' ' }, { ...base, id: null }]
    expect(adaptProblems({ problems }).map((p) => p.id)).toEqual([base.id])
    expect(adaptProblems(null)).toEqual([])
    expect(adaptProblems({ problems: 'nope' })).toEqual([])
  })
})

describe('problemTab', () => {
  const tab = problemTab(LIBRARY_PROBLEMS)
  const group = (key: string) => tab.groups.find((g) => g.key === key)!

  it('counts every record and builds the facets from the data', () => {
    expect(tab.items).toHaveLength(raw.length)
    expect(new Set(group('domain').values.map((v) => v.value))).toEqual(
      distinct(raw.map((p) => p.tags.linh_vuc)),
    )
    expect(new Set(group('area').values.map((v) => v.value))).toEqual(
      distinct(raw.map((p) => p.tags.dia_ban)),
    )
    expect(group('stage').values).toEqual(PROBLEM_STAGES)
    // The removed demo fixture's facets are gone.
    expect(group('area').values.map((v) => v.value)).not.toContain('TP.HCM')
    expect(tab.items!.map((i) => i.title)).not.toContain('Giảm hao hụt trong chặng giao cuối')
  })

  it('renders only supplied values on the card', () => {
    for (const [i, item] of tab.items!.entries()) {
      const r = raw[i]!
      expect(item.head).toBe(r.owner_org.ten)
      expect(item.pill).toBe(r.giai_doan_hien_thi)
      expect(item.prize).toBeNull()
      expect(item.meta).toEqual([r.thoi_gian_hien_thi])
      expect(item.mark).toBe('')
      expect(item.cta.href).toBeNull()
    }
    const tones = ['coral', 'wine', 'ember', 'ash', 'red', 'smoke']
    expect(tab.items!.map((i) => i.tone)).toEqual(raw.map((p) => tones[p.bia_dai_mau_id - 1]))
  })

  it('sorts deterministically when deadlines and prizes are missing', () => {
    const ids = raw.map((p) => p.id)
    expect(sortItems(tab.items!, 'DEADLINE').map((i) => i.id)).toEqual(ids)
    expect(sortItems(tab.items!, 'PRIZE').map((i) => i.id)).toEqual(ids)
  })

  it('keeps the hero chips and matches them to the problem tags by label', () => {
    expect(tab.quick.map((q) => q.label)).toEqual([
      'Logistics',
      'Tài chính số',
      'Nông nghiệp',
      'AI',
      'Y tế',
    ])
    expect(tab.quick.every((q) => q.value === q.label)).toBe(true)
  })
})
