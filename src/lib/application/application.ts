import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'
import { getTeam } from '@/lib/venture/team'
import { getVenture, type VentureType } from '@/lib/venture/venture'

import { applicantTypeFor } from './applicant'
import {
  ANSWER_MAX_LENGTH,
  type ApplicantType,
  type ApplicationAnswer,
  type ApplicationDTO,
  type ApplicationLockReason,
  type ApplicationProgramme,
  type ApplicationProgrammeStatus,
  type ApplicationQuestion,
  type ApplicationSnapshot,
  type ApplicationStatus,
  type ApplicationSummaryDTO,
  type ApplicationTeamMember,
  type ApplicationVenture,
  type FormStep,
} from './types'

/**
 * TASK 24.4 (DEC-L5-D2 / D3) — the server-side Application.
 *
 * Authority is the relation rule of the venture, like `venture:manage`: the
 * session's own profile must own the venture (DEC-WF05-G5-1), with onboarding
 * DONE. Anyone else — an ACTIVE team member, an organiser, a platform admin —
 * reads nothing: the same 404 as an unknown id (HD-A13, review is Future). No
 * owner, applicant or status is ever read from the request.
 *
 * The application references the canonical venture and programme and stores
 * only the programme-specific answers; the submit snapshot freezes what was
 * sent. Audit carries ids and statuses, never answers.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const invalid = (field: string, reason: string) =>
  new ApiError('APPLICATION_VALIDATION_FAILED', 422, 'Application validation failed.', {
    [field]: reason,
  })

const notEligible = (reason: string) =>
  new ApiError('APPLICATION_NOT_ELIGIBLE', 409, 'This venture cannot apply to this programme.', {
    reason,
  })

const alreadySubmitted = () =>
  new ApiError('APPLICATION_SUBMITTED', 409, 'A submitted application cannot change.')

async function requireEntry(accountId: string, exec: Executor = query): Promise<string> {
  const state = await getOnboardingState(accountId, exec)
  if (!state.completed)
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Complete onboarding before applying.')
  const [profile] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  if (!profile) throw new ApiError('SCOPE_FORBIDDEN', 403, 'No profile.')
  return profile.id
}

export type Form = {
  programme: ApplicationProgramme
  status: ApplicationProgrammeStatus
  starts_at: string | null
  ends_at: string | null
  applicant_types: ApplicantType[]
  questions: ApplicationQuestion[]
  version: number
}

function toQuestions(raw: unknown): ApplicationQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((q): ApplicationQuestion[] => {
    if (!q || typeof q !== 'object') return []
    const { id, prompt, required, step } = q as Record<string, unknown>
    if (typeof id !== 'string' || typeof prompt !== 'string') return []
    const s = [1, 2, 3, 4].includes(step as number) ? (step as FormStep) : 1
    return [{ id, prompt, required: required !== false, step: s }]
  })
}

/**
 * How a caller reads the programme's canonical form:
 *   open  a PUBLISHED programme only (who may still apply, save or submit);
 *   lock  the same, holding the programme and the form row FOR SHARE until the
 *         transaction ends, in the order WF04 locks them (programme, then form):
 *         a concurrent `PUT …/registration` or close waits, so no application
 *         is created, saved or submitted against a form or a state that is
 *         changing (WF05-PROD-03, G10; the Q3 lock rule);
 *   read  whatever the programme's state, for the owner's read-only history
 *         (CLOSED / ARCHIVED, WF05 contract programme-state matrix).
 */
type FormMode = 'open' | 'lock' | 'read'

/** The programme's application form, or null (unknown id, no form, or not PUBLISHED unless `read`). */
async function loadForm(
  exec: Executor,
  programmeId: string,
  mode: FormMode = 'open',
): Promise<Form | null> {
  if (!UUID.test(programmeId)) return null
  if (mode === 'lock')
    await exec('SELECT 1 AS one FROM programmes WHERE id = $1 FOR SHARE', [programmeId])
  const [row] = await exec<{
    id: string
    type: 'PROGRAMME' | 'CHALLENGE'
    name: string
    summary: string | null
    organization: string
    status: ApplicationProgrammeStatus
    starts_at: string | null
    ends_at: string | null
    applicant_types: string[]
    questions: unknown
    version: number
  }>(
    `SELECT p.id::text, p.programme_type::text AS type, p.name, p.summary,
            o.name AS organization, p.status::text AS status, p.starts_at, p.ends_at,
            f.applicant_types::text[] AS applicant_types,
            f.questions, f.version
       FROM programmes p
       JOIN programme_application_forms f ON f.programme_id = p.id
       JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = $1 ${mode === 'read' ? '' : "AND p.status = 'PUBLISHED'"}
      ${mode === 'lock' ? 'FOR SHARE OF f' : ''}`,
    [programmeId],
  )
  if (!row) return null
  return {
    programme: {
      id: row.id,
      type: row.type,
      name: row.name,
      summary: row.summary,
      organization: { name: row.organization },
    },
    status: row.status,
    starts_at: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    ends_at: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    applicant_types: row.applicant_types as ApplicantType[],
    questions: toQuestions(row.questions),
    version: row.version,
  }
}

