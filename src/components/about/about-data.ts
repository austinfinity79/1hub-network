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
 */

import { ACTIVITY_ROWS, HUMAN_ROWS, type ActivityRow, type HumanRow } from './about-source'

/** A supplied photo: path under public/, alt text, optional crop focus. */
export type PhotoAsset = { src: string; alt: string; focus?: string }

const about = (file: string, alt: string, focus?: string): PhotoAsset => ({
  src: `/about/${file}`,
  alt,
  ...(focus ? { focus } : {}),
})

export type HubCode =
  'HN' | 'HCM' | 'DN' | 'SG' | 'CN' | 'AU' | 'UK' | 'US' | 'UAE' | 'EU' | 'QN' | 'THPT' | 'BIZ'

export type Hub = {
  code: HubCode
  /** Short label inside the node. */
  short: string
  /** Region label on the organisation diagram and in the detail panel. */
  region: string
  /** Name used by the "network scale" ring (section 04), where it differs. */
  ringShort?: string
  /** Year of the milestone that introduced this HUB (section 06). */
  since: string
  /** Dashed outline: a network of a different kind (HUB Business). */
  dashed?: boolean
  /**
   * Current HUB lead, from the workbook's "Liên kết với biểu đồ bên trên" column
   * (S1-UAT-08A); HUBs without an explicit, consistent link keep the placeholder.
   */
  lead?: { name: string; photo: PhotoAsset | null }
}

/** Section 05 order, clockwise from the top (HN), as drawn in the pack. */
const HUB_NODES: Hub[] = [
  { code: 'HN', short: 'HN', region: 'TP. HÀ NỘI', since: '2021' },
  { code: 'HCM', short: 'HCM', region: 'TP. HỒ CHÍ MINH', since: '2023' },
  { code: 'DN', short: 'ĐN', region: 'TP. ĐÀ NẴNG', since: '2024' },
  { code: 'SG', short: 'SG', region: 'SINGAPORE', since: '2024' },
  { code: 'CN', short: 'CN', region: 'TRUNG QUỐC ĐẠI LỤC', since: '2024' },
  { code: 'AU', short: 'AU', region: 'ÚC', since: '2024' },
  { code: 'UK', short: 'UK', region: 'VƯƠNG QUỐC ANH', since: '2024' },
  { code: 'US', short: 'US', region: 'HOA KỲ', since: '2024' },
  { code: 'UAE', short: 'UAE', region: 'UAE', since: '2025' },
  { code: 'EU', short: 'EU', region: 'CHÂU ÂU', since: '2025' },
  { code: 'QN', short: 'QN', region: 'TP. QUẢNG NINH', since: '2026' },
  { code: 'THPT', short: 'THPT', region: 'HUB HIGHSCHOOL', ringShort: 'HS', since: '2025' },
  { code: 'BIZ', short: 'BIZ', region: 'HUB BUSINESS', since: '2026', dashed: true },
]

export const HERO_STATS = [
  { value: '10.000+', label: 'thành viên' },
  { value: '13', label: 'HUB thành viên' },
  { value: '60+', label: 'cộng đồng và câu lạc bộ' },
  { value: '200+', label: 'đối tác trong hệ sinh thái' },
] as const

/**
 * Captions run past the card edge in the pack and are clipped the same way.
 * The first one is partly hidden behind the title there; its legible letters
 * ("…ỘNG Đ… …UB TẠI SỰ KIỆ…") match the pack's own "CỘNG ĐỒNG HUB" wording.
 */
export const HERO_CARDS = [
  {
    caption: 'ẢNH · CỘNG ĐỒNG HUB TẠI SỰ KIỆN',
    tone: 'deep',
    photo: about(
      'hero-community.webp',
      'Cộng đồng HUB Network chụp ảnh chung trên sân khấu một sự kiện',
    ),
  },
  {
    caption: 'ẢNH · THÀNH VIÊN QUỐC TẾ',
    tone: 'deep',
    photo: about('hero-summit.webp', 'Thành viên HUB Network tại HUB Summit'),
  },
  {
    caption: 'ẢNH · WORKSHOP KHỞI NGHIỆP',
    tone: 'warm',
    photo: about('hero-workshop.webp', 'Người tham dự một buổi workshop của HUB Network'),
  },
] as const

