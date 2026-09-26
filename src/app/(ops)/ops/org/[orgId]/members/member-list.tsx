'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { ListEnvelope } from '@/lib/api/types'
import type { OrganizationDashboardDTO } from '@/lib/ops/dashboard'
import type { OpsMemberSummaryDTO } from '@/lib/ops/members'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import styles from './members.module.css'

/**
 * WF03-S03 — organization members (DEC-WF03-G3/G4/G6, DEC-WF03-S03-D1).
 *
 * The approved ADM17 frame (title, filter card, table) as a read-only
 * relationship view. Columns: the person (discovery projection only), the
 * membership state, its provenance, ACTIVE leadership titles, the date the
 * relationship started, and "Mở →" to the member detail. The drawn account
 * columns (email, verification, last login), "Xuất CSV", the region and role
 * dropdowns and account counts have no P0 source and are not rendered. The
 * two chips are the contracted filters: pending requests and active leadership.
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S03-D1). */
const COPY = {
  title: 'Thành viên',
  active: 'đang hoạt động',
  pending: 'chờ duyệt',
  search: 'Tìm theo tên',
  chipPending: 'Chờ duyệt',
  chipLeaders: 'Ban điều hành',
  columns: ['Thành viên', 'Trạng thái', 'Nguồn', 'Vai trò', 'Từ'],
  hidden: 'Hồ sơ không công khai',
  open: 'Mở →',
  loading: 'Đang tải danh sách thành viên…',
  empty: 'Chưa có thành viên nào.',
  noMatch: 'Không có thành viên phù hợp.',
  failed: 'Không tải được danh sách thành viên.',
  retry: 'Thử lại',
} as const

// Same wording as the member's own roles screen (WF02-S04).
const STATE_LABELS: Record<string, string> = {
  ACTIVE: 'Thành viên',
  PENDING_APPROVAL: 'Đang chờ duyệt',
  REJECTED: 'Không được duyệt',
  WITHDRAWN: 'Đã rút yêu cầu',
  SUSPENDED: 'Tạm ngưng',
  ALUMNI: 'Cựu thành viên',
}
const SOURCE_LABELS: Record<string, string> = {
  SELF_DECLARED: 'Tự khai báo',
  SYSTEM_RECORDED: 'Hệ thống ghi nhận',
  ORGANIZATION_VERIFIED: 'Tổ chức xác nhận',
  IDENTITY_VERIFIED: 'Đã xác minh danh tính',
}

const calendar = (value: string) => value.split('-').reverse().join('/')

type Filter = 'PENDING' | 'LEADERS' | null
type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; items: OpsMemberSummaryDTO[] }

async function loadAll(orgId: string, q: string, filter: Filter) {
  const items: OpsMemberSummaryDTO[] = []
  let cursor: string | null = null
  do {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (filter === 'PENDING') params.set('membership_status', 'PENDING_APPROVAL')
    if (filter === 'LEADERS') params.set('leadership_status', 'ACTIVE')
    if (cursor) params.set('cursor', cursor)
    const qs = params.toString()
    const page: ListEnvelope<OpsMemberSummaryDTO> = await apiRequest(
      `/ops/organizations/${orgId}/members${qs ? `?${qs}` : ''}`,
    )
    items.push(...page.items)
    cursor = page.page.next_cursor
  } while (cursor)
  return items
}

