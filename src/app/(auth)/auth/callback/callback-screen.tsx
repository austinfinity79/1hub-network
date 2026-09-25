'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AuthCard } from '@/components/shell/auth-card'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'

import styles from './callback.module.css'

/**
 * WF01-S03 — auth callback. Consumes the magic-link token once and shows ONE
 * of the three approved states (decisions D1–D7 in
 * docs/implementation/WF01_S03_STATE_BOARD_MAPPING.md).
 *
 * - The link is /auth/callback?token=<opaque> (D7). The token is read from the
 *   address bar and removed from it BEFORE the request is sent, is never
 *   stored, logged or rendered, and the page sends no Referer (page metadata).
 * - SUCCESS shows briefly while navigating to onboarding or the account home.
 * - EXPIRED and USED are recorded as ?status=expired|used, so a refresh keeps
 *   the state without the token. The page is static and reads the query only
 *   in the browser, so the token never appears in server-rendered HTML. Their action returns to /auth for a fresh request (D1);
 *   no resend is attempted from a spent token.
 * - INVALID, a missing token, a blocked account and any other failure go to
 *   /auth/error, owned by WF01-S04 (D3). No reason is passed along.
 * - While consuming, only a screen-reader status is rendered (D4).
 */

export type TerminalStatus = 'expired' | 'used'
type State = 'processing' | 'success' | TerminalStatus

type ConsumeResponse = {
  result: 'SUCCESS'
  account_created: boolean
  onboarding: { completed: boolean; next_step: string | null }
}

/** WF01 onboarding steps (WF01-S05..S07) as the consume response names them. */
const ONBOARDING_ROUTES: Record<string, string> = {
  PURPOSE: '/onboarding/purpose',
  PROFILE: '/onboarding/profile',
  PRIVACY: '/onboarding/privacy',
}

function nextRoute(onboarding: ConsumeResponse['onboarding']): string {
  if (onboarding.completed) return '/me'
  return ONBOARDING_ROUTES[onboarding.next_step ?? ''] ?? '/onboarding/purpose'
}

type Props = {
  /** From the frozen magic-link expiry, so the copy cannot drift from the server. */
  expiresInMinutes: number
}

/** Reads the non-secret terminal status the page itself put in the URL. */
function terminalStatus(params: URLSearchParams): TerminalStatus | null {
  const value = params.get('status')
  return value === 'expired' || value === 'used' ? value : null
}

export function CallbackScreen({ expiresInMinutes }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('processing')
  // Guards against a second consume, e.g. React re-running the effect.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const params = new URL(window.location.href).searchParams
    const token = params.get('token')
    const status = terminalStatus(params)
    // Strip the token from the address bar and history before anything else.
    window.history.replaceState(
      null,
      '',
      status ? `/auth/callback?status=${status}` : '/auth/callback',
    )

    // A refreshed terminal state needs no token.
    if (status && !token) {
      setState(status)
      return
    }
    if (!token) {
      router.replace('/auth/error')
      return
    }

    apiRequest<ConsumeResponse>('/auth/magic-link/consume', { method: 'POST', body: { token } })
      .then((res) => {
        setState('success')
        router.replace(nextRoute(res.onboarding))
      })
      .catch((error: unknown) => {
        const code = isApiError(error) ? error.code : undefined
        // Terminal states stay on this page; the URL records them for refresh.
        const terminal: TerminalStatus | null =
          code === 'AUTH_LINK_EXPIRED'
            ? 'expired'
            : code === 'AUTH_LINK_ALREADY_USED'
              ? 'used'
              : null
        if (terminal) {
          window.history.replaceState(null, '', `/auth/callback?status=${terminal}`)
          setState(terminal)
        } else {
          router.replace('/auth/error')
        }
      })
  }, [router])

  return (
    <div className={`${styles.root} ${styles.canvas}`}>
      {state === 'processing' ? (
        <p role="status" className={styles.srOnly}>
          Đang kiểm tra link đăng nhập…
        </p>
      ) : (
        <AuthCard>
          {state === 'success' ? <Success /> : null}
          {state === 'expired' ? <Expired minutes={expiresInMinutes} /> : null}
          {state === 'used' ? <Used /> : null}
        </AuthCard>
      )}
    </div>
  )
}

function Success() {
  return (
    <div className={styles.state} data-callback-state="success">
      <div className={`${styles.disc} ${styles.discSuccess}`} aria-hidden="true">
        <svg viewBox="0 0 28 28">
          <path d="M6 15.5 11.5 21 22.5 7" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </div>
      <h1 className={`type-subtitle ${styles.title}`}>Đăng nhập được</h1>
      <p className={`type-body-sm ${styles.body}`}>
        Chuyển thẳng tới Onboarding nếu hồ sơ chưa xong, tới Tài khoản của tôi nếu đã xong.
      </p>
      <span
        role="status"
        className={`type-body-sm weight-semibold ${styles.action} ${styles.actionWide} ${styles.actionMuted}`}
      >
        Đang chuyển…
      </span>
    </div>
  )
}

function Expired({ minutes }: { minutes: number }) {
  return (
    <div className={styles.state} data-callback-state="expired">
      <div className={`${styles.disc} ${styles.discExpired}`} aria-hidden="true">
        <svg viewBox="0 0 28 28">
          <circle cx="14" cy="16.5" r="10" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12.5 2.5h3M14 3.5V6M21.5 8l2-2M14 16.5v-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      </div>
      <h1 className={`type-subtitle ${styles.title}`}>Link đã hết hạn</h1>
      <p className={`type-body-sm ${styles.body}`}>
        Link chỉ sống {minutes} phút. Không coi đây là lỗi của người dùng — nút gửi lại phải ở ngay
        đây, không bắt quay lại trang đăng nhập.
      </p>
      <Link
        href="/auth"
        className={`type-body-sm weight-semibold ${styles.action} ${styles.actionPrimary}`}
      >
        Gửi link mới
      </Link>
    </div>
  )
}

function Used() {
  return (
    <div className={styles.state} data-callback-state="used">
      <div className={`${styles.disc} ${styles.discUsed}`} aria-hidden="true">
        <svg viewBox="0 0 28 28">
          <path
            d="M6.2 8.2A11 11 0 1 0 21.8 8.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
          />
          <path d="M18 5.5 25.5 5 24.5 12.5z" fill="currentColor" />
        </svg>
      </div>
      <h1 className={`type-subtitle ${styles.title}`}>Link đã dùng rồi</h1>
      <p className={`type-body-sm ${styles.body}`}>
        Mỗi link dùng một lần. Thường gặp khi người dùng bấm lại link cũ trong mail hoặc mở trên máy
        khác.
      </p>
      <Link
        href="/auth"
        className={`type-body-sm weight-semibold ${styles.action} ${styles.actionMuted}`}
      >
        Gửi link mới
      </Link>
    </div>
  )
}