export const MISSIONS = [
  {
    no: '01',
    title: 'Xây dựng, phát triển cộng đồng',
    caption: 'ẢNH · CỘNG ĐỒNG HUB',
    tone: 'warm',
    photo: about(
      'mission-community.webp',
      'Thành viên HUB Network chụp ảnh chung ngoài trời cùng cờ HUB Network',
    ),
  },
  {
    no: '02',
    title: 'Kết nối đa nguồn lực, đồng hành cùng các sáng kiến đổi mới sáng tạo',
    caption: 'ẢNH · KẾT NỐI NGUỒN LỰC',
    tone: 'deep',
    photo: about(
      'mission-resources.webp',
      'HUB Network đồng hành cùng HANOIBA trên hành trình mới',
    ),
  },
  {
    no: '03',
    title: 'Xây dựng nền tảng dữ liệu đổi mới sáng tạo Việt Nam',
    caption: 'ẢNH · NỀN TẢNG DỮ LIỆU',
    tone: 'dark',
    // The frame is wider than the picture: keep the whole map, north included, in the crop.
    photo: about(
      'about-data-platform-vietnam.webp',
      'Bản đồ Việt Nam kết nối trong mạng lưới dữ liệu số',
      'center 30%',
    ),
  },
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

/** Section 04 ring, clockwise from the top-left "?" slot, as drawn in the pack. */
export const SCALE_RING = [
  '?',
  'HN',
  'HCM',
  'ĐN',
  'SG',
  'CN',
  'AU',
  'UK',
  'US',
  'UAE',
  'EU',
  'HS',
  'QN',
] as const

export const SCALE_FUNCTIONS = [
  'Định hướng chiến lược',
  'Kết nối nguồn lực',
  'Xây dựng hệ thống vận hành chung',
] as const

/** Section 04 tier cards (tầng 2, tầng 3). */
export const SCALE_PHOTOS = {
  memberHubs: about('scale-member-hubs.webp', 'Sự kiện HUB Forum tại một HUB thành viên'),
  clubs: about('scale-clubs.webp', 'Sinh viên tham dự một sự kiện của câu lạc bộ tại trường'),
} as const

export const ORG_TIERS = [
  { tier: 'TẦNG 01', title: 'HUB Tổng', note: null },
  { tier: 'TẦNG 02', title: 'HUB thành viên', note: '13 HUB' },
  { tier: 'TẦNG 03', title: 'Câu lạc bộ, cộng đồng', note: 'Gần 60 cộng đồng và CLB' },
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

/**
 * The org-chart links of the workbook, as written, and the node each names.
 * "Trưởng HUB China" is NOT mapped: the person it names is "Phó Chủ tịch HUB
 * Network China" while another row is "Chủ tịch HUB Network China" (source
 * conflict, PO to confirm). "Trưởng HUB Tổng" has no node with a lead slot.
 */
export const ORG_LINKS: Record<string, HubCode> = {
  'Trưởng HUB Biz': 'BIZ',
  'Trưởng HUB HCMC': 'HCM',
  'Trưởng HUB ĐN': 'DN',
  'Trưởng HUB HN': 'HN',
  'Trưởng HUB USA': 'US',
  'Trưởng HUB UAE': 'UAE',
  'Trưởng HUB UK': 'UK',
  'Trưởng HUB Australia': 'AU',
  'Trưởng HUB EU': 'EU',
  'Trưởng HUB HighSchool': 'THPT',
}

export const UNRESOLVED_ORG_LINKS = ['Trưởng HUB China', 'Trưởng HUB Tổng'] as const

export function hubsWithLeads(humans: readonly Human[]): Hub[] {
  return HUB_NODES.map((hub) => {
    const lead = humans.filter((h) => h.orgLink && ORG_LINKS[h.orgLink] === hub.code)
    // Exactly one explicit link, or none: never pick between two.
    return lead.length === 1
      ? { ...hub, lead: { name: lead[0]!.name, photo: lead[0]!.photo } }
      : hub
  })
}

export const HUBS: Hub[] = hubsWithLeads(HUMANS)

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

/** Sticky-counter chips, in the order the pack lists them. */
export const PLACES = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Singapore',
  'Trung Quốc đại lục',
  'Úc',
  'Vương quốc Anh',
  'Hoa Kỳ',
  'UAE',
  'Châu Âu',
  'HUB HighSchool',
  'Quảng Ninh',
] as const

export type ActivityKind = 'CUOC_THI' | 'SU_KIEN' | 'CHUOI_SU_KIEN' | 'CHUONG_TRINH'

/**
 * "Chuỗi sự kiện" is a Tag of the workbook that the design's filters did not
 * have: it gets its own filter rather than being folded into another kind.
 * "Chương trình" stays (no workbook row uses it yet).
 */
export const ACTIVITY_FILTERS: Array<{ key: 'ALL' | ActivityKind; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CUOC_THI', label: 'Cuộc thi' },
  { key: 'SU_KIEN', label: 'Sự kiện' },
  { key: 'CHUOI_SU_KIEN', label: 'Chuỗi sự kiện' },
  { key: 'CHUONG_TRINH', label: 'Chương trình' },
]

export const KIND_LABEL: Record<ActivityKind, string> = {
  CUOC_THI: 'CUỘC THI',
  SU_KIEN: 'SỰ KIỆN',
  CHUOI_SU_KIEN: 'CHUỖI SỰ KIỆN',
  CHUONG_TRINH: 'CHƯƠNG TRÌNH',
}

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
