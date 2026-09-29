/**
 * TASK 22-PREVIEW-ABOUT — content of the public About page (/about).
 *
 * Every string, number and label is transcribed from the approved About.zip
 * design pack (Sprint 1 · DL29, 28/09). Photos come from the "Ảnh About Hub"
 * pack (28/09, optimised to WebP in public/about); a slot with no supplied
 * photo keeps the pack's labelled placeholder ("ẢNH · …"). People carry the
 * name from their portrait file; roles and terms stay "Chờ cập nhật", and
 * activity fields the pack marks "Chờ cập nhật" stay that way.
 */

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
  /** Current HUB lead, where approved (PO, 29/09); the others keep the placeholder. */
  lead?: { name: string; photo: PhotoAsset }
}

/** Section 05 order, clockwise from the top (HN), as drawn in the pack. */
export const HUBS: Hub[] = [
  {
    code: 'HN',
    short: 'HN',
    region: 'TP. HÀ NỘI',
    since: '2021',
    lead: {
      name: 'Le Phuong Thao',
      photo: about('humans/le-phuong-thao.webp', 'Chân dung Le Phuong Thao', '50% 22%'),
    },
  },
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

export type Human = {
  name: string
  photo: PhotoAsset
  /** Unknown until the content owner supplies it: listed under "Tất cả" only. */
  term: 'CURRENT' | 'PAST' | null
}

/**
 * Humans of HUB portraits ("Ảnh About Hub" pack). The name is the portrait file
 * name as supplied (a trailing HUB tag such as "USA", "- Sing", "- Uk" dropped);
 * role and term are not in the pack and stay "Chờ cập nhật".
 */
const human = (name: string, file: string): Human => ({
  name,
  photo: about(`humans/${file}.webp`, `Chân dung ${name}`, '50% 22%'),
  term: null,
})

export const HUMANS: Human[] = [
  human('Bui Ha Phuong', 'bui-ha-phuong'),
  human('Dao Viet Tung', 'dao-viet-tung'),
  human('Doan Le Anh Thu', 'doan-le-anh-thu'),
  human('Doan Nhuan Phat', 'doan-nhuan-phat'),
  human('Huynh Dang Khoa', 'huynh-dang-khoa'),
  human('Huỳnh Đức', 'huynh-duc'),
  human('Lâm Mỹ Kỳ', 'lam-my-ky'),
  human('Le Dieu Anh', 'le-dieu-anh'),
  human('Le Duc Anh', 'le-duc-anh'),
  human('Le Mai Huong', 'le-mai-huong'),
  human('Le Phuong Thao', 'le-phuong-thao'),
  human('Mai Thao Bac Dung', 'mai-thao-bac-dung'),
  human('Ngo Tri Nguyen', 'ngo-tri-nguyen'),
  human('Nguyen Hoang Khanh', 'nguyen-hoang-khanh'),
  human('Nguyen Huy Hoang', 'nguyen-huy-hoang'),
  human('Nguyen Manh Hung', 'nguyen-manh-hung'),
  human('Nguyen Manh Tung', 'nguyen-manh-tung'),
  human('Nguyen Thanh Hien', 'nguyen-thanh-hien'),
  human('Nguyen Vu Ha Vy', 'nguyen-vu-ha-vy'),
  human('Pham Khanh Van', 'pham-khanh-van'),
  human('Pham Minh Hang', 'pham-minh-hang'),
  human('Phan Phuong', 'phan-phuong'),
  human('Phung Thi Ngoc Linh', 'phung-thi-ngoc-linh'),
  human('Phương Phương', 'phuong-phuong'),
  human('Thanh Long', 'thanh-long'),
  human('Tran Le Hung', 'tran-le-hung'),
  human('Tran Quang Hung', 'tran-quang-hung'),
  human('Tran Vy Dieu', 'tran-vy-dieu'),
  human('Vũ Bích Diệp', 'vu-bich-diep'),
  human('Vu Dinh Duc', 'vu-dinh-duc'),
  human('Vũ Minh Tâm', 'vu-minh-tam'),
  human('Vu Thu Hang', 'vu-thu-hang'),
  human('Vuong Bao Son', 'vuong-bao-son'),
  human('Vương Hữu Nam', 'vuong-huu-nam'),
]

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

export type ActivityKind = 'CUOC_THI' | 'SU_KIEN' | 'CHUONG_TRINH'

export const ACTIVITY_FILTERS: Array<{ key: 'ALL' | ActivityKind; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CUOC_THI', label: 'Cuộc thi' },
  { key: 'SU_KIEN', label: 'Sự kiện' },
  { key: 'CHUONG_TRINH', label: 'Chương trình' },
]

export const KIND_LABEL: Record<ActivityKind, string> = {
  CUOC_THI: 'CUỘC THI',
  SU_KIEN: 'SỰ KIỆN',
  CHUONG_TRINH: 'CHƯƠNG TRÌNH',
}

export type Activity = {
  kind: ActivityKind
  title: string
  banner: string
  time: string | null
  organiser: string
  tone: 'warm' | 'deep' | 'dark'
}

/**
 * Only the three fully legible cards. The pack's fourth card ("SỰ KIỆN · HUB…")
 * is cut off at the frame edge, so its title is unknown and it is not rendered
 * (recorded as a follow-up for the content owner).
 */
export const ACTIVITIES: Activity[] = [
  {
    kind: 'CUOC_THI',
    title: 'Cuộc thi Khởi nghiệp cùng Kawai',
    banner: 'BANNER · CUỘC THI KHỞI NGHIỆP CÙNG KAWAI',
    time: null,
    organiser: 'TEC – FTU',
    tone: 'warm',
  },
  {
    kind: 'CUOC_THI',
    title: 'Fintech Challenge Vietnam',
    banner: 'BANNER · FINTECH CHALLENGE VIETNAM',
    time: null,
    organiser: 'Ngân hàng Nhà nước',
    tone: 'dark',
  },
  {
    kind: 'CUOC_THI',
    title: 'Honda Innovation Challenge',
    banner: 'BANNER · HONDA INNOVATION CHALLENGE',
    time: null,
    organiser: 'Honda Việt Nam',
    tone: 'deep',
  },
]
