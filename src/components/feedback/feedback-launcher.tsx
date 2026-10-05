'use client'

import { usePathname } from 'next/navigation'
import { useId, useRef, useState, type FormEvent } from 'react'

import { Button, Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { feedbackSurface } from '@/lib/feedback/surfaces'

import styles from './feedback.module.css'

/**
 * S1-UAT-02 — "Góp ý" (FB-01, US-X.01): ONE launcher for every surface, mounted
 * once in the root layout. It renders only where `feedbackSurface` offers it.
 *
 * - A floating button opens a native modal <dialog> on top of the page: no
 *   navigation, no reload, nothing of the page's own state is touched, so an
 *   onboarding stage or PRJ1 keeps what was typed (US-X.01).
 * - The draft lives here and survives closing and reopening (FB-01: "Mở hoặc
 *   đóng pop-up không làm mất dữ liệu form đang nhập"); it is cleared only
 *   after a successful send.
 * - A screenshot is attached only by the person's own choice of a file; the
 *   page is never captured.
 * - The e-mail field is shown to guests only; a member is their account.
 * - The Idempotency-Key belongs to the draft: a retry of the same draft
 *   replays the first answer (no duplicate); an edited draft gets a new key.
 */

type Kind = 'BUG' | 'UX' | 'FEATURE'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'BUG', label: 'Báo lỗi' },
  { value: 'UX', label: 'Góp ý trải nghiệm' },
  { value: 'FEATURE', label: 'Đề xuất tính năng' },
]

const MAX_CONTENT = 2000
const MAX_SCREENSHOT = 5 * 1024 * 1024
const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const MESSAGES = {
  type: 'Vui lòng chọn loại góp ý.',
  content: 'Vui lòng nhập nội dung góp ý.',
  tooLong: `Nội dung tối đa ${MAX_CONTENT.toLocaleString('vi-VN')} ký tự.`,
  email: 'Email chưa đúng định dạng.',
  screenshotSize: 'Ảnh tối đa 5MB.',
  screenshotType: 'Chỉ nhận ảnh PNG, JPG hoặc WebP.',
  rateLimited: 'Bạn đã gửi quá nhiều góp ý trong một giờ. Vui lòng thử lại sau.',
  failed: 'Chưa gửi được góp ý. Nội dung vẫn được giữ, vui lòng thử lại.',
} as const

type Errors = Partial<Record<'type' | 'content' | 'email' | 'screenshot', string>>

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:".]{2,}$/

export function FeedbackLauncher() {
  const pathname = usePathname()
  const surface = pathname ? feedbackSurface(pathname) : null
  if (!surface) return null
  return <Launcher />
}

