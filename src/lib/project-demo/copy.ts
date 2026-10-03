/**
 * WF05 — user-facing copy of the Project / Startup screens. Everything shown
 * is the member's real data, so nothing is labelled demo (WF05-PROD-01 demo
 * artifact disposition). No technical terms.
 */
export const PROJECT_DEMO_COPY = {
  /** DEC-WF05-G2: the MemberShell entry label. */
  entry: 'Dự án & Startup',
} as const

/** The WF02 venture wording (WF02-S05 editor, WF02-S01 rows), unchanged. */
export const VENTURE_TYPE_LABEL: Record<string, string> = { PROJECT: 'Dự án', STARTUP: 'Startup' }
export const VENTURE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hoạt động',
  ARCHIVED: 'Đã lưu trữ',
}
/** Owner, or the member's display role label (never a permission, DEC-WF02-H7). */
export const relationLabel = (relation: 'OWNER' | 'MEMBER', roleLabel: string | null) =>
  relation === 'OWNER' ? 'Chủ sở hữu' : (roleLabel ?? 'Thành viên')

/** WF05-S01 — my projects / startups and open programmes. */
export const S01_COPY = {
  title: 'Dự án & Startup',
  meta: 'Hồ sơ dự án, startup của bạn và các chương trình đang mở',
  loading: 'Đang tải…',
  failed: 'Chưa tải được dữ liệu. Vui lòng thử lại.',
  retry: 'Thử lại',
  venturesTitle: 'Dự án / Startup của tôi',
  venturesHint: 'Hồ sơ bạn sở hữu hoặc đang là thành viên đội.',
  create: '+ Tạo dự án / startup',
  venturesEmpty: 'Bạn chưa có dự án hay startup nào.',
  programmesTitle: 'Chương trình đang mở',
  programmesHint: 'Chương trình và challenge đang nhận đơn.',
  programmesEmpty: 'Hiện chưa có chương trình nào đang mở.',
  applicantTypes: 'Dành cho',
  applications: 'Đơn đăng ký',
  /** An application whose programme no longer takes applications (it stays readable). */
  closed: 'đã đóng',
  apply: 'Đăng ký',
} as const

/** WF05-S02 — one Project / Startup and its participation. */
export const S02_COPY = {
  back: '← Dự án & Startup',
  edit: 'Sửa hồ sơ',
  loading: 'Đang tải…',
  failed: 'Chưa tải được hồ sơ. Vui lòng thử lại.',
  retry: 'Thử lại',
  missing: 'Không tìm thấy dự án hay startup này.',
  archived: 'Hồ sơ đã lưu trữ: chỉ xem, không đăng ký chương trình mới.',
  overview: 'Thông tin',
  type: 'Loại',
  status: 'Trạng thái',
  summary: 'Tóm tắt',
  region: 'Tỉnh / Thành phố',
  domains: 'Lĩnh vực',
  none: '—',
  team: 'Đội',
  teamLink: 'Xem đội',
  members: (n: number) => `${n} thành viên`,
  programmesTitle: 'Chương trình đang mở',
  programmesHint: 'Chương trình đang nhận đơn, và đơn của hồ sơ này ở chương trình đã đóng.',
  programmesEmpty: 'Hiện chưa có chương trình nào đang mở.',
  applicantTypes: 'Dành cho',
  apply: 'Đăng ký',
  resume: 'Tiếp tục',
  view: 'Xem đơn',
  closed: 'Chương trình đã đóng nhận đơn · đơn chỉ xem được',
  ineligible: {
    NOT_OWNER: 'Chỉ chủ sở hữu đăng ký được.',
    ARCHIVED: 'Hồ sơ đã lưu trữ.',
    TYPE_NOT_ACCEPTED: 'Chương trình không nhận loại hồ sơ này.',
    NOT_PUBLISHED: 'Chương trình chưa mở.',
  },
} as const
