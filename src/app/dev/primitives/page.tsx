'use client'

import { useState } from 'react'

import { Button, Field, Notice, Surface, TextInput } from '@/components/ui'

/**
 * M0-T04 — deterministic primitives harness.
 *
 * NOT a product screen. It has no baseline in design-reference/final and must
 * never be pixel-compared against one. It renders every primitive in every
 * declared state so Playwright can verify behaviour, accessibility wiring and
 * deterministic rendering in one place.
 *
 * Gating lives in the sibling route segment's layout, because a client
 * component cannot read server-only env. See src/app/dev/primitives/layout.tsx.
 *
 * Layout uses flow and gap only. No spacing value is invented here; the
 * unresolved tokens live in src/styles/primitives.css and are listed in
 * src/lib/design-tokens.ts.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-row={label} style={{ marginBlockStart: '2rem' }}>
      <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
        {label}
      </p>
      <div
        style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBlockStart: '0.5rem' }}
      >
        {children}
      </div>
    </div>
  )
}

export default function PrimitivesHarnessPage() {
  const [clicks, setClicks] = useState(0)
  const [disabledClicks, setDisabledClicks] = useState(0)

  return (
    // Rendered on a surface, because that is where controls actually live: a
    // real page is canvas, cards are surface, and inputs sit inside cards. The
    // readonly input and the info notice are canvas-backgrounded by design, so
    // on a canvas page they would correctly-but-uselessly vanish.
    <main
      className="mx-auto max-w-5xl p-10"
      data-harness="primitives"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
        M0-T04 PRIMITIVES HARNESS — NOT A PRODUCT SCREEN
      </p>

      <Row label="button / primary">
        <Button data-testid="btn-primary" onClick={() => setClicks((n) => n + 1)}>
          Gửi link đăng nhập
        </Button>
        <span data-testid="click-count" className="type-body-sm">
          {clicks}
        </span>
      </Row>

      <Row label="button / secondary">
        <Button variant="secondary" data-testid="btn-secondary">
          Quay lại
        </Button>
      </Row>

      <Row label="button / disabled">
        <Button data-testid="btn-disabled" disabled onClick={() => setDisabledClicks((n) => n + 1)}>
          Không khả dụng
        </Button>
        <span data-testid="disabled-click-count" className="type-body-sm">
          {disabledClicks}
        </span>
      </Row>

      <Row label="button / loading">
        <Button data-testid="btn-loading" loading>
          Đang gửi
        </Button>
      </Row>

      <Row label="button / submit inside form">
        <form
          data-testid="demo-form"
          onSubmit={(event) => {
            event.preventDefault()
            setClicks((n) => n + 1)
          }}
        >
          <Button type="submit" data-testid="btn-submit">
            Gửi
          </Button>
        </form>
      </Row>

      <div data-row="field / default" style={{ marginBlockStart: '2rem', maxWidth: '24rem' }}>
        <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
          field / default with helper
        </p>
        <Field label="Email" helper="Chúng tôi gửi một link dùng một lần.">
          {({ id, invalid, describedBy }) => (
            <TextInput
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="email"
              data-testid="input-default"
              placeholder="ten@donvi.gov.vn"
            />
          )}
        </Field>
      </div>

      <div data-row="field / invalid" style={{ marginBlockStart: '2rem', maxWidth: '24rem' }}>
        <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
          field / invalid with error
        </p>
        <Field label="Email" error="Email không hợp lệ.">
          {({ id, invalid, describedBy }) => (
            <TextInput
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="email"
              data-testid="input-invalid"
              defaultValue="khong-hop-le"
            />
          )}
        </Field>
      </div>

      <div data-row="field / disabled" style={{ marginBlockStart: '2rem', maxWidth: '24rem' }}>
        <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
          field / disabled
        </p>
        <Field label="Email">
          {({ id, invalid, describedBy }) => (
            <TextInput
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              disabled
              data-testid="input-disabled"
              defaultValue="khoa@1hub.network"
            />
          )}
        </Field>
      </div>

      <div data-row="field / readonly" style={{ marginBlockStart: '2rem', maxWidth: '24rem' }}>
        <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
          field / readonly
        </p>
        <Field label="Mã đơn vị">
          {({ id, invalid, describedBy }) => (
            <TextInput
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              readOnly
              data-testid="input-readonly"
              defaultValue="HUB-CHAPTER-01"
            />
          )}
        </Field>
      </div>

      <Row label="notice / info">
        <Notice>Chúng tôi gửi một link dùng một lần, hết hạn sau 15 phút.</Notice>
      </Row>

      <Row label="notice / error">
        <Notice tone="error">Link đăng nhập đã hết hạn.</Notice>
      </Row>

      <div data-row="surface" style={{ marginBlockStart: '2rem', maxWidth: '24rem' }}>
        <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
          surface
        </p>
        {/* Shown on canvas, because a surface is meant to sit on the page. */}
        <div style={{ backgroundColor: 'var(--color-bg-canvas)', padding: '1rem' }}>
          <Surface as="section">
            <p className="type-section-sm">Surface</p>
            <p className="type-body-sm">
              Radius, viền và shadow đo từ baseline đã duyệt của WF01-S01.
            </p>
          </Surface>
        </div>
      </div>
    </main>
  )
}
