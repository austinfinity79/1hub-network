'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Button, Field, Notice, Surface, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email'
import { savePendingRequest, type MagicLinkRequestAccepted } from '@/lib/auth/pending-request'

import styles from './auth-entry.module.css'

/**
 * WF01-S01 — auth entry card: the P0 email magic-link path.
 *
 * Provider sign-in is config-driven (WF01 contract: "provider entry if
 * configured") and GET /api/v1/auth/providers returns an empty list in P0, so no
 * provider button or "or use email" divider is rendered. The approved bitmap's
 * Google block is recorded as an INTENTIONAL-BUSINESS-CONFIG difference.
 *
 * The response is identical whether or not an account exists (05:181), and
 * this screen shows the same outcome either way, so nothing is enumerable.
 */

/** Copy for states the approved bitmap does not show; pending design copy review. */
const MESSAGES = {
  empty: 'Vui lòng nhập email.',
  invalid: 'Email chưa đúng định dạng.',
  rateLimited: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.',
  failed: 'Chưa gửi được link. Vui lòng thử lại.',
} as const

type Props = {
  /** From the frozen magic-link expiry, so the copy cannot drift from the server. */
  expiresInMinutes: number
}

export function AuthEntryForm({ expiresInMinutes }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  // A ref, not state: a second click can land before React re-renders.
  const inFlight = useRef(false)
  // One Idempotency-Key per address, so a retry of the same request replays.
  const keys = useRef(new Map<string, string>())
  const inputRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    setFormError(undefined)
    const value = email.trim()
    if (!value || !isPlausibleEmail(value)) {
      setFieldError(value ? MESSAGES.invalid : MESSAGES.empty)
      inputRef.current?.focus()
      return
    }
    setFieldError(undefined)

    const normalized = normalizeEmail(value)
    let key = keys.current.get(normalized)
    if (!key) {
      key = crypto.randomUUID()
      keys.current.set(normalized, key)
    }

    inFlight.current = true
    setSubmitting(true)
    try {
      const accepted = await apiRequest<MagicLinkRequestAccepted>('/auth/magic-link', {
        method: 'POST',
        body: { email: value, return_to: '/auth/callback' },
        idempotencyKey: key,
      })
      savePendingRequest(window.sessionStorage, accepted)
      router.push('/auth/check-email')
      // Stay disabled while navigating, so the request cannot be repeated.
    } catch (error) {
      inFlight.current = false
      setSubmitting(false)
      if (isApiError(error) && error.code === 'AUTH_EMAIL_INVALID') {
        setFieldError(MESSAGES.invalid)
        inputRef.current?.focus()
      } else if (isApiError(error) && error.code === 'AUTH_RATE_LIMITED') {
        setFormError(MESSAGES.rateLimited)
      } else {
        setFormError(MESSAGES.failed)
      }
    }
  }

  return (
    <div className={styles.card}>
      <Surface as="section">
        <div className={styles.stack}>
          <div className={styles.intro}>
            <h1 className={`type-heading-2 ${styles.title}`}>Vào HUB NETWORK</h1>
            <p className={`type-body-sm ${styles.lede}`}>
              Chưa có tài khoản thì hệ thống tự tạo. Bạn không phải chọn giữa đăng nhập và đăng ký.
            </p>
          </div>

          <form
            className={styles.form}
            noValidate
            onSubmit={onSubmit}
            aria-label="Đăng nhập bằng email"
          >
            <Field label="Email" error={fieldError}>
              {({ id, invalid, describedBy }) => (
                <TextInput
                  ref={inputRef}
                  id={id}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="ten@donvi.gov.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              )}
            </Field>
            <Button type="submit" fullWidth loading={submitting}>
              Gửi link đăng nhập
            </Button>
            {formError ? <Notice tone="error">{formError}</Notice> : null}
          </form>

          <Notice>
            <span className={styles.noticeBody}>
              <svg className={styles.noticeIcon} viewBox="0 0 14 10" aria-hidden="true">
                <path fill="currentColor" d="M0 0h14v10H0z" />
                <path className={styles.noticeIconFold} d="M.5.5 7 7 13.5.5" />
              </svg>
              <span className={`type-meta-xs ${styles.noticeText}`}>
                Chúng tôi gửi một link dùng một lần, hết hạn sau {expiresInMinutes} phút. Không có
                mật khẩu nào để nhớ hay để mất.
              </span>
            </span>
          </Notice>

          <p className={`type-meta-xs ${styles.legal}`}>
            Tiếp tục nghĩa là bạn đồng ý Điều khoản sử dụng và Chính sách quyền riêng tư.
          </p>
        </div>
      </Surface>
    </div>
  )
}
