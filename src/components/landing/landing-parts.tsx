import Link from 'next/link'
import type { ReactNode } from 'react'

import { INERT_REASONS } from '@/lib/member/nav'

import styles from './landing.module.css'

/**
 * TASK 22.1 — shared pieces of the corrected public homepage (H1).
 *
 * DEMO-HOME-ABOUT-01: the homepage itself is rebuilt (src/components/home);
 * these pieces and landing.module.css stay only for /library (L15), whose
 * protected header still uses Cta and NavLabel.
 *
 * A call to action is either a real destination (a route that exists, an
 * in-page section, an approved external site opened in a new tab, or the
 * visitor's own entry point) or INERT: it keeps its place in the approved
 * layout, never navigates and says why on hover and to assistive technology
 * (DEC-P0-SHELL-D2 reasons). No `href="#"`, no script URL.
 *
 * PO P3 cleanup (01/10): an inert CTA is drawn visibly disabled (the disabled
 * pattern of the UI primitives), and a planned capability that stays visible
 * carries a visible "Sắp có" (`soon`) instead of relying on the tooltip.
 */

export type InertReason = keyof typeof INERT_REASONS

export type Action = { href: string } | { inert: InertReason }

export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={`${styles.arrow} ${className ?? ''}`}
      viewBox="0 0 12 10"
      width="12"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0.5 5h10M6.5 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/** A link, or the same visual as an inert element when the destination does not exist yet. */
export function Cta({
  action,
  className,
  children,
  label,
  cta,
  soon,
}: {
  action: Action
  className?: string
  children: ReactNode
  /** Accessible name when `children` is not plain text. */
  label: string
  cta?: string
  /** Inert only: a planned capability that stays visible shows "Sắp có". */
  soon?: boolean
}) {
  if ('href' in action) {
    if (action.href.startsWith('https://'))
      return (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          data-cta={cta}
        >
          {children}
        </a>
      )
    return action.href.startsWith('#') ? (
      <a href={action.href} className={className} data-cta={cta}>
        {children}
      </a>
    ) : (
      <Link href={action.href} className={className} data-cta={cta}>
        {children}
      </Link>
    )
  }
  const reason = INERT_REASONS[action.inert]
  return (
    <span
      className={`${className ?? ''} ${styles.inert}`}
      aria-disabled="true"
      data-cta-kind="INERT"
      title={reason}
      aria-label={`${label} — ${reason}`}
    >
      {children}
      {soon ? (
        <span className={styles.soon} aria-hidden="true">
          Sắp có
        </span>
      ) : null}
    </span>
  )
}

/**
 * PO decision (Alpha interaction gap fix, 30/09): a public navigation item with
 * no approved destination is plain text. It is not a link and not a disabled
 * control, and carries no "coming soon" tooltip.
 */
export function NavLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={className} data-nav-kind="LABEL">
      {children}
    </span>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`${styles.eyebrow} ${className ?? ''}`}>{children}</p>
}
