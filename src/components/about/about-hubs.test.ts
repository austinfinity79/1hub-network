import { describe, expect, it } from 'vitest'

import { markOf, tileOf } from '@/lib/public/home-data'

import { HUMANS } from './about-data'
import {
  ARCHIPELAGOS,
  HUB_TONG,
  PLACE_SINCE,
  REGIONAL_HUBS,
  initials,
  people,
  unitHref,
} from './about-hubs'
import { VIETNAM_VIEW, WORLD_VIEW, project } from './about-map-geo'

/** DEMO-HOME-ABOUT-01 — About v2 presentation of the HUB network (DM02–DM05). */
describe('regional HUBs and boards', () => {
  it('lists the 11 regional HUBs once each, in the DM04 chip order', () => {
    expect(REGIONAL_HUBS.map((h) => h.code)).toEqual([
      'HN',
      'HCM',
      'DN',
      'QN',
      'SG',
      'CN',
      'AU',
      'UK',
      'US',
      'UAE',
      'EU',
    ])
    expect(new Set(REGIONAL_HUBS.map((h) => h.slug)).size).toBe(11)
  })

  it('assigns every current-term workbook person exactly once (HUB Tổng or one HUB)', () => {
    const used = [
      HUB_TONG.chair,
      ...HUB_TONG.deputies,
      ...HUB_TONG.advisors,
      ...HUB_TONG.boards.map((b) => b.lead),
      ...REGIONAL_HUBS.flatMap((h) => h.board),
    ]
    // Rows 7, 8, 9 chair a HUB and sit on HUB Tổng: counted twice by design.
    const twice = [7, 8, 9]
    expect(new Set(used).size).toBe(HUMANS.length)
    expect(used.length).toBe(HUMANS.length + twice.length)
    expect(used.filter((o) => twice.includes(o))).toHaveLength(6)
  })

  it('keeps titles as written: the Đà Nẵng board is the workbook rows 8, 34, 15, 16', () => {
    const dn = REGIONAL_HUBS.find((h) => h.code === 'DN')!
    expect(people(dn.board).map((p) => p.name)).toEqual([
      'Phạm Khánh Vân',
      'Trần T. Bích Ngọc',
      'Đoàn Lê Anh Thư',
      'Huỳnh Đăng Khoa',
    ])
    expect(people([8])[0]!.title).toBe('Phó Chủ tịch HUB Tổng kiêm Chủ tịch HUB Network Đà Nẵng')
  })

  it('initials from first and last word', () => {
    expect(initials('Vũ Minh Tâm')).toBe('VT')
    expect(initials('Huỳnh Đức')).toBe('HĐ')
  })

  it('timeline places carry the year they joined, 13 in all', () => {
    expect(PLACE_SINCE).toHaveLength(13)
    expect(PLACE_SINCE.filter((p) => p.year <= '2024')).toHaveLength(8)
    expect(PLACE_SINCE.at(-1)).toEqual({ place: 'HUB Business', year: '2026' })
  })
})

describe('map projection', () => {
  it('places the world markers where DM02 draws them (within 4 px of the 1312 × 640 card)', () => {
    // Marker centres measured on the frame (London, Singapore, Sydney).
    const drawn: Array<[number, number, number, number]> = [
      [-0.13, 51.5, 612.5, 208.3],
      [103.82, 1.35, 992.2, 409.7],
      [151.2, -33.87, 1165.2, 543.5],
    ]
    for (const [lon, lat, x, y] of drawn) {
      const p = project(WORLD_VIEW, lon, lat)!
      expect(Math.abs((p.x / 100) * 1312 - x)).toBeLessThan(4)
      expect(Math.abs((p.y / 100) * 640 - y)).toBeLessThan(4)
    }
  })

  it('links a catalogue unit to its public page by slug (THAO-04)', () => {
    expect(unitHref('hub-network-da-nang')).toBe('/organizations/hub-network-da-nang')
    expect(unitHref('clb-da-nang-clb-khoi-nghiep-kinh-te')).toBe(
      '/organizations/clb-da-nang-clb-khoi-nghiep-kinh-te',
    )
  })

  it('shows Hoàng Sa and Trường Sa in both views', () => {
    for (const a of ARCHIPELAGOS) {
      expect(project(WORLD_VIEW, a.lon, a.lat)).not.toBeNull()
      expect(project(VIETNAM_VIEW, a.lon, a.lat)).not.toBeNull()
    }
  })
})

describe('homepage product marks', () => {
  it('row marks use capitals or word initials; tiles the first two letters', () => {
    expect(markOf('Tracely')).toBe('TR')
    expect(markOf('LogiSense')).toBe('LS')
    expect(markOf('Kho Lạnh Miền Tây')).toBe('KL')
    expect(tileOf('LogiSense')).toBe('LO')
    expect(tileOf('Kho Lạnh Miền Tây')).toBe('KH')
  })
})
