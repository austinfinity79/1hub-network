'use client'

import { useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { ListEnvelope } from '@/lib/api/types'
import { EVENT_LIMITS, EVENT_TIMEZONE } from '@/lib/ops/event-rules'
import type { EventDTO } from '@/lib/ops/events'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import styles from './events.module.css'

/**
 * WF03-S07 — standalone Event management (DEC-WF03-G2/G10,
 * DEC-WF03-S07-EVENT-LIFECYCLE, DEC-WF03-S07-D1..D4).
 *
 * Main column: title + "+ Tạo sự kiện", and the organization's standalone
 * events (name, time, place, status). Side column: the create form, or the
 * selected event — editable in DRAFT / PUBLISHED, with "Công khai" (DRAFT) and
 * "Huỷ sự kiện" (PUBLISHED / LIVE, confirmed). Times are entered and shown in
 * Asia/Ho_Chi_Minh. No registration, programme, challenge or funnel content.
 *
 * TASK 22.4 (DEC-L3-D3): drawn as the corrected L23 CHP4 subset in Space
 * Grotesk. The list is full width with status chips over the existing
 * statuses; the side column opens from "Tạo sự kiện" (or `?create=1`) or a
 * row's "Quản lý" and closes with "Đóng". Type, owner, capacity and
 * registration columns and the two rule notes stay out (HD-09, Bucket B).
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S07-D4). */
const COPY = {
  title: (unit: string) => `Sự kiện của ${unit}`,
  summary: (org: string, total: number, upcoming: number) =>
    `${org} · ${total} sự kiện · ${upcoming} sắp diễn ra`,
  create: 'Tạo sự kiện',
  list: 'Sự kiện độc lập',
  filters: 'Lọc sự kiện',
  columns: ['Sự kiện', 'Thời gian', 'Địa điểm'],
  empty: 'Chưa có sự kiện nào.',
  noTime: 'Chưa có thời gian',
  open: 'Quản lý',
  createTitle: 'Tạo sự kiện',
  detailTitle: 'Chi tiết sự kiện',
  name: 'Tên sự kiện',
  description: 'Mô tả ngắn',
  starts: 'Bắt đầu',
  ends: 'Kết thúc',
  location: 'Địa điểm',
  saveDraft: 'Lưu nháp',
  save: 'Lưu thay đổi',
  publish: 'Công khai',
  cancel: 'Huỷ sự kiện',
  confirmCancel: 'Xác nhận huỷ',
  keep: 'Không huỷ',
  cancelNote: 'Sự kiện đã huỷ vẫn được giữ trong danh sách và không thể công khai lại.',
  readOnly: 'Sự kiện ở trạng thái này chỉ xem, không sửa được.',
  close: 'Đóng',
  created: 'Đã tạo bản nháp sự kiện.',
  saved: 'Đã lưu thay đổi.',
  published: 'Đã công khai sự kiện.',
  cancelled: 'Đã huỷ sự kiện.',
  invalid: 'Kiểm tra lại các trường được đánh dấu.',
  conflict: 'Trạng thái sự kiện đã thay đổi. Dữ liệu đã được tải lại.',
  failed: 'Không thực hiện được. Kiểm tra kết nối rồi thử lại.',
  retry: 'Tải lại',
  zone: 'Giờ Việt Nam (UTC+7)',
} as const

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang công khai',
  LIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  CANCELLED: 'Đã huỷ',
  ARCHIVED: 'Đã lưu trữ',
}
const FIELD_ERRORS: Record<string, string> = {
  required: 'Bắt buộc để công khai.',
  too_long: 'Quá dài.',
  invalid: 'Giá trị không hợp lệ.',
  before_start: 'Kết thúc phải sau thời điểm bắt đầu.',
  past: 'Thời điểm bắt đầu đã qua.',
}
const EDITABLE = ['DRAFT', 'PUBLISHED']
const CANCELLABLE = ['PUBLISHED', 'LIVE']
const UNIT: Record<string, string> = { HUB: 'HUB', CHAPTER: 'chapter', CLB: 'CLB' }

/** Row badge for everything but an upcoming published event (L23 draws "Nháp"). */
const BADGES: Record<string, string> = {
  DRAFT: 'Nháp',
  LIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  CANCELLED: 'Đã huỷ',
  ARCHIVED: 'Đã lưu trữ',
}

/**
 * Chip groups over the existing statuses. "Upcoming" is the public page's rule
 * (published and not yet ended, lib/public/organization.ts); P0 has no job
 * that moves a past event to ENDED, so a past published event counts as ended.
 */
