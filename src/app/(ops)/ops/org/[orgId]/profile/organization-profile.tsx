'use client'

import { useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import { ORGANIZATION_LIMITS } from '@/lib/ops/organization-limits'
import type { OrganizationProfileDTO } from '@/lib/ops/organization-profile'

import styles from './profile.module.css'

/**
 * WF03-S06 — organization profile / detail (DEC-WF03-C1/G8/G9, DEC-WF03-S06-D1..D4).
 *
 * The approved ORGP2 overview mapped onto the canonical Organization: the
 * header band (logo tile, name, type and status chips, canonical parent), a
 * "Thông tin hồ sơ" card with a VIEW state and an explicit EDIT state for the
 * two editable fields (name, description), and the read-only "Quan hệ tổ
 * chức" card from the canonical hierarchy. The drawn publication checklist,
 * representatives, visibility groups, verification, programmes, change
 * history, "Yêu cầu đổi chapter cha" and "Yêu cầu lưu trữ" have no P0 source
 * or belong to S08, and are not rendered.
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S06-D4). */
const COPY = {
  profile: 'Thông tin hồ sơ',
  profileTitle: 'Tên, loại và giới thiệu',
  edit: 'Chỉnh sửa',
  save: 'Lưu thay đổi',
  saving: 'Đang lưu…',
  cancel: 'Huỷ',
  name: 'Tên tổ chức',
  type: 'Loại',
  status: 'Trạng thái',
  description: 'Giới thiệu',
  noDescription: 'Chưa có giới thiệu.',
  locked: 'Loại, trạng thái và quan hệ tổ chức không sửa ở hồ sơ.',
  saved: 'Đã lưu hồ sơ tổ chức.',
  archived: 'Tổ chức đã lưu trữ — hồ sơ chỉ xem.',
  failed: 'Không lưu được. Kiểm tra kết nối rồi thử lại.',
  conflict: 'Tổ chức đã lưu trữ nên không sửa được hồ sơ.',
  invalid: 'Kiểm tra lại các trường được đánh dấu.',
  relationships: 'Quan hệ tổ chức',
  parentOf: (name: string) => `Thuộc ${name}`,
  noParent: 'Không thuộc tổ chức cấp trên',
  belongs: 'Thuộc',
  child: 'Trực thuộc',
  active: 'Đang hiệu lực',
  noChildren: 'Chưa có đơn vị trực thuộc.',
  relationshipsNote:
    'Quan hệ tổ chức chỉ xem ở đây — thay đổi thực hiện ở mục Quan hệ tổ chức, không qua hồ sơ.',
} as const

const FIELD_ERRORS: Record<string, string> = {
  required: 'Không được để trống.',
  too_long: 'Quá dài.',
  invalid: 'Giá trị không hợp lệ.',
}

// Same wording as S01.
const TYPE_LABELS: Record<string, string> = { HUB: 'HUB', CHAPTER: 'Chapter', CLB: 'CLB' }
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang công khai',
  ARCHIVED: 'Đã lưu trữ',
}

type Mode = { kind: 'view' } | { kind: 'edit'; name: string; description: string }
type Notice = { tone: 'ok' | 'error'; text: string } | null

