import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PROJECT_DEMO_PATH } from '@/lib/project-demo/routes'

import { HEADER_NAV, SIDEBAR_NAV, isFrozenMemberRoute } from './nav'
import { PROFILE_HEADER_NAV, WORKSPACE_HEADER_NAV, WORKSPACE_SIDEBAR } from './workspace-nav'

describe('member shell navigation (DEC-WF02-H9, DEC-L2R-D1)', () => {
  it('every interactive item targets a frozen member route, the Library or the L5 entry', () => {
    const extra = new Set(['/library', PROJECT_DEMO_PATH])
    for (const item of [
      ...HEADER_NAV,
      ...SIDEBAR_NAV,
      ...WORKSPACE_SIDEBAR,
      ...WORKSPACE_HEADER_NAV,
    ]) {
      if (item.kind !== 'LINK') continue
      expect(isFrozenMemberRoute(item.href) || extra.has(item.href), item.href).toBe(true)
    }
    for (const page of [
      'src/app/(public)/library/page.tsx',
      'src/app/(demo)/demo/projects/page.tsx',
    ]) {
      expect(existsSync(join(process.cwd(), page)), page).toBe(true)
    }
  })

  it('Thư viện opens the public Library; Challenge and Events stay inert (no P0 route)', () => {
    expect(HEADER_NAV.map((i) => [i.label, i.kind])).toEqual([
      ['Thư viện', 'LINK'],
      ['Challenge', 'INERT'],
      ['Sự kiện', 'INERT'],
    ])
    expect(HEADER_NAV[0]).toMatchObject({ href: '/library' })
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
    // PO decision (Alpha interaction gap fix): the organisations are WF02-S04's, as in ME7.
    expect(SIDEBAR_NAV.find((i) => i.label === 'Tổ chức của tôi')).toMatchObject({
      kind: 'LINK',
      href: '/me/roles',
    })
    expect(SIDEBAR_NAV.filter((i) => i.kind === 'INERT')).toEqual([])
  })

  it('the workspace frames draw the board items; only existing pages are links', () => {
    expect(WORKSPACE_SIDEBAR.map((i) => [i.label, i.kind])).toEqual([
      ['Hồ sơ của tôi', 'LINK'],
      ['Dự án & startup', 'LINK'],
      ['Hồ sơ đăng ký', 'LINK'],
      ['Tổ chức của tôi', 'LINK'],
      ['Cài đặt', 'LINK'],
    ])
    // Applications are listed on the L5 entry; "Mạng lưới" is the public Library.
    expect(WORKSPACE_SIDEBAR.find((i) => i.label === 'Hồ sơ đăng ký')).toMatchObject({
      href: PROJECT_DEMO_PATH,
    })
    expect(WORKSPACE_HEADER_NAV.map((i) => [i.label, i.kind])).toEqual([
      ['Chương trình', 'INERT'],
      ['Sự kiện', 'INERT'],
      ['Mạng lưới', 'LINK'],
    ])
    expect(WORKSPACE_HEADER_NAV[2]).toMatchObject({ href: '/library' })
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
