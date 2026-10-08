/**
 * S2-PROGRAMME-EVENT-CONTENT-01 — the PO's programme / event sheet
 * ("1hub.network - Chương trình cuộc thi, Sự kiện", Google Sheet
 * 1Xx1dNIO0RBWrZlN0cd9Y1GnrSFcJQGSlhk7UL012BzU, export sha256 86318220…),
 * the one content source of `/programmes` (its finished programmes) and
 * `/events`. Every value is the sheet's text as written (multi-line cells
 * split into lines); a field the sheet leaves empty is null and never filled
 * in. Pictures are the sheet's own Drive files, optimised to WebP
 * (provenance: docs/data/programme-event-assets-provenance.json).
 *
 * Known gaps, kept as gaps: upcoming dates carry no year; one past event has
 * no valid date ("21/22/2024", omitted); finished programmes have no dates and
 * no type. The sheet's "Link liên quan" and "Vai trò HUB" of past events are
 * marked "(bỏ)" and are not carried.
 */

export type PastProgramme = {
  slug: string
  title: string
  /** "Đơn vị tổ chức", one organiser per line. */
  owners: string[]
  description: string | null
  domain: string | null
  image: string | null
}

export type UpcomingEvent = {
  slug: string
  name: string
  /** "Thời gian", as written. */
  time: string | null
  /** "Ngày tháng" as written: day/month, no year in the source. */
  date: string
  organizer: string | null
  /** "Thông tin khác": the first (featured) block only. */
  info: string | null
  venue: string | null
  hubRole: string | null
  status: string | null
  seats: string | null
  image: string | null
}

export type PastEvent = {
  slug: string
  name: string
  time: string | null
  /** "Ngày tháng" as written; null where the source value is not a date. */
  date: string | null
  /** ISO start day, for ordering only. */
  start: string | null
  /** The first line of "Đơn vị tổ chức" (the sheet's own rule). */
  organizer: string | null
  venue: string | null
  image: string | null
}

