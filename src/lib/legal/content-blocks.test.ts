import { describe, expect, it } from 'vitest'

import { toBlocks } from './content'

describe('legal content blocks', () => {
  it('reads title, metadata and numbered section headings; the rest is body text', () => {
    expect(toBlocks(['# Tên', '> Bản dự thảo v1.0', '## 3. Mục ba', 'Nội dung.'])).toEqual([
      { kind: 'title', text: 'Tên' },
      { kind: 'meta', text: 'Bản dự thảo v1.0' },
      { kind: 'heading', text: '3. Mục ba', id: 'muc-3' },
      { kind: 'text', text: 'Nội dung.' },
    ])
  })

  it('leaves plain files (no markers) as body text, exactly as before', () => {
    expect(toBlocks(['Phần A Điều khoản sử dụng', 'A1 Phạm vi'])).toEqual([
      { kind: 'text', text: 'Phần A Điều khoản sử dụng' },
      { kind: 'text', text: 'A1 Phạm vi' },
    ])
  })
})
