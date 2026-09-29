import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { requireMember } from '@/lib/member/guard'
import { getTeam } from '@/lib/venture/team'
import { getVenture } from '@/lib/venture/venture'

import { ventureOptions } from '../venture-options'
import { ProjectWizard, type WizardStep } from './project-wizard'

/**
 * WF02-S05 — /projects/new, create a Project/Startup. Production.
 * Reference (L13a–c, PRJ1–3 of the L2 board):
 * design-reference/final/revision/L2/L13{a,b,c}__project-create-*__SOURCE.png
 * Decisions DEC-L2R-D4..D11; DEC-WF02-S05-G2..G5 and DEC-L2-D5 still hold.
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-S05-G2).
 * The three steps sit on this one route (03 route matrix: KEEP). Step 1
 * creates the ONE canonical venture with POST /ventures; afterwards the URL
 * carries `?venture=<id>&step=…`, so a refresh or a revisit resumes the same
 * record with PATCH and never creates a second one. The venture and its team
 * are read with the rules of GET /ventures/{id} and GET /ventures/{id}/team;
 * only the owner of an editable venture gets the wizard, anyone else a 404.
 */
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STEPS: readonly WizardStep[] = ['info', 'team', 'done']

type Search = { venture?: string | string[]; step?: string | string[] }

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember()
  const search = await searchParams
  const ventureId = typeof search.venture === 'string' ? search.venture : undefined
  if (ventureId === undefined) {
    const { domains, stages } = await ventureOptions()
    return (
      <ProjectWizard step="info" venture={null} team={null} domains={domains} stages={stages} />
    )
  }
  if (!UUID.test(ventureId)) notFound()

  let venture
  let team
  try {
    venture = await getVenture(member.accountId, ventureId)
    team = await getTeam(member.accountId, ventureId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  if (!venture.can_edit || !team.can_manage) notFound()

  const step = STEPS.find((s) => s === search.step) ?? 'info'
  const { domains, stages } = await ventureOptions(venture.region, venture.domains, venture.stage)
  return (
    <ProjectWizard
      step={step}
      venture={{
        id: venture.id,
        type: venture.type,
        name: venture.name,
        summary: venture.summary ?? '',
        status: venture.status,
        stage_id: venture.stage?.id ?? '',
        owner_role_label: venture.role_label ?? '',
        domain_ids: venture.domains.map((d) => d.id),
      }}
      team={team}
      domains={domains}
      stages={stages}
    />
  )
}
