import Link from 'next/link'
import type { ReactNode } from 'react'

import type { MemberIdentity } from '@/lib/member/guard'
import {
  HEADER_NAV,
  INERT_REASONS,
  OPS_ENTRY,
  PROJECT_DEMO_ENTRY,
  SIDEBAR_NAV,
  type NavItem,
  type SidebarKey,
} from '@/lib/member/nav'

import styles from './member-shell.module.css'
import { HomeLink } from '@/components/shell/home-link'

type Props = {
  /** The sidebar entry of the current screen. */
  active: SidebarKey | typeof PROJECT_DEMO_ENTRY.key
  member: Pick<MemberIdentity, 'displayName' | 'avatarUrl'> & { opsAccess?: boolean }
  children: ReactNode
}

function Inert({ item, className }: { item: NavItem; className?: string }) {
  // Visible for Pixel fidelity only; not focusable, never navigates (DEC-WF02-H9).
  // It states why on hover and to assistive technology (DEC-P0-SHELL-D2).
  const reason = item.kind === 'INERT' ? INERT_REASONS[item.reason] : undefined
  return (
    <span
      className={className}
      aria-disabled="true"
      data-nav-kind="INERT"
      title={reason}
      aria-label={reason ? `${item.label} — ${reason}` : undefined}
    >
      {item.label}
    </span>
  )
}

/**
 * WF02-T00 — the member shell shared by WF02-S01, S03, S04 and S07.
 *
 * Evidence: the ME0, ME2, ME6 and ME4 references draw the same dark header and
 * "Tài khoản của tôi" sidebar; only the active item differs. Items without a
 * P0 Production destination are inert, and the notification bell shows no
 * counter (no canonical notification source, DEC-WF02-H9/H10).
 */
export function MemberShell({ active, member, children }: Props) {
  const demoCurrent = active === PROJECT_DEMO_ENTRY.key
  return (
    <div className={styles.root} data-shell="member">
      <header className={styles.header}>
        <p className={`type-section-sm ${styles.wordmark}`}>
          <HomeLink>HUB NETWORK</HomeLink>
        </p>
        <nav aria-label="Khám phá" className={`type-body-sm ${styles.productNav}`}>
          {HEADER_NAV.map((item) =>
            item.kind === 'LINK' ? (
              <Link key={item.label} href={item.href} className={styles.productItem}>
                {item.label}
              </Link>
            ) : (
              <Inert key={item.label} item={item} className={styles.productItem} />
            ),
          )}
        </nav>
        <div className={styles.account}>
          {member.opsAccess ? (
            <Link
              href={OPS_ENTRY.href}
              className={`type-body-sm ${styles.productItem} ${styles.opsEntry}`}
              data-nav="ops-entry"
            >
              {OPS_ENTRY.label}
            </Link>
          ) : null}
          <span
            className={styles.bell}
            aria-disabled="true"
            data-nav-kind="INERT"
            title={`Thông báo — ${INERT_REASONS.NO_P0_SCREEN}`}
          >
            {/* Deterministic glyph, not an OS emoji (as DEC-WF01-S08-D7); no counter. */}
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M8 2.2a3.6 3.6 0 0 0-3.6 3.6v2.6L3 10.6v.9h10v-.9l-1.4-2.2V5.8A3.6 3.6 0 0 0 8 2.2Z" />
              <path d="M6.6 12.6a1.4 1.4 0 0 0 2.8 0Z" />
            </svg>
          </span>
          <span className={`type-body-sm ${styles.memberName}`}>{member.displayName}</span>
          <span className={styles.avatar}>
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- private, session-authorised media route
              <img src={member.avatarUrl} alt="" />
            ) : null}
          </span>
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <p className={`weight-semibold ${styles.eyebrow}`}>TÀI KHOẢN CỦA TÔI</p>
          <nav aria-label="Tài khoản của tôi">
            <ul className={styles.sideList}>
              {SIDEBAR_NAV.map((item) => {
                const current = item.key !== null && item.key === active
                const cls = `type-body-sm ${styles.sideItem} ${current ? `${styles.sideItemActive} weight-medium` : ''}`
                return (
                  <li key={item.label}>
                    {item.kind === 'LINK' ? (
                      <Link
                        href={item.href}
                        className={cls}
                        aria-current={current ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <Inert item={item} className={cls} />
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
          {PROJECT_DEMO_ENTRY.visible ? (
            // WF05 (DEC-WF05-G2): text only unless current; no demo group label (WF05-PROD-04).
            <div className={styles.demoEntry}>
              <Link
                href={PROJECT_DEMO_ENTRY.href}
                className={`type-body-sm ${styles.sideItem} ${demoCurrent ? `${styles.sideItemActive} weight-medium` : ''}`}
                aria-current={demoCurrent ? 'page' : undefined}
                data-nav={PROJECT_DEMO_ENTRY.key}
              >
                {PROJECT_DEMO_ENTRY.label}
              </Link>
            </div>
          ) : null}
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
