import { describe, expect, it } from 'vitest'

import type { NetworkDTO } from '@/lib/network/network'

import { calendarDate, roleRows, selectableOrganizations } from './roles-model'

const EMPTY: NetworkDTO = { memberships: [], leadership: [], roles: [], activity_summary: [] }
const ORG = (id: string, name: string, type = 'CHAPTER') => ({ id, name, type })
const mem = (
  id: string,
  org: string,
  status: string,
  source_type: 'SELF_DECLARED' | 'ORGANIZATION_VERIFIED' | null,
  valid_from: string | null = null,
) => ({
  id,
  organization: ORG(org, `Org ${org}`),
  status,
  source_type,
  valid_from,
  valid_to: null,
})

describe('WF02-S04 role rows', () => {
  it('no relationships → no rows', () => {
    expect(roleRows(EMPTY)).toEqual([])
  })

  it('keeps venture, membership and leadership as separate rows with canonical labels', () => {
    const rows = roleRows({
      ...EMPTY,
      roles: [
        {
          venture: { id: 'v', type: 'STARTUP', name: 'Tracely', status: 'ACTIVE' },
          relation: 'OWNER',
          role_label: null,
        },
      ],
      memberships: [
        mem('m1', 'o1', 'ACTIVE', 'ORGANIZATION_VERIFIED', '2026-09-01'),
        mem('m2', 'o2', 'PENDING_APPROVAL', 'SELF_DECLARED'),
        mem('m3', 'o3', 'REJECTED', 'SELF_DECLARED'),
      ],
      leadership: [
        {
          id: 'l1',
          organization: ORG('o1', 'Org o1'),
          title: 'Phó Chủ tịch',
          status: 'ACTIVE',
          valid_from: '2026-08-18',
          valid_to: null,
        },
        {
          id: 'l2',
          organization: ORG('o1', 'Org o1'),
          title: 'Thư ký',
          status: 'ALUMNI',
          valid_from: '2025-01-01',
          valid_to: '2025-12-31',
        },
      ],
    })
    expect(rows.map((r) => [r.kind, r.name, r.chip, r.role, r.trust, r.pending])).toEqual([
      ['venture', 'Tracely', 'startup', 'Chủ sở hữu', 'Hệ thống ghi nhận', false],
      ['membership', 'Org o1', 'chapter', 'Thành viên', 'Tổ chức xác nhận · từ 01/09/2026', false],
      ['membership', 'Org o2', 'chapter', 'Đang chờ duyệt', 'Tự khai báo', true],
      ['membership', 'Org o3', 'chapter', 'Không được duyệt', 'Tự khai báo', false],
      ['leadership', 'Org o1', 'chapter', 'Phó Chủ tịch', 'từ 18/08/2026', false],
      ['leadership', 'Org o1', 'chapter', 'Thư ký · đã kết thúc', 'từ 01/01/2025', false],
    ])
  })

  it('never shows an approver name and never claims a source that is not stored', () => {
    const rows = roleRows({ ...EMPTY, memberships: [mem('m', 'o', 'ACTIVE', null)] })
    expect(rows[0]!.trust).toBe('')
    expect(
      JSON.stringify(
        roleRows({ ...EMPTY, memberships: [mem('m', 'o', 'ACTIVE', 'ORGANIZATION_VERIFIED')] }),
      ),
    ).not.toMatch(/duyệt \d/)
  })

  it('formats stored calendar dates without a timezone shift', () => {
    expect(calendarDate('2026-01-31')).toBe('31/01/2026')
  })
})

describe('WF02-S04 selector convenience filter (DEC-WF02-S04-G4)', () => {
  it('hides organisations with a blocking membership; REJECTED/WITHDRAWN stay selectable', () => {
    const options = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({
      id,
      name: id,
      type: 'CHAPTER',
    }))
    const network: NetworkDTO = {
      ...EMPTY,
      memberships: [
        mem('1', 'a', 'ACTIVE', null),
        mem('2', 'b', 'PENDING_APPROVAL', null),
        mem('3', 'c', 'SUSPENDED', null),
        mem('4', 'd', 'ALUMNI', null),
        mem('5', 'e', 'REJECTED', null),
        mem('6', 'f', 'WITHDRAWN', null),
      ],
    }
    expect(selectableOrganizations(options, network).map((o) => o.id)).toEqual(['e', 'f', 'g'])
  })
})