/** "Chương trình" rows with Trạng thái "Đã kết thúc", in sheet order. */
export const PAST_PROGRAMMES: PastProgramme[] = [
  {
    slug: 'hackathon-build-hub-2026',
    title: 'Hackathon Build@HUB 2026',
    owners: ['HUB Network HighSchool'],
    description:
      'Hackathon của cộng đồng HUB Network, nơi các đội xây dựng sản phẩm mẫu trong thời gian ngắn, giải các bài toán do doanh nghiệp và thành phố đặt ra.',
    domain: 'Đa lĩnh vực',
    image: '/programmes/past/hackathon-build-hub-2026.webp',
  },
  {
    slug: 'hackathon-cardano-sea-2026',
    title: 'Hackathon Cardano Sea 2026',
    owners: ['HUB Network HCMC'],
    description:
      'Hackathon khu vực Đông Nam Á cho lập trình viên xây dựng ứng dụng phi tập trung trên blockchain Cardano.',
    domain: 'Blockchain & Web3',
    image: '/programmes/past/hackathon-cardano-sea-2026.webp',
  },
  {
    slug: 'chuong-trinh-uom-tao-venturex-2025',
    title: 'Chương trình ươm tạo VENTUREX 2025',
    owners: [
      'HUB Network',
      'CLB Khởi nghiệp sáng tạo Đại học Bách khoa Hà Nội (HIEC)',
      'Trung tâm Khởi nghiệp trường Đại học VinUni (Entrepreneurship Lab - ELAB)',
    ],
    description:
      'Chương trình ươm tạo startup trẻ từ Đại học Bách khoa Hà Nội và trường Đại học VinUni',
    domain: 'Đa lĩnh vực',
    image: '/programmes/past/chuong-trinh-uom-tao-venturex-2025.webp',
  },
  {
    slug: 'chuong-trinh-dao-tao-hub-genai-future-founders-2025',
    title: 'Chương trình đào tạo HUB GENAI FUTURE FOUNDERS 2025',
    owners: [
      'HUB Network',
      'TNEX',
      'NTI',
      'Trung tâm Khởi nghiệp trường Đại học VinUni (Entrepreneurship Lab - ELAB)',
      'Trung tâm Sáng tạo & Khởi nghiệp Sinh viên – Đại học Bách khoa Hà Nội',
    ],
    description:
      'Chương trình đào tạo founder trẻ ứng dụng AI tạo sinh để xây dựng sản phẩm và vận hành startup tinh gọn.',
    domain: 'AI',
    image: '/programmes/past/chuong-trinh-dao-tao-hub-genai-future-founders-2025.webp',
  },
  {
    slug: 'thu-thach-kinh-doanh-vinfast-x-hub-network-business-challenge-2025',
    title: 'Thử thách kinh doanh VINFAST x HUB Network Business Challenge 2025',
    owners: ['HUB Network Hà Nội x VINFAST'],
    description:
      'Thử thách kinh doanh để sinh viên và người trẻ đề xuất giải pháp về giao thông xanh, xe điện và hệ sinh thái di chuyển thông minh.',
    domain: 'Năng lượng',
    image:
      '/programmes/past/thu-thach-kinh-doanh-vinfast-x-hub-network-business-challenge-2025.webp',
  },
  {
    slug: 'cuoc-thi-san-pham-doi-moi-sang-tao-va-chuyen-doi-so-thu-do-sao-kim-2025',
    title: 'Cuôc thi sản phẩm đổi mới sáng tạo và chuyển đổi số Thủ đô (Sao Kim) 2025',
    owners: ['Thành đoàn Hà Nội', 'HUB Network Hà Nội'],
    description:
      'Cuộc thi tôn vinh sản phẩm, giải pháp đổi mới sáng tạo và chuyển đổi số tiêu biểu đóng góp cho phát triển Thủ đô Hà Nội.',
    domain: 'Chuyển đổi số',
    image:
      '/programmes/past/cuoc-thi-san-pham-doi-moi-sang-tao-va-chuyen-doi-so-thu-do-sao-kim-2025.webp',
  },
  {
    slug: 'cuoc-thi-khoi-nghiep-viet-uc-crossnovation-2024',
    title: 'Cuộc thi khởi nghiệp Việt - Úc Crossnovation 2024',
    owners: ['HUB Network Úc', 'Hội Du học sinh Việt Nam tại tiểu bang New South Wales (UAVS)'],
    description: 'Nơi tranh tài các startup Việt tại Úc',
    domain: 'Đa lĩnh vực',
    image: '/programmes/past/cuoc-thi-khoi-nghiep-viet-uc-crossnovation-2024.webp',
  },
  {
    slug: 'thu-thach-khoi-nghiep-viet-toan-cau-hub-challenge-2024',
    title: 'Thử thách Khởi nghiệp Việt toàn cầu HUB Challenge 2024',
    owners: ['HUB Network', 'Thành đoàn Hà Nội'],
    description:
      'Thử thách kết nối founder và startup người Việt trên toàn cầu, tìm kiếm dự án có tiềm năng phát triển tại Việt Nam và quốc tế.',
    domain: 'Đa lĩnh vực',
    image: '/programmes/past/thu-thach-khoi-nghiep-viet-toan-cau-hub-challenge-2024.webp',
  },
]

