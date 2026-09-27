import type { VentureType } from '@/lib/venture/venture'

import type { Eligibility, ProgrammeContext, VentureContext, Wf05ApplicantType } from './types'

/**
 * WF05-T00 — who may apply with which venture (DEC-WF05-G3..G5). Pure rules over
 * server-resolved facts: the venture's canonical type, status and the actor's
 * relation to it; the programme's status and configured applicant types.
 */

/** DEC-WF05-G4: derived from the canonical type; never stored on the venture. */
export function applicantTypeFor(type: VentureType): Wf05ApplicantType {
  return type === 'PROJECT' ? 'TEAM' : 'STARTUP'
}

/**
 * Whether this actor may start / edit / submit an application of this venture
 * to this programme. Reasons in order: the programme is not open (G3), the
 * actor is not the owner (G5-1, G5-7), the venture is ARCHIVED (G5-4), the
 * programme does not accept the venture's applicant type (G4).
 */
export function applicationEligibility(
  venture: Pick<VentureContext, 'type' | 'status' | 'relation'>,
  programme: Pick<ProgrammeContext, 'status' | 'applicant_types'>,
): Eligibility {
  if (programme.status !== 'PUBLISHED') return { eligible: false, reason: 'NOT_PUBLISHED' }
  if (venture.relation !== 'OWNER') return { eligible: false, reason: 'NOT_OWNER' }
  if (venture.status === 'ARCHIVED') return { eligible: false, reason: 'ARCHIVED' }
  if (!programme.applicant_types.includes(applicantTypeFor(venture.type)))
    return { eligible: false, reason: 'TYPE_NOT_ACCEPTED' }
  return { eligible: true }
}
