/**
 * DEMO-0710 — read-only Tổng quan content of the demo startups (DM10,
 * docs/demo-0710/DEMO_DATA_CONTRACT.md "Tổng quan / Chỉ số / Cập nhật
 * content"; the WF04 fixture pattern, DEC-WF04-T00-D1). Keyed by the canonical
 * venture id from `db/seed/demo_0710.sql`. No canonical field exists for any
 * of this; nothing here is a metric, funding, award or recruitment record and
 * nothing is computed or generated. Server-side only. DEMO STATE ONLY.
 *
 * PRODUCT-DETAIL-SMART-CAMPUS-01: a real venture may carry only its approved,
 * source-backed blocks; every optional block it lacks (market, quarter,
 * funding, an empty list) is simply not drawn. Its quarantined claims are not
 * in this file at all.
 */

export type DemoFigure = { value: string; label: string }

export type StartupOverview = {
  /** Mono eyebrow above the tagline. */
  focus: string
  tagline: string
  /** The stage as the PO fixed it for this venture, shown instead of the stage short label. */
  stageLabel?: string
  /** The venture's own public site, from its source. */
  website?: { href: string; label: string }
  /**
   * S2-SMART-CAMPUS-DETAIL-ENRICH-01: the source's team list (name + role, as
   * written, in order). Shown like the canonical team: signed-in members only
   * (DEC-THAO-SP-D1); a person with a profile links to it, one without is plain
   * text; no profile is created.
   */
  team?: Array<{ name: string; role: string }>
  problem: {
    text: string | null
    figures: DemoFigure[]
    items?: Array<{ title: string; text: string }>
  }
  solution: { text: string | null; features: Array<{ title: string; text: string }> }
  market?: {
    text: string
    sizes: Array<{ label: string; value: string; note: string }>
    method: { title: string; text: string }
  }
  quotes: Array<{ text: string; source: string }>
  vision: string
  /** Dark panel "Cập nhật · <quarter>": figures as the team reported them. */
  quarter?: {
    label: string
    figures: Array<{ value: string; delta: string; label: string }>
  }
  funding?: {
    rows: Array<{ label: string; value: string }>
    /** Drawn progress, 0–1 (committed / asked). */
    progress: number
  }
  milestones: Array<{ title: string; meta: string }>
  needs: string[]
}

