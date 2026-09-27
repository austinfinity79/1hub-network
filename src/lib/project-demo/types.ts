import type { VentureType } from '@/lib/venture/venture'

/**
 * WF05-T00 — DTO and state shapes of the Founder / Project / Startup demo
 * (DEC-WF05-G1..G5). Ventures are the canonical WF02 records, read through
 * WF02 services; programmes are the PUBLISHED WF04 fixtures; the application is
 * browser-session state in the SOT §12 shape (architecture 04 D4: future
 * production field names).
 */

/** DEC-WF05-G4: the applicant types a venture can apply as (INDIVIDUAL is FUTURE). */
export const WF05_APPLICANT_TYPES = ['TEAM', 'STARTUP'] as const
export type Wf05ApplicantType = (typeof WF05_APPLICANT_TYPES)[number]

/** DEC-WF05-G5 (2): the only demo lifecycle. */
export const DEMO_APPLICATION_STATUSES = ['DRAFT', 'SUBMITTED'] as const
export type DemoApplicationStatus = (typeof DEMO_APPLICATION_STATUSES)[number]

export type VentureRelation = 'OWNER' | 'MEMBER'

/** What the eligibility rules need about a venture, all resolved on the server. */
export type VentureContext = {
  id: string
  type: VentureType
  status: string
  relation: VentureRelation
}

/** What the eligibility rules need about a programme. */
export type ProgrammeContext = {
  id: string
  status: string
  applicant_types: readonly string[]
  questions: readonly string[]
}

export type IneligibleReason = 'NOT_PUBLISHED' | 'NOT_OWNER' | 'ARCHIVED' | 'TYPE_NOT_ACCEPTED'

export type Eligibility = { eligible: true } | { eligible: false; reason: IneligibleReason }

/** A PUBLISHED WF04 programme as a member sees it (DEC-WF05-G3): no counts, team or drafts. */
export type OpenProgrammeDTO = {
  id: string
  /** Only PUBLISHED programmes are ever read (DEC-WF05-G3). */
  status: 'PUBLISHED'
  type: 'PROGRAMME' | 'CHALLENGE'
  name: string
  summary: string | null
  starts_at: string | null
  ends_at: string | null
  organization: { name: string }
  applicant_types: string[]
  questions: string[]
}

/** A venture the member owns or is an ACTIVE member of. */
export type DemoVentureSummaryDTO = {
  id: string
  type: VentureType
  name: string
  status: string
  relation: VentureRelation
  /** Display text for a MEMBER relation; never a permission. */
  role_label: string | null
  applicant_type: Wf05ApplicantType
}

export type DemoTeamMemberDTO = {
  relation: VentureRelation
  display_name: string
  role_label: string | null
}

export type DemoVentureDetailDTO = {
  venture: {
    id: string
    type: VentureType
    name: string
    summary: string | null
    status: string
    region: { id: string; label: string } | null
    domains: { id: string; label: string }[]
    relation: VentureRelation
    applicant_type: Wf05ApplicantType
  }
  /** The owner and ACTIVE members only; never invitations or emails. */
  team: { members: number; rows: DemoTeamMemberDTO[] }
  programmes: (OpenProgrammeDTO & { eligibility: Eligibility })[]
}

export type DemoVenturesDTO = {
  ventures: DemoVentureSummaryDTO[]
  programmes: OpenProgrammeDTO[]
}

/**
 * One demo application (SOT §12 names). `primary_applicant_id` is the venture
 * id — a reference, never a copy of venture data. Answers follow the order of
 * the programme's questions.
 */
export type DemoApplication = {
  primary_applicant_type: Wf05ApplicantType
  primary_applicant_id: string
  programme_id: string
  status: DemoApplicationStatus
  programme_specific_answers: string[]
  created_at: string
  updated_at: string
  submitted_at: string | null
}
