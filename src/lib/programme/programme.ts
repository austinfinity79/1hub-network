import { randomBytes } from 'node:crypto'

import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit, type AuditAction } from '@/lib/audit/audit'
import { resolveActor, type Actor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { can, require as requireCapability } from '@/lib/authz/authorize'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'
import { OPS_ORGANIZATION_TYPES, type OrganizationRefDTO } from '@/lib/ops/organizations'
import { organizationScope } from '@/lib/ops/scope'

import {
  challengeOf,
  checkDates,
  invalid,
  isUuid,
  journeyOf,
  parseCreate,
  parseEmptyBody,
  parseRegistration,
  parseUpdate,
  readProblems,
  readStages,
} from './rules'
import type {
  ProgrammeDetailDTO,
  ProgrammeDTO,
  ProgrammeEventDTO,
  ProgrammeRegistrationDTO,
  ProgrammeStatus,
  ProgrammeSummaryDTO,
  ProgrammeType,
  RegistrationApplicantType,
  RegistrationQuestionDTO,
} from './types'

/**
 * WF04-PROD-03 — the canonical Programme / Challenge service behind
 * `/api/v1/programmes*` (API 05 §22, amendment A5; WF04 production contract
 * §4–§14; DEC-W4P-D02, D11, D12).
 *
 * Authority: the session account's ACTIVE RoleAssignments against the approved
 * matrix, scoped to the programme's stored owning organization
 * (`programmes.organization_id`, HUB / CHAPTER / CLB). `programme:read` reads,
 * `programme:manage` writes; both are HUB_COMMUNITY_LEADER of exactly that
 * organization or PLATFORM_ADMIN. Nothing in the request (header, query, body,
 * client state) names a role or a scope; the owner in a create body is a choice
 * the actor must already hold `programme:manage` for. Every call needs a
 * session and a completed onboarding.
 *
 * A programme the actor may not read or manage is the same 404 as an unknown or
 * malformed id, so ids cannot be probed. Every write locks the row, re-checks
 * the lifecycle in the transaction and writes one audit event (ids, type,
 * status, version, field names; never free text).
 *
 * Lifecycle (DEC-W4P-D11, D12): create → DRAFT; content edits in DRAFT and
 * PUBLISHED; DRAFT → PUBLISHED; PUBLISHED → CLOSED. Nothing returns to an
 * earlier state, nothing is deleted, and ARCHIVED is never written.
 */

const READ = 'programme:read'
const MANAGE = 'programme:manage'
const EDITABLE: readonly ProgrammeStatus[] = ['DRAFT', 'PUBLISHED']
// A constant list of enum labels, never request data.
const OPERATIONAL = OPS_ORGANIZATION_TYPES.map((t) => `'${t}'`).join(', ')

const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)

type Row = {
  id: string
  organization_id: string
  type: ProgrammeType
  slug: string
  name: string
  summary: string | null
  status: ProgrammeStatus
  starts_at: Date | null
  ends_at: Date | null
  metadata: Record<string, unknown>
  created_at: Date
  updated_at: Date
  org_slug: string
  org_name: string
  org_type: string
}

const COLUMNS = `p.id::text, p.organization_id::text, p.programme_type::text AS type, p.slug,
  p.name, p.summary, p.status::text AS status, p.starts_at, p.ends_at, p.metadata,
  p.created_at, p.updated_at, o.slug AS org_slug, o.name AS org_name, o.type::text AS org_type`

const FROM = `FROM programmes p
  JOIN organizations o ON o.id = p.organization_id AND o.type::text IN (${OPERATIONAL})`

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null)

const toDTO = (r: Row): ProgrammeDTO => ({
  id: r.id,
  type: r.type,
  organization_id: r.organization_id,
  slug: r.slug,
  name: r.name,
  summary: r.summary,
  status: r.status,
  starts_at: iso(r.starts_at),
  ends_at: iso(r.ends_at),
  created_at: iso(r.created_at)!,
  updated_at: iso(r.updated_at)!,
})

const organizationOf = (r: Row): OrganizationRefDTO => ({
  id: r.organization_id,
  slug: r.org_slug,
  name: r.org_name,
  type: r.org_type,
})

/** Session entry: a completed onboarding, then the actor from the database only. */
async function entryActor(accountId: string, exec: Executor = query): Promise<Actor> {
  const state = await getOnboardingState(accountId, exec)
  if (!state.completed) throw forbidden()
  return resolveActor(accountId)
}

