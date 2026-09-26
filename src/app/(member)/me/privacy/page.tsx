import { MemberShell } from '@/components/shell/member-shell'
import { requireMember } from '@/lib/member/guard'

import { PrivacyView } from './privacy-view'

/**
 * WF02-S03 — /me/privacy, Privacy & Visibility. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S03__privacy-visibility__1440x900.png
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-T00-D1).
 * The body reads and writes only the WF01-S07 services (see PrivacyView).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  return (
    <MemberShell active="privacy" member={member}>
      <PrivacyView />
    </MemberShell>
  )
}
