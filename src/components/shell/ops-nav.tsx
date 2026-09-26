'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { PROGRAMME_DEMO_ENTRY, type OpsNavItem } from '@/lib/ops/nav'

import styles from './ops-shell.module.css'

/**
 * WF04-T00 (DEC-WF04-H2): the sidebar-foot entry into the Programme demo, under
 * a "Demo · Internal Alpha" label in the drawn group-label style; current on
 * every demo page.
 */
export function OpsDemoEntry() {
  const pathname = usePathname()
  const { href, label, group } = PROGRAMME_DEMO_ENTRY
  const current = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <div className={styles.demoEntry}>
      <p className={`weight-semibold ${styles.demoGroup}`}>{group}</p>
      <Link
        href={href}
        className={`type-body-sm ${styles.demoLink}`}
        aria-current={current ? 'page' : undefined}
        data-nav="programme-demo"
      >
        {label}
      </Link>
    </div>
  )
}

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
