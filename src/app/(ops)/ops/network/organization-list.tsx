'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { ListEnvelope } from '@/lib/api/types'
import type { OpsOrganizationDTO } from '@/lib/ops/organizations'

import styles from './network.module.css'

/**
 * WF03-S01 — organization list (DEC-WF03-G1/G8/G11/G15, DEC-WF03-S01-D1).
 *
 * The approved ADM8 frame (header band + table card) with canonical columns
 * only: name, canonical parent, ACTIVE members, type, status. The drawn
 * "Trưởng chapter", "Summit đang chạy", "Sự kiện 30 ngày" and "Sender" columns,
 * "Tạo chapter" and the no-head notice have no P0 source and are not rendered.
 * Selecting a row navigates to the organization's ops context; the URL is
 * context only and the next route authorizes on the server.
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S01-D1). */
const COPY = {
  title: 'Tổ chức & thành viên',
  count: 'tổ chức',
  columns: ['Tổ chức', 'Trực thuộc', 'Thành viên', 'Loại', 'Trạng thái'],
  loading: 'Đang tải danh sách tổ chức…',
  empty: 'Chưa có tổ chức nào trong phạm vi quản lý của bạn.',
  failed: 'Không tải được danh sách tổ chức.',
  retry: 'Thử lại',
} as const

const TYPE_LABELS: Record<string, string> = { HUB: 'HUB', CHAPTER: 'Chapter', CLB: 'CLB' }
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang công khai',
  ARCHIVED: 'Đã lưu trữ',
}

type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; items: OpsOrganizationDTO[] }

/** Every page of the canonical list, in the server's order. */
async function loadAll(): Promise<OpsOrganizationDTO[]> {
  const items: OpsOrganizationDTO[] = []
  let cursor: string | null = null
  do {
    const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    const page: ListEnvelope<OpsOrganizationDTO> = await apiRequest(`/ops/organizations${query}`)
    items.push(...page.items)
    cursor = page.page.next_cursor
  } while (cursor)
  return items
}

export function OrganizationList() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', items: await loadAll() })
    } catch {
      // Never surface status codes, scope ids or raw errors.
      setState({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.page} data-screen="WF03-S01">
      <header className={styles.header}>
        <h1 className={`type-section-sm ${styles.title}`}>{COPY.title}</h1>
        <p className={`type-meta-xs ${styles.subtitle}`} data-count>
          {state.kind === 'ready' ? `${state.items.length} ${COPY.count}` : ' '}
        </p>
      </header>
      <div className={styles.body}>
        {state.kind === 'failed' ? (
          <div className={styles.failed} role="alert" data-state="list-failed">
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
            data-org-table
          >
            <div className={`${styles.row} ${styles.head}`} role="row">
              {COPY.columns.map((c) => (
                <span key={c} role="columnheader" className={styles.th}>
                  {c}
                </span>
              ))}
            </div>
            {state.kind === 'loading' ? (
              <p className={`type-body-sm ${styles.note}`} data-state="list-loading">
                {COPY.loading}
              </p>
            ) : state.items.length === 0 ? (
              <p className={`type-body-sm ${styles.note}`} data-state="list-empty">
                {COPY.empty}
              </p>
            ) : (
              state.items.map((org) => (
                <div key={org.id} role="row" className={styles.row} data-org-row={org.id}>
                  <span role="cell" className={styles.nameCell}>
                    <Link
                      href={`/ops/org/${org.id}`}
                      className={`type-body-sm weight-semibold ${styles.name}`}
                    >
                      {org.name}
                    </Link>
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell}`}>
                    {org.parent?.name ?? '—'}
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell}`}>
                    {org.active_members}
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell}`}>
                    {TYPE_LABELS[org.type] ?? org.type}
                  </span>
                  <span role="cell" className={`type-body-sm ${styles.cell}`}>
                    {STATUS_LABELS[org.status] ?? org.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
