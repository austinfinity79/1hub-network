import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import type { EditResult } from './journey'
import {
  PROGRAMME_TYPES,
  type ProgrammeDemoDetail,
  type ProgrammeDemoDetailDTO,
  type ProgrammeType,
} from './types'

/**
 * WF04-S02 — basic information of a demo Programme / Challenge
 * (DEC-WF04-S02-D1..D4). Fields are the canonical `programmes` columns only:
 * type, name, summary, start / end, owning organization. No domain, region or
 * other taxonomy (the Programme model carries none).
 *
 * Rules, each from an existing source:
 * - type ∈ PROGRAMME | CHALLENGE (`programme_type`), chosen once at creation;
 * - name required after trimming (`programmes.name` NOT NULL); no length limit
 *   is invented;
 * - summary optional (`programmes.summary` nullable);
 * - dates optional; when both are set the end is not before the start (the
 *   canonical Event rule); calendar days in Asia/Ho_Chi_Minh;
 * - the owner is one of the organizations the server listed for the actor
 *   (DEC-WF04-H2); nothing else is accepted.
 */

export type BasicInfoInput = {
  type: string
  name: string
  summary: string
  /** yyyy-mm-dd or '' */
  starts_on: string
  /** yyyy-mm-dd or '' */
  ends_on: string
  organization_id: string
}

export type BasicInfoField = 'type' | 'name' | 'dates' | 'organization_id'
export type BasicInfoIssue = 'required' | 'invalid' | 'order' | 'immutable'
export type BasicInfoErrors = Partial<Record<BasicInfoField, BasicInfoIssue>>

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day in yyyy-mm-dd (shared by the S02 and S03 date fields). */
export function isValidDay(value: string): boolean {
  if (!DAY.test(value)) return false
  const time = Date.parse(`${value}T00:00:00+07:00`)
  return Number.isFinite(time) && new Date(time + 7 * 3600_000).toISOString().startsWith(value)
}

export function isProgrammeType(value: string): value is ProgrammeType {
  return (PROGRAMME_TYPES as readonly string[]).includes(value)
}

/**
 * Field errors (empty when valid). `existingType` is the type of an existing
 * programme: it can never change (DEC-WF04-S02-D1).
 */
export function validateBasicInfo(
  input: BasicInfoInput,
  owners: readonly Pick<OrganizationRefDTO, 'id'>[],
  existingType?: ProgrammeType,
): BasicInfoErrors {
  const errors: BasicInfoErrors = {}
  if (!input.type) errors.type = 'required'
  else if (!isProgrammeType(input.type)) errors.type = 'invalid'
  else if (existingType && input.type !== existingType) errors.type = 'immutable'
  if (!input.name.trim()) errors.name = 'required'
  const start = input.starts_on.trim()
  const end = input.ends_on.trim()
  if ((start && !isValidDay(start)) || (end && !isValidDay(end))) errors.dates = 'invalid'
  else if (start && end && end < start) errors.dates = 'order'
  if (!input.organization_id) errors.organization_id = 'required'
  else if (!owners.some((o) => o.id === input.organization_id)) errors.organization_id = 'invalid'
  return errors
}

/** The instant a calendar day starts (00:00) or ends (23:59) in Vietnam, as ISO UTC. */
export function dayToInstant(day: string, edge: 'start' | 'end'): string | null {
  if (!day.trim()) return null
  const time = Date.parse(`${day.trim()}T${edge === 'start' ? '00:00' : '23:59'}:00+07:00`)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

/**
 * A new session DRAFT from valid input. The caller supplies a fresh random id
 * (never in the fixture `d40…` range) and the clock.
 */
export function buildDraft(
  input: BasicInfoInput,
  owner: OrganizationRefDTO,
  { id, now }: { id: string; now: Date },
): ProgrammeDemoDetailDTO {
  const type = input.type as ProgrammeType
  const stamp = now.toISOString()
  return {
    programme: {
      id,
      type,
      organization_id: owner.id,
      slug: `demo-${id.slice(0, 8)}`,
      name: input.name.trim(),
      summary: input.summary.trim() || null,
      status: 'DRAFT',
      starts_at: dayToInstant(input.starts_on, 'start'),
      ends_at: dayToInstant(input.ends_on, 'end'),
      created_at: stamp,
      updated_at: stamp,
    },
    stages: [],
    ...(type === 'CHALLENGE' ? { problem_statements: [] } : {}),
    events: [],
    team: [],
    registration: { applicant_types: [], questions: [] },
    application_counts: {},
    organization: { id: owner.id, slug: owner.slug, name: owner.name, type: owner.type },
    demo: true,
  }
}

/** The editable form of an existing programme (stored instants back to Vietnam days). */
export function basicInfoOf(detail: ProgrammeDemoDetail): BasicInfoInput {
  const day = (v: string | null) =>
    v && Number.isFinite(Date.parse(v))
      ? new Date(Date.parse(v) + 7 * 3600_000).toISOString().slice(0, 10)
      : ''
  return {
    type: detail.programme.type,
    name: detail.programme.name,
    summary: detail.programme.summary ?? '',
    starts_on: day(detail.programme.starts_at),
    ends_on: day(detail.programme.ends_at),
    organization_id: detail.programme.organization_id,
  }
}

/**
 * WF04-S08 — edits the basic information of an existing programme
 * (DEC-WF04-S08-D2): name, summary and dates only. The type never changes
 * (S02-D1) and the owning organization is not an input (S02-D2): both must
 * equal the stored values or the edit is refused. Status is untouched.
 * Atomic, like the other demo edits.
 */
export function updateBasicInfo(
  detail: ProgrammeDemoDetail,
  input: BasicInfoInput,
  now: Date,
): EditResult<BasicInfoErrors> {
  const errors = validateBasicInfo(
    input,
    [{ id: detail.programme.organization_id }],
    detail.programme.type,
  )
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const next = structuredClone(detail)
  next.programme = {
    ...next.programme,
    name: input.name.trim(),
    summary: input.summary.trim() || null,
    starts_at: dayToInstant(input.starts_on, 'start'),
    ends_at: dayToInstant(input.ends_on, 'end'),
    updated_at: now.toISOString(),
  }
  return { ok: true, detail: next }
}
