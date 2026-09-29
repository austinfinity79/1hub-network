import { describe, expect, it } from 'vitest'

import { currentMonth, durationText, monthsBetween } from './profile-model'

describe('FP1-OWN experience durations', () => {
  it('counts both months, as the board does', () => {
    // The three records of the FP1-OWN board, drawn in 09/2026.
    expect(durationText(monthsBetween('2024-02', '2026-09'))).toBe('2 năm 8 tháng')
    expect(durationText(monthsBetween('2019-06', '2024-01'))).toBe('4 năm 8 tháng')
    expect(durationText(monthsBetween('2016-08', '2019-05'))).toBe('2 năm 10 tháng')
    expect(durationText(monthsBetween('2025-03', '2025-03'))).toBe('1 tháng')
    expect(durationText(monthsBetween('2025-01', '2025-12'))).toBe('1 năm')
  })

  it('takes the current month in Việt Nam, not in UTC', () => {
    // 00:30 on 1 October in Hồ Chí Minh City is still 30 September in UTC.
    expect(currentMonth(new Date('2026-09-30T17:30:00Z'))).toBe('2026-10')
    expect(currentMonth(new Date('2026-09-30T16:59:00Z'))).toBe('2026-09')
  })
})
