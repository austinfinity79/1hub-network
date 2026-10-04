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
 * ADMIN-PROD-06 — venture review queue (05 §27, A10; PD-2, PD-3). FIRST_PUBLISH
 * reviews a venture's first public version; CORE_CHANGE reviews a change to an
 * already-public one, which stays on its approved values until decided.
 */

const COPY = {
  title: 'Duyệt startup',
  subtitle: (pending: number) => `${pending} bài đang chờ duyệt`,
  statusLabel: 'Trạng thái',
  columns: ['Startup', 'Loại', 'Người sở hữu', 'Thay đổi', 'Gửi lúc'],
  empty: 'Không có bài duyệt nào ở trạng thái này.',
  loadMore: 'Tải thêm',
  hidden: 'Hồ sơ không công khai',
} as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'Đã rút',
}

const KIND_LABELS: Record<string, string> = {
  FIRST_PUBLISH: 'Công khai lần đầu',
  CORE_CHANGE: 'Thay đổi thông tin',
}

type Item = {
  id: string
  kind: string
  status: string
  venture: { id: string; name: string }
  proposed_name: string
  changed_fields: string[]
  owner: { profile_id: string; display_name: string | null }
  submitted_at: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; items: Item[]; cursor: string | null; pending: number }

export function VentureQueue() {
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
          `/ops/venture-reviews?${query}`,
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
    <div className={styles.page} data-screen="ADMIN-VENTURES">
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
          data-queue="ventures"
        >
          <div className={`${styles.head} ${styles.colsVentures}`} role="row">
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
                  href={`/ops/admin/ventures/${item.id}`}
                  role="row"
                  className={`${styles.row} ${styles.colsVentures}`}
                  data-review-row={item.id}
                >
                  <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                    {item.proposed_name}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {KIND_LABELS[item.kind] ?? item.kind}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.owner.display_name ?? COPY.hidden}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.changed_fields.length}
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
