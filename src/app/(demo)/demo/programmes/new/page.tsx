import { ProgrammeCreate } from '@/components/programme-demo/programme-create'
import { requireProgrammeArea } from '@/lib/programme/guard'
import { programmeOwnerOptions } from '@/lib/programme/programme'

/**
 * WF04-S02 — create. The owning-organization options come from the actor's
 * server-side scope, never an ARCHIVED organization (DEC-W4P-D13); no query
 * parameter, header or body is read. The DRAFT is created by the API.
 */
export const dynamic = 'force-dynamic'

export default async function NewProgrammePage() {
  const { accountId } = await requireProgrammeArea()
  return <ProgrammeCreate owners={await programmeOwnerOptions(accountId)} />
}
