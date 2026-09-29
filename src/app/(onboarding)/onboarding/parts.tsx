'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import styles from './stage.module.css'

/** The header slot each stage page leaves for its one action. */
export const ACTION_SLOT_ID = 'onboarding-action'

/** Renders the stage's header action into the shell's slot, once mounted. */
export function HeaderAction({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById(ACTION_SLOT_ID)), [])
  return slot ? createPortal(children, slot) : null
}

/**
 * Leaves a stage after it saved. The page is refreshed first: the browser's
 * Back then finds the stored values, not the ones the page was first drawn
 * with, so a later save cannot write the old ones back.
 */
export function useLeave(): (href: string) => void {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const target = useRef<string | null>(null)

  // The navigation waits for the refresh: one started at once would replace it.
  useEffect(() => {
    if (refreshing || target.current === null) return
    const href = target.current
    target.current = null
    router.push(href)
  }, [refreshing, router])

  return (href) => {
    target.current = href
    startTransition(() => router.refresh())
  }
}

export function Optional() {
  return <span className={styles.optional}>· Không bắt buộc</span>
}

export function Required() {
  return (
    <span className={styles.required} aria-hidden="true">
      *
    </span>
  )
}

type Option = { id: string; label: string }

/** A native select drawn as the board's control: value or placeholder, and a caret. */
export function Select({
  id,
  name,
  value,
  options,
  placeholder,
  invalid,
  describedBy,
  disabled,
  required,
  onChange,
}: {
  id: string
  name: string
  value: string
  options: readonly Option[]
  placeholder: string
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  required?: boolean
  onChange: (value: string) => void
}) {
  const label = options.find((o) => o.id === value)?.label
  return (
    <div className={`ui-input ${styles.select}`} data-invalid={invalid || undefined}>
      <span
        aria-hidden="true"
        className={`${styles.selectValue} ${label ? '' : styles.placeholder}`}
      >
        {label ?? placeholder}
      </span>
      <svg viewBox="0 0 5 4" className={styles.caret} aria-hidden="true" focusable="false">
        <path d="M0 0h5L2.5 4z" />
      </svg>
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** What a failed stage save tells the member; the server names the reason. */
export function saveMessage(caught: unknown): string {
  const code = (caught as { code?: string } | null)?.code
  if (code === 'VOCABULARY_ITEM_INACTIVE') {
    return 'Một mục đã chọn không còn khả dụng. Vui lòng chọn lại.'
  }
  if (code === 'PROFILE_VALIDATION_FAILED' || code === 'ONBOARDING_REQUIREMENTS_MISSING') {
    return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
  }
  return 'Chưa lưu được thông tin. Vui lòng thử lại.'
}
