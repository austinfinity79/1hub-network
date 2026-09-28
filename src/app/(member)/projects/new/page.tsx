import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { requireMember } from '@/lib/member/guard'
import { getTeam } from '@/lib/venture/team'
import { getVenture } from '@/lib/venture/venture'

import { ventureOptions } from '../venture-options'
import { ProjectWizard, type WizardStep } from './project-wizard'

/**
 * WF02-S05 — /projects/new, create a Project/Startup. Production.
 * Reference (TASK 22.3, L13a–c PRJ1–3 subset):
 * design-reference/final/revision/L2/L13{a,b,c}__project-create-*__SOURCE.png
 * Decisions DEC-WF02-S05-G1..G5, DEC-WF02-S06-G1..G9, DEC-L2-D1..D5.
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
    const { regions, domains } = await ventureOptions()
    return (
      <ProjectWizard step="info" venture={null} team={null} regions={regions} domains={domains} />
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
  const { regions, domains } = await ventureOptions(venture.region, venture.domains)
  return (
    <ProjectWizard
      step={step}
      venture={{
        id: venture.id,
        type: venture.type,
        name: venture.name,
        summary: venture.summary ?? '',
        status: venture.status,
        region_id: venture.region?.id ?? '',
        domain_ids: venture.domains.map((d) => d.id),
      }}
      team={team}
      regions={regions}
      domains={domains}
    />
  )
}
