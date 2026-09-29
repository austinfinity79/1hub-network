import Link from 'next/link'
import type { ReactNode } from 'react'

import { FeedbackPill } from '@/components/shell/feedback-pill'
import { HomeLink } from '@/components/shell/home-link'
import type { MemberIdentity } from '@/lib/member/guard'
import { INERT_REASONS, OPS_ENTRY, PROJECT_DEMO_ENTRY, type NavItem } from '@/lib/member/nav'
import {
  PROFILE_HEADER_NAV,
  WORKSPACE_HEADER_NAV,
  WORKSPACE_SIDEBAR,
  type WorkspaceKey,
} from '@/lib/member/workspace-nav'

import styles from './workspace-shell.module.css'

/**
 * The chrome of the two workspace frames of the L2 realignment (DEC-L2R-D1):
 *
 * - `profile`: FP1-OWN, the dark header over a page without a sidebar;
 * - `projects`: ME7, the light header and the sidebar of five entries.
 *
 * What the member shell promises stays: the wordmark leads home
 * (DEC-P0-SHELL-D1), an account with an ops scope gets "Vận hành tổ chức"
 * (D3), items without a screen are inert with a reason (D2), and the WF05 demo
 * entry sits under its own group label (DEC-WF05-G2). "Góp ý" is drawn and
 * inert (D-F1).
 */

type Member = Pick<MemberIdentity, 'displayName' | 'avatarUrl'> & { opsAccess?: boolean }

function Item({
  item,
  className,
  current,
}: {
  item: NavItem
  className?: string
  current?: boolean
}) {
  if (item.kind === 'LINK') {
    return (
      <Link
        href={item.href}
        className={className}
        aria-current={current ? 'page' : undefined}
        data-current={current ? 'true' : undefined}
      >
        {item.label}
      </Link>
    )
  }
  const reason = INERT_REASONS[item.reason]
  return (
    <span
      className={className}
      aria-disabled="true"
      data-nav-kind="INERT"
      title={reason}
      aria-label={`${item.label} — ${reason}`}
    >
      {item.label}
    </span>
  )
}

function Avatar({ member }: { member: Member }) {
  return (
    <span className={styles.avatar}>
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, session-authorised media route
        <img src={member.avatarUrl} alt="" />
      ) : null}
    </span>
  )
}

function OpsEntry({ member }: { member: Member }) {
  return member.opsAccess ? (
    <Link href={OPS_ENTRY.href} className={styles.navItem} data-nav="ops-entry">
      {OPS_ENTRY.label}
    </Link>
  ) : null
}

/** FP1-OWN: dark header, the page below is the profile's own. */
export function ProfileShell({ member, children }: { member: Member; children: ReactNode }) {
  return (
    <div className={styles.root} data-shell="workspace" data-frame="profile">
      <header className={styles.dark}>
        <div className={styles.darkInner}>
          <p className={styles.wordmarkWide}>
            <HomeLink>HUB NETWORK</HomeLink>
          </p>
          <nav aria-label="Khám phá" className={styles.nav}>
            {PROFILE_HEADER_NAV.map((item) => (
              <Item
                key={item.label}
                item={item}
                className={styles.navItem}
                current={item.current}
              />
            ))}
          </nav>
          <div className={styles.account}>
            <OpsEntry member={member} />
            <span
              className={styles.lang}
              aria-disabled="true"
              data-nav-kind="INERT"
              title={INERT_REASONS.FUTURE}
              aria-label={`VN · EN — ${INERT_REASONS.FUTURE}`}
            >
              VN · EN
            </span>
            <span className={styles.memberName}>{member.displayName}</span>
            <Avatar member={member} />
          </div>
        </div>
      </header>
      {children}
      <FeedbackPill />
    </div>
  )
}

/** ME7: light header and the workspace sidebar. */
export function WorkspaceShell({
  active,
  member,
  children,
}: {
  active: WorkspaceKey
  member: Member
  children: ReactNode
}) {
  return (
    <div className={styles.root} data-shell="workspace" data-frame="projects">
      <header className={styles.light}>
        <p className={styles.wordmark}>
          <HomeLink>HUB NETWORK</HomeLink>
        </p>
        <nav aria-label="Khám phá" className={styles.navCentre}>
          {WORKSPACE_HEADER_NAV.map((item) => (
            <Item key={item.label} item={item} className={styles.navItem} />
          ))}
        </nav>
        <div className={styles.account}>
          <OpsEntry member={member} />
          <Avatar member={member} />
          <span className={styles.memberName}>{member.displayName}</span>
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <nav aria-label="Tài khoản của tôi">
            <ul className={styles.sideList}>
              {WORKSPACE_SIDEBAR.map((item) => (
                <li key={item.label}>
                  <Item
                    item={item}
                    className={styles.sideItem}
                    current={item.key !== null && item.key === active}
                  />
                </li>
              ))}
            </ul>
          </nav>
          {PROJECT_DEMO_ENTRY.visible ? (
            <div className={styles.demoEntry}>
              <p className={styles.eyebrow}>{PROJECT_DEMO_ENTRY.group.toUpperCase()}</p>
              <Link
                href={PROJECT_DEMO_ENTRY.href}
                className={styles.sideItem}
                data-nav={PROJECT_DEMO_ENTRY.key}
              >
                {PROJECT_DEMO_ENTRY.label}
              </Link>
            </div>
          ) : null}
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
      <FeedbackPill />
    </div>
  )
}