/**
 * The venture as the application sees it; the WF02 read rule (owner or ACTIVE
 * member, else 404), read on the caller's executor so a transaction never
 * borrows a second pool connection (WF05-PROD-03, G13).
 */
async function ventureOf(
  exec: Executor,
  accountId: string,
  ventureId: string,
): Promise<ApplicationVenture & { relation: 'OWNER' | 'MEMBER' }> {
  const v = await getVenture(accountId, ventureId, exec)
  return {
    id: v.id,
    type: v.type,
    name: v.name,
    summary: v.summary,
    status: v.status,
    stage: v.stage ? { code: v.stage.code, label: v.stage.label } : null,
    domains: v.domains.map((d) => ({ id: d.id, label: d.label })),
    relation: v.relation,
  }
}

/** The venture fields an application shows and snapshots (no relation). */
const publicVenture = (v: ApplicationVenture): ApplicationVenture => ({
  id: v.id,
  type: v.type,
  name: v.name,
  summary: v.summary,
  status: v.status,
  stage: v.stage,
  domains: v.domains,
})

async function teamOf(
  exec: Executor,
  accountId: string,
  ventureId: string,
): Promise<ApplicationTeamMember[]> {
  const team = await getTeam(accountId, ventureId, exec)
  return team.rows.flatMap((row): ApplicationTeamMember[] =>
    row.kind === 'PENDING_INVITATION'
      ? []
      : [
          {
            relation: row.kind === 'OWNER' ? 'OWNER' : 'MEMBER',
            display_name: row.display_name,
            role_label: row.role_label,
          },
        ],
  )
}

/** Eligibility on server facts (DEC-WF05-G3..G5): owner, not archived, type accepted. */
function assertEligible(
  venture: { type: VentureType; status: string; relation: 'OWNER' | 'MEMBER' },
  form: Form,
): void {
  if (venture.relation !== 'OWNER')
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the venture owner can apply.')
  if (venture.status === 'ARCHIVED') throw notEligible('ARCHIVED')
  if (!form.applicant_types.includes(applicantTypeFor(venture.type)))
    throw notEligible('TYPE_NOT_ACCEPTED')
}

type Row = {
  id: string
  programme_id: string
  venture_id: string
  primary_applicant_type: ApplicantType
  status: ApplicationStatus
  answers: ApplicationAnswer[]
  question_set_version: number
  created_at: string
  updated_at: string
  submitted_at: string | null
  snapshot: ApplicationSnapshot | null
  owner: boolean
}

/** The application if the session's profile owns its venture; otherwise the same 404. */
async function ownRow(
  exec: Executor,
  profileId: string,
  applicationId: string,
  lock = false,
): Promise<Row> {
  if (!UUID.test(applicationId)) throw notFound()
  const [row] = await exec<Row>(
    `SELECT a.id::text, a.programme_id::text, a.venture_id::text,
            a.primary_applicant_type::text AS primary_applicant_type, a.status::text AS status,
            a.answers, a.question_set_version, a.created_at::text, a.updated_at::text,
            a.submitted_at::text, a.snapshot, (p.owner_profile_id = $2) AS owner
       FROM applications a JOIN projects p ON p.id = a.venture_id
      WHERE a.id = $1 ${lock ? 'FOR UPDATE OF a' : ''}`,
    [applicationId, profileId],
  )
  if (!row || !row.owner) throw notFound()
  return row
}

const missingOf = (questions: ApplicationQuestion[], answers: ApplicationAnswer[]) =>
  questions
    .filter((q) => q.required && !answers.find((a) => a.question_id === q.id)?.value.trim())
    .map((q) => q.id)

