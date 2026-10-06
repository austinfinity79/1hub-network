import { describe, expect, it } from 'vitest'

import { ACTIVITIES, HUMANS, activitiesFrom, displayDate, humansFrom, nameKey } from './about-data'
import { ACTIVITY_ROWS, HUMAN_ROWS } from './about-source'

/** S1-UAT-08A — the About content mapped from the PO workbook, nothing invented. */

describe('Humans of HUB', () => {
  it('shows the 34 current-term people, in the workbook order 1 … 34', () => {
    expect(HUMAN_ROWS).toHaveLength(36)
    expect(HUMANS).toHaveLength(34)
    expect(HUMANS.map((h) => h.order)).toEqual(Array.from({ length: 34 }, (_, i) => i + 1))
    expect(HUMANS[0]).toMatchObject({ name: 'Trần Quang Hưng', title: 'Chủ tịch HUB Network Tổng' })
    expect(HUMANS.at(-1)).toMatchObject({
      name: 'Trần T. Bích Ngọc',
      // A line break inside the cell is presented as a space; the words are the workbook's.
      title: 'Phó Chủ tịch phụ trách HUB Network Business Đà Nẵng',
    })
    expect(HUMANS.every((h) => h.term === 'CURRENT')).toBe(true)
  })

  it('drops the two "Các thế hệ trước" rows marked "Bỏ"', () => {
    const names = HUMANS.map((h) => h.name)
    expect(names).not.toContain('Ngô Trí Nguyên')
    expect(names).not.toContain('Phùng Thị Ngọc Linh')
  })

  it('keeps titles and editing flags exactly as written (trimmed only)', () => {
    const khoa = HUMANS.find((h) => h.name === 'Huỳnh Đăng Khoa')!
    expect(khoa.title).toBe('Phó Chủ tịch HUB Network Đà Nẵng')
    // Both UAE rows keep the same title: the duplicate is reported, not corrected.
    expect(HUMANS.filter((h) => h.title === 'Chủ tịch HUB Network UAE').map((h) => h.name)).toEqual(
      ['Lê Diệu Anh', 'Lâm Mỹ Kỳ'],
    )
    expect(HUMANS.filter((h) => h.edit === 'Bổ sung')).toHaveLength(4)
  })

  it('a portrait only for an exact name match; nothing guessed', () => {
    expect(HUMANS.find((h) => h.name === 'Bùi Hà Phương')!.photo?.src).toBe(
      '/about/humans/bui-ha-phuong.webp',
    )
    for (const name of ['Phạm Thành Long', 'Lê Mai Anh', 'Trần T. Bích Ngọc']) {
      expect(HUMANS.find((h) => h.name === name)!.photo, name).toBeNull()
    }
    expect(HUMANS.filter((h) => h.photo).length).toBe(31)
    expect(nameKey('Đào Việt Tùng')).toBe(nameKey('Dao Viet Tung'))
  })

  it('a malformed row never crashes and an unknown term is not shown', () => {
    expect(
      humansFrom([
        {
          order: 2,
          name: '  B  ',
          title: null,
          term: 'Nhiệm kỳ hiện tại',
          edit: null,
          orgLink: null,
        },
        { order: 1, name: 'A', title: 'X', term: 'Khác', edit: null, orgLink: null },
      ]),
    ).toEqual([expect.objectContaining({ order: 2, name: 'B', title: null, photo: null })])
  })
})

describe('representative activities', () => {
  it('renders all 43 workbook rows, in the workbook order, with their own images', () => {
    expect(ACTIVITY_ROWS).toHaveLength(43)
    expect(ACTIVITIES).toHaveLength(43)
    expect(ACTIVITIES.map((a) => a.row)).toEqual(Array.from({ length: 43 }, (_, i) => i + 1))
    expect(ACTIVITIES[0]).toMatchObject({
      title: 'UNIVERSITY MEETUP #2 DUE',
      kind: 'SU_KIEN',
      time: '09/01/2026',
      organisers: ['Cardano Vietnam', 'HUB Network Đà Nẵng'],
      hubRole: 'Đơn vị tổ chức',
      photo: { src: '/about/activities/activity-01.webp' },
    })
    expect(ACTIVITIES.every((a) => a.photo !== null)).toBe(true)
  })

  it('never carries the omitted "Link liên quan (bỏ)" column', () => {
    expect(JSON.stringify(ACTIVITY_ROWS)).not.toMatch(/facebook|https?:/)
    expect(JSON.stringify(ACTIVITIES)).not.toMatch(/facebook/)
  })

  it('missing location / HUB role stay empty, never invented', () => {
    expect(ACTIVITIES.filter((a) => a.location === null).map((a) => a.row)).toEqual([10, 15])
    expect(ACTIVITIES.filter((a) => a.hubRole === null).map((a) => a.row)).toEqual([34, 39])
  })

  it('dates: single dates zero-padded, ranges as written, "21/22/2024" shown and flagged', () => {
    expect(displayDate('30/6/2025')).toEqual({ time: '30/06/2025', valid: true })
    expect(displayDate('15-16/08/2026')).toEqual({ time: '15-16/08/2026', valid: true })
    expect(displayDate('21/22/2024')).toEqual({ time: '21/22/2024', valid: false })
    expect(ACTIVITIES.filter((a) => !a.dateValid).map((a) => a.row)).toEqual([36])
  })

  it('tags: "Chuỗi sự kiện" gets its own filter; an unknown tag still renders', () => {
    expect(ACTIVITIES.filter((a) => a.kind === 'CHUOI_SU_KIEN')).toHaveLength(3)
    const [odd] = activitiesFrom([
      {
        row: 1,
        title: ' X ',
        imageId: null,
        tag: 'Khác',
        date: null,
        organiser: null,
        location: null,
        hubRole: null,
      },
    ])
    expect(odd).toMatchObject({
      kind: null,
      tagLabel: 'KHÁC',
      title: 'X',
      photo: null,
      organisers: [],
    })
  })
})
