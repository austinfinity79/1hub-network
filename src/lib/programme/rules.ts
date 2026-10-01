import { createHash } from 'node:crypto'

import { ApiError } from '@/lib/api/errors'

import {
  PROGRAMME_TYPES,
  REGISTRATION_APPLICANT_TYPES,
  type ProblemStatementDTO,
  type ProgrammeStageDTO,
  type ProgrammeType,
  type RegistrationApplicantType,
  type RegistrationQuestionDTO,
} from './types'

/**
 * WF04-PROD-03 — server-side input rules of the Programme endpoints (API 05 §22,
 * contract §8, §11, §12). Pure: no database, so every rule is unit-tested.
 *
 * Only rules with a source are enforced: the canonical columns (`name` NOT
 * NULL, the type enum, end ≥ start — migration 015), the frozen content shapes
 * of `metadata.journey` / `metadata.challenge` (contract §11), the canonical
 * form of WF05 (`applicant_type`, questions with `required` and `step` 1–4,
 * migration 013), and type / owner immutability (contract §4). Nothing the
 * contract leaves open is invented: no stage, date, problem or form becomes
 * required (Q7), and `required` / `step` have no default (Q3).
 *
 * Every refusal is the ops convention: 422 `PROFILE_VALIDATION_FAILED` with the
 * failing field and a reason code, as WF03 events and ventures answer.
 */

/**
 * PROVISIONAL TECHNICAL BOUNDS, not business rules: they stop an unbounded
 * payload. Text lengths mirror `EVENT_LIMITS` (WF03-S07); list lengths are far
 * above anything the approved screens produce.
 */
export const PROGRAMME_LIMITS = {
  name: 200,
  summary: 2000,
  stageName: 200,
  stageSummary: 2000,
  problemTitle: 200,
  problemSummary: 2000,
  questionPrompt: 2000,
  stages: 50,
  problems: 50,
  questions: 50,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-](0\d|1[0-4]):[0-5]\d)$/
// NUL and unpaired surrogates: PostgreSQL text / jsonb refuse them, so they would be a 500.
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const QUESTION_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

export const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Programme validation failed.', {
    [field]: reason,
  })

function object(input: unknown, field: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw invalid(field, 'invalid')
  return input as Record<string, unknown>
}

function onlyKeys(input: Record<string, unknown>, allowed: readonly string[], prefix = '') {
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) throw invalid(`${prefix}${key}`, 'not_accepted')
}

function text(input: unknown, field: string, max: number, required: boolean): string | null {
  if (input === null || input === undefined) {
    if (required) throw invalid(field, 'required')
    return null
  }
  if (typeof input !== 'string' || UNSTORABLE.test(input)) throw invalid(field, 'invalid')
  const value = input.trim()
  if (!value) {
    if (required) throw invalid(field, 'required')
    return null
  }
  if (value.length > max) throw invalid(field, 'too_long')
  return value
}

/**
 * An ISO instant with an offset. The calendar day must exist (no roll-over of
 * 30 February into March) and the instant must fall in years 1–9999, which
 * PostgreSQL stores; anything else is `invalid`, never a database error.
 */
function timestamp(input: unknown, field: string): string | null {
  if (input === null || input === undefined) return null
  const match = typeof input === 'string' ? ISO.exec(input) : null
  if (!match || !isCalendarDay(match[1]!)) throw invalid(field, 'invalid')
  const time = Date.parse(input as string)
  const year = new Date(time).getUTCFullYear()
  if (!Number.isFinite(time) || year < 1 || year > 9999) throw invalid(field, 'invalid')
  return new Date(time).toISOString()
}

/** A real calendar day in yyyy-mm-dd. */
export function isCalendarDay(value: string): boolean {
  if (!DAY.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(value)
}

function day(input: unknown, field: string): string | null {
  if (input === null || input === undefined || input === '') return null
  if (typeof input !== 'string' || !isCalendarDay(input)) throw invalid(field, 'invalid')
  return input
}

/** end ≥ start when both are set (migration 015 `ck_programmes_dates`). */
export function checkDates(startsAt: string | null, endsAt: string | null) {
  if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt))
    throw invalid('ends_at', 'before_start')
}

function list(input: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(input)) throw invalid(field, 'invalid')
  if (input.length > max) throw invalid(field, 'too_many')
  return input
}

/**
 * A stable id for an item sent without one, derived from its position and
 * content, so a retried whole-list replacement writes the same list
 * (contract §14: replacements are repeat-safe). Items sent back with their id
 * keep it.
 */
function derivedHex(kind: string, index: number, content: unknown): string {
  return createHash('sha256')
    .update(`${kind}:${index}:${JSON.stringify(content)}`)
    .digest('hex')
}

const uuidOf = (h: string) =>
  `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`

function itemId(input: unknown, field: string, seen: Set<string>, derive: () => string): string {
  if (input !== undefined && input !== null && !isUuid(input)) throw invalid(field, 'invalid')
  const id = input === undefined || input === null ? derive() : (input as string).toLowerCase()
  if (seen.has(id)) throw invalid(field, 'duplicate')
  seen.add(id)
  return id
}