async function toDTO(exec: Executor, accountId: string, row: Row): Promise<ApplicationDTO> {
  if (row.status === 'SUBMITTED' && row.snapshot) {
    const s = row.snapshot
    const { question_set_version: version, ...programme } = s.programme
    return {
      id: row.id,
      status: 'SUBMITTED',
      primary_applicant_type: row.primary_applicant_type,
      programme,
      venture: s.venture,
      team: s.team,
      questions: s.questions,
      answers: s.answers,
      missing: [],
      question_set_version: version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      submitted_at: s.submitted_at,
      editable: false,
      reason: 'SUBMITTED',
    }
  }
  // A draft reads its programme's form whatever the programme's state, so the
  // owner keeps the saved answers of a CLOSED / ARCHIVED programme, read only.
  const form = await loadForm(exec, row.programme_id, 'read')
  const questions = form?.questions ?? []
  const live = await ventureOf(exec, accountId, row.venture_id)
  const venture = publicVenture(live)
  const answers = row.answers.filter((a) => questions.some((q) => q.id === a.question_id))
  const reason: ApplicationLockReason | null =
    form?.status !== 'PUBLISHED' ? 'NOT_PUBLISHED' : live.status === 'ARCHIVED' ? 'ARCHIVED' : null
  return {
    id: row.id,
    status: row.status,
    primary_applicant_type: row.primary_applicant_type,
    programme: form?.programme ?? (await programmeOf(exec, row.programme_id)),
    venture,
    team: await teamOf(exec, accountId, row.venture_id),
    questions,
    answers,
    missing: missingOf(questions, answers),
    question_set_version: form?.version ?? row.question_set_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitted_at: null,
    editable: reason === null,
    reason,
  }
}

async function programmeOf(exec: Executor, programmeId: string): Promise<ApplicationProgramme> {
  const [p] = await exec<{
    id: string
    type: 'PROGRAMME' | 'CHALLENGE'
    name: string
    summary: string | null
    organization: string
  }>(
    `SELECT p.id::text, p.programme_type::text AS type, p.name, p.summary, o.name AS organization
       FROM programmes p JOIN organizations o ON o.id = p.organization_id WHERE p.id = $1`,
    [programmeId],
  )
  return {
    id: p!.id,
    type: p!.type,
    name: p!.name,
    summary: p!.summary,
    organization: { name: p!.organization },
  }
}

/** GET /me/applications: the applications of ventures the session's profile owns. */
export async function listMyApplications(accountId: string): Promise<ApplicationSummaryDTO[]> {
  const profileId = await requireEntry(accountId)
  return query<ApplicationSummaryDTO>(
    `SELECT a.id::text, a.status::text AS status,
            json_build_object('id', g.id::text, 'name', g.name, 'status', g.status::text) AS programme,
            json_build_object('id', p.id::text, 'name', p.name, 'type', p.type::text) AS venture,
            a.updated_at::text, a.submitted_at::text
       FROM applications a
       JOIN projects p ON p.id = a.venture_id
       JOIN programmes g ON g.id = a.programme_id
      WHERE p.owner_profile_id = $1
      ORDER BY a.updated_at DESC, a.id`,
    [profileId],
  )
}

