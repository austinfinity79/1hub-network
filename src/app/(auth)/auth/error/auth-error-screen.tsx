'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AuthCard } from '@/components/shell/auth-card'

import styles from './auth-error.module.css'

/**
 * WF01-S04 — auth errors (DEC-WF01-S04-D1..D8 in docs/decisions/DECISION_LOG.md).
 *
 * - The state comes from an ALLOWLISTED public code, `?reason=<code>` (D1).
 *   Only the codes below render; anything else, or nothing, is GENERIC. The
 *   query value itself is never rendered or echoed.
 * - Runtime states are BLOCKED, SESSION_EXPIRED and GENERIC. Rate limiting
 *   stays inline on WF01-S01/S02 (D3); mail blocked by domain is out of P0 (D7).
 * - The page is static and reads the query only in the browser, so no query
 *   value (a token pasted by mistake included) reaches server-rendered HTML.
 */

export type PublicReason = 'blocked' | 'session_expired' | 'generic'

/** The allowlist. Keys are the only accepted public reason codes. */
const PUBLIC_REASONS: Record<string, PublicReason> = {
  blocked: 'blocked',
  session_expired: 'session_expired',
  generic: 'generic',
}

export function publicReason(raw: string | null): PublicReason {
  return (raw !== null && Object.hasOwn(PUBLIC_REASONS, raw) && PUBLIC_REASONS[raw]) || 'generic'
}

type Props = {
  /** From the session lifetime setting, so the copy cannot drift from it. */
  sessionDays: number
}

export function AuthErrorScreen({ sessionDays }: Props) {
  // Null until the query is read, so no state flashes before the right one.
  const [reason, setReason] = useState<PublicReason | null>(null)

  useEffect(() => {
    setReason(publicReason(new URL(window.location.href).searchParams.get('reason')))
  }, [])

  return (
    <div className={styles.canvas}>
      {reason ? (
        <AuthCard>
          {reason === 'blocked' ? <Blocked /> : null}
          {reason === 'session_expired' ? <SessionExpired days={sessionDays} /> : null}
          {reason === 'generic' ? <Generic /> : null}
        </AuthCard>
      ) : null}
    </div>
  )
}

function Disc() {
  return (
    <div className={styles.disc} aria-hidden="true">
      <svg viewBox="0 0 4 12">
        <path d="M.4 1h2.5v7H.4zM.4 9h2.5v2.6H.4z" fill="currentColor" />
      </svg>
    </div>
  )
}

/**
 * R2. Board date dropped (D4, no data source); no support address invented (D5).
 * The board's "reason is in the HUB email" sentence is replaced: no email
 * delivery exists in P0, so nothing may promise one.
 */
function Blocked() {
  return (
    <div className={styles.state} data-auth-error="blocked" role="alert">
      <Disc />
      <h1 className={`type-section-sm ${styles.title}`}>Tài khoản đang bị khoá</h1>
      <p className={`type-body-sm ${styles.body}`}>
        Tài khoản này đang bị tạm khoá, nên hiện chưa thể đăng nhập.
      </p>
      <p className={`type-meta-xs ${styles.support}`}>Liên hệ ban điều hành HUB để được hỗ trợ.</p>
    </div>
  )
}

/** R3. "30 ngày" comes from the session lifetime setting (provisional, pre-UAT). */
function SessionExpired({ days }: { days: number }) {
  return (
    <div className={styles.state} data-auth-error="session_expired" role="alert">
      <Disc />
      <h1 className={`type-section-sm ${styles.title}`}>Phiên đăng nhập đã hết</h1>
      <p className={`type-body-sm ${styles.body}`}>
        Bạn đã đăng nhập ở đây {days} ngày trước. Vì an toàn, cần xác thực lại.
      </p>
      <Link href="/auth" className={`type-body-sm weight-medium ${styles.action}`}>
        Đăng nhập lại
      </Link>
    </div>
  )
}

/**
 * No approved board panel exists (DESIGN-GAP-GENERIC, D2). Neutral and
 * non-enumerating: it names no account, link, provider or internal reason.
 */
function Generic() {
  return (
    <div className={styles.state} data-auth-error="generic" role="alert">
      <Disc />
      <h1 className={`type-section-sm ${styles.title}`}>Chưa đăng nhập được</h1>
      <p className={`type-body-sm ${styles.body}`}>
        Đã có lỗi trong lúc đăng nhập. Hãy thử lại từ đầu.
      </p>
      <Link href="/auth" className={`type-body-sm weight-medium ${styles.action}`}>
        Đăng nhập lại
      </Link>
    </div>
  )
}
