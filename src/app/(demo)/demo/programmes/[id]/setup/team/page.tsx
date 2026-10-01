import { ProgrammeTeam } from '@/components/programme-demo/programme-team'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S06 — operating team (/demo/programmes/:id/setup/team). The programme is read on the
 * server with the actor's scope: unknown, malformed or out of scope → 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeTeam id={detail.programme.id} initial={detail} />
}
