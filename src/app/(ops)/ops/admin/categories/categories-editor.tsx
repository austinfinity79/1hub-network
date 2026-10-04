'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import styles from '../admin.module.css'
import {
  AdminActionNotice,
  AdminLoadFailure,
  AdminLoading,
  classifyAdminError,
  fieldReason,
  useRequestGuard,
} from '../shared'

/**
 * ADMIN-PROD-06 — categories (05 §28, A11; the lightweight categories
 * contract): six existing `vocabulary_items` types, nothing else — no type
 * builder, no nested taxonomy, no generic config CMS. Reordering sends the
 * whole ordered id list, as the one `PUT …/order` call requires; this screen
 * does it with "move up / down" rather than a drag-and-drop library (none is
 * in the stack already, and adding one is out of this task's scope) — the
 * API contract either way is the same full-list PUT.
 */

const TYPES = ['REGION', 'DOMAIN', 'SKILL', 'COUNTRY', 'SPECIALIZATION', 'VENTURE_STAGE'] as const
const TYPE_LABELS: Record<string, string> = {
  REGION: 'Khu vực',
  DOMAIN: 'Lĩnh vực',
  SKILL: 'Kỹ năng',
  COUNTRY: 'Quốc gia',
  SPECIALIZATION: 'Chuyên môn',
  VENTURE_STAGE: 'Giai đoạn startup',
}
/** VENTURE_STAGE is product logic: label and order only, never archived (categories.ts policy). */
const ARCHIVABLE: Record<string, boolean> = Object.fromEntries(
  TYPES.map((t) => [t, t !== 'VENTURE_STAGE']),
)

const COPY = {
  title: 'Danh mục',
  columns: ['Nhãn', 'Mã', 'Đang dùng', 'Trạng thái', ''],
  save: 'Lưu',
  cancel: 'Huỷ',
  rename: 'Đổi nhãn',
  archive: 'Lưu trữ',
  activate: 'Kích hoạt',
  up: '↑',
  down: '↓',
  saved: 'Đã lưu.',
} as const

type Item = {
  id: string
  code: string
  label: string
  sort_order: number
  status: string
  in_use: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; items: Item[] }

export function CategoriesEditor() {
  const [type, setType] = useState<string>(TYPES[0])
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)
  const { begin, isCurrent } = useRequestGuard()

  // `silent` keeps the current table on screen for an in-place refresh after
  // one row's own mutation (rename / archive / reorder): briefly unmounting
  // every row would both flash needlessly and make the row the viewer just
  // acted on disappear mid-interaction.
  const load = useCallback(
    async (silent = false) => {
      const token = begin()
      if (!silent) setState({ kind: 'loading' })
      try {
        const page = await apiRequest<{ items: Item[] }>(`/ops/categories/${type}`)
        if (!isCurrent(token)) return
        setState({ kind: 'ready', items: page.items })
      } catch (error) {
        if (!isCurrent(token)) return
        setState({ kind: 'failed', failure: classifyAdminError(error) })
      }
    },
    [type, begin, isCurrent],
  )

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (id: string, body: unknown) => {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/ops/categories/${type}/${id}`, { method: 'PATCH', body })
      setEditing(null)
      setNotice({ tone: 'ok', text: COPY.saved })
      await load(true)
    } catch (error) {
      setNotice({
        tone: 'error',
        text: fieldReason(error) ?? 'Không lưu được. Tải lại để xem trạng thái mới nhất.',
      })
      await load(true).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const move = async (index: number, delta: number) => {
    if (state.kind !== 'ready') return
    const next = [...state.items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setBusy(true)
    setNotice(null)
    try {
      const reordered = await apiRequest<{ items: Item[] }>(`/ops/categories/${type}/order`, {
        method: 'PUT',
        body: { ids: next.map((i) => i.id) },
      })
      setState({ kind: 'ready', items: reordered.items })
    } catch {
      setNotice({ tone: 'error', text: 'Không sắp xếp được. Tải lại để xem thứ tự mới nhất.' })
      await load(true).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page} data-screen="ADMIN-CATEGORIES">
      <header className={styles.header}>
        <h1 className={styles.title}>{COPY.title}</h1>
      </header>
      <div className={styles.tabs} role="tablist">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className={styles.tab}
            aria-current={t === type}
            onClick={() => setType(t)}
            data-tab={t}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {notice ? <AdminActionNotice tone={notice.tone} text={notice.text} /> : null}

      {state.kind === 'failed' ? (
        <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
      ) : state.kind === 'loading' ? (
        <AdminLoading />
      ) : (
        <div className={styles.table} role="table" aria-label={COPY.title} data-queue="categories">
          <div className={`${styles.head} ${styles.colsCategories}`} role="row">
            {COPY.columns.map((c, i) => (
              <span key={i} role="columnheader" className={styles.cell}>
                {c}
              </span>
            ))}
          </div>
          {state.items.map((item, index) => (
            <div
              key={item.id}
              role="row"
              className={`${styles.row} ${styles.colsCategories}`}
              data-item-row={item.id}
            >
              {editing?.id === item.id ? (
                <span role="cell" className={styles.cell}>
                  <input
                    className={styles.input}
                    value={editing.label}
                    maxLength={200}
                    onChange={(e) => setEditing({ id: item.id, label: e.target.value })}
                  />
                </span>
              ) : (
                <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                  {item.label}
                </span>
              )}
              <span role="cell" className={styles.cell}>
                {item.code}
              </span>
              <span role="cell" className={styles.cell} data-in-use={item.in_use}>
                {item.in_use}
              </span>
              <span role="cell" className={styles.cell}>
                <span className={styles.chip}>
                  {item.status === 'ACTIVE' ? 'Hoạt động' : 'Lưu trữ'}
                </span>
              </span>
              <span role="cell" className={`${styles.cell} ${styles.actions}`}>
                {editing?.id === item.id ? (
                  <>
                    <button
                      type="button"
                      className={styles.textAction}
                      disabled={busy || !editing.label.trim()}
                      onClick={() => void patch(item.id, { label: editing.label.trim() })}
                    >
                      {COPY.save}
                    </button>
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={() => setEditing(null)}
                    >
                      {COPY.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.textAction}
                      disabled={busy}
                      onClick={() => setEditing({ id: item.id, label: item.label })}
                      data-action="rename"
                    >
                      {COPY.rename}
                    </button>
                    {ARCHIVABLE[type] ? (
                      <button
                        type="button"
                        className={styles.textAction}
                        disabled={busy}
                        onClick={() =>
                          void patch(item.id, {
                            status: item.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
                          })
                        }
                        data-action={item.status === 'ACTIVE' ? 'archive' : 'activate'}
                      >
                        {item.status === 'ACTIVE' ? COPY.archive : COPY.activate}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.textAction}
                      disabled={busy || index === 0}
                      onClick={() => void move(index, -1)}
                      aria-label="Lên"
                    >
                      {COPY.up}
                    </button>
                    <button
                      type="button"
                      className={styles.textAction}
                      disabled={busy || index === state.items.length - 1}
                      onClick={() => void move(index, 1)}
                      aria-label="Xuống"
                    >
                      {COPY.down}
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
