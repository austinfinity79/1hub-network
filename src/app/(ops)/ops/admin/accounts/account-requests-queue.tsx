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
 * ADMIN-PROD-06 — account-request queue (05 §28, A11; PD-7): users' own
 * deletion requests and any ESCALATION row (none filed in P0, DEC-ADM-D04),
 * one queue, PLATFORM_ADMIN only.
 */

const COPY = {
  title: 'Tài khoản',
  subtitle: (pending: number) => `${pending} yêu cầu đang chờ xử lý`,
  statusLabel: 'Trạng thái',
  kindLabel: 'Loại',
  columns: ['Đối tượng', 'Hành động', 'Loại', 'Đơn vị đề nghị', 'Gửi lúc'],
  empty: 'Không có yêu cầu nào ở phạm vi này.',
  loadMore: 'Tải thêm',
  hidden: 'Hồ sơ không công khai',
  any: 'Tất cả',
} as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ',
  PROCESSED: 'Đã xử lý',
  DECLINED: 'Từ chối',
}
const KIND_LABELS: Record<string, string> = {
  ESCALATION: 'Đề nghị từ đơn vị',
  SELF_DELETION: 'Tự yêu cầu xoá',
}
const ACTION_LABELS: Record<string, string> = {
  LOCK: 'Khoá',
  DEACTIVATE: 'Vô hiệu hoá',
  SOFT_DELETE: 'Xoá tài khoản',
}

type Item = {
  id: string
  kind: string
  action: string
  status: string
  target: { profile_id: string | null; display_name: string | null }
  organization: { id: string; name: string } | null
  created_at: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; items: Item[]; cursor: string | null; pending: number }

export function AccountRequestsQueue() {
  const [status, setStatus] = useState('PENDING')
  const [kind, setKind] = useState('')
  const [state, setState] = useState<State>({ kind: 'loading' })
  const { begin, isCurrent } = useRequestGuard()

  const load = useCallback(
    async (append = false, cursor: string | null = null) => {
      const token = begin()
      if (!append) setState({ kind: 'loading' })
      try {
        const query = new URLSearchParams({ status })
        if (kind) query.set('kind', kind)
        if (cursor) query.set('cursor', cursor)
        const page = await apiRequest<ListEnvelope<Item> & { counts: { pending: number } }>(
          `/ops/account-requests?${query}`,
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
    [status, kind, begin, isCurrent],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.page} data-screen="ADMIN-ACCOUNTS">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.subtitle}>
            {state.kind === 'ready' ? COPY.subtitle(state.pending) : ' '}
          </p>
        </div>
      </header>
      <div className={styles.filters}>
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
        <select
          className={styles.select}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          data-filter="kind"
        >
          <option value="">{COPY.any}</option>
          {Object.entries(KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {state.kind === 'failed' ? (
        <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
      ) : (
        <div
          className={styles.table}
          role="table"
          aria-label={COPY.title}
          aria-busy={state.kind === 'loading'}
          data-queue="accounts"
        >
          <div className={`${styles.head} ${styles.colsAccounts}`} role="row">
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
                  href={`/ops/admin/accounts/${item.id}`}
                  role="row"
                  className={`${styles.row} ${styles.colsAccounts}`}
                  data-request-row={item.id}
                >
                  <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                    {item.target.display_name ?? COPY.hidden}
                  </span>
                  <span role="cell" className={styles.cell}>
                    <span
                      className={`${styles.chip} ${item.action === 'SOFT_DELETE' ? styles.chipHigh : ''}`}
                    >
                      {ACTION_LABELS[item.action] ?? item.action}
                    </span>
                  </span>
                  <span role="cell" className={styles.cell}>
                    {KIND_LABELS[item.kind] ?? item.kind}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.organization?.name ?? '—'}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {adminDateTime(item.created_at)}
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
