'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { SessionDTO as AppSession } from '@/lib/api/types'
import type { DeletionRequestDTO, SessionDTO } from '@/lib/account/settings'

import styles from './settings.module.css'

/**
 * WF02-S07 — Account Settings body (/me/settings), inside the member shell.
 * Approved baseline: design-reference/final/WF02/WF02-S07__account-settings__1440x900.png
 * Decisions DEC-WF02-H8, DEC-WF02-S07-G1..G6, DEC-WF02-S07-D1..D3.
 *
 * P0 (H8): the login email (read-only), the session list with revoke-one and
 * revoke-all, and the account-deletion REQUEST behind a confirmation. Email
 * change, Google linking, notification preferences and ownership transfer
 * are Future and not rendered. Sessions show only stored data.
 */

type SessionsState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; items: SessionDTO[] }

/** Copy the approved bitmap does not carry verbatim; pending PO copy review (DEC-WF02-S07-D2). */
const COPY = {
  loginMethod: 'Email đăng nhập · đã xác thực',
  passwordless:
    'Không có mật khẩu nào để đổi hay để quên. Mỗi lần đăng nhập là một link dùng một lần, hết hạn sau 15 phút.',
  logoutAll: 'Đăng xuất khỏi mọi thiết bị',
  current: 'Hiện tại',
  currentTitle: 'Phiên này',
  otherTitle: 'Phiên đăng nhập',
  logout: 'Đăng xuất',
  started: 'bắt đầu',
  expires: 'hết hạn',
  loadFailed: 'Không tải được phiên đăng nhập.',
  retry: 'Thử lại',
  actionFailed: 'Chưa thực hiện được. Vui lòng thử lại.',
  dangerBody:
    'Bạn có thể gửi yêu cầu xoá tài khoản. Tài khoản chưa bị xoá ngay khi gửi: yêu cầu được ghi nhận để xử lý, và bạn vẫn đăng nhập, dùng hồ sơ như bình thường.',
  request: 'Yêu cầu xoá tài khoản',
  confirm: 'Bạn chắc chắn muốn gửi yêu cầu xoá tài khoản?',
  confirmYes: 'Xác nhận gửi yêu cầu',
  confirmNo: 'Huỷ',
  received: 'Đã nhận yêu cầu xoá tài khoản lúc',
  receivedNote: 'Tài khoản của bạn vẫn hoạt động; yêu cầu không xoá dữ liệu nào ngay lập tức.',
  requestFailed: 'Chưa gửi được yêu cầu. Vui lòng thử lại.',
} as const

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function SettingsView({ initialRequest }: { initialRequest: DeletionRequestDTO | null }) {
  const [email, setEmail] = useState('')
  const [sessions, setSessions] = useState<SessionsState>({ kind: 'loading' })
  const [busy, setBusy] = useState<string>()
  const [sessionError, setSessionError] = useState(false)
  const [request, setRequest] = useState(initialRequest)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [requestError, setRequestError] = useState(false)
  const inFlight = useRef(false)

  const loadSessions = useCallback(async () => {
    setSessions({ kind: 'loading' })
    try {
      const [session, list] = await Promise.all([
        apiRequest<AppSession>('/session'),
        apiRequest<{ items: SessionDTO[] }>('/me/sessions'),
      ])
      if (session.authenticated) setEmail(session.account.email)
      setSessions({ kind: 'ready', items: list.items })
    } catch {
      setSessions({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  /** After this browser's own session ends, the server has already cleared the cookie. */
  const signedOut = () => window.location.assign('/auth')

  async function revoke(item: SessionDTO) {
    if (busy) return
    setBusy(item.id)
    setSessionError(false)
    try {
      await apiRequest(`/me/sessions/${item.id}`, { method: 'DELETE' })
      if (item.current) return signedOut()
    } catch (caught) {
      // A session that vanished meanwhile is simply refreshed away.
      if ((caught as { status?: number } | null)?.status !== 404) setSessionError(true)
    }
    setBusy(undefined)
    await loadSessions()
  }

  async function revokeAll() {
    if (busy) return
    setBusy('all')
    setSessionError(false)
    try {
      await apiRequest('/me/sessions', { method: 'DELETE' })
      return signedOut()
    } catch {
      setSessionError(true)
      setBusy(undefined)
    }
  }

  async function submitRequest() {
    if (inFlight.current) return
    inFlight.current = true
    setSending(true)
    setRequestError(false)
    try {
      setRequest(
        await apiRequest<DeletionRequestDTO>('/me/account-deletion-request', { method: 'POST' }),
      )
      setConfirming(false)
    } catch {
      setRequestError(true)
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={`type-heading-2 ${styles.title}`}>Cài đặt tài khoản</h1>

      <div className={styles.card} data-card="login">
        <Surface as="section">
          <h2 className={`weight-semibold ${styles.eyebrow}`}>ĐĂNG NHẬP</h2>
          <div className={styles.row}>
            <div>
              <p className={`type-body-md ${styles.rowTitle}`} data-email>
                {email}
              </p>
              <p className={`type-meta-xs ${styles.muted}`}>{COPY.loginMethod}</p>
            </div>
          </div>
          <p className={`type-meta-xs ${styles.note}`}>{COPY.passwordless}</p>
        </Surface>
      </div>

      <div className={styles.card} data-card="sessions" aria-busy={sessions.kind === 'loading'}>
        <Surface as="section">
          <div className={styles.headRow}>
            <h2 className={`weight-semibold ${styles.eyebrow}`}>PHIÊN ĐĂNG NHẬP</h2>
            <button
              type="button"
              className={`type-body-sm weight-medium ${styles.link}`}
              disabled={sessions.kind !== 'ready' || Boolean(busy)}
              onClick={revokeAll}
            >
              {COPY.logoutAll}
            </button>
          </div>
          {sessions.kind === 'failed' ? (
            <div className={styles.failed} role="alert" data-state="sessions-failed">
              <p className="type-body-sm">{COPY.loadFailed}</p>
              <button
                type="button"
                className={`type-body-sm ${styles.retry}`}
                onClick={loadSessions}
              >
                {COPY.retry}
              </button>
            </div>
          ) : (
            <ul className={styles.list}>
              {(sessions.kind === 'ready' ? sessions.items : []).map((item) => (
                <li
                  key={item.id}
                  className={styles.row}
                  data-session={item.current ? 'current' : 'other'}
                >
                  <div>
                    <p className={`type-body-md ${styles.rowTitle}`}>
                      {item.current ? COPY.currentTitle : COPY.otherTitle}
                    </p>
                    <p className={`type-meta-xs ${styles.muted}`}>
                      {COPY.started} {DATE_TIME.format(new Date(item.created_at))} · {COPY.expires}{' '}
                      {DATE.format(new Date(item.expires_at))}
                    </p>
                  </div>
                  {item.current ? (
                    <span className={`weight-medium ${styles.pill}`}>{COPY.current}</span>
                  ) : (
                    <button
                      type="button"
                      className={`type-body-sm weight-medium ${styles.outline}`}
                      disabled={Boolean(busy)}
                      onClick={() => revoke(item)}
                    >
                      {COPY.logout}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sessionError ? (
            <div className={styles.notice}>
              <Notice tone="error">{COPY.actionFailed}</Notice>
            </div>
          ) : null}
        </Surface>
      </div>

      <section className={styles.danger} data-card="danger">
        <h2 className={`weight-semibold ${styles.eyebrow}`}>VÙNG NGUY HIỂM</h2>
        {request ? (
          <div data-state="deletion-requested">
            <p className={`type-body-sm weight-medium ${styles.dangerText}`}>
              {COPY.received} {DATE_TIME.format(new Date(request.requested_at))}.
            </p>
            <p className={`type-body-sm ${styles.muted}`}>{COPY.receivedNote}</p>
          </div>
        ) : (
          <>
            <p className={`type-body-sm ${styles.dangerText}`}>{COPY.dangerBody}</p>
            {confirming ? (
              <div className={styles.confirm} role="group" aria-label={COPY.confirm}>
                <p className={`type-body-md weight-medium ${styles.confirmText}`}>{COPY.confirm}</p>
                <div className={styles.actions}>
                  <Button loading={sending} onClick={submitRequest}>
                    {COPY.confirmYes}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={sending}
                    onClick={() => setConfirming(false)}
                  >
                    {COPY.confirmNo}
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setConfirming(true)}>
                  {COPY.request}
                </Button>
              </div>
            )}
            {requestError ? (
              <div className={styles.notice}>
                <Notice tone="error">{COPY.requestFailed}</Notice>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
