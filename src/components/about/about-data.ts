/**
 * TASK 22-PREVIEW-ABOUT — content of the public About page (/about).
 *
 * Every string, number and label is transcribed from the approved About.zip
 * design pack (Sprint 1 · DL29, 28/09). Photos come from the "Ảnh About Hub"
 * pack (28/09, optimised to WebP in public/about); a slot with no supplied
 * photo keeps the pack's labelled placeholder ("ẢNH · …"). People carry the
 * name from their portrait file; roles and terms stay "Chờ cập nhật", and
 * activity fields the pack marks "Chờ cập nhật" stay that way.
 *
 * S1-UAT-08A: Humans of HUB, the HUB leads of the organisation diagram and the
 * representative activities now come from the PO workbook, transcribed
 * verbatim in about-source.ts. This file only presents it (trimming, line
 * breaks, date padding) and never corrects a fact; anomalies are reported in
 * docs/implementation/reports/S1-UAT-08A-about.md.
 *
 * DEMO-HOME-ABOUT-01: About v2 (DM02) keeps this data and drops the old
 * layout's own content (hero cards, missions, scale ring, org diagram).
 */

import { ACTIVITY_ROWS, HUMAN_ROWS, type ActivityRow, type HumanRow } from './about-source'

/** A supplied photo: path under public/, alt text, optional crop focus. */
export type PhotoAsset = { src: string; alt: string; focus?: string }

const about = (file: string, alt: string, focus?: string): PhotoAsset => ({
  src: `/about/${file}`,
  alt,
  ...(focus ? { focus } : {}),
})

export const HERO_STATS = [
  { value: '10.000+', label: 'thành viên' },
  { value: '13', label: 'HUB thành viên' },
  { value: '60+', label: 'cộng đồng và câu lạc bộ' },
  { value: '200+', label: 'đối tác trong hệ sinh thái' },
] as const

export const VALUES = [
  {
    letter: 'H',
    rest: 'uman-centric Innovation',
    text: 'Con người ở vị trí trung tâm của mọi đổi mới.',
  },
  {
    letter: 'U',
    rest: 'nlocking Network',
    text: 'Kích hoạt, phát huy tối đa sức mạnh của mạng lưới mối quan hệ, tạo giá trị cộng hưởng.',
  },
  {
    letter: 'B',
    rest: 'uild for Future',
    text: 'Kiến tạo giá trị bền vững, đóng góp vào sự phát triển chung của đất nước.',
  },
] as const

/**
 * Portraits of the "Ảnh About Hub" pack (28/09), named as their files were
 * supplied. A workbook person gets a portrait only when the full name matches
 * one of these exactly (ignoring case and diacritics); nothing is guessed.
 */
const PORTRAITS: Array<[name: string, file: string]> = [
  ['Bui Ha Phuong', 'bui-ha-phuong'],
  ['Dao Viet Tung', 'dao-viet-tung'],
  ['Doan Le Anh Thu', 'doan-le-anh-thu'],
  ['Doan Nhuan Phat', 'doan-nhuan-phat'],
  ['Huynh Dang Khoa', 'huynh-dang-khoa'],
  ['Huỳnh Đức', 'huynh-duc'],
  ['Lâm Mỹ Kỳ', 'lam-my-ky'],
  ['Le Dieu Anh', 'le-dieu-anh'],
  ['Le Duc Anh', 'le-duc-anh'],
  ['Le Mai Huong', 'le-mai-huong'],
  ['Le Phuong Thao', 'le-phuong-thao'],
  ['Mai Thao Bac Dung', 'mai-thao-bac-dung'],
  ['Ngo Tri Nguyen', 'ngo-tri-nguyen'],
  ['Nguyen Hoang Khanh', 'nguyen-hoang-khanh'],
  ['Nguyen Huy Hoang', 'nguyen-huy-hoang'],
  ['Nguyen Manh Hung', 'nguyen-manh-hung'],
  ['Nguyen Manh Tung', 'nguyen-manh-tung'],
  ['Nguyen Thanh Hien', 'nguyen-thanh-hien'],
  ['Nguyen Vu Ha Vy', 'nguyen-vu-ha-vy'],
  ['Pham Khanh Van', 'pham-khanh-van'],
  ['Pham Minh Hang', 'pham-minh-hang'],
  ['Phan Phuong', 'phan-phuong'],
  ['Phung Thi Ngoc Linh', 'phung-thi-ngoc-linh'],
  ['Phương Phương', 'phuong-phuong'],
  ['Thanh Long', 'thanh-long'],
  ['Tran Le Hung', 'tran-le-hung'],
  ['Tran Quang Hung', 'tran-quang-hung'],
  ['Tran Vy Dieu', 'tran-vy-dieu'],
  ['Vũ Bích Diệp', 'vu-bich-diep'],
  ['Vu Dinh Duc', 'vu-dinh-duc'],
  ['Vũ Minh Tâm', 'vu-minh-tam'],
  ['Vu Thu Hang', 'vu-thu-hang'],
  ['Vuong Bao Son', 'vuong-bao-son'],
  ['Vương Hữu Nam', 'vuong-huu-nam'],
  // PUBLIC-CONTENT-PUBLISH-01: the refreshed workbook's org-chart sheet
  // ("Thành viên HUB_Orgchart") ties these exact full names to their photos.
  ['Pham Thanh Long', 'pham-thanh-long'],
  ['Le Mai Anh', 'le-mai-anh'],
]

