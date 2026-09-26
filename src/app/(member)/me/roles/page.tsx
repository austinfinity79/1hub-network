import { MemberShell } from '@/components/shell/member-shell'
import { requireMember } from '@/lib/member/guard'
import { listRequestableOrganizations } from '@/lib/network/membership-request'

import { RolesView } from './roles-view'

/**
 * WF02-S04 — /me/roles, Roles & Network Links. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S04__roles-network-links__1440x900.png
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-T00-D1).
 * The selector options come from the canonical organisations with the same
 * predicate the POST re-validates (DEC-WF02-S04-G1); no directory API exists.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  const options = await listRequestableOrganizations()
  return (
    <MemberShell active="roles" member={member}>
      <RolesView options={options} />
    </MemberShell>
  )
}
