import Link from 'next/link'
import type { ReactNode } from 'react'

import type { Capability } from '@/lib/authz/matrix'
import { ACCOUNT_ENTRY, NETWORK_NAV, OPS_COPY, organizationNav } from '@/lib/ops/nav'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import { OpsNav } from './ops-nav'
import styles from './ops-shell.module.css'
import { HomeLink } from '@/components/shell/home-link'

type Props = {
  /** The organization in context, already authorized on the server; none on /ops/network. */
  organization?: Pick<OrganizationRefDTO, 'id' | 'name'>
  /** The actor's capabilities for that organization (menu visibility only). */
  capabilities?: readonly Capability[]
  children: ReactNode
}

/**
 * WF03-T00 — OpsShell, the dedicated shell for every `/ops/*` page
 * (DEC-WF03-G15). Not MemberShell, and not a security boundary.
 *
 * Evidence: the "Quản trị HUB tổng" sidebar drawn identically on the approved
 * WF03-S03, S04 and S08 references (216px dark column, wordmark, subtitle,
 * group label, 38px items with a bordered active box). The OPEN-WF03-G15
 * recommendation approved this family. Other drawn shells (the ADM-coded
 * "Quản trị" sidebar of S01/S05, the unit top nav of S02/S06) are
 * INTENTIONAL-CONTRACT differences under G15. Drawn items without an executable
 * WF03 destination (account admin, approval queues, verification, audit log,
 * sprint notes) are not rendered.
 *
 * Organization context: the subtitle slot carries the breadcrumb
 * ("Tổ chức › {organization}"), so no bar is added above the screens' content.
 */
export function OpsShell({ organization, capabilities = [], children }: Props) {
  const orgItems = organization
    ? organizationNav(organization.id).filter((i) => capabilities.includes(i.capability))
    : []
  return (
    <div className={styles.root} data-shell="ops">
      <aside className={styles.sidebar}>
        <p className={`weight-semibold ${styles.wordmark}`}>
          <HomeLink>HUB NETWORK</HomeLink>
        </p>
        {organization ? (
          <nav
            aria-label="Breadcrumb"
            className={styles.context}
            data-org-context={organization.id}
          >
            <ol className={`type-body-sm ${styles.crumbs}`}>
              <li>
                <Link href={NETWORK_NAV.href}>{OPS_COPY.breadcrumbRoot}</Link>
              </li>
              <li aria-current="page">{organization.name}</li>
            </ol>
          </nav>
        ) : (
          <p className={`type-body-sm ${styles.context}`}>{OPS_COPY.product}</p>
        )}
        <nav aria-label="Vận hành">
          <p className={`weight-semibold ${styles.group}`}>{OPS_COPY.networkGroup}</p>
          <OpsNav items={[NETWORK_NAV]} label={OPS_COPY.networkGroup} />
          {orgItems.length > 0 ? (
            <>
              <p className={`weight-semibold ${styles.group} ${styles.groupNext}`}>
                {OPS_COPY.organizationGroup}
              </p>
              <OpsNav items={orgItems} label={OPS_COPY.organizationGroup} />
            </>
          ) : null}
        </nav>
        <Link
          href={ACCOUNT_ENTRY.href}
          className={`type-body-sm ${styles.accountEntry}`}
          data-nav="account-entry"
        >
          ← {ACCOUNT_ENTRY.label}
        </Link>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
