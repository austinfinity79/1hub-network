/**
 * Roles, levels and refusals shared by the two places that invite: step 2 of
 * the wizard (PRJ2) and the team page (DEC-L2R-D7, D8).
 */

/** The roles PRJ1 and PRJ2 offer; stored as display text and nothing more. */
export const TEAM_ROLES = ['Founder', 'Co-founder', 'Thành viên'] as const

export const PERMISSION_LABELS = { OWNER: 'Chủ sở hữu', EDIT: 'Biên tập', VIEW: 'Xem' } as const

/** The levels an owner can give; Chủ sở hữu is ownership and is never given. */
export const PERMISSION_LEVELS = [
  { value: 'EDIT', label: PERMISSION_LABELS.EDIT },
  { value: 'VIEW', label: PERMISSION_LABELS.VIEW },
] as const

const MESSAGES = {
  duplicate: 'Email này đã có một lời mời đang chờ.',
  invalidEmail: 'Email chưa hợp lệ.',
  tooMany: 'Đội đang có quá nhiều lời mời chờ xác nhận.',
  tooLong: 'Vai trò quá dài.',
  notSent: 'Chưa gửi được email mời nên lời mời chưa được tạo. Vui lòng thử lại.',
  rateLimited: 'Đã gửi quá nhiều lời mời trong 24 giờ qua. Vui lòng thử lại sau.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
} as const

/** What a refused invitation tells the owner; the server names the reason. */
export function inviteFailure(caught: unknown): string {
  const failure = caught as { code?: string; fields?: Record<string, string> } | null
  if (failure?.code === 'MEMBERSHIP_INVALID_TRANSITION') return MESSAGES.duplicate
  if (failure?.code === 'INVITATION_EMAIL_DELIVERY_FAILED') return MESSAGES.notSent
  if (failure?.code === 'INVITATION_RATE_LIMITED') return MESSAGES.rateLimited
  if (failure?.fields?.role_label) return MESSAGES.tooLong
  if (failure?.fields?.email === 'too_many_pending') return MESSAGES.tooMany
  if (failure?.fields?.email) return MESSAGES.invalidEmail
  return MESSAGES.failed
}
