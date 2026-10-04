'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { AuthCard } from '@/components/shell/auth-card'
import { CombinedLegalLink } from '@/components/legal/combined-legal-link'
import { Button, Field, FieldMessage, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { afterSignIn, type SignInResult } from '@/lib/auth/after-sign-in'
import { isPlausibleEmail } from '@/lib/auth/email'
import { isValidPasswordFormat } from '@/lib/auth/password-rules'
import { savePendingRequest, type MagicLinkRequestAccepted } from '@/lib/auth/pending-request'
import { RETURN_PATH_PARAM, rememberReturnPath, safeReturnPath } from '@/lib/auth/return-path'
import { isValidUsernameFormat } from '@/lib/auth/username'

import styles from './auth-entry.module.css'
import { PasswordField } from './password-field'

/**
 * WF01-S01 / AUTH1 — the ONE canonical auth surface (BD-01, DEC-P3UX-D5),
 * replaced in S1-UAT-01 by the Sprint1 UAT contract (US-01.02 … US-01.05):
 * username/email + password sign-in, account creation, forgot password and
 * Google. Magic link is no longer offered here (DEC-S1A-D7).
 *
 * The three views are client state of this one route, never a route or a
 * `mode` parameter (BD-01: no /login, /signup, mode=signup). The card keeps
 * AUTH1's geometry and primitives: heading, Google control, divider, form.
 * Every rule shown here is the server's own module (email.ts, username.ts,
 * password-rules.ts); the server re-checks all of it.
 */

export type LegalVersion = { type: string; version: string }

type View = 'login' | 'register' | 'forgot'

/** A fragment, not a mode parameter: the reset page's "Gửi liên kết mới" opens the forgot view. */
const FORGOT_HASH = '#quen-mat-khau'

const MESSAGES = {
  required: 'Vui lòng điền thông tin này.',
  emailInvalid: 'Email chưa đúng định dạng.',
  usernameInvalid: 'Tên tài khoản gồm 4–30 ký tự: chữ không dấu, số và dấu chấm.',
  passwordWeak: 'Mật khẩu tối thiểu 8 ký tự, có cả chữ và số.',
  passwordMismatch: 'Mật khẩu nhập lại không khớp.',
  legal: 'Vui lòng đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư.',
  legalStale: 'Điều khoản vừa được cập nhật. Vui lòng tải lại trang để xem phiên bản mới.',
  invalidCredentials: 'Sai tên tài khoản hoặc mật khẩu.',
  locked:
    'Bạn đã nhập sai mật khẩu quá nhiều lần. Đăng nhập bằng mật khẩu tạm dừng 15 phút; bạn vẫn có thể đăng nhập bằng Google hoặc đặt lại mật khẩu.',
  // Neutral (PO decision 3, DEC-S1A-D11): never says the e-mail has an account.
  registrationRejected:
    'Không thể tạo tài khoản với thông tin này. Nếu bạn đã có tài khoản, hãy đăng nhập hoặc đặt lại mật khẩu.',
  usernameTaken: 'Tên tài khoản đã có người dùng.',
  rateLimited: 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
  googleUnavailable: 'Đăng nhập bằng Google chưa được bật. Vui lòng dùng tên tài khoản hoặc email.',
  googleFailed:
    'Chưa đăng nhập được bằng Google. Vui lòng thử lại hoặc đăng nhập bằng tên tài khoản/email.',
} as const

/** Non-secret notes the Google start / callback put on /auth (`?google=`). */
const GOOGLE_NOTES: Record<string, string> = {
  unavailable: MESSAGES.googleUnavailable,
  failed: MESSAGES.googleFailed,
}

function returnPathFromUrl(): string | null {
  return safeReturnPath(new URLSearchParams(window.location.search).get(RETURN_PATH_PARAM))
}

export function AuthEntryForm({
  googleAvailable,
  legal,
}: {
  googleAvailable: boolean
  legal: LegalVersion[]
}) {
  const router = useRouter()
  const [view, setView] = useState<View>('login')
  const [note, setNote] = useState<string>()
  const [prefill, setPrefill] = useState('')

  useEffect(() => {
    const google = new URLSearchParams(window.location.search).get('google')
    if (google && Object.hasOwn(GOOGLE_NOTES, google)) setNote(GOOGLE_NOTES[google])
    if (window.location.hash === FORGOT_HASH) setView('forgot')
  }, [])

  function startGoogle() {
    if (!googleAvailable) {
      setNote(MESSAGES.googleUnavailable)
      return
    }
    // BD-02: the callback finds a safe `?redirect=` here after Google's round trip.
    rememberReturnPath(window.localStorage, returnPathFromUrl())
    window.location.assign('/api/v1/auth/google/start')
  }

  function signedIn(result: SignInResult) {
    const { path } = afterSignIn(result, returnPathFromUrl(), window.sessionStorage)
    router.replace(path)
  }

  function show(next: View) {
    setNote(undefined)
    setView(next)
  }

  return (
    <AuthCard>
      <div className={styles.stack} data-auth-view={view}>
        <h1 className={styles.title}>
          {view === 'forgot' ? 'Quên mật khẩu' : 'Đăng nhập & đăng ký'}
        </h1>

        {view !== 'forgot' ? (
          <div className={styles.providers}>
            <button
              type="button"
              className={styles.provider}
              data-provider="google"
              onClick={startGoogle}
            >
              <span className={styles.providerMark} aria-hidden="true">
                G
              </span>
              <span>{view === 'register' ? 'Đăng ký với Google' : 'Tiếp tục với Google'}</span>
            </button>
            {note ? (
              <p className={styles.providerNote} role="status">
                {note}
              </p>
            ) : null}
            <p className={styles.divider}>hoặc tiếp tục bằng email</p>
          </div>
        ) : null}

        {view === 'login' ? (
          <LoginForm
            key={prefill}
            prefill={prefill}
            onSignedIn={signedIn}
            onForgot={() => show('forgot')}
            onRegister={() => show('register')}
          />
        ) : null}
        {view === 'register' ? (
          <RegisterForm
            legal={legal}
            onSignedIn={signedIn}
            onForgot={() => show('forgot')}
            onLogin={(identifier) => {
              setPrefill(identifier)
              show('login')
            }}
          />
        ) : null}
        {view === 'forgot' ? (
          <ForgotForm
            onSent={(accepted) => {
              savePendingRequest(window.sessionStorage, { ...accepted, kind: 'reset' })
              router.push('/auth/check-email')
            }}
            onBack={() => {
              if (window.location.hash) {
                history.replaceState(null, '', window.location.pathname + window.location.search)
              }
              show('login')
            }}
          />
        ) : null}
      </div>
    </AuthCard>
  )
}

/** Disables a form while its request is in flight; a ref, since a second click can beat a render. */
function useSubmitting() {
  const inFlight = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  return {
    submitting,
    begin: () => {
      if (inFlight.current) return false
      inFlight.current = true
      setSubmitting(true)
      return true
    },
    end: () => {
      inFlight.current = false
      setSubmitting(false)
    },
  }
}

function LoginForm({
  prefill,
  onSignedIn,
  onForgot,
  onRegister,
}: {
  prefill: string
  onSignedIn: (result: SignInResult) => void
  onForgot: () => void
  onRegister: () => void
}) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState(prefill)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [formError, setFormError] = useState<{ text: string; locked?: boolean }>()
  const { submitting, begin, end } = useSubmitting()
  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(undefined)
    const next = {
      identifier: identifier.trim() ? undefined : MESSAGES.required,
      password: password ? undefined : MESSAGES.required,
    }
    setErrors(next)
    if (next.identifier) return identifierRef.current?.focus()
    if (next.password) return passwordRef.current?.focus()
    if (!begin()) return

    try {
      const result = await apiRequest<SignInResult>('/auth/login', {
        method: 'POST',
        body: { identifier, password, remember },
      })
      // Stay disabled while navigating, so the request cannot be repeated.
      onSignedIn(result)
    } catch (error) {
      end()
      const code = isApiError(error) ? error.code : undefined
      if (code === 'AUTH_ACCOUNT_BLOCKED') {
        router.replace('/auth/error?reason=blocked')
        return
      }
      setPassword('')
      setFormError(
        code === 'AUTH_INVALID_CREDENTIALS'
          ? { text: MESSAGES.invalidCredentials }
          : code === 'AUTH_PASSWORD_LOGIN_LOCKED'
            ? { text: MESSAGES.locked, locked: true }
            : code === 'AUTH_RATE_LIMITED'
              ? { text: MESSAGES.rateLimited }
              : { text: MESSAGES.failed },
      )
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={onSubmit} aria-label="Đăng nhập">
      <Field label="Tên tài khoản hoặc email" error={errors.identifier}>
        {({ id, invalid, describedBy }) => (
          <TextInput
            ref={identifierRef}
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ten.taikhoan hoặc ten@donvi.gov.vn"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={submitting}
          />
        )}
      </Field>
      <PasswordField
        label="Mật khẩu"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        disabled={submitting}
        inputRef={passwordRef}
      />
      <div className={styles.row}>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={submitting}
          />
          <span>Ghi nhớ đăng nhập trên thiết bị này</span>
        </label>
        <button type="button" className={styles.textLink} onClick={onForgot}>
          Quên mật khẩu?
        </button>
      </div>
      <Button type="submit" fullWidth loading={submitting}>
        Đăng nhập
      </Button>
      {formError ? (
        <Notice tone="error">
          {formError.text}
          {formError.locked ? (
            <>
              {' '}
              <button type="button" className={styles.inlineLink} onClick={onForgot}>
                Đặt lại mật khẩu
              </button>
            </>
          ) : null}
        </Notice>
      ) : null}
      <p className={styles.switch}>
        Chưa có tài khoản?{' '}
        <button type="button" className={styles.textLink} onClick={onRegister}>
          Tạo tài khoản
        </button>
      </p>
    </form>
  )
}

