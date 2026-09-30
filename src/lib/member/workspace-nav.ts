import { PROJECT_DEMO_PATH } from '@/lib/project-demo/routes'

import type { NavItem } from './nav'

/**
 * WF02 workspace navigation of the L2 board (DEC-L2R-D1).
 *
 * Each frame draws its own header, and ME7 a sidebar of five entries. As in
 * `nav.ts`, every item is classified once: LINK when its destination is a
 * route that exists, INERT when the board draws it and no screen owns it. An
 * inert item keeps its place, navigates nowhere and states why.
 *
 * Navigation is never an authorization boundary: every destination page and
 * API re-checks the session server-side.
 */

/** Header of FP1-OWN ("Hồ sơ của tôi"): the profile lives under Thư viện. */
export const PROFILE_HEADER_NAV: readonly (NavItem & { current?: boolean })[] = [
  { label: 'Thư viện', kind: 'LINK', href: '/library', current: true },
  { label: 'Chương trình', kind: 'INERT', reason: 'NO_P0_SCREEN' },
  { label: 'Sự kiện', kind: 'INERT', reason: 'NO_P0_SCREEN' },
  { label: 'Tin tức', kind: 'INERT', reason: 'NO_P0_SCREEN' },
]

/** Header of ME7 ("Dự án & startup của tôi"). "Mạng lưới" is the public Library (PO decision 30/09). */
export const WORKSPACE_HEADER_NAV: readonly NavItem[] = [
  { label: 'Chương trình', kind: 'INERT', reason: 'NO_P0_SCREEN' },
  { label: 'Sự kiện', kind: 'INERT', reason: 'NO_P0_SCREEN' },
  { label: 'Mạng lưới', kind: 'LINK', href: '/library' },
]

export type WorkspaceKey = 'profile' | 'projects' | 'organizations' | 'settings'

export type WorkspaceItem = NavItem & { key: WorkspaceKey | null }

/** Sidebar of ME7, in the board's order. */
export const WORKSPACE_SIDEBAR: readonly WorkspaceItem[] = [
  { key: 'profile', label: 'Hồ sơ của tôi', kind: 'LINK', href: '/me' },
  { key: 'projects', label: 'Dự án & startup', kind: 'LINK', href: '/projects' },
  // Applications are Luồng 5: the member's ventures and their programme
  // applications are listed on the L5 entry (PO decision, Alpha interaction gap fix 30/09).
  { key: null, label: 'Hồ sơ đăng ký', kind: 'LINK', href: PROJECT_DEMO_PATH },
  // The member's organisations are the memberships and leadership of WF02-S04.
  { key: 'organizations', label: 'Tổ chức của tôi', kind: 'LINK', href: '/me/roles' },
  { key: 'settings', label: 'Cài đặt', kind: 'LINK', href: '/me/settings' },
]
