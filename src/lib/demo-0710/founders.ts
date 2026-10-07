import { DEMO } from './ventures'

/**
 * DEMO-0710 — the founder allow-list and the read-only presentation of the
 * demo founder profiles (DM13, docs/demo-0710/DEMO_DATA_CONTRACT.md).
 *
 * - The allow-list is the ONLY way into `/talents/[handle]` (DEMO-D5): a
 *   fixed public handle → the canonical demo profile id. The id never leaves
 *   the server; any other handle is 404 and a real profile never renders.
 * - Name, headline, region, bio and ventures come from the canonical profile
 *   and memberships; this file only adds what has no canonical public field:
 *   experience, education, expertise, certificates and HUB badges as drawn.
 * - `identityVerifiedDemo` is the "Đã xác thực danh tính qua 1Hub" state.
 *   DEMO STATE ONLY (DEMO-D10, DEC-DEMO-D3): no verification exists, nothing
 *   is stored, it grants no role or permission.
 * - A HUB badge is presentation text; it is not a membership, leadership or
 *   role record and grants nothing.
 * - `audience: 'NETWORK'` marks a real person (TALENT-TUAN-ANH-MEMBER-ACCOUNT-01):
 *   the profile is NETWORK_ONLY, so the route is 404 for a guest, and a real
 *   person is never listed among, nor given, the demo "other founders".
 *
 * Server-side only.
 */

export type DemoBadge = {
  title: string
  note: string
  mark: 'diamond' | 'dot'
  tone: 'coral' | 'wine' | 'dark'
}

export type DemoFounder = {
  /** Canonical profile id. Never rendered. */
  profileId: string
  /** 'NETWORK': a real, NETWORK_ONLY person; absent: a fictional demo founder (public). */
  audience?: 'NETWORK'
  identityVerifiedDemo: boolean
  /** Presentation line beside the region (DM13 "Phó Chủ tịch chapter Đà Nẵng"). */
  hubRole: string | null
  badges: DemoBadge[]
  tags: string[]
  experience: Array<{
    mark: string
    title: string
    org: string
    period: string
    points: string[]
  }>
  /** A null field is empty in the source and is not drawn. */
  education: Array<{ mark: string; school: string; degree: string; period: string | null }>
  expertise: Array<{ name: string; level: 'Chính' | 'Phụ' | null; years: string | null }>
  certificates: Array<{ mark: string; name: string; issuer: string | null; period: string | null }>
}

const EMPTY = {
  hubRole: null,
  badges: [],
  tags: [],
  experience: [],
  education: [],
  expertise: [],
  certificates: [],
} satisfies Partial<DemoFounder>