/** "Sự kiện sắp tới", in sheet order (STT). */
export const UPCOMING_EVENTS: UpcomingEvent[] = [
  {
    slug: 'ihub-ventures-partners-gathering',
    name: 'iHUB Ventures Partners Gathering',
    time: '18:30 - 21:00',
    date: '29/10',
    organizer: 'Quỹ đầu tư iHUB Ventures',
    info: '17/50 người đã đăng ký',
    venue: 'Khách sạn Metropole, Hà Nội',
    hubRole: 'Đối tác hệ sinh thái',
    status: 'Khách mời VIP',
    seats: null,
    image: '/events/ihub-ventures-partners-gathering.webp',
  },
  {
    slug: 'young-founders-workshop-tu-y-tuong-den-san-pham-dau-tien',
    name: 'Young Founders Workshop: Từ ý tưởng đến sản phẩm đầu tiên',
    time: '8:30',
    date: '30/10',
    organizer: 'HUB Network HighSchool',
    info: null,
    venue: 'Trực tuyến',
    hubRole: 'Chương trình cộng đồng HUB Network',
    status: 'Đang mở đăng ký',
    seats: 'Còn 50 chỗ',
    image: '/events/young-founders-workshop-tu-y-tuong-den-san-pham-dau-tien.webp',
  },
  {
    slug: 'hcm-startup-night-ung-dung-ai-cho-doanh-nghiep-sme',
    name: 'HCM Startup Night: Ứng dụng AI cho doanh nghiệp SME',
    time: '19:00',
    date: '30/10',
    organizer: 'HUB Network HCM',
    info: null,
    venue: 'Trung tâm Khởi nghiệp Đổi mới sáng tạo TP.HCM (SIHUB)',
    hubRole: 'Chương trình cộng đồng HUB Network',
    status: 'Đang mở đăng ký',
    seats: 'Còn 67 chỗ',
    image: '/events/hcm-startup-night-ung-dung-ai-cho-doanh-nghiep-sme.webp',
  },
  {
    slug: 'chung-ket-cuoc-thi-khoi-nghiep-viet-uc-innoventures',
    name: 'Chung kết Cuộc thi khởi nghiệp Việt - Úc InnoVentures',
    time: '13:30',
    date: '31/10',
    organizer: 'HUB Network Úc',
    info: null,
    venue: 'Sydney Startup Hub, 11 York Street, Sydney NSW 2000',
    hubRole: 'Cuộc thi InnoVentures',
    status: 'Đang mở đăng ký',
    seats: 'Còn 32 chỗ',
    image: '/events/chung-ket-cuoc-thi-khoi-nghiep-viet-uc-innoventures.webp',
  },
  {
    slug: 'career-startup-day-vietnamese-talents-in-singapore',
    name: 'Career & Startup Day: Vietnamese Talents in Singapore',
    time: '19:30',
    date: '6/11',
    organizer: 'HUB Network Singapore, Hội sinh viên Việt Nam tại Singapore',
    info: null,
    venue: 'BLOCK71 Singapore, 71 Ayer Rajah Crescent, Singapore 139951',
    hubRole: 'Chương trình cộng đồng HUB Network',
    status: 'Đang mở đăng ký',
    seats: 'Còn 150 chỗ',
    image: '/events/career-startup-day-vietnamese-talents-in-singapore.webp',
  },
  {
    slug: 'deep-tech-demo-day-healthtech-smart-mobility',
    name: 'Deep Tech Demo Day: Healthtech & Smart Mobility',
    time: '9:00',
    date: '14/11',
    organizer: 'e-Lab VinUniversity',
    info: null,
    venue: 'VinUniversity, Vinhomes Ocean Park, Gia Lâm, Hà Nội',
    hubRole: 'Đối tác hệ sinh thái',
    status: 'Sắp công bố',
    seats: null,
    image: '/events/deep-tech-demo-day-healthtech-smart-mobility.webp',
  },
  {
    slug: 'hop-bao-cuoc-thi-khoi-nghiep-cung-kawai-2027',
    name: 'Họp báo Cuộc thi Khởi nghiệp cùng Kawai 2027',
    time: '8:30',
    date: '23/11',
    organizer: 'CLB Nhà doanh nhân Tương lai (TEC FTU)',
    info: null,
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    hubRole: 'Cuộc thi Khởi nghiệp cùng Kawai',
    status: 'Sắp công bố',
    seats: null,
    image: '/events/hop-bao-cuoc-thi-khoi-nghiep-cung-kawai-2027.webp',
  },
]

