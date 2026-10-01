import type { EventDTO } from '@/lib/ops/events'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

/**
 * WF04-T00 — Programme / Challenge demo DTOs (DEC-WF04-H1..H5, DEC-WF04-T00).
 *
 * WF04 is DEMO for Internal Alpha. These shapes follow the canonical sources so
 * the demo can later move to production endpoints without changing ids or
 * field names (architecture 04 D4):
 * - Programme: the `programmes` columns (001) with the API §8.4 `type` name;
 *   one aggregate, `PROGRAMME | CHALLENGE` (Data Freeze D1).
 * - Event: the WF03 `EventDTO` plus the canonical nullable `programme_id`
 *   (SOT §11), always set here.
 * - Application: statuses from SOT §6; the demo carries counts only.
 *
 * Demo-only shapes (not canonical, never persisted): stages (H3), Challenge
 * problem statements (H4), the operating-team display rows (H2) and the
 * registration configuration summary.
 */

export const PROGRAMME_TYPES = ['PROGRAMME', 'CHALLENGE'] as const
export type ProgrammeType = (typeof PROGRAMME_TYPES)[number]

/** SOT §6 lifecycle. The demo runs DRAFT → PUBLISHED only; the rest is FUTURE. */
export const PROGRAMME_LIFECYCLE = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const
export const PROGRAMME_DEMO_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type ProgrammeDemoStatus = (typeof PROGRAMME_DEMO_STATUSES)[number]
/** WF04-PROD-04: the stored lifecycle the screens render (CLOSED approved; ARCHIVED read only). */
export type ProgrammeLifecycleStatus = (typeof PROGRAMME_LIFECYCLE)[number]

/** SOT §12: exactly one primary applicant of these kinds. */
export const APPLICANT_TYPES = ['INDIVIDUAL', 'TEAM', 'STARTUP'] as const
export type ApplicantType = (typeof APPLICANT_TYPES)[number]

/** SOT §6 Application lifecycle (counts only in the demo). */
export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_UPDATE',
  'RESUBMITTED',
  'CLOSED',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** Architecture 03 §4: designed, not active. A display label, never authority. */
export const PROGRAMME_ORGANIZER_LABEL = 'PROGRAMME_ORGANIZER' as const

export type ProgrammeDTO = {
  id: string
  type: ProgrammeType
  organization_id: string
  slug: string
  name: string
  summary: string | null
  status: ProgrammeLifecycleStatus
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

/** H3: one ordered stage. No rules, branches, scoring or transitions. */
export type ProgrammeStageDTO = {
  id: string
  position: number
  name: string
  summary: string | null
  starts_at: string | null
  ends_at: string | null
}

/** H4: a Challenge problem statement ("Bài toán"), demo data only. */
export type ProblemStatementDTO = { id: string; title: string; summary: string | null }

export type ProgrammeEventDTO = EventDTO & { programme_id: string }

/** H2: a display row. `role_label` grants nothing. */
export type OperatingTeamMemberDTO = {
  id: string
  display_name: string
  role_label: typeof PROGRAMME_ORGANIZER_LABEL
}

export type RegistrationConfigDTO = {
  applicant_types: ApplicantType[]
  /** Programme-specific questions; profile / project data are reused, never re-asked (SOT §12). */
  questions: string[]
}

export type ApplicationCountsDTO = Partial<Record<ApplicationStatus, number>>

export type ProgrammeDemoDetail = {
  programme: ProgrammeDTO
  stages: ProgrammeStageDTO[]
  /** CHALLENGE only; absent for PROGRAMME (H4). */
  problem_statements?: ProblemStatementDTO[]
  events: ProgrammeEventDTO[]
  team: OperatingTeamMemberDTO[]
  registration: RegistrationConfigDTO
  application_counts: ApplicationCountsDTO
}

/** What the demo API returns: the fixture plus its owning organization, tagged as demo. */
export type ProgrammeDemoSummaryDTO = ProgrammeDTO & {
  organization: OrganizationRefDTO
  counts: { stages: number; events: number; problem_statements: number | null }
  demo: true
}

export type ProgrammeDemoDetailDTO = ProgrammeDemoDetail & {
  organization: OrganizationRefDTO
  demo: true
}
