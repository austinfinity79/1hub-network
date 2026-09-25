import { notFound } from 'next/navigation'

import { devRoutesEnabled } from '@/lib/dev-routes'

/**
 * M0-T11 — deterministic Pixel QA harness. DEV/TEST ONLY.
 *
 * NOT a product screen, and it has no approved reference in
 * design-reference/final. It exists only to prove the Pixel QA engine: that a
 * capture is produced, that an unchanged render compares identical, and that a
 * deliberate change is detected and located.
 *
 *   ?variant=changed  moves and recolours one block (the intentional mismatch)
 *   ?long=1           extends the page past 900px for full-page capture
 *
 * Content is static text only, with no dates, randomness or remote assets.
 * Gated like every dev harness (ENABLE_DEV_ROUTES) and absent from the frozen
 * route manifest.
 */
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PixelQaHarnessPage({ searchParams }: Props) {
  if (!devRoutesEnabled()) notFound()

  const params = await searchParams
  const changed = params.variant === 'changed'
  const long = params.long === '1'

  return (
    <main
      data-pixel-qa-harness
      className="min-h-screen px-16 py-12"
      style={{ background: 'var(--color-bg-canvas)', color: 'var(--color-fg-default)' }}
    >
      <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
        PIXEL QA HARNESS · NOT A PRODUCT SCREEN
      </p>
      <h1 className="type-display mt-4">Pixel QA harness</h1>
      <p className="type-body-md mt-4 max-w-2xl">
        Kết nối hệ sinh thái đổi mới sáng tạo. Nội dung cố định để kiểm chứng engine so sánh.
      </p>

      <section className="mt-10 grid grid-cols-3 gap-6">
        {['Khối A', 'Khối B', 'Khối C'].map((label) => (
          <div
            key={label}
            className="rounded-lg p-6"
            style={{ background: 'var(--color-bg-surface)', height: 160 }}
          >
            <p className="type-section-sm">{label}</p>
            <p className="type-body-sm mt-2">Bề mặt, khoảng cách và màu cố định.</p>
          </div>
        ))}
      </section>

      <div
        data-pixel-qa-target
        className="rounded-lg"
        style={{
          marginTop: changed ? 64 : 40,
          marginLeft: changed ? 48 : 0,
          width: 320,
          height: 120,
          background: changed ? 'var(--color-fg-default)' : 'var(--color-bg-accent)',
        }}
      />

      {long ? (
        <section data-pixel-qa-long className="mt-10" style={{ height: 1200 }}>
          <p className="type-subtitle">Phần kéo dài cho full-page capture</p>
          <div
            className="mt-6 rounded-lg"
            style={{ height: 1000, background: 'var(--color-bg-surface)' }}
          />
        </section>
      ) : null}
    </main>
  )
}
