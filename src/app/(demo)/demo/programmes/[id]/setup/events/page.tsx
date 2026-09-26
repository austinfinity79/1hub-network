import { ProgrammeEvents } from '@/components/programme-demo/programme-events'
import { requireDemoProgrammeRoute } from '@/lib/programme-demo/guard'

/**
 * WF04-S04 — /demo/programmes/:id/setup/events. Same resolution as S03
 * (DEC-WF04-S03-D2): malformed → 404; fixture read with the actor's scope,
 * else 404; a session draft is looked up in the actor's own store.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { server } = await requireDemoProgrammeRoute(id)
  return <ProgrammeEvents id={id} server={server} />
}
