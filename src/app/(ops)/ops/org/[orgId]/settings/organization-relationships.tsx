'use client'

import { useRef, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import { RELATIONSHIP_LIMITS } from '@/lib/ops/relationship-rules'
import type { OrganizationRelationshipsDTO, RelationshipDTO } from '@/lib/ops/relationships'

import styles from './relationships.module.css'

/**
 * WF03-S08 — organization settings / relationships
 * (DEC-WF03-S08-RELATIONSHIP-CONTRACT, DEC-WF03-S08-D1..D4).
 *
 * The approved ADM21 frame on the canonical hierarchy: title + "+ Thêm quan
 * hệ", the tree position (parent → this organization → children), the ACTIVE
 * relationships with "Kết thúc" (close with an optional reason; history kept),
 * the closed history, the add form (this organization as parent of a child, or
 * a new parent for it — an explicit parent change when it already has one),
 * and the frozen valid-pair rules. Choices come from the server's candidates;
 * every call is re-validated server-side. The change-parent request queue,
 * partner / co-organizer types and the audit-log card are not P0 (not rendered).
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S08-D4). */
const COPY = {
  title: (name: string) => `${name} · quan hệ tổ chức`,
  summary: (active: number, closed: number) =>
    `${active} quan hệ đang hiệu lực · ${closed} đã kết thúc`,
  add: '+ Thêm quan hệ',
  tree: 'Vị trí trong cây HUB',
  childCount: (n: number) => `${n} đơn vị trực thuộc`,
  active: 'Đang hiệu lực',
  closed: 'Đã kết thúc · giữ lịch sử',
  columns: ['Loại quan hệ', 'Tổ chức', 'Hiệu lực từ', 'Ghi chú'],
  belongs: 'Thuộc',
  parentOf: 'Đơn vị cha của',
  none: 'Chưa có quan hệ đang hiệu lực.',
  noHistory: 'Chưa có quan hệ đã kết thúc.',
  end: 'Kết thúc',
  reason: 'Lý do (không bắt buộc)',
  confirmEnd: 'Xác nhận kết thúc',
  cancel: 'Huỷ',
  addTitle: 'Thêm quan hệ',
  type: 'Loại quan hệ',
  target: 'Tổ chức đích',
  asParent: 'Đơn vị cha của',
  asChild: 'Thuộc (đơn vị cha)',
  changeParent: 'Đổi đơn vị cha',
  choose: 'Chọn tổ chức',
  save: 'Lưu quan hệ',
  noCandidates: 'Không có tổ chức hợp lệ trong phạm vi quản lý của bạn.',
  changeNote: (name: string) =>
    `Quan hệ hiện tại với ${name} sẽ chuyển sang "Đã kết thúc" và vẫn giữ trong lịch sử.`,
  saved: 'Đã lưu quan hệ.',
  ended: 'Đã kết thúc quan hệ.',
  failed: 'Không lưu được. Tải lại để xem trạng thái mới nhất.',
  conflict: 'Quan hệ đã thay đổi hoặc không còn hợp lệ. Dữ liệu đã được tải lại.',
  rules: 'Cặp cha-con hợp lệ',
} as const

const TYPE_LABELS: Record<string, string> = { HUB: 'HUB', CHAPTER: 'Chapter', CLB: 'CLB' }
const RULES: Array<[string, string]> = [
  ['HUB', 'không có cha'],
  ['Chapter', 'cha = đúng 1 HUB'],
  ['CLB', 'cha = đúng 1 Chapter'],
  ['Loại khác', 'không quản lý quan hệ ở đây'],
]
const REASONS: Record<string, string> = {
  type_not_allowed: 'Cặp loại tổ chức này không hợp lệ.',
  cycle: 'Quan hệ này sẽ tạo vòng lặp trong cây.',
  self: 'Không thể chọn chính tổ chức này.',
}

const zone = 'Asia/Ho_Chi_Minh'
const date = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))

type Mode = 'CHILD' | 'PARENT'
type Notice = { tone: 'ok' | 'error'; text: string } | null

