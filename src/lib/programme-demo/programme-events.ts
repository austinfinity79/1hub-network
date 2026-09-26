import { EVENT_LIMITS } from '@/lib/ops/event-rules'

import { fromLocalInput, isValidLocal } from './event-time'
import type { EditResult } from './journey'
import type { ProgrammeDemoDetail, ProgrammeEventDTO } from './types'

/**
 * WF04-S04 — events of a demo Programme / Challenge (DEC-WF04-S04-D1..D3).
 *
 * The canonical Event shape and rules, applied to the actor's session copy
 * only (never a database row, never the WF03 service):
 * - fields: name (required, ≤ 200), summary (≤ 2000), location_text (≤ 200),
 *   starts_at / ends_at (optional; the end is not before the start), entered
 *   in Vietnam time — `EVENT_LIMITS` and the S07 rule;
 * - `programme_id` is always the current programme and `organization_id` its
 *   owner; neither is an input;
 * - a new event is DRAFT; DRAFT and PUBLISHED events are editable (the S07
 *   editable states); only a DRAFT can be removed from the demo journey (a
 *   published event would be cancelled in WF03, which the demo does not do);
 * - order: the S07 list order — starts_at descending, undated first, then the
 *   newest created, then id.
 * Pure and atomic, like `journey.ts`.
 */

export type EventInput = {
  name: string
  summary: string
  /** datetime-local, Vietnam time, or '' */
  starts_local: string
  ends_local: string
  location: string
}

export type EventErrors = Partial<
  Record<'name' | 'summary' | 'location' | 'dates', 'required' | 'too_long' | 'invalid' | 'order'>
>

const EDITABLE = ['DRAFT', 'PUBLISHED']

export function validateEvent(input: EventInput): EventErrors {
  const errors: EventErrors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'required'
  else if (name.length > EVENT_LIMITS.name) errors.name = 'too_long'
  if (input.summary.trim().length > EVENT_LIMITS.summary) errors.summary = 'too_long'
  if (input.location.trim().length > EVENT_LIMITS.location) errors.location = 'too_long'
  const start = input.starts_local.trim()
  const end = input.ends_local.trim()
  if ((start && !isValidLocal(start)) || (end && !isValidLocal(end))) errors.dates = 'invalid'
  else if (start && end && Date.parse(fromLocalInput(end)!) < Date.parse(fromLocalInput(start)!))
    errors.dates = 'order'
  return errors
}

/** Only the events of this programme, in the S07 order. */
export function programmeEvents(detail: Pick<ProgrammeDemoDetail, 'programme' | 'events'>) {
  const time = (v: string | null) => (v ? Date.parse(v) : Number.POSITIVE_INFINITY)
  return detail.events
    .filter((e) => e.programme_id === detail.programme.id)
    .sort(
      (a, b) =>
        time(b.starts_at) - time(a.starts_at) ||
        Date.parse(b.created_at) - Date.parse(a.created_at) ||
        a.id.localeCompare(b.id),
    )
}

function fields(input: EventInput) {
  return {
    name: input.name.trim(),
    summary: input.summary.trim() || null,
    location_text: input.location.trim() || null,
    starts_at: fromLocalInput(input.starts_local),
    ends_at: fromLocalInput(input.ends_local),
  }
}

function owned(detail: ProgrammeDemoDetail, eventId: string) {
  return detail.events.find((e) => e.id === eventId && e.programme_id === detail.programme.id)
}

function next(detail: ProgrammeDemoDetail, now: Date, events: ProgrammeEventDTO[]) {
  const copy = structuredClone(detail)
  copy.programme.updated_at = now.toISOString()
  copy.events = events
  return copy
}

export function addEvent(
  detail: ProgrammeDemoDetail,
  input: EventInput,
  { id, now }: { id: string; now: Date },
): EditResult<EventErrors> {
  const errors = validateEvent(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const stamp = now.toISOString()
  const event: ProgrammeEventDTO = {
    id,
    organization_id: detail.programme.organization_id,
    programme_id: detail.programme.id,
    slug: `demo-su-kien-${id.slice(0, 8)}`,
    ...fields(input),
    status: 'DRAFT',
    created_at: stamp,
    updated_at: stamp,
  }
  return { ok: true, detail: next(detail, now, [...structuredClone(detail.events), event]) }
}

export function updateEvent(
  detail: ProgrammeDemoDetail,
  eventId: string,
  input: EventInput,
  now: Date,
): EditResult<EventErrors> | { ok: false; reason: 'not_editable' } {
  const event = owned(detail, eventId)
  if (!event) return { ok: false, reason: 'not_found' }
  if (!EDITABLE.includes(event.status)) return { ok: false, reason: 'not_editable' }
  const errors = validateEvent(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const events = detail.events.map((e) =>
    e.id === eventId
      ? { ...structuredClone(e), ...fields(input), updated_at: now.toISOString() }
      : structuredClone(e),
  )
  return { ok: true, detail: next(detail, now, events) }
}

export function removeEvent(
  detail: ProgrammeDemoDetail,
  eventId: string,
  now: Date,
): EditResult<never> | { ok: false; reason: 'not_removable' } {
  const event = owned(detail, eventId)
  if (!event) return { ok: false, reason: 'not_found' }
  if (event.status !== 'DRAFT') return { ok: false, reason: 'not_removable' }
  return {
    ok: true,
    detail: next(
      detail,
      now,
      structuredClone(detail.events).filter((e) => e.id !== eventId),
    ),
  }
}

export const canEditEvent = (e: ProgrammeEventDTO) => EDITABLE.includes(e.status)
export const canRemoveEvent = (e: ProgrammeEventDTO) => e.status === 'DRAFT'
