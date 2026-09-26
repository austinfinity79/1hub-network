import { requireMember } from '@/lib/member/guard'

import { VentureEditor } from '../venture-editor'
import { ventureOptions } from '../venture-options'

/**
 * WF02-S05 — /projects/new, create a Project/Startup. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S05__project-startup-profile-edit__1440x900.png
 * (the create state is not drawn; DEC-WF02-S05-G1: same form).
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-S05-G2).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireMember()
  const { regions, domains } = await ventureOptions()
  return <VentureEditor venture={null} regions={regions} domains={domains} />
}
