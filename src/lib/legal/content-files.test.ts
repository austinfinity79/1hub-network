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

// DEC-LEGAL-V1: the v1.0 documents (PO 2026-10-01). Verbatim from the two
// approved DOCX drafts; the only changes are the effective date and the
// support e-mail placeholder.
describe('production legal content v1.0', () => {
  const terms = read('TERMS_ACCEPTANCE.v1.0.md')
  const privacy = read('PRIVACY_DATA_PROCESSING.v1.0.md')
  const headings = (text: string) =>
    text
      .split(/\n\s*\n/)
      .filter((b) => b.startsWith('## '))
      .map((b) => b.slice(3).trim())

  it('keeps every section of each document, in order', () => {
    expect(headings(terms)).toEqual([
      '1. Nền tảng và đơn vị vận hành',
      '2. Tiếp cận và chấp thuận điều khoản',
      '3. Tài khoản và bảo vệ quyền truy cập',
      '4. Hồ sơ và quan hệ với cộng đồng hoặc tổ chức',
      '5. Nội dung do người dùng cung cấp',
      '6. Mức hiển thị và quyền truy cập dữ liệu',
      '7. Sự kiện và chương trình',
      '8. Hành vi không được phép',
      '9. Phí và giao dịch với bên khác',
      '10. Dịch vụ tích hợp và quyền sở hữu của nền tảng',
      '11. Vận hành và trách nhiệm',
      '12. Quyền riêng tư và yêu cầu về dữ liệu',
      '13. Thay đổi, dừng sử dụng và giải quyết phản ánh',
      '14. Thông tin liên hệ',
    ])
    expect(headings(privacy)).toEqual([
      '1. Đơn vị chịu trách nhiệm và phạm vi',
      '2. Dữ liệu chúng tôi có thể xử lý',
      '3. Nguồn dữ liệu và mục đích sử dụng',
      '4. Ai có thể xem dữ liệu',
      '5. Bên nhận dữ liệu và dịch vụ hỗ trợ',
      '6. Đăng nhập, cookie và liên kết ngoài',
      '7. Lưu giữ, xóa và lưu trữ bản ghi',
      '8. Bảo mật dữ liệu',
      '9. Quyền của bạn',
      '10. Dữ liệu của người chưa thành niên',
      '11. Cập nhật chính sách',
      '12. Thông tin liên hệ',
    ])
  })

  it('carries the approved metadata, entity and contact, with no placeholder left', () => {
    for (const text of [terms, privacy]) {
      expect(text).toContain(
        '> Bản dự thảo v1.0  |  Ngày soạn 29/09/2026  |  Ngày hiệu lực 01/10/2026',
      )
      expect(text).toContain('CÔNG TY TNHH VƯỜN ƯƠM KHỞI NGHIỆP SÁNG TẠO QUỐC GIA IHUB')
      expect(text).toContain('D12 Giảng Võ, TP. Hà Nội')
      expect(text).toContain('global@1hub.network')
      expect(text).not.toMatch(/\[(CẦN XÁC NHẬN|EMAIL HỖ TRỢ)\]/)
      expect(text).not.toMatch(/\[[A-ZÀ-Ỹ][A-ZÀ-Ỹ ,.]{3,}\]/)
      expect(text).not.toContain('KHÔNG PHẢI VĂN BẢN PHÁP LÝ')
    }
    expect(terms.startsWith('# Điều khoản sử dụng 1hub.network')).toBe(true)
    expect(privacy.startsWith('# Chính sách quyền riêng tư 1hub.network')).toBe(true)
  })
})