type Group = 'upcoming' | 'ended' | 'draft' | 'cancelled'
const GROUPS: { key: Group; label: string }[] = [
  { key: 'upcoming', label: 'Sắp diễn ra' },
  { key: 'ended', label: 'Đã kết thúc' },
  { key: 'draft', label: 'Bản nháp' },
  { key: 'cancelled', label: 'Đã huỷ' },
]
const groupOf = (e: EventDTO, now: number): Group => {
  if (e.status === 'DRAFT') return 'draft'
  if (e.status === 'CANCELLED' || e.status === 'ARCHIVED') return 'cancelled'
  if (e.status === 'ENDED') return 'ended'
  const end = e.ends_at ?? e.starts_at
  return end && Date.parse(end) < now ? 'ended' : 'upcoming'
}

// Times are entered and shown in the display zone (DEC-WF03-S07-EVENT-LIFECYCLE E4).
const OFFSET = '+07:00'
const parts = (iso: string) => {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const { y, m, d, h, min } = parts(iso)
  return `${y}-${m}-${d}T${h}:${min}`
}
const fromLocalInput = (value: string) => (value ? `${value}:00${OFFSET}` : null)
const display = (iso: string) => {
  const { y, m, d, h, min } = parts(iso)
  return `${d}/${m}/${y} ${h}:${min}`
}
/** One line: "15/11/2026 · 16:00–19:00" on one day, else "15/11 16:00 → 16/11/2026 12:00". */
const when = (e: EventDTO) => {
  if (!e.starts_at) return COPY.noTime
  if (!e.ends_at) return display(e.starts_at)
  const a = parts(e.starts_at)
  const b = parts(e.ends_at)
  if (a.y === b.y && a.m === b.m && a.d === b.d)
    return `${a.d}/${a.m}/${a.y} · ${a.h}:${a.min}–${b.h}:${b.min}`
  return `${a.d}/${a.m} ${a.h}:${a.min} → ${display(e.ends_at)}`
}

type Draft = { name: string; summary: string; starts: string; ends: string; location: string }
const emptyDraft: Draft = { name: '', summary: '', starts: '', ends: '', location: '' }
const draftOf = (e: EventDTO): Draft => ({
  name: e.name,
  summary: e.summary ?? '',
  starts: toLocalInput(e.starts_at),
  ends: toLocalInput(e.ends_at),
  location: e.location_text ?? '',
})
type Notice = { tone: 'ok' | 'error'; text: string } | null

