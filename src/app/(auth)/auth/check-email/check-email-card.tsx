'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AuthCard } from '@/components/shell/auth-card'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import {
  readPendingRequest,
  savePendingRequest,
  type MagicLinkRequestAccepted,
} from '@/lib/auth/pending-request'

import styles from './check-email.module.css'

/**
 * WF01-S02 / AUTH2 — check email, presented per the corrected L1 reference
 * (TASK 22.2, DEC-L1-D4). Reads the AuthRequest handed over by WF01-S01 and
 * offers the two contract actions: resend and change_email.
 *
 * - The address shown is the server's `email_masked`; the raw address and the
 *   magic-link token never reach the browser.
 * - The resend countdown uses the server's `resend_after_seconds`; no duration
 *   is invented here.
 * - Without a pending request (direct entry, other tab) the screen returns to
 *   WF01-S01, since there is nothing to confirm or resend.
 * - The reference's "Mở Gmail" button is NOT rendered: it is not a WF01-S02
 *   contract action (resend, change_email).
 * - S1-UAT-01: the same screen confirms the forgot-password e-mail (US-01.04
 *   step 3, `kind: 'reset'`): its copy names the reset link, resend goes to
 *   POST /auth/password/forgot/resend after the server's 45 s, and "change"
 *   returns to the forgot view. When the request named a username, no address
 *   is shown (nothing about the account is disclosed), only "the account's e-mail".
 */

/** Copy for states the reference does not show. */
const MESSAGES = {
  resend: 'Gửi lại liên kết',
  sent: 'Đã gửi lại liên kết. Hãy kiểm tra hộp thư của bạn.',
  stale: 'Yêu cầu này không còn hiệu lực. Hãy nhập lại email.',
  rateLimited: 'Bạn đã yêu cầu liên kết quá nhiều lần. Vui lòng thử lại sau ít phút.',
  resetLede: 'Nếu tài khoản tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu đến:',
  resetAccountEmail: 'email gắn với tài khoản của bạn',
  failed: 'Chưa gửi lại được liên kết. Vui lòng thử lại.',
} as const

/** Seconds as m:ss, the format the approved baseline shows ("0:45"). */
function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function CheckEmailCard() {
  const router = useRouter()
  // The AuthRequest handed over by WF01-S01; null until read in the browser.
  const [pending, setPending] = useState<MagicLinkRequestAccepted | null>(null)
  // Epoch ms at which resend becomes allowed, from the server's resend_after_seconds.
  const [availableAt, setAvailableAt] = useState(0)
  // Current time, refreshed once a second; drives the countdown label.
  const [now, setNow] = useState(0)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ tone: 'info' | 'error'; text: string }>()
  // A ref, not state: a second click can land before React re-renders.
  const inFlight = useRef(false)

  // sessionStorage only exists in the browser, so the handoff is read after
  // mount. With nothing to confirm or resend, return to WF01-S01; replace()
  // keeps the empty screen out of the back-button history.
  useEffect(() => {
    const stored = readPendingRequest(window.sessionStorage)
    if (!stored) {
      router.replace('/auth')
      return
    }
    // The cooldown is measured from arrival. After a refresh it restarts at the
    // full server value, which can only delay a resend, never allow it early.
    const start = Date.now()
    setPending(stored)
    setNow(start)
    setAvailableAt(start + stored.resend_after_seconds * 1000)
  }, [router])

  // One tick per second is enough for an m:ss label.
  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [pending])

  // Render nothing until the handoff is read, so the server render and the
  // first client render agree and no empty card flashes before a redirect.
  if (!pending) return null

  const reset = pending.kind === 'reset'
  const remaining = Math.max(0, Math.ceil((availableAt - now) / 1000))
  const coolingDown = remaining > 0

  /**
   * POST /auth/magic-link/resend. Resend is not one of the contract's seven
   * Idempotency-Key operations, so no key is sent: duplicates are prevented by
   * the in-flight guard and the cooldown, and the server retires the old id.
   */
  async function resend() {
    if (!pending || inFlight.current || coolingDown) return
    inFlight.current = true
    setSending(true)
    setStatus(undefined)
    try {
      const accepted =
        pending.kind === 'reset'
          ? {
              ...(await apiRequest<MagicLinkRequestAccepted>('/auth/password/forgot/resend', {
                method: 'POST',
                body: { request_id: pending.request_id },
              })),
              kind: 'reset' as const,
            }
          : await apiRequest<MagicLinkRequestAccepted>('/auth/magic-link/resend', {
              method: 'POST',
              body: { auth_request_id: pending.request_id },
            })
      // The server retires the previous request; only the new id can resend.
      savePendingRequest(window.sessionStorage, accepted)
      const at = Date.now()
      setPending(accepted)
      setNow(at)
      setAvailableAt(at + accepted.resend_after_seconds * 1000)
      setStatus({ tone: 'info', text: MESSAGES.sent })
    } catch (error) {
      // Contract codes only: a used or unknown request means the user must
      // start again from WF01-S01; anything else is safe to retry.
      const code = isApiError(error) ? error.code : undefined
      setStatus({
        tone: 'error',
        text:
          code === 'AUTH_LINK_ALREADY_USED' || code === 'AUTH_LINK_INVALID'
            ? MESSAGES.stale
            : code === 'AUTH_RATE_LIMITED'
              ? MESSAGES.rateLimited
              : MESSAGES.failed,
      })
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  return (
    <div className={styles.root}>
      <AuthCard>
        <div className={styles.stack}>
          <div className={styles.tile} aria-hidden="true">
            <svg className={styles.tileIcon} viewBox="0 0 24 16">
              <path className={styles.tileIconBody} d="M0 0h24v16H0z" />
              <path
                className={styles.tileIconFold}
                d="M1 1.5 12 11.5 23 1.5M1 15l8.5-7M23 15l-8.5-7"
              />
            </svg>
          </div>

          <h1 className={styles.title}>Kiểm tra hòm thư của bạn</h1>
          <p className={styles.lede}>
            {reset ? MESSAGES.resetLede : 'Chúng tôi đã gửi liên kết đăng nhập đến:'}
          </p>
          <p className={styles.address} data-testid="email-masked">
            {pending.email_masked || MESSAGES.resetAccountEmail}
          </p>
          <p className={styles.spam}>Vui lòng kiểm tra cả thư mục Spam hoặc Thư rác.</p>

          <hr className={styles.divider} />

          <div className={styles.resendRow}>
            <p className={styles.resendPrompt}>Chưa nhận được email?</p>
            <button
              type="button"
              className={styles.resend}
              onClick={resend}
              disabled={coolingDown || sending}
              aria-busy={sending || undefined}
            >
              {coolingDown ? `Gửi lại sau ${formatCountdown(remaining)}` : MESSAGES.resend}
            </button>
          </div>

          {/* Always mounted, so screen readers announce the message when it appears. */}
          <div aria-live="polite">
            {status ? (
              <p className={styles.status} role={status.tone === 'error' ? 'alert' : 'status'}>
                {status.text}
              </p>
            ) : null}
          </div>

          <Link href={reset ? '/auth#quen-mat-khau' : '/auth'} className={styles.changeEmail}>
            {reset ? 'Nhập lại tên tài khoản hoặc email' : 'Dùng email khác'}
          </Link>
        </div>
      </AuthCard>
    </div>
  )
}
