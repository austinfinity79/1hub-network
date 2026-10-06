import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * DEMO-HOME-ABOUT-01 — every call to action on the new public surfaces
 * (DEMO-D6, docs/demo-0710/SCREEN_ROUTE_MAP.md "Calls to action").
 *
 * - `href`: a route that exists, an in-page anchor, or an approved external
 *   site (opened in a new tab).
 * - `null` / no href: a destination that is not built yet or a post-demo
 *   workflow. It keeps its drawn place and look, never navigates, is not
 *   focusable, says why on hover and to assistive technology, and never
 *   reports a success. No `href="#"`, no script URL.
 */
export const NOT_YET = 'Sắp có trong phiên bản tiếp theo'

export function PublicAction({
  href,
  className,
  children,
  label,
  cta,
}: {
  href: string | null | undefined
  className?: string
  children: ReactNode
  /** Accessible name when `children` is not plain text. */
  label?: string
  cta?: string
}) {
  if (href) {
    if (/^https?:\/\//.test(href))
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          data-cta={cta}
          aria-label={label}
        >
          {children}
        </a>
      )
    if (href.startsWith('#'))
      return (
        <a href={href} className={className} data-cta={cta} aria-label={label}>
          {children}
        </a>
      )
    return (
      <Link href={href} className={className} data-cta={cta} aria-label={label}>
        {children}
      </Link>
    )
  }
  return (
    <span
      className={className}
      data-cta={cta}
      data-cta-kind="INERT"
      aria-disabled="true"
      style={{ cursor: 'default' }}
      title={NOT_YET}
      aria-label={`${label ?? (typeof children === 'string' ? children : '')} — ${NOT_YET}`}
    >
      {children}
    </span>
  )
}

/** A navigation entry whose screen does not exist yet: plain text (DEC-AIG-D1). */
export function NavText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={className} data-nav-kind="LABEL">
      {children}
    </span>
  )
}

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 10"
      width="12"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0.5 5h10M6.5 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 10 10"
      width="10"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 8.5l7-7M2.5 1.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
