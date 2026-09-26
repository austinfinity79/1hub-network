import type { EditResult } from './journey'
import { APPLICANT_TYPES, type ApplicantType, type ProgrammeDemoDetail } from './types'

/**
 * WF04-S05 — registration configuration of a demo Programme / Challenge
 * (DEC-WF04-S05-D1/D2). CONFIGURATION DEMO: the frozen `RegistrationConfigDTO`
 * only (SOT §12 via T00):
 * - who may apply: primary applicant types `INDIVIDUAL | TEAM | STARTUP`;
 * - programme-specific questions: plain text prompts (the additive
 *   `programme_specific_answers`); no types, rules, branching or uploads.
 * Profiles and projects are reused, never re-asked. No open / close switch,
 * registration period or eligibility rule exists in the contract, so none is
 * modelled. Application counts are read-only demo figures and never change
 * here. Pure and atomic.
 */

export type RegistrationInput = { applicant_types: string[]; questions: string[] }
export type RegistrationErrors = {
  applicant_types?: 'invalid'
  /** Indexes of blank questions. */
  questions?: number[]
}

export function isApplicantType(value: string): value is ApplicantType {
  return (APPLICANT_TYPES as readonly string[]).includes(value)
}

export function validateRegistration(input: RegistrationInput): RegistrationErrors {
  const errors: RegistrationErrors = {}
  if (!input.applicant_types.every(isApplicantType)) errors.applicant_types = 'invalid'
  const blank = input.questions.flatMap((q, i) => (q.trim() ? [] : [i]))
  if (blank.length > 0) errors.questions = blank
  return errors
}

/** Nothing chosen and no question: the registration is not configured yet. */
export function registrationConfigured(detail: Pick<ProgrammeDemoDetail, 'registration'>): boolean {
  return detail.registration.applicant_types.length > 0 || detail.registration.questions.length > 0
}

export function updateRegistration(
  detail: ProgrammeDemoDetail,
  input: RegistrationInput,
  now: Date,
): EditResult<RegistrationErrors> {
  const errors = validateRegistration(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const next = structuredClone(detail)
  next.programme.updated_at = now.toISOString()
  next.registration = {
    // Canonical order, each once.
    applicant_types: APPLICANT_TYPES.filter((t) => input.applicant_types.includes(t)),
    questions: input.questions.map((q) => q.trim()),
  }
  return { ok: true, detail: next }
}