/** POST /applications `{venture_id, programme_id}` inside the caller's transaction. */
export async function createApplicationIn(
  exec: Executor,
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<ApplicationDTO> {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input))
    if (key !== 'venture_id' && key !== 'programme_id') throw invalid(key, 'not_accepted')
  if (typeof input.venture_id !== 'string' || !UUID.test(input.venture_id))
    throw invalid('venture_id', 'invalid')
  if (typeof input.programme_id !== 'string' || !UUID.test(input.programme_id))
    throw invalid('programme_id', 'invalid')
  const profileId = await requireEntry(accountId, exec)
  const form = await loadForm(exec, input.programme_id, 'lock')
  if (!form) throw notFound()
  const venture = await ventureOf(exec, accountId, input.venture_id)
  assertEligible(venture, form)
  // One active application per pair (uq_applications_active_pair): a concurrent
  // second create inserts nothing and gets the same 409 as a late one.
  const [created] = await exec<{ id: string }>(
    `INSERT INTO applications
       (programme_id, venture_id, primary_applicant_type, question_set_version, created_by_account_id)
     VALUES ($1, $2, $3::applicant_type, $4, $5)
     ON CONFLICT (venture_id, programme_id) WHERE status IN ('DRAFT', 'SUBMITTED') DO NOTHING
     RETURNING id::text`,
    [form.programme.id, venture.id, applicantTypeFor(venture.type), form.version, accountId],
  )
  if (!created) {
    const [existing] = await exec<{ id: string }>(
      `SELECT id::text FROM applications
        WHERE venture_id = $1 AND programme_id = $2 AND status IN ('DRAFT', 'SUBMITTED')`,
      [venture.id, form.programme.id],
    )
    throw new ApiError(
      'APPLICATION_EXISTS',
      409,
      'This venture already applied to this programme.',
      {
        application_id: existing?.id ?? '',
      },
    )
  }
  await writeAudit(exec, {
    actorAccountId: accountId,
    action: 'APPLICATION_DRAFT_CREATED',
    resourceType: 'application',
    resourceId: created.id,
    before: null,
    after: { programme_id: form.programme.id, venture_id: venture.id, status: 'DRAFT' },
    requestId,
  })
  return toDTO(exec, accountId, await ownRow(exec, profileId, created.id))
}

export async function createApplication(
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<ApplicationDTO> {
  return withTransaction((exec) => createApplicationIn(exec, accountId, body, requestId))
}

/** GET /applications/{id}: the owner only; anyone else the same 404. */
export async function getApplication(
  accountId: string,
  applicationId: string,
): Promise<ApplicationDTO> {
  const profileId = await requireEntry(accountId)
  return toDTO(query, accountId, await ownRow(query, profileId, applicationId))
}

function parseAnswers(body: unknown, questions: ApplicationQuestion[]): ApplicationAnswer[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) if (key !== 'answers') throw invalid(key, 'not_accepted')
  if (!Array.isArray(input.answers)) throw invalid('answers', 'invalid')
  // At most one entry per question of the form (WF05 contract, PATCH payload).
  if (input.answers.length > questions.length) throw invalid('answers', 'too_many')
  const seen = new Set<string>()
  return input.answers.map((raw) => {
    if (!raw || typeof raw !== 'object') throw invalid('answers', 'invalid')
    const { question_id, value } = raw as Record<string, unknown>
    if (typeof question_id !== 'string' || !questions.some((q) => q.id === question_id))
      throw invalid('answers', 'unknown_question')
    if (seen.has(question_id)) throw invalid('answers', 'duplicate')
    seen.add(question_id)
    if (typeof value !== 'string') throw invalid(question_id, 'invalid')
    if (value.length > ANSWER_MAX_LENGTH) throw invalid(question_id, 'too_long')
    return { question_id, value }
  })
}

/**
 * PATCH /applications/{id} `{answers}`: the owner saves a DRAFT. Given answers
 * replace their question's value; an empty value clears it. A SUBMITTED
 * application is 409 and nothing changes.
 *
 * WF05-PROD-05 (carry-forward B): a save that changes an answer is audited as
 * `APPLICATION_DRAFT_UPDATED` with ids, status and the changed question ids —
 * never a value (the X_UPDATED convention of WF02–WF04). A save that changes
 * nothing writes no audit; a refused save writes nothing.
 */
export async function saveApplicationAnswers(
  accountId: string,
  applicationId: string,
  body: unknown,
  requestId: string,
): Promise<ApplicationDTO> {
  return withTransaction(async (exec) => {
    const profileId = await requireEntry(accountId, exec)
    const row = await ownRow(exec, profileId, applicationId, true)
    if (row.status !== 'DRAFT') throw alreadySubmitted()
    const form = await loadForm(exec, row.programme_id, 'lock')
    if (!form) throw notEligible('NOT_PUBLISHED')
    // An ARCHIVED venture's draft is read only, as at create and submit (G09).
    if ((await ventureOf(exec, accountId, row.venture_id)).status === 'ARCHIVED')
      throw notEligible('ARCHIVED')
    const given = parseAnswers(body, form.questions)
    const merged = form.questions.flatMap((q): ApplicationAnswer[] => {
      const next = given.find((a) => a.question_id === q.id)
      const value = next ? next.value : row.answers.find((a) => a.question_id === q.id)?.value
      return value?.trim() ? [{ question_id: q.id, value }] : []
    })
    await exec(
      `UPDATE applications SET answers = $2::jsonb, question_set_version = $3, updated_at = now()
        WHERE id = $1`,
      [row.id, JSON.stringify(merged), form.version],
    )
    const valueOf = (answers: ApplicationAnswer[], id: string) =>
      answers.find((a) => a.question_id === id)?.value ?? ''
    const changed = form.questions
      .map((q) => q.id)
      .filter((id) => valueOf(merged, id) !== valueOf(row.answers, id))
    if (changed.length > 0)
      await writeAudit(exec, {
        actorAccountId: accountId,
        action: 'APPLICATION_DRAFT_UPDATED',
        resourceType: 'application',
        resourceId: row.id,
        before: { status: 'DRAFT' },
        after: {
          programme_id: row.programme_id,
          venture_id: row.venture_id,
          status: 'DRAFT',
          changed_questions: changed,
        },
        requestId,
      })
    return toDTO(exec, accountId, await ownRow(exec, profileId, row.id))
  })
}

