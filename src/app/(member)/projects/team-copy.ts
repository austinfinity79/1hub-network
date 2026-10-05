/**
 * Roles, levels and refusals shared by the two places that invite: step 2 of
 * the wizard (PRJ2) and the team page (DEC-L2R-D7, D8).
 */

/**
 * The team roles an owner picks when inviting (US-02.11, S1-UAT-07-FIX-01):
 * stored as display text and nothing more. A role grants no capability; the
 * level (OWNER / EDIT / VIEW) alone does.
 */
export const TEAM_ROLES = ['Founder', 'Co-founder', 'Thành viên', 'Cố vấn'] as const

export const PERMISSION_LABELS = { OWNER: 'Chủ sở hữu', EDIT: 'Biên tập', VIEW: 'Xem' } as const

/** The levels an owner can give; Chủ sở hữu is ownership and is never given. */
export const PERMISSION_LEVELS = [
  { value: 'EDIT', label: PERMISSION_LABELS.EDIT },
  { value: 'VIEW', label: PERMISSION_LABELS.VIEW },
] as const

/** US-02.11: at most 10 addresses in one send. */
export const MAX_INVITE_BATCH = 10

const MESSAGES = {
  duplicate: 'Email này đã có một lời mời đang chờ.',
  invalidEmail: 'Email chưa hợp lệ.',
  alreadyMember: 'Người này đã ở trong đội.',
  teamFull: 'Đội đã đủ 20 người (tính cả lời mời đang chờ).',
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
  if (failure?.code === 'TEAM_FULL') return MESSAGES.teamFull
  if (failure?.fields?.role_label) return MESSAGES.tooLong
  if (failure?.fields?.email === 'already_member') return MESSAGES.alreadyMember
  if (failure?.fields?.email) return MESSAGES.invalidEmail
  return MESSAGES.failed
}

/** "05/10/2026": the day an invitation or a link stops working. */
export const expiryDay = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))

/** ME7's sentence for an invitation: "[Đội] mời bạn vào đội với vai trò … · quyền …". */
export function invitationSentence(invitation: {
  venture: { name: string }
  role_label: string | null
  permission: keyof typeof PERMISSION_LABELS
}): string {
  const role = invitation.role_label ? ` với vai trò ${invitation.role_label}` : ''
  return `${invitation.venture.name} mời bạn vào đội${role} · quyền ${PERMISSION_LABELS[invitation.permission]}`
}
