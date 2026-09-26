import { EVENT_TIMEZONE } from '@/lib/ops/event-rules'

/**
 * WF04 — demo date display. Dates are stored as instants and shown as
 * dd/MM/yyyy in Asia/Ho_Chi_Minh, the one timezone of the canonical Event rule
 * (DEC-WF03-S07-EVENT-LIFECYCLE).
 */

const DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDemoDate(value: string | null): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? DATE.format(time) : null
}

/** "01/09/2026 – 15/12/2026", "Từ …", "Đến …" or "—". */
export function formatDemoDateRange(start: string | null, end: string | null): string {
  const from = formatDemoDate(start)
  const to = formatDemoDate(end)
  if (from && to) return `${from} – ${to}`
  if (from) return `Từ ${from}`
  if (to) return `Đến ${to}`
  return '—'
}
