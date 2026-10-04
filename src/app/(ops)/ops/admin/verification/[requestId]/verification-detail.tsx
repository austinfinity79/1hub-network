'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import styles from '../../admin.module.css'
import {
  AdminActionNotice,
  AdminLoadFailure,
  AdminLoading,
  classifyAdminError,
  fieldReason,
  isConflict,
  adminDateTime,
} from '../../shared'

/**
 * ADMIN-PROD-06 — verification request detail (05 §26, A9). Approve / reject
 * send `{ version, reason? }` with a fresh `Idempotency-Key`; a stale version
 * or an already-decided request answers 409, which reloads the detail rather
 * than retrying blindly (no duplicate submit).
 */

const COPY = {
  hidden: 'Hồ sơ không công khai',
  approve: 'Duyệt',
  reject: 'Từ chối',
  confirmApprove: 'Xác nhận duyệt',
  confirmReject: 'Xác nhận từ chối',
  position: 'Chức danh',
  routing: 'Định tuyến',
  fallback: 'Fallback (ngoài đơn vị đặt chức danh)',
  period: 'Thời gian',
  current: 'Đang giữ (hiện tại)',
  context: 'Quan hệ hiện có tại đơn vị',
  noContext: 'Chưa có tư cách thành viên hoặc vai trò lãnh đạo nào tại đơn vị này.',
  history: 'Lịch sử',
  rejectReason: 'Lý do từ chối (đã ghi nhận)',
  reasonLabel: 'Lý do (không bắt buộc)',
} as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'Đã rút',
}

const EVENT_LABELS: Record<string, string> = {
  SUBMITTED: 'Gửi yêu cầu',
  MIGRATED: 'Chuyển định tuyến',
  UPDATED: 'Cập nhật',
  WITHDRAWN: 'Rút yêu cầu',
  RESUBMITTED: 'Gửi lại',
  APPROVED: 'Duyệt',
  REJECTED: 'Từ chối',
}

type Detail = {
  id: string
  status: string
  version: number
  position: {
    title: string
    organization: { id: string; name: string }
    period_from: string
    period_to: string | null
    current: boolean
  }
  routed_to: { id: string; name: string }
  fallback: boolean
  requester: { profile_id: string; display_name: string | null; headline?: string }
  submitted_at: string
  handled_at: string | null
  can_act: boolean
  reject_reason: string | null
  context: {
    memberships: Array<{ state: string; started_at: string | null; ended_at: string | null }>
    leadership: Array<{ title: string; state: string; started_at: string; ended_at: string | null }>
  }
  history: Array<{
    event: string
    at: string
    by: string
    status: string | null
    reason: string | null
  }>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; detail: Detail }

export function VerificationDetail({ requestId }: { requestId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      const detail = await apiRequest<Detail>(`/ops/verification-requests/${requestId}`)
      setState({ kind: 'ready', detail })
    } catch (error) {
      setState({ kind: 'failed', failure: classifyAdminError(error) })
    }
  }, [requestId])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (action: 'approve' | 'reject', withReason?: string) => {
    if (state.kind !== 'ready') return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/ops/verification-requests/${requestId}/${action}`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: { version: state.detail.version, ...(withReason ? { reason: withReason } : {}) },
      })
      setRejecting(false)
      setReason('')
      await load()
    } catch (error) {
      setNotice(
        isConflict(error)
          ? 'Mục này vừa thay đổi. Đã tải lại trạng thái mới nhất.'
          : (fieldReason(error) ??
              'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.'),
      )
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  if (state.kind !== 'ready') {
    return (
      <div className={styles.page} data-screen="ADMIN-VERIFICATION-DETAIL">
        {state.kind === 'loading' ? (
          <AdminLoading />
        ) : (
          <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
        )}
      </div>
    )
  }

  const { detail } = state
  return (
    <div
      className={styles.page}
      data-screen="ADMIN-VERIFICATION-DETAIL"
      data-status={detail.status}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title} data-requester-name>
            {detail.requester.display_name ?? COPY.hidden}
          </h1>
          <p className={styles.subtitle}>
            {detail.position.title} · {STATUS_LABELS[detail.status] ?? detail.status} · gửi{' '}
            {adminDateTime(detail.submitted_at)}
          </p>
        </div>
        {detail.can_act && !rejecting ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void decide('approve')}
              data-action="approve"
            >
              {COPY.approve}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => setRejecting(true)}
              data-action="reject"
            >
              {COPY.reject}
            </button>
          </div>
        ) : null}
      </header>

      {notice ? <AdminActionNotice tone="error" text={notice} /> : null}

      {rejecting ? (
        <form
          className={styles.confirmForm}
          onSubmit={(e) => {
            e.preventDefault()
            void decide('reject', reason.trim() || undefined)
          }}
          data-reject-form
        >
          <p className={styles.confirmText}>{COPY.confirmReject}</p>
          <input
            className={styles.input}
            placeholder={COPY.reasonLabel}
            aria-label={COPY.reasonLabel}
            // Keyboard users land in the form the action button just opened.
            autoFocus
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="submit" className={styles.danger} disabled={busy}>
            {COPY.confirmReject}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setRejecting(false)}>
            Huỷ
          </button>
        </form>
      ) : null}

      <section className={styles.card} data-card="position">
        <h2 className={styles.eyebrow}>{COPY.position}</h2>
        <p className={styles.line}>
          {detail.position.title} — {detail.position.organization.name}
          {detail.position.current ? ` · ${COPY.current}` : ''}
        </p>
        <p className={`${styles.line} ${styles.muted}`}>
          {detail.position.period_from} → {detail.position.period_to ?? 'hiện tại'}
        </p>
      </section>

      <section className={styles.card} data-card="routing">
        <h2 className={styles.eyebrow}>{COPY.routing}</h2>
        <p className={styles.line}>{detail.routed_to.name}</p>
        {detail.fallback ? (
          <p className={`${styles.line} ${styles.muted}`}>{COPY.fallback}</p>
        ) : null}
      </section>

      <section className={styles.card} data-card="context">
        <h2 className={styles.eyebrow}>{COPY.context}</h2>
        {detail.context.memberships.length === 0 && detail.context.leadership.length === 0 ? (
          <p className={`${styles.line} ${styles.muted}`}>{COPY.noContext}</p>
        ) : (
          <>
            {detail.context.memberships.map((m, i) => (
              <p key={`m-${i}`} className={styles.line}>
                Tư cách thành viên: {m.state}
              </p>
            ))}
            {detail.context.leadership.map((l, i) => (
              <p key={`l-${i}`} className={styles.line}>
                Vai trò lãnh đạo: {l.title} ({l.state})
              </p>
            ))}
          </>
        )}
      </section>

      {detail.reject_reason ? (
        <section className={styles.card} data-card="reject-reason">
          <h2 className={styles.eyebrow}>{COPY.rejectReason}</h2>
          <p className={styles.line}>{detail.reject_reason}</p>
        </section>
      ) : null}

      <section className={styles.card} data-card="history">
        <h2 className={styles.eyebrow}>{COPY.history}</h2>
        <ol className={styles.history}>
          {detail.history.map((h, i) => (
            <li key={i} className={styles.historyEntry} data-history-entry>
              <span className={styles.historyWhen}>{adminDateTime(h.at)}</span>
              <span className={styles.historyWhat}>{EVENT_LABELS[h.event] ?? h.event}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
