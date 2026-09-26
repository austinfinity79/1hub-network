import { describe, expect, it } from 'vitest'

import { formatDemoDate, formatDemoDateRange } from './format'

describe('WF04 demo date display (Asia/Ho_Chi_Minh)', () => {
  it('formats a range, an open start / end and nothing', () => {
    expect(formatDemoDateRange('2026-09-01T02:00:00.000Z', '2026-12-15T10:00:00.000Z')).toBe(
      '01/09/2026 – 15/12/2026',
    )
    expect(formatDemoDateRange('2026-09-01T02:00:00.000Z', null)).toBe('Từ 01/09/2026')
    expect(formatDemoDateRange(null, '2027-01-31T10:00:00.000Z')).toBe('Đến 31/01/2027')
    expect(formatDemoDateRange(null, null)).toBe('—')
  })

  it('uses the Vietnam calendar day, not UTC', () => {
    expect(formatDemoDate('2026-09-30T16:59:00.000Z')).toBe('30/09/2026')
    expect(formatDemoDate('2026-09-30T17:00:00.000Z')).toBe('01/10/2026')
  })

  it('treats an unreadable value as absent', () => {
    expect(formatDemoDate('not a date')).toBeNull()
    expect(formatDemoDateRange('not a date', null)).toBe('—')
  })
})
