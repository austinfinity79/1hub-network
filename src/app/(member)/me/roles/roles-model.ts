import type { NetworkDTO, SourceType } from '@/lib/network/network'

/**
 * WF02-S04 — pure presentation model for roles & network links.
 *
 * Every row is one canonical record from GET /me/network: a venture relation,
 * a CommunityMembership or a LeadershipRecord, never merged and never
 * inferred. The trust label comes only from the stored source (Data SOT §7
 * codes); leadership stores none, so none is shown. No approver name exists in
 * storage, so none is shown (DEC-WF02-H5).
 */

const TYPE_LABELS: Record<string, string> = {
  STARTUP: 'startup',
  PROJECT: 'dự án',
  HUB: 'hub',
  CHAPTER: 'chapter',
  CLB: 'clb',
}

export const typeLabel = (type: string) => TYPE_LABELS[type] ?? type.toLowerCase()

const MEMBERSHIP_STATUS: Record<string, string> = {
  ACTIVE: 'Thành viên',
  PENDING_APPROVAL: 'Đang chờ duyệt',
  REJECTED: 'Không được duyệt',
  WITHDRAWN: 'Đã rút yêu cầu',
  SUSPENDED: 'Tạm ngưng',
  ALUMNI: 'Cựu thành viên',
}

const LEADERSHIP_STATUS: Record<string, string> = {
  ACTIVE: '',
  ALUMNI: 'đã kết thúc',
  REVOKED: 'đã thu hồi',
}

const SOURCE_LABELS: Record<SourceType, string> = {
  SELF_DECLARED: 'Tự khai báo',
  SYSTEM_RECORDED: 'Hệ thống ghi nhận',
  ORGANIZATION_VERIFIED: 'Tổ chức xác nhận',
  IDENTITY_VERIFIED: 'Đã xác minh danh tính',
}

/** "YYYY-MM-DD" → "dd/mm/yyyy"; no timezone shift (already a calendar date). */
export const calendarDate = (value: string) => value.split('-').reverse().join('/')

export type RoleRow = {
  key: string
  kind: 'venture' | 'membership' | 'leadership'
  name: string
  chip: string
  role: string
  trust: string
  pending: boolean
}

function trustText(source: SourceType | null, from: string | null): string {
  const parts = [source ? SOURCE_LABELS[source] : null, from ? `từ ${calendarDate(from)}` : null]
  return parts.filter(Boolean).join(' · ')
}

export function roleRows(network: NetworkDTO): RoleRow[] {
  const rows: RoleRow[] = []
  for (const r of network.roles) {
    rows.push({
      key: `venture-${r.venture.id}`,
      kind: 'venture',
      name: r.venture.name,
      chip: typeLabel(r.venture.type),
      role: r.relation === 'OWNER' ? 'Chủ sở hữu' : (r.role_label ?? 'Thành viên'),
      // Owner and ACTIVE team relations are server-recorded (owner_profile_id, project_members).
      trust: SOURCE_LABELS.SYSTEM_RECORDED,
      pending: false,
    })
  }
  for (const m of network.memberships) {
    rows.push({
      key: `membership-${m.id}`,
      kind: 'membership',
      name: m.organization.name,
      chip: typeLabel(m.organization.type),
      role: MEMBERSHIP_STATUS[m.status] ?? m.status,
      trust: trustText(m.source_type, m.valid_from),
      pending: m.status === 'PENDING_APPROVAL',
    })
  }
  for (const l of network.leadership) {
    const state = LEADERSHIP_STATUS[l.status] ?? l.status.toLowerCase()
    rows.push({
      key: `leadership-${l.id}`,
      kind: 'leadership',
      name: l.organization.name,
      chip: typeLabel(l.organization.type),
      role: state ? `${l.title} · ${state}` : l.title,
      trust: `từ ${calendarDate(l.valid_from)}`,
      pending: false,
    })
  }
  return rows
}

/** States that refuse a new request in the same organisation (DEC-WF02-S04-G4). */
const BLOCKING = new Set(['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'ALUMNI'])

/** Convenience filter for the selector; the POST remains authoritative. */
export function selectableOrganizations<T extends { id: string }>(
  options: T[],
  network: NetworkDTO,
): T[] {
  const blocked = new Set(
    network.memberships.filter((m) => BLOCKING.has(m.status)).map((m) => m.organization.id),
  )
  return options.filter((o) => !blocked.has(o.id))
}
