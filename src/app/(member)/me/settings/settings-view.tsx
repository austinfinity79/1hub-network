'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Button, Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { SessionDTO as AppSession } from '@/lib/api/types'
import type { DeletionRequestDTO, SessionDTO } from '@/lib/account/settings'

import {
  currentStatus,
  missingDocuments,
  type Consent,
  type LegalDoc,
} from '../privacy/privacy-model'
import styles from './settings.module.css'

/**
 * WF02-S07 — /me/settings as the corrected L11 ME0 overview (TASK 22.3,
 * DEC-L2-D1): summary rows over what P0 already does, inside the member shell.
 * Decisions DEC-WF02-H8, DEC-WF02-S07-G1..G6, DEC-WF02-S07-D1..D3 still hold.
 *
 * Rows: the login email (read-only), the sessions (revoke one, revoke all,
 * opened in place), the discovery visibility and the Terms / Privacy status
 * (both changed on /me/privacy, the existing WF02-S03 screen), and the
 * account-deletion REQUEST behind a confirmation. Not rendered (Bucket B /
 * Future): email change, Google link, HUB tags, public URL, "view as",
 * purpose consents, viewer statistics, personal log, export, email
 * preferences, invitations and organisations, ownership transfer.
 */

type Loaded<T> = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; value: T }
type Level = 'NETWORK_ONLY' | 'PRIVATE'
type VisibilityDTO = { groups: { group_code: string; level: string }[] }

/** Copy the reference does not carry verbatim; pending PO copy review (DEC-WF02-S07-D2). */
const COPY = {
  title: 'Cài đặt',
  lede: 'Mọi thứ điều chỉnh hồ sơ của bạn nằm ở đây.',
  account: 'TÀI KHOẢN & ĐĂNG NHẬP',
  email: 'Email đăng nhập',
  verified: 'đã xác thực',
  sessions: 'Phiên đăng nhập',
  sessionCount: 'phiên đang hoạt động',
  show: 'Xem',
  hide: 'Thu gọn',
  logoutAll: 'Đăng xuất khỏi mọi thiết bị',
  current: 'Hiện tại',
  currentTitle: 'Phiên này',
  otherTitle: 'Phiên đăng nhập',
  logout: 'Đăng xuất',
  started: 'bắt đầu',
  expires: 'hết hạn',
  profile: 'HIỂN THỊ HỒ SƠ',
  discovery: 'Thẻ của tôi trong Thư viện',
  shown: 'đang hiện · chỉ thành viên mạng lưới thấy',
  hidden: 'đang ẩn',
  change: 'Đổi',
  data: 'QUYỀN RIÊNG TƯ DỮ LIỆU',
  consent: 'Điều khoản & lịch sử đồng ý',
  consentOk: 'đã đồng ý phiên bản hiện hành',
  consentNew: 'có phiên bản mới cần đồng ý',
  view: 'Xem',
  loading: 'Đang tải…',
  loadFailed: 'Không tải được dữ liệu.',
  sessionsFailed: 'Không tải được phiên đăng nhập.',
  retry: 'Thử lại',
  actionFailed: 'Chưa thực hiện được. Vui lòng thử lại.',
  close: 'ĐÓNG TÀI KHOẢN',
  request: 'Yêu cầu xoá tài khoản',
  send: 'Gửi yêu cầu',
  dangerBody:
    'Bạn có thể gửi yêu cầu xoá tài khoản. Tài khoản chưa bị xoá ngay khi gửi: yêu cầu được ghi nhận để xử lý, và bạn vẫn đăng nhập, dùng hồ sơ như bình thường.',
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

const Arrow = () => <span aria-hidden="true"> →</span>

function Card({ card, eyebrow, children }: { card: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className={styles.card} data-card={card}>
      <h2 className={styles.eyebrow}>{eyebrow}</h2>
      {children}
    </section>
  )
}

function Row({
  title,
  summary,
  action,
  children,
  ...rest
}: {
  title: string
  summary: ReactNode
  action?: ReactNode
  children?: ReactNode
} & Record<`data-${string}`, string | undefined> & { 'aria-busy'?: boolean }) {
  return (
    <div className={styles.row} {...rest}>
      <div className={styles.rowHead}>
        <div>
          <p className={styles.rowTitle}>{title}</p>
          <div className={styles.rowSummary}>{summary}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Loaded<T>>({ kind: 'loading' })
  const run = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', value: await load() })
    } catch {
      setState({ kind: 'failed' })
    }
  }, [load])
  useEffect(() => {
    void run()
  }, [run])
  return [state, run] as const
}

const loadVisibility = async (): Promise<Level> => {
  const dto = await apiRequest<VisibilityDTO>('/me/visibility')
  const level = dto.groups.find((g) => g.group_code === 'PROFILE_DISCOVERY')?.level
  return level === 'PRIVATE' ? 'PRIVATE' : 'NETWORK_ONLY'
}

const loadConsent = async (): Promise<boolean> => {
  const [current, consents] = await Promise.all([
    apiRequest<{ documents: LegalDoc[] }>('/legal/current'),
    apiRequest<{ items: Consent[] }>('/me/consents'),
  ])
  return missingDocuments(currentStatus(current.documents, consents.items)).length === 0
}

