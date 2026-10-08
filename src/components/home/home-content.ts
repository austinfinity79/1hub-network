/**
 * DEMO-HOME-ABOUT-01 — static presentation copy of Homepage v2, verbatim from
 * the PO frame DM01 (design-reference/final/demo-0710). There is no public
 * programme list, programme update feed or news backend in P0, so these
 * blocks are read-only presentation (DEMO_DATA_CONTRACT "Homepage blocks"):
 * nothing is clickable, nothing is a programme or news record.
 *
 * PUBLIC-CONTENT-PUBLISH-01: the programme cards and the ticker come from the
 * refreshed workbook ("1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx",
 * sheet "Ảnh homepage", block "Chương trình đổi mới sáng tạo", rows 3–6),
 * transcribed verbatim; a field the sheet leaves empty is omitted, never
 * filled. Images are the sheet's Drive files 01–04 / news 01–03, optimised to
 * WebP in public/home/content-v2. The news text stays as it was ("Nội dung và
 * các tag còn lại giữ nguyên"); only its picture is supplied. The programme
 * update feed has no refreshed source and is unchanged.
 */

/** The four refreshed homepage programmes, in the sheet's order. */
export const HOME_TICKER = [
  'APEC Innovation Challenge',
  'VPBank Innovation Challenge',
  'Cuộc thi Khởi nghiệp cùng Kawai',
  'Agritech Innovation Challenge',
] as const

export const HOME_SEARCH_SUGGESTIONS = [
  'Startup logistics đang gọi vốn',
  'Chương trình đổi mới sáng tạo nông nghiệp',
  'Thử thách chuyển đổi số cho doanh nghiệp',
] as const

export type ProgrammeUpdate = {
  code: string
  /** S2-HOME-HIGHLIGHTS-ASSETS-01: the approved mark, else null (the code is drawn). */
  logo: string | null
  title: string
  meta: string
  tag: string
  tone: 'gold' | 'amber' | 'green'
}

/**
 * S2-HOME-HIGHLIGHTS-ASSETS-01 — the PO's "Homepage - Nổi bật tuần này" Drive
 * folder (1oHQqE4LfU_ojnXzoEbH4DUGKJXxIo_7t): five marks, one per row that
 * drew initials. Optimised to 128 px WebP in public/home/highlights; sources
 * (sha256): cập nhật-1-apec-innovation-challenge.png 6102fe9a…,
 * cập nhật-2-qr-payment-open-challenge.png e5690a68…,
 * cập nhật-3-logistics-2026.png 1e3bf73b…, sản phẩm-4-bloom.png 6bad5897…,
 * sản phẩm-5-Debatium.png 7ac8c229…. Homepage only: the canonical product
 * logos are not changed here.
 */
export const HIGHLIGHT_PRODUCT_LOGOS: Readonly<Record<string, string>> = {
  bloom: '/home/highlights/bloom.webp',
  debatium: '/home/highlights/debatium.webp',
}

/**
 * S2-HOME-FEATURED-BG-QUICKFIX-01 — the PO's backgrounds for two cards of
 * "Startup sẵn sàng gặp nhà đầu tư" ("Smart Campus Spring Walkway(1).png",
 * "Dreamy Pastel City Mapscape(1).png"), as supplied, WebP only. A card
 * without one keeps the drawn ground.
 */
export const PITCH_BACKGROUNDS: Readonly<Record<string, string>> = {
  '1hub-smart-campus-solution': '/home/pitch/smart-campus-spring-walkway.webp',
  tracely: '/home/pitch/dreamy-pastel-city-mapscape.webp',
}

export const PROGRAMME_UPDATES: ProgrammeUpdate[] = [
  {
    code: 'AP',
    logo: '/home/highlights/apec-innovation-challenge.webp',
    title: 'APEC Innovation Challenge công bố 20 đội vào vòng trong',
    meta: 'APEC Innovation Challenge · 2 giờ trước',
    tag: 'VÒNG TRONG',
    tone: 'gold',
  },
  {
    code: 'MB',
    logo: '/home/highlights/qr-payment-open-challenge.webp',
    title: 'MBBank Open Challenge mở thêm bài toán thanh toán QR',
    meta: 'MB Bank · hôm qua',
    tag: 'BÀI TOÁN MỚI',
    tone: 'amber',
  },
  {
    code: 'BĐ',
    logo: '/home/highlights/logistics-2026.webp',
    title: 'Chuyển đổi số logistics 2026 gia hạn nộp bài đến 30/11',
    meta: 'Tổng công ty Bưu điện · 2 ngày trước',
    tag: 'GIA HẠN',
    tone: 'green',
  },
]