export function MemberList({
  organization,
}: {
  organization: Pick<OrganizationRefDTO, 'id' | 'name'>
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [counts, setCounts] = useState<OrganizationDashboardDTO['summary'] | null>(null)
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [filter, setFilter] = useState<Filter>(null)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const [items, dashboard] = await Promise.all([
        loadAll(organization.id, applied, filter),
        apiRequest<OrganizationDashboardDTO>(`/ops/organizations/${organization.id}/dashboard`),
      ])
      setCounts(dashboard.summary)
      setState({ kind: 'ready', items })
    } catch {
      // Never surface status codes, scope ids or raw errors.
      setState({ kind: 'failed' })
    }
  }, [organization.id, applied, filter])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (next: Exclude<Filter, null>) => setFilter((f) => (f === next ? null : next))

  return (
    <div className={styles.page} data-screen="WF03-S03">
      <h1 className={styles.title}>{COPY.title}</h1>
      <p className={`type-meta-xs ${styles.subtitle}`} data-count>
        {counts
          ? `${organization.name} · ${counts.active_members} ${COPY.active} · ${counts.pending_memberships} ${COPY.pending}`
          : organization.name}
      </p>

      <form
        className={styles.filters}
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(q)
        }}
      >
        <label className={styles.search}>
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            className={`type-body-sm ${styles.searchInput}`}
            placeholder={COPY.search}
            aria-label={COPY.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setApplied(q)}
          />
        </label>
        <button
          type="button"
          className={`type-body-sm ${styles.chip}`}
          aria-pressed={filter === 'PENDING'}
          onClick={() => toggle('PENDING')}
          data-filter="pending"
        >
          {COPY.chipPending}
          {counts ? ` (${counts.pending_memberships})` : ''}
        </button>
        <button
          type="button"
          className={`type-body-sm ${styles.chip}`}
          aria-pressed={filter === 'LEADERS'}
          onClick={() => toggle('LEADERS')}
          data-filter="leaders"
        >
          {COPY.chipLeaders}
          {counts ? ` (${counts.active_leaders})` : ''}
        </button>
      </form>

      {state.kind === 'failed' ? (
        <div className={styles.failed} role="alert" data-state="members-failed">
          <p className="type-body-sm">{COPY.failed}</p>
          <button type="button" className={`type-body-sm ${styles.retry}`} onClick={load}>
            {COPY.retry}
          </button>
        </div>
      ) : (
        <div
          className={styles.table}
          role="table"
          aria-label={COPY.title}
          aria-busy={state.kind === 'loading'}
          data-member-table
        >
          <div className={styles.head} role="row">
            {COPY.columns.map((c) => (
              <span key={c} role="columnheader" className={styles.th}>
                {c}
              </span>
            ))}
          </div>
          {state.kind === 'loading' ? (
            <p className={`type-body-sm ${styles.note}`} data-state="members-loading">
              {COPY.loading}
            </p>
          ) : state.items.length === 0 ? (
            <p className={`type-body-sm ${styles.note}`} data-state="members-empty">
              {applied || filter ? COPY.noMatch : COPY.empty}
            </p>
          ) : (
            state.items.map((m) => {
              const pending = m.membership?.state === 'PENDING_APPROVAL'
              return (
                <div
                  key={m.profile_id}
                  role="row"
                  className={`${styles.row} ${pending ? styles.attention : ''}`}
                  data-member-row={m.profile_id}
                  data-membership-state={m.membership?.state ?? 'NONE'}
                >
                  <span role="cell" className={styles.person}>
                    {m.profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.avatar} src={m.profile.avatar_url} alt="" />
                    ) : (
                      <span className={styles.avatar} aria-hidden="true" />
                    )}
                    <span className={styles.identity}>
                      <span className={`type-body-md weight-medium ${styles.name}`}>
                        {m.profile?.display_name ?? COPY.hidden}
                      </span>
                      {m.profile?.headline ? (
                        <span className={`type-meta-xs ${styles.headline}`}>
                          {m.profile.headline}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span role="cell">
                    {m.membership ? (
                      <span className={`${styles.status} ${pending ? styles.statusAttention : ''}`}>
                        {STATE_LABELS[m.membership.state] ?? m.membership.state}
                      </span>
                    ) : (
                      <span className={`type-body-sm ${styles.cell}`}>—</span>
                    )}
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell} ${styles.shifted}`}>
                    {m.membership?.source_type ? SOURCE_LABELS[m.membership.source_type] : '—'}
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell} ${styles.shifted}`}>
                    {m.leadership.length ? m.leadership.map((l) => l.title).join(', ') : '—'}
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell} ${styles.shifted}`}>
                    {m.membership?.since ? calendar(m.membership.since) : '—'}
                  </span>
                  <span role="cell" className={styles.action}>
                    <Link
                      href={`/ops/org/${organization.id}/members/${m.profile_id}`}
                      className={`type-body-sm weight-semibold ${styles.open}`}
                    >
                      {COPY.open}
                    </Link>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
