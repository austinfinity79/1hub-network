import { MemberShell } from '@/components/shell/member-shell'
import { getDeletionRequest } from '@/lib/account/settings'
import { requireMember } from '@/lib/member/guard'
import { listOwnInvitations } from '@/lib/venture/team'

import { SettingsView } from './settings-view'

/**
 * WF02-S07 — /me/settings, Account Settings. Production.
 * Reference (TASK 22.3, L11 ME0 subset): design-reference/final/revision/L2/L11__me-settings__SOURCE.png
 * Decisions DEC-WF02-H8, DEC-WF02-S07-G1..G6, DEC-WF02-S07-D1..D3.
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-T00-D1).
 * The existing deletion request (if any) is read server-side for the owner;
 * no extra API route exists for it.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  const [request, invitations] = await Promise.all([
    getDeletionRequest(member.accountId),
    listOwnInvitations(member.accountId),
  ])
  return (
    // L11 (TASK 22.3, DEC-L2-D5): the existing below-desktop shell variant.
    <MemberShell active="settings" member={member}>
      <SettingsView initialRequest={request} pendingInvitations={invitations.length} />
    </MemberShell>
  )
}
