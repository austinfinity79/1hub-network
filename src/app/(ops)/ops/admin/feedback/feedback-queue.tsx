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
 * ADMIN-PROD-06 — feedback queue (05 §28, A11; PD-5). Filters mirror the API
 * exactly (`status, type, priority, owner, created_from, created_to`); the
 * weekly summary is the one read view the task allows (no analytics
 * dashboard, no per-item e-mail/Slack).
 */

const COPY = {
  title: 'Phản hồi',
  subtitle: (open: number) => `${open} đang mở (Mới / Đang xử lý)`,
  columns: ['Loại', 'Nội dung', 'Ưu tiên', 'Trạng thái', 'Gửi lúc'],
  empty: 'Không có phản hồi nào ở phạm vi này.',
  loadMore: 'Tải thêm',
  status: 'Trạng thái',
  type: 'Loại',
  priority: 'Ưu tiên',
  owner: 'Người phụ trách (profile id)',
  from: 'Từ ngày',
  to: 'Đến ngày',
  any: 'Tất cả',
  none: 'Chưa đặt',
  summaryToggle: 'Tổng hợp tuần',
  summaryHide: 'Ẩn tổng hợp',
  summaryWeek: 'Tuần (ISO, VD 2026-W40)',
  summaryTotal: 'Tổng',
  summaryByType: 'Theo loại',
  summaryByPriority: 'Theo ưu tiên',
  summaryByOwner: 'Theo người phụ trách',
  open: 'mở',
  closed: 'đóng',
  unassigned: 'Chưa gán',
  screenshot: '📎',
} as const

const STATUS_LABELS: Record<string, string> = { NEW: 'Mới', IN_REVIEW: 'Đang xử lý', DONE: 'Xong' }
const TYPE_LABELS: Record<string, string> = {
  BUG: 'Lỗi kỹ thuật',
  UX: 'Trải nghiệm',
  FEATURE: 'Đề xuất tính năng',
  OTHER: 'Khác',
}
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao' }

type Item = {
  id: string
  type: string
  status: string
  priority: string | null
  sender: { kind: 'MEMBER' | 'GUEST'; display_name: string | null }
  excerpt: string
  has_screenshot: boolean
  created_at: string
}

type Summary = {
  week: string
  total: number
  by_type: Array<{ type: string; group: string; open: number; closed: number }>
  by_priority: Array<{ priority: string; open: number; closed: number }>
  by_owner: Array<{ display_name: string | null; open: number; closed: number }>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; items: Item[]; cursor: string | null; open: number }

