import { describe, expect, it } from 'vitest'

import {
  currentStatus,
  formatDate,
  historyRows,
  missingDocuments,
  type Consent,
  type LegalDoc,
} from './privacy-model'

const TERMS: LegalDoc = {
  type: 'TERMS_ACCEPTANCE',
  version: '2.0',
  title: 'Điều khoản',
  content_url: '/legal/terms/2.0',
}
const PRIVACY: LegalDoc = {
  type: 'PRIVACY_DATA_PROCESSING',
  version: '1.1',
  title: 'Quyền riêng tư',
  content_url: '/legal/privacy/1.1',
}

const consent = (
  id: string,
  type: Consent['type'],
  v: string,
  at: string,
  revoked = false,
): Consent => ({
  id,
  type,
  policy_version: v,
  status: revoked ? 'REVOKED' : 'ACCEPTED',
  accepted_at: at,
  revoked_at: revoked ? at : null,
})

describe('WF02-S03 legal status', () => {
  it('both current versions accepted → nothing missing', () => {
    const status = currentStatus(
      [TERMS, PRIVACY],
      [
        consent('a', 'TERMS_ACCEPTANCE', '2.0', '2026-09-01T03:00:00Z'),
        consent('b', 'PRIVACY_DATA_PROCESSING', '1.1', '2026-09-01T03:00:00Z'),
      ],
    )
    expect(missingDocuments(status)).toEqual([])
    expect(status[0]!.acceptedAt).toBe('2026-09-01T03:00:00Z')
  })

  it('a stale acceptance never satisfies the current version', () => {
    const status = currentStatus(
      [TERMS, PRIVACY],
      [
        consent('a', 'TERMS_ACCEPTANCE', '1.0', '2026-01-01T03:00:00Z'),
        consent('b', 'PRIVACY_DATA_PROCESSING', '1.1', '2026-01-01T03:00:00Z'),
      ],
    )
    expect(missingDocuments(status)).toEqual([TERMS])
  })

  it('both stale → both missing; only one type accepted → the other missing', () => {
    expect(missingDocuments(currentStatus([TERMS, PRIVACY], []))).toEqual([TERMS, PRIVACY])
    expect(
      missingDocuments(
        currentStatus(
          [TERMS, PRIVACY],
          [consent('b', 'PRIVACY_DATA_PROCESSING', '1.1', '2026-01-01T00:00:00Z')],
        ),
      ),
    ).toEqual([TERMS])
  })

  it('a version of the other type does not count (matched by type and version)', () => {
    const status = currentStatus(
      [TERMS],
      [consent('x', 'PRIVACY_DATA_PROCESSING', '2.0', '2026-01-01T00:00:00Z')],
    )
    expect(missingDocuments(status)).toEqual([TERMS])
  })

  it('a revoked record does not count', () => {
    const status = currentStatus(
      [TERMS],
      [consent('a', 'TERMS_ACCEPTANCE', '2.0', '2026-01-01T00:00:00Z', true)],
    )
    expect(missingDocuments(status)).toEqual([TERMS])
  })
})

describe('WF02-S03 consent history', () => {
  it('keeps every record and marks current, stale and revoked', () => {
    const rows = historyRows(
      [TERMS, PRIVACY],
      [
        consent('c', 'TERMS_ACCEPTANCE', '2.0', '2026-09-20T17:30:00Z'),
        consent('b', 'TERMS_ACCEPTANCE', '1.0', '2026-01-15T09:00:00Z'),
        consent('a', 'PRIVACY_DATA_PROCESSING', '1.0', '2026-01-15T09:00:00Z', true),
      ],
    )
    expect(rows.map((r) => [r.title, r.state])).toEqual([
      ['Điều khoản sử dụng', 'CURRENT'],
      ['Điều khoản sử dụng', 'STALE'],
      ['Chính sách quyền riêng tư', 'REVOKED'],
    ])
    // 17:30 UTC is the next day in Asia/Ho_Chi_Minh.
    expect(rows[0]!.detail).toBe('Phiên bản 2.0 · đồng ý 21/09/2026 · phiên bản hiện hành')
  })

  it('formats dates in the product timezone', () => {
    expect(formatDate('2026-01-15T09:00:00Z')).toBe('15/01/2026')
  })
})
