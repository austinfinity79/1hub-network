import type { VentureType } from '@/lib/venture/venture'

import type { ApplicantType } from './types'

/**
 * DEC-WF05-G4 / DEC-W5P-D04: the primary applicant is the venture, its type
 * derived from the canonical venture type (PROJECT → TEAM, STARTUP → STARTUP);
 * never stored on the venture. The one definition, used by the application
 * service and the WF05 read model alike (WF05-PROD-03, G28).
 */
export function applicantTypeFor(type: VentureType): ApplicantType {
  return type === 'PROJECT' ? 'TEAM' : 'STARTUP'
}