export function FeedbackQueue() {
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: '',
    owner: '',
    created_from: '',
    created_to: '',
  })
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [showSummary, setShowSummary] = useState(false)
  const [week, setWeek] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryFailed, setSummaryFailed] = useState(false)
  const { begin, isCurrent } = useRequestGuard()

  const load = useCallback(
    async (append = false, cursor: string | null = null) => {
      const token = begin()
      if (!append) setState({ kind: 'loading' })
      try {
        const query = new URLSearchParams()
        for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v)
        if (cursor) query.set('cursor', cursor)
        const page = await apiRequest<ListEnvelope<Item> & { counts: { open: number } }>(
          `/ops/feedback?${query}`,
        )
        if (!isCurrent(token)) return
        setState((prev) => ({
          kind: 'ready',
          items: append && prev.kind === 'ready' ? [...prev.items, ...page.items] : page.items,
          cursor: page.page.next_cursor,
          open: page.counts.open,
        }))
      } catch (error) {
        if (!isCurrent(token)) return
        setState({ kind: 'failed', failure: classifyAdminError(error) })
      }
    },
    [filters, begin, isCurrent],
  )

  useEffect(() => {
    void load()
  }, [load])

  const loadSummary = useCallback(async () => {
    setSummaryFailed(false)
    try {
      const query = week ? `?week=${encodeURIComponent(week)}` : ''
      setSummary(await apiRequest<Summary>(`/ops/feedback/summary${query}`))
    } catch {
      setSummaryFailed(true)
    }
  }, [week])

  useEffect(() => {
    if (showSummary) void loadSummary()
  }, [showSummary, loadSummary])

  return (
    <div className={styles.page} data-screen="ADMIN-FEEDBACK">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.subtitle}>
            {state.kind === 'ready' ? COPY.subtitle(state.open) : ' '}
          </p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => setShowSummary((v) => !v)}
          data-action="toggle-summary"
        >
          {showSummary ? COPY.summaryHide : COPY.summaryToggle}
        </button>
      </header>

      {showSummary ? (
        <section className={styles.card} data-card="weekly-summary">
          <h2 className={styles.eyebrow}>{COPY.summaryToggle}</h2>
          <input
            className={styles.input}
            placeholder={COPY.summaryWeek}
            aria-label={COPY.summaryWeek}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            onBlur={() => void loadSummary()}
          />
          {summaryFailed ? (
            <p className={`${styles.line} ${styles.muted}`}>Không tải được tổng hợp tuần.</p>
          ) : summary ? (
            <div data-summary-week={summary.week}>
              <p className={styles.line}>
                {COPY.summaryTotal}: {summary.total}
              </p>
              <p className={styles.line}>
                {COPY.summaryByType}:{' '}
                {summary.by_type
                  .map((t) => `${TYPE_LABELS[t.type] ?? t.type} ${t.open + t.closed}`)
                  .join(' · ')}
              </p>
              <p className={styles.line}>
                {COPY.summaryByPriority}:{' '}
                {summary.by_priority
                  .map((p) => `${PRIORITY_LABELS[p.priority] ?? COPY.none} ${p.open + p.closed}`)
                  .join(' · ')}
              </p>
              <p className={styles.line}>
                {COPY.summaryByOwner}:{' '}
                {summary.by_owner
                  .map((o) => `${o.display_name ?? COPY.unassigned} ${o.open + o.closed}`)
                  .join(' · ')}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          aria-label={COPY.status}
          data-filter="status"
        >
          <option value="">{COPY.status}</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          aria-label={COPY.type}
          data-filter="type"
        >
          <option value="">{COPY.type}</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          aria-label={COPY.priority}
          data-filter="priority"
        >
          <option value="">{COPY.priority}</option>
          <option value="NONE">{COPY.none}</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          className={`${styles.input} ${styles.inputWide}`}
          placeholder={COPY.owner}
          aria-label={COPY.owner}
          value={filters.owner}
          onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
          data-filter="owner"
        />
        <input
          type="date"
          className={styles.input}
          aria-label={COPY.from}
          value={filters.created_from}
          onChange={(e) => setFilters((f) => ({ ...f, created_from: e.target.value }))}
          data-filter="created_from"
        />
        <input
          type="date"
          className={styles.input}
          aria-label={COPY.to}
          value={filters.created_to}
          onChange={(e) => setFilters((f) => ({ ...f, created_to: e.target.value }))}
          data-filter="created_to"
        />
      </div>

      {state.kind === 'failed' ? (
        <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
      ) : (
        <div
          className={styles.table}
          role="table"
          aria-label={COPY.title}
          aria-busy={state.kind === 'loading'}
          data-queue="feedback"
        >
          <div className={`${styles.head} ${styles.colsFeedback}`} role="row">
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
                  href={`/ops/admin/feedback/${item.id}`}
                  role="row"
                  className={`${styles.row} ${styles.colsFeedback}`}
                  data-feedback-row={item.id}
                >
                  <span role="cell" className={styles.cell}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                    {item.has_screenshot ? `${COPY.screenshot} ` : ''}
                    {item.excerpt}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {item.priority ? (PRIORITY_LABELS[item.priority] ?? item.priority) : COPY.none}
                  </span>
                  <span role="cell" className={styles.cell}>
                    <span
                      className={`${styles.chip} ${item.priority === 'HIGH' ? styles.chipHigh : ''}`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
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
