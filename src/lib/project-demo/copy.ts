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
