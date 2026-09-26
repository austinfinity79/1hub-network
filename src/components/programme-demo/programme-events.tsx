'use client'

import { useState, type FormEvent } from 'react'

import { TextInput } from '@/components/ui'
import { EVENT_LIMITS } from '@/lib/ops/event-rules'
import { formatEventWhen, toLocalInput } from '@/lib/programme-demo/event-time'
import {
  addEvent,
  canEditEvent,
  canRemoveEvent,
  programmeEvents,
  removeEvent,
  updateEvent,
  type EventErrors,
  type EventInput,
} from '@/lib/programme-demo/programme-events'
import { demoRoutes } from '@/lib/programme-demo/routes'
import type { ProgrammeDemoDetailDTO, ProgrammeEventDTO } from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import styles from './journey.module.css'
import form from './programme-form.module.css'
import { Confirm, SetupScreen, type Applied, type Apply } from './setup-screen'
import { EventStatusPill } from './status-pill'

/**
 * WF04-S04 — events of the current Programme / Challenge (DEC-WF04-S04-D1..D3).
 *
 * Only events whose `programme_id` is this programme, from the fixture plus
 * the actor's session edits — never a WF03 standalone event, never the
 * database. Add (DRAFT), edit (DRAFT / PUBLISHED), remove a DRAFT; the
 * canonical Event fields and rules. Back → the journey; "Tiếp theo" waits for
 * WF04-S05.
 */

const COPY = {
  back: '← Hành trình',
  events: 'Sự kiện',
  eventsHint: 'Sự kiện thuộc chương trình này. Giờ Việt Nam (UTC+7).',
  none: 'Chưa có sự kiện nào.',
  add: 'Thêm sự kiện',
  name: 'Tên sự kiện',
  summary: 'Tóm tắt',
  location: 'Địa điểm',
  optional: 'Không bắt buộc.',
  times: 'Thời gian',
  timesHint: 'Không bắt buộc. Giờ Việt Nam (UTC+7).',
  starts: 'Bắt đầu',
  ends: 'Kết thúc',
  noTime: 'Chưa có thời gian',
  save: 'Lưu sự kiện',
  edit: 'Sửa',
  remove: 'Xoá',
  cancel: 'Huỷ',
  removeConfirm: (name: string) => `Xoá sự kiện nháp “${name}” khỏi chương trình?`,
  required: 'Trường này là bắt buộc.',
  tooLong: 'Quá dài.',
  invalid: 'Thời gian chưa hợp lệ.',
  order: 'Thời điểm kết thúc không được trước thời điểm bắt đầu.',
} as const

type Editing =
  { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'remove'; id: string } | null

export function ProgrammeEvents({
  id,
  server,
}: {
  id: string
  server: ProgrammeDemoDetailDTO | null
}) {
  return (
    <SetupScreen
      id={id}
      server={server}
      step="events"
      screen="WF04-S04"
      back={{ href: demoRoutes.setup(id, 'journey'), label: COPY.back, nav: 'events-back' }}
      next={null}
    >
      {({ detail, apply }) => <EventsBody detail={detail} apply={apply} />}
    </SetupScreen>
  )
}

