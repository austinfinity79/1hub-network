import { PageContainer } from '@/components/shell/page-container'

/**
 * M0-T03 — route-not-found boundary.
 *
 * Next.js ships an unstyled default; this replaces it with the project's
 * typography and colour tokens. No product copy is invented beyond naming the
 * condition, and no navigation is offered because no approved screen exists yet.
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
      </section>
    </PageContainer>
  )
}