// ------------------------------------------------------------- basic fields

export type BasicFields = {
  name?: string
  summary?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export type CreateInput = Required<Pick<BasicFields, 'name'>> &
  BasicFields & { type: ProgrammeType; organization_id: string }

const CREATE_KEYS = ['type', 'organization_id', 'name', 'summary', 'starts_at', 'ends_at']

/** POST /programmes body. The owner is a choice the caller must be authorized for. */
export function parseCreate(body: unknown): CreateInput {
  const input = object(body, 'body')
  onlyKeys(input, CREATE_KEYS)
  if (input.type === undefined || input.type === null) throw invalid('type', 'required')
  if (!(PROGRAMME_TYPES as readonly unknown[]).includes(input.type))
    throw invalid('type', 'invalid')
  if (input.organization_id === undefined || input.organization_id === null)
    throw invalid('organization_id', 'required')
  if (!isUuid(input.organization_id)) throw invalid('organization_id', 'invalid')
  const fields: CreateInput = {
    type: input.type as ProgrammeType,
    organization_id: input.organization_id.toLowerCase(),
    name: text(input.name, 'name', PROGRAMME_LIMITS.name, true)!,
    summary: text(input.summary, 'summary', PROGRAMME_LIMITS.summary, false),
    starts_at: timestamp(input.starts_at, 'starts_at'),
    ends_at: timestamp(input.ends_at, 'ends_at'),
  }
  checkDates(fields.starts_at ?? null, fields.ends_at ?? null)
  return fields
}

// ------------------------------------------------------------- content lists

export function parseStages(input: unknown): ProgrammeStageDTO[] {
  const seen = new Set<string>()
  return list(input, 'stages', PROGRAMME_LIMITS.stages).map((raw, i) => {
    const field = `stages.${i}`
    const stage = object(raw, field)
    onlyKeys(stage, ['id', 'name', 'summary', 'starts_on', 'ends_on'], `${field}.`)
    const startsOn = day(stage.starts_on, `${field}.starts_on`)
    const endsOn = day(stage.ends_on, `${field}.ends_on`)
    if (startsOn && endsOn && endsOn < startsOn) throw invalid(`${field}.ends_on`, 'before_start')
    const content = {
      name: text(stage.name, `${field}.name`, PROGRAMME_LIMITS.stageName, true)!,
      summary: text(stage.summary, `${field}.summary`, PROGRAMME_LIMITS.stageSummary, false),
      starts_on: startsOn,
      ends_on: endsOn,
    }
    const id = itemId(stage.id, `${field}.id`, seen, () => uuidOf(derivedHex('stage', i, content)))
    return { id, position: i + 1, ...content }
  })
}

export function parseProblems(input: unknown): ProblemStatementDTO[] {
  const seen = new Set<string>()
  return list(input, 'problem_statements', PROGRAMME_LIMITS.problems).map((raw, i) => {
    const field = `problem_statements.${i}`
    const problem = object(raw, field)
    onlyKeys(problem, ['id', 'title', 'summary'], `${field}.`)
    const content = {
      title: text(problem.title, `${field}.title`, PROGRAMME_LIMITS.problemTitle, true)!,
      summary: text(problem.summary, `${field}.summary`, PROGRAMME_LIMITS.problemSummary, false),
    }
    const id = itemId(problem.id, `${field}.id`, seen, () =>
      uuidOf(derivedHex('problem', i, content)),
    )
    return { id, ...content }
  })
}

// ------------------------------------------------------------- PATCH

export type UpdateInput = BasicFields & {
  stages?: ProgrammeStageDTO[]
  problem_statements?: ProblemStatementDTO[]
}

const UPDATE_KEYS = ['name', 'summary', 'starts_at', 'ends_at', 'stages', 'problem_statements']
/** Fixed at creation (contract §4, DEC-WF04-S02-D1/D2). */
const IMMUTABLE_KEYS = ['type', 'organization_id']

/**
 * PATCH /programmes/{id} body. Lists are whole replacements; `position` is the
 * order sent. Lifecycle, slug, metadata and every other key are refused.
 */
export function parseUpdate(body: unknown, type: ProgrammeType): UpdateInput {
  const input = object(body, 'body')
  for (const key of Object.keys(input)) {
    if (IMMUTABLE_KEYS.includes(key)) throw invalid(key, 'immutable')
    if (!UPDATE_KEYS.includes(key)) throw invalid(key, 'not_accepted')
  }
  if (Object.keys(input).length === 0) throw invalid('body', 'empty')
  const fields: UpdateInput = {}
  if ('name' in input) fields.name = text(input.name, 'name', PROGRAMME_LIMITS.name, true)!
  if ('summary' in input)
    fields.summary = text(input.summary, 'summary', PROGRAMME_LIMITS.summary, false)
  if ('starts_at' in input) fields.starts_at = timestamp(input.starts_at, 'starts_at')
  if ('ends_at' in input) fields.ends_at = timestamp(input.ends_at, 'ends_at')
  if ('stages' in input) fields.stages = parseStages(input.stages)
  if ('problem_statements' in input) {
    if (type !== 'CHALLENGE') throw invalid('problem_statements', 'not_challenge')
    fields.problem_statements = parseProblems(input.problem_statements)
  }
  return fields
}

/** A no-body transition (publish, close): nothing may be sent. */
export function parseEmptyBody(body: unknown) {
  if (body === null || body === undefined) return
  const input = object(body, 'body')
  const key = Object.keys(input)[0]
  if (key) throw invalid(key, 'not_accepted')
}

// ------------------------------------------------------------- registration

export type RegistrationInput = {
  applicant_types: RegistrationApplicantType[]
  questions: RegistrationQuestionDTO[]
}

/**
 * PUT /programmes/{id}/registration body: the canonical form WF05 reads. At
 * least one applicant type (migration 013 check); each question states its
 * own `required` and `step`, because no default is approved (contract Q3).
 */
export function parseRegistration(body: unknown): RegistrationInput {
  const input = object(body, 'body')
  onlyKeys(input, ['applicant_types', 'questions'])
  for (const key of ['applicant_types', 'questions'])
    if (input[key] === undefined) throw invalid(key, 'required')
  const types = list(input.applicant_types, 'applicant_types', 2)
  if (types.length === 0) throw invalid('applicant_types', 'required')
  if (!types.every((t) => (REGISTRATION_APPLICANT_TYPES as readonly unknown[]).includes(t)))
    throw invalid('applicant_types', 'invalid')
  if (new Set(types).size !== types.length) throw invalid('applicant_types', 'duplicate')

  const seen = new Set<string>()
  const questions = list(input.questions, 'questions', PROGRAMME_LIMITS.questions).map(
    (raw, i): RegistrationQuestionDTO => {
      const field = `questions.${i}`
      const q = object(raw, field)
      onlyKeys(q, ['id', 'prompt', 'required', 'step'], `${field}.`)
      const sent = q.id !== undefined && q.id !== null
      if (sent && (typeof q.id !== 'string' || !QUESTION_ID.test(q.id)))
        throw invalid(`${field}.id`, 'invalid')
      if (q.required === undefined || q.required === null)
        throw invalid(`${field}.required`, 'required')
      if (typeof q.required !== 'boolean') throw invalid(`${field}.required`, 'invalid')
      if (q.step === undefined || q.step === null) throw invalid(`${field}.step`, 'required')
      if (![1, 2, 3, 4].includes(q.step as number)) throw invalid(`${field}.step`, 'invalid')
      const content = {
        prompt: text(q.prompt, `${field}.prompt`, PROGRAMME_LIMITS.questionPrompt, true)!,
        required: q.required,
        step: q.step as RegistrationQuestionDTO['step'],
      }
      const id = sent ? (q.id as string) : `q-${derivedHex('question', i, content).slice(0, 8)}`
      if (seen.has(id)) throw invalid(`${field}.id`, 'duplicate')
      seen.add(id)
      return { id, ...content }
    },
  )
  return {
    // Canonical order, as the demo stored it.
    applicant_types: REGISTRATION_APPLICANT_TYPES.filter((t) => types.includes(t)),
    questions,
  }
}

// ------------------------------------------------------------- stored content

/** The stored journey, read tolerantly: malformed entries are skipped, never thrown. */
export function readStages(metadata: unknown): ProgrammeStageDTO[] {
  const stages = (metadata as { journey?: { stages?: unknown } } | null)?.journey?.stages
  if (!Array.isArray(stages)) return []
  return stages
    .flatMap((s): ProgrammeStageDTO[] => {
      if (!s || typeof s !== 'object') return []
      const r = s as Record<string, unknown>
      if (typeof r.id !== 'string' || typeof r.name !== 'string') return []
      return [
        {
          id: r.id,
          position: typeof r.position === 'number' ? r.position : 0,
          name: r.name,
          summary: typeof r.summary === 'string' ? r.summary : null,
          starts_on: typeof r.starts_on === 'string' ? r.starts_on : null,
          ends_on: typeof r.ends_on === 'string' ? r.ends_on : null,
        },
      ]
    })
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

export function readProblems(metadata: unknown): ProblemStatementDTO[] {
  const problems = (metadata as { challenge?: { problem_statements?: unknown } } | null)?.challenge
    ?.problem_statements
  if (!Array.isArray(problems)) return []
  return problems.flatMap((p): ProblemStatementDTO[] => {
    if (!p || typeof p !== 'object') return []
    const r = p as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.title !== 'string') return []
    return [{ id: r.id, title: r.title, summary: typeof r.summary === 'string' ? r.summary : null }]
  })
}

/** The documented content shapes, `schema_version` 1 (contract §11). */
export const journeyOf = (stages: ProgrammeStageDTO[]) => ({ schema_version: 1, stages })
export const challengeOf = (problems: ProblemStatementDTO[]) => ({
  schema_version: 1,
  problem_statements: problems,
})
