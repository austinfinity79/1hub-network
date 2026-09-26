import { MemberShell } from '@/components/shell/member-shell'
import { requireMember } from '@/lib/member/guard'

import { AccountHome } from './account-home'

/**
 * WF02-S01 — /me, Account Home. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S01__account-home__1440x900.png
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-T00-D1).
 * The body reads only the canonical owner APIs (see AccountHome).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  return (
    <MemberShell active="overview" member={member}>
      <AccountHome />
    </MemberShell>
  )
}
