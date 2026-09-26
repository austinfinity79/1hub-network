import type { ProgrammeDemoStatus, ProgrammeType } from './types'

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
