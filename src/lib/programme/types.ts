import type { EventDTO } from '@/lib/ops/events'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

/**
 * WF04-PROD-03 — Programme / Challenge production DTOs (API 05 §22, amendment A5;
 * WF04 production contract §3, §11, §12).
 *
 * One aggregate, `programme_type = PROGRAMME | CHALLENGE` (Data Freeze D1). The
 * field names follow the demo DTOs of DEC-WF04-T00-D2 so the screens can move
 * from the fixture to these endpoints in PROD-04 without renaming. Not exposed:
 * the raw `metadata`, applications (HD-A13), operating-team rows (Q4) and
 * application counts (Q5).
 */

export const PROGRAMME_TYPES = ['PROGRAMME', 'CHALLENGE'] as const
export type ProgrammeType = (typeof PROGRAMME_TYPES)[number]

/**
 * The `programme_status` domain (migration 015). The approved P0 lifecycle is
 * DRAFT → PUBLISHED → CLOSED; ARCHIVED is read as stored but nothing writes it
 * (DEFERRED, DEC-W4P-D11).
 */
export const PROGRAMME_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const
export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number]

/** The canonical `applicant_type` (migration 013); INDIVIDUAL is not accepted (contract Q3). */
export const REGISTRATION_APPLICANT_TYPES = ['TEAM', 'STARTUP'] as const
export type RegistrationApplicantType = (typeof REGISTRATION_APPLICANT_TYPES)[number]

export type ProgrammeDTO = {
  id: string
  type: ProgrammeType
  organization_id: string
  slug: string
  name: string
  summary: string | null
  status: ProgrammeStatus
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

/** One ordered stage of `metadata.journey` (contract §11); days in yyyy-mm-dd. */
export type ProgrammeStageDTO = {
  id: string
  position: number
  name: string
  summary: string | null
  starts_on: string | null
  ends_on: string | null
}

/** One problem statement of `metadata.challenge` (contract §3, option A). */
export type ProblemStatementDTO = { id: string; title: string; summary: string | null }

/** A canonical Event linked through `events.programme_id`, read only (contract §10). */
export type ProgrammeEventDTO = EventDTO & { programme_id: string }

/** One question of the canonical form, as WF05 reads it (`ApplicationQuestion`). */
export type RegistrationQuestionDTO = {
  id: string
  prompt: string
  required: boolean
  step: 1 | 2 | 3 | 4
}

/** The canonical `programme_application_forms` row of the programme. */
export type ProgrammeRegistrationDTO = {
  applicant_types: RegistrationApplicantType[]
  questions: RegistrationQuestionDTO[]
  version: number
}

export type ProgrammeSummaryDTO = ProgrammeDTO & {
  organization: OrganizationRefDTO
  counts: { stages: number; events: number; problem_statements: number | null }
}

/**
 * What the caller may do next, computed by the server (API 05 §16 item 8) so a
 * screen never re-derives a rule. False for every action on a programme whose
 * owning organization is ARCHIVED (DEC-W4P-D13).
 */
export type ProgrammeActions = {
  /** Basic fields, stages, problem statements: DRAFT or PUBLISHED. */
  edit: boolean
  /** The registration form: editable and no application yet (Q3). */
  registration: boolean
  publish: boolean
  close: boolean
}

export type ProgrammeDetailDTO = {
  programme: ProgrammeDTO
  organization: OrganizationRefDTO
  stages: ProgrammeStageDTO[]
  /** CHALLENGE only; absent for PROGRAMME. */
  problem_statements?: ProblemStatementDTO[]
  events: ProgrammeEventDTO[]
  /** Null until a registration form is configured. */
  registration: ProgrammeRegistrationDTO | null
  /** The owning organization is ARCHIVED: the programme is read only. */
  owner_archived: boolean
  actions: ProgrammeActions
}
