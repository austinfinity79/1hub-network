import { describe, expect, it } from 'vitest'

import {
  duplicateRows,
  monthNow,
  parseMonthText,
  periodError,
  periodText,
  positionTitle,
  sortDeclarations,
  type PositionDeclaration,
} from './hub-position'

/** US-01.11 (S1-UAT-03): the rules of one HUB position declaration. */

const row = (over: Partial<PositionDeclaration>): PositionDeclaration => ({
  level: 'CHAPTER',
  organization_id: 'hn',
  position: 'MEMBER',
  board_name: null,
  position_other: null,
  from: '2024-01',
  to: null,
  current: true,
  ...over,
})

describe('months', () => {
  it('reads MM/YYYY and the current month in Việt Nam', () => {
    expect(parseMonthText('3/2024')).toBe('2024-03')
    expect(parseMonthText('03/2024')).toBe('2024-03')
    expect(parseMonthText('')).toBe('')
    expect(parseMonthText('13/2024')).toBeNull()
    expect(parseMonthText('2024-03')).toBeNull()
    // 31 Dec 18:00 UTC is already January in Việt Nam (UTC+7).
    expect(monthNow(new Date('2025-12-31T18:00:00Z'))).toBe('2026-01')
  })

  it('period errors: start required, end or current, no future, end not before start', () => {
    const now = '2026-10'
    expect(periodError({ from: null, to: null, current: true }, now)).toBe('from_required')
    expect(periodError({ from: '2024-01', to: null, current: false }, now)).toBe('to_required')
    expect(periodError({ from: '2026-11', to: null, current: true }, now)).toBe('future_month')
    expect(periodError({ from: '2024-01', to: '2026-11', current: false }, now)).toBe(
      'future_month',
    )
    expect(periodError({ from: '2024-05', to: '2024-04', current: false }, now)).toBe(
      'end_before_start',
    )
    expect(periodError({ from: '2026-10', to: null, current: true }, now)).toBeNull()
  })
})

describe('positions', () => {
  it('prints the title and the period', () => {
    expect(positionTitle(row({ position: 'HEAD_OF_BOARD', board_name: 'Truyền thông' }))).toBe(
      'Trưởng Ban Truyền thông',
    )
    expect(positionTitle(row({ position: 'OTHER', position_other: 'Cố vấn' }))).toBe('Cố vấn')
    expect(positionTitle(row({ position: 'VICE_CHAIR' }))).toBe('Phó Chủ tịch')
    expect(periodText(row({}))).toBe('01/2024 – Hiện tại')
    expect(periodText(row({ current: false, from: '2022-01', to: '2023-12' }))).toBe(
      '01/2022 – 12/2023',
    )
  })

  it('the same unit + position overlapping is a duplicate; another term or position is not', () => {
    const now = '2026-10'
    const earlier = row({ current: false, from: '2022-01', to: '2023-12' })
    expect(duplicateRows([earlier, row({ position: 'VICE_CHAIR' })], now)).toEqual([])
    expect(duplicateRows([earlier, row({})], now)).toEqual([])
    expect(duplicateRows([earlier, row({ from: '2023-12' })], now)).toEqual([1])
    expect(
      duplicateRows(
        [
          row({ position: 'HEAD_OF_BOARD', board_name: 'Truyền thông' }),
          row({ position: 'HEAD_OF_BOARD', board_name: 'Đối ngoại' }),
          row({ position: 'HEAD_OF_BOARD', board_name: ' truyền thông' }),
        ],
        now,
      ),
    ).toEqual([2])
  })

  it('orders HUB → Chapter → CLB; current first, then latest start', () => {
    const rows = [
      row({ level: 'CLB', organization_id: 'c' }),
      row({ level: 'CHAPTER', current: false, from: '2020-01', to: '2021-01' }),
      row({ level: 'CHAPTER', current: false, from: '2022-01', to: '2023-01' }),
      row({ level: 'CHAPTER', from: '2023-03' }),
      row({ level: 'HUB', organization_id: 'h' }),
    ]
    expect(sortDeclarations(rows).map((r) => [r.level, r.from])).toEqual([
      ['HUB', '2024-01'],
      ['CHAPTER', '2023-03'],
      ['CHAPTER', '2022-01'],
      ['CHAPTER', '2020-01'],
      ['CLB', '2024-01'],
    ])
  })
})