/**
 * POST /applications/{id}/submit inside the caller's transaction: the row is
 * locked, eligibility and every required answer re-checked, then SUBMITTED and
 * the snapshot are written together. A second submit is 409.
 */
export async function submitApplicationIn(
  exec: Executor,
  accountId: string,
  applicationId: string,
  requestId: string,
): Promise<ApplicationDTO> {
  const profileId = await requireEntry(accountId, exec)
  const row = await ownRow(exec, profileId, applicationId, true)
  if (row.status !== 'DRAFT') throw alreadySubmitted()
  const form = await loadForm(exec, row.programme_id, 'lock')
  if (!form) throw notEligible('NOT_PUBLISHED')
  const live = await ventureOf(exec, accountId, row.venture_id)
  assertEligible(live, form)
  const answers = row.answers.filter((a) => form.questions.some((q) => q.id === a.question_id))
  const missing = missingOf(form.questions, answers)
  if (missing.length)
    throw new ApiError(
      'APPLICATION_INCOMPLETE',
      422,
      'Every required question needs an answer.',
      Object.fromEntries(missing.map((id) => [id, 'required'])),
    )
  const venture = publicVenture(live)
  const [clock] = await exec<{ now: string }>('SELECT now()::text AS now')
  const now = clock!.now
  const snapshot: ApplicationSnapshot = {
    schema_version: 1,
    programme: { ...form.programme, question_set_version: form.version },
    questions: form.questions,
    answers,
    venture,
    team: await teamOf(exec, accountId, row.venture_id),
    submitted_at: now,
  }
  await exec(
    `UPDATE applications
        SET status = 'SUBMITTED', submitted_at = $2::timestamptz, submitted_by_account_id = $3,
            snapshot = $4::jsonb, question_set_version = $5, updated_at = $2::timestamptz
      WHERE id = $1`,
    [row.id, now, accountId, JSON.stringify(snapshot), form.version],
  )
  await writeAudit(exec, {
    actorAccountId: accountId,
    action: 'APPLICATION_SUBMITTED',
    resourceType: 'application',
    resourceId: row.id,
    before: { status: 'DRAFT' },
    after: { programme_id: row.programme_id, venture_id: row.venture_id, status: 'SUBMITTED' },
    requestId,
  })
  return toDTO(exec, accountId, await ownRow(exec, profileId, row.id))
}

export async function submitApplication(
  accountId: string,
  applicationId: string,
  requestId: string,
): Promise<ApplicationDTO> {
  return withTransaction((exec) => submitApplicationIn(exec, accountId, applicationId, requestId))
}

/** The PUBLISHED programmes open to applications, for the WF05 lists (HD-A12). */
export async function listOpenForms(): Promise<Form[]> {
  const rows = await query<{ id: string }>(
    `SELECT p.id::text FROM programmes p
       JOIN programme_application_forms f ON f.programme_id = p.id
      WHERE p.status = 'PUBLISHED' ORDER BY p.starts_at NULLS LAST, p.name`,
  )
  const forms = await Promise.all(rows.map((r) => loadForm(query, r.id)))
  return forms.filter((f): f is Form => f !== null)
}

export type ApplicationContext = {
  form: Form
  venture: ApplicationVenture
  team: ApplicationTeamMember[]
  application: ApplicationDTO | null
  eligibility:
    | { eligible: true }
    | { eligible: false; reason: 'NOT_PUBLISHED' | 'ARCHIVED' | 'TYPE_NOT_ACCEPTED' }
}

