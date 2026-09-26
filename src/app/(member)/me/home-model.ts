import type { CompletionGroup } from '@/lib/profile/completion'
import type { NetworkDTO } from '@/lib/network/network'

/**
 * WF02-S01 — pure presentation model for the account home (no data access).
 *
 * The missing-profile summary is built only from the server's completion
 * groups (DEC-WF02-H13): nothing is computed here, and Education is not a
 * group. Organisation rows come only from GET /me/network; nothing is inferred
 * from email, region, intent or labels (DEC-WF02-S01-D3).
 */

/** Lower-case group names for the summary sentence (DEC-WF02-S01-D2). */
export const GROUP_LABELS: Record<CompletionGroup, string> = {
  DISPLAY_NAME: 'họ và tên',
  AVATAR: 'ảnh đại diện',
  HEADLINE: 'chức danh',
  REGION: 'tỉnh / thành phố',
  BIO: 'giới thiệu',
  DOMAIN: 'lĩnh vực',
  SKILLS: 'kỹ năng',
  EXPERIENCE: 'kinh nghiệm',
  DEVELOPMENT_GOAL: 'mục tiêu phát triển',
  CURRENT_NEED: 'nhu cầu hiện tại',
}

export type CompletionView = {
  percent: number
  groups: { code: CompletionGroup; complete: boolean }[]
}

/** "Hồ sơ hoàn thiện 60% · còn thiếu ảnh đại diện, kinh nghiệm và nhu cầu hiện tại". */
export function completionSummary(completion: CompletionView): string {
  const head = `Hồ sơ hoàn thiện ${completion.percent}%`
  const missing = completion.groups.filter((g) => !g.complete).map((g) => GROUP_LABELS[g.code])
  if (missing.length === 0) return head
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(', ')} và ${missing[missing.length - 1]}`
  return `${head} · còn thiếu ${list}`
}

const TYPE_LABELS: Record<string, string> = {
  STARTUP: 'startup',
  PROJECT: 'dự án',
  HUB: 'hub',
  CHAPTER: 'chapter',
  CLB: 'clb',
}

const typeLabel = (type: string) => TYPE_LABELS[type] ?? type.toLowerCase()

export type OrgRow = {
  key: string
  name: string
  detail: string
  /** A frozen P0 route (SCR WF02-S01 actions open_project / open_roles). */
  href: string
}

/**
 * Current relations only; history (ended, rejected, withdrawn…) belongs to
 * WF02-S04. Ventures first, then memberships, then leadership, each in the
 * server's order. Membership, leadership and ventures stay separate rows:
 * one never implies another.
 */
export function orgRows(network: NetworkDTO): OrgRow[] {
  const rows: OrgRow[] = []
  for (const role of network.roles) {
    const who = role.relation === 'OWNER' ? 'Chủ sở hữu' : (role.role_label ?? 'Thành viên')
    rows.push({
      key: `venture-${role.venture.id}`,
      name: role.venture.name,
      detail: `${who} · ${typeLabel(role.venture.type)}`,
      // Only the owner manages a venture (DEC-WF02-H7).
      href: role.relation === 'OWNER' ? `/projects/${role.venture.id}/edit` : '/me/roles',
    })
  }
  for (const m of network.memberships) {
    if (m.status !== 'ACTIVE' && m.status !== 'PENDING_APPROVAL') continue
    rows.push({
      key: `membership-${m.id}`,
      name: m.organization.name,
      detail:
        m.status === 'ACTIVE' ? `Thành viên · ${typeLabel(m.organization.type)}` : 'Đang chờ duyệt',
      href: '/me/roles',
    })
  }
  for (const l of network.leadership) {
    if (l.status !== 'ACTIVE') continue
    rows.push({
      key: `leadership-${l.id}`,
      name: l.organization.name,
      detail: `${l.title} · ${typeLabel(l.organization.type)}`,
      href: '/me/roles',
    })
  }
  return rows
}