async function load(exec: Executor, id: string, lock = false): Promise<Row | null> {
  if (!isUuid(id)) return null
  const [row] = await exec<Row>(
    `SELECT ${COLUMNS} ${FROM} WHERE p.id = $1 ${lock ? 'FOR UPDATE OF p' : ''}`,
    [id],
  )
  return row ?? null
}

const scopeOf = (row: Row) => ({ scopeType: 'ORGANIZATION' as const, scopeId: row.organization_id })

/** A programme the actor may manage, locked; anything else is the same 404. */
async function manageable(exec: Executor, actor: Actor, id: string): Promise<Row> {
  const row = await load(exec, id, true)
  if (!row || !(await can(actor, MANAGE, scopeOf(row)))) throw notFound()
  return row
}

function readQuestions(raw: unknown): RegistrationQuestionDTO[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((q): RegistrationQuestionDTO[] => {
    if (!q || typeof q !== 'object') return []
    const { id, prompt, required, step } = q as Record<string, unknown>
    if (typeof id !== 'string' || typeof prompt !== 'string') return []
    return [
      {
        id,
        prompt,
        required: required !== false,
        step: ([1, 2, 3, 4].includes(step as number) ? step : 1) as RegistrationQuestionDTO['step'],
      },
    ]
  })
}

type FormRow = { applicant_types: string[]; questions: unknown; version: number }

