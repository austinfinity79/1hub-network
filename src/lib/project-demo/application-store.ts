import { applicantTypeFor, applicationEligibility } from './eligibility'
import {
  DEMO_APPLICATION_STATUSES,
  WF05_APPLICANT_TYPES,
  type DemoApplication,
  type IneligibleReason,
  type ProgrammeContext,
  type VentureContext,
} from './types'

/**
 * WF05-T00 — the demo application store (DEC-WF05-G5, DEC-WF05-T00-D1).
 *
 * Applications live only in the browser's `sessionStorage`, under one key per
 * signed-in actor (an opaque hash, no PII), and nowhere else: no API accepts
 * them and nothing reaches PostgreSQL, audit or analytics.
 *
 * - refresh / navigation in the same tab keeps them; a new tab or browser
 *   session, or another actor, starts empty;
 * - "Đặt lại demo" removes this key only (never auth, WF01–WF04 data or the
 *   WF04 demo key);
 * - one application per (venture, programme); DRAFT → SUBMITTED only;
 *   SUBMITTED is final;
 * - an application stores the venture id, never venture data: parsing keeps
 *   only the known fields, so no snapshot can survive a round trip.
 *
 * Every mutation re-checks the eligibility rules against server-resolved
 * facts. Pure functions, unit-tested without a browser.
 */

export const PROJECT_DEMO_STORE_VERSION = 1 as const

/**
 * WF05-S03: a TECHNICAL bound on one answer (not a business rule), the same
 * free-text bound WF02 uses for a venture summary (DEC-WF02-S05-D1). It keeps
 * the browser session store small; completeness stays S04's rule (G5-5).
 */
export const DEMO_ANSWER_MAX = 2000
const KEY_PREFIX = 'hub.wf05-demo.v1.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProjectDemoState = {
  version: typeof PROJECT_DEMO_STORE_VERSION
  /** By `applicationKey(venture, programme)`. */
  applications: Record<string, DemoApplication>
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type ApplicationRefusal =
  IneligibleReason | 'EXISTS' | 'NOT_FOUND' | 'SUBMITTED' | 'INVALID_ANSWERS' | 'INCOMPLETE'

export type ApplicationResult =
  | { ok: true; state: ProjectDemoState; application: DemoApplication }
  | { ok: false; reason: ApplicationRefusal }

export function projectDemoStoreKey(actorKey: string): string {
  return `${KEY_PREFIX}${actorKey}`
}

export function emptyProjectDemoState(): ProjectDemoState {
  return { version: PROJECT_DEMO_STORE_VERSION, applications: {} }
}

