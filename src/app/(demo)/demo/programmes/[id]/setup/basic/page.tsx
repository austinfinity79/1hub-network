import { ProgrammeBasicEdit } from '@/components/programme-demo/programme-basic-edit'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S08 — basic information (/demo/programmes/:id/setup/basic). The programme is read on the
 * server with the actor's scope: unknown, malformed or out of scope → 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeBasicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeBasicEdit id={detail.programme.id} initial={detail} />
}