export function OrganizationRelationships({ initial }: { initial: OrganizationRelationshipsDTO }) {
  const [model, setModel] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [closing, setClosing] = useState<{ id: string; reason: string } | null>(null)
  const org = model.organization
  const { candidates } = model
  const [mode, setMode] = useState<Mode>(candidates.children.length ? 'CHILD' : 'PARENT')
  const [target, setTarget] = useState('')
  const formRef = useRef<HTMLSelectElement>(null)
  const base = `/ops/organizations/${org.id}`
  const options = mode === 'CHILD' ? candidates.children : candidates.parents
  const active = [...(model.parent ? [model.parent] : []), ...model.children]

  const reload = async () => {
    setModel(await apiRequest<OrganizationRelationshipsDTO>(`${base}/relationships`))
  }

  const run = async (call: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    setNotice(null)
    setFieldError(null)
    try {
      await call()
      await reload()
      setNotice({ tone: 'ok', text: ok })
      return true
    } catch (error) {
      const e = error as { code?: string; fields?: Record<string, string> }
      const reason = e.fields ? Object.values(e.fields)[0] : undefined
      if (e.code === 'PROFILE_VALIDATION_FAILED' && reason && REASONS[reason]) {
        setFieldError(REASONS[reason]!)
      } else {
        // Never surface status codes, scope ids or raw errors.
        setNotice({
          tone: 'error',
          text: e.code === 'MEMBERSHIP_INVALID_TRANSITION' ? COPY.conflict : COPY.failed,
        })
      }
      await reload().catch(() => undefined)
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(
      () =>
        mode === 'CHILD'
          ? apiRequest(`${base}/relationships`, {
              method: 'POST',
              idempotencyKey: crypto.randomUUID(),
              body: { target_organization_id: target, relationship_type: 'PARENT' },
            })
          : apiRequest(`/ops/organizations/${target}/relationships`, {
              method: 'POST',
              idempotencyKey: crypto.randomUUID(),
              body: {
                target_organization_id: org.id,
                relationship_type: 'PARENT',
                ...(model.parent ? { replaces_relationship_id: model.parent.id } : {}),
              },
            }),
      COPY.saved,
    ).then((ok) => ok && setTarget(''))

  const end = (r: RelationshipDTO, reason: string) =>
    run(
      () =>
        apiRequest(`${base}/relationships/${r.id}/close`, {
          method: 'POST',
          idempotencyKey: crypto.randomUUID(),
          body: reason.trim() ? { reason } : {},
        }),
      COPY.ended,
    ).then((ok) => ok && setClosing(null))

  const canAdd = candidates.children.length + candidates.parents.length > 0

  return (
    <div className={styles.page} data-screen="WF03-S08">
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{COPY.title(org.name)}</h1>
            <p className={styles.subtitle}>{COPY.summary(active.length, model.history.length)}</p>
          </div>
          {canAdd ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => formRef.current?.focus()}
              data-action="focus-add"
            >
              {COPY.add}
            </button>
          ) : null}
        </header>

        {notice ? (
          <p
            className={`${styles.notice} ${notice.tone === 'ok' ? styles.noticeOk : styles.noticeError}`}
            role={notice.tone === 'ok' ? 'status' : 'alert'}
            data-state={notice.tone === 'ok' ? 'save-success' : 'save-failed'}
          >
            {notice.text}
          </p>
        ) : null}

        <section className={styles.card} data-card="tree">
          <h2 className={styles.eyebrow}>{COPY.tree}</h2>
          <p className={styles.tree}>
            {model.parent ? (
              <>
                <span className={styles.node}>{model.parent.organization.name}</span>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              </>
            ) : null}
            <span className={`${styles.node} ${styles.current}`} aria-current="true">
              {org.name}
            </span>
            {model.children.length ? (
              <>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
                <span className={styles.node}>{COPY.childCount(model.children.length)}</span>
              </>
            ) : null}
          </p>
        </section>

        <section className={styles.card} data-card="active">
          <h2 className={styles.eyebrow}>{COPY.active}</h2>
          <div className={styles.table} role="table" aria-label={COPY.active}>
            <div className={styles.head} role="row">
              {COPY.columns.map((c) => (
                <span key={c} role="columnheader">
                  {c}
                </span>
              ))}
              <span role="columnheader" />
            </div>
            {active.length === 0 ? <p className={styles.empty}>{COPY.none}</p> : null}
            {active.map((r) => (
              <div key={r.id} role="row" className={styles.rowWrap} data-relationship={r.id}>
                <div className={styles.row}>
                  <span role="cell">
                    <span className={styles.chip}>
                      {r.direction === 'PARENT' ? COPY.belongs : COPY.parentOf}
                    </span>
                  </span>
                  <span role="cell" className={styles.name}>
                    {r.organization.name}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {date(r.started_at)}
                  </span>
                  <span role="cell" className={styles.cell}>
                    {TYPE_LABELS[r.organization.type] ?? r.organization.type}
                  </span>
                  <span role="cell" className={styles.actionCell}>
                    {r.manageable && closing?.id !== r.id ? (
                      <button
                        type="button"
                        className={styles.textAction}
                        disabled={busy}
                        onClick={() => setClosing({ id: r.id, reason: '' })}
                        data-action="end"
                      >
                        {COPY.end}
                      </button>
                    ) : null}
                  </span>
                </div>
                {closing?.id === r.id ? (
                  <form
                    className={styles.closeForm}
                    onSubmit={(e) => {
                      e.preventDefault()
                      void end(r, closing.reason)
                    }}
                    data-close-form
                  >
                    <input
                      id={`close-reason-${r.id}`}
                      className={styles.input}
                      placeholder={COPY.reason}
                      aria-label={COPY.reason}
                      maxLength={RELATIONSHIP_LIMITS.reason}
                      value={closing.reason}
                      onChange={(e) => setClosing({ id: r.id, reason: e.target.value })}
                    />
                    <button type="submit" className={styles.danger} disabled={busy}>
                      {COPY.confirmEnd}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setClosing(null)}
                    >
                      {COPY.cancel}
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.card} ${styles.muted}`} data-card="history">
          <h2 className={styles.eyebrow}>{COPY.closed}</h2>
          {model.history.length === 0 ? <p className={styles.empty}>{COPY.noHistory}</p> : null}
          {model.history.map((r) => (
            <div key={r.id} className={`${styles.row} ${styles.historyRow}`} data-history={r.id}>
              <span>
                <span className={styles.chip}>
                  {r.direction === 'PARENT' ? COPY.belongs : COPY.parentOf}
                </span>
              </span>
              <span className={styles.name}>{r.organization.name}</span>
              <span className={styles.cell}>
                {date(r.started_at)} → {r.ended_at ? date(r.ended_at) : ''}
              </span>
              <span className={styles.cell}>{r.close_reason ?? ''}</span>
              <span />
            </div>
          ))}
        </section>
      </div>

      <aside className={styles.side}>
        <section className={styles.card} data-card="add">
          <h2 className={styles.eyebrow}>{COPY.addTitle}</h2>
          {canAdd ? (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
              data-add-form
            >
              <label className={styles.field} htmlFor="relationship-mode">
                <span className={styles.label}>{COPY.type}</span>
                <select
                  id="relationship-mode"
                  className={styles.input}
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as Mode)
                    setTarget('')
                    setFieldError(null)
                  }}
                >
                  {candidates.children.length ? (
                    <option value="CHILD">{COPY.asParent}</option>
                  ) : null}
                  {candidates.parents.length ? (
                    <option value="PARENT">
                      {model.parent ? COPY.changeParent : COPY.asChild}
                    </option>
                  ) : null}
                </select>
              </label>
              <label className={styles.field} htmlFor="relationship-target">
                <span className={styles.label}>{COPY.target}</span>
                <select
                  id="relationship-target"
                  ref={formRef}
                  className={`${styles.input} ${fieldError ? styles.invalid : ''}`}
                  value={target}
                  aria-invalid={Boolean(fieldError)}
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setFieldError(null)
                  }}
                >
                  <option value="">{COPY.choose}</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} · {TYPE_LABELS[o.type] ?? o.type}
                    </option>
                  ))}
                </select>
              </label>
              {fieldError ? (
                <p className={styles.fieldError} data-field-error>
                  {fieldError}
                </p>
              ) : null}
              {mode === 'PARENT' && model.parent ? (
                <p className={styles.hint}>{COPY.changeNote(model.parent.organization.name)}</p>
              ) : null}
              <button
                type="submit"
                className={styles.secondary}
                disabled={busy || !target}
                data-action="save"
              >
                {COPY.save}
              </button>
            </form>
          ) : (
            <p className={styles.empty} data-state="no-candidates">
              {COPY.noCandidates}
            </p>
          )}
        </section>

        <section className={`${styles.card} ${styles.muted}`} data-card="rules">
          <h2 className={styles.eyebrow}>{COPY.rules}</h2>
          <dl className={styles.rules}>
            {RULES.map(([k, v]) => (
              <div key={k} className={styles.rule}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </aside>
    </div>
  )
}
