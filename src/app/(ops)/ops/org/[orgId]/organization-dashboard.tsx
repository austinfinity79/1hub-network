'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { OrganizationDashboardDTO } from '@/lib/ops/dashboard'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import styles from './dashboard.module.css'

/**
 * WF03-S02 — organization dashboard (DEC-WF03-G1, DEC-WF03-S02-D1).
 *
 * The approved ORG1 frame (header band, KPI cards, "Việc cần làm" card) with
 * canonical aggregates only. The drawn capability chips, scope notice,
 * enterprise KPIs (bài toán, giải pháp, vòng trong, pilot) and the pilot card
 * have no P0 source and are not rendered. The one work item is the canonical
 * pending-membership count; it links to the members screen.
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S02-D1). */
const COPY = {
  subtitle: 'Bảng điều khiển',
  members: 'Thành viên',
  childOrgs: 'tổ chức trực thuộc',
  pending: 'Yêu cầu chờ duyệt',
  leaders: 'Ban điều hành',
  events: 'Sự kiện đã công khai',
  eventsOf: 'trên tổng',
  eventsUnit: 'sự kiện',
  work: 'Việc cần làm',
  pendingTitle: 'yêu cầu thành viên chờ duyệt',
  pendingSub: 'Xem và duyệt ở mục Thành viên',
  chip: 'Chờ đơn vị',
  act: 'Làm ngay',
  none: 'Không có việc cần làm.',
  failed: 'Không tải được bảng điều khiển.',
  retry: 'Thử lại',
} as const

const TYPE_LABELS: Record<string, string> = { HUB: 'HUB', CHAPTER: 'Chapter', CLB: 'CLB' }

type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: OrganizationDashboardDTO }

export function OrganizationDashboard({
  organization,
}: {
  organization: Pick<OrganizationRefDTO, 'id' | 'name' | 'type'>
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const data = await apiRequest<OrganizationDashboardDTO>(
        `/ops/organizations/${organization.id}/dashboard`,
      )
      setState({ kind: 'ready', data })
    } catch {
      // Never surface status codes, scope ids or raw errors.
      setState({ kind: 'failed' })
    }
  }, [organization.id])

  useEffect(() => {
    void load()
  }, [load])

  const s = state.kind === 'ready' ? state.data.summary : null
  const cards: { key: string; label: string; value: number | null; sub: string | null }[] = [
    {
      key: 'active_members',
      label: COPY.members,
      value: s?.active_members ?? null,
      sub: s ? `${s.child_organizations} ${COPY.childOrgs}` : null,
    },
    {
      key: 'pending_memberships',
      label: COPY.pending,
      value: s?.pending_memberships ?? null,
      sub: null,
    },
    { key: 'active_leaders', label: COPY.leaders, value: s?.active_leaders ?? null, sub: null },
    {
      key: 'published_events',
      label: COPY.events,
      value: s?.published_events ?? null,
      sub: s ? `${COPY.eventsOf} ${s.standalone_events} ${COPY.eventsUnit}` : null,
    },
  ]

  return (
    <div className={styles.page} data-screen="WF03-S02">
      <header className={styles.header}>
        <h1 className={`type-section-sm ${styles.title}`}>{organization.name}</h1>
        <p className={`type-meta-xs ${styles.subtitle}`}>
          {COPY.subtitle} · {TYPE_LABELS[organization.type] ?? organization.type}
        </p>
      </header>
      <div className={styles.body}>
        {state.kind === 'failed' ? (
          <div className={styles.failed} role="alert" data-state="dashboard-failed">
            <p className="type-body-sm">{COPY.failed}</p>
            <button type="button" className={`type-body-sm ${styles.retry}`} onClick={load}>
              {COPY.retry}
            </button>
          </div>
        ) : (
          <>
            <div className={styles.kpis} aria-busy={state.kind === 'loading'}>
              {cards.map((card) => (
                <section key={card.key} className={styles.kpi} data-metric={card.key}>
                  <p className={styles.kpiLabel}>{card.label}</p>
                  <p className={styles.kpiValue} data-value>
                    {card.value ?? '–'}
                  </p>
                  {card.sub ? <p className={`type-meta-xs ${styles.kpiSub}`}>{card.sub}</p> : null}
                </section>
              ))}
            </div>
            <section className={styles.work} data-card="work">
              <p className={styles.kpiLabel}>{COPY.work}</p>
              {s === null ? null : s.pending_memberships > 0 ? (
                <div className={styles.item} data-work-item="pending_memberships">
                  <div>
                    <p className={`type-body-md ${styles.itemTitle}`}>
                      {s.pending_memberships} {COPY.pendingTitle}
                    </p>
                    <p className={`type-meta-xs ${styles.itemSub}`}>{COPY.pendingSub}</p>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={styles.chip}>{COPY.chip}</span>
                    <Link href={`/ops/org/${organization.id}/members`} className={styles.act}>
                      {COPY.act}
                    </Link>
                  </div>
                </div>
              ) : (
                <p className={`type-body-sm ${styles.none}`} data-state="work-empty">
                  {COPY.none}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
