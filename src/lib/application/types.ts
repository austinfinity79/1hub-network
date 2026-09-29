/**
 * TASK 24.4 (DEC-L5) — the server-side Application: DTOs of `/api/v1/me/applications`
 * and `/api/v1/applications*`. The application references the canonical venture
 * and programme; it owns only the programme-specific answers and, once submitted,
 * the snapshot of what was sent.
 */

export const APPLICATION_STATUSES = ['DRAFT', 'SUBMITTED'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** DEC-WF05-G4: derived from the venture type (PROJECT → TEAM, STARTUP → STARTUP). */
export type ApplicantType = 'TEAM' | 'STARTUP'

/** The four drawn form steps (L38–L41): Hiểu đề, Cách giải, Đội & kế hoạch, Cần hỗ trợ gì. */
export type FormStep = 1 | 2 | 3 | 4

export type ApplicationQuestion = {
  id: string
  prompt: string
  required: boolean
  step: FormStep
}

export type ApplicationAnswer = { question_id: string; value: string }

/** Longest answer, as the session demo allowed (DEC-WF05-S03). */
export const ANSWER_MAX_LENGTH = 2000

export type ApplicationTeamMember = {
  relation: 'OWNER' | 'MEMBER'
  display_name: string
  role_label: string | null
}

export type ApplicationVenture = {
  id: string
  type: 'PROJECT' | 'STARTUP'
  name: string
  summary: string | null
  status: string
  stage: { code: string; label: string } | null
  domains: { id: string; label: string }[]
}

export type ApplicationProgramme = {
  id: string
  type: 'PROGRAMME' | 'CHALLENGE'
  name: string
  summary: string | null
  organization: { name: string }
}

/** One row of `GET /me/applications`. */
export type ApplicationSummaryDTO = {
  id: string
  status: ApplicationStatus
  programme: { id: string; name: string }
  venture: { id: string; name: string; type: 'PROJECT' | 'STARTUP' }
  updated_at: string
  submitted_at: string | null
}

/**
 * `GET /applications/{id}`. A DRAFT reads the live venture, team and form; a
 * SUBMITTED application reads its snapshot only.
 */
export type ApplicationDTO = {
  id: string
  status: ApplicationStatus
  primary_applicant_type: ApplicantType
  programme: ApplicationProgramme
  venture: ApplicationVenture
  team: ApplicationTeamMember[]
  questions: ApplicationQuestion[]
  answers: ApplicationAnswer[]
  /** Required questions still unanswered; empty once the draft can be submitted. */
  missing: string[]
  question_set_version: number
  created_at: string
  updated_at: string
  submitted_at: string | null
}

/** Written once at submit (`schema_version` 1); later edits never touch it. */
export type ApplicationSnapshot = {
  schema_version: 1
  programme: ApplicationProgramme & { question_set_version: number }
  questions: ApplicationQuestion[]
  answers: ApplicationAnswer[]
  venture: ApplicationVenture
  team: ApplicationTeamMember[]
  submitted_at: string
}
