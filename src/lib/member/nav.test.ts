import { describe, expect, it } from 'vitest'

import { HEADER_NAV, SIDEBAR_NAV, isFrozenMemberRoute } from './nav'

describe('member shell navigation (DEC-WF02-H9)', () => {
  it('every interactive item targets a frozen member route', () => {
    for (const item of [...HEADER_NAV, ...SIDEBAR_NAV]) {
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

  it('the sidebar keeps the approved order; invitations and organisations are inert', () => {
    expect(SIDEBAR_NAV.map((i) => i.label)).toEqual([
      'Tổng quan',
      'Hồ sơ cá nhân',
      'Quyền riêng tư & hiển thị',
      'Cài đặt tài khoản',
      'Lời mời',
      'Vai trò & liên kết',
      'Tổ chức của tôi',
    ])
    expect(SIDEBAR_NAV.filter((i) => i.kind === 'INERT').map((i) => i.label)).toEqual([
      'Lời mời',
      'Tổ chức của tôi',
    ])
  })

  it('no item carries a count or an invented route', () => {
    for (const item of [...HEADER_NAV, ...SIDEBAR_NAV]) {
      expect(item).not.toHaveProperty('count')
      expect(item.label).not.toMatch(/\d/)
    }
    expect(isFrozenMemberRoute('/me/invitations')).toBe(false)
    expect(isFrozenMemberRoute('/library')).toBe(false)
  })
})