/** "Sự kiện đã tổ chức", in sheet order. */
export const PAST_EVENTS: PastEvent[] = [
  {
    slug: 'surf-2026-ngay-hoi-khoi-nghiep-doi-moi-sang-tao-da-nang',
    name: 'SURF 2026 – Ngày hội Khởi nghiệp Đổi mới Sáng tạo Đà Nẵng',
    time: '9:00 - 21:00',
    date: '18/8 - 19/8/2026',
    start: '2026-08-18',
    organizer: 'Sở Khoa học và Công nghệ thành phố Đà Nẵng',
    venue: 'Cung Hội nghị Quốc tế Furama Đà Nẵng',
    image: '/events/past/surf-2026-ngay-hoi-khoi-nghiep-doi-moi-sang-tao-da-nang.webp',
  },
  {
    slug: 'hub-forum-ha-noi-2026-inflection-point-for-innovation',
    name: 'HUB Forum Hà Nội 2026 - Inflection Point for Innovation',
    time: '14:00',
    date: '28/06/2026',
    start: '2026-06-28',
    organizer: 'HUB Network Hà Nội',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image: '/events/past/hub-forum-ha-noi-2026-inflection-point-for-innovation.webp',
  },
  {
    slug: 'hub-network-china-networking-giao-luu-ket-noi-chia-se-viet-trung',
    name: 'HUB Network China networking: Giao lưu - Kết nối - Chia sẻ Việt - Trung',
    time: '15:00',
    date: '22/08/2026',
    start: '2026-08-22',
    organizer: 'HUB Network China',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image: '/events/past/hub-network-china-networking-giao-luu-ket-noi-chia-se-viet-trung.webp',
  },
  {
    slug: 'hub-forum-hcm-2026-accelerating-startup-with-ai-co-founder',
    name: 'HUB Forum HCM 2026: Accelerating Startup with AI Co-founder',
    time: '13:30',
    date: '08/05/2026',
    start: '2026-05-08',
    organizer: 'HUB Network HCMC',
    venue: 'Trường Đại học Nguyễn Tất Thành, TP. HCM',
    image: '/events/past/hub-forum-hcm-2026-accelerating-startup-with-ai-co-founder.webp',
  },
  {
    slug: 'hub-forum-da-nang-2026-startup-in-the-age-of-ai-blockchain',
    name: 'HUB Forum Đà Nẵng 2026 - Startup in the Age of AI & Blockchain',
    time: '13:30',
    date: '09/05/2026',
    start: '2026-05-09',
    organizer: 'HUB Network Đà Nẵng',
    venue: 'Trường Đại học Sư phạm Đà Nẵng, Đại học Đà Nẵng',
    image: '/events/past/hub-forum-da-nang-2026-startup-in-the-age-of-ai-blockchain.webp',
  },
  {
    slug: 'university-meetup-2-due',
    name: 'UNIVERSITY MEETUP #2 DUE',
    time: '19:00',
    date: '9/1/2026',
    start: '2026-01-09',
    organizer: 'Cardano Vietnam',
    venue: 'Đại học Kinh tế – Đại học Đà Nẵng (DUE), Đà Nẵng',
    image: '/events/past/university-meetup-2-due.webp',
  },
  {
    slug: 'unitour-meetup-3-hou-kich-hoat-master-chip-dinh-vi-ban-than-trong-ky-nguyen-so',
    name: 'UNITOUR MEETUP #3 HOU: "Kích hoạt Master Chip - Định vị bản thân trong kỷ nguyên số"',
    time: '8:00',
    date: '10/1/2026',
    start: '2026-01-10',
    organizer: 'Cardano Vietnam',
    venue: 'Đại học Mở Hà Nội, Hà Nội',
    image:
      '/events/past/unitour-meetup-3-hou-kich-hoat-master-chip-dinh-vi-ban-than-trong-ky-nguyen-so.webp',
  },
  {
    slug: 'demo-day-venturex-le-cong-bo-hop-tac-vuon-uom-ihub-va-cac-doi-tac',
    name: 'Demo Day VentureX · Lễ Công bố hợp tác Vườn ươm iHUB và các đối tác',
    time: '13:00',
    date: '17/01/2026',
    start: '2026-01-17',
    organizer: 'Trung tâm Khởi nghiệp trường Đại học VinUni (Entrepreneurship Lab - ELAB)',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image: '/events/past/demo-day-venturex-le-cong-bo-hop-tac-vuon-uom-ihub-va-cac-doi-tac.webp',
  },
  {
    slug: 'hoi-thao-khoi-nghiep-sang-tao-va-dinh-huong-nghe-nghiep',
    name: 'Hội thảo "Khởi nghiệp sáng tạo và Định hướng nghề nghiệp"',
    time: '19:30',
    date: '2/2/2026',
    start: '2026-02-02',
    organizer: 'Trung tâm Đổi mới sáng tạo và Khởi nghiệp (IEC PTIT)',
    venue: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Hà Nội',
    image: '/events/past/hoi-thao-khoi-nghiep-sang-tao-va-dinh-huong-nghe-nghiep.webp',
  },
  {
    slug: 'hub-network-year-end-party-2025',
    name: 'HUB NETWORK YEAR END PARTY 2025',
    time: '19:00',
    date: '5/2/2026',
    start: '2026-02-05',
    organizer: 'HUB Network',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image: '/events/past/hub-network-year-end-party-2025.webp',
  },
  {
    slug: 'hub-high-school-2026-spring-onboarding',
    name: 'HUB HIGH SCHOOL 2026: SPRING ONBOARDING',
    time: '14:00',
    date: '28/02/2026',
    start: '2026-02-28',
    organizer: 'HUB Network HighSchool',
    venue: 'HUB Building, D12 Giảng Võ, Hà Nội',
    image: '/events/past/hub-high-school-2026-spring-onboarding.webp',
  },
  {
    slug: 'workshop-khoi-nghiep-trong-cong-nghiep-sang-tao-co-hoi-va-thach-thuc',
    name: 'Workshop “Khởi nghiệp trong Công nghiệp sáng tạo – Cơ hội và Thách thức',
    time: '9:00',
    date: '16/04/2026',
    start: '2026-04-16',
    organizer: 'Học viện Ngoại giao',
    venue: 'Học viện Ngoại giao, Hà Nội',
    image: '/events/past/workshop-khoi-nghiep-trong-cong-nghiep-sang-tao-co-hoi-va-thach-thuc.webp',
  },
  {
    slug: 'ausventure-triotour-1',
    name: 'Ausventure Triotour #1',
    time: '15:00',
    date: '13/06/2026',
    start: '2026-06-13',
    organizer: 'HUB Network AU',
    venue:
      'SSB Lecture Theatre 200 (Social Sciences Building, The University of Sydney, Camperdown NSW 2050)',
    image: '/events/past/ausventure-triotour-1.webp',
  },
  {
    slug: 'workshop-nang-tam-tinh-hoa-viet',
    name: 'Workshop "Nâng Tầm Tinh Hoa Việt"',
    time: '14:00',
    date: '14/06/2026',
    start: '2026-06-14',
    organizer: 'Greenwich Việt Nam - Greenwich Business Club (GreBiz)',
    venue: 'Hội trường tầng 2, 658 Ngô Quyền, Sơn Trà, Đà Nẵng',
    image: '/events/past/workshop-nang-tam-tinh-hoa-viet.webp',
  },
  {
    slug: 'ausventure-triotour-2',
    name: 'Ausventure Triotour #2',
    time: '15:00',
    date: '19/07/2026',
    start: '2026-07-19',
    organizer: 'HUB Network AU',
    venue:
      '401.G013 Agriculture North. Alan Robson Lecture Theatre, The University of Western Australia',
    image: '/events/past/ausventure-triotour-2.webp',
  },
  {
    slug: 'privacy-builder-meetup',
    name: 'Privacy Builder Meetup',
    time: '15:00',
    date: '30/07/2026',
    start: '2026-07-30',
    organizer: 'HUB Network HCMC',
    venue: 'TP. HCM',
    image: '/events/past/privacy-builder-meetup.webp',
  },
  {
    slug: 'workshop-thanh-nien-hanh-dong-vi-do-thi-ket-hop-di-san-van-hoa-va-hanh-dong-khi-hau',
    name: 'Workshop: "Thanh niên hành động vì đô thị: Kết hợp di sản văn hoá và hành động khí hậu"',
    time: '14:30',
    date: '26/07/2026',
    start: '2026-07-26',
    organizer: 'YUSEA, HUB Network',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image:
      '/events/past/workshop-thanh-nien-hanh-dong-vi-do-thi-ket-hop-di-san-van-hoa-va-hanh-dong-khi-hau.webp',
  },
  {
    slug: 'ihub-ventures-europe-innovation-challenge-nexus-camp-2026-satellite-mini-hackathon',
    name: 'iHUB Ventures Europe Innovation Challenge - NEXUS CAMP 2026 Satellite Mini-Hackathon',
    time: '9:00',
    date: '28/08/2026 - 30/08/2026',
    start: '2026-08-28',
    organizer: 'Hội sinh viên Việt Nam tại Italia',
    venue: 'Link Campus University, Roma, Italia',
    image:
      '/events/past/ihub-ventures-europe-innovation-challenge-nexus-camp-2026-satellite-mini-hackathon.webp',
  },
  {
    slug: 'talkshow-netzero-youth-suc-tre-dan-loi-cham-xanh',
    name: 'Talkshow NetZero Youth: Sức trẻ dẫn lối chạm xanh',
    time: '9:00',
    date: '24/08/2025',
    start: '2025-08-24',
    organizer: 'HUB Network Hà Nội',
    venue: 'ConsHub – Trung tâm Hội nghị Quốc gia, Hà Nội',
    image: '/events/past/talkshow-netzero-youth-suc-tre-dan-loi-cham-xanh.webp',
  },
  {
    slug: 'incubator-summit-x-blockstar-incubation-program-trong-khuon-kho-gm-vietnam-2025',
    name: 'Incubator Summit x BlockStar Incubation Program trong khuôn khổ GM Vietnam 2025',
    time: '15:00',
    date: '2/8/2025',
    start: '2025-08-02',
    organizer: 'HUB Network',
    venue: 'Trung tâm Hội nghị Quốc gia, Hà Nội',
    image:
      '/events/past/incubator-summit-x-blockstar-incubation-program-trong-khuon-kho-gm-vietnam-2025.webp',
  },
  {
    slug: 'chung-ket-cuoc-thi-pitch-your-future-khoi-nghiep-khong-kho-khi-co-ai',
    name: 'Chung kết Cuộc thi "Pitch your Future: Khởi nghiệp không khó khi có AI"',
    time: '9:00',
    date: '14/06/2025',
    start: '2025-06-14',
    organizer: 'HUB Network China',
    venue: 'Thượng Hải',
    image: '/events/past/chung-ket-cuoc-thi-pitch-your-future-khoi-nghiep-khong-kho-khi-co-ai.webp',
  },
  {
    slug: 'hub-forum-ha-noi-2025-the-next-challenge-chung-ket-vinfast-x-hub-network-business-challenge',
    name: 'HUB Forum Hà Nội 2025 - The Next Challenge · Chung kết VINFAST x HUB Network Business Challenge',
    time: '13:30',
    date: '30/6/2025',
    start: '2025-06-30',
    organizer: 'HUB Network Hà Nội',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image:
      '/events/past/hub-forum-ha-noi-2025-the-next-challenge-chung-ket-vinfast-x-hub-network-business-challenge.webp',
  },
  {
    slug: 'ban-ket-vinfast-x-hub-network-business-challenge',
    name: 'Bán kết  VINFAST x HUB Network Business Challenge',
    time: '13:30',
    date: '20/6/2025',
    start: '2025-06-20',
    organizer: 'HUB Network Hà Nội',
    venue: 'Trụ sở VINFAST, Hà Nội',
    image: '/events/past/ban-ket-vinfast-x-hub-network-business-challenge.webp',
  },
  {
    slug: 'company-tour-vinfast-x-hub-network-business-challenge',
    name: 'Company Tour VINFAST x HUB Network Business Challenge',
    time: '8:00',
    date: '1/7/2025',
    start: '2025-07-01',
    organizer: 'HUB Network Hà Nội',
    venue: 'Nhà máy VINFAST, Hải Phòng',
    image: '/events/past/company-tour-vinfast-x-hub-network-business-challenge.webp',
  },
  {
    slug: 'hub-forum-da-nang-2025',
    name: 'HUB Forum Đà Nẵng 2025',
    time: '13:30',
    date: '17/5/2025',
    start: '2025-05-17',
    organizer: 'HUB Network Đà Nẵng',
    venue: 'Đại học Duy Tân, Đà Nẵng',
    image: '/events/past/hub-forum-da-nang-2025.webp',
  },
  {
    slug: 'hub-forum-hcm-2025',
    name: 'HUB Forum HCM 2025',
    time: '13:30',
    date: '12/4/2025',
    start: '2025-04-12',
    organizer: 'HUB Network HCMC',
    venue: 'Trường Đại học Nguyễn Tất Thành, TP. HCM',
    image: '/events/past/hub-forum-hcm-2025.webp',
  },
  {
    slug: 'khai-giang-khoa-hoc-hub-genai-future-founders-2025-phat-dong-chuong-trinh-uom-tao-venturex-2025',
    name: 'Khai giảng khóa học HUB GENAI FUTURE FOUNDERS 2025 & Phát động Chương trình ươm tạo VENTUREX 2025',
    time: '9:00',
    date: '29/3/2025',
    start: '2025-03-29',
    organizer: 'HUB Network',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image:
      '/events/past/khai-giang-khoa-hoc-hub-genai-future-founders-2025-phat-dong-chuong-trinh-uom-tao-venturex-2025.webp',
  },
  {
    slug: 'hub-network-year-end-party-2024',
    name: 'HUB NETWORK YEAR END PARTY 2024',
    time: '19:00',
    date: '11/1/2025',
    start: '2025-01-11',
    organizer: 'HUB Network',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image: '/events/past/hub-network-year-end-party-2024.webp',
  },
  {
    slug: 'le-phat-dong-hub-challenge-2024',
    name: 'Lễ phát động HUB Challenge 2024',
    time: '9:00',
    date: '26/9/2024',
    start: '2024-09-26',
    organizer: 'HUB Network',
    venue: 'Đại học Bách khoa Hà Nội, Hà Nội',
    image: '/events/past/le-phat-dong-hub-challenge-2024.webp',
  },
  {
    slug: 'ngay-hoi-doi-moi-sang-tao-thu-do-lan-thu-ii-phat-dong-cuoc-thi-thu-thach-khoi-nghiep-viet-toan-cau-lan-thu-vii',
    name: 'Ngày hội đổi mới sáng tạo Thủ đô lần thứ II & Phát động Cuộc thi thử thách Khởi nghiệp Việt toàn cầu lần thứ VII',
    time: '9:00',
    date: '29/8/2024',
    start: '2024-08-29',
    organizer: 'Thành đoàn Hà Nội',
    venue:
      'Trung tâm Đổi mới sáng tạo Quốc gia - NIC Hòa Lạc (Khu công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội)',
    image:
      '/events/past/ngay-hoi-doi-moi-sang-tao-thu-do-lan-thu-ii-phat-dong-cuoc-thi-thu-thach-khoi-nghiep-viet-toan-cau-lan-thu-vii.webp',
  },
  {
    slug: 'hub-forum-2024',
    name: 'HUB Forum 2024',
    time: '9:00',
    date: '29/8/2024',
    start: '2024-08-29',
    organizer: 'HUB Network',
    venue:
      'Trung tâm Đổi mới sáng tạo Quốc gia - NIC Hòa Lạc (Khu công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội)',
    image: '/events/past/hub-forum-2024.webp',
  },
  {
    slug: 'hub-insider-2024-ai-but-pha-tiem-nang-y-te',
    name: 'HUB INSIDER 2024: AI: BỨT PHÁ TIỀM NĂNG Y TẾ',
    time: '19:00',
    date: '17/10/2024',
    start: '2024-10-17',
    organizer: 'HUB Network Hà Nội',
    venue: 'Trường Đại Học Y Hà Nội, Hà Nội',
    image: '/events/past/hub-insider-2024-ai-but-pha-tiem-nang-y-te.webp',
  },
  {
    slug: 'hub-insider-2024-accelerate-ai-startup-spin-off-from-university',
    name: 'HUB INSIDER 2024 - Accelerate AI Startup Spin-off from University',
    time: '19:00',
    date: null,
    start: null,
    organizer: 'HUB Network Hà Nội',
    venue: 'Đại học Phenikaa, Hà Nội',
    image: '/events/past/hub-insider-2024-accelerate-ai-startup-spin-off-from-university.webp',
  },
  {
    slug: 'hub-challenge-demo-day-2024',
    name: 'HUB Challenge Demo Day 2024',
    time: '10:00',
    date: '4/12/2024',
    start: '2024-12-04',
    organizer: 'HUB Network',
    venue: 'Cung Thanh niên Hà Nội, 37 Trần Bình Trọng, Hà Nội',
    image: '/events/past/hub-challenge-demo-day-2024.webp',
  },
  {
    slug: 'founder-s-friday-talkshow-suc-ben-tai-chinh-mo-khoa-tang-truong-ben-vung-cho-startup',
    name: "Founder's Friday Talkshow: Sức bền tài chính - Mở khóa tăng trưởng bền vững cho startup",
    time: '19:00',
    date: '27/9/2024',
    start: '2024-09-27',
    organizer: "Founder's Friday",
    venue: 'Tầng 2, tòa nhà GoldSeason, 47 Nguyễn Tuân, Thanh Xuân, Hà Nội',
    image:
      '/events/past/founder-s-friday-talkshow-suc-ben-tai-chinh-mo-khoa-tang-truong-ben-vung-cho-startup.webp',
  },
  {
    slug: 'founder-s-friday-talkshow-xay-dung-thuong-hieu-ca-nhan-va-startup',
    name: "Founder's Friday Talkshow: Xây dựng thương hiệu cá nhân và startup",
    time: '19:00',
    date: '4/5/2024',
    start: '2024-05-04',
    organizer: "Founder's Friday",
    venue: '1Academy, G2. Five Star Building, Hà Nội',
    image: '/events/past/founder-s-friday-talkshow-xay-dung-thuong-hieu-ca-nhan-va-startup.webp',
  },
  {
    slug: 'chung-ket-cuoc-thi-khoi-nghiep-crossnovation-2024',
    name: 'Chung kết Cuộc thi khởi nghiệp Crossnovation 2024',
    time: '19:00',
    date: '24/10/2024',
    start: '2024-10-24',
    organizer: 'HUB Network Úc',
    venue: 'New South Wales, Úc',
    image: '/events/past/chung-ket-cuoc-thi-khoi-nghiep-crossnovation-2024.webp',
  },
  {
    slug: 'runway-to-web-summit',
    name: 'Runway to Web Summit',
    time: '13:30',
    date: '20/9/2024',
    start: '2024-09-20',
    organizer: 'HUB Network',
    venue: 'HUB Building, D12 Giảng Võ, Hà Nội',
    image: '/events/past/runway-to-web-summit.webp',
  },
  {
    slug: 'hub-forum-hcmc-2024',
    name: 'HUB Forum HCMC 2024',
    time: '14:00',
    date: '14/4/2024',
    start: '2024-04-14',
    organizer: 'HUB Network HCMC',
    venue: 'Trường Đại học Tôn Đức Thắng, TP. HCM',
    image: '/events/past/hub-forum-hcmc-2024.webp',
  },
  {
    slug: 'hub-summit-2023',
    name: 'HUB Summit 2023',
    time: '13:30',
    date: '27/4/2023',
    start: '2023-04-27',
    organizer: 'Thành đoàn Hà Nội',
    venue: 'Khách sạn Metropole Hà Nội, Hà Nội',
    image: '/events/past/hub-summit-2023.webp',
  },
]
