/**
 * TASK 22-PREVIEW-LIBRARY — DEMO FIXTURE for the "Bài toán" tab of /library.
 *
 * DEC-L15-D2: there is no public problem data (the Problem entity is Future),
 * so the "Bài toán" directory runs on this static fixture, shown with a
 * visible "Dữ liệu minh hoạ" label. It is NOT from startup.json (that source
 * feeds the Startup and Nhà sáng lập tabs only, DEC-L15-D7). The six problems
 * are the distinct cards of the L15 pack; the pack's company names are replaced
 * by neutral sector labels so no real organisation is presented as having
 * posted them. Nothing here is read from, or written to, the database.
 */

export type Stage = 'OPEN' | 'UPCOMING' | 'JUDGING' | 'ANNOUNCED'
export type Domain = 'LOGISTICS' | 'FINTECH' | 'HEALTH' | 'AGRI' | 'EDU' | 'AI'
export type Area = 'NATIONWIDE' | 'HANOI' | 'HCMC'

export type Problem = {
  id: string
  org: string
  stage: Stage
  title: string
  /** Prize as drawn, e.g. "120 triệu"; null shows the "–" pill. */
  prize: string | null
  summary: string
  /** Time chip text as drawn ("Còn 12 ngày", "Đã đóng nộp", …). */
  time: string
  /** Days left to submit, for the "Sắp hết hạn" order; null when not open. */
  daysLeft: number | null
  teams: string
  domains: Domain[]
  area: Area
  tone: 'coral' | 'wine' | 'ember' | 'ash' | 'red' | 'smoke'
}

export const STAGE_LABEL: Record<Stage, string> = {
  OPEN: 'Đang mở nộp',
  UPCOMING: 'Sắp diễn ra',
  JUDGING: 'Đang chấm',
  ANNOUNCED: 'Đã công bố',
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  LOGISTICS: 'Logistics',
  FINTECH: 'Tài chính số',
  HEALTH: 'Y tế',
  AGRI: 'Nông nghiệp',
  EDU: 'Giáo dục',
  AI: 'AI',
}

export const AREA_LABEL: Record<Area, string> = {
  NATIONWIDE: 'Toàn quốc',
  HANOI: 'Hà Nội',
  HCMC: 'TP.HCM',
}

/** Sidebar facets, in the pack's order. A facet with no result still shows, with 0. */
export const FACETS = {
  domain: ['LOGISTICS', 'FINTECH', 'HEALTH', 'AGRI', 'EDU'] as Domain[],
  stage: ['OPEN', 'UPCOMING', 'JUDGING', 'ANNOUNCED'] as Stage[],
  area: ['NATIONWIDE', 'HANOI', 'HCMC'] as Area[],
}

/** "Tìm nhanh" chips under the search bar; each toggles a domain filter. */
export const QUICK: Domain[] = ['LOGISTICS', 'FINTECH', 'AGRI', 'AI', 'HEALTH']

export const PROBLEMS: Problem[] = [
  {
    id: 'giao-chang-cuoi',
    org: 'Bưu chính',
    stage: 'OPEN',
    title: 'Giảm hao hụt trong chặng giao cuối',
    prize: '120 triệu',
    summary:
      'Chặng giao cuối chiếm 53% chi phí vận hành. Bài toán là truy được hao hụt tới từng chuyến, không thêm điểm quét mới.',
    time: 'Còn 12 ngày',
    daysLeft: 12,
    teams: '10–20 đội',
    domains: ['LOGISTICS'],
    area: 'NATIONWIDE',
    tone: 'coral',
  },
  {
    id: 'du-bao-kho',
    org: 'Sữa & thực phẩm',
    stage: 'OPEN',
    title: 'Dự báo nhu cầu kho theo mùa vụ',
    prize: '80 triệu',
    summary:
      'Sáu tháng cao điểm lệch nhau giữa các vùng. Kho trung tâm hoặc thừa hoặc thiếu, không có ở giữa.',
    time: 'Còn 21 ngày',
    daysLeft: 21,
    teams: '5–10 đội',
    domains: ['LOGISTICS'],
    area: 'NATIONWIDE',
    tone: 'wine',
  },
  {
    id: 'dinh-tuyen-xe-tai',
    org: 'Chuyển phát nhanh',
    stage: 'OPEN',
    title: 'Định tuyến xe tải liên tỉnh',
    prize: '150 triệu',
    summary:
      'Tuyến cố định đặt từ 2019, chưa từng tính lại theo dữ liệu thật. Ước tính dư 18% quãng đường.',
    time: 'Còn 24 ngày',
    daysLeft: 24,
    teams: '20–50 đội',
    domains: ['LOGISTICS'],
    area: 'NATIONWIDE',
    tone: 'ember',
  },
  {
    id: 'truy-xuat-nong-san',
    org: 'Nông nghiệp',
    stage: 'OPEN',
    title: 'Truy xuất nguồn gốc nông sản',
    prize: '100 triệu',
    summary:
      'Lô hàng đi qua 5 khâu trung gian. Tới siêu thị thì không còn ai trả lời được ruộng nào.',
    time: 'Còn 30 ngày',
    daysLeft: 30,
    teams: 'Vừa mở nhận giải pháp',
    domains: ['AGRI'],
    area: 'NATIONWIDE',
    tone: 'ash',
  },
  {
    id: 'tin-dung-ho-kinh-doanh',
    org: 'Ngân hàng thương mại',
    stage: 'JUDGING',
    title: 'Chấm điểm tín dụng hộ kinh doanh',
    prize: '200 triệu',
    summary:
      'Hộ kinh doanh không có báo cáo tài chính. Hồ sơ tín dụng dựa vào cảm tính của cán bộ tại quầy.',
    time: 'Đã đóng nộp',
    daysLeft: null,
    teams: 'Hơn 50 đội',
    domains: ['FINTECH'],
    area: 'HANOI',
    tone: 'red',
  },
  {
    id: 'hang-hoan',
    org: 'Thương mại điện tử',
    stage: 'UPCOMING',
    title: 'Quản lý hàng hoàn theo thời gian thực',
    prize: null,
    summary: 'Hàng hoàn nằm rải ở 40 kho trung chuyển, không ai biết tổng tồn cho tới cuối tháng.',
    time: 'Mở ngày 05/10',
    daysLeft: null,
    teams: 'Chưa có đội nào',
    domains: ['LOGISTICS'],
    area: 'HCMC',
    tone: 'smoke',
  },
]
