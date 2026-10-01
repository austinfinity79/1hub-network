import { ProgrammeRegistration } from '@/components/programme-demo/programme-registration'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S05 — registration (/demo/programmes/:id/setup/registration). The programme is read on the
 * server with the actor's scope: unknown, malformed or out of scope → 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeRegistrationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeRegistration id={detail.programme.id} initial={detail} />
}
