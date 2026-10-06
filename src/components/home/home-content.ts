/**
 * DEMO-HOME-ABOUT-01 — static presentation copy of Homepage v2, verbatim from
 * the PO frame DM01 (design-reference/final/demo-0710). There is no public
 * programme list, programme update feed or news backend in P0, so these
 * blocks are read-only presentation (DEMO_DATA_CONTRACT "Homepage blocks"):
 * nothing is clickable, nothing is a programme or news record.
 */

export const HOME_TICKER = [
  'APEC Innovation Challenge',
  'MBBank Open Challenge',
  'Fintech Challenge Vietnam',
  'Chuyển đổi số logistics 2026',
  'Nông sản ĐBSCL 2026',
] as const

export const HOME_SEARCH_SUGGESTIONS = [
  'Startup logistics đang gọi vốn',
  'Chương trình đổi mới sáng tạo nông nghiệp',
  'Thử thách chuyển đổi số cho doanh nghiệp',
] as const

export type ProgrammeUpdate = {
  code: string
  title: string
  meta: string
  tag: string
  tone: 'gold' | 'amber' | 'green'
}

export const PROGRAMME_UPDATES: ProgrammeUpdate[] = [
  {
    code: 'AP',
    title: 'APEC Innovation Challenge công bố 20 đội vào vòng trong',
    meta: 'APEC Innovation Challenge · 2 giờ trước',
    tag: 'VÒNG TRONG',
    tone: 'gold',
  },
  {
    code: 'MB',
    title: 'MBBank Open Challenge mở thêm bài toán thanh toán QR',
    meta: 'MB Bank · hôm qua',
    tag: 'BÀI TOÁN MỚI',
    tone: 'amber',
  },
  {
    code: 'BĐ',
    title: 'Chuyển đổi số logistics 2026 gia hạn nộp bài đến 30/11',
    meta: 'Tổng công ty Bưu điện · 2 ngày trước',
    tag: 'GIA HẠN',
    tone: 'green',
  },
]

export type ProgrammeCard = {
  code: string
  kind: string
  status: string
  statusTone: 'coral' | 'soft'
  title: string
  description: string
  period: string
  prize: string
  owner: string
  scale: string
  tone: 'red' | 'violet' | 'green' | 'maroon'
}

export const PROGRAMME_FILTERS = ['Đang mở', 'Sắp mở', 'Đã kết thúc'] as const

export const PROGRAMME_CARDS: ProgrammeCard[] = [
  {
    code: 'BĐ',
    kind: 'Thử thách',
    status: 'Còn 23 ngày',
    statusTone: 'coral',
    title: 'Chuyển đổi số logistics 2026',
    description:
      'Giảm hao hụt chặng giao cuối, định tuyến xe tải và tối ưu kho bằng dữ liệu vận đơn.',
    period: '15/09 – 30/11/2026',
    prize: '600 triệu đồng',
    owner: 'Tổng công ty Bưu điện Việt Nam',
    scale: '3 bài toán',
    tone: 'red',
  },
  {
    code: 'MB',
    kind: 'Thử thách',
    status: 'Còn 31 ngày',
    statusTone: 'coral',
    title: 'MBBank Open Challenge',
    description:
      'Tài chính số cho hộ kinh doanh: chấm điểm tín dụng, thanh toán và quản lý dòng tiền.',
    period: '01/10 – 08/12/2026',
    prize: '1 tỷ đồng',
    owner: 'MB Bank',
    scale: '4 bài toán',
    tone: 'violet',
  },
  {
    code: 'LT',
    kind: 'Thử thách',
    status: 'Đang mở',
    statusTone: 'coral',
    title: 'Nông sản ĐBSCL 2026',
    description:
      'Truy xuất nguồn gốc, kho lạnh chia sẻ và kết nối tiêu thụ nông sản vùng Đồng bằng sông Cửu Long.',
    period: '10/2026 – 01/2027',
    prize: '800 triệu đồng',
    owner: 'Lộc Trời',
    scale: '5 bài toán',
    tone: 'green',
  },
  {
    code: 'AP',
    kind: 'Thử thách quốc tế',
    status: 'Sắp mở',
    statusTone: 'soft',
    title: 'APEC Innovation Challenge',
    description:
      'Giải pháp đổi mới sáng tạo cho các nền kinh tế APEC, hướng tới Năm APEC 2027 tại Việt Nam.',
    period: '01 – 06/2027',
    prize: 'Chờ công bố',
    owner: 'HUB Network cùng đối tác APEC 2027',
    scale: 'Mở đăng ký sớm',
    tone: 'maroon',
  },
]

export type NewsCard = {
  tag: string
  title: string
  date: string
  tone: 'coral' | 'plum' | 'amber'
}

export const NEWS: NewsCard[] = [
  {
    tag: 'ĐẦU TƯ',
    title: '6 đội ký hợp đồng thử nghiệm với doanh nghiệp ĐBSCL',
    date: '20/12/2026',
    tone: 'coral',
  },
  {
    tag: 'CỘNG ĐỒNG',
    title: 'HUB Network mở rộng cộng đồng kết nối tới TP. Quảng Ninh',
    date: '18/09/2026',
    tone: 'plum',
  },
  {
    tag: 'ƯƠM TẠO',
    title: 'iHUB Ventures công bố danh mục đầu tư vòng pre-seed đầu tiên',
    date: '30/08/2026',
    tone: 'amber',
  },
]