async function formOf(exec: Executor, id: string, lock = false): Promise<FormRow | null> {
  const [form] = await exec<FormRow>(
    `SELECT applicant_types::text[] AS applicant_types, questions, version
       FROM programme_application_forms WHERE programme_id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  )
  return form ?? null
}

const registrationOf = (form: FormRow | null): ProgrammeRegistrationDTO | null =>
  form && {
    applicant_types: form.applicant_types as RegistrationApplicantType[],
    questions: readQuestions(form.questions),
    version: form.version,
  }

type EventRow = Omit<ProgrammeEventDTO, 'starts_at' | 'ends_at' | 'created_at' | 'updated_at'> & {
  starts_at: Date | null
  ends_at: Date | null
  created_at: Date
  updated_at: Date
}

async function detailOf(exec: Executor, row: Row): Promise<ProgrammeDetailDTO> {
  const events = await exec<EventRow>(
    `SELECT id::text, organization_id::text, programme_id::text, slug, name, summary, starts_at,
            ends_at, location_text, status::text AS status, created_at, updated_at
       FROM events WHERE programme_id = $1
      ORDER BY starts_at NULLS LAST, created_at, id`,
    [row.id],
  )
  return {
    programme: toDTO(row),
    organization: organizationOf(row),
    stages: readStages(row.metadata),
    ...(row.type === 'CHALLENGE' ? { problem_statements: readProblems(row.metadata) } : {}),
    events: events.map((e) => ({
      ...e,
      starts_at: iso(e.starts_at),
      ends_at: iso(e.ends_at),
      created_at: iso(e.created_at)!,
      updated_at: iso(e.updated_at)!,
    })),
    registration: registrationOf(await formOf(exec, row.id)),
  }
}

async function reload(exec: Executor, id: string): Promise<ProgrammeDetailDTO> {
  return detailOf(exec, (await load(exec, id))!)
}

function audit(
  exec: Executor,
  accountId: string,
  action: AuditAction,
  row: Row,
  requestId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) {
  const base = { programme_id: row.id, organization_id: row.organization_id, type: row.type }
  return writeAudit(exec, {
    actorAccountId: accountId,
    action,
    resourceType: 'programme',
    resourceId: row.id,
    before: before && { ...base, ...before },
    after: { ...base, ...after },
    requestId,
  })
}

// ----------------------------------------------------------------- reads

/** GET /programmes — every programme the actor holds `programme:read` for. */
export async function listProgrammes(accountId: string): Promise<ProgrammeSummaryDTO[]> {
  const scope = organizationScope(await entryActor(accountId), READ)
  if (scope.kind === 'SOME' && scope.organizationIds.length === 0) throw forbidden()
  const rows = await query<Row & { events_n: number }>(
    `SELECT ${COLUMNS},
            (SELECT count(*)::int FROM events e WHERE e.programme_id = p.id) AS events_n
       ${FROM}
       ${scope.kind === 'ALL' ? '' : 'WHERE p.organization_id = ANY($1::uuid[])'}
      ORDER BY p.created_at DESC, p.id
      LIMIT 200`,
    scope.kind === 'ALL' ? [] : [scope.organizationIds],
  )
  return rows.map((r) => ({
    ...toDTO(r),
    organization: organizationOf(r),
    counts: {
      stages: readStages(r.metadata).length,
      events: r.events_n,
      problem_statements: r.type === 'CHALLENGE' ? readProblems(r.metadata).length : null,
    },
  }))
}

/** GET /programmes/{id} — the aggregate, its linked events and its form. */
export async function getProgramme(accountId: string, id: string): Promise<ProgrammeDetailDTO> {
  const actor = await entryActor(accountId)
  const row = await load(query, id)
  if (!row || !(await can(actor, READ, scopeOf(row)))) throw notFound()
  return detailOf(query, row)
}

// ----------------------------------------------------------------- writes

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

function slugFor(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'chuong-trinh'}-${randomBytes(4).toString('hex')}`
}

/** POST /programmes → 201, a DRAFT owned by an organization the actor manages. */
export async function createProgramme(
  accountId: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<ProgrammeDetailDTO> {
  return inTransaction(exec, async (tx) => {
    const actor = await entryActor(accountId, tx)
    const scope = organizationScope(actor, MANAGE)
    if (scope.kind === 'SOME' && scope.organizationIds.length === 0) throw forbidden()
    const fields = parseCreate(body)
    // Unknown and out-of-scope owners are the same 403, so organizations cannot be probed.
    await requireCapability(actor, MANAGE, {
      scopeType: 'ORGANIZATION',
      scopeId: fields.organization_id,
    })
    const [owner] = await tx<{ id: string }>(
      `SELECT id::text FROM organizations WHERE id = $1 AND type::text IN (${OPERATIONAL})`,
      [fields.organization_id],
    )
    if (!owner) throw invalid('organization_id', 'invalid')
    const [created] = await tx<{ id: string }>(
      `INSERT INTO programmes
         (organization_id, programme_type, slug, name, summary, starts_at, ends_at, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', '{}'::jsonb)
       RETURNING id::text`,
      [
        owner.id,
        fields.type,
        slugFor(fields.name),
        fields.name,
        fields.summary ?? null,
        fields.starts_at ?? null,
        fields.ends_at ?? null,
      ],
    )
    const row = (await load(tx, created!.id))!
    await audit(tx, accountId, 'PROGRAMME_CREATED', row, requestId, null, { status: 'DRAFT' })
    return detailOf(tx, row)
  })
}

/**
 * PATCH /programmes/{id} — name, summary, dates, stages and (CHALLENGE only)
 * problem statements, in DRAFT or PUBLISHED. Lists replace the stored list.
 */
export async function updateProgramme(
  accountId: string,
  id: string,
  body: unknown,
  requestId: string,
): Promise<ProgrammeDetailDTO> {
  return withTransaction(async (tx) => {
    const actor = await entryActor(accountId, tx)
    const row = await manageable(tx, actor, id)
    const fields = parseUpdate(body, row.type)
    if (!EDITABLE.includes(row.status)) throw conflict('This programme can no longer be edited.')

    const current = {
      name: row.name,
      summary: row.summary,
      starts_at: iso(row.starts_at),
      ends_at: iso(row.ends_at),
    }
    const next = {
      name: fields.name ?? current.name,
      summary: fields.summary !== undefined ? fields.summary : current.summary,
      starts_at: fields.starts_at !== undefined ? fields.starts_at : current.starts_at,
      ends_at: fields.ends_at !== undefined ? fields.ends_at : current.ends_at,
    }
    checkDates(next.starts_at, next.ends_at)
    const changed: string[] = (Object.keys(current) as (keyof typeof current)[]).filter(
      (f) => next[f] !== current[f],
    )

    const metadata: Record<string, unknown> = { ...row.metadata }
    if (fields.stages) {
      if (JSON.stringify(fields.stages) !== JSON.stringify(readStages(row.metadata)))
        changed.push('stages')
      metadata.journey = journeyOf(fields.stages)
    }
    if (fields.problem_statements) {
      if (JSON.stringify(fields.problem_statements) !== JSON.stringify(readProblems(row.metadata)))
        changed.push('problem_statements')
      metadata.challenge = challengeOf(fields.problem_statements)
    }
    if (changed.length === 0) return detailOf(tx, row)

    await tx(
      `UPDATE programmes SET name = $2, summary = $3, starts_at = $4, ends_at = $5,
              metadata = $6::jsonb, updated_at = now()
        WHERE id = $1`,
      [row.id, next.name, next.summary, next.starts_at, next.ends_at, JSON.stringify(metadata)],
    )
    await audit(
      tx,
      accountId,
      'PROGRAMME_UPDATED',
      row,
      requestId,
      { status: row.status },
      { status: row.status, changed_fields: changed },
    )
    return reload(tx, row.id)
  })
}

/**
 * PUT /programmes/{id}/registration — the canonical form WF05 reads. A change
 * bumps `version` (contract §9). Once any application exists the form is
 * refused with 409: editing it then is contract Q3 and stays undecided.
 */
export async function putProgrammeRegistration(
  accountId: string,
  id: string,
  body: unknown,
  requestId: string,
): Promise<ProgrammeDetailDTO> {
  return withTransaction(async (tx) => {
    const actor = await entryActor(accountId, tx)
    const row = await manageable(tx, actor, id)
    const input = parseRegistration(body)
    if (!EDITABLE.includes(row.status))
      throw conflict('The registration of this programme can no longer change.')

    const form = await formOf(tx, row.id, true)
    if (
      form &&
      JSON.stringify(form.applicant_types) === JSON.stringify(input.applicant_types) &&
      JSON.stringify(readQuestions(form.questions)) === JSON.stringify(input.questions)
    )
      return detailOf(tx, row)

    const [used] = await tx<{ one: number }>(
      'SELECT 1 AS one FROM applications WHERE programme_id = $1 LIMIT 1',
      [row.id],
    )
    if (used) throw conflict('The registration cannot change once applications exist.')

    const version = form ? form.version + 1 : 1
    await tx(
      `INSERT INTO programme_application_forms (programme_id, applicant_types, questions, version, updated_at)
       VALUES ($1, $2::applicant_type[], $3::jsonb, $4, now())
       ON CONFLICT (programme_id) DO UPDATE SET
         applicant_types = EXCLUDED.applicant_types, questions = EXCLUDED.questions,
         version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`,
      [row.id, input.applicant_types, JSON.stringify(input.questions), version],
    )
    await tx('UPDATE programmes SET updated_at = now() WHERE id = $1', [row.id])
    await audit(
      tx,
      accountId,
      'PROGRAMME_REGISTRATION_UPDATED',
      row,
      requestId,
      { status: row.status, version: form?.version ?? null },
      { status: row.status, version },
    )
    return reload(tx, row.id)
  })
}

type Transition = {
  from: ProgrammeStatus
  to: ProgrammeStatus
  action: AuditAction
  refusal: string
  /** Publish rules (contract §8): failing items, all at once. */
  check?: (row: Row) => Record<string, string>
}

async function transition(
  t: Transition,
  accountId: string,
  id: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<ProgrammeDetailDTO> {
  return inTransaction(exec, async (tx) => {
    const actor = await entryActor(accountId, tx)
    const row = await manageable(tx, actor, id)
    parseEmptyBody(body)
    if (row.status !== t.from) throw conflict(t.refusal)
    const failing = t.check?.(row) ?? {}
    if (Object.keys(failing).length > 0)
      throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Programme validation failed.', failing)
    await tx(`UPDATE programmes SET status = $2, updated_at = now() WHERE id = $1`, [row.id, t.to])
    await audit(tx, accountId, t.action, row, requestId, { status: t.from }, { status: t.to })
    return reload(tx, row.id)
  })
}

/**
 * Contract §8, REQUIRED BY SOT and TECHNICALLY REQUIRED only: an owning
 * organization (NOT NULL), a name, a valid type (enum) and end ≥ start. The
 * demo's "CHALLENGE needs a problem" and every undefined rule (dates, stages, a
 * form) are not production rules (Q7).
 */
function publishRules(row: Row): Record<string, string> {
  const failing: Record<string, string> = {}
  if (!row.name.trim()) failing.name = 'required'
  if (row.starts_at && row.ends_at && row.ends_at.getTime() < row.starts_at.getTime())
    failing.ends_at = 'before_start'
  return failing
}

/** POST /programmes/{id}/publish — DRAFT → PUBLISHED; again → 409. */
export function publishProgramme(
  accountId: string,
  id: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<ProgrammeDetailDTO> {
  return transition(
    {
      from: 'DRAFT',
      to: 'PUBLISHED',
      action: 'PROGRAMME_PUBLISHED',
      refusal: 'Only a draft programme can be published.',
      check: publishRules,
    },
    accountId,
    id,
    body,
    requestId,
    exec,
  )
}

/** POST /programmes/{id}/close — PUBLISHED → CLOSED (DEC-W4P-D12); again → 409. */
export function closeProgramme(
  accountId: string,
  id: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<ProgrammeDetailDTO> {
  return transition(
    {
      from: 'PUBLISHED',
      to: 'CLOSED',
      action: 'PROGRAMME_CLOSED',
      refusal: 'Only a published programme can be closed.',
    },
    accountId,
    id,
    body,
    requestId,
    exec,
  )
}
