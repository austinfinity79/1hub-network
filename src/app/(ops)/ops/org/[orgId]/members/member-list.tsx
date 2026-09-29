'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { ListEnvelope } from '@/lib/api/types'
import type { OrganizationDashboardDTO } from '@/lib/ops/dashboard'
import type { OpsMemberDetailDTO } from '@/lib/ops/member-detail'
import type { OpsMemberSummaryDTO } from '@/lib/ops/members'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import styles from './members.module.css'

/**
 * WF03-S03 — organization members (DEC-WF03-G3/G4/G6, DEC-WF03-S03-D1).
 *
 * A relationship view, never account administration: the person (discovery
 * projection only), the membership state, its provenance, ACTIVE leadership
 * titles and the date the relationship started (or was requested). No email,
 * verification, last login, "Xuất CSV" or account counts (G3, G4).
 *
 * TASK 22.4 (DEC-L3-D4): drawn as the corrected L26 CHP7 subset in Space
 * Grotesk. Tabs over the contracted filters ("Đơn chờ duyệt", "Đang hoạt
 * động", "Tất cả"). A pending row carries "Duyệt" / "Từ chối" for holders of
 * `membership:confirm`: it reads the member detail and sends the S04 review
 * call (DEC-WF03-S04-D1) unchanged, so the server decides. "Ban điều hành"
 * lists the ACTIVE leadership titles (display text, G6). Not rendered (Bucket
 * B): email invitation, export, handover, role removal, the rule notes.
 */

/** Copy the reference does not carry verbatim; pending PO copy review (DEC-WF03-S03-D1). */
const COPY = {
  title: (unit: string) => `Thành viên ${unit}`,
  active: 'đang hoạt động',
  pending: 'đơn chờ duyệt',
  search: 'Tìm theo tên',
  tabPending: 'Đơn chờ duyệt',
  tabActive: 'Đang hoạt động',
  tabAll: 'Tất cả',
  pendingColumns: ['Người xin vào', 'Gửi lúc'],
  columns: ['Thành viên', 'Trạng thái', 'Nguồn', 'Vai trò', 'Từ'],
  hidden: 'Hồ sơ không công khai',
  open: 'Mở →',
  approve: 'Duyệt',
  reject: 'Từ chối',
  sent: 'gửi',
  leaders: 'Ban điều hành',
  viewAll: (n: number) => `Xem cả ${n} thành viên →`,
  noLeaders: 'Chưa có ai giữ vai trò lãnh đạo.',
  loading: 'Đang tải danh sách thành viên…',
  empty: 'Chưa có thành viên nào.',
  noMatch: 'Không có thành viên phù hợp.',
  failed: 'Không tải được danh sách thành viên.',
  retry: 'Thử lại',
  actionFailed: 'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.',
} as const

const UNIT: Record<string, string> = { HUB: 'HUB', CHAPTER: 'chapter', CLB: 'CLB' }

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

type Tab = 'PENDING' | 'ACTIVE' | 'ALL'
type Filter = { membership_status?: string; leadership_status?: string }
const FILTERS: Record<Tab, Filter> = {
  PENDING: { membership_status: 'PENDING_APPROVAL' },
  ACTIVE: { membership_status: 'ACTIVE' },
  ALL: {},
}
type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; items: OpsMemberSummaryDTO[] }

async function loadAll(orgId: string, q: string, filter: Filter) {
  const items: OpsMemberSummaryDTO[] = []
  let cursor: string | null = null
  do {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    for (const [key, value] of Object.entries(filter)) params.set(key, value)
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

function Person({ m }: { m: OpsMemberSummaryDTO }) {
  return (
    <span className={styles.person}>
      {m.profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatar} src={m.profile.avatar_url} alt="" />
      ) : (
        <span className={styles.avatar} aria-hidden="true" />
      )}
      <span className={styles.identity}>
        <span className={styles.name}>{m.profile?.display_name ?? COPY.hidden}</span>
        {m.profile?.headline ? <span className={styles.headline}>{m.profile.headline}</span> : null}
      </span>
    </span>
  )
}