/** Case- and diacritic-insensitive key; đ/Đ fold to d. Presentation lookup only. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const PORTRAIT_BY_KEY = new Map(PORTRAITS.map(([name, file]) => [nameKey(name), file]))

export function portraitFor(name: string): PhotoAsset | null {
  const file = PORTRAIT_BY_KEY.get(nameKey(name))
  return file ? about(`humans/${file}.webp`, `Chân dung ${name}`, '50% 22%') : null
}

/** Presentation only: trims, and turns a line break inside a cell into a space. */
export function clean(value: string | null): string | null {
  if (value === null) return null
  const out = value
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return out || null
}

export type Human = {
  order: number
  name: string
  /** "Chức vụ" as written (trimmed); null shows "Chờ cập nhật". */
  title: string | null
  term: 'CURRENT' | 'PAST'
  photo: PhotoAsset | null
  /** The workbook's editing flag and org-chart link, kept for traceability. */
  edit: string | null
  orgLink: string | null
}

/** The workbook's current term; "Các thế hệ trước" rows marked "Bỏ" are dropped. */
const CURRENT_TERM = 'Nhiệm kỳ hiện tại'

export function humansFrom(rows: readonly HumanRow[]): Human[] {
  return rows
    .filter((r) => r.term.trim() === CURRENT_TERM && r.edit?.trim() !== 'Bỏ')
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      order: r.order,
      name: clean(r.name) ?? '',
      title: clean(r.title),
      term: 'CURRENT' as const,
      photo: portraitFor(r.name),
      edit: clean(r.edit),
      orgLink: clean(r.orgLink),
    }))
}

export const HUMANS: Human[] = humansFrom(HUMAN_ROWS)

export type Milestone = {
  when: string
  /** Year shown by the sticky counter. */
  year: string
  title: string
  caption: string
  /** Absent: no supplied photo, the placeholder stays. */
  photo?: PhotoAsset
  places: string[]
  badge?: string
  items?: string[]
  tone: 'warm' | 'deep' | 'dark'
}

export const MILESTONES: Milestone[] = [
  {
    when: '2021',
    year: '2021',
    title: 'HUB Network được thành lập tại TP. Hà Nội.',
    caption: 'ẢNH · DẤU ẤN 2021',
    photo: about('milestone-2021.webp', 'Thành viên HUB Network, dấu ấn năm 2021'),
    places: ['Hà Nội'],
    tone: 'warm',
  },
  {
    when: '2023',
    year: '2023',
    title: 'Mở rộng hoạt động tại TP. Hồ Chí Minh.',
    caption: 'ẢNH · DẤU ẤN 2023',
    photo: about('milestone-2023.webp', 'Sự kiện HUB Forum, dấu ấn năm 2023'),
    places: ['TP. Hồ Chí Minh'],
    tone: 'dark',
  },
  {
    when: '2024',
    year: '2024',
    title:
      'Mở rộng tới TP. Đà Nẵng và phát triển mạng lưới quốc tế tại Singapore, Trung Quốc đại lục, Úc, Vương quốc Anh và Hoa Kỳ.',
    caption: 'ẢNH · DẤU ẤN 2024',
    photo: about('milestone-2024.webp', 'HUB Summit 2024'),
    places: ['Đà Nẵng', 'Singapore', 'Trung Quốc đại lục', 'Úc', 'Vương quốc Anh', 'Hoa Kỳ'],
    tone: 'deep',
  },
  {
    when: '2025',
    year: '2025',
    title:
      'Tiếp tục mở rộng mạng lưới quốc tế tại UAE, châu Âu và mở rộng tệp thành viên là học sinh THPT (HUB HighSchool).',
    caption: 'ẢNH · DẤU ẤN 2025',
    photo: about('milestone-2025.webp', 'Trao quyết định thành lập HUB Network HighSchool'),
    places: ['UAE', 'Châu Âu', 'HUB HighSchool'],
    tone: 'warm',
  },
  {
    when: '11 · 2025',
    year: '2025',
    title:
      'Được chấp thuận chủ trương thành lập Mạng lưới Đổi mới sáng tạo Dữ liệu HUB NDA thuộc Ban Đoàn – Hội, Hiệp hội Dữ liệu Quốc gia, trên cơ sở kế thừa bộ máy nhân sự và năng lực tổ chức của HUB Network.',
    caption: 'ẢNH · DẤU ẤN 11 · 2025',
    // PUBLIC-CONTENT-PUBLISH-01: the refreshed "Dấu ấn" folder's file
    // "About Hub - dấu ấn - 11/2025 - Cột mốc thể chế".
    photo: about('milestone-2025-11.webp', 'Dấu ấn 11/2025, cột mốc thể chế'),
    places: [],
    badge: 'Cột mốc thể chế',
    tone: 'dark',
  },
  {
    when: '2026',
    year: '2026',
    title: 'Một năm của những bước đi mới',
    caption: 'ẢNH · DẤU ẤN 2026',
    photo: about(
      'milestone-2026.webp',
      'Công bố Mạng lưới CLB Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số Thủ đô HUB Network',
    ),
    places: ['Quảng Ninh'],
    items: [
      'Thành lập Mạng lưới HUB Business.',
      'Tham gia sâu cùng hệ sinh thái đổi mới sáng tạo Hà Nội: gia nhập Hội Doanh nghiệp trẻ Hà Nội; ký kết hợp tác chiến lược với Công ty Cổ phần Trung tâm Đổi mới sáng tạo Hà Nội.',
      'Mở rộng mạng lưới tại TP. Quảng Ninh.',
      'Tiếp tục hành trình kết nối cộng đồng các khu vực trong nước, quốc tế.',
    ],
    tone: 'warm',
  },
]

