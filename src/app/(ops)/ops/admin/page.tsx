import Link from 'next/link'

import { listAccountRequests } from '@/lib/admin/account-ops'
import { listFeedback } from '@/lib/admin/feedback-ops'
import { listVentureReviews } from '@/lib/admin/venture-review-queue'
import { listVerificationRequests } from '@/lib/admin/verification-queue'
import type { Capability } from '@/lib/authz/matrix'
import { requireOpsAdmin } from '@/lib/ops/guard'

import styles from './admin.module.css'

/**
 * ADMIN-PROD-06 — /ops/admin, "Tổng quan quản trị". No `GET /ops/summary`
 * exists (the PROD-05 handoff gap): each card's count is the same list call a
 * queue page itself makes, with `limit=1` (its `page.counts`), read directly
 * on the server rather than composed into a new endpoint. A card for a
 * capability the actor does not hold is not rendered (no dead navigation);
 * a count that fails to load shows a dash rather than breaking the page.
 */
export const dynamic = 'force-dynamic'

const COPY = {
  title: 'Tổng quan quản trị',
  subtitle: 'Các hàng chờ và cấu hình của Admin Portal.',
  pending: 'đang chờ',
  open: 'đang mở',
  verification: 'Xác minh vai trò',
  ventures: 'Duyệt startup',
  access: 'Phân quyền đơn vị',
  accessSub: 'Quản lý cấp / thu hồi quyền theo đơn vị',
  feedback: 'Phản hồi',
  categories: 'Danh mục',
  categoriesSub: 'Nhãn, thứ tự, lưu trữ / kích hoạt',
  accounts: 'Tài khoản',
} as const

async function pendingCount(
  capability: Capability,
  held: readonly Capability[],
  load: () => Promise<{ counts: Record<string, number> }>,
  key: string,
): Promise<number | null> {
  if (!held.includes(capability)) return null
  try {
    return (await load()).counts[key] ?? 0
  } catch {
    return null
  }
}

export default async function Page() {
  const { accountId, capabilities } = await requireOpsAdmin()
  const limit1 = new URLSearchParams({ limit: '1' })
  const [verification, ventures, feedback, accounts] = await Promise.all([
    pendingCount(
      'verification:review',
      capabilities,
      () => listVerificationRequests(accountId, limit1),
      'pending',
    ),
    pendingCount(
      'venture:review',
      capabilities,
      () => listVentureReviews(accountId, limit1),
      'pending',
    ),
    pendingCount('feedback:manage', capabilities, () => listFeedback(accountId, limit1), 'open'),
    pendingCount(
      'account:administer',
      capabilities,
      () => listAccountRequests(accountId, limit1),
      'pending',
    ),
  ])

  const cards: Array<{
    key: string
    href: string
    label: string
    value: number | null
    unit: string
    sub?: string
  }> = []
  if (capabilities.includes('verification:review'))
    cards.push({
      key: 'verification',
      href: '/ops/admin/verification',
      label: COPY.verification,
      value: verification,
      unit: COPY.pending,
    })
  if (capabilities.includes('venture:review'))
    cards.push({
      key: 'ventures',
      href: '/ops/admin/ventures',
      label: COPY.ventures,
      value: ventures,
      unit: COPY.pending,
    })
  if (capabilities.includes('feedback:manage'))
    cards.push({
      key: 'feedback',
      href: '/ops/admin/feedback',
      label: COPY.feedback,
      value: feedback,
      unit: COPY.open,
    })
  if (capabilities.includes('account:administer'))
    cards.push({
      key: 'accounts',
      href: '/ops/admin/accounts',
      label: COPY.accounts,
      value: accounts,
      unit: COPY.pending,
    })

  return (
    <div className={styles.page} data-screen="ADMIN-HOME">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.subtitle}>{COPY.subtitle}</p>
        </div>
      </header>
      <div className={styles.kpis}>
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className={styles.kpi} data-metric={c.key}>
            <p className={styles.kpiLabel}>{c.label}</p>
            <p className={styles.kpiValue} data-value>
              {c.value ?? '–'}
            </p>
            <p className={styles.kpiLabel}>{c.unit}</p>
          </Link>
        ))}
        {capabilities.includes('access:delegate') ? (
          <Link href="/ops/admin/access" className={styles.kpi} data-metric="access">
            <p className={styles.kpiLabel}>{COPY.access}</p>
            <p className={styles.subtitle}>{COPY.accessSub}</p>
          </Link>
        ) : null}
        {capabilities.includes('vocabulary:manage') ? (
          <Link href="/ops/admin/categories" className={styles.kpi} data-metric="categories">
            <p className={styles.kpiLabel}>{COPY.categories}</p>
            <p className={styles.subtitle}>{COPY.categoriesSub}</p>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
