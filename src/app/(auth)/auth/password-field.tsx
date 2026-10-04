'use client'

import { useState, type Ref } from 'react'

import { Field, TextInput } from '@/components/ui'
import { passwordStrength } from '@/lib/auth/password-rules'

import styles from './auth-entry.module.css'

/**
 * S1-UAT-01 — password control shared by sign-in, sign-up and reset (US-01.02
 * "Nút Hiện để xem mật khẩu", "Thanh độ mạnh mật khẩu cập nhật khi gõ"). The
 * shared Field / TextInput primitives, plus a "Hiện" / "Ẩn" toggle that is a
 * real button announcing its state, and an optional strength meter.
 */
export function PasswordField({
  label,
  name,
  value,
  onChange,
  error,
  helper,
  autoComplete,
  disabled,
  meter = false,
  inputRef,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  helper?: string
  autoComplete: 'current-password' | 'new-password'
  disabled?: boolean
  meter?: boolean
  inputRef?: Ref<HTMLInputElement>
}) {
  const [visible, setVisible] = useState(false)
  const strength = passwordStrength(value)

  return (
    <div className={styles.passwordBlock}>
      <Field label={label} error={error} helper={helper}>
        {({ id, invalid, describedBy }) => (
          <>
            <TextInput
              ref={inputRef}
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type={visible ? 'text' : 'password'}
              name={name}
              autoComplete={autoComplete}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
            />
            <button
              type="button"
              className={styles.reveal}
              aria-pressed={visible}
              aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
              onClick={() => setVisible((v) => !v)}
              disabled={disabled}
            >
              {visible ? 'Ẩn' : 'Hiện'}
            </button>
          </>
        )}
      </Field>
      {meter ? (
        <div className={styles.meter} data-strength={value ? strength.level : 0}>
          <div className={styles.meterBars} aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} data-on={value && n <= strength.level ? 'true' : undefined} />
            ))}
          </div>
          <p className={styles.meterLabel} aria-live="polite">
            {value ? `Độ mạnh: ${strength.label}` : 'Tối thiểu 8 ký tự, có cả chữ và số.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