export type ActivityKind = 'CUOC_THI' | 'SU_KIEN' | 'CHUOI_SU_KIEN' | 'CHUONG_TRINH'

const KIND_BY_TAG: Record<string, ActivityKind> = {
  'Cuộc thi': 'CUOC_THI',
  'Sự kiện': 'SU_KIEN',
  'Chuỗi sự kiện': 'CHUOI_SU_KIEN',
  'Chương trình': 'CHUONG_TRINH',
}

export type Activity = {
  row: number
  /** Null for a Tag the page has no filter for: shown under "Tất cả" with its own label. */
  kind: ActivityKind | null
  tagLabel: string
  title: string
  photo: PhotoAsset | null
  /** Display date: a valid single D/M/YYYY is zero-padded; anything else is shown as written. */
  time: string | null
  /** False when the cell is not a real calendar date or range (shown as written, reported). */
  dateValid: boolean
  organisers: string[]
  location: string | null
  hubRole: string | null
}

const SINGLE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function realDate(d: number, m: number, y: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** "9/1/2026" → "09/01/2026"; a range or anything unusual is returned as written. */
export function displayDate(raw: string | null): { time: string | null; valid: boolean } {
  const value = clean(raw)
  if (!value) return { time: null, valid: true }
  const single = SINGLE.exec(value)
  if (single) {
    const [d, m, y] = [Number(single[1]), Number(single[2]), Number(single[3])]
    if (!realDate(d, m, y)) return { time: value, valid: false }
    return { time: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`, valid: true }
  }
  // Ranges ("15-16/08/2026", "18/8 - 19/8/2026", "28/08/2026 - 30/08/2026") stay as written;
  // every day / month number in them must still be plausible.
  const numbers = [...value.matchAll(/(\d{1,2})\/(\d{1,2})/g)]
  const valid = numbers.every(
    (n) => Number(n[1]) >= 1 && Number(n[1]) <= 31 && Number(n[2]) >= 1 && Number(n[2]) <= 12,
  )
  return { time: value, valid }
}

export function activitiesFrom(rows: readonly ActivityRow[]): Activity[] {
  return rows.map((r) => {
    const title = clean(r.title) ?? ''
    const { time, valid } = displayDate(r.date)
    const tag = clean(r.tag) ?? ''
    return {
      row: r.row,
      kind: KIND_BY_TAG[tag] ?? null,
      tagLabel: tag.toUpperCase(),
      title,
      photo: r.imageId
        ? about(`activities/activity-${String(r.row).padStart(2, '0')}.webp`, title)
        : null,
      time,
      dateValid: valid,
      organisers: (r.organiser ?? '')
        .split('\n')
        .map((line) => clean(line))
        .filter((line): line is string => Boolean(line)),
      location: clean(r.location),
      hubRole: clean(r.hubRole),
    }
  })
}

/** All 43 workbook rows, in the workbook's own order. */
export const ACTIVITIES: Activity[] = activitiesFrom(ACTIVITY_ROWS)
