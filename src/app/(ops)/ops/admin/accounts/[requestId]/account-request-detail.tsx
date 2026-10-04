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
  adminDateTime,
} from '../../shared'

/**
 * ADMIN-PROD-06 — account-request detail (05 §28, A11; PD-7, DEC-ADM-PD7.1).
 * Declining a deletion request (SELF_DELETION or a SOFT_DELETE ESCALATION row)
 * requires a reason stating the legal / retention / security / operational
 * obligation that blocks it (422 `reason: required` otherwise); every other
 * decline keeps the reason optional. No hard-delete button anywhere. Direct
 * LOCK / UNLOCK / DEACTIVATE / REACTIVATE reuse the same confirm idiom and
 * are hidden for the viewer's own account (self-action is refused server-side
 * regardless; the button itself is simply not offered, PD-7).
 */

const COPY = {
  hidden: 'Hồ sơ không công khai',
  process: 'Xử lý',
  decline: 'Từ chối',
  confirmProcess: 'Xác nhận xử lý yêu cầu này?',
  confirmDecline: 'Xác nhận từ chối',
  reasonLabel: 'Lý do (không bắt buộc)',
  reasonRequired: 'Lý do (bắt buộc — nêu nghĩa vụ pháp lý / lưu giữ / an ninh / vận hành)',
  directActions: 'Thao tác trực tiếp trên tài khoản',
  lock: 'Khoá',
  unlock: 'Mở khoá',
  deactivate: 'Vô hiệu hoá',
  reactivate: 'Kích hoạt lại',
  confirmDirect: (label: string) => `Xác nhận ${label.toLowerCase()}?`,
  confirm: 'Xác nhận',
  cancel: 'Huỷ',
  reason: 'Lý do (đã ghi nhận)',
  effectLock: 'Tài khoản bị khoá, không đăng nhập được, mọi phiên đang mở bị kết thúc.',
  effectDeactivate: 'Tài khoản và hồ sơ bị vô hiệu hoá, vai trò tại các đơn vị bị đóng.',
  effectUnlock: 'Tài khoản có thể đăng nhập lại.',
  effectReactivate: 'Tài khoản và hồ sơ trở lại hoạt động; vai trò trước đó không được khôi phục.',
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
const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  BLOCKED: 'Bị khoá',
  DEACTIVATED: 'Đã vô hiệu hoá',
}

type RequestDetail = {
  id: string
  kind: 'ESCALATION' | 'SELF_DELETION'
  action: 'LOCK' | 'DEACTIVATE' | 'SOFT_DELETE'
  status: 'PENDING' | 'PROCESSED' | 'DECLINED'
  target: {
    profile_id: string | null
    display_name: string | null
    account_status: string
    profile_status: string | null
  }
  organization: { id: string; name: string } | null
  reason: string | null
  created_at: string
  handled_at: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; detail: RequestDetail; ownProfileId: string | null }

