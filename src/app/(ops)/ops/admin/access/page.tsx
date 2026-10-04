import Link from 'next/link'
import { notFound } from 'next/navigation'

import { listDelegationOrganizations } from '@/lib/admin/access-api'
import { requireOpsAdmin } from '@/lib/ops/guard'

import styles from '../admin.module.css'

/**
 * ADMIN-PROD-06 — /ops/admin/access, the units this actor's `access:delegate`
 * reaches (PD-6: its sources and their direct children; every operational
 * unit for PLATFORM_ADMIN). No `GET /ops/organizations` reuse here: that
 * endpoint is scoped by `network:read`, a different capability a delegation-
 * only grantee (the PROD-05 handoff gap) may not hold at all. A navigational
 * list only — the real grant / revoke / history calls are on the org page
 * (05 §27, A10); no new API route (the task's "real APIs only").
 */
export const dynamic = 'force-dynamic'

const COPY = {
  title: 'Phân quyền đơn vị',
  subtitle: 'Chọn một đơn vị để xem, cấp hoặc thu hồi quyền.',
  empty: 'Không có đơn vị nào trong phạm vi phân quyền của bạn.',
  failed: 'Không tải được danh sách đơn vị.',
} as const

const TYPE_LABELS: Record<string, string> = { HUB: 'HUB', CHAPTER: 'Chapter', CLB: 'CLB' }

export default async function Page() {
  const { accountId, capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('access:delegate')) notFound()

  let organizations: Awaited<ReturnType<typeof listDelegationOrganizations>> = []
  let failed = false
  try {
    organizations = await listDelegationOrganizations(accountId)
  } catch {
    failed = true
  }

  return (
    <div className={styles.page} data-screen="ADMIN-ACCESS">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.subtitle}>{COPY.subtitle}</p>
        </div>
      </header>
      {failed ? (
        <div className={styles.notice} role="alert" data-state="load-failed">
          <p className="type-body-sm">{COPY.failed}</p>
        </div>
      ) : (
        <div className={styles.table} role="table" aria-label={COPY.title} data-queue="access">
          <div className={`${styles.head} ${styles.colsOrgs}`} role="row">
            <span role="columnheader" className={styles.cell}>
              Đơn vị
            </span>
            <span role="columnheader" className={styles.cell}>
              Loại
            </span>
          </div>
          {organizations.length === 0 ? (
            <p className={`type-body-sm ${styles.empty}`} data-state="empty">
              {COPY.empty}
            </p>
          ) : (
            organizations.map((org) => (
              <Link
                key={org.id}
                href={`/ops/admin/access/${org.id}`}
                role="row"
                className={`${styles.row} ${styles.colsOrgs}`}
                data-org-row={org.id}
              >
                <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                  {org.name}
                </span>
                <span role="cell" className={styles.cell}>
                  {TYPE_LABELS[org.type] ?? org.type}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
