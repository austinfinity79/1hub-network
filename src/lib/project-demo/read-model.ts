import { createHash } from 'node:crypto'

import { ApiError } from '@/lib/api/errors'
import { listOpenForms } from '@/lib/application/application'
import { getOwnNetwork } from '@/lib/network/network'
import { getOnboardingState } from '@/lib/onboarding/state'
import { getTeam } from '@/lib/venture/team'
import { getVenture, VENTURE_TYPES, type VentureType } from '@/lib/venture/venture'

import { applicantTypeFor, applicationEligibility } from './eligibility'
import type {
  DemoVentureDetailDTO,
  DemoVenturesDTO,
  DemoVentureSummaryDTO,
  OpenProgrammeDTO,
} from './types'

/**
 * WF05-T00 — server read model of the Founder / Project / Startup demo
 * (DEC-WF05-G2..G5, DEC-WF05-T00-D2). Read only; it never writes.
 *
 * - Ventures come from the canonical WF02 services, with their rules: the
 *   member's own relations (`getOwnNetwork`), and one venture only for its owner
 *   or an ACTIVE member (`getVenture`, `getTeam`); anyone else — including a
 *   PLATFORM_ADMIN, a HUB leader or a pending invitee — gets the same 404.
 * - Programmes are the PUBLISHED server programmes with an application form
 *   (TASK 24.4, DEC-L5, HD-A12: the approved WF04 programme as a read-only
 *   row), without counts, team or drafts; the WF04 operator demo is unchanged.
 * - Entry needs onboarding DONE (DEC-WF05-G2); identity comes from the session
 *   only — no profile, owner, role or organization input is accepted.
 */

/** Namespaces the browser application store per actor; not reversible, not a secret. */
export function projectDemoActorKey(accountId: string): string {
  return createHash('sha256').update(`wf05-demo:${accountId}`).digest('hex').slice(0, 16)
}

async function requireEntry(accountId: string): Promise<void> {
  const state = await getOnboardingState(accountId)
  if (!state.completed)
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
}

const ventureType = (value: string): VentureType =>
  (VENTURE_TYPES as readonly string[]).includes(value) ? (value as VentureType) : 'PROJECT'

/** The PUBLISHED programmes open to applications, as a member sees them (DEC-WF05-G3). */
export async function listOpenProgrammes(): Promise<OpenProgrammeDTO[]> {
  return (await listOpenForms()).map((f) => ({
    id: f.programme.id,
    status: 'PUBLISHED',
    type: f.programme.type,
    name: f.programme.name,
    summary: f.programme.summary,
    starts_at: f.starts_at,
    ends_at: f.ends_at,
    organization: f.programme.organization,
    applicant_types: [...f.applicant_types],
    questions: f.questions.map((q) => q.prompt),
  }))
}

/** GET /api/v1/demo/projects: the member's ventures and the open programmes. */
export async function listDemoVentures(accountId: string): Promise<DemoVenturesDTO> {
  await requireEntry(accountId)
  const { roles } = await getOwnNetwork(accountId)
  const ventures = roles.map((r): DemoVentureSummaryDTO => {
    const type = ventureType(r.venture.type)
    return {
      id: r.venture.id,
      type,
      name: r.venture.name,
      status: r.venture.status,
      relation: r.relation,
      role_label: r.role_label,
      applicant_type: applicantTypeFor(type),
    }
  })
  return { ventures, programmes: await listOpenProgrammes() }
}

/**
 * GET /api/v1/demo/projects/{id}: one venture as its owner or an ACTIVE member
 * sees it (the WF02 rule), its team without invitations, and the open
 * programmes with this actor's eligibility. Malformed, unknown and unreadable
 * ids are the same 404.
 */
export async function getDemoVenture(
  accountId: string,
  ventureId: string,
): Promise<DemoVentureDetailDTO> {
  await requireEntry(accountId)
  const venture = await getVenture(accountId, ventureId)
  const team = await getTeam(accountId, ventureId)
  const rows = team.rows.flatMap((row): DemoVentureDetailDTO['team']['rows'] =>
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
  const context = { type: venture.type, status: venture.status, relation: venture.relation }
  return {
    venture: {
      id: venture.id,
      type: venture.type,
      name: venture.name,
      summary: venture.summary,
      status: venture.status,
      region: venture.region ? { id: venture.region.id, label: venture.region.label } : null,
      domains: venture.domains.map((d) => ({ id: d.id, label: d.label })),
      relation: venture.relation,
      applicant_type: applicantTypeFor(venture.type),
      can_edit: venture.can_edit,
    },
    team: { members: rows.length, rows },
    programmes: (await listOpenProgrammes()).map((p) => ({
      ...p,
      eligibility: applicationEligibility(context, p),
    })),
  }
}
