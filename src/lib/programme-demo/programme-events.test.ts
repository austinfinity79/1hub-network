import { describe, expect, it } from 'vitest'

import { EVENT_LIMITS } from '@/lib/ops/event-rules'

import { formatEventWhen, fromLocalInput, isValidLocal, toLocalInput } from './event-time'
import { DEMO_CHALLENGE_ID, DEMO_PROGRAMME_ID, demoFixture } from './fixtures'
import {
  addEvent,
  canEditEvent,
  canRemoveEvent,
  programmeEvents,
  removeEvent,
  updateEvent,
  validateEvent,
  type EventInput,
} from './programme-events'
import type { ProgrammeDemoDetail } from './types'

const now = new Date('2026-09-27T05:00:00.000Z')
const copy = (id: string) => structuredClone(demoFixture(id)!) as ProgrammeDemoDetail
const input: EventInput = {
  name: '  Buổi kết nối  ',
  summary: '',
  starts_local: '2026-11-20T09:00',
  ends_local: '2026-11-20T11:30',
  location: '  Hà Nội  ',
}
const detailOf = (r: { ok: boolean }) => {
  if (!r.ok) throw new Error(JSON.stringify(r))
  return (r as unknown as { detail: ProgrammeDemoDetail }).detail
}

describe('WF04-S04 event times (S07 semantics)', () => {
  it('round-trips Vietnam local time and formats like S07', () => {
    expect(fromLocalInput('2026-11-20T09:00')).toBe('2026-11-20T02:00:00.000Z')
    expect(toLocalInput('2026-11-20T02:00:00.000Z')).toBe('2026-11-20T09:00')
    expect(fromLocalInput('')).toBeNull()
    expect(formatEventWhen('2026-10-03T02:00:00.000Z', '2026-10-03T04:00:00.000Z')).toBe(
      '03/10/2026 · 09:00–11:00',
    )
    expect(formatEventWhen('2026-10-03T02:00:00.000Z', '2026-10-04T05:00:00.000Z')).toBe(
      '03/10 09:00 → 04/10/2026 12:00',
    )
    expect(formatEventWhen(null, null)).toBeNull()
    expect(isValidLocal('2026-02-30T09:00')).toBe(false)
    expect(isValidLocal('2026-11-20 09:00')).toBe(false)
  })
})

describe('WF04-S04 programme events', () => {
  it('lists only this programme’s events, in the S07 order (starts desc, undated first)', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    expect(programmeEvents(d).map((e) => e.name)).toEqual([
      'Ngày trình diễn (demo)',
      'Buổi định hướng (demo)',
    ])
    const withForeign = structuredClone(d)
    withForeign.events.push({ ...copy(DEMO_CHALLENGE_ID).events[0]! })
    expect(programmeEvents(withForeign)).toHaveLength(2)
    const undated = detailOf(
      addEvent(d, { ...input, starts_local: '', ends_local: '' }, { id: 'e-u', now }),
    )
    expect(programmeEvents(undated)[0]!.id).toBe('e-u')
  })

  it('creates a DRAFT linked to the current programme and owner; programme_id is never an input', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    const spoof = {
      ...input,
      programme_id: DEMO_PROGRAMME_ID,
      organization_id: 'x',
      status: 'PUBLISHED',
    }
    const next = detailOf(addEvent(d, spoof as EventInput, { id: 'e-new', now }))
    const created = next.events.find((e) => e.id === 'e-new')!
    expect(created).toMatchObject({
      programme_id: DEMO_CHALLENGE_ID,
      organization_id: d.programme.organization_id,
      status: 'DRAFT',
      name: 'Buổi kết nối',
      summary: null,
      location_text: 'Hà Nội',
      starts_at: '2026-11-20T02:00:00.000Z',
      ends_at: '2026-11-20T04:30:00.000Z',
      slug: 'demo-su-kien-e-new',
    })
    expect(Object.keys(created).sort()).toEqual(
      [
        'id',
        'organization_id',
        'programme_id',
        'slug',
        'name',
        'summary',
        'starts_at',
        'ends_at',
        'location_text',
        'status',
        'created_at',
        'updated_at',
      ].sort(),
    )
    expect(d.events).toHaveLength(1)
  })

  it('validates like the canonical Event: required name, limits, end not before start', () => {
    expect(validateEvent({ ...input, name: '   ' })).toEqual({ name: 'required' })
    expect(validateEvent({ ...input, name: 'x'.repeat(EVENT_LIMITS.name + 1) })).toEqual({
      name: 'too_long',
    })
    expect(validateEvent({ ...input, summary: 'x'.repeat(EVENT_LIMITS.summary + 1) })).toEqual({
      summary: 'too_long',
    })
    expect(validateEvent({ ...input, location: 'x'.repeat(EVENT_LIMITS.location + 1) })).toEqual({
      location: 'too_long',
    })
    expect(validateEvent({ ...input, ends_local: '2026-11-20T08:59' })).toEqual({ dates: 'order' })
    expect(validateEvent({ ...input, ends_local: '2026-11-20T09:00' })).toEqual({})
    expect(validateEvent({ ...input, starts_local: 'soon' })).toEqual({ dates: 'invalid' })
    expect(validateEvent({ ...input, starts_local: '', ends_local: '' })).toEqual({})
  })

  it('edits DRAFT and PUBLISHED events of this programme only; the link never changes', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const published = d.events[0]!
    expect(canEditEvent(published)).toBe(true)
    const next = detailOf(updateEvent(d, published.id, { ...input, name: 'Định hướng mới' }, now))
    expect(next.events.find((e) => e.id === published.id)).toMatchObject({
      name: 'Định hướng mới',
      status: 'PUBLISHED',
      programme_id: DEMO_PROGRAMME_ID,
      organization_id: published.organization_id,
    })
    const foreign = copy(DEMO_CHALLENGE_ID).events[0]!
    expect(updateEvent(d, foreign.id, input, now)).toEqual({ ok: false, reason: 'not_found' })
    const cancelled = structuredClone(d)
    cancelled.events[0]!.status = 'CANCELLED'
    expect(updateEvent(cancelled, published.id, input, now)).toEqual({
      ok: false,
      reason: 'not_editable',
    })
  })

  it('removes a DRAFT from the demo journey; a published or foreign event cannot be removed', () => {
    const c = copy(DEMO_CHALLENGE_ID)
    const draft = c.events[0]!
    expect(canRemoveEvent(draft)).toBe(true)
    expect(detailOf(removeEvent(c, draft.id, now)).events).toEqual([])
    const p = copy(DEMO_PROGRAMME_ID)
    expect(removeEvent(p, p.events[0]!.id, now)).toEqual({ ok: false, reason: 'not_removable' })
    expect(removeEvent(p, draft.id, now)).toEqual({ ok: false, reason: 'not_found' })
    expect(removeEvent(p, '70000000-0000-0000-0000-000000000001', now)).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })

  it('an invalid edit changes nothing', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const before = JSON.stringify(d)
    expect(addEvent(d, { ...input, name: '' }, { id: 'x', now })).toMatchObject({
      ok: false,
      reason: 'invalid',
    })
    expect(
      updateEvent(d, d.events[0]!.id, { ...input, ends_local: '2026-11-19T00:00' }, now),
    ).toMatchObject({
      ok: false,
      errors: { dates: 'order' },
    })
    expect(JSON.stringify(d)).toBe(before)
  })
})
