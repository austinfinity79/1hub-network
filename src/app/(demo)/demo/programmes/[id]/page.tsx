import { ProgrammeDetail } from '@/components/programme-demo/programme-detail'
import { requireDemoProgrammeRoute } from '@/lib/programme-demo/guard'

/**
 * WF04-S08 — /demo/programmes/:id, the programme detail / manage page
 * (authenticated ops demo; not a public page). Same resolution as S03
 * (DEC-WF04-S03-D2).
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { server } = await requireDemoProgrammeRoute(id)
  return <ProgrammeDetail id={id} server={server} />
}
