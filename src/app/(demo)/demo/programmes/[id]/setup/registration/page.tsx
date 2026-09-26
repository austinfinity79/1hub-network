import { ProgrammeRegistration } from '@/components/programme-demo/programme-registration'
import { requireDemoProgrammeRoute } from '@/lib/programme-demo/guard'

/**
 * WF04-S05 — /demo/programmes/:id/setup/registration. Same resolution as S03
 * (DEC-WF04-S03-D2): malformed → 404; fixture read with the actor's scope,
 * else 404; a session draft is looked up in the actor's own store.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeRegistrationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { server } = await requireDemoProgrammeRoute(id)
  return <ProgrammeRegistration id={id} server={server} />
}