function EventsBody({ detail, apply: store }: { detail: ProgrammeDemoDetailDTO; apply: Apply }) {
  const [editing, setEditing] = useState<Editing>(null)
  const apply: Apply = (result) => {
    const outcome = store(result)
    if (outcome.ok) setEditing(null)
    return outcome
  }
  const events = programmeEvents(detail)
  const now = () => new Date()

  return (
    <section className={styles.card} aria-labelledby="programme-events" data-programme-events>
      <header className={styles.cardHead}>
        <div>
          <h2 id="programme-events" className={`weight-semibold ${styles.cardTitle}`}>
            {COPY.events}
          </h2>
          <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.eventsHint}</p>
        </div>
      </header>
      {events.length === 0 ? (
        <p className={`type-body-sm ${styles.empty}`} data-state="events-empty">
          {COPY.none}
        </p>
      ) : (
        <ul className={styles.list} aria-label={COPY.events}>
          {events.map((event) => (
            <li
              key={event.id}
              className={styles.item}
              data-event-id={event.id}
              data-status={event.status}
            >
              {editing?.kind === 'edit' && editing.id === event.id ? (
                <EventEditor
                  initial={event}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => apply(updateEvent(detail, event.id, input, now()))}
                />
              ) : (
                <>
                  <div className={styles.main}>
                    <p className={`type-body-sm weight-semibold ${styles.name}`}>{event.name}</p>
                    <p className={`type-meta-xs ${styles.meta}`}>
                      {[
                        formatEventWhen(event.starts_at, event.ends_at) ?? COPY.noTime,
                        event.location_text,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <EventStatusPill status={event.status} />
                  {editing?.kind === 'remove' && editing.id === event.id ? (
                    <Confirm
                      text={COPY.removeConfirm(event.name)}
                      yes={COPY.remove}
                      no={COPY.cancel}
                      onYes={() => apply(removeEvent(detail, event.id, now()))}
                      onNo={() => setEditing(null)}
                    />
                  ) : (
                    <div className={styles.controls}>
                      {canEditEvent(event) ? (
                        <button
                          type="button"
                          className={`weight-medium ${styles.textAction}`}
                          onClick={() => setEditing({ kind: 'edit', id: event.id })}
                          data-action="edit"
                        >
                          {COPY.edit}
                        </button>
                      ) : null}
                      {canRemoveEvent(event) ? (
                        <button
                          type="button"
                          className={`weight-medium ${styles.textAction}`}
                          onClick={() => setEditing({ kind: 'remove', id: event.id })}
                          data-action="remove"
                        >
                          {COPY.remove}
                        </button>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.footer}>
        {editing?.kind === 'add' ? (
          <EventEditor
            onCancel={() => setEditing(null)}
            onSave={(input) =>
              apply(addEvent(detail, input, { id: crypto.randomUUID(), now: now() }))
            }
          />
        ) : (
          <button
            type="button"
            className={`weight-medium ${buttons.secondary}`}
            onClick={() => setEditing({ kind: 'add' })}
            data-action="add-event"
          >
            {COPY.add}
          </button>
        )}
      </div>
    </section>
  )
}

function EventEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProgrammeEventDTO
  onSave: (input: EventInput) => Applied<EventErrors>
  onCancel: () => void
}) {
  const [input, setInput] = useState<EventInput>({
    name: initial?.name ?? '',
    summary: initial?.summary ?? '',
    starts_local: toLocalInput(initial?.starts_at ?? null),
    ends_local: toLocalInput(initial?.ends_at ?? null),
    location: initial?.location_text ?? '',
  })
  const [errors, setErrors] = useState<EventErrors>({})
  const key = initial?.id ?? 'new'
  const update = (field: keyof EventInput, value: string) => {
    setInput((i) => ({ ...i, [field]: value }))
    const errorKey =
      field === 'starts_local' || field === 'ends_local'
        ? 'dates'
        : field === 'location'
          ? 'location'
          : field
    setErrors((e) => ({ ...e, [errorKey]: undefined }))
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = onSave(input)
    if (!result.ok && result.errors) setErrors(result.errors)
  }
  const message = (issue: string | undefined) =>
    issue === 'required'
      ? COPY.required
      : issue === 'too_long'
        ? COPY.tooLong
        : issue === 'order'
          ? COPY.order
          : COPY.invalid
  const error = (field: keyof EventErrors) =>
    errors[field] ? (
      <p className={`type-meta-xs ${form.error}`} role="alert" data-error={field}>
        {message(errors[field])}
      </p>
    ) : null

  return (
    <form
      className={`${form.form} ${styles.editor}`}
      onSubmit={submit}
      noValidate
      data-event-editor
    >
      <section className={form.field}>
        <label htmlFor={`ev-name-${key}`} className={`type-body-sm weight-semibold ${form.label}`}>
          {COPY.name}
        </label>
        <TextInput
          id={`ev-name-${key}`}
          value={input.name}
          maxLength={EVENT_LIMITS.name}
          invalid={Boolean(errors.name)}
          onChange={(e) => update('name', e.target.value)}
        />
        {error('name')}
      </section>
      <fieldset className={form.field}>
        <legend className={`type-body-sm weight-semibold ${form.label}`}>{COPY.times}</legend>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.timesHint}</p>
        <div className={form.dates}>
          <div>
            <label htmlFor={`ev-start-${key}`} className={`type-body-sm ${form.dateLabel}`}>
              {COPY.starts}
            </label>
            <TextInput
              id={`ev-start-${key}`}
              type="datetime-local"
              value={input.starts_local}
              invalid={errors.dates === 'invalid'}
              onChange={(e) => update('starts_local', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`ev-end-${key}`} className={`type-body-sm ${form.dateLabel}`}>
              {COPY.ends}
            </label>
            <TextInput
              id={`ev-end-${key}`}
              type="datetime-local"
              value={input.ends_local}
              invalid={Boolean(errors.dates)}
              onChange={(e) => update('ends_local', e.target.value)}
            />
          </div>
        </div>
        {error('dates')}
      </fieldset>
      <section className={form.field}>
        <label
          htmlFor={`ev-location-${key}`}
          className={`type-body-sm weight-semibold ${form.label}`}
        >
          {COPY.location}
        </label>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.optional}</p>
        <TextInput
          id={`ev-location-${key}`}
          value={input.location}
          maxLength={EVENT_LIMITS.location}
          invalid={Boolean(errors.location)}
          onChange={(e) => update('location', e.target.value)}
        />
        {error('location')}
      </section>
      <section className={form.field}>
        <label
          htmlFor={`ev-summary-${key}`}
          className={`type-body-sm weight-semibold ${form.label}`}
        >
          {COPY.summary}
        </label>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.optional}</p>
        <textarea
          id={`ev-summary-${key}`}
          className={`ui-input ${form.textarea}`}
          rows={3}
          maxLength={EVENT_LIMITS.summary}
          value={input.summary}
          onChange={(e) => update('summary', e.target.value)}
        />
        {error('summary')}
      </section>
      <div className={styles.editorActions}>
        <button
          type="submit"
          className={`weight-medium ${buttons.primary}`}
          data-action="save-event"
        >
          {COPY.save}
        </button>
        <button type="button" className={`weight-medium ${buttons.secondary}`} onClick={onCancel}>
          {COPY.cancel}
        </button>
      </div>
    </form>
  )
}