export function applicationKey(ventureId: string, programmeId: string): string {
  return `${ventureId}:${programmeId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isIso = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

/** A stored entry rebuilt from its known fields only, or null when it is not a valid application. */
function cleanApplication(key: string, value: unknown): DemoApplication | null {
  if (!isRecord(value)) return null
  const {
    primary_applicant_type: type,
    primary_applicant_id: ventureId,
    programme_id: programmeId,
    status,
    programme_specific_answers: answers,
    created_at: createdAt,
    updated_at: updatedAt,
    submitted_at: submittedAt,
  } = value
  if (typeof ventureId !== 'string' || typeof programmeId !== 'string') return null
  if (!UUID.test(ventureId) || !UUID.test(programmeId)) return null
  if (key !== applicationKey(ventureId, programmeId)) return null
  if (!(WF05_APPLICANT_TYPES as readonly unknown[]).includes(type)) return null
  if (!(DEMO_APPLICATION_STATUSES as readonly unknown[]).includes(status)) return null
  if (!Array.isArray(answers) || !answers.every((a) => typeof a === 'string')) return null
  if (!isIso(createdAt) || !isIso(updatedAt)) return null
  if (status === 'SUBMITTED' ? !isIso(submittedAt) : submittedAt !== null) return null
  return {
    primary_applicant_type: type as DemoApplication['primary_applicant_type'],
    primary_applicant_id: ventureId,
    programme_id: programmeId,
    status: status as DemoApplication['status'],
    programme_specific_answers: [...(answers as string[])],
    created_at: createdAt,
    updated_at: updatedAt,
    submitted_at: status === 'SUBMITTED' ? (submittedAt as string) : null,
  }
}

/** The state a stored value encodes; anything unreadable, or of another version, is empty. */
export function parseProjectDemoState(raw: string | null): ProjectDemoState {
  if (!raw) return emptyProjectDemoState()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyProjectDemoState()
  }
  if (!isRecord(parsed) || parsed.version !== PROJECT_DEMO_STORE_VERSION) {
    return emptyProjectDemoState()
  }
  if (!isRecord(parsed.applications)) return emptyProjectDemoState()
  const applications: Record<string, DemoApplication> = {}
  for (const [key, value] of Object.entries(parsed.applications)) {
    const application = cleanApplication(key, value)
    if (application) applications[key] = application
  }
  return { version: PROJECT_DEMO_STORE_VERSION, applications }
}

export function readProjectDemoState(storage: StorageLike | null, key: string): ProjectDemoState {
  if (!storage) return emptyProjectDemoState()
  try {
    return parseProjectDemoState(storage.getItem(key))
  } catch {
    return emptyProjectDemoState()
  }
}

export function applicationOf(
  state: ProjectDemoState,
  ventureId: string,
  programmeId: string,
): DemoApplication | null {
  return state.applications[applicationKey(ventureId, programmeId)] ?? null
}

function withApplication(state: ProjectDemoState, application: DemoApplication): ProjectDemoState {
  const key = applicationKey(application.primary_applicant_id, application.programme_id)
  return { ...state, applications: { ...state.applications, [key]: application } }
}

function eligible(venture: VentureContext, programme: ProgrammeContext): ApplicationRefusal | null {
  const verdict = applicationEligibility(venture, programme)
  return verdict.eligible ? null : verdict.reason
}

/** DEC-WF05-G5 (1, 3, 4): the owner starts one DRAFT per (venture, programme). */
export function startApplication(
  state: ProjectDemoState,
  venture: VentureContext,
  programme: ProgrammeContext,
  now: Date,
): ApplicationResult {
  const refusal = eligible(venture, programme)
  if (refusal) return { ok: false, reason: refusal }
  if (applicationOf(state, venture.id, programme.id)) return { ok: false, reason: 'EXISTS' }
  const at = now.toISOString()
  const application: DemoApplication = {
    primary_applicant_type: applicantTypeFor(venture.type),
    primary_applicant_id: venture.id,
    programme_id: programme.id,
    status: 'DRAFT',
    programme_specific_answers: programme.questions.map(() => ''),
    created_at: at,
    updated_at: at,
    submitted_at: null,
  }
  return { ok: true, state: withApplication(state, application), application }
}

function draftOf(
  state: ProjectDemoState,
  venture: VentureContext,
  programme: ProgrammeContext,
): { ok: true; draft: DemoApplication } | { ok: false; reason: ApplicationRefusal } {
  const current = applicationOf(state, venture.id, programme.id)
  if (!current) return { ok: false, reason: 'NOT_FOUND' }
  if (current.status !== 'DRAFT') return { ok: false, reason: 'SUBMITTED' }
  const refusal = eligible(venture, programme)
  return refusal ? { ok: false, reason: refusal } : { ok: true, draft: current }
}

/** Indexes of answers longer than the technical bound. */
export function answersTooLong(answers: readonly string[]): number[] {
  return answers.flatMap((a, i) => (a.length > DEMO_ANSWER_MAX ? [i] : []))
}

function validAnswers(answers: unknown, programme: ProgrammeContext): answers is string[] {
  return (
    Array.isArray(answers) &&
    answers.length === programme.questions.length &&
    answers.every((a) => typeof a === 'string') &&
    answersTooLong(answers).length === 0
  )
}

/** A DRAFT's answers, one per configured question; a DRAFT may be incomplete (G5-5). */
export function saveAnswers(
  state: ProjectDemoState,
  venture: VentureContext,
  programme: ProgrammeContext,
  answers: unknown,
  now: Date,
): ApplicationResult {
  const found = draftOf(state, venture, programme)
  if (!found.ok) return found
  if (!validAnswers(answers, programme)) return { ok: false, reason: 'INVALID_ANSWERS' }
  const application: DemoApplication = {
    ...found.draft,
    programme_specific_answers: [...answers],
    updated_at: now.toISOString(),
  }
  return { ok: true, state: withApplication(state, application), application }
}

/** DEC-WF05-G5 (2, 5, 6): DRAFT → SUBMITTED once every question is answered; final. */
export function submitApplication(
  state: ProjectDemoState,
  venture: VentureContext,
  programme: ProgrammeContext,
  now: Date,
): ApplicationResult {
  const found = draftOf(state, venture, programme)
  if (!found.ok) return found
  const answers = found.draft.programme_specific_answers
  if (answers.length !== programme.questions.length || answers.some((a) => a.trim().length === 0)) {
    return { ok: false, reason: 'INCOMPLETE' }
  }
  const at = now.toISOString()
  const application: DemoApplication = {
    ...found.draft,
    status: 'SUBMITTED',
    updated_at: at,
    submitted_at: at,
  }
  return { ok: true, state: withApplication(state, application), application }
}

/**
 * WF05-S03 "Lưu nháp": one atomic step. The first save creates the DRAFT
 * (HC-WF05-06/07: opening the form stores nothing); later saves update the same
 * application (one per venture × programme). Answers may be incomplete. A
 * SUBMITTED application is never touched; any refusal changes nothing.
 */
export function saveDraft(
  state: ProjectDemoState,
  venture: VentureContext,
  programme: ProgrammeContext,
  answers: unknown,
  now: Date,
): ApplicationResult {
  const current = applicationOf(state, venture.id, programme.id)
  if (current?.status === 'SUBMITTED') return { ok: false, reason: 'SUBMITTED' }
  const refusal = eligible(venture, programme)
  if (refusal) return { ok: false, reason: refusal }
  if (!validAnswers(answers, programme)) return { ok: false, reason: 'INVALID_ANSWERS' }
  if (current) return saveAnswers(state, venture, programme, answers, now)
  const started = startApplication(state, venture, programme, now)
  return started.ok ? saveAnswers(started.state, venture, programme, answers, now) : started
}
