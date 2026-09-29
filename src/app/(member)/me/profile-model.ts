import type { CompletionGroup } from '@/lib/profile/completion'

/**
 * FP1-OWN — pure presentation helpers (no data access). Everything shown is
 * derived from the server's DTOs; completion is the server's (D-C1).
 */

/**
 * Months from "YYYY-MM" to "YYYY-MM", both months counted, as FP1-OWN counts
 * them: 06/2019 – 01/2024 is "4 năm 8 tháng".
 */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number]
  const [ty, tm] = to.split('-').map(Number) as [number, number]
  return Math.max(0, (ty - fy) * 12 + (tm - fm) + 1)
}

/** The current month ("YYYY-MM") in Việt Nam, where the member reads it. */
export function currentMonth(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  })
    .format(at)
    .slice(0, 7)
}

/** "2 năm 8 tháng", "5 tháng", "1 năm". */
export function durationText(months: number): string {
  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts = [years ? `${years} năm` : '', rest ? `${rest} tháng` : ''].filter(Boolean)
  return parts.join(' ') || 'dưới 1 tháng'
}

/** "2024-02" → "02/2024". */
export const monthText = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`

/** "Kho lạnh chia sẻ" → "KL", "Tracely" → "TR". */
export function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

export type Suggestion = {
  group: CompletionGroup
  title: string
  action: string
  /** Where the member adds it: a dialog of this page or the editor. */
  target: 'basic' | 'experience' | 'expertise' | 'editor'
}

const SUGGESTIONS: Record<CompletionGroup, Omit<Suggestion, 'group'>> = {
  AVATAR: { title: 'Thêm ảnh đại diện', action: 'Tải ảnh', target: 'editor' },
  DISPLAY_NAME: { title: 'Thêm tên hiển thị', action: 'Thêm tên hiển thị', target: 'basic' },
  HEADLINE: { title: 'Thêm vai trò hiện tại', action: 'Thêm vai trò', target: 'basic' },
  REGION: { title: 'Thêm tỉnh/thành phố', action: 'Thêm tỉnh/thành phố', target: 'basic' },
  BIO: { title: 'Thêm giới thiệu', action: 'Thêm giới thiệu', target: 'editor' },
  DOMAIN: { title: 'Thêm lĩnh vực', action: 'Thêm lĩnh vực', target: 'editor' },
  SKILLS: { title: 'Thêm kỹ năng', action: 'Thêm kỹ năng', target: 'expertise' },
  EXPERIENCE: { title: 'Thêm kinh nghiệm', action: 'Thêm kinh nghiệm', target: 'experience' },
  DEVELOPMENT_GOAL: {
    title: 'Thêm mục tiêu phát triển',
    action: 'Thêm mục tiêu',
    target: 'editor',
  },
  CURRENT_NEED: { title: 'Thêm nhu cầu hiện tại', action: 'Thêm nhu cầu', target: 'editor' },
}

/** The first two groups the server reports incomplete, in the server's order. */
export function suggestions(missing: readonly CompletionGroup[]): Suggestion[] {
  return missing.slice(0, 2).map((group) => ({ group, ...SUGGESTIONS[group] }))
}
