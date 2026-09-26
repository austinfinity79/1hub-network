'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { EditorHeader } from '@/components/shell/editor-header'
import { Button, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import styles from './venture.module.css'

/**
 * WF02-S05 — Project/Startup editor for /projects/new and /projects/:id/edit
 * (DEC-WF02-H6/H7, DEC-WF02-S05-G1..G5, DEC-WF02-S05-D1..D3).
 *
 * The approved editor header plus ONE canonical form (G1 addendum): Loại,
 * Tên, Tóm tắt, Lĩnh vực (DOMAIN), Tỉnh / Thành phố (REGION), "Lưu". The
 * A–J navigator, required-field bar, completion %, section C, image upload,
 * editorial rules, "Xem bản public" and "Gửi HUB duyệt" are not rendered.
 * Type is chosen once at creation (G4). Only the owner edits, and never an
 * ARCHIVED venture (G3); the server enforces both.
 */

type Option = { id: string; label: string }

export type VentureView = {
  id: string
  type: 'PROJECT' | 'STARTUP'
  name: string
  summary: string
  status: string
  region_id: string
  domain_ids: string[]
  can_edit: boolean
}

const TYPE_LABELS = { PROJECT: 'Dự án', STARTUP: 'Startup' } as const
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hoạt động',
  ARCHIVED: 'Đã lưu trữ',
}

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF02-S05-D3). */
const COPY = {
  newTitle: 'Dự án / startup mới',
  newStatus: 'Chưa lưu',
  save: 'Lưu',
  savedAt: 'đã lưu lúc',
  typeHint: 'Chọn một lần khi tạo, không đổi được sau đó.',
  summaryHint: 'Vài câu về việc dự án đang làm.',
  domainHint: 'Chọn từ danh mục HUB quản lý, không gõ tự do.',
  domainPlaceholder: 'Chọn lĩnh vực',
  regionPlaceholder: 'Chưa chọn',
  required: 'Trường này là bắt buộc.',
  inactive: 'Một mục đã chọn không còn khả dụng. Vui lòng chọn lại.',
  invalid: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
  readOnlyArchived: 'Dự án đã lưu trữ nên chỉ xem được, không sửa được.',
  readOnlyMember: 'Chỉ chủ sở hữu mới sửa được thông tin này.',
} as const

const time = () =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