export function EventManagement({
  organization,
  initial,
  initialCreate = false,
}: {
  organization: Pick<OrganizationRefDTO, 'id' | 'name' | 'type'>
  initial: EventDTO[]
  /** `?create=1` (the dashboard's "Tạo sự kiện") opens the create form. */
  initialCreate?: boolean
}) {
  const [events, setEvents] = useState(initial)
  const [panel, setPanel] = useState(initialCreate)
  const [filter, setFilter] = useState<Group | null>(null)
  const [now] = useState(() => Date.now())
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<Notice>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const current = events.find((e) => e.id === selected) ?? null
  const editable = !current || EDITABLE.includes(current.status)

  const reload = async () => {
    try {
      const page = await apiRequest<ListEnvelope<EventDTO>>(
        `/ops/organizations/${organization.id}/events`,
      )
      setEvents(page.items)
      setLoadFailed(false)
      return page.items
    } catch {
      setLoadFailed(true)
      return null
    }
  }

  const open = (e: EventDTO | null) => {
    setPanel(true)
    setSelected(e?.id ?? null)
    setDraft(e ? draftOf(e) : emptyDraft)
    setErrors({})
    setNotice(null)
    setConfirming(false)
  }

  const run = async (call: () => Promise<EventDTO>, ok: string) => {
    setBusy(true)
    setNotice(null)
    setErrors({})
    try {
      const result = await call()
      const items = await reload()
      const fresh = items?.find((e) => e.id === result.id) ?? result
      setSelected(fresh.id)
      setDraft(draftOf(fresh))
      setConfirming(false)
      setNotice({ tone: 'ok', text: ok })
    } catch (error) {
      const e = error as { code?: string; fields?: Record<string, string> }
      if (e.code === 'PROFILE_VALIDATION_FAILED' && e.fields) {
        setErrors(e.fields)
        setNotice({ tone: 'error', text: COPY.invalid })
      } else if (e.code === 'MEMBERSHIP_INVALID_TRANSITION') {
        // Never surface status codes or raw errors; show the latest state instead.
        const items = await reload()
        const fresh = items?.find((x) => x.id === selected)
        if (fresh) setDraft(draftOf(fresh))
        setNotice({ tone: 'error', text: COPY.conflict })
      } else {
        setNotice({ tone: 'error', text: COPY.failed })
      }
    } finally {
      setBusy(false)
    }
  }

  const payload = () => ({
    name: draft.name,
    summary: draft.summary,
    starts_at: fromLocalInput(draft.starts),
    ends_at: fromLocalInput(draft.ends),
    location_text: draft.location,
    timezone: EVENT_TIMEZONE,
  })

  const submit = () =>
    current
      ? run(
          () =>
            apiRequest<EventDTO>(`/ops/events/${current.id}`, { method: 'PATCH', body: payload() }),
          COPY.saved,
        )
      : run(
          () =>
            apiRequest<EventDTO>(`/ops/organizations/${organization.id}/events`, {
              method: 'POST',
              body: payload(),
              idempotencyKey: crypto.randomUUID(),
            }),
          COPY.created,
        )

  const counts = new Map<Group, number>()
  for (const e of events) counts.set(groupOf(e, now), (counts.get(groupOf(e, now)) ?? 0) + 1)
  const visible = filter ? events.filter((e) => groupOf(e, now) === filter) : events
  const close = () => {
    setPanel(false)
    setSelected(null)
    setConfirming(false)
    setNotice(null)
  }
  const fieldError = (f: string) =>
    errors[f] ? (
      <span className={styles.fieldError} data-field-error={f}>
        {FIELD_ERRORS[errors[f]!] ?? FIELD_ERRORS.invalid}
      </span>
    ) : null

  return (
    <div className={styles.page} data-screen="WF03-S07">
      <header className={styles.header}>
        <h1 className={styles.title}>{COPY.title(UNIT[organization.type] ?? organization.type)}</h1>
        <p className={styles.subtitle}>
          {COPY.summary(organization.name, events.length, counts.get('upcoming') ?? 0)}
        </p>
      </header>

      <div className={`${styles.body} ${panel ? styles.withPanel : ''}`}>
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <div className={styles.filters} role="group" aria-label={COPY.filters}>
              {GROUPS.filter((g) => g.key !== 'cancelled' || counts.get('cancelled')).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={styles.filter}
                  aria-pressed={filter === g.key}
                  onClick={() => setFilter(filter === g.key ? null : g.key)}
                  data-filter={g.key}
                >
                  {g.label} · {counts.get(g.key) ?? 0}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => open(null)}
              data-action="new-event"
            >
              {COPY.create}
            </button>
          </div>

          {loadFailed ? (
            <div className={styles.failed} role="alert" data-state="events-failed">
              <span>{COPY.failed}</span>
              <button type="button" className={styles.secondary} onClick={() => void reload()}>
                {COPY.retry}
              </button>
            </div>
          ) : null}
          <div className={styles.table} role="table" aria-label={COPY.list} data-card="events">
            <div className={styles.head} role="row">
              {COPY.columns.map((c) => (
                <span key={c} role="columnheader">
                  {c}
                </span>
              ))}
              <span role="columnheader" />
            </div>
            {visible.length === 0 ? (
              <p className={styles.empty} data-state="events-empty">
                {COPY.empty}
              </p>
            ) : null}
            {visible.map((e) => (
              <div
                key={e.id}
                role="row"
                className={`${styles.row} ${e.id === selected ? styles.selected : ''}`}
                data-event={e.id}
                data-status={e.status}
              >
                <span role="cell" className={styles.name}>
                  {e.name}
                  {BADGES[e.status] ? (
                    <span className={`${styles.badge} ${styles[`status${e.status}`] ?? ''}`}>
                      {BADGES[e.status]}
                    </span>
                  ) : null}
                </span>
                <span role="cell" className={styles.cell}>
                  {when(e)}
                </span>
                <span role="cell" className={styles.cell}>
                  {e.location_text ?? '—'}
                </span>
                <span role="cell" className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.manage}
                    onClick={() => open(e)}
                    data-action="open"
                  >
                    {COPY.open}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        {panel ? (
          <aside className={styles.side}>
            <section className={styles.card} data-card={current ? 'detail' : 'create'}>
              <div className={styles.sideHead}>
                <h2 className={styles.eyebrow}>{current ? COPY.detailTitle : COPY.createTitle}</h2>
                {current ? (
                  <span className={`${styles.chip} ${styles[`status${current.status}`] ?? ''}`}>
                    {STATUS_LABELS[current.status] ?? current.status}
                  </span>
                ) : null}
              </div>
              {notice ? (
                <p
                  className={`${styles.notice} ${notice.tone === 'ok' ? styles.noticeOk : styles.noticeError}`}
                  role={notice.tone === 'ok' ? 'status' : 'alert'}
                  data-state={notice.tone === 'ok' ? 'action-success' : 'action-failed'}
                >
                  {notice.text}
                </p>
              ) : null}
              <form
                className={styles.form}
                onSubmit={(ev) => {
                  ev.preventDefault()
                  void submit()
                }}
                data-event-form
                noValidate
              >
                <label className={styles.field} htmlFor="event-name">
                  <span className={styles.label}>{COPY.name}</span>
                  <input
                    id="event-name"
                    className={styles.input}
                    value={draft.name}
                    maxLength={EVENT_LIMITS.name}
                    disabled={!editable}
                    aria-invalid={Boolean(errors.name)}
                    onChange={(ev) => setDraft({ ...draft, name: ev.target.value })}
                  />
                  {fieldError('name')}
                </label>
                <label className={styles.field} htmlFor="event-starts">
                  <span className={styles.label}>{COPY.starts}</span>
                  <input
                    id="event-starts"
                    type="datetime-local"
                    className={styles.input}
                    value={draft.starts}
                    disabled={!editable}
                    aria-invalid={Boolean(errors.starts_at)}
                    onChange={(ev) => setDraft({ ...draft, starts: ev.target.value })}
                  />
                  {fieldError('starts_at')}
                </label>
                <label className={styles.field} htmlFor="event-ends">
                  <span className={styles.label}>{COPY.ends}</span>
                  <input
                    id="event-ends"
                    type="datetime-local"
                    className={styles.input}
                    value={draft.ends}
                    disabled={!editable}
                    aria-invalid={Boolean(errors.ends_at)}
                    onChange={(ev) => setDraft({ ...draft, ends: ev.target.value })}
                  />
                  {fieldError('ends_at')}
                </label>
                <p className={styles.hint}>{COPY.zone}</p>
                <label className={styles.field} htmlFor="event-location">
                  <span className={styles.label}>{COPY.location}</span>
                  <input
                    id="event-location"
                    className={styles.input}
                    value={draft.location}
                    maxLength={EVENT_LIMITS.location}
                    disabled={!editable}
                    aria-invalid={Boolean(errors.location_text)}
                    onChange={(ev) => setDraft({ ...draft, location: ev.target.value })}
                  />
                  {fieldError('location_text')}
                </label>
                <label className={styles.field} htmlFor="event-summary">
                  <span className={styles.label}>{COPY.description}</span>
                  <textarea
                    id="event-summary"
                    className={`${styles.input} ${styles.textarea}`}
                    value={draft.summary}
                    maxLength={EVENT_LIMITS.summary}
                    rows={3}
                    disabled={!editable}
                    aria-invalid={Boolean(errors.summary)}
                    onChange={(ev) => setDraft({ ...draft, summary: ev.target.value })}
                  />
                  {fieldError('summary')}
                </label>
                {editable ? (
                  <div className={styles.actions}>
                    <button
                      type="submit"
                      className={styles.secondary}
                      disabled={busy || !draft.name.trim()}
                      data-action="save"
                    >
                      {current ? COPY.save : COPY.saveDraft}
                    </button>
                    {current?.status === 'DRAFT' ? (
                      <button
                        type="button"
                        className={styles.primaryInline}
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              apiRequest<EventDTO>(`/ops/events/${current.id}/publish`, {
                                method: 'POST',
                                idempotencyKey: crypto.randomUUID(),
                              }),
                            COPY.published,
                          )
                        }
                        data-action="publish"
                      >
                        {COPY.publish}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className={styles.hint} data-state="read-only">
                    {COPY.readOnly}
                  </p>
                )}
              </form>
              {current && CANCELLABLE.includes(current.status) ? (
                <div className={styles.cancelBox}>
                  {confirming ? (
                    <>
                      <p className={styles.hint}>{COPY.cancelNote}</p>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                apiRequest<EventDTO>(`/ops/events/${current.id}/cancel`, {
                                  method: 'POST',
                                }),
                              COPY.cancelled,
                            )
                          }
                          data-action="confirm-cancel"
                        >
                          {COPY.confirmCancel}
                        </button>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() => setConfirming(false)}
                        >
                          {COPY.keep}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={() => setConfirming(true)}
                      data-action="cancel-event"
                    >
                      {COPY.cancel}
                    </button>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                className={styles.linkAction}
                onClick={close}
                data-action="close-detail"
              >
                {COPY.close}
              </button>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