function Launcher() {
  const uid = useId()
  const id = (part: string) => `${uid}-${part}`
  const dialog = useRef<HTMLDialogElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind | ''>('')
  const [content, setContent] = useState('')
  const [email, setEmail] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string>()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  // Contents exist only while open, so a closed dialog adds no control to the page.
  const [isOpen, setIsOpen] = useState(false)
  const inFlight = useRef(false)
  // One key per unchanged draft; a different draft gets a new one.
  const attempt = useRef<{ key: string; signature: string } | null>(null)

  function open() {
    setIsOpen(true)
    dialog.current?.showModal()
    // Members never see the e-mail field; asked once, server-side session only.
    if (signedIn === null) {
      apiRequest<{ authenticated: boolean }>('/session')
        .then((s) => setSignedIn(Boolean(s.authenticated)))
        .catch(() => setSignedIn(false))
    }
  }

  function close() {
    dialog.current?.close()
    setIsOpen(false)
    if (sent) {
      // Only a sent draft is cleared; an unsent one waits for the next open.
      setSent(false)
      setKind('')
      setContent('')
      setEmail('')
      setScreenshot(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function pickScreenshot(file: File | null) {
    setErrors((e) => ({ ...e, screenshot: undefined }))
    if (!file) return setScreenshot(null)
    if (!SCREENSHOT_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, screenshot: MESSAGES.screenshotType }))
      if (fileInput.current) fileInput.current.value = ''
      return setScreenshot(null)
    }
    if (file.size > MAX_SCREENSHOT) {
      setErrors((e) => ({ ...e, screenshot: MESSAGES.screenshotSize }))
      if (fileInput.current) fileInput.current.value = ''
      return setScreenshot(null)
    }
    setScreenshot(file)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setFormError(undefined)
    const next: Errors = {}
    if (!kind) next.type = MESSAGES.type
    if (!content.trim()) next.content = MESSAGES.content
    else if (content.length > MAX_CONTENT) next.content = MESSAGES.tooLong
    if (!signedIn && email.trim() && !EMAIL.test(email.trim())) next.email = MESSAGES.email
    setErrors(next)
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() =>
        dialog.current
          ?.querySelector<HTMLElement>('input[aria-invalid="true"], textarea[aria-invalid="true"]')
          ?.focus(),
      )
      return
    }

    const signature = JSON.stringify([
      kind,
      content.trim(),
      signedIn ? '' : email.trim(),
      screenshot ? [screenshot.name, screenshot.size, screenshot.lastModified] : null,
    ])
    if (attempt.current?.signature !== signature) {
      attempt.current = { key: crypto.randomUUID(), signature }
    }

    const body = new FormData()
    body.set('type', kind)
    body.set('content', content)
    if (!signedIn && email.trim()) body.set('email', email.trim())
    if (screenshot) body.set('screenshot', screenshot)
    // Where it was sent from: the path only (no query, no fragment).
    body.set('route', window.location.pathname)
    body.set('viewport', `${window.innerWidth}x${window.innerHeight}`)
    body.set('locale', navigator.language)

    inFlight.current = true
    setSending(true)
    try {
      await apiRequest('/feedback', {
        method: 'POST',
        body,
        idempotencyKey: attempt.current.key,
      })
      attempt.current = null
      setSent(true)
    } catch (error) {
      const code = isApiError(error) ? error.code : undefined
      const fields = isApiError(error) ? error.fields : undefined
      if (code === 'FEEDBACK_VALIDATION_FAILED' && fields) {
        setErrors({
          type: fields.type ? MESSAGES.type : undefined,
          content: fields.content
            ? fields.content === 'too_long'
              ? MESSAGES.tooLong
              : MESSAGES.content
            : undefined,
          email: fields.email ? MESSAGES.email : undefined,
          screenshot: fields.screenshot
            ? fields.screenshot === 'too_large'
              ? MESSAGES.screenshotSize
              : MESSAGES.screenshotType
            : undefined,
        })
        if (!fields.type && !fields.content && !fields.email && !fields.screenshot) {
          setFormError(MESSAGES.failed)
        }
      } else {
        setFormError(code === 'FEEDBACK_RATE_LIMITED' ? MESSAGES.rateLimited : MESSAGES.failed)
      }
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const describe = (field: keyof Errors, help?: string) =>
    errors[field] ? id(`${field}-error`) : help

  return (
    <>
      <button
        type="button"
        className={styles.launcher}
        data-feedback-launcher
        aria-haspopup="dialog"
        onClick={open}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2.5 3h11v7.5H6.5L3.5 13v-2.5h-1z" />
        </svg>
        <span>Góp ý</span>
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={id('title')}
        data-dialog="feedback"
        onKeyDown={(e) => {
          // Keep Tab inside the modal: past the last control, back to the first.
          if (e.key !== 'Tab') return
          const items = [
            ...(dialog.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
            ) ?? []),
          ].filter((el) => el.offsetParent !== null)
          const radios = items.filter((el) => el.matches('input[type="radio"]'))
          // A radio group is one Tab stop: only its checked (or first) radio counts.
          const stop = radios.find((r) => (r as HTMLInputElement).checked) ?? radios[0]
          const order = items.filter((el) => !el.matches('input[type="radio"]') || el === stop)
          const first = order[0]
          const last = order[order.length - 1]
          const active = document.activeElement
          const atFirst =
            active === first ||
            (active instanceof HTMLInputElement && active.type === 'radio' && first === stop)
          if (e.shiftKey && atFirst) {
            e.preventDefault()
            last?.focus()
          } else if (!e.shiftKey && active === last) {
            e.preventDefault()
            first?.focus()
          }
        }}
        onCancel={(e) => {
          // Escape closes like the close button (and clears only a sent draft).
          e.preventDefault()
          close()
        }}
      >
        {isOpen ? (
          <>
            <div className={styles.head}>
              <h2 id={id('title')} className={styles.title}>
                {sent ? 'Cảm ơn bạn đã góp ý' : 'Góp ý'}
              </h2>
              <button type="button" className={styles.close} aria-label="Đóng" onClick={close}>
                <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                  <path d="M2 2l10 10M12 2 2 12" />
                </svg>
              </button>
            </div>

            {sent ? (
              <div className={styles.body} data-feedback-state="sent">
                <p className={styles.lede} role="status">
                  Góp ý của bạn đã được ghi nhận cùng trang bạn đang xem. Bạn có thể tiếp tục công
                  việc đang dở.
                </p>
                <div className={styles.actions}>
                  <Button type="button" onClick={close} autoFocus>
                    Đóng
                  </Button>
                </div>
              </div>
            ) : (
              <form className={styles.body} noValidate onSubmit={onSubmit} aria-label="Gửi góp ý">
                <fieldset
                  className={styles.kinds}
                  aria-invalid={errors.type ? true : undefined}
                  aria-describedby={describe('type')}
                >
                  <legend className={styles.label}>Loại góp ý</legend>
                  {KINDS.map((k, i) => (
                    <label key={k.value} className={styles.kind}>
                      <input
                        type="radio"
                        name="feedback-type"
                        value={k.value}
                        checked={kind === k.value}
                        onChange={() => {
                          setKind(k.value)
                          setErrors((e) => ({ ...e, type: undefined }))
                        }}
                        disabled={sending}
                        autoFocus={i === 0}
                        aria-invalid={errors.type && i === 0 ? true : undefined}
                      />
                      <span>{k.label}</span>
                    </label>
                  ))}
                  {errors.type ? (
                    <p id={id('type-error')} className={styles.error} role="alert">
                      {errors.type}
                    </p>
                  ) : null}
                </fieldset>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor={id('content')}>
                    Nội dung
                  </label>
                  <textarea
                    id={id('content')}
                    className={styles.textarea}
                    rows={5}
                    maxLength={MAX_CONTENT}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value)
                      setErrors((x) => ({ ...x, content: undefined }))
                    }}
                    aria-invalid={errors.content ? true : undefined}
                    aria-describedby={describe('content', id('content-count'))}
                    disabled={sending}
                  />
                  <div className={styles.meta}>
                    {errors.content ? (
                      <p id={id('content-error')} className={styles.error} role="alert">
                        {errors.content}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span id={id('content-count')} className={styles.count}>
                      {content.length.toLocaleString('vi-VN')}/{MAX_CONTENT.toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor={id('screenshot')}>
                    Ảnh chụp màn hình <span className={styles.optional}>(không bắt buộc)</span>
                  </label>
                  <input
                    ref={fileInput}
                    id={id('screenshot')}
                    className={styles.fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => pickScreenshot(e.target.files?.[0] ?? null)}
                    aria-invalid={errors.screenshot ? true : undefined}
                    aria-describedby={describe('screenshot', id('screenshot-help'))}
                    disabled={sending}
                  />
                  <label
                    htmlFor={id('screenshot')}
                    className={styles.fileButton}
                    aria-hidden="true"
                  >
                    Chọn ảnh
                  </label>
                  {screenshot ? (
                    <p className={styles.help}>
                      Đã chọn: {screenshot.name}{' '}
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => {
                          setScreenshot(null)
                          if (fileInput.current) fileInput.current.value = ''
                        }}
                      >
                        Bỏ ảnh
                      </button>
                    </p>
                  ) : null}
                  {errors.screenshot ? (
                    <p id={id('screenshot-error')} className={styles.error} role="alert">
                      {errors.screenshot}
                    </p>
                  ) : (
                    <p id={id('screenshot-help')} className={styles.help}>
                      PNG, JPG hoặc WebP, tối đa 5MB.
                    </p>
                  )}
                </div>

                {signedIn === false ? (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={id('email')}>
                      Email <span className={styles.optional}>(không bắt buộc)</span>
                    </label>
                    <input
                      id={id('email')}
                      className={styles.input}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setErrors((x) => ({ ...x, email: undefined }))
                      }}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={describe('email', id('email-help'))}
                      disabled={sending}
                    />
                    {errors.email ? (
                      <p id={id('email-error')} className={styles.error} role="alert">
                        {errors.email}
                      </p>
                    ) : (
                      <p id={id('email-help')} className={styles.help}>
                        Chỉ dùng để phản hồi bạn, không hiển thị công khai.
                      </p>
                    )}
                  </div>
                ) : null}

                {formError ? <Notice tone="error">{formError}</Notice> : null}

                <div className={styles.actions}>
                  <Button type="button" variant="secondary" onClick={close} disabled={sending}>
                    Đóng
                  </Button>
                  <Button type="submit" loading={sending}>
                    Gửi góp ý
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : null}
      </dialog>
    </>
  )
}
