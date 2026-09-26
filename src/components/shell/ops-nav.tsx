'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { OpsNavItem } from '@/lib/ops/nav'

import styles from './ops-shell.module.css'

/** Marks the current destination; the list itself is decided on the server. */
export function OpsNav({ items, label }: { items: OpsNavItem[]; label: string }) {
  const pathname = usePathname()
  return (
    <ul className={styles.items} aria-label={label}>
      {items.map((item) => {
        const current = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`type-body-sm ${styles.item}`}
              aria-current={current ? 'page' : undefined}
              data-nav-key={item.key}
            >
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
