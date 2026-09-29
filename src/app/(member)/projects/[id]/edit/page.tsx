import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { requireMember } from '@/lib/member/guard'
import { getVenture } from '@/lib/venture/venture'

import { VentureEditor } from '../../venture-editor'
import { ventureOptions } from '../../venture-options'

/**
 * WF02-S05 — /projects/:id/edit, edit a Project/Startup. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S05__project-startup-profile-edit__1440x900.png
 *
 * Guest → /auth; onboarding not done → its resolver step. The venture is read
 * with the same rule as GET /ventures/{id}: owner or ACTIVE member, anyone
 * else gets the same 404. The owner and members with Biên tập edit a
 * non-archived venture; Xem reads (DEC-L2R-D7).
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember()
  const { id } = await params
  let venture
  try {
    venture = await getVenture(member.accountId, id)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  const { regions, domains, stages } = await ventureOptions(
    venture.region,
    venture.domains,
    venture.stage,
  )
  return (
    <VentureEditor
      venture={{
        id: venture.id,
        type: venture.type,
        name: venture.name,
        summary: venture.summary ?? '',
        status: venture.status,
        region_id: venture.region?.id ?? '',
        domain_ids: venture.domains.map((d) => d.id),
        stage_id: venture.stage?.id ?? '',
        role_label: venture.role_label ?? '',
        permission: venture.permission,
        can_edit: venture.can_edit,
      }}
      regions={regions}
      domains={domains}
      stages={stages}
    />
  )
}
