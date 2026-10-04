'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { ListEnvelope } from '@/lib/api/types'

import styles from '../admin.module.css'
import {
  AdminEmpty,
  AdminLoadFailure,
  AdminLoading,
  classifyAdminError,
  useRequestGuard,
  adminDateTime,
} from '../shared'

/**
 * ADMIN-PROD-06 — the role-verification queue (05 §26, A9): PD-1 routing,
 * approve / reject, history. The API scopes the list to the viewer (PLATFORM
 * for PLATFORM_ADMIN, the routed units a leader holds `verification:review`
 * for); the frontend never filters by scope itself.
 */

const COPY = {
  title: 'Xác minh vai trò',
  subtitle: (pending: number) => `${pending} yêu cầu đang chờ duyệt`,
  statusLabel: 'Trạng thái',
  columns: ['Người gửi', 'Chức danh', 'Đơn vị đặt', 'Định tuyến tới', 'Gửi lúc'],
  empty: 'Không có yêu cầu nào ở trạng thái này.',
  loadMore: 'Tải thêm',
  fallback: 'Fallback',
  current: 'Đang giữ',
  hidden: 'Hồ sơ không công khai',
} as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'Đã rút',
}

type Item = {
  id: string
  status: string
  position: {
    title: string
    organization: { id: string; name: string }
    period_from: string
    period_to: string | null
    current: boolean
  }
  routed_to: { id: string; name: string }
  fallback: boolean
  requester: { profile_id: string; display_name: string | null }
  submitted_at: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; items: Item[]; cursor: string | null; pending: number }

export function VerificationQueue() {
  const [status, setStatus] = useState('PENDING')
  const [state, setState] = useState<State>({ kind: 'loading' })
  const { begin, isCurrent } = useRequestGuard()

  const load = useCallback(
    async (append = false, cursor: string | null = null) => {
      const token = begin()
      if (!append) setState({ kind: 'loading' })
      try {
        const query = new URLSearchParams({ status })
        if (cursor) query.set('cursor', cursor)
        const page = await apiRequest<ListEnvelope<Item> & { counts: { pending: number } }>(
          `/ops/verification-requests?${query}`,
        )
        if (!isCurrent(token)) return
        setState((prev) => ({
          kind: 'ready',
          items: append && prev.kind === 'ready' ? [...prev.items, ...page.items] : page.items,
          cursor: page.page.next_cursor,
          pending: page.counts.pending,
        }))
      } catch (error) {
        if (!isCurrent(token)) return
        setState({ kind: 'failed', failure: classifyAdminError(error) })
      }
    },
    [status, begin, isCurrent],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.page} data-screen="ADMIN-VERIFICATION">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.subtitle}>
            {state.kind === 'ready' ? COPY.subtitle(state.pending) : ' '}
          </p>
        </div>
      </header>
      <div className={styles.filters}>
        <label>
          <span className="type-body-sm">{COPY.statusLabel} </span>
          <select
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            data-filter="status"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.kind === 'failed' ? (
        <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
      ) : (
        <div
          className={styles.table}
          role="table"
          aria-label={COPY.title}
          aria-busy={state.kind === 'loading'}
          data-queue="verification"
        >
          <div className={`${styles.head} ${styles.colsVerification}`} role="row">
            {COPY.columns.map((c) => (
              <span key={c} role="columnheader" className={styles.cell}>
                {c}
              </span>
            ))}
          </div>
          {state.kind === 'loading' ? <AdminLoading /> : null}
          {state.kind === 'ready' && state.items.length === 0 ? (
            <AdminEmpty label={COPY.empty} />
          ) : null}
          {state.kind === 'ready'
            ? state.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/ops/admin/verification/${item.id}`}
                  role="row"
                  className={`${styles.row} ${styles.colsVerification}`}
                  data-request-row={item.id}
                >
                  <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                    {item.requester.display_name ?? COPY.hidden}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.position.title}
                    {item.position.current ? ` · ${COPY.current}` : ''}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.position.organization.name}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.routed_to.name}
                    {item.fallback ? ` (${COPY.fallback})` : ''}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {adminDateTime(item.submitted_at)}
                  </span>
                </Link>
              ))
            : null}
          {state.kind === 'ready' && state.cursor ? (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => void load(true, state.cursor)}
            >
              {COPY.loadMore}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