export function SettingsView({ initialRequest }: { initialRequest: DeletionRequestDTO | null }) {
  const [email, setEmail] = useState('')
  const [sessions, setSessions] = useState<Loaded<SessionDTO[]>>({ kind: 'loading' })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string>()
  const [sessionError, setSessionError] = useState(false)
  const [visibility] = useLoad(loadVisibility)
  const [consent] = useLoad(loadConsent)
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
      setSessions({ kind: 'ready', value: list.items })
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

  const summaryOf = <T,>(state: Loaded<T>, ready: (value: T) => string) =>
    state.kind === 'ready'
      ? ready(state.value)
      : state.kind === 'failed'
        ? COPY.loadFailed
        : COPY.loading

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{COPY.title}</h1>
      <p className={styles.lede}>{COPY.lede}</p>

      <Card card="account" eyebrow={COPY.account}>
        <Row
          data-card="login"
          title={COPY.email}
          summary={
            <>
              <span data-email>{email}</span>
              {email ? ` · ${COPY.verified}` : null}
            </>
          }
        />
        <Row
          data-card="sessions"
          aria-busy={sessions.kind === 'loading'}
          title={COPY.sessions}
          summary={
            sessions.kind === 'failed' ? (
              <span className={styles.failed} role="alert" data-state="sessions-failed">
                {COPY.sessionsFailed}{' '}
                <button type="button" className={styles.inlineAction} onClick={loadSessions}>
                  {COPY.retry}
                </button>
              </span>
            ) : (
              summaryOf(sessions, (items) => `${items.length} ${COPY.sessionCount}`)
            )
          }
          action={
            <button
              type="button"
              className={styles.action}
              aria-expanded={open}
              aria-controls="settings-sessions"
              disabled={sessions.kind !== 'ready'}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? COPY.hide : COPY.show}
              {open ? null : <Arrow />}
            </button>
          }
        >
          {open && sessions.kind === 'ready' ? (
            <div id="settings-sessions" className={styles.detail}>
              <ul className={styles.list}>
                {sessions.value.map((item) => (
                  <li
                    key={item.id}
                    className={styles.session}
                    data-session={item.current ? 'current' : 'other'}
                  >
                    <div>
                      <p className={styles.sessionTitle}>
                        {item.current ? COPY.currentTitle : COPY.otherTitle}
                      </p>
                      <p className={styles.rowSummary}>
                        {COPY.started} {DATE_TIME.format(new Date(item.created_at))} ·{' '}
                        {COPY.expires} {DATE.format(new Date(item.expires_at))}
                      </p>
                    </div>
                    {item.current ? (
                      <span className={styles.pill}>{COPY.current}</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.outline}
                        disabled={Boolean(busy)}
                        onClick={() => revoke(item)}
                      >
                        {COPY.logout}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.action}
                disabled={Boolean(busy)}
                onClick={revokeAll}
              >
                {COPY.logoutAll}
              </button>
            </div>
          ) : null}
          {sessionError ? (
            <div className={styles.notice}>
              <Notice tone="error">{COPY.actionFailed}</Notice>
            </div>
          ) : null}
        </Row>
      </Card>

      <Card card="visibility" eyebrow={COPY.profile}>
        <Row
          data-visibility={visibility.kind === 'ready' ? visibility.value : undefined}
          title={COPY.discovery}
          summary={summaryOf(visibility, (level) =>
            level === 'PRIVATE' ? COPY.hidden : COPY.shown,
          )}
          action={
            <Link href="/me/privacy" className={styles.action} data-nav="settings-privacy">
              {COPY.change}
              <Arrow />
            </Link>
          }
        />
      </Card>

      <Card card="consent" eyebrow={COPY.data}>
        <Row
          title={COPY.consent}
          summary={summaryOf(consent, (ok) => (ok ? COPY.consentOk : COPY.consentNew))}
          action={
            <Link href="/me/privacy" className={styles.action} data-nav="settings-consent">
              {COPY.view}
              <Arrow />
            </Link>
          }
        />
      </Card>

      <Card card="danger" eyebrow={COPY.close}>
        {request ? (
          <Row
            data-state="deletion-requested"
            title={COPY.request}
            summary={
              <>
                <p className={styles.dangerText}>
                  {COPY.received} {DATE_TIME.format(new Date(request.requested_at))}.
                </p>
                <p>{COPY.receivedNote}</p>
              </>
            }
          />
        ) : (
          <Row
            title={COPY.request}
            summary={COPY.dangerBody}
            action={
              confirming ? null : (
                <button type="button" className={styles.action} onClick={() => setConfirming(true)}>
                  {COPY.send}
                  <Arrow />
                </button>
              )
            }
          >
            {confirming ? (
              <div className={styles.confirm} role="group" aria-label={COPY.confirm}>
                <p className={styles.confirmText}>{COPY.confirm}</p>
                <div className={styles.confirmActions}>
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
            ) : null}
            {requestError ? (
              <div className={styles.notice}>
                <Notice tone="error">{COPY.requestFailed}</Notice>
              </div>
            ) : null}
          </Row>
        )}
      </Card>
    </div>
  )
}
