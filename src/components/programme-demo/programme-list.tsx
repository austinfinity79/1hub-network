'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { ListEnvelope } from '@/lib/api/types'
import { DEMO_COPY, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import { demoRoutes } from '@/lib/programme-demo/routes'
import { mergedSummaries } from '@/lib/programme-demo/session-store'
import type { ProgrammeDemoSummaryDTO } from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import { DemoPage } from './demo-page'
import { useProgrammeDemo } from './demo-store'
import styles from './programme-list.module.css'
import { ProgrammeStatusPill } from './status-pill'

/**
 * WF04-S01 — Programme / Challenge list (DEC-WF04-H1/H2, DEC-WF04-S01-D1..D3).
 *
 * One source: `GET /api/v1/demo/programmes`, already scoped on the server to
 * the actor's `programme:read` organizations, plus this browser session's demo
 * changes from the T00 store (drafts first, then the server's order). Columns
 * are DTO fields only: name, owning organization, type, dates, problem count
 * (CHALLENGE only) and lifecycle status.
 *
 * A row opens the detail page (WF04-S08; DEC-WF04-S08-D3 supersedes S01-D1).
 * "Tạo mới" opens WF04-S02 (S02-D3 supersedes S01-D2).
 */

const COPY = {
  columns: ['Tên', 'Đơn vị chủ trì', 'Loại', 'Thời gian', 'Bài toán', 'Trạng thái'],
  create: 'Tạo mới',
  loading: 'Đang tải danh sách chương trình và challenge…',
  empty: 'Chưa có chương trình hoặc challenge nào trong phạm vi tổ chức của bạn.',
  failed: 'Không tải được danh sách chương trình và challenge.',
  retry: 'Thử lại',
} as const

type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; items: ProgrammeDemoSummaryDTO[] }

export function ProgrammeList() {
  const { state: session, allowance } = useProgrammeDemo()
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const page = await apiRequest<ListEnvelope<ProgrammeDemoSummaryDTO>>('/demo/programmes')
      setState({ kind: 'ready', items: page.items })
    } catch {
      // Never surface status codes, scope ids or raw errors.
      setState({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const items = state.kind === 'ready' ? mergedSummaries(state.items, session, allowance) : []
  const count = (type: keyof typeof TYPE_LABEL) => items.filter((i) => i.type === type).length
  const meta =
    state.kind === 'ready'
      ? `${count('PROGRAMME')} ${TYPE_LABEL.PROGRAMME.toLowerCase()} · ${count('CHALLENGE')} ${TYPE_LABEL.CHALLENGE.toLowerCase()}`
      : ' '

  return (
    <div data-screen="WF04-S01">
      <DemoPage
        title={DEMO_COPY.title}
        meta={meta}
        actions={
          <Link
            href={demoRoutes.create()}
            className={`weight-medium ${buttons.primary}`}
            data-nav="programme-create"
            data-demo-create
          >
            {COPY.create}
          </Link>
        }
      >
        {state.kind === 'failed' ? (
          <div className={styles.failed} role="alert" data-state="list-failed">
            <p className="type-body-sm">{COPY.failed}</p>
            <button type="button" className={`type-body-sm ${styles.retry}`} onClick={load}>
              {COPY.retry}
            </button>
          </div>
        ) : (
          <div className={styles.scroller}>
            <div
              className={styles.table}
              role="table"
              aria-label={DEMO_COPY.title}
              aria-busy={state.kind === 'loading'}
              data-programme-table
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
              ) : items.length === 0 ? (
                <p className={`type-body-sm ${styles.note}`} data-state="list-empty">
                  {COPY.empty}
                </p>
              ) : (
                items.map((p) => (
                  <div
                    key={p.id}
                    role="row"
                    className={styles.row}
                    data-programme-row={p.id}
                    data-type={p.type}
                  >
                    <span role="cell" className={`type-body-sm weight-semibold ${styles.name}`}>
                      <Link
                        href={demoRoutes.detail(p.id)}
                        className={styles.nameLink}
                        data-nav="programme-detail"
                      >
                        {p.name}
                      </Link>
                    </span>
                    <span role="cell" className={`type-body-sm ${styles.cell}`}>
                      {p.organization.name}
                    </span>
                    <span role="cell" className={`type-body-sm ${styles.cell}`}>
                      {TYPE_LABEL[p.type]}
                    </span>
                    <span role="cell" className={`type-body-sm ${styles.cell}`}>
                      {formatDemoDateRange(p.starts_at, p.ends_at)}
                    </span>
                    <span role="cell" className={`type-body-sm ${styles.cell}`}>
                      {p.counts.problem_statements ?? '—'}
                    </span>
                    <span role="cell" className={`${styles.cell} ${styles.statusCell}`}>
                      <ProgrammeStatusPill status={p.status} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DemoPage>
    </div>
  )
}