export function OrganizationProfile({ initial }: { initial: OrganizationProfileDTO }) {
  const [org, setOrg] = useState(initial)
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const archived = org.status === 'ARCHIVED'
  const canEdit = org.permissions.includes('org:manage') && !archived

  const save = async () => {
    if (mode.kind !== 'edit') return
    setBusy(true)
    setNotice(null)
    setFieldErrors({})
    const body: Record<string, string> = {}
    if (mode.name.trim() !== org.name) body.name = mode.name
    if (mode.description.trim() !== (org.description ?? '')) body.description = mode.description
    try {
      const next =
        Object.keys(body).length === 0
          ? org
          : await apiRequest<OrganizationProfileDTO>(`/ops/organizations/${org.id}/profile`, {
              method: 'PATCH',
              body,
            })
      setOrg(next)
      setMode({ kind: 'view' })
      setNotice({ tone: 'ok', text: COPY.saved })
    } catch (error) {
      const e = error as { code?: string; fields?: Record<string, string> }
      if (e.code === 'PROFILE_VALIDATION_FAILED' && e.fields) {
        setFieldErrors(e.fields)
        setNotice({ tone: 'error', text: COPY.invalid })
      } else if (e.code === 'MEMBERSHIP_INVALID_TRANSITION') {
        setNotice({ tone: 'error', text: COPY.conflict })
      } else {
        // Never surface status codes, scope ids or raw errors.
        setNotice({ tone: 'error', text: COPY.failed })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page} data-screen="WF03-S06" data-mode={mode.kind}>
      <header className={styles.header}>
        <span className={styles.logo} aria-hidden="true" />
        <div className={styles.identity}>
          <h1 className={styles.name} data-org-name>
            {org.name}
          </h1>
          <p className={styles.chips}>
            <span className={styles.chip} data-org-type>
              {TYPE_LABELS[org.type] ?? org.type}
            </span>
            <span className={`${styles.chip} ${styles.statusChip}`} data-org-status>
              {STATUS_LABELS[org.status] ?? org.status}
            </span>
            {org.parent ? (
              <span className={styles.parentText}>· thuộc {org.parent.name}</span>
            ) : null}
          </p>
        </div>
      </header>

      <div className={styles.body}>
        {notice ? (
          <p
            className={`${styles.notice} ${notice.tone === 'ok' ? styles.noticeOk : styles.noticeError}`}
            role={notice.tone === 'ok' ? 'status' : 'alert'}
            data-state={notice.tone === 'ok' ? 'save-success' : 'save-failed'}
          >
            {notice.text}
          </p>
        ) : null}

        <section className={styles.card} data-card="profile">
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.eyebrow}>{COPY.profile}</h2>
              <p className={styles.cardTitle}>{COPY.profileTitle}</p>
            </div>
            {mode.kind === 'view' && canEdit ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setNotice(null)
                  setFieldErrors({})
                  setMode({ kind: 'edit', name: org.name, description: org.description ?? '' })
                }}
                data-action="edit"
              >
                {COPY.edit}
              </button>
            ) : null}
          </div>

          {mode.kind === 'view' ? (
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>{COPY.name}</dt>
                <dd data-fact="name">{org.name}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.type}</dt>
                <dd>{TYPE_LABELS[org.type] ?? org.type}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.status}</dt>
                <dd>{STATUS_LABELS[org.status] ?? org.status}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.description}</dt>
                <dd data-fact="description" className={styles.multiline}>
                  {org.description ?? COPY.noDescription}
                </dd>
              </div>
            </dl>
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
              data-profile-form
              noValidate
            >
              <label className={styles.field} htmlFor="org-name">
                <span className={styles.label}>{COPY.name}</span>
                <input
                  id="org-name"
                  className={styles.input}
                  value={mode.name}
                  maxLength={ORGANIZATION_LIMITS.name}
                  aria-invalid={Boolean(fieldErrors.name)}
                  onChange={(e) => setMode({ ...mode, name: e.target.value })}
                />
                {fieldErrors.name ? (
                  <span className={styles.fieldError} data-field-error="name">
                    {FIELD_ERRORS[fieldErrors.name] ?? FIELD_ERRORS.invalid}
                  </span>
                ) : null}
              </label>
              <label className={styles.field} htmlFor="org-description">
                <span className={styles.label}>{COPY.description}</span>
                <textarea
                  id="org-description"
                  className={`${styles.input} ${styles.textarea}`}
                  value={mode.description}
                  maxLength={ORGANIZATION_LIMITS.description}
                  rows={5}
                  aria-invalid={Boolean(fieldErrors.description)}
                  onChange={(e) => setMode({ ...mode, description: e.target.value })}
                />
                {fieldErrors.description ? (
                  <span className={styles.fieldError} data-field-error="description">
                    {FIELD_ERRORS[fieldErrors.description] ?? FIELD_ERRORS.invalid}
                  </span>
                ) : null}
              </label>
              <p className={styles.note}>{COPY.locked}</p>
              <div className={styles.actions}>
                <button type="submit" className={styles.primary} disabled={busy} data-action="save">
                  {busy ? COPY.saving : COPY.save}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => {
                    setFieldErrors({})
                    setNotice(null)
                    setMode({ kind: 'view' })
                  }}
                  data-action="cancel"
                >
                  {COPY.cancel}
                </button>
              </div>
            </form>
          )}
          {archived ? <p className={styles.note}>{COPY.archived}</p> : null}
        </section>

        <section className={styles.card} data-card="relationships">
          <h2 className={styles.eyebrow}>{COPY.relationships}</h2>
          <p className={styles.cardTitle}>
            {org.parent ? COPY.parentOf(org.parent.name) : COPY.noParent}
          </p>
          <ul className={styles.relations}>
            {org.parent ? (
              <li className={styles.relation} data-relation="parent">
                <span className={styles.relChip}>{COPY.belongs}</span>
                <span className={styles.relName}>{org.parent.name}</span>
                <span className={styles.relMeta}>
                  {TYPE_LABELS[org.parent.type] ?? org.parent.type} · {COPY.active}
                </span>
              </li>
            ) : null}
            {org.children.map((c) => (
              <li key={c.id} className={styles.relation} data-relation="child">
                <span className={styles.relChip}>{COPY.child}</span>
                <span className={styles.relName}>{c.name}</span>
                <span className={styles.relMeta}>
                  {TYPE_LABELS[c.type] ?? c.type} · {COPY.active}
                </span>
              </li>
            ))}
          </ul>
          {org.children.length === 0 ? <p className={styles.note}>{COPY.noChildren}</p> : null}
          <p className={styles.note}>{COPY.relationshipsNote}</p>
        </section>
      </div>
    </div>
  )
}
