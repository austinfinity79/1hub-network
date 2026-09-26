import { MemberShell } from '@/components/shell/member-shell'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'
import { requireMember } from '@/lib/member/guard'

/**
 * WF02-S07 — /me/settings. WF02-T00 places the frozen route inside the member shell
 * (guest → /auth, onboarding not done → its resolver step). The screen body is
 * still the M0-T03 placeholder until WF02-S07 is implemented.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  return (
    <MemberShell active="settings" member={member}>
      <RoutePlaceholder pattern="/me/settings" />
    </MemberShell>
  )
}