/**
 * The SUB1–SUB3 pages (DEC-L5-D4): the programme's form, the owner's venture and
 * its active application to this programme, if any. The owner only; anyone else
 * or an unreadable venture is the same 404. A programme no longer PUBLISHED
 * opens only the owner's existing application, read only (WF05 contract,
 * programme-state matrix; WF05-PROD-04); without one it is the same 404.
 */
export async function getApplicationContext(
  accountId: string,
  ventureId: string,
  programmeId: string,
): Promise<ApplicationContext> {
  const profileId = await requireEntry(accountId)
  const form = await loadForm(query, programmeId, 'read')
  if (!form || !UUID.test(ventureId)) throw notFound()
  const live = await ventureOf(query, accountId, ventureId)
  if (live.relation !== 'OWNER') throw notFound()
  const [active] = await query<{ id: string }>(
    `SELECT id::text FROM applications
      WHERE venture_id = $1 AND programme_id = $2 AND status IN ('DRAFT', 'SUBMITTED')`,
    [ventureId, programmeId],
  )
  const open = form.status === 'PUBLISHED'
  if (!open && !active) throw notFound()
  const accepted = form.applicant_types.includes(applicantTypeFor(live.type))
  return {
    form,
    venture: publicVenture(live),
    team: await teamOf(query, accountId, ventureId),
    application: active
      ? await toDTO(query, accountId, await ownRow(query, profileId, active.id))
      : null,
    eligibility: !open
      ? { eligible: false, reason: 'NOT_PUBLISHED' }
      : live.status === 'ARCHIVED'
        ? { eligible: false, reason: 'ARCHIVED' }
        : accepted
          ? { eligible: true }
          : { eligible: false, reason: 'TYPE_NOT_ACCEPTED' },
  }
}

export type ApplyOption = {
  venture: { id: string; name: string; type: VentureType; status: string }
  application: { id: string; status: ApplicationStatus } | null
}

/**
 * The entry `/programmes/:id/apply` (DEC-L5-D4): the member's own ventures that
 * may apply (not archived, applicant type accepted) and their application to
 * this programme, if any. No eligible venture means SUB0.
 */
export async function getApplyOptions(
  accountId: string,
  programmeId: string,
): Promise<{ form: Form; options: ApplyOption[] }> {
  const profileId = await requireEntry(accountId)
  const form = await loadForm(query, programmeId)
  if (!form) throw notFound()
  const rows = await query<{
    id: string
    name: string
    type: VentureType
    status: string
    application_id: string | null
    application_status: ApplicationStatus | null
  }>(
    `SELECT p.id::text, p.name, p.type::text AS type, p.status::text AS status,
            a.id::text AS application_id, a.status::text AS application_status
       FROM projects p
       LEFT JOIN applications a ON a.venture_id = p.id AND a.programme_id = $2
                               AND a.status IN ('DRAFT', 'SUBMITTED')
      WHERE p.owner_profile_id = $1 AND p.status <> 'ARCHIVED'
      ORDER BY p.created_at, p.id`,
    [profileId, programmeId],
  )
  return {
    form,
    options: rows
      .filter((r) => form.applicant_types.includes(applicantTypeFor(r.type)))
      .map((r) => ({
        venture: { id: r.id, name: r.name, type: r.type, status: r.status },
        application: r.application_id
          ? { id: r.application_id, status: r.application_status! }
          : null,
      })),
  }
}

/**
 * The owner's active application of this venture to this programme, whatever
 * the programme's state (a submitted application stays readable after the
 * programme closes); null when there is none. Anyone else reads nothing.
 */
export async function findApplication(
  accountId: string,
  ventureId: string,
  programmeId: string,
): Promise<ApplicationDTO | null> {
  const profileId = await requireEntry(accountId)
  if (!UUID.test(ventureId) || !UUID.test(programmeId)) return null
  const [row] = await query<{ id: string }>(
    `SELECT a.id::text FROM applications a JOIN projects p ON p.id = a.venture_id
      WHERE a.venture_id = $1 AND a.programme_id = $2 AND p.owner_profile_id = $3
        AND a.status IN ('DRAFT', 'SUBMITTED')`,
    [ventureId, programmeId, profileId],
  )
  return row ? toDTO(query, accountId, await ownRow(query, profileId, row.id)) : null
}