export function AccountRequestDetail({ requestId }: { requestId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [directing, setDirecting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [detail, session] = await Promise.all([
        apiRequest<RequestDetail>(`/ops/account-requests/${requestId}`),
        apiRequest<{ profile: { id: string } }>('/session'),
      ])
      setState({ kind: 'ready', detail, ownProfileId: session.profile.id || null })
    } catch (error) {
      setState({ kind: 'failed', failure: classifyAdminError(error) })
    }
  }, [requestId])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (decision: 'process' | 'decline', withReason?: string) => {
    if (state.kind !== 'ready') return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/ops/account-requests/${requestId}/${decision}`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: withReason ? { reason: withReason } : {},
      })
      setDeclining(false)
      setReason('')
      await load()
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          fieldReason(error) ??
          'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.',
      })
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const directAction = async (action: 'lock' | 'unlock' | 'deactivate' | 'reactivate') => {
    if (state.kind !== 'ready' || !state.detail.target.profile_id) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/ops/accounts/${state.detail.target.profile_id}/${action}`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      })
      setDirecting(null)
      await load()
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          fieldReason(error) ??
          'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.',
      })
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  if (state.kind !== 'ready') {
    return (
      <div className={styles.page} data-screen="ADMIN-ACCOUNT-REQUEST-DETAIL">
        {state.kind === 'loading' ? (
          <AdminLoading />
        ) : (
          <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
        )}
      </div>
    )
  }

  const { detail, ownProfileId } = state
  const pending = detail.status === 'PENDING'
  const isSelf = ownProfileId !== null && detail.target.profile_id === ownProfileId
  const deletionReasonRequired = detail.action === 'SOFT_DELETE'
  const DIRECT: Array<{
    key: 'lock' | 'unlock' | 'deactivate' | 'reactivate'
    label: string
    effect: string
    when: boolean
  }> = [
    {
      key: 'lock',
      label: COPY.lock,
      effect: COPY.effectLock,
      when: detail.target.account_status === 'ACTIVE',
    },
    {
      key: 'unlock',
      label: COPY.unlock,
      effect: COPY.effectUnlock,
      when: detail.target.account_status === 'BLOCKED',
    },
    {
      key: 'deactivate',
      label: COPY.deactivate,
      effect: COPY.effectDeactivate,
      when: detail.target.account_status !== 'DEACTIVATED',
    },
    {
      key: 'reactivate',
      label: COPY.reactivate,
      effect: COPY.effectReactivate,
      when: detail.target.account_status === 'DEACTIVATED',
    },
  ]

  return (
    <div
      className={styles.page}
      data-screen="ADMIN-ACCOUNT-REQUEST-DETAIL"
      data-status={detail.status}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title} data-target-name>
            {detail.target.display_name ?? COPY.hidden}
          </h1>
          <p className={styles.subtitle}>
            {ACTION_LABELS[detail.action] ?? detail.action} · {KIND_LABELS[detail.kind]} ·{' '}
            {STATUS_LABELS[detail.status]} · gửi {adminDateTime(detail.created_at)}
          </p>
        </div>
        {pending && !isSelf && !declining ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void decide('process')}
              data-action="process"
            >
              {COPY.process}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => setDeclining(true)}
              data-action="decline"
            >
              {COPY.decline}
            </button>
          </div>
        ) : null}
      </header>

      {notice ? <AdminActionNotice tone={notice.tone} text={notice.text} /> : null}

      {declining ? (
        <form
          className={styles.confirmForm}
          onSubmit={(e) => {
            e.preventDefault()
            void decide('decline', reason.trim() || undefined)
          }}
          data-decline-form
        >
          <p className={styles.confirmText}>{COPY.confirmDecline}</p>
          <input
            className={styles.input}
            placeholder={deletionReasonRequired ? COPY.reasonRequired : COPY.reasonLabel}
            aria-label={deletionReasonRequired ? COPY.reasonRequired : COPY.reasonLabel}
            // Keyboard users land in the form the action button just opened.
            autoFocus
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-field="reason"
          />
          <button
            type="submit"
            className={styles.danger}
            disabled={busy || (deletionReasonRequired && !reason.trim())}
          >
            {COPY.confirmDecline}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setDeclining(false)}>
            {COPY.cancel}
          </button>
        </form>
      ) : null}

      <section className={styles.card} data-card="target">
        <h2 className={styles.eyebrow}>Đối tượng</h2>
        <p className={styles.line}>
          Tài khoản:{' '}
          {ACCOUNT_STATUS_LABELS[detail.target.account_status] ?? detail.target.account_status}
        </p>
        {detail.organization ? (
          <p className={`${styles.line} ${styles.muted}`}>Đề nghị từ: {detail.organization.name}</p>
        ) : null}
        {detail.reason ? (
          <p className={`${styles.line} ${styles.muted}`}>
            {COPY.reason}: {detail.reason}
          </p>
        ) : null}
      </section>

      {detail.target.profile_id && !isSelf ? (
        <section className={styles.card} data-card="direct-actions">
          <h2 className={styles.eyebrow}>{COPY.directActions}</h2>
          <div className={styles.actions}>
            {DIRECT.filter((d) => d.when).map((d) => (
              <button
                key={d.key}
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={() => setDirecting(d.key)}
                data-action={`direct-${d.key}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {directing ? (
            <div className={styles.confirmForm} data-direct-confirm={directing}>
              <p className={styles.confirmText}>
                {COPY.confirmDirect(DIRECT.find((d) => d.key === directing)?.label ?? directing)}{' '}
                {DIRECT.find((d) => d.key === directing)?.effect}
              </p>
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={() =>
                  void directAction(directing as 'lock' | 'unlock' | 'deactivate' | 'reactivate')
                }
              >
                {COPY.confirm}
              </button>
              {/* Focus the safe choice, so a stray Enter never executes the action. */}
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setDirecting(null)}
                autoFocus
              >
                {COPY.cancel}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
