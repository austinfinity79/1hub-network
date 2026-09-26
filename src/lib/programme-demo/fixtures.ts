import type { ProgrammeDemoDetail } from './types'

/**
 * WF04-T00 — the deterministic demo dataset (DỮ LIỆU DEMO), DEC-WF04-T00-D1.
 *
 * Code, not database rows: the demo writes nothing to PostgreSQL and adds no
 * seed (architecture 01 §7). One Programme and one Challenge, both owned by the
 * development fixture organization Chapter 01; names are neutral and marked
 * "(demo)"; no real person, company or roster value; no contact data.
 *
 * Ids use the reserved prefix `d40…` so they never collide with seed or user
 * rows. Every value is fixed; the module is deep-frozen so no request can
 * change it.
 */

export const DEMO_ID_PREFIX = 'd40'

/** Development fixture organization (`db/seed/seed_dev.sql`): Chapter 01. */
export const DEMO_OWNER_ORGANIZATION_ID = '10000000-0000-0000-0000-000000000101'

export const DEMO_PROGRAMME_ID = 'd4000000-0000-0000-0000-000000000001'
export const DEMO_CHALLENGE_ID = 'd4000000-0000-0000-0000-000000000002'

const STAMP = '2026-09-01T02:00:00.000Z'

const programme: ProgrammeDemoDetail = {
  programme: {
    id: DEMO_PROGRAMME_ID,
    type: 'PROGRAMME',
    organization_id: DEMO_OWNER_ORGANIZATION_ID,
    slug: 'demo-chuong-trinh-uom-tao',
    name: 'Chương trình ươm tạo (demo)',
    summary: 'Chương trình mẫu cho Internal Alpha: đồng hành cùng các đội dự án qua ba giai đoạn.',
    status: 'PUBLISHED',
    starts_at: '2026-09-01T02:00:00.000Z',
    ends_at: '2026-12-15T10:00:00.000Z',
    created_at: STAMP,
    updated_at: STAMP,
  },
  stages: [
    {
      id: 'd4010000-0000-0000-0000-000000000001',
      position: 1,
      name: 'Mở đăng ký',
      summary: 'Nhận hồ sơ đăng ký tham gia.',
      starts_at: '2026-09-01T02:00:00.000Z',
      ends_at: '2026-09-30T16:59:00.000Z',
    },
    {
      id: 'd4010000-0000-0000-0000-000000000002',
      position: 2,
      name: 'Ươm tạo',
      summary: 'Các buổi làm việc cùng đội dự án.',
      starts_at: '2026-10-01T02:00:00.000Z',
      ends_at: '2026-11-30T16:59:00.000Z',
    },
    {
      id: 'd4010000-0000-0000-0000-000000000003',
      position: 3,
      name: 'Ngày trình diễn',
      summary: 'Các đội trình bày kết quả.',
      starts_at: '2026-12-01T02:00:00.000Z',
      ends_at: '2026-12-15T10:00:00.000Z',
    },
  ],
  events: [
    {
      id: 'd4020000-0000-0000-0000-000000000001',
      organization_id: DEMO_OWNER_ORGANIZATION_ID,
      programme_id: DEMO_PROGRAMME_ID,
      slug: 'demo-buoi-dinh-huong',
      name: 'Buổi định hướng (demo)',
      summary: 'Giới thiệu chương trình cho các đội.',
      starts_at: '2026-10-03T02:00:00.000Z',
      ends_at: '2026-10-03T04:00:00.000Z',
      location_text: 'Trực tuyến',
      status: 'PUBLISHED',
      created_at: STAMP,
      updated_at: STAMP,
    },
    {
      id: 'd4020000-0000-0000-0000-000000000002',
      organization_id: DEMO_OWNER_ORGANIZATION_ID,
      programme_id: DEMO_PROGRAMME_ID,
      slug: 'demo-ngay-trinh-dien',
      name: 'Ngày trình diễn (demo)',
      summary: null,
      starts_at: '2026-12-12T07:00:00.000Z',
      ends_at: '2026-12-12T10:00:00.000Z',
      location_text: 'Trực tuyến',
      status: 'PUBLISHED',
      created_at: STAMP,
      updated_at: STAMP,
    },
  ],
  team: [
    {
      id: 'd4040000-0000-0000-0000-000000000001',
      display_name: 'Người vận hành A (demo)',
      role_label: 'PROGRAMME_ORGANIZER',
    },
    {
      id: 'd4040000-0000-0000-0000-000000000002',
      display_name: 'Người vận hành B (demo)',
      role_label: 'PROGRAMME_ORGANIZER',
    },
  ],
  registration: {
    applicant_types: ['TEAM', 'STARTUP'],
    questions: ['Dự án của bạn giải quyết vấn đề gì?', 'Bạn cần chương trình hỗ trợ điều gì?'],
  },
  application_counts: { SUBMITTED: 5, UNDER_REVIEW: 3, NEEDS_UPDATE: 1 },
}