export const STARTUP_OVERVIEWS: Readonly<Record<string, StartupOverview>> = {
  // Tracely (tracely), copy as drawn on DM10
  'de710000-0000-0000-0000-0000000000c1': {
    focus: 'Giải bài toán cho doanh nghiệp bưu chính, logistics',
    tagline:
      'Truy vết hao hụt tới từng chuyến và từng người giao bằng dữ liệu quét mã sẵn có, không cần lắp thêm thiết bị.',
    problem: {
      text: 'Chặng giao cuối chiếm 53% chi phí vận hành, nhưng hao hụt chỉ được ghi ở mức bưu cục, nên khi mất hàng không ai truy được chuyến nào, người nào.',
      figures: [
        { value: '53%', label: 'chi phí vận hành nằm ở chặng giao cuối' },
        { value: '3–5 ngày', label: 'từ lúc thất lạc đến khi phát hiện' },
        { value: '2,1%', label: 'tỉ lệ hao hụt tại bưu cục trước thí điểm' },
      ],
    },
    solution: {
      text: 'Một lớp phân tích đặt trên dữ liệu quét mã của bưu tá: đối chiếu dấu thời gian, chỉ ra chuyến và người gây hao hụt, báo cho điều phối viên ngay trong ngày.',
      features: [
        {
          title: 'Truy vết từng chuyến',
          text: 'Đối chiếu dấu thời gian giữa các lần đổi trạng thái để chỉ ra điểm hao hụt.',
        },
        {
          title: 'Cảnh báo trước khi khách khiếu nại',
          text: 'Điều phối viên nhận cảnh báo trong ngày thay vì sau 3–5 ngày.',
        },
        {
          title: 'Không đổi thiết bị đầu cuối',
          text: 'Chạy trên dữ liệu quét mã có sẵn của bưu tá.',
        },
      ],
    },
    market: {
      text: 'Khách hàng đầu tiên là doanh nghiệp bưu chính, chuyển phát có mạng lưới bưu cục và đội giao nhận riêng.',
      sizes: [
        { label: 'Tổng thị trường', value: '~3,5 tỷ USD', note: 'chuyển phát Việt Nam mỗi năm' },
        {
          label: 'Thị trường phục vụ được',
          value: '~180 triệu USD',
          note: 'chi phí quản lý hao hụt của 20 doanh nghiệp lớn',
        },
        { label: 'Mục tiêu 3 năm', value: '~9 triệu USD', note: '5 doanh nghiệp, 1.200 bưu cục' },
      ],
      method: {
        title: 'Phương pháp',
        text: 'Đối soát thủ công cuối ngày ở bưu cục; hệ thống quản lý vận tải chỉ ghi trạng thái đơn, không gắn trách nhiệm theo người giao.',
      },
    },
    quotes: [
      {
        text: '“Trước đây phát hiện thất lạc thì hàng đã mất dấu mấy ngày. Giờ sáng nào cũng có danh sách chuyến cần kiểm.”',
        source: 'Trưởng phòng vận hành · bưu cục thí điểm Đà Nẵng',
      },
      {
        text: '“Không phải mua thêm máy quét là điểm khiến chúng tôi đồng ý thử.”',
        source: 'Ban Công nghệ · Tổng công ty Bưu điện',
      },
    ],
    vision: 'Mỗi kiện hàng ở Việt Nam đều truy được tới người cầm nó cuối cùng.',
    quarter: {
      label: 'Cập nhật · Q3 2026',
      figures: [
        { value: '1,2 triệu', delta: '+193%', label: 'kiện được truy vết trong quý' },
        { value: '1,4%', delta: '−13%', label: 'tỉ lệ hao hụt tại bưu cục thí điểm, từ 2,1%' },
        { value: '6', delta: '+4', label: 'bưu cục đang dùng' },
      ],
    },
    funding: {
      rows: [
        { label: 'Vòng', value: 'Seed' },
        { label: 'Đang gọi', value: '5 tỷ đồng' },
        { label: 'Đã cam kết', value: '2 tỷ đồng · iHUB Ventures' },
        { label: 'Định giá', value: 'Trao đổi trực tiếp' },
      ],
      progress: 0.4,
    },
    milestones: [
      { title: 'Thắng Chuyển đổi số logistics 2026', meta: 'Chương trình · 06/2026' },
      { title: 'Danh mục iHUB Ventures', meta: 'Đầu tư · 03/2026' },
      { title: 'Hợp đồng thử nghiệm', meta: 'Tổng công ty Bưu điện Việt Nam · 09/2026' },
    ],
    needs: [
      'Kỹ sư dữ liệu (toàn thời gian)',
      'Giới thiệu doanh nghiệp chuyển phát miền Nam',
      'Cố vấn mở rộng thị trường',
    ],
  },
  // 1Hub - Smart Campus Solution (1hub-smart-campus-solution), PRODUCT-DETAIL-SMART-CAMPUS-01.
  // Workbook "1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx" (sha256
  // 4b023eaf…), "Sản phẩm chi tiết" r3, the USE blocks of
  // docs/data/product-detail-readiness-audit.md, as written: slogan H, one-line
  // description I, problem N, solution O, vision R, needs M, site B; stage
  // "Thử nghiệm" by PO decision. Not used (quarantined or held): founding
  // date E, funding F/K, highlights J, milestones L, market P, metrics W–Y,
  // customer voice Q, updates Z (held: dated plan / log, PO review pending).
  '0e366810-36ac-4de2-923a-fe5929cb02e3': {
    focus: 'Smart Campus Today. Smart Society Tomorrow.',
    tagline:
      '1Hub là nền tảng kết nối danh tính số đáng tin cậy với các tiện ích và cơ hội trong một hệ sinh thái thống nhất, bắt đầu từ đời sống sinh viên và Smart Campus.',
    stageLabel: 'Thử nghiệm',
    website: { href: 'https://1hub.global/en', label: '1hub.global' },
    // "Đội ngũ" S3–U3 (name - role).
    team: [
      { name: 'Nguyễn Quang Dũng', role: 'Tổng Giám đốc' },
      { name: 'Nguyễn Duy Thanh', role: 'Giám đốc Công nghệ' },
      { name: 'Vũ Tuấn Anh', role: 'Giám đốc Marketing' },
    ],
    problem: {
      text: null,
      figures: [],
      items: [
        {
          title: 'Retention',
          text: 'Người dùng thiếu lý do để chủ động quay lại thường xuyên sau khi đăng ký, xác thực hoặc check-in.',
        },
        {
          title: 'Use case',
          text: 'Cần kiểm chứng những tiện ích giải quyết nhu cầu thực tế trong học tập và đời sống, giúp sinh viên thấy rõ giá trị của 1Hub.',
        },
      ],
    },
    solution: {
      text: null,
      features: [
        {
          title: 'Retention',
          text: 'Tạo lý do quay lại qua tiến độ học tập, kết quả giao–nhận việc và theo dõi hoàn tiền; kết hợp cộng đồng và nhắc việc phù hợp.',
        },
        {
          title: 'Use case',
          text: 'Tích hợp mini-app phục vụ học tập, việc nhỏ và mua sắm trên cùng một danh tính đã xác thực, giúp sinh viên tiếp cận tiện ích thuận tiện hơn.',
        },
      ],
    },
    quotes: [],
    vision:
      'Từ Smart Campus đến Smart Society: giúp mỗi người được nhận diện đúng, kết nối đúng và tiếp cận những dịch vụ, quyền lợi, cơ hội phù hợp thông qua danh tính số đáng tin cậy.',
    milestones: [],
    needs: [
      'Kết nối đối tác trường học và đơn vị phát triển mini-app; tìm giải pháp giúp người dùng quay lại thường xuyên, tăng tương tác và cải thiện khả năng giữ chân. Đây cũng là bài toán 1Hub công bố trên nền tảng HUB.',
    ],
  },
}

export function startupOverview(ventureId: string): StartupOverview | null {
  return STARTUP_OVERVIEWS[ventureId] ?? null
}
