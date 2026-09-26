import { ProgrammeJourney } from '@/components/programme-demo/programme-journey'
import { requireDemoProgrammeRoute } from '@/lib/programme-demo/guard'

/**
 * WF04-S03 — /demo/programmes/:id/setup/journey. The id is resolved on the
 * server (malformed → 404; fixture → read with the actor's scope, else 404);
 * a session draft is looked up in the actor's own browser store.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { server } = await requireDemoProgrammeRoute(id)
  return <ProgrammeJourney id={id} server={server} />
}