const challenge: ProgrammeDemoDetail = {
  programme: {
    id: DEMO_CHALLENGE_ID,
    type: 'CHALLENGE',
    organization_id: DEMO_OWNER_ORGANIZATION_ID,
    slug: 'demo-thu-thach-doi-moi',
    name: 'Thử thách đổi mới (demo)',
    summary: 'Challenge mẫu cho Internal Alpha: các đội đề xuất giải pháp cho bài toán của đơn vị.',
    status: 'DRAFT',
    starts_at: '2026-11-01T02:00:00.000Z',
    ends_at: '2027-01-31T10:00:00.000Z',
    created_at: STAMP,
    updated_at: STAMP,
  },
  stages: [
    {
      id: 'd4010000-0000-0000-0000-000000000011',
      position: 1,
      name: 'Nhận giải pháp',
      summary: 'Các đội gửi giải pháp cho bài toán.',
      starts_at: '2026-11-01T02:00:00.000Z',
      ends_at: '2026-12-15T16:59:00.000Z',
    },
    {
      id: 'd4010000-0000-0000-0000-000000000012',
      position: 2,
      name: 'Kết nối thí điểm',
      summary: 'Đơn vị gặp các đội có giải pháp phù hợp.',
      starts_at: '2026-12-16T02:00:00.000Z',
      ends_at: '2027-01-31T10:00:00.000Z',
    },
  ],
  problem_statements: [
    {
      id: 'd4030000-0000-0000-0000-000000000001',
      title: 'Bài toán mẫu 1: tối ưu giao hàng chặng cuối',
      summary: 'Giảm thời gian giao hàng trong nội thành.',
    },
    {
      id: 'd4030000-0000-0000-0000-000000000002',
      title: 'Bài toán mẫu 2: số hoá hồ sơ khách hàng',
      summary: null,
    },
  ],
  events: [
    {
      id: 'd4020000-0000-0000-0000-000000000011',
      organization_id: DEMO_OWNER_ORGANIZATION_ID,
      programme_id: DEMO_CHALLENGE_ID,
      slug: 'demo-gioi-thieu-bai-toan',
      name: 'Giới thiệu bài toán (demo)',
      summary: null,
      starts_at: '2026-11-05T07:00:00.000Z',
      ends_at: '2026-11-05T09:00:00.000Z',
      location_text: 'Trực tuyến',
      status: 'DRAFT',
      created_at: STAMP,
      updated_at: STAMP,
    },
  ],
  team: [
    {
      id: 'd4040000-0000-0000-0000-000000000011',
      display_name: 'Người vận hành C (demo)',
      role_label: 'PROGRAMME_ORGANIZER',
    },
  ],
  registration: { applicant_types: ['TEAM', 'STARTUP'], questions: [] },
  application_counts: {},
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** In display order. Never mutated: callers copy before editing (session store). */
export const DEMO_PROGRAMMES: readonly ProgrammeDemoDetail[] = deepFreeze([programme, challenge])

export function demoFixture(id: string): ProgrammeDemoDetail | undefined {
  return DEMO_PROGRAMMES.find((p) => p.programme.id === id)
}

/** True for ids in the reserved demo range (fixture ids), whatever the fixture contains. */
export function isDemoFixtureId(id: string): boolean {
  return /^d40[0-9a-f]{5}-0000-0000-0000-[0-9a-f]{12}$/.test(id)
}
