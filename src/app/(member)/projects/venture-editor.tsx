'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'

import { EditorHeader } from '@/components/shell/editor-header'
import { Button, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import styles from './venture.module.css'

/**
 * WF02-S05 — Project/Startup editor for /projects/:id/edit (DEC-L2R-D4..D7,
 * DEC-WF02-S05-G1..G5). Creation is the /projects/new wizard, over the same
 * POST /ventures.
 *
 * The approved editor header plus ONE canonical form: Loại, Tên, Tóm tắt,
 * Lĩnh vực (DOMAIN), Giai đoạn (VENTURE_STAGE), the owner's own role, Tỉnh /
 * Thành phố (REGION), "Lưu". The owner of a venture that is not archived
 * also sees "Hiển thị": "Công khai" makes a venture whose saved record holds
 * name, field, description, stage and the owner's role public, with no review
 * (DEC-PDF-D1); the server checks all of it again. The A–J navigator,
 * completion count, image upload and "Xem bản public" are not rendered
 * (no public page exists yet; no field count, DEC-PDF-D3).
 * Type is chosen once at creation (G4). The owner and members with Biên tập
 * edit; Xem reads; an ARCHIVED venture is read-only (G3). The server enforces
 * all of it, and only the owner states the owner's role.
 */

type Option = { id: string; label: string }

export type VentureView = {
  id: string
  type: 'PROJECT' | 'STARTUP'
  name: string
  summary: string
  status: string
  visibility: 'PRIVATE' | 'PUBLIC'
  region_id: string
  domain_ids: string[]
  stage_id: string
  /** The viewer's role in this venture, display text; the owner's is editable here. */
  role_label: string
  permission: 'OWNER' | 'EDIT' | 'VIEW'
  can_edit: boolean
}

/** The roles PRJ1 offers its creator (DEC-L2R-D6). */
const OWNER_ROLES = ['Founder', 'Co-founder', 'Thành viên'] as const

const TYPE_LABELS = { PROJECT: 'Dự án', STARTUP: 'Startup' } as const
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hoạt động',
  ARCHIVED: 'Đã lưu trữ',
}

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF02-S05-D3). */
const COPY = {
  save: 'Lưu',
  team: 'Đội ngũ',
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
  readOnlyMember: 'Bạn có quyền Xem nên chỉ xem được hồ sơ này.',
  stagePlaceholder: 'Chọn giai đoạn',
  rolePlaceholder: 'Không chọn',
  visibility: 'Hiển thị',
  private: 'Chỉ đội thấy hồ sơ này.',
  public: 'Công khai. Bạn đã chọn công khai hồ sơ này.',
  publishRule:
    'Công khai khi hồ sơ đã lưu có đủ tên, lĩnh vực, tóm tắt, giai đoạn và vai trò của bạn.',
  missing: 'Còn thiếu:',
  publish: 'Công khai',
  publishFailed: 'Chưa công khai được. Vui lòng thử lại.',
} as const

/** What "Công khai" needs, named as the form names them (DEC-PDF-D1). */
const PUBLISH_FIELDS = {
  name: 'Tên',
  domain_ids: 'Lĩnh vực',
  summary: 'Tóm tắt',
  stage_id: 'Giai đoạn',
  owner_role_label: 'Vai trò của bạn trong đội',
} as const
type PublishField = keyof typeof PUBLISH_FIELDS

type Saved = { name: string; summary: string; domains: number; stage: string; role: string }

