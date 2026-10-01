import { ProgrammeList } from '@/components/programme-demo/programme-list'
import { requireProgrammeArea } from '@/lib/programme/guard'
import { programmeOwnerOptions } from '@/lib/programme/programme'

/**
 * WF04-S01 — the Programme / Challenge list. The list reads
 * `GET /api/v1/programmes`, which re-authorizes on its own; "Tạo mới" is
 * offered only when the server lists an organization the actor may create for.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeListPage() {
  const { accountId } = await requireProgrammeArea()
  const owners = await programmeOwnerOptions(accountId)
  return <ProgrammeList canCreate={owners.length > 0} />
}
