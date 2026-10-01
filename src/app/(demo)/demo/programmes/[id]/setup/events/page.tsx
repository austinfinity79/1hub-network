import { ProgrammeEvents } from '@/components/programme-demo/programme-events'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S04 — linked events, read only (/demo/programmes/:id/setup/events). The programme is read on the
 * server with the actor's scope: unknown, malformed or out of scope → 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeEvents id={detail.programme.id} initial={detail} />
}
