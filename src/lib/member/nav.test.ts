import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { HEADER_NAV, SIDEBAR_NAV, isFrozenMemberRoute } from './nav'
import { PROFILE_HEADER_NAV, WORKSPACE_HEADER_NAV, WORKSPACE_SIDEBAR } from './workspace-nav'

describe('member shell navigation (DEC-WF02-H9, DEC-L2R-D1)', () => {
  it('every interactive item targets a frozen member route', () => {
    for (const item of [...HEADER_NAV, ...SIDEBAR_NAV, ...WORKSPACE_SIDEBAR]) {
      if (item.kind === 'LINK') expect(isFrozenMemberRoute(item.href), item.href).toBe(true)
    }
  })

  it('Library, Challenge and Events stay inert: no P0 Production route', () => {
    expect(HEADER_NAV.map((i) => [i.label, i.kind])).toEqual([
      ['Thư viện', 'INERT'],
      ['Challenge', 'INERT'],
      ['Sự kiện', 'INERT'],
    ])
  })

  it('the sidebar keeps the approved order; invitations lead to the projects page', () => {
    expect(SIDEBAR_NAV.map((i) => i.label)).toEqual([
      'Hồ sơ của tôi',
      'Hồ sơ cá nhân',
      'Quyền riêng tư & hiển thị',
      'Cài đặt tài khoản',
      'Lời mời',
      'Vai trò & liên kết',
      'Tổ chức của tôi',
    ])
    expect(SIDEBAR_NAV.find((i) => i.label === 'Lời mời')).toMatchObject({
      kind: 'LINK',
      href: '/projects',
    })
    expect(SIDEBAR_NAV.filter((i) => i.kind === 'INERT').map((i) => i.label)).toEqual([
      'Tổ chức của tôi',
    ])
  })

  it('the workspace frames draw the board items; only existing pages are links', () => {
    expect(WORKSPACE_SIDEBAR.map((i) => [i.label, i.kind])).toEqual([
      ['Hồ sơ của tôi', 'LINK'],
      ['Dự án & startup', 'LINK'],
      ['Hồ sơ đăng ký', 'INERT'],
      ['Tổ chức của tôi', 'LINK'],
      ['Cài đặt', 'LINK'],
    ])
    expect(WORKSPACE_HEADER_NAV.every((i) => i.kind === 'INERT')).toBe(true)
    // The profile header links the public Library page, which exists as a route file.
    for (const item of PROFILE_HEADER_NAV) {
      if (item.kind !== 'LINK') continue
      expect(item.href).toBe('/library')
      expect(existsSync(join(process.cwd(), 'src/app/(public)/library/page.tsx'))).toBe(true)
    }
  })

  it('no item carries a count or an invented route', () => {
    for (const item of [
      ...HEADER_NAV,
      ...SIDEBAR_NAV,
      ...WORKSPACE_SIDEBAR,
      ...WORKSPACE_HEADER_NAV,
      ...PROFILE_HEADER_NAV,
    ]) {
      expect(item).not.toHaveProperty('count')
      expect(item.label).not.toMatch(/\d/)
    }
    expect(isFrozenMemberRoute('/me/invitations')).toBe(false)
    expect(isFrozenMemberRoute('/library')).toBe(false)
  })
})