export function VentureEditor({
  venture,
  regions,
  domains,
}: {
  /** Null on /projects/new. */
  venture: VentureView | null
  regions: Option[]
  domains: Option[]
}) {
  const router = useRouter()
  const creating = venture === null
  const editable = creating || venture.can_edit
  const [type, setType] = useState<'PROJECT' | 'STARTUP' | ''>(venture?.type ?? '')
  const [name, setName] = useState(venture?.name ?? '')
  const [summary, setSummary] = useState(venture?.summary ?? '')
  const [regionId, setRegionId] = useState(venture?.region_id ?? '')
  const [selected, setSelected] = useState<string[]>(venture?.domain_ids ?? [])
  const [savedName, setSavedName] = useState(venture?.name ?? '')
  const [savedAt, setSavedAt] = useState<string>()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const labels = selected
    .map((id) => domains.find((d) => d.id === id)?.label)
    .filter(Boolean)
    .join(' · ')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !editable) return
    const local: Record<string, string> = {}
    if (creating && !type) local.type = COPY.required
    if (!name.trim()) local.name = COPY.required
    if (Object.keys(local).length > 0) {
      setErrors(local)
      return
    }
    inFlight.current = true
    setSaving(true)
    setFormError(undefined)
    const body = { name, summary, region_id: regionId || null, domain_ids: selected }
    try {
      if (creating) {
        const created = await apiRequest<{ id: string }>('/ventures', {
          method: 'POST',
          body: { type, ...body },
        })
        router.replace(`/projects/${created.id}/edit`)
        return
      }
      const updated = await apiRequest<{ name: string }>(`/ventures/${venture.id}`, {
        method: 'PATCH',
        body,
      })
      setSavedName(updated.name)
      setSavedAt(time())
    } catch (caught) {
      const error = caught as { code?: string; fields?: Record<string, string> } | null
      const mapped: Record<string, string> = {}
      for (const [key, reason] of Object.entries(error?.fields ?? {})) {
        mapped[key] = reason === 'required' ? COPY.required : COPY.invalid
      }
      setErrors(mapped)
      setFormError(error?.code === 'VOCABULARY_ITEM_INACTIVE' ? COPY.inactive : COPY.failed)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const hint = (id: string, text: string) => (
    <p id={id} className={`type-meta-xs ${styles.hint}`}>
      {text}
    </p>
  )
  const fieldError = (key: string) =>
    errors[key] ? (
      <p className={`type-meta-xs ${styles.error}`} role="alert">
        {errors[key]}
      </p>
    ) : null

  const status = creating
    ? COPY.newStatus
    : `${STATUS_LABELS[venture.status] ?? venture.status}${savedAt ? ` · ${COPY.savedAt} ${savedAt}` : ''}`

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate data-venture-editor>
      <EditorHeader
        title={creating ? COPY.newTitle : savedName}
        status={status}
        actions={
          editable ? (
            <Button type="submit" loading={saving}>
              {COPY.save}
            </Button>
          ) : null
        }
      />
      <div className={styles.body}>
        <div className={styles.form} data-contract="venture-form">
          {!editable ? (
            <div className={styles.notice} data-state="read-only">
              <Notice>
                {venture?.status === 'ARCHIVED' ? COPY.readOnlyArchived : COPY.readOnlyMember}
              </Notice>
            </div>
          ) : null}
          {formError ? (
            <div className={styles.notice}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <fieldset className={styles.field} disabled={!creating}>
            <legend className={`type-body-sm weight-semibold ${styles.label}`}>Loại</legend>
            {hint('ve-type-hint', COPY.typeHint)}
            <div className={styles.types} role="radiogroup" aria-describedby="ve-type-hint">
              {(['PROJECT', 'STARTUP'] as const).map((value) => (
                <label key={value} className={`type-body-md ${styles.typeOption}`}>
                  <input
                    type="radio"
                    name="venture-type"
                    value={value}
                    checked={type === value}
                    onChange={() => {
                      setType(value)
                      setErrors((e) => ({ ...e, type: undefined }))
                    }}
                  />
                  {TYPE_LABELS[value]}
                </label>
              ))}
            </div>
            {fieldError('type')}
          </fieldset>

          <section className={styles.field}>
            <label htmlFor="ve-name" className={`type-body-sm weight-semibold ${styles.label}`}>
              Tên
            </label>
            <TextInput
              id="ve-name"
              value={name}
              disabled={!editable}
              invalid={Boolean(errors.name)}
              onChange={(e) => {
                setName(e.target.value)
                setErrors((x) => ({ ...x, name: undefined }))
              }}
            />
            {fieldError('name')}
          </section>

          <section className={styles.field}>
            <label htmlFor="ve-summary" className={`type-body-sm weight-semibold ${styles.label}`}>
              Tóm tắt
            </label>
            {hint('ve-summary-hint', COPY.summaryHint)}
            <textarea
              id="ve-summary"
              className={`ui-input ${styles.textarea}`}
              rows={3}
              value={summary}
              disabled={!editable}
              aria-describedby="ve-summary-hint"
              onChange={(e) => setSummary(e.target.value)}
            />
            {fieldError('summary')}
          </section>

          <section className={styles.field}>
            <p id="ve-domain-label" className={`type-body-sm weight-semibold ${styles.label}`}>
              Lĩnh vực
            </p>
            {hint('ve-domain-hint', COPY.domainHint)}
            <button
              type="button"
              className={`type-body-md ${styles.pickerBox}`}
              aria-expanded={open}
              aria-controls="ve-domain-list"
              aria-labelledby="ve-domain-label"
              aria-describedby="ve-domain-hint"
              disabled={!editable}
              onClick={() => setOpen((o) => !o)}
            >
              <span className={labels ? undefined : styles.placeholder}>
                {labels || COPY.domainPlaceholder}
              </span>
            </button>
            {open && editable ? (
              <ul id="ve-domain-list" className={styles.chips} aria-label="Lĩnh vực">
                {domains.map((d) => {
                  const on = selected.includes(d.id)
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        className={`type-meta-xs weight-medium ${styles.chip}`}
                        aria-pressed={on}
                        onClick={() =>
                          setSelected((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))
                        }
                      >
                        {d.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {fieldError('domain_ids')}
          </section>

          <section className={styles.field}>
            <label htmlFor="ve-region" className={`type-body-sm weight-semibold ${styles.label}`}>
              Tỉnh / Thành phố
            </label>
            <select
              id="ve-region"
              className={`type-body-md ${styles.select}`}
              value={regionId}
              disabled={!editable}
              onChange={(e) => setRegionId(e.target.value)}
            >
              <option value="">{COPY.regionPlaceholder}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {fieldError('region_id')}
          </section>
        </div>
      </div>
    </form>
  )
}
