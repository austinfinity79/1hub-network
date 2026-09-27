import { DEMO_COPY } from '@/lib/programme-demo/copy'

/**
 * WF05 — user-facing copy of the Founder / Project / Startup demo. The demo
 * indicator is the WF04 one (DEC-WF05-G1: one demo frame); the notice says
 * what is real (the member's own Project / Startup) and what is demo (the
 * application, kept in this browser session only). No technical terms.
 */
export const PROJECT_DEMO_COPY = {
  /** DEC-WF05-G2: the MemberShell entry label. */
  entry: 'Dự án & Startup · Demo',
  noticeEyebrow: DEMO_COPY.noticeEyebrow,
  noticeBody:
    'Dự án và startup là hồ sơ thật của bạn. Đơn đăng ký chương trình chỉ là bản demo: lưu trong phiên trình duyệt này, không gửi tới ban tổ chức và không ghi vào hệ thống.',
  reset: DEMO_COPY.reset,
  resetConfirm:
    'Xoá mọi đơn đăng ký demo trong phiên này? Hồ sơ dự án và startup của bạn không thay đổi.',
  resetYes: DEMO_COPY.resetYes,
  resetNo: DEMO_COPY.resetNo,
  resetDone: DEMO_COPY.resetDone,
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
  programmesHint: 'Chương trình và challenge đang công khai trong bản demo.',
  programmesEmpty: 'Hiện chưa có chương trình nào đang mở.',
  applicantTypes: 'Dành cho',
  applications: 'Đơn đăng ký demo',
  applicationsUnreadable: 'Chưa đọc được đơn đăng ký demo của phiên này.',
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
  programmesHint: 'Chương trình và challenge đang công khai trong bản demo.',
  programmesEmpty: 'Hiện chưa có chương trình nào đang mở.',
  applicantTypes: 'Dành cho',
  apply: 'Đăng ký',
  resume: 'Tiếp tục',
  ineligible: {
    NOT_OWNER: 'Chỉ chủ sở hữu đăng ký được.',
    ARCHIVED: 'Hồ sơ đã lưu trữ.',
    TYPE_NOT_ACCEPTED: 'Chương trình không nhận loại hồ sơ này.',
    NOT_PUBLISHED: 'Chương trình chưa mở.',
  },
} as const

/** WF05-S03 — the application draft. */
export const S03_COPY = {
  title: (programme: string) => `Đăng ký: ${programme}`,
  loading: 'Đang tải…',
  failed: 'Chưa tải được đơn đăng ký. Vui lòng thử lại.',
  retry: 'Thử lại',
  missing: 'Không tìm thấy đơn đăng ký này.',
  back: '← Hồ sơ dự án',
  save: 'Lưu nháp',
  saving: 'Đang lưu…',
  saved: 'Đã lưu bản nháp.',
  saveFailed: 'Chưa lưu được bản nháp. Vui lòng thử lại.',
  review: 'Rà soát & nộp',
  applicant: 'Hồ sơ đăng ký',
  applicantAs: 'Đăng ký với tư cách',
  reuse:
    'Hồ sơ dự án / startup được dùng lại như hiện có; chương trình chỉ hỏi thêm các câu dưới đây.',
  programme: 'Chương trình',
  questions: 'Câu hỏi của chương trình',
  questionsHint: 'Có thể lưu nháp khi chưa trả lời hết. Mọi câu cần được trả lời trước khi nộp.',
  noQuestions: 'Chương trình không có câu hỏi riêng.',
  question: (n: number) => `Câu hỏi ${n}`,
  tooLong: (max: number) => `Tối đa ${max} ký tự.`,
  stateNew: 'Chưa lưu',
  stateDraft: 'Bản nháp',
  submitted: 'Đơn đã nộp: không sửa được.',
  mismatch: 'Đơn nháp này không khớp câu hỏi hiện tại của chương trình, nên chỉ xem được.',
  cannotApply: 'Không đăng ký được',
} as const
