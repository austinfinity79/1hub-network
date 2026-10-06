import { HUMANS, MILESTONES, type Human } from './about-data'

/**
 * DEMO-HOME-ABOUT-01 — About v2 presentation of the HUB network.
 *
 * - REGIONAL_HUBS: the 11 HUB Khu vực of the canonical catalogue (13 Chapters
 *   minus HUB HighSchool and HUB Business, which are not regional), in the
 *   order DM04 draws its chips, with the short labels of DM02 / DM04. The map
 *   point of each is one representative city, placed where the frame draws
 *   its marker (demo-safe mapping; DM02 draws no China marker, Beijing is
 *   used). A catalogue chapter missing here is simply not on the map.
 * - Boards: the S1-UAT-08A workbook people (HUMANS) assigned to their HUB by
 *   workbook row number, never by guessing from a name; titles as written.
 */

export type RegionalHub = {
  slug: string
  code: string
  short: string
  place: string
  since: string
  lon: number
  lat: number
  /** Workbook rows: the chair first, then the deputies as listed. */
  board: number[]
}

export const REGIONAL_HUBS: RegionalHub[] = [
  {
    slug: 'hub-network-ha-noi',
    code: 'HN',
    short: 'HUB Hà Nội',
    place: 'TP. Hà Nội, Việt Nam',
    since: '2021',
    lon: 105.85,
    lat: 21.03,
    board: [9, 32, 33],
  },
  {
    slug: 'hub-network-ho-chi-minh',
    code: 'HCM',
    short: 'HUB TP.HCM',
    place: 'TP. Hồ Chí Minh, Việt Nam',
    since: '2023',
    lon: 106.7,
    lat: 10.8,
    board: [7, 25, 28],
  },
  {
    slug: 'hub-network-da-nang',
    code: 'DN',
    short: 'HUB Đà Nẵng',
    place: 'TP. Đà Nẵng, Việt Nam',
    since: '2024',
    lon: 108.2,
    lat: 16.05,
    board: [8, 34, 15, 16],
  },
  {
    slug: 'hub-network-quang-ninh',
    code: 'QN',
    short: 'HUB Quảng Ninh',
    place: 'TP. Quảng Ninh, Việt Nam',
    since: '2026',
    lon: 107.08,
    lat: 20.95,
    board: [],
  },
  {
    slug: 'hub-network-singapore',
    code: 'SG',
    short: 'HUB Singapore',
    place: 'Singapore',
    since: '2024',
    lon: 103.82,
    lat: 1.35,
    board: [24],
  },
  {
    slug: 'hub-network-trung-quoc-china',
    code: 'CN',
    short: 'HUB Trung Quốc',
    place: 'Trung Quốc đại lục',
    since: '2024',
    lon: 116.4,
    lat: 39.9,
    board: [19, 20],
  },
  {
    slug: 'hub-network-uc-australia',
    code: 'AU',
    short: 'HUB Úc',
    place: 'Úc',
    since: '2024',
    lon: 151.2,
    lat: -33.87,
    board: [26, 27],
  },
  {
    slug: 'hub-network-vuong-quoc-anh-uk',
    code: 'UK',
    short: 'HUB Vương quốc Anh',
    place: 'Vương quốc Anh',
    since: '2024',
    lon: -0.13,
    lat: 51.5,
    board: [21, 22, 23],
  },
  {
    slug: 'hub-network-hoa-ky-usa',
    code: 'US',
    short: 'HUB Hoa Kỳ',
    place: 'Hoa Kỳ',
    since: '2024',
    lon: -74.0,
    lat: 40.7,
    board: [13, 14],
  },
  {
    slug: 'hub-network-cac-tieu-vuong-quoc-a-rap-thong-nhat-uae',
    code: 'UAE',
    short: 'HUB UAE',
    place: 'UAE',
    since: '2025',
    lon: 55.3,
    lat: 25.2,
    board: [17, 18],
  },
  {
    slug: 'hub-network-chau-au-eu',
    code: 'EU',
    short: 'HUB Châu Âu',
    place: 'Châu Âu',
    since: '2025',
    lon: 13.4,
    lat: 52.5,
    board: [29, 30, 31],
  },
]

/** The Hoàng Sa and Trường Sa archipelagos of Viet Nam, always drawn and labelled. */
export const ARCHIPELAGOS = [
  { name: 'Hoàng Sa', lon: 112.0, lat: 16.5 },
  { name: 'Trường Sa', lon: 114.2, lat: 10.0 },
] as const

/** HUB Tổng as DM02 draws it: chair, deputies (in the frame's order), advisor, boards. */
export const HUB_TONG = {
  chair: 1,
  deputies: [2, 9, 8, 7, 6, 4, 5, 10],
  advisors: [3],
  boards: [
    { name: 'Ban Quan hệ công chúng', lead: 11 },
    { name: 'Ban Truyền thông', lead: 12 },
  ],
} as const

const BY_ORDER = new Map(HUMANS.map((h) => [h.order, h]))

export function person(order: number): Human | null {
  return BY_ORDER.get(order) ?? null
}

export function people(orders: readonly number[]): Human[] {
  return orders.map(person).filter((h): h is Human => h !== null)
}

/** THAO-04: the public page of a catalogue unit (HUB Chapter or CLB). */
export function unitHref(slug: string): string {
  return `/organizations/${slug}`
}

/** "Vũ Minh Tâm" → "VT": first and last word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return (
    (words[0]?.charAt(0) ?? '') + (words.length > 1 ? words[words.length - 1]!.charAt(0) : '')
  ).toLocaleUpperCase('vi')
}

/** Every place of the milestone timeline with the year it joined (DM02 chips). */
export const PLACE_SINCE: Array<{ place: string; year: string }> = [
  ...MILESTONES.flatMap((m) => m.places.map((place) => ({ place, year: m.year }))),
  // 2026 lists HUB Business among its items, not its places.
  { place: 'HUB Business', year: '2026' },
].filter((p, i, all) => all.findIndex((q) => q.place === p.place) === i)
