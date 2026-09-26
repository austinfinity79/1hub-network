import { ProgrammeTeam } from '@/components/programme-demo/programme-team'
import { requireDemoProgrammeRoute } from '@/lib/programme-demo/guard'

/**
 * WF04-S06 — /demo/programmes/:id/setup/team. Same resolution as S03
 * (DEC-WF04-S03-D2): malformed → 404; fixture read with the actor's scope,
 * else 404; a session draft is looked up in the actor's own store.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { server } = await requireDemoProgrammeRoute(id)
  return <ProgrammeTeam id={id} server={server} />
}