const missingOf = (saved: Saved): PublishField[] =>
  (Object.keys(PUBLISH_FIELDS) as PublishField[]).filter(
    (field) =>
      !{
        name: saved.name.trim(),
        domain_ids: saved.domains > 0,
        summary: saved.summary.trim(),
        stage_id: saved.stage,
        owner_role_label: saved.role.trim(),
      }[field],
  )

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
  stages,
}: {
  venture: VentureView
  regions: Option[]
  domains: Option[]
  stages: Option[]
}) {
  const editable = venture.can_edit
  const owner = venture.permission === 'OWNER'
  const [stageId, setStageId] = useState(venture.stage_id)
  const [role, setRole] = useState(venture.role_label)
  const [name, setName] = useState(venture.name)
  const [summary, setSummary] = useState(venture.summary)
  const [regionId, setRegionId] = useState(venture.region_id)
  const [selected, setSelected] = useState<string[]>(venture.domain_ids)
  const [savedName, setSavedName] = useState(venture.name)
  const [savedAt, setSavedAt] = useState<string>()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const [status, setStatus] = useState(venture.status)
  const [visibility, setVisibility] = useState(venture.visibility)
  const [saved, setSaved] = useState<Saved>({
    name: venture.name,
    summary: venture.summary,
    domains: venture.domain_ids.length,
    stage: venture.stage_id,
    role: venture.role_label,
  })
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string>()
  const missing = missingOf(saved)

  const labels = selected
    .map((id) => domains.find((d) => d.id === id)?.label)
    .filter(Boolean)
    .join(' · ')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !editable) return
    const local: Record<string, string> = {}
    if (!name.trim()) local.name = COPY.required
    if (Object.keys(local).length > 0) {
      setErrors(local)
      return
    }
    inFlight.current = true
    setSaving(true)
    setFormError(undefined)
    const body = {
      name,
      summary,
      region_id: regionId || null,
      domain_ids: selected,
      stage_id: stageId || null,
      // Only the owner states the owner's role (the server refuses it from anyone else).
      ...(owner ? { owner_role_label: role || null } : {}),
    }
    try {
      const updated = await apiRequest<{
        name: string
        summary: string | null
        domains: unknown[]
        stage: { id: string } | null
        role_label: string | null
      }>(`/ventures/${venture.id}`, { method: 'PATCH', body })
      setSavedName(updated.name)
      setSavedAt(time())
      setSaved({
        name: updated.name,
        summary: updated.summary ?? '',
        domains: updated.domains.length,
        stage: updated.stage?.id ?? '',
        role: updated.role_label ?? '',
      })
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

  async function onPublish() {
    if (inFlight.current || missing.length > 0) return
    inFlight.current = true
    setPublishing(true)
    setPublishError(undefined)
    try {
      const updated = await apiRequest<{ status: string; visibility: 'PRIVATE' | 'PUBLIC' }>(
        `/ventures/${venture.id}/publish`,
        { method: 'POST' },
      )
      setStatus(updated.status)
      setVisibility(updated.visibility)
    } catch (caught) {
      const error = caught as { fields?: Record<string, string> } | null
      const named = Object.keys(error?.fields ?? {})
        .map((key) => PUBLISH_FIELDS[key as PublishField])
        .filter(Boolean)
      setPublishError(named.length ? `${COPY.missing} ${named.join(', ')}.` : COPY.publishFailed)
    } finally {
      inFlight.current = false
      setPublishing(false)
    }
  }

  const statusText = `${visibility === 'PUBLIC' ? COPY.publish : (STATUS_LABELS[status] ?? status)}${savedAt ? ` · ${COPY.savedAt} ${savedAt}` : ''}`

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate data-venture-editor>
      <EditorHeader
        title={savedName}
        status={statusText}
        actions={
          <>
            {/* P0-SHELL (DEC-P0-SHELL-D5): the team page of this venture. */}
            <Link
              href={`/projects/${venture.id}/team`}
              className="ui-button"
              data-variant="secondary"
              data-nav="venture-team"
            >
              {COPY.team}
            </Link>
            {editable ? (
              <Button type="submit" loading={saving}>
                {COPY.save}
              </Button>
            ) : null}
          </>
        }
      />
      <div className={styles.body}>
        <div className={styles.form} data-contract="venture-form">
          {!editable ? (
            <div className={styles.notice} data-state="read-only">
              <Notice>
                {venture.status === 'ARCHIVED' ? COPY.readOnlyArchived : COPY.readOnlyMember}
              </Notice>
            </div>
          ) : null}
          {formError ? (
            <div className={styles.notice}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <fieldset className={styles.field} disabled>
            <legend className={`type-body-sm weight-semibold ${styles.label}`}>Loại</legend>
            {hint('ve-type-hint', COPY.typeHint)}
            <div className={styles.types} role="radiogroup" aria-describedby="ve-type-hint">
              {(['PROJECT', 'STARTUP'] as const).map((value) => (
                <label key={value} className={`type-body-md ${styles.typeOption}`}>
                  <input
                    type="radio"
                    name="venture-type"
                    value={value}
                    checked={venture.type === value}
                    readOnly
                  />
                  {TYPE_LABELS[value]}
                </label>
              ))}
            </div>
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
            <label htmlFor="ve-stage" className={`type-body-sm weight-semibold ${styles.label}`}>
              Giai đoạn
            </label>
            <select
              id="ve-stage"
              className={`type-body-md ${styles.select}`}
              value={stageId}
              disabled={!editable}
              onChange={(e) => setStageId(e.target.value)}
            >
              <option value="" disabled>
                {COPY.stagePlaceholder}
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {fieldError('stage_id')}
          </section>

          {owner ? (
            <section className={styles.field}>
              <label htmlFor="ve-role" className={`type-body-sm weight-semibold ${styles.label}`}>
                Vai trò của bạn trong đội
              </label>
              <select
                id="ve-role"
                className={`type-body-md ${styles.select}`}
                value={role}
                disabled={!editable}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">{COPY.rolePlaceholder}</option>
                {[
                  ...OWNER_ROLES,
                  ...(role && !OWNER_ROLES.includes(role as never) ? [role] : []),
                ].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {fieldError('owner_role_label')}
            </section>
          ) : null}

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

          {owner && status !== 'ARCHIVED' ? (
            <section className={styles.field} data-publication={visibility}>
              <p className={`type-body-sm weight-semibold ${styles.label}`}>{COPY.visibility}</p>
              {visibility === 'PUBLIC' ? (
                <p className="type-body-md">{COPY.public}</p>
              ) : (
                <>
                  <p className="type-body-md">{COPY.private}</p>
                  {hint('ve-publish-hint', COPY.publishRule)}
                  {missing.length > 0 ? (
                    <p className={`type-meta-xs ${styles.hint}`} data-publish-missing>
                      {COPY.missing} {missing.map((field) => PUBLISH_FIELDS[field]).join(', ')}.
                    </p>
                  ) : null}
                  <div className={styles.publish}>
                    <Button
                      variant="secondary"
                      loading={publishing}
                      disabled={missing.length > 0}
                      aria-describedby="ve-publish-hint"
                      onClick={() => void onPublish()}
                      data-action="publish"
                    >
                      {COPY.publish}
                    </Button>
                  </div>
                  {publishError ? (
                    <p className={`type-meta-xs ${styles.error}`} role="alert">
                      {publishError}
                    </p>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </form>
  )
}
