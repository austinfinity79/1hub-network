'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { AuthCard } from '@/components/shell/auth-card'
import { Button, Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { isValidPasswordFormat } from '@/lib/auth/password-rules'

import styles from '../auth-entry.module.css'
import { PasswordField } from '../password-field'

/**
 * WF01-S11 — set a new password from the e-mailed link (US-01.04).
 *
 * - The token is taken from `#token=`, removed from the address bar and history
 *   before anything is sent, kept in memory only, and posted ONCE.
 * - Success: "Đã đổi mật khẩu", every session of the account was revoked by
 *   the server, and the person signs in again (no session is created here).
 * - Expired, used or superseded: "Liên kết đặt lại mật khẩu đã hết hạn" + a new
 *   link from the forgot view (US-01.04), checked on open (read-only) and again
 *   on submit. Unknown / missing: the same panel.
 */

type State = 'loading' | 'form' | 'done' | 'expired'

const MESSAGES = {
  required: 'Vui lòng điền thông tin này.',
  weak: 'Mật khẩu tối thiểu 8 ký tự, có cả chữ và số.',
  mismatch: 'Mật khẩu nhập lại không khớp.',
  rateLimited: 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  failed: 'Chưa đổi được mật khẩu. Vui lòng thử lại.',
} as const

export function ResetPasswordCard({ expiresInMinutes }: { expiresInMinutes: number }) {
  const [state, setState] = useState<State>('loading')
  const token = useRef<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const value = hash.get('token')
    window.history.replaceState(null, '', '/auth/reset-password')
    token.current = value && value.length <= 512 ? value : null
    if (!token.current) {
      setState('expired')
      return
    }
    // A spent or expired link says so on open, before a password is typed.
    apiRequest('/auth/password/reset/check', { method: 'POST', body: { token: token.current } })
      .then(() => setState('form'))
      .catch((error: unknown) => {
        const code = isApiError(error) ? error.code : undefined
        if (code === 'AUTH_RESET_LINK_EXPIRED' || code === 'AUTH_RESET_LINK_INVALID') {
          token.current = null
          setState('expired')
        } else {
          // Unknown failure: let the person try; the submit re-checks everything.
          setState('form')
        }
      })
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !token.current) return
    setFormError(undefined)
    const next = {
      password: !password
        ? MESSAGES.required
        : isValidPasswordFormat(password)
          ? undefined
          : MESSAGES.weak,
      confirm: !confirm ? MESSAGES.required : confirm === password ? undefined : MESSAGES.mismatch,
    }
    setErrors(next)
    if (next.password || next.confirm) return

    inFlight.current = true
    setSubmitting(true)
    try {
      await apiRequest('/auth/password/reset', {
        method: 'POST',
        body: { token: token.current, password, password_confirm: confirm },
      })
      token.current = null
      setState('done')
    } catch (error) {
      const code = isApiError(error) ? error.code : undefined
      if (code === 'AUTH_RESET_LINK_EXPIRED' || code === 'AUTH_RESET_LINK_INVALID') {
        token.current = null
        setState('expired')
      } else if (code === 'AUTH_ACCOUNT_BLOCKED') {
        window.location.replace('/auth/error?reason=blocked')
      } else {
        setFormError(code === 'AUTH_RATE_LIMITED' ? MESSAGES.rateLimited : MESSAGES.failed)
      }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  if (state === 'loading') return null

  return (
    <AuthCard>
      <div className={styles.stack} data-reset-state={state}>
        {state === 'form' ? (
          <>
            <h1 className={styles.title}>Đặt mật khẩu mới</h1>
            <form
              className={styles.form}
              noValidate
              onSubmit={onSubmit}
              aria-label="Đặt mật khẩu mới"
            >
              <PasswordField
                label="Mật khẩu mới"
                name="new-password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                error={errors.password}
                disabled={submitting}
                meter
              />
              <PasswordField
                label="Nhập lại mật khẩu"
                name="password-confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={setConfirm}
                error={errors.confirm}
                disabled={submitting}
              />
              <Button type="submit" fullWidth loading={submitting}>
                Lưu mật khẩu mới
              </Button>
              {formError ? <Notice tone="error">{formError}</Notice> : null}
            </form>
          </>
        ) : null}

        {state === 'done' ? (
          <>
            <h1 className={styles.title}>Đã đổi mật khẩu</h1>
            <p className={styles.lede} role="status">
              Mật khẩu mới đã được lưu. Các phiên đăng nhập trên thiết bị khác đã được đăng xuất.
            </p>
            <Link href="/auth" className={styles.primaryLink}>
              Đăng nhập
            </Link>
          </>
        ) : null}

        {state === 'expired' ? (
          <>
            <h1 className={styles.title}>Liên kết đặt lại mật khẩu đã hết hạn</h1>
            <p className={styles.lede} role="alert">
              Liên kết chỉ có hiệu lực trong {expiresInMinutes} phút và dùng được một lần. Vui lòng
              yêu cầu liên kết mới.
            </p>
            <Link href="/auth#quen-mat-khau" className={styles.primaryLink}>
              Gửi liên kết mới
            </Link>
          </>
        ) : null}
      </div>
    </AuthCard>
  )
}