export const DEMO_FOUNDERS: Readonly<Record<string, DemoFounder>> = {
  // Đặng Kim Chi, Tracely — the journey anchor, copy as drawn on DM13.
  'dang-kim-chi': {
    profileId: 'de710000-0000-0000-0000-0000000000b1',
    identityVerifiedDemo: true,
    hubRole: 'Phó Chủ tịch chapter Đà Nẵng',
    badges: [
      { title: 'Phó Chủ tịch', note: 'Chapter Đà Nẵng', mark: 'diamond', tone: 'coral' },
      { title: 'Thành viên', note: 'từ 2024', mark: 'diamond', tone: 'wine' },
      { title: 'Diễn giả', note: 'Summit Đà Nẵng 2025', mark: 'dot', tone: 'dark' },
      { title: 'Cố vấn', note: 'Workshop 10/2026', mark: 'dot', tone: 'dark' },
    ],
    tags: ['Vận hành chuỗi cung ứng', 'Logistics', 'Phân tích dữ liệu'],
    experience: [
      {
        mark: 'TR',
        title: 'Đồng sáng lập · CEO',
        org: 'Tracely · Toàn thời gian',
        period: '02/2024 – nay · Đà Nẵng',
        points: ['Dẫn đội 6 người, sản phẩm truy xuất nguồn gốc cho hợp tác xã nông sản'],
      },
      {
        mark: 'LM',
        title: 'Trưởng phòng vận hành',
        org: 'Công ty Logistics Mekong · Toàn thời gian',
        period: '06/2019 – 01/2024 · 4 năm 8 tháng · Cần Thơ',
        points: [
          'Phụ trách 4 kho lạnh và đội xe 38 đầu kéo',
          'Xây lại quy trình điều xe, giảm thời gian chờ tại cảng từ 5,5 xuống 3,2 giờ',
        ],
      },
      {
        mark: 'BĐ',
        title: 'Điều phối khai thác',
        org: 'Bưu điện Đà Nẵng · Toàn thời gian',
        period: '08/2016 – 05/2019 · 2 năm 10 tháng · Đà Nẵng',
        points: [],
      },
    ],
    education: [
      {
        mark: 'ĐH',
        school: 'Đại học Bách khoa Đà Nẵng',
        degree: 'Kỹ sư · Kỹ thuật hệ thống công nghiệp',
        period: '2012 – 2016',
      },
      {
        mark: 'KT',
        school: 'Đại học Kinh tế TP.HCM',
        degree: 'Thạc sĩ · Quản trị chuỗi cung ứng',
        period: '2020 – 2022 · vừa làm vừa học',
      },
    ],
    expertise: [
      { name: 'Vận hành chuỗi cung ứng', level: 'Chính', years: '8 năm' },
      { name: 'Phân tích dữ liệu vận hành', level: 'Chính', years: '5 năm' },
      { name: 'Quản lý sản phẩm', level: 'Phụ', years: '3 năm' },
      { name: 'Thương lượng hợp đồng B2B', level: 'Phụ', years: '3 năm' },
    ],
    certificates: [
      {
        mark: 'CS',
        name: 'CSCP · Certified Supply Chain Professional',
        issuer: 'APICS',
        period: 'Cấp 03/2021 · hết hạn 03/2026',
      },
      {
        mark: 'DA',
        name: 'Data Analytics cho vận hành',
        issuer: 'Google · Coursera',
        period: 'Cấp 11/2022 · không hết hạn',
      },
    ],
  },
  // The other demo founders (DM13 "Nhà sáng lập khác"): canonical data only.
  'nguyen-minh-anh': {
    profileId: 'de710000-0000-0000-0000-0000000000b2',
    identityVerifiedDemo: false,
    ...EMPTY,
  },
  'vo-thanh-ha': {
    profileId: 'de710000-0000-0000-0000-0000000000b6',
    identityVerifiedDemo: false,
    ...EMPTY,
  },
  'ly-gia-bao': {
    profileId: 'de710000-0000-0000-0000-0000000000b5',
    identityVerifiedDemo: true,
    ...EMPTY,
  },
  // Vũ Tuấn Anh — a real person, NETWORK_ONLY (TALENT-TUAN-ANH-MEMBER-ACCOUNT-01).
  // Workbook "1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx" (sha256
  // 4b023eaf…), sheet "Nhân tài chi tiết", row 4, as written. Name, title
  // ("CMO 1hub"), region, bio and the Smart Campus membership are canonical
  // rows. "Vai trò tại HUB Network?" = N/A: no HUB role. No avatar or cover in
  // the source; no verification claim. Empty source cells stay empty.
  'vu-tuan-anh': {
    profileId: '7a1e0000-0000-4000-8000-0000000000b1',
    audience: 'NETWORK',
    identityVerifiedDemo: false,
    hubRole: null,
    badges: [],
    tags: ['Tài chính', 'Công nghệ'],
    experience: [
      {
        mark: 'ID',
        title: 'External Affairs & Communications Associate',
        org: 'Quỹ Đầu tư IDGX · Full-time',
        period: '07/2025 - 02/2026',
        points: [],
      },
      {
        mark: 'IM',
        title: 'Co-Owner & Content Operations Lead',
        org: 'Independent Media Venture · Full-time',
        period: '10/2021 - 12/2024',
        points: [],
      },
    ],
    education: [{ mark: 'RM', school: 'RMIT', degree: 'Cử nhân · Truyền thông', period: null }],
    expertise: [
      { name: 'Đầu tư', level: null, years: null },
      { name: 'Công nghệ', level: null, years: null },
      { name: 'Truyền thông', level: null, years: null },
    ],
    certificates: [
      { mark: 'EN', name: 'English: Full Professional Proficiency', issuer: null, period: null },
    ],
  },
}

/** The DEMO marker carried by the verified state (`data-demo`). */
export const VERIFIED_DEMO_MARKER = DEMO

export function demoFounder(handle: string): DemoFounder | null {
  return Object.hasOwn(DEMO_FOUNDERS, handle) ? DEMO_FOUNDERS[handle]! : null
}

/** The founder route of an allow-listed profile, or null (plain text, DEC-AIG-D1). */
export function founderHref(profileId: string): string | null {
  for (const [handle, f] of Object.entries(DEMO_FOUNDERS))
    if (f.profileId === profileId) return `/talents/${handle}`
  return null
}
