import type { ApplicantType, ApplicationStatus, ProgrammeDemoStatus, ProgrammeType } from './types'

/** WF04 demo copy shared by the demo screens (pending PO copy review). */
export const DEMO_COPY = {
  title: 'Chương trình & Challenge',
  noticeEyebrow: 'Dữ liệu demo · Internal Alpha',
  noticeBody:
    'Dữ liệu mẫu để minh hoạ hành trình tổ chức chương trình và challenge. Mọi thay đổi chỉ lưu trong phiên trình duyệt này, không ghi vào hệ thống.',
  reset: 'Đặt lại demo',
  resetConfirm: 'Đưa dữ liệu demo về ban đầu? Mọi thay đổi trong phiên này sẽ bị xoá.',
  resetYes: 'Đặt lại',
  resetNo: 'Huỷ',
  resetDone: 'Đã đặt lại dữ liệu demo.',
} as const

/** Same wording as the WF03 event lifecycle labels. */
export const STATUS_LABEL: Record<ProgrammeDemoStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang công khai',
}

export const TYPE_LABEL: Record<ProgrammeType, string> = {
  PROGRAMME: 'Chương trình',
  CHALLENGE: 'Challenge',
}

/** SOT §12 primary applicant kinds. */
export const APPLICANT_LABEL: Record<ApplicantType, string> = {
  INDIVIDUAL: 'Cá nhân',
  TEAM: 'Đội',
  STARTUP: 'Startup',
}

/** SOT §6 Application states (shown as demo counts only). */
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã nộp',
  UNDER_REVIEW: 'Đang xem xét',
  NEEDS_UPDATE: 'Cần bổ sung',
  RESUBMITTED: 'Đã nộp lại',
  CLOSED: 'Đã đóng',
}

/** Programme team display labels (architecture 03 §4: designed, not active; grants nothing). */
export const TEAM_ROLE_LABEL: Record<string, string> = {
  PROGRAMME_ORGANIZER: 'Người tổ chức chương trình',
}
