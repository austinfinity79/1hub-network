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
 * WF01-S02 — check email. Reads the AuthRequest handed over by WF01-S01 and
 * offers the two contract actions: resend and change_email.
 *
 * - The address shown is the server's `email_masked`; the raw address and the
 *   magic-link token never reach the browser.
 * - The resend countdown uses the server's `resend_after_seconds`; no duration
 *   is invented here.
 * - Without a pending request (direct entry, other tab) the screen returns to
 *   WF01-S01, since there is nothing to confirm or resend.
 * - The approved bitmap's "Mở Gmail" button is NOT rendered: it is not a
 *   WF01-S02 contract action (resend, change_email). Recorded for review.
 */

/** Copy for states the approved bitmap does not show; pending design copy review. */
const MESSAGES = {
  resend: 'Gửi lại link',
  sent: 'Đã gửi lại link. Hãy kiểm tra hộp thư của bạn.',
  stale: 'Yêu cầu này không còn hiệu lực. Hãy nhập lại email.',
  rateLimited: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.',
  failed: 'Chưa gửi lại được link. Vui lòng thử lại.',
} as const

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function CheckEmailCard() {
  const router = useRouter()
  const [pending, setPending] = useState<MagicLinkRequestAccepted | null>(null)
  const [availableAt, setAvailableAt] = useState(0)
  const [now, setNow] = useState(0)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ tone: 'info' | 'error'; text: string }>()
  const inFlight = useRef(false)

  useEffect(() => {
    const stored = readPendingRequest(window.sessionStorage)
    if (!stored) {
      router.replace('/auth')
      return
    }
    const start = Date.now()
    setPending(stored)
    setNow(start)
    setAvailableAt(start + stored.resend_after_seconds * 1000)
  }, [router])

  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [pending])

  if (!pending) return null

  const remaining = Math.max(0, Math.ceil((availableAt - now) / 1000))
  const coolingDown = remaining > 0

  async function resend() {
    if (!pending || inFlight.current || coolingDown) return
    inFlight.current = true
    setSending(true)
    setStatus(undefined)
    try {
      const accepted = await apiRequest<MagicLinkRequestAccepted>('/auth/magic-link/resend', {
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

          <h1 className={`type-heading-2 ${styles.title}`}>Mở hộp thư của bạn</h1>
          <p className={`type-body-sm ${styles.lede}`}>Link đăng nhập vừa gửi tới</p>
          <p className={`type-body-md weight-medium ${styles.address}`} data-testid="email-masked">
            {pending.email_masked}
          </p>

          <hr className={styles.divider} />

          <div className={styles.resendRow}>
            <p className={`type-body-sm ${styles.resendPrompt}`}>Chưa thấy thư?</p>
            <button
              type="button"
              className={`type-body-sm ${styles.resend}`}
              onClick={resend}
              disabled={coolingDown || sending}
              aria-busy={sending || undefined}
            >
              {coolingDown ? `Gửi lại sau ${formatCountdown(remaining)}` : MESSAGES.resend}
            </button>
          </div>

          <div aria-live="polite">
            {status ? (
              <p
                className={`type-meta-xs ${styles.status}`}
                role={status.tone === 'error' ? 'alert' : 'status'}
              >
                {status.text}
              </p>
            ) : null}
          </div>

          <section className={styles.help} aria-labelledby="check-email-help">
            <h2 id="check-email-help" className={`weight-semibold ${styles.helpTitle}`}>
              Ba chỗ hay thất lạc
            </h2>
            <ul className={`type-body-sm ${styles.tips}`}>
              <li>Thư mục Spam hoặc Quảng cáo</li>
              <li>Email cơ quan có lọc thư ngoài — hỏi IT về hub@1hub.network</li>
              <li>Gõ nhầm tên miền: .vn và .com.vn</li>
            </ul>
          </section>

          <Link href="/auth" className={`type-meta-xs weight-medium ${styles.changeEmail}`}>
            Đổi email khác
          </Link>
        </div>
      </AuthCard>
    </div>
  )
}
