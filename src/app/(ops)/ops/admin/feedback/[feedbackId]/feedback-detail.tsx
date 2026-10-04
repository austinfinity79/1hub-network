'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import styles from '../../admin.module.css'
import {
  AdminActionNotice,
  AdminEmpty,
  AdminLoadFailure,
  AdminLoading,
  classifyAdminError,
  fieldReason,
  adminDateTime,
} from '../../shared'

/**
 * ADMIN-PROD-06 — feedback detail / triage (05 §28, A11; PD-5). One PATCH for
 * type, priority, owner and status together; NEW → DONE without a note is
 * refused by the server (422 `resolution_note: required`), surfaced inline
 * rather than guessed at. DONE is final — the status control locks once
 * reached, matching the server's own rule (no reopen). A screenshot past its
 * 90-day window renders as a clean "expired" state, never a broken image or
 * a storage path (PD-5, R13).
 */

const COPY = {
  hidden: 'Hồ sơ không công khai',
  guest: 'Khách',
  type: 'Loại',
  priority: 'Ưu tiên',
  none: 'Chưa đặt',
  owner: 'Người phụ trách (profile id)',
  status: 'Trạng thái',
  note: 'Ghi chú xử lý',
  noteRequired: 'Cần ghi chú khi chuyển trực tiếp sang Xong (trùng lặp / spam).',
  save: 'Lưu thay đổi',
  content: 'Nội dung',
  context: 'Ngữ cảnh gửi',
  screenshot: 'Ảnh chụp màn hình',
  screenshotExpired: 'Ảnh đã hết hạn lưu trữ (quá 90 ngày) và đã bị xoá.',
  noScreenshot: 'Không có ảnh chụp.',
  guestEmail: 'E-mail khách',
  history: 'Lịch sử',
  noHistory: 'Chưa có thay đổi nào.',
  saved: 'Đã lưu.',
} as const

/** History events (`FEEDBACK_*` audit names), shown as labels, never raw codes. */
const EVENT_LABELS: Record<string, string> = {
  ASSIGNED: 'Giao người phụ trách',
  PRIORITY_CHANGED: 'Đổi mức ưu tiên',
  STATUS_CHANGED: 'Đổi trạng thái',
  UPDATED: 'Cập nhật',
}

const STATUS_LABELS: Record<string, string> = { NEW: 'Mới', IN_REVIEW: 'Đang xử lý', DONE: 'Xong' }
const TYPE_LABELS: Record<string, string> = {
  BUG: 'Lỗi kỹ thuật',
  UX: 'Trải nghiệm',
  FEATURE: 'Đề xuất tính năng',
  OTHER: 'Khác',
}
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao' }
const CONTEXT_LABELS: Record<string, string> = {
  route: 'Trang',
  screen: 'Màn hình',
  step: 'Bước',
  workflow: 'Luồng',
  browser: 'Trình duyệt',
  os: 'Hệ điều hành',
  device: 'Thiết bị',
  viewport: 'Kích thước màn hình',
  locale: 'Ngôn ngữ',
  user_agent: 'User agent',
}

type Detail = {
  id: string
  type: string
  status: string
  priority: string | null
  owner: { profile_id: string; display_name: string | null } | null
  sender: {
    kind: 'MEMBER' | 'GUEST'
    profile_id: string | null
    display_name: string | null
    guest_email: string | null
  }
  content: string
  context: Record<string, string>
  screenshot: { url: string | null; expires_at: string | null; expired: boolean } | null
  resolution_note: string | null
  created_at: string
  history: Array<{ event: string; at: string; status: string | null }>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; detail: Detail }