export type ProgrammeCard = {
  code: string
  /** "Tag phân loại". */
  kind: string
  /** "Trạng thái", as written. */
  status: string
  statusTone: 'coral' | 'soft'
  title: string
  /** "Mô tả 1 dòng". */
  description: string
  /** Null: the sheet leaves it empty, the row is not drawn. */
  period: string | null
  prize: string | null
  /** "Chủ quản". */
  owner: string | null
  scale: string | null
  tone: 'red' | 'violet' | 'green' | 'maroon'
  /** 16:9 cover (public/), alt text. */
  image: { src: string; alt: string } | null
}

export const PROGRAMME_FILTERS = ['Đang mở', 'Sắp mở', 'Đã kết thúc'] as const

const cover = (file: string, alt: string) => ({ src: `/home/content-v2/${file}`, alt })

export const PROGRAMME_CARDS: ProgrammeCard[] = [
  {
    code: 'AP',
    kind: 'Cuộc thi',
    status: 'Sắp công bố',
    statusTone: 'soft',
    title: 'APEC Innovation Challenge',
    description:
      'Cuộc thi đổi mới sáng tạo khu vực gắn với Năm APEC 2027, tìm kiếm startup từ 21 nền kinh tế APEC qua các bảng do doanh nghiệp đầu ngành dẫn dắt.',
    period: null,
    prize: null,
    owner: 'APEC',
    scale: null,
    tone: 'maroon',
    image: cover('programme-apec-innovation-challenge.webp', 'APEC Innovation Challenge 2027'),
  },
  {
    code: 'VP',
    kind: 'Cuộc thi',
    status: 'Sắp công bố',
    statusTone: 'soft',
    title: 'VPBank Innovation Challenge',
    description:
      'Thử thách đổi mới mở, tìm kiếm startup có giải pháp ngân hàng số, thanh toán và tài chính toàn diện để hợp tác thử nghiệm cùng VPBank.',
    period: null,
    prize: null,
    owner: 'VPBank - Ngân hàng Nhà nước',
    scale: null,
    tone: 'green',
    image: cover('programme-vpbank-innovation-challenge.webp', 'VPBank Innovation Challenge'),
  },
  {
    code: 'KW',
    kind: 'Cuộc thi',
    status: 'Sắp công bố',
    statusTone: 'soft',
    title: 'Cuộc thi Khởi nghiệp cùng Kawai',
    description: 'Cuộc thi khởi nghiệp lớn nhất miền Bắc với 20 năm phát triển',
    period: null,
    prize: null,
    owner: 'CLB Nhà doanh nhân Tương lai (TEC FTU)',
    scale: null,
    tone: 'violet',
    image: cover('programme-khoi-nghiep-cung-kawai.webp', 'Cuộc thi Khởi nghiệp cùng Kawai'),
  },
  {
    code: 'AG',
    kind: 'Cuộc thi',
    status: 'Sắp công bố',
    statusTone: 'soft',
    title: 'Agritech Innovation Challenge',
    description:
      'Thử thách tìm kiếm giải pháp công nghệ cho nông nghiệp, từ canh tác thông minh, truy xuất nguồn gốc đến chuỗi cung ứng nông sản.',
    period: null,
    prize: null,
    owner: 'Net Zero Vietnam',
    scale: null,
    tone: 'red',
    image: cover('programme-agritech-innovation-challenge.webp', 'Agritech Innovation Challenge'),
  },
]

export type NewsCard = {
  tag: string
  title: string
  date: string
  tone: 'coral' | 'plum' | 'amber'
  /** The refreshed picture of this slot (news 01–03, in order). */
  image: { src: string; alt: string } | null
}

export const NEWS: NewsCard[] = [
  {
    tag: 'ĐẦU TƯ',
    title: '6 đội ký hợp đồng thử nghiệm với doanh nghiệp ĐBSCL',
    date: '20/12/2026',
    tone: 'coral',
    image: cover(
      'news-01-dbscl.webp',
      '6 startup ký kết hợp đồng thử nghiệm với doanh nghiệp ĐBSCL',
    ),
  },
  {
    tag: 'CỘNG ĐỒNG',
    title: 'HUB Network mở rộng cộng đồng kết nối tới TP. Quảng Ninh',
    date: '18/09/2026',
    tone: 'plum',
    image: cover('news-02-hub-quang-ninh.webp', 'HUB Network tại TP. Quảng Ninh'),
  },
  {
    tag: 'ƯƠM TẠO',
    title: 'iHUB Ventures công bố danh mục đầu tư vòng pre-seed đầu tiên',
    date: '30/08/2026',
    tone: 'amber',
    image: cover(
      'news-03-ihub-ventures.webp',
      'iHUB Ventures công bố danh mục đầu tư vòng pre-seed',
    ),
  },
]
