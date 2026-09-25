import { notFound } from 'next/navigation'

/**
 * M0-T02 — deterministic typography harness. M0-T03 gated it to dev/test only.
 *
 * NOT a product screen. It has no baseline in design-reference/final and must
 * never be pixel-compared against one. Its only job is to render every frozen
 * typography primitive at once so the foundation QA pass can read computed
 * font-family and font-weight and confirm the self-hosted faces resolved.
 *
 * Every sample carries the family and weight the Design SOT requires, so the
 * check is data-driven rather than hand-transcribed.
 *
 * Layout spacing uses Tailwind defaults on purpose: the Design SOT defers
 * spacing tokens, so no 1hub spacing value is invented here.
 *
 * GATING (M0-T03): this route is not production-facing. It returns 404 unless
 * ENABLE_DEV_ROUTES=1, which only the dev server and the Playwright visual
 * config set. force-dynamic keeps the check per-request rather than baking a
 * build-time 404 into the static output. It is also absent from the frozen
 * route manifest, so it can never appear in product navigation.
 */

export const dynamic = 'force-dynamic'

type Sample = {
  className: string
  label: string
  expectFamily: string
  expectWeight: number
  text: string
}

const VI = 'Kết nối hệ sinh thái đổi mới sáng tạo'

const SAMPLES: Sample[] = [
  {
    className: 'type-display',
    label: 'display 34/44 — Archivo Bold, approved display only',
    expectFamily: 'Archivo',
    expectWeight: 700,
    text: VI,
  },
  {
    className: 'type-heading-2',
    label: 'heading-2 26/36 — SemiBold',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 600,
    text: VI,
  },
  {
    className: 'type-subtitle',
    label: 'subtitle 20/30 — SemiBold',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 600,
    text: VI,
  },
  {
    className: 'type-section-sm',
    label: 'section-sm 17/26 — SemiBold',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 600,
    text: VI,
  },
  {
    className: 'type-body-md',
    label: 'body-md 16/28 — Regular',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 400,
    text: VI,
  },
  {
    className: 'type-body-sm',
    label: 'body-sm 14/24 — Regular',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 400,
    text: VI,
  },
  {
    className: 'type-body-sm weight-medium',
    label: 'body-sm 14/24 — Medium, the second weight the SOT permits here',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 500,
    text: VI,
  },
  {
    className: 'type-meta-xs',
    label: 'meta-xs 13/18 — Regular',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 400,
    text: VI,
  },
  {
    className: 'type-button',
    label: 'button 16/20 — SemiBold',
    expectFamily: 'Be Vietnam Pro',
    expectWeight: 600,
    text: 'Gửi link đăng nhập',
  },
  {
    className: 'type-mono-meta',
    label: 'mono-meta 13/18 — IBM Plex Mono Medium, approved meta only',
    expectFamily: 'IBM Plex Mono',
    expectWeight: 500,
    text: 'HUB-CHAPTER-01 · 2026-09-25',
  },
]

const SWATCHES = [
  { token: '--hub-primary', value: '#fc523c' },
  { token: '--hub-primary-soft', value: '#fff3f0' },
  { token: '--hub-burgundy', value: '#160002' },
  { token: '--hub-canvas', value: '#efefef' },
  { token: '--hub-surface', value: '#ffffff' },
]

export default function TypographyHarnessPage() {
  if (process.env.ENABLE_DEV_ROUTES !== '1') notFound()

  return (
    <main
      className="mx-auto max-w-5xl p-10"
      data-harness="typography"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
        M0-T02 FOUNDATION HARNESS — NOT A PRODUCT SCREEN
      </p>

      <section className="mt-8" data-section="type-scale">
        {SAMPLES.map((sample) => (
          <div
            key={sample.className}
            className="border-t py-5"
            style={{ borderColor: 'var(--color-bg-canvas)' }}
          >
            <p className="type-meta-xs" style={{ color: 'var(--color-fg-accent)' }}>
              {sample.label}
            </p>
            <p
              className={sample.className}
              data-type-sample={sample.className}
              data-expect-family={sample.expectFamily}
              data-expect-weight={sample.expectWeight}
            >
              {sample.text}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-10" data-section="color-anchors">
        <p className="type-section-sm">Color anchors</p>
        <div className="mt-4 flex flex-wrap gap-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.token} data-swatch={swatch.token}>
              <div
                className="h-16 w-32 rounded border"
                style={{
                  backgroundColor: `var(${swatch.token})`,
                  borderColor: 'var(--color-bg-canvas)',
                }}
              />
              <p className="type-mono-meta mt-2">{swatch.token}</p>
              <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
                {swatch.value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
