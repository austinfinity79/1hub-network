import { MemberShell } from '@/components/shell/member-shell'
import { getDeletionRequest } from '@/lib/account/settings'
import { requireMember } from '@/lib/member/guard'

import { SettingsView } from './settings-view'

/**
 * WF02-S07 — /me/settings, Account Settings. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S07__account-settings__1440x900.png
 * Decisions DEC-WF02-H8, DEC-WF02-S07-G1..G6, DEC-WF02-S07-D1..D3.
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-T00-D1).
 * The existing deletion request (if any) is read server-side for the owner;
 * no extra API route exists for it.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  const request = await getDeletionRequest(member.accountId)
  return (
    <MemberShell active="settings" member={member}>
      <SettingsView initialRequest={request} />
    </MemberShell>
  )
}