export function MemberList({
  organization,
  canReview,
  canVerifyDeclarations,
}: {
  organization: Pick<OrganizationRefDTO, 'id' | 'name' | 'type'>
  /** UI affordance only; the review call authorizes again (DEC-WF03-S04-D1). */
  canReview: boolean
  /** A HUB declaration is decided platform-wide only (DEC-PDF-D6B); others open it. */
  canVerifyDeclarations: boolean
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [leaders, setLeaders] = useState<OpsMemberSummaryDTO[] | null>(null)
  const [counts, setCounts] = useState<OrganizationDashboardDTO['summary'] | null>(null)
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [tab, setTab] = useState<Tab>('PENDING')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const base = `/ops/organizations/${organization.id}`
  const detailHref = (profileId: string) => `/ops/org/${organization.id}/members/${profileId}`

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const [items, lead, dashboard] = await Promise.all([
        loadAll(organization.id, applied, FILTERS[tab]),
        loadAll(organization.id, '', { leadership_status: 'ACTIVE' }),
        apiRequest<OrganizationDashboardDTO>(`${base}/dashboard`),
      ])
      setCounts(dashboard.summary)
      setLeaders(lead)
      setState({ kind: 'ready', items })
    } catch {
      // Never surface status codes, scope ids or raw errors.
      setState({ kind: 'failed' })
    }
  }, [organization.id, applied, tab, base])

  useEffect(() => {
    void load()
  }, [load])

  /** S04's review call, unchanged: read the open membership, then PATCH it. */
  async function review(profileId: string, status: 'ACTIVE' | 'REJECTED') {
    if (busy) return
    setBusy(profileId)
    setNotice(null)
    try {
      const detail = await apiRequest<OpsMemberDetailDTO>(`${base}/members/${profileId}`)
      const m = detail.membership
      if (!m || m.state !== 'PENDING_APPROVAL') throw new Error('stale')
      await apiRequest(`${base}/memberships/${m.id}`, { method: 'PATCH', body: { status } })
    } catch {
      setNotice(COPY.actionFailed)
    } finally {
      setBusy(null)
      await load()
    }
  }

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: 'PENDING', label: COPY.tabPending, count: counts?.pending_memberships ?? null },
    { key: 'ACTIVE', label: COPY.tabActive, count: counts?.active_members ?? null },
    { key: 'ALL', label: COPY.tabAll, count: null },
  ]
  const pendingTab = tab === 'PENDING'

  return (
    <div className={styles.page} data-screen="WF03-S03">
      <h1 className={styles.title}>{COPY.title(UNIT[organization.type] ?? organization.type)}</h1>
      <p className={styles.subtitle} data-count>
        {counts
          ? `${organization.name} · ${counts.active_members} ${COPY.active} · ${counts.pending_memberships} ${COPY.pending}`
          : organization.name}
      </p>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={COPY.title(organization.name)}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              data-tab={t.key.toLowerCase()}
            >
              {t.label}
              {t.count === null ? '' : ` (${t.count})`}
            </button>
          ))}
        </div>
        <form
          className={styles.search}
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setApplied(q)
          }}
        >
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={COPY.search}
            aria-label={COPY.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setApplied(q)}
          />
        </form>
      </div>

      {notice ? (
        <p className={styles.notice} role="alert" data-state="action-failed">
          {notice}
        </p>
      ) : null}

      {state.kind === 'failed' ? (
        <div className={styles.failed} role="alert" data-state="members-failed">
          <p>{COPY.failed}</p>
          <button type="button" className={styles.retry} onClick={load}>
            {COPY.retry}
          </button>
        </div>
      ) : (
        <div
          className={`${styles.table} ${pendingTab ? styles.pendingTable : ''}`}
          role="table"
          aria-label={COPY.title(organization.name)}
          aria-busy={state.kind === 'loading'}
          data-member-table
        >
          <div className={styles.head} role="row">
            {(pendingTab ? COPY.pendingColumns : COPY.columns).map((c) => (
              <span key={c} role="columnheader" className={styles.th}>
                {c}
              </span>
            ))}
          </div>
          {state.kind === 'loading' ? (
            <p className={styles.note} data-state="members-loading">
              {COPY.loading}
            </p>
          ) : state.items.length === 0 ? (
            <p className={styles.note} data-state="members-empty">
              {applied || tab !== 'ALL' ? COPY.noMatch : COPY.empty}
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
                  <span role="cell">
                    <Link href={detailHref(m.profile_id)} className={styles.personLink}>
                      <Person m={m} />
                    </Link>
                  </span>
                  {pendingTab ? (
                    <>
                      <span role="cell" className={styles.cell}>
                        {m.membership?.since ? `${COPY.sent} ${calendar(m.membership.since)}` : '—'}
                      </span>
                      <span role="cell" className={styles.action}>
                        {pending &&
                        canReview &&
                        (!m.membership?.declaration || canVerifyDeclarations) ? (
                          <>
                            <button
                              type="button"
                              className={styles.approve}
                              disabled={busy !== null}
                              onClick={() => void review(m.profile_id, 'ACTIVE')}
                              data-action="approve"
                            >
                              {COPY.approve}
                            </button>
                            <button
                              type="button"
                              className={styles.reject}
                              disabled={busy !== null}
                              onClick={() => void review(m.profile_id, 'REJECTED')}
                              data-action="reject"
                            >
                              {COPY.reject}
                            </button>
                          </>
                        ) : (
                          <Link href={detailHref(m.profile_id)} className={styles.open}>
                            {COPY.open}
                          </Link>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <span role="cell">
                        {m.membership ? (
                          <span
                            className={`${styles.status} ${pending ? styles.statusAttention : ''}`}
                          >
                            {STATE_LABELS[m.membership.state] ?? m.membership.state}
                          </span>
                        ) : (
                          <span className={styles.cell}>—</span>
                        )}
                      </span>
                      <span role="cell" className={styles.cell}>
                        {m.membership?.source_type ? SOURCE_LABELS[m.membership.source_type] : '—'}
                      </span>
                      <span role="cell" className={styles.cell}>
                        {m.leadership.length ? m.leadership.map((l) => l.title).join(', ') : '—'}
                      </span>
                      <span role="cell" className={styles.cell}>
                        {m.membership?.since ? calendar(m.membership.since) : '—'}
                      </span>
                      <span role="cell" className={styles.action}>
                        <Link href={detailHref(m.profile_id)} className={styles.open}>
                          {COPY.open}
                        </Link>
                      </span>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {leaders ? (
        <section className={styles.leaders} data-card="leaders">
          <div className={styles.leadersHead}>
            <h2 className={styles.leadersLabel}>
              {COPY.leaders} · {leaders.length}
            </h2>
            {counts ? (
              <button type="button" className={styles.viewAll} onClick={() => setTab('ACTIVE')}>
                {COPY.viewAll(counts.active_members)}
              </button>
            ) : null}
          </div>
          {leaders.length === 0 ? (
            <p className={styles.note}>{COPY.noLeaders}</p>
          ) : (
            <ul className={styles.leaderList}>
              {leaders.map((m) => (
                <li key={m.profile_id} className={styles.leader} data-leader={m.profile_id}>
                  <span className={styles.leaderName}>
                    {m.profile?.display_name ?? COPY.hidden}
                  </span>
                  <span className={styles.titles}>
                    {m.leadership.map((l) => (
                      <span key={l.title} className={styles.titleChip}>
                        {l.title}
                      </span>
                    ))}
                  </span>
                  <Link href={detailHref(m.profile_id)} className={styles.open}>
                    {COPY.open}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
