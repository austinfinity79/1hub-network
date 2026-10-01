import { ProgrammeJourney } from '@/components/programme-demo/programme-journey'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S03 — structure and journey (/demo/programmes/:id/setup/journey). The programme is read on the
 * server with the actor's scope: unknown, malformed or out of scope → 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeJourney id={detail.programme.id} initial={detail} />
}
