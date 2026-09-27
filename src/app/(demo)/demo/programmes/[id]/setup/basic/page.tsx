import { ProgrammeBasicEdit } from '@/components/programme-demo/programme-basic-edit'
import { requireDemoProgrammeRoute } from '@/lib/programme-demo/guard'

/**
 * WF04-S08 — /demo/programmes/:id/setup/basic: basic information of an
 * existing programme (DEC-WF04-S02-D3, DEC-WF04-S08-D2). Same resolution as
 * S03 (DEC-WF04-S03-D2).
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeBasicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { server } = await requireDemoProgrammeRoute(id)
  return <ProgrammeBasicEdit id={id} server={server} />
}