type RegisterErrors = Partial<
  Record<'full_name' | 'email' | 'username' | 'password' | 'password_confirm' | 'legal', string>
>

function RegisterForm({
  legal,
  onSignedIn,
  onLogin,
  onForgot,
}: {
  legal: LegalVersion[]
  onSignedIn: (result: SignInResult) => void
  onLogin: (identifier: string) => void
  onForgot: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [rejected, setRejected] = useState(false)
  const [suggestion, setSuggestion] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const { submitting, begin, end } = useSubmitting()
  const formRef = useRef<HTMLFormElement>(null)

  function validate(): RegisterErrors {
    const next: RegisterErrors = {}
    if (!fullName.trim()) next.full_name = MESSAGES.required
    if (!email.trim()) next.email = MESSAGES.required
    else if (!isPlausibleEmail(email)) next.email = MESSAGES.emailInvalid
    if (!username.trim()) next.username = MESSAGES.required
    else if (!isValidUsernameFormat(username)) next.username = MESSAGES.usernameInvalid
    if (!password) next.password = MESSAGES.required
    else if (!isValidPasswordFormat(password)) next.password = MESSAGES.passwordWeak
    if (!confirm) next.password_confirm = MESSAGES.required
    else if (confirm !== password) next.password_confirm = MESSAGES.passwordMismatch
    if (!agreed) next.legal = MESSAGES.legal
    return next
  }

  function focusFirstError() {
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(undefined)
    setRejected(false)
    setSuggestion(undefined)
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return focusFirstError()
    if (!begin()) return

    try {
      const result = await apiRequest<SignInResult>('/auth/register', {
        method: 'POST',
        body: {
          full_name: fullName,
          email,
          username,
          password,
          password_confirm: confirm,
          legal_versions: Object.fromEntries(legal.map((d) => [d.type, d.version])),
        },
      })
      onSignedIn(result)
    } catch (error) {
      end()
      const code = isApiError(error) ? error.code : undefined
      const fields = isApiError(error) ? error.fields : undefined
      if (code === 'AUTH_REGISTRATION_REJECTED') {
        setRejected(true)
      } else if (code === 'AUTH_USERNAME_TAKEN') {
        setErrors({ username: MESSAGES.usernameTaken })
        setSuggestion(fields?.suggestion)
        focusFirstError()
      } else if (code === 'AUTH_VALIDATION_FAILED' && fields) {
        // The server's field codes, shown with the form's own copy.
        const map: RegisterErrors = {}
        if (fields.full_name) map.full_name = MESSAGES.required
        if (fields.email) map.email = MESSAGES.emailInvalid
        if (fields.username) map.username = MESSAGES.usernameInvalid
        if (fields.password) map.password = MESSAGES.passwordWeak
        if (fields.password_confirm) map.password_confirm = MESSAGES.passwordMismatch
        if (fields.legal) map.legal = MESSAGES.legal
        setErrors(map)
        focusFirstError()
      } else if (code === 'LEGAL_DOCUMENT_VERSION_STALE' || code === 'UNCONTRACTED_NOT_FOUND') {
        setFormError(MESSAGES.legalStale)
      } else if (code === 'AUTH_RATE_LIMITED') {
        setFormError(MESSAGES.rateLimited)
      } else {
        setFormError(MESSAGES.failed)
      }
    }
  }

  return (
    <form
      ref={formRef}
      className={styles.form}
      noValidate
      onSubmit={onSubmit}
      aria-label="Tạo tài khoản"
    >
      <Field label="Họ và tên" error={errors.full_name}>
        {({ id, invalid, describedBy }) => (
          <TextInput
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="full_name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
          />
        )}
      </Field>
      <div className={styles.fieldWithAction}>
        <Field label="Email" error={errors.email}>
          {({ id, invalid, describedBy }) => (
            <TextInput
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
      </div>
      <div className={styles.fieldWithAction}>
        <Field
          label="Tên tài khoản"
          error={errors.username}
          helper="4–30 ký tự: chữ không dấu, số và dấu chấm."
        >
          {({ id, invalid, describedBy }) => (
            <TextInput
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          )}
        </Field>
        {suggestion ? (
          <p className={styles.hint}>
            Gợi ý:{' '}
            <button
              type="button"
              className={styles.inlineLink}
              onClick={() => {
                setUsername(suggestion)
                setSuggestion(undefined)
                setErrors((e) => ({ ...e, username: undefined }))
              }}
            >
              {suggestion}
            </button>
          </p>
        ) : null}
      </div>
      <PasswordField
        label="Mật khẩu"
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
        error={errors.password_confirm}
        disabled={submitting}
      />
      <div>
        <label
          className={styles.check}
          data-legal-versions={legal.map((d) => `${d.type}:${d.version}`).join(' ')}
        >
          <input
            type="checkbox"
            name="legal"
            checked={agreed}
            aria-invalid={errors.legal ? true : undefined}
            aria-describedby={errors.legal ? 'register-legal-error' : undefined}
            onChange={(e) => {
              setAgreed(e.target.checked)
              setErrors((x) => ({ ...x, legal: undefined }))
            }}
            disabled={submitting}
          />
          <span>
            Tôi đồng ý với <CombinedLegalLink />.
          </span>
        </label>
        {errors.legal ? (
          <div className={styles.checkError}>
            <FieldMessage id="register-legal-error" tone="error">
              {errors.legal}
            </FieldMessage>
          </div>
        ) : null}
      </div>
      <Button type="submit" fullWidth loading={submitting}>
        Tạo tài khoản
      </Button>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {rejected ? (
        <Notice tone="error">
          {MESSAGES.registrationRejected}{' '}
          <button type="button" className={styles.inlineLink} onClick={() => onLogin(email.trim())}>
            Đăng nhập
          </button>{' '}
          ·{' '}
          <button type="button" className={styles.inlineLink} onClick={onForgot}>
            Quên mật khẩu?
          </button>
        </Notice>
      ) : null}
      <p className={styles.switch}>
        Đã có tài khoản?{' '}
        <button type="button" className={styles.textLink} onClick={() => onLogin('')}>
          Đăng nhập
        </button>
      </p>
    </form>
  )
}

function ForgotForm({
  onSent,
  onBack,
}: {
  onSent: (accepted: MagicLinkRequestAccepted) => void
  onBack: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const { submitting, begin, end } = useSubmitting()
  const inputRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(undefined)
    if (!identifier.trim()) {
      setError(MESSAGES.required)
      inputRef.current?.focus()
      return
    }
    setError(undefined)
    if (!begin()) return
    try {
      const accepted = await apiRequest<MagicLinkRequestAccepted>('/auth/password/forgot', {
        method: 'POST',
        body: { identifier },
      })
      onSent(accepted)
    } catch (error) {
      end()
      const code = isApiError(error) ? error.code : undefined
      setFormError(code === 'AUTH_RATE_LIMITED' ? MESSAGES.rateLimited : MESSAGES.failed)
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={onSubmit} aria-label="Quên mật khẩu">
      <p className={styles.lede}>
        Nhập tên tài khoản hoặc email. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu đến email của tài
        khoản.
      </p>
      <Field label="Tên tài khoản hoặc email" error={error}>
        {({ id, invalid, describedBy }) => (
          <TextInput
            ref={inputRef}
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={submitting}
          />
        )}
      </Field>
      <Button type="submit" fullWidth loading={submitting}>
        Gửi liên kết đặt lại
      </Button>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <p className={styles.switch}>
        <button type="button" className={styles.textLink} onClick={onBack}>
          Quay lại đăng nhập
        </button>
      </p>
    </form>
  )
}
