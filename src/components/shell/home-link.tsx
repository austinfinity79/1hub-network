import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * P0-SHELL (DEC-P0-SHELL-D1) — the brand wordmark of every shell leads to the
 * public homepage `/`. It inherits the wordmark's drawn typography and colour,
 * so the approved pixels do not change; only the behaviour is added.
 */
export function HomeLink({ children }: { children: ReactNode }) {
  return (
    <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }} data-nav="home">
      {children}
    </Link>
  )
}
