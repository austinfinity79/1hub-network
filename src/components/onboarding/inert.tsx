import type { ReactNode } from 'react'

import { INERT_REASONS } from '@/lib/member/nav'

/**
 * A control the L1 board draws whose capability does not exist in this build
 * (AI suggestion: no provider, D-A1). It keeps
 * its place, starts nothing and says why on hover and to assistive technology
 * (DEC-P0-SHELL-D2 reasons). Never a link, never a button.
 */
export function Inert({
  reason,
  label,
  className,
  children,
}: {
  reason: keyof typeof INERT_REASONS
  /** Accessible name; the reason is appended. */
  label: string
  className?: string
  children: ReactNode
}) {
  const text = INERT_REASONS[reason]
  return (
    <span
      className={className}
      aria-disabled="true"
      data-cta-kind="INERT"
      title={text}
      aria-label={`${label} — ${text}`}
    >
      {children}
    </span>
  )
}
