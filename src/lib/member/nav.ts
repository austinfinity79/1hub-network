import { routeByPattern } from '@/lib/routes'
import { PROJECT_DEMO_COPY } from '@/lib/project-demo/copy'
import { PROJECT_DEMO_PATH } from '@/lib/project-demo/routes'

/**
 * WF02-T00 — member shell navigation model (DEC-WF02-H9).
 *
 * Every item the approved WF02 shell draws (ME0, ME2, ME6, ME4 references) is
 * listed here and classified once:
 *
 * - LINK: its destination is a frozen P0 Production route (Screen Contracts),
 *   so it is interactive. `nav.test.ts` fails if a LINK target is not frozen.
 * - INERT: the destination is Demo/Future or has no screen at all. It keeps its
 *   visual presence for Pixel fidelity but never navigates, carries no count
 *   and claims nothing; it renders `aria-disabled`.
 *
 * Navigation is never an authorization boundary: every destination page and
 * API re-checks the session server-side.
 */

export type NavItem =
  | { label: string; kind: 'LINK'; href: string }
  | { label: string; kind: 'INERT'; reason: 'FUTURE' | 'NO_P0_SCREEN' }

/**
 * P0-SHELL (DEC-P0-SHELL-D2): the user-facing reason an INERT item gives on
 * hover and to assistive technology. Pending PO copy review.
 */
export const INERT_REASONS: Record<'FUTURE' | 'NO_P0_SCREEN', string> = {
  FUTURE: 'Tính năng giai đoạn sau — chưa có trong phiên bản này',
  NO_P0_SCREEN: 'Chưa có trong phiên bản này',
}

/** P0-SHELL (DEC-P0-SHELL-D3): the member → ops entry, shown only with an ops scope. */
export const OPS_ENTRY = { label: 'Vận hành tổ chức', href: '/ops/network' } as const

/**
 * WF05 (DEC-WF05-G2): the MemberShell demo entry for the Founder / Project /
 * Startup demo, in the sidebar-footer demo area. Registered by WF05-T00 and
 * **not shown** (`visible: false`) until WF05-S01 makes its destination a real
 * screen: no dead link, no placeholder. It grants no capability.
 */
export const PROJECT_DEMO_ENTRY = {
  label: PROJECT_DEMO_COPY.entry,
  href: PROJECT_DEMO_PATH,
  visible: false,
} as const

/** Header product nav: Library, Challenge and Events have no P0 Production screen. */
export const HEADER_NAV: readonly NavItem[] = [
  { label: 'Thư viện', kind: 'INERT', reason: 'NO_P0_SCREEN' },
  { label: 'Challenge', kind: 'INERT', reason: 'FUTURE' },
  { label: 'Sự kiện', kind: 'INERT', reason: 'FUTURE' },
]

export type SidebarKey = 'overview' | 'profile' | 'privacy' | 'settings' | 'roles'

export type SidebarItem = NavItem & { key: SidebarKey | null }

/** "Tài khoản của tôi" sidebar, in the approved order. */
export const SIDEBAR_NAV: readonly SidebarItem[] = [
  { key: 'overview', label: 'Tổng quan', kind: 'LINK', href: '/me' },
  { key: 'profile', label: 'Hồ sơ cá nhân', kind: 'LINK', href: '/me/profile/edit' },
  { key: 'privacy', label: 'Quyền riêng tư & hiển thị', kind: 'LINK', href: '/me/privacy' },
  { key: 'settings', label: 'Cài đặt tài khoản', kind: 'LINK', href: '/me/settings' },
  // No screen owns invitations in P0 (DEC-WF02-H10).
  { key: null, label: 'Lời mời', kind: 'INERT', reason: 'NO_P0_SCREEN' },
  { key: 'roles', label: 'Vai trò & liên kết', kind: 'LINK', href: '/me/roles' },
  // No frozen route; organisation links live on S01/S04 content.
  { key: null, label: 'Tổ chức của tôi', kind: 'INERT', reason: 'NO_P0_SCREEN' },
]

/** True when `href` is a frozen P0 route of the member group. */
export function isFrozenMemberRoute(href: string): boolean {
  const route = routeByPattern(href)
  return route?.group === 'member'
}
