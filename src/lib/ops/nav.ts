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
  capability: Capability
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

/** P0-SHELL (DEC-P0-SHELL-D3): the way back to the member area (and its sign-out). */
export const ACCOUNT_ENTRY = { label: 'Tài khoản của tôi', href: '/me' } as const

export const OPS_COPY = {
  product: 'Vận hành tổ chức',
  networkGroup: 'Tổ chức',
  organizationGroup: 'Đơn vị',
  breadcrumbRoot: 'Tổ chức',
} as const
