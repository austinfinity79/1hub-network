import Link from 'next/link'

import { PageContainer } from '@/components/shell/page-container'

/**
 * M0-T03 — route-not-found boundary.
 *
 * Next.js ships an unstyled default; this replaces it with the project's
 * typography and colour tokens. No product copy is invented beyond naming the
 * condition. PO P3 cleanup (01/10): one recovery action, "Về trang chủ" → `/`,
 * with the existing button primitive; browser Back is untouched.
 */
export default function NotFound() {
  return (
    <PageContainer>
      <section data-shell="not-found">
        <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
          404
        </p>
        <h1 className="type-heading-2 mt-2">Không tìm thấy trang</h1>
        <p className="type-body-md mt-2">Đường dẫn này không tồn tại.</p>
        <p className="mt-6">
          <Link href="/" className="ui-button" data-variant="primary" data-nav="not-found-home">
            Về trang chủ
          </Link>
        </p>
      </section>
    </PageContainer>
  )
}
