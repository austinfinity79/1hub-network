import type { Capability } from '@/lib/authz/matrix'

/**
 * WF03-T00 — OpsShell navigation (DEC-WF03-G12/G15).
 *
 * Only executable WF03 destinations. WF03-S05 (programmes) is FUTURE / WF04 and
 * is not listed. Items inside an organization are shown only when the actor
 * holds the matching capability for that organization. This is display
 * convenience: every route and API authorizes on the server.
 *
 * Copy is pending PO review; "Danh sách tổ chức" and "Quan hệ tổ chức" are the
 * approved reference labels (WF03-S08 sidebar).
 */

export type OpsNavItem = {
  key: string
  label: string
  href: string
  /** Unset for an item always shown within an already-gated group (Admin Home). */
  capability?: Capability
  /** Active only on an exact path match (the organization overview). */
  exact?: boolean
}

export const NETWORK_NAV: OpsNavItem = {
  key: 'network',
  label: 'Danh sách tổ chức',
  href: '/ops/network',
  capability: 'network:read',
  exact: true,
}

export function organizationNav(orgId: string): OpsNavItem[] {
  const base = `/ops/org/${orgId}`
  return [
    { key: 'overview', label: 'Tổng quan', href: base, capability: 'org:read', exact: true },
    { key: 'members', label: 'Thành viên', href: `${base}/members`, capability: 'member:read' },
    { key: 'profile', label: 'Hồ sơ tổ chức', href: `${base}/profile`, capability: 'org:manage' },
    { key: 'events', label: 'Sự kiện', href: `${base}/events`, capability: 'event:manage' },
    {
      key: 'relationships',
      label: 'Quan hệ tổ chức',
      href: `${base}/settings`,
      capability: 'org:manage_relationship',
    },
  ]
}

/**
 * WF04-T00 (DEC-WF04-H2): the one entry into the Programme / Challenge DEMO.
 * Shown inside OpsShell only, i.e. to actors who already passed the ops guard;
 * the demo guard and API re-authorize (`programme:read`). Never WF03-S05.
 */
export const PROGRAMME_DEMO_ENTRY = {
  label: 'Chương trình & Challenge',
  group: 'Demo · Internal Alpha',
  href: '/demo/programmes',
} as const

/** P0-SHELL (DEC-P0-SHELL-D3): the way back to the member area (and its sign-out). */
export const ACCOUNT_ENTRY = { label: 'Tài khoản của tôi', href: '/me' } as const

export const OPS_COPY = {
  product: 'Vận hành tổ chức',
  networkGroup: 'Tổ chức',
  organizationGroup: 'Đơn vị',
  breadcrumbRoot: 'Tổ chức',
  adminGroup: 'Quản trị nền tảng',
  adminHome: 'Tổng quan quản trị',
} as const

/**
 * ADMIN-PROD-06 — the six platform-admin queues frozen by ADMIN-PROD-03/04/05
 * (05 §26–28). Each item shows only when the actor holds its capability
 * anywhere (platform-wide, or on at least one organization); the Admin group
 * itself (including the unconditional "Tổng quan quản trị" link) only when at
 * least one of these is held; holding none of them shows no admin group (no
 * dead nav). ADMIN-DECISION-04: leaders have no account capability at all.
 * A dedicated subtree (`/ops/admin/*`), never the organization shell: these
 * capabilities are platform- or cross-org queues, not one organization's
 * context (DEC-ADM C1/PD-6), so they do not belong in `organizationNav`.
 */
export const ADMIN_HOME_NAV: OpsNavItem = {
  key: 'admin-home',
  label: 'Tổng quan quản trị',
  href: '/ops/admin',
  exact: true,
}

export const ADMIN_NAV_ITEMS: OpsNavItem[] = [
  {
    key: 'admin-verification',
    label: 'Xác minh vai trò',
    href: '/ops/admin/verification',
    capability: 'verification:review',
  },
  {
    key: 'admin-ventures',
    label: 'Duyệt startup',
    href: '/ops/admin/ventures',
    capability: 'venture:review',
  },
  {
    key: 'admin-access',
    label: 'Phân quyền đơn vị',
    href: '/ops/admin/access',
    capability: 'access:delegate',
  },
  {
    key: 'admin-feedback',
    label: 'Phản hồi',
    href: '/ops/admin/feedback',
    capability: 'feedback:manage',
  },
  {
    key: 'admin-categories',
    label: 'Danh mục',
    href: '/ops/admin/categories',
    capability: 'vocabulary:manage',
  },
  {
    key: 'admin-accounts',
    label: 'Tài khoản',
    href: '/ops/admin/accounts',
    capability: 'account:administer',
  },
]
