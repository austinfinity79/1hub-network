import { describe, expect, it } from 'vitest'

import { COMPLETION_GROUPS } from '@/lib/profile/completion'
import type { NetworkDTO } from '@/lib/network/network'

import { GROUP_LABELS, completionSummary, orgRows } from './home-model'

const groups = (missing: string[]) =>
  COMPLETION_GROUPS.map((code) => ({ code, complete: !missing.includes(code) }))

const EMPTY: NetworkDTO = { memberships: [], leadership: [], roles: [], activity_summary: [] }
const ORG = (id: string, name: string, type = 'CHAPTER') => ({ id, name, type })

describe('WF02-S01 completion summary (DEC-WF02-H13)', () => {
  it('names exactly the server’s missing groups, never education', () => {
    const text = completionSummary({
      percent: 60,
      groups: groups(['AVATAR', 'EXPERIENCE', 'DEVELOPMENT_GOAL', 'CURRENT_NEED']),
    })
    expect(text).toBe(
      'Hồ sơ hoàn thiện 60% · còn thiếu ảnh đại diện, kinh nghiệm, mục tiêu phát triển và nhu cầu hiện tại',
    )
    expect(text).not.toMatch(/học vấn/)
  })

  it('a single missing group, and a complete profile', () => {
    expect(completionSummary({ percent: 90, groups: groups(['AVATAR']) })).toBe(
      'Hồ sơ hoàn thiện 90% · còn thiếu ảnh đại diện',
    )
    expect(completionSummary({ percent: 100, groups: groups([]) })).toBe('Hồ sơ hoàn thiện 100%')
  })

  it('has a label for every canonical group and no other', () => {
    expect(Object.keys(GROUP_LABELS).sort()).toEqual([...COMPLETION_GROUPS].sort())
    expect(Object.values(GROUP_LABELS).join(' ')).not.toMatch(/học vấn|mạng lưới/)
  })

  it('uses the server percent as given', () => {
    expect(completionSummary({ percent: 37, groups: groups([]) })).toBe('Hồ sơ hoàn thiện 37%')
  })
})

describe('WF02-S01 organisation rows', () => {
  it('an empty network has no rows', () => {
    expect(orgRows(EMPTY)).toEqual([])
  })

  it('ventures, then current memberships, then active leadership; history is left to S04', () => {
    const rows = orgRows({
      ...EMPTY,
      roles: [
        {
          venture: { id: 'v1', type: 'STARTUP', name: 'Tracely', status: 'ACTIVE' },
          relation: 'OWNER',
          role_label: null,
        },
        {
          venture: { id: 'v2', type: 'PROJECT', name: 'Beta', status: 'DRAFT' },
          relation: 'MEMBER',
          role_label: 'Co-founder',
        },
      ],
      memberships: [
        {
          id: 'm1',
          organization: ORG('o1', 'Chapter 01'),
          status: 'ACTIVE',
          source_type: 'ORGANIZATION_VERIFIED',
          valid_from: null,
          valid_to: null,
        },
        {
          id: 'm2',
          organization: ORG('o2', 'Chapter 02'),
          status: 'PENDING_APPROVAL',
          source_type: 'SELF_DECLARED',
          valid_from: null,
          valid_to: null,
        },
        {
          id: 'm3',
          organization: ORG('o3', 'Club 01', 'CLB'),
          status: 'WITHDRAWN',
          source_type: 'SELF_DECLARED',
          valid_from: null,
          valid_to: null,
        },
      ],
      leadership: [
        {
          id: 'l1',
          organization: ORG('o1', 'Chapter 01'),
          title: 'Chapter Leader',
          status: 'ACTIVE',
          valid_from: '2026-01-01',
          valid_to: null,
        },
        {
          id: 'l2',
          organization: ORG('o2', 'Chapter 02'),
          title: 'Old',
          status: 'ALUMNI',
          valid_from: '2025-01-01',
          valid_to: '2025-12-31',
        },
      ],
    })
    expect(rows.map((r) => [r.name, r.detail, r.href])).toEqual([
      ['Tracely', 'Chủ sở hữu · startup', '/projects/v1/edit'],
      ['Beta', 'Co-founder · dự án', '/me/roles'],
      ['Chapter 01', 'Thành viên · chapter', '/me/roles'],
      ['Chapter 02', 'Đang chờ duyệt', '/me/roles'],
      ['Chapter 01', 'Chapter Leader · chapter', '/me/roles'],
    ])
  })

  it('never derives a row from anything but the network DTO', () => {
    const rows = orgRows({ ...EMPTY, leadership: [] })
    expect(rows).toHaveLength(0)
  })
})
