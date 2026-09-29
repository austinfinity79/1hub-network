'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui'

import stage from '../stage.module.css'
import styles from './capability.module.css'

/**
 * L12 — "Sửa kinh nghiệm", the experience editor the L1 and L2 boards share.
 * It edits one record of the list the stage holds; the stage saves the list.
 *
 * Title is required. Months are written "MM/YYYY" as the board draws them and
 * handed on as "YYYY-MM". The board's "Có trên HUB · tự liên kết" organisation
 * link is not drawn: organisations are free text here (no source, D-P1).
 */

export type ExperienceRecord = {
  title: string
  organization_name: string
  /** "YYYY-MM", or '' when not given. */
  started_on: string
  /** "YYYY-MM"; '' with a start means current. */
  ended_on: string
  description: string
}

const MESSAGES = {
  title: 'Vui lòng nhập chức danh.',
  month: 'Nhập theo dạng MM/YYYY.',
  start: 'Vui lòng nhập thời gian bắt đầu.',
  order: 'Thời gian kết thúc phải sau thời gian bắt đầu.',
} as const

const toField = (month: string) => (month ? `${month.slice(5)}/${month.slice(0, 4)}` : '')

/** "MM/YYYY" → "YYYY-MM"; '' stays ''; anything else is null. */
function toMonth(text: string): string | null {
  const value = text.trim()
  if (!value) return ''
  const match = /^(0?[1-9]|1[0-2])\/((?:19|20)\d{2})$/.exec(value)
  return match ? `${match[2]}-${match[1]!.padStart(2, '0')}` : null
}

/**
 * A save that answers with a promise keeps the dialog open until the server
 * stored it (FP1-OWN); a plain save closes it at once (the L1 stage keeps the
 * list and saves it later).
 */
type Outcome = void | Promise<boolean>

export function ExperienceDialog({
  record,
  onSave,
  onDelete,
  onClose,
  saving = false,
  error,
}: {
  /** The record being edited, or null for a new one. */
  record: ExperienceRecord | null
  onSave: (record: ExperienceRecord) => Outcome
  /** Present only when an existing record is edited. */
  onDelete?: () => Outcome
  onClose: () => void
  saving?: boolean
  /** The server's refusal, shown in the dialog that is still open. */
  error?: string
}) {
  const ids = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(record?.title ?? '')
  const [organization, setOrganization] = useState(record?.organization_name ?? '')
  const [from, setFrom] = useState(toField(record?.started_on ?? ''))
  const [to, setTo] = useState(toField(record?.ended_on ?? ''))
  const [current, setCurrent] = useState(Boolean(record?.started_on && !record.ended_on))
  const [description, setDescription] = useState(record?.description ?? '')
  const [errors, setErrors] = useState<{ title?: string; from?: string; to?: string }>({})

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  const id = (name: string) => `${ids}-${name}`

  // Closing through the element hands the focus back to the control that opened it.
  const close = () => dialog.current?.close()
  const closeWhenStored = (outcome: Outcome) => {
    if (outcome) void outcome.then((stored) => stored && close())
    else close()
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const started = toMonth(from)
    const ended = current ? '' : toMonth(to)
    const next: typeof errors = {}
    if (!title.trim()) next.title = MESSAGES.title
    if (started === null) next.from = MESSAGES.month
    else if (current && !started) next.from = MESSAGES.start
    if (ended === null) next.to = MESSAGES.month
    else if (ended && !started) next.from = MESSAGES.start
    else if (ended && started && ended < started) next.to = MESSAGES.order
    setErrors(next)
    if (Object.keys(next).length > 0) return
    closeWhenStored(
      onSave({
        title: title.trim(),
        organization_name: organization.trim(),
        started_on: started ?? '',
        ended_on: ended ?? '',
        description: description.trim(),
      }),
    )
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={id('title')}
      data-dialog="experience"
      onClose={onClose}
    >
      <form method="dialog" onSubmit={onSubmit} noValidate>
        <div className={styles.dialogHead}>
          <h2 id={id('title')} className={styles.dialogTitle}>
            {record ? 'Sửa kinh nghiệm' : 'Thêm kinh nghiệm'}
          </h2>
          <button type="button" className={styles.close} aria-label="Đóng" onClick={close}>
            <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <div className={stage.field}>
          <label className={stage.label} htmlFor={id('job')}>
            Chức danh
          </label>
          <div className={stage.control}>
            <input
              id={id('job')}
              className="ui-input"
              name="title"
              required
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? id('job-error') : undefined}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {errors.title ? (
            <p id={id('job-error')} role="alert" className={stage.error}>
              {errors.title}
            </p>
          ) : null}
        </div>

        <div className={stage.field}>
          <label className={stage.label} htmlFor={id('org')}>
            Tổ chức
          </label>
          <div className={stage.control}>
            <input
              id={id('org')}
              className="ui-input"
              name="organization_name"
              autoComplete="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
        </div>

        <div className={`${stage.grid2} ${styles.dialogGrid}`}>
          <div className={stage.field}>
            <label className={stage.label} htmlFor={id('from')}>
              Từ
            </label>
            <div className={stage.control}>
              <input
                id={id('from')}
                className="ui-input"
                name="started_on"
                inputMode="numeric"
                placeholder="MM/YYYY"
                aria-invalid={errors.from ? true : undefined}
                aria-describedby={errors.from ? id('from-error') : undefined}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            {errors.from ? (
              <p id={id('from-error')} role="alert" className={stage.error}>
                {errors.from}
              </p>
            ) : null}
          </div>
          <div className={stage.field}>
            <label className={stage.label} htmlFor={id('to')}>
              Đến
            </label>
            <div className={stage.control}>
              <input
                id={id('to')}
                className="ui-input"
                name="ended_on"
                inputMode="numeric"
                placeholder="MM/YYYY"
                disabled={current}
                aria-invalid={errors.to ? true : undefined}
                aria-describedby={errors.to ? id('to-error') : undefined}
                value={current ? 'Hiện tại' : to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {errors.to ? (
              <p id={id('to-error')} role="alert" className={stage.error}>
                {errors.to}
              </p>
            ) : null}
          </div>
        </div>

        <label className={styles.current}>
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => {
              setCurrent(e.target.checked)
              if (e.target.checked) setTo('')
            }}
          />
          Tôi đang làm ở đây
        </label>

        <div className={stage.field}>
          <label className={stage.label} htmlFor={id('description')}>
            Mô tả
          </label>
          <div className={stage.control}>
            <textarea
              id={id('description')}
              className="ui-input"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className={stage.error} role="alert">
            {error}
          </p>
        ) : null}

        <hr className={`${stage.rule} ${styles.dialogEnd}`} />

        <div className={styles.dialogFoot}>
          {onDelete ? (
            <button
              type="button"
              className={styles.delete}
              disabled={saving}
              onClick={() => closeWhenStored(onDelete())}
            >
              Xoá mục này
            </button>
          ) : (
            <span className={styles.delete} />
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
