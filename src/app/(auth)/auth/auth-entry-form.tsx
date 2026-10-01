'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { AuthCard } from '@/components/shell/auth-card'
import { Button, Field, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email'
import { savePendingRequest, type MagicLinkRequestAccepted } from '@/lib/auth/pending-request'
import { RETURN_PATH_PARAM, rememberReturnPath, safeReturnPath } from '@/lib/auth/return-path'

import styles from './auth-entry.module.css'

/**
 * WF01-S01 / AUTH1 — auth entry card: the email magic-link path, presented per
 * the L1 board (TASK 22-L1-L2-SOT-REALIGN, DEC-L1R-D1 / D2).
 *
 * Sign-up is open: any valid address moves on to WF01-S02 and receives the
 * link by e-mail; the account exists only once that link is used. One surface
 * serves both intents, so the heading names both (BD-01, PO 01/10): no
 * separate sign-up route, mode or flow.
 *
 * "Tiếp tục với Google" is drawn as in AUTH1. No OAuth client is configured
 * (GET /api/v1/auth/providers returns an empty list), so pressing it starts no
 * provider flow and signs nobody in: it shows why and points to the e-mail
 * path. The terms line of the earlier build is gone, as in the board: entering
 * an address is not acceptance, which is recorded in onboarding stage 4.
 */

/** Copy for states the reference does not show. The rate-limit line is AUTH4's R1 row,
 * kept inline (DEC-WF01-S04-D3) and without a window or provider the server does not have. */
const MESSAGES = {
  empty: 'Vui lòng nhập email.',
  invalid: 'Email chưa đúng định dạng.',
  rateLimited: 'Bạn đã yêu cầu liên kết quá nhiều lần. Vui lòng thử lại sau ít phút.',
  // D-G1: no OAuth client; the control explains itself and signs nobody in.
  googleUnavailable: 'Đăng nhập bằng Google chưa được bật. Vui lòng tiếp tục bằng email.',
  failed: 'Chưa gửi được liên kết. Vui lòng thử lại.',
} as const

export function AuthEntryForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [providerNote, setProviderNote] = useState(false)
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
      // BD-02: keep a safe `?redirect=` for the callback; a plain entry forgets any earlier one.
      rememberReturnPath(
        window.localStorage,
        safeReturnPath(new URLSearchParams(window.location.search).get(RETURN_PATH_PARAM)),
      )
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
        <h1 className={styles.title}>Đăng nhập &amp; đăng ký</h1>

        <div className={styles.providers}>
          <button
            type="button"
            className={styles.provider}
            data-provider="google"
            aria-describedby={providerNote ? 'google-unavailable' : undefined}
            onClick={() => {
              setProviderNote(true)
              inputRef.current?.focus()
            }}
          >
            <span className={styles.providerMark} aria-hidden="true">
              G
            </span>
            <span>Tiếp tục với Google</span>
          </button>
          {providerNote ? (
            <p id="google-unavailable" className={styles.providerNote} role="status">
              {MESSAGES.googleUnavailable}
            </p>
          ) : null}
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
      </div>
    </AuthCard>
  )
}
