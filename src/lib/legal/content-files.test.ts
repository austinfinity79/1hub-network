import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// DEC-LEGAL-D1: the production text shipped in content/legal for the current
// document versions. Verbatim copies of the approved source; this only guards
// against a missing file, a fixture slipping in, or the split between A and B.
const dir = path.resolve(__dirname, '../../../content/legal')
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8')

describe('production legal content', () => {
  const terms = read('TERMS_ACCEPTANCE.p0-2026-09.md')
  const privacy = read('PRIVACY_DATA_PROCESSING.p0-2026-09.md')

  it('is the approved text, not the non-production fixture', () => {
    for (const text of [terms, privacy]) {
      expect(text).not.toContain('KHÔNG PHẢI VĂN BẢN PHÁP LÝ')
      expect(text.trim().length).toBeGreaterThan(1000)
    }
    expect(terms).toContain('Phiên bản 1.5 | Cập nhật ngày 24/09/2026')
  })

  it('holds Phần A in the terms file and Phần B in the privacy file', () => {
    expect(terms).toContain('Phần A Điều khoản sử dụng')
    expect(terms).toContain('A10 Cập nhật và hiệu lực áp dụng')
    expect(terms).not.toContain('Phần B Chính sách quyền riêng tư')
    expect(privacy.startsWith('Phần B Chính sách quyền riêng tư')).toBe(true)
    expect(privacy).toContain('B15 LIÊN HỆ')
    expect(privacy).not.toContain('Phần A Điều khoản sử dụng')
  })
})
