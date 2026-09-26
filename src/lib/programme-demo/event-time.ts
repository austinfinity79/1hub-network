import { EVENT_TIMEZONE } from '@/lib/ops/event-rules'

/**
 * WF04-S04 — Event times with the WF03-S07 semantics (DEC-WF03-S07-EVENT-LIFECYCLE
 * E4): entered and shown in the display zone Asia/Ho_Chi_Minh (UTC+7, no DST),
 * stored as instants. Re-stated here because the S07 helpers live inside the
 * closed WF03 component; the behaviour is the same.
 */

const OFFSET = '+07:00'
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** Canonical Event status labels (the WF03-S07 wording). */
export const EVENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang công khai',
  LIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  CANCELLED: 'Đã huỷ',
  ARCHIVED: 'Đã lưu trữ',
}

function parts(iso: string) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}

/** A `datetime-local` value (yyyy-mm-ddThh:mm, Vietnam time) for a stored instant. */
export function toLocalInput(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ''
  const { y, m, d, h, min } = parts(iso)
  return `${y}-${m}-${d}T${h}:${min}`
}

/** A real Vietnam-time `datetime-local` value (rolls over are refused). */
export function isValidLocal(value: string): boolean {
  if (!LOCAL.test(value)) return false
  const time = Date.parse(`${value}:00${OFFSET}`)
  return Number.isFinite(time) && toLocalInput(new Date(time).toISOString()) === value
}

/** The stored instant of a `datetime-local` value, or null when empty. */
export function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null
  const time = Date.parse(`${value.trim()}:00${OFFSET}`)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function display(iso: string) {
  const { y, m, d, h, min } = parts(iso)
  return `${d}/${m}/${y} ${h}:${min}`
}

/** One line, as on S07: "15/11/2026 · 16:00–19:00" on one day, else "15/11 16:00 → 16/11/2026 12:00". */
export function formatEventWhen(starts: string | null, ends: string | null): string | null {
  if (!starts) return null
  if (!ends) return display(starts)
  const a = parts(starts)
  const b = parts(ends)
  if (a.y === b.y && a.m === b.m && a.d === b.d)
    return `${a.d}/${a.m}/${a.y} · ${a.h}:${a.min}–${b.h}:${b.min}`
  return `${a.d}/${a.m} ${a.h}:${a.min} → ${display(ends)}`
}