export function FeedbackDetail({ feedbackId }: { feedbackId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({ type: '', priority: '', owner: '', status: '', note: '' })

  const load = useCallback(async () => {
    try {
      const detail = await apiRequest<Detail>(`/ops/feedback/${feedbackId}`)
      setState({ kind: 'ready', detail })
      setForm({
        type: detail.type,
        priority: detail.priority ?? '',
        owner: detail.owner?.profile_id ?? '',
        status: detail.status,
        note: detail.resolution_note ?? '',
      })
    } catch (error) {
      setState({ kind: 'failed', failure: classifyAdminError(error) })
    }
  }, [feedbackId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/ops/feedback/${feedbackId}`, {
        method: 'PATCH',
        body: {
          type: form.type,
          priority: form.priority || null,
          owner_profile_id: form.owner.trim() || null,
          status: form.status,
          resolution_note: form.note.trim() || null,
        },
      })
      setNotice({ tone: 'ok', text: COPY.saved })
      await load()
    } catch (error) {
      setNotice({
        tone: 'error',
        text: fieldReason(error) ?? 'Không lưu được. Tải lại để xem trạng thái mới nhất.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (state.kind !== 'ready') {
    return (
      <div className={styles.page} data-screen="ADMIN-FEEDBACK-DETAIL">
        {state.kind === 'loading' ? (
          <AdminLoading />
        ) : (
          <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
        )}
      </div>
    )
  }

  const { detail } = state
  const done = detail.status === 'DONE'
  const contextEntries = Object.entries(detail.context)

  return (
    <div className={styles.page} data-screen="ADMIN-FEEDBACK-DETAIL" data-status={detail.status}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{TYPE_LABELS[detail.type] ?? detail.type}</h1>
          <p className={styles.subtitle}>
            {detail.sender.kind === 'GUEST'
              ? COPY.guest
              : (detail.sender.display_name ?? COPY.hidden)}{' '}
            · gửi {adminDateTime(detail.created_at)}
          </p>
        </div>
      </header>

      {notice ? <AdminActionNotice tone={notice.tone} text={notice.text} /> : null}

      <section className={styles.card} data-card="content">
        <h2 className={styles.eyebrow}>{COPY.content}</h2>
        <p className={styles.line}>{detail.content}</p>
        {detail.sender.guest_email ? (
          <p className={`${styles.line} ${styles.muted}`}>
            {COPY.guestEmail}: {detail.sender.guest_email}
          </p>
        ) : null}
      </section>

      <section className={styles.card} data-card="screenshot">
        <h2 className={styles.eyebrow}>{COPY.screenshot}</h2>
        {!detail.screenshot ? (
          <p className={`${styles.line} ${styles.muted}`}>{COPY.noScreenshot}</p>
        ) : detail.screenshot.expired || !detail.screenshot.url ? (
          <p className={`${styles.line} ${styles.muted}`} data-state="screenshot-expired">
            {COPY.screenshotExpired}
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.screenshot.url} alt="" className={styles.screenshot} />
        )}
      </section>

      {contextEntries.length > 0 ? (
        <section className={styles.card} data-card="context">
          <h2 className={styles.eyebrow}>{COPY.context}</h2>
          {contextEntries.map(([k, v]) => (
            <p key={k} className={`${styles.line} ${styles.muted}`}>
              {CONTEXT_LABELS[k] ?? k}: {v}
            </p>
          ))}
        </section>
      ) : null}

      <section className={styles.card} data-card="triage">
        <h2 className={styles.eyebrow}>Phân loại &amp; xử lý</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          data-triage-form
        >
          <div className={styles.filters}>
            <label className="type-body-sm">
              {COPY.type}
              <br />
              <select
                className={styles.select}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="type-body-sm">
              {COPY.priority}
              <br />
              <select
                className={styles.select}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="">{COPY.none}</option>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="type-body-sm">
              {COPY.status}
              <br />
              <select
                className={styles.select}
                value={form.status}
                disabled={done}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                data-field="status"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="type-body-sm">
            {COPY.owner}
            <br />
            <input
              className={styles.input}
              value={form.owner}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            />
          </label>
          <br />
          <label className="type-body-sm">
            {COPY.note}
            <br />
            <textarea
              className={styles.textarea}
              maxLength={2000}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              data-field="resolution_note"
            />
          </label>
          {detail.status === 'NEW' && form.status === 'DONE' && !form.note.trim() ? (
            <p className={styles.fieldError}>{COPY.noteRequired}</p>
          ) : null}
          <div className={styles.confirmForm}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {COPY.save}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} data-card="history">
        <h2 className={styles.eyebrow}>{COPY.history}</h2>
        {detail.history.length === 0 ? (
          <AdminEmpty label={COPY.noHistory} />
        ) : (
          <ol className={styles.history}>
            {detail.history.map((h, i) => (
              <li key={i} className={styles.historyEntry} data-history-entry>
                <span className={styles.historyWhen}>{adminDateTime(h.at)}</span>
                <span className={styles.historyWhat}>{EVENT_LABELS[h.event] ?? h.event}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
