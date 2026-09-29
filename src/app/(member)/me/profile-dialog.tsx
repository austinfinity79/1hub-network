'use client'

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'

import dialogStyles from '@/app/(onboarding)/onboarding/capability/capability.module.css'
import stage from '@/app/(onboarding)/onboarding/stage.module.css'
import { Button } from '@/components/ui'

/**
 * The in-place dialog of FP1-OWN, drawn on the L12 pattern of the L2 board
 * (DEC-L2R-D3): title and close, the fields, a rule, then "Xoá mục này" on the
 * left and "Huỷ" / "Lưu" on the right. A native modal <dialog>: focus stays
 * inside while it is open and returns to the opener when it closes.
 */
export function ProfileDialog({
  title,
  saving,
  error,
  onSubmit,
  onClose,
  onDelete,
  children,
  name,
}: {
  title: string
  saving: boolean
  error?: string
  onSubmit: () => void
  onClose: () => void
  onDelete?: () => void
  children: ReactNode
  /** `data-dialog` value, for tests. */
  name: string
}) {
  const ids = useId()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  const close = () => dialog.current?.close()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <dialog
      ref={dialog}
      className={dialogStyles.dialog}
      aria-labelledby={`${ids}-title`}
      data-dialog={name}
      onClose={onClose}
    >
      <form method="dialog" onSubmit={submit} noValidate>
        <div className={dialogStyles.dialogHead}>
          <h2 id={`${ids}-title`} className={dialogStyles.dialogTitle}>
            {title}
          </h2>
          <button type="button" className={dialogStyles.close} aria-label="Đóng" onClick={close}>
            <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>
        {children}
        {error ? (
          <p className={stage.error} role="alert">
            {error}
          </p>
        ) : null}
        <hr className={`${stage.rule} ${dialogStyles.dialogEnd}`} />
        <div className={dialogStyles.dialogFoot}>
          {onDelete ? (
            <button
              type="button"
              className={dialogStyles.delete}
              disabled={saving}
              onClick={onDelete}
            >
              Xoá mục này
            </button>
          ) : (
            <span className={dialogStyles.delete} />
          )}
          <Button variant="secondary" onClick={close}>
            Huỷ
          </Button>
          <Button type="submit" loading={saving}>
            Lưu
          </Button>
        </div>
      </form>
    </dialog>
  )
}

/** One labelled field of a dialog. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className={stage.field}>
      <label className={stage.label} htmlFor={id}>
        {label}
      </label>
      <div className={stage.control}>{children}</div>
      {error ? (
        <p className={stage.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const grid2 = `${stage.grid2} ${dialogStyles.dialogGrid}`
