'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { AuthCard } from '@/components/shell/auth-card'
import { Button, Field, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email'
import { savePendingRequest, type MagicLinkRequestAccepted } from '@/lib/auth/pending-request'

import styles from './auth-entry.module.css'

/**
 * WF01-S01 / AUTH1 — auth entry card: the P0 email magic-link path, presented
 * per the corrected L1 reference (TASK 22.2, DEC-L1-D2).
 *
 * Provider sign-in is config-driven (WF01 contract: "provider entry if
 * configured") and GET /api/v1/auth/providers returns an empty list in P0. The
 * drawn "Tiếp tục với Google" control and its divider are shown as in AUTH1,
 * but the control is a disabled button with a visible "Sắp có" and no handler:
 * it starts no provider flow (DEC-L1-D9, the 28/09 no-dead-CTA rule). The terms
 * notice stays under the button: the revision drops it, but consent placement
 * is HD-03 (DEC-L1-D3).
 *
 * The response is identical whether or not an account exists (05:181), and
 * this screen shows the same outcome either way, so nothing is enumerable.
 */

/** Copy for states the reference does not show. The rate-limit line is AUTH4's R1 row,
 * kept inline (DEC-WF01-S04-D3) and without a window or provider the server does not have. */
const MESSAGES = {
  empty: 'Vui lòng nhập email.',
  invalid: 'Email chưa đúng định dạng.',
  rateLimited: 'Bạn đã yêu cầu liên kết quá nhiều lần. Vui lòng thử lại sau ít phút.',
  failed: 'Chưa gửi được liên kết. Vui lòng thử lại.',
} as const

export function AuthEntryForm() {
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

    // Client validation mirrors the server rule exactly (shared email.ts), so a
    // request the server would reject is never sent.
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
      // Hand the public 202 DTO to WF01-S02; the token never reaches the browser.
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
    <AuthCard>
      <div className={styles.stack}>
        <h1 className={styles.title}>Đăng nhập</h1>

        <div className={styles.providers}>
          <button
            type="button"
            className={styles.provider}
            disabled
            aria-label="Tiếp tục với Google (sắp có)"
            data-provider="google"
          >
            <span className={styles.providerMark} aria-hidden="true">
              G
            </span>
            <span>Tiếp tục với Google</span>
            <span className={styles.soon} aria-hidden="true">
              Sắp có
            </span>
          </button>
          <p className={styles.divider}>hoặc tiếp tục bằng email</p>
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
            Gửi liên kết đăng nhập
          </Button>
          {formError ? <Notice tone="error">{formError}</Notice> : null}
        </form>

        <p className={styles.legal}>
          Tiếp tục nghĩa là bạn đồng ý Điều khoản sử dụng và Chính sách quyền riêng tư.
        </p>
      </div>
    </AuthCard>
  )
}
