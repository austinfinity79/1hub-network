/**
 * TASK 24.4 — L5 times in Asia/Ho_Chi_Minh, so the server render and the
 * browser print the same text (no hydration mismatch).
 */
const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export const formatTime = (iso: string) => TIME.format(new Date(iso))
export const formatDate = (iso: string) => DATE.format(new Date(iso))
