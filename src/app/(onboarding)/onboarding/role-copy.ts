import type { DeclaredRole } from '@/lib/onboarding/roles'

/**
 * The six self-declared roles as ACC-08 draws them, with the short names
 * ACC-09 uses in its review. Browser-safe: copy only.
 */
export const ROLE_COPY: readonly {
  code: DeclaredRole
  name: string
  short: string
  body: string
}[] = [
  {
    code: 'HUB_MEMBER',
    name: 'Thành viên HUB Network',
    short: 'Thành viên HUB Network',
    body: 'Đang hoặc đã đảm nhiệm vị trí tại HUB Tổng, HUB Chapter hoặc câu lạc bộ',
  },
  {
    code: 'INNOVATOR',
    name: 'Innovator/Nhà đổi mới sáng tạo',
    short: 'Innovator',
    body: 'Có ý tưởng, dự án hoặc đang phát triển giải pháp',
  },
  {
    code: 'STARTUP_FOUNDER',
    name: 'Startup Founder',
    short: 'Founder',
    body: 'Đang xây dựng, điều hành hoặc làm việc tại công ty khởi nghiệp',
  },
  {
    code: 'ORGANIZATION_REPRESENTATIVE',
    name: 'Đại diện tổ chức',
    short: 'Đại diện tổ chức',
    body: 'Đại diện doanh nghiệp, trường đại học, cơ quan, cộng đồng hoặc tổ chức hỗ trợ',
  },
  {
    code: 'INVESTOR_REPRESENTATIVE',
    name: 'Đại diện quỹ/Nhà đầu tư',
    short: 'Đại diện quỹ/Nhà đầu tư',
    body: 'Đại diện quỹ đầu tư, tổ chức tài chính hoặc mạng lưới nhà đầu tư',
  },
  {
    code: 'INNOVATION_ENTHUSIAST',
    name: 'Quan tâm đến đổi mới sáng tạo',
    short: 'Quan tâm đến đổi mới sáng tạo',
    body: 'Muốn khám phá, học tập, tham gia chương trình hoặc kết nối cộng đồng',
  },
]
