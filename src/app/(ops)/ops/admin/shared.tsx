'use client'

import { useCallback, useRef } from 'react'

import styles from './admin.module.css'

/**
 * ADMIN-PROD-06 — pieces shared by every `/ops/admin/*` queue and detail
 * screen: the states section 20/5 requires (loading, empty, permission,
 * controlled error — never a raw status code, a stack or a blank screen) and
 * the Vietnam-time formatters the admin APIs' ISO timestamps need. No pixel
 * baseline exists for these screens (ADMIN-PROD-08 owns pixel QA); the visual
 * language is the existing OpsShell / WF03 vocabulary (cards, chips, the
 * inline confirm-form), not a new design system (PD-8).
 */

export const ADMIN_COPY = {
  loading: 'Đang tải…',
  denied: 'Bạn không có quyền với mục này',
  notFound: 'Không tìm thấy hoặc ngoài phạm vi',
  failed: 'Không tải được dữ liệu.',
  actionFailed: 'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.',
  conflict: 'Mục này vừa thay đổi. Đã tải lại trạng thái mới nhất.',
  retry: 'Thử lại',
  reload: 'Tải lại',
  confirm: 'Xác nhận',
  cancel: 'Huỷ',
  reasonRequired: 'Cần nhập lý do.',
  reasonOptional: 'Lý do (không bắt buộc)',
  sessionExpired: 'Phiên đăng nhập đã hết hạn.',
  signInAgain: 'Đăng nhập lại',
} as const

/** Every list/detail fetch collapses to one of these; never a raw status or stack. */
export type AdminFailure = 'denied' | 'not_found' | 'failed'

type ApiLikeError = { status?: number; code?: string; fields?: Record<string, string> }

function isApiLikeError(value: unknown): value is ApiLikeError {
  return typeof value === 'object' && value !== null
}

/**
 * Classifies a thrown error for display. A 401 is the one case the admin area
 * does not render inline (the existing session-expired flow: back to sign-in).
 */
export function classifyAdminError(error: unknown): AdminFailure | 'expired' {
  const e = isApiLikeError(error) ? error : {}
  if (e.status === 401) return 'expired'
  if (e.status === 403) return 'denied'
  if (e.status === 404) return 'not_found'
  return 'failed'
}

export function fieldReason(error: unknown): string | undefined {
  const e = isApiLikeError(error) ? error : {}
  return e.fields ? Object.values(e.fields)[0] : undefined
}

export function isConflict(error: unknown): boolean {
  const e = isApiLikeError(error) ? error : {}
  return e.code === 'MEMBERSHIP_INVALID_TRANSITION'
}

/** The zone every admin screen's dates are shown in; the API already answers in it. */
const ZONE = 'Asia/Ho_Chi_Minh'

export function adminDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}

export function adminDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

/** A 401 mid-session: the existing sign-in flow, never a blank or broken screen. */
export function SessionExpired() {
  return (
    <div className={styles.notice} role="alert" data-state="session-expired">
      <p className="type-body-sm">{ADMIN_COPY.sessionExpired}</p>
      <a href="/auth" className={styles.retry}>
        {ADMIN_COPY.signInAgain}
      </a>
    </div>
  )
}

/** The one failure block for a list or detail load: denied / not-found / failed, with retry. */
export function AdminFailureNotice({
  failure,
  onRetry,
}: {
  failure: AdminFailure
  onRetry: () => void
}) {
  const text =
    failure === 'denied'
      ? ADMIN_COPY.denied
      : failure === 'not_found'
        ? ADMIN_COPY.notFound
        : ADMIN_COPY.failed
  return (
    <div className={styles.notice} role="alert" data-state={`load-${failure}`}>
      <p className="type-body-sm">{text}</p>
      {failure === 'failed' ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {ADMIN_COPY.retry}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Every list/detail load's failure branch in one call: a 401 is the sign-in
 * flow, everything else is `AdminFailureNotice`. Takes the full
 * `classifyAdminError` result, so callers never re-narrow it themselves.
 */
export function AdminLoadFailure({
  failure,
  onRetry,
}: {
  failure: AdminFailure | 'expired'
  onRetry: () => void
}) {
  return failure === 'expired' ? (
    <SessionExpired />
  ) : (
    <AdminFailureNotice failure={failure} onRetry={onRetry} />
  )
}

export function AdminLoading({ label = ADMIN_COPY.loading }: { label?: string }) {
  return (
    <p className={`type-body-sm ${styles.loading}`} data-state="loading" aria-busy="true">
      {label}
    </p>
  )
}

export function AdminEmpty({ label }: { label: string }) {
  return (
    <p className={`type-body-sm ${styles.empty}`} data-state="empty">
      {label}
    </p>
  )
}

/**
 * Guards a filter/tab change mid-flight: a slower response for a load the
 * viewer has since moved on from must never overwrite the current one's data
 * (no stale data). `begin()` stamps a load as it starts; `isCurrent(token)`
 * tells the resolved callback whether it is still the latest one to apply.
 */
export function useRequestGuard() {
  const seq = useRef(0)
  const begin = useCallback(() => ++seq.current, [])
  const isCurrent = useCallback((token: number) => seq.current === token, [])
  return { begin, isCurrent }
}

export function AdminActionNotice({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  return (
    <p
      className={`${styles.actionNotice} ${tone === 'ok' ? styles.actionOk : styles.actionError}`}
      role={tone === 'ok' ? 'status' : 'alert'}
      data-state={tone === 'ok' ? 'action-ok' : 'action-failed'}
    >
      {text}
    </p>
  )
}
