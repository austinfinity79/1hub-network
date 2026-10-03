import { routeByPattern } from '@/lib/routes'
import { PROJECT_DEMO_COPY } from '@/lib/project-demo/copy'
import { PROJECT_DEMO_PATH } from '@/lib/project-demo/routes'

/**
 * WF02-T00 — member shell navigation model (DEC-WF02-H9).
 *
 * Every item the approved WF02 shell draws (ME0, ME2, ME6, ME4 references) is
 * listed here and classified once:
 *
 * - LINK: its destination is a frozen P0 Production route (Screen Contracts) or
 *   the public Library, so it is interactive. `nav.test.ts` fails otherwise.
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
 * WF05 (DEC-WF05-G2): the MemberShell entry of the Project / Startup screens,
 * in the sidebar footer. Registered hidden by WF05-T00; shown since WF05-S01
 * made `/demo/projects` a real screen. WF05-PROD-04: no demo group label — the
 * screens show real data (WF05-PROD-01 demo artifact disposition). It grants no
 * capability: every venture read is authorized on the server.
 */
export const PROJECT_DEMO_ENTRY = {
  key: 'project-demo',
  label: PROJECT_DEMO_COPY.entry,
  href: PROJECT_DEMO_PATH,
  visible: true,
} as const

/**
 * Header product nav. Thư viện opens the public Library (PO decision, Alpha
 * interaction gap fix 30/09); Challenge and Events have no P0 Production screen.
 */
export const HEADER_NAV: readonly NavItem[] = [
  { label: 'Thư viện', kind: 'LINK', href: '/library' },
  { label: 'Challenge', kind: 'INERT', reason: 'FUTURE' },
  { label: 'Sự kiện', kind: 'INERT', reason: 'FUTURE' },
]

export type SidebarKey = 'overview' | 'profile' | 'privacy' | 'settings' | 'roles'

export type SidebarItem = NavItem & { key: SidebarKey | null }

/** "Tài khoản của tôi" sidebar, in the approved order. */
export const SIDEBAR_NAV: readonly SidebarItem[] = [
  // DEC-L2R-D1: /me is "Hồ sơ của tôi" (FP1-OWN).
  { key: 'overview', label: 'Hồ sơ của tôi', kind: 'LINK', href: '/me' },
  { key: 'profile', label: 'Hồ sơ cá nhân', kind: 'LINK', href: '/me/profile/edit' },
  { key: 'privacy', label: 'Quyền riêng tư & hiển thị', kind: 'LINK', href: '/me/privacy' },
  { key: 'settings', label: 'Cài đặt tài khoản', kind: 'LINK', href: '/me/settings' },
  // DEC-L2R-D8: pending invitations are answered on "Dự án & startup của tôi".
  { key: null, label: 'Lời mời', kind: 'LINK', href: '/projects' },
  { key: 'roles', label: 'Vai trò & liên kết', kind: 'LINK', href: '/me/roles' },
  // The member's organisations are the memberships and leadership of WF02-S04,
  // as in the workspace sidebar (PO decision, Alpha interaction gap fix 30/09).
  { key: null, label: 'Tổ chức của tôi', kind: 'LINK', href: '/me/roles' },
]

/** True when `href` is a frozen P0 route of the member group. */
export function isFrozenMemberRoute(href: string): boolean {
  const route = routeByPattern(href)
  return route?.group === 'member'
}
