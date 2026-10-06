/**
 * US-01.11 — one "Vị trí tại HUB Network" declaration (FB-11, FB-12, FB-13;
 * S1-UAT-03, DEC-S1O). Pure rules shared by the stage 3 form and the server
 * (onboarding/roles.ts), so both judge a row the same way. No I/O.
 *
 *   Cấp đơn vị   HUB Network Tổng · HUB Network Chapter · CLB
 *   Chức vụ      Chủ tịch · Phó Chủ tịch · Trưởng Ban (+ Tên Ban) · Thành viên ·
 *                Khác (+ Ghi rõ chức vụ); the two texts are ≤ 60 characters
 *   Thời gian    Từ MM/YYYY; Đến MM/YYYY, or "Tôi đang trong nhiệm kỳ hoạt
 *                động" (Đến = "Hiện tại"); no future month; Đến not before Từ
 *   Rows         1–10; the same unit + position over overlapping months is one
 *                position declared twice ("Vị trí này đã khai"); the same unit
 *                with another term is allowed
 *   Order        HUB Network Tổng → Chapter → CLB; in each level the current
 *                term first, earlier terms after (latest first)
 *
 * A declaration is "Chờ xác minh" until its unit decides it; the decision is
 * S1-UAT-03B's workflow. Declaring grants no permission.
 */

export const HUB_LEVELS = ['HUB', 'CHAPTER', 'CLB'] as const
export type HubLevel = (typeof HUB_LEVELS)[number]

export const HUB_POSITIONS = ['CHAIR', 'VICE_CHAIR', 'HEAD_OF_BOARD', 'MEMBER', 'OTHER'] as const
export type HubPosition = (typeof HUB_POSITIONS)[number]

export const LEVEL_LABELS: Record<HubLevel, string> = {
  HUB: 'HUB Network Tổng',
  CHAPTER: 'HUB Network Chapter',
  CLB: 'CLB',
}

export const POSITION_LABELS: Record<HubPosition, string> = {
  CHAIR: 'Chủ tịch',
  VICE_CHAIR: 'Phó Chủ tịch',
  HEAD_OF_BOARD: 'Trưởng Ban',
  MEMBER: 'Thành viên',
  OTHER: 'Khác',
}

/** US-01.11: 1–10 rows; FB-12: "Tên Ban" and "Ghi rõ chức vụ" ≤ 60. */
export const POSITION_LIMITS = { rows: 10, text: 60 } as const

export const PENDING_LABEL = 'Chờ xác minh'

/** A month, "YYYY-MM". */
export const MONTH = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/

/** The current month in Việt Nam, "YYYY-MM" (the product's time zone). */
export function monthNow(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}`
}

/** "YYYY-MM" → "MM/YYYY", as the board writes months. */
export const monthText = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`

/** "MM/YYYY" → "YYYY-MM"; '' stays ''; anything else is null. */
export function parseMonthText(text: string): string | null {
  const value = text.trim()
  if (!value) return ''
  const match = /^(\d{1,2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const month = `${match[2]}-${match[1]!.padStart(2, '0')}`
  return MONTH.test(month) ? month : null
}

export type PositionDeclaration = {
  level: HubLevel
  organization_id: string
  position: HubPosition
  board_name: string | null
  position_other: string | null
  /** "YYYY-MM". */
  from: string
  /** "YYYY-MM", or null while the term is current. */
  to: string | null
  current: boolean
}

/** "Trưởng Ban Truyền thông", "Phó Chủ tịch", the typed text for "Khác". */
export function positionTitle(row: {
  position: HubPosition | null
  board_name: string | null
  position_other: string | null
}): string {
  if (row.position === 'HEAD_OF_BOARD') {
    return [POSITION_LABELS.HEAD_OF_BOARD, row.board_name].filter(Boolean).join(' ')
  }
  if (row.position === 'OTHER') return row.position_other ?? POSITION_LABELS.OTHER
  return row.position ? POSITION_LABELS[row.position] : ''
}

/** "01/2024 – Hiện tại", "01/2022 – 12/2023". */
export function periodText(row: { from: string | null; to: string | null; current: boolean }) {
  if (!row.from) return ''
  return `${monthText(row.from)} – ${row.current ? 'Hiện tại' : row.to ? monthText(row.to) : ''}`
}

/** The text that makes two positions at one unit "the same position". */
const positionKey = (row: PositionDeclaration) =>
  [
    row.organization_id,
    row.position,
    (row.board_name ?? row.position_other ?? '').trim().toLocaleLowerCase('vi'),
  ].join('|')

/** Inclusive month ranges; a current term runs to `now`. */
function overlaps(a: PositionDeclaration, b: PositionDeclaration, now: string): boolean {
  const endA = a.current ? now : a.to!
  const endB = b.current ? now : b.to!
  return a.from <= endB && b.from <= endA
}

/** Indexes of the rows that repeat an earlier row's unit + position over overlapping months. */
export function duplicateRows(rows: PositionDeclaration[], now: string = monthNow()): number[] {
  const out: number[] = []
  rows.forEach((row, i) => {
    if (
      rows
        .slice(0, i)
        .some((prev) => positionKey(prev) === positionKey(row) && overlaps(prev, row, now))
    ) {
      out.push(i)
    }
  })
  return out
}

/** The period's own errors: from required, month form, no future, end not before start. */
export function periodError(
  row: { from: string | null; to: string | null; current: boolean },
  now: string = monthNow(),
): 'from_required' | 'to_required' | 'future_month' | 'end_before_start' | null {
  if (!row.from) return 'from_required'
  if (!row.current && !row.to) return 'to_required'
  if (row.from > now || (!row.current && row.to! > now)) return 'future_month'
  if (!row.current && row.to! < row.from) return 'end_before_start'
  return null
}

const LEVEL_RANK: Record<HubLevel, number> = { HUB: 0, CHAPTER: 1, CLB: 2 }

/** US-01.11 order: HUB Tổng → Chapter → CLB; current first, then latest start first. */
export function sortDeclarations<
  T extends { level: HubLevel; current: boolean; from: string | null },
>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        LEVEL_RANK[a.row.level] - LEVEL_RANK[b.row.level] ||
        Number(b.row.current) - Number(a.row.current) ||
        (b.row.from ?? '').localeCompare(a.row.from ?? '') ||
        a.index - b.index,
    )
    .map(({ row }) => row)
}
