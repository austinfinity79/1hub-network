import { ProgrammeCreate } from '@/components/programme-demo/programme-create'
import { requireProgrammeDemo } from '@/lib/programme-demo/guard'
import { demoOwnerOptions } from '@/lib/programme-demo/read-model'

/**
 * WF04-S02 — /demo/programmes/new. The owning-organization options come from
 * the actor's server-side scope (DEC-WF04-S02-D2); no query parameter, header
 * or body is read. The new DRAFT is stored in the browser session only.
 */
export const dynamic = 'force-dynamic'

export default async function NewProgrammePage() {
  const { accountId } = await requireProgrammeDemo()
  return <ProgrammeCreate owners={await demoOwnerOptions(accountId)} />
}
