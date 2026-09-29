import { WorkspaceShell } from '@/components/shell/workspace-shell'
import { requireMember } from '@/lib/member/guard'
import { listOwnInvitations } from '@/lib/venture/team'
import { listOwnVentures } from '@/lib/venture/venture'

import { ProjectsView } from './projects-view'

/**
 * WF02-S08 — /projects, "Dự án & startup của tôi" (ME7). Production.
 * Reference: design-reference/final/revision/L2/ME7__projects__SOURCE.png
 * Decisions DEC-L2R-D1, D7, D8, D10, D11.
 *
 * Guest → /auth; onboarding not done → its resolver step. Everything is read
 * on the server for the session's own account: the ventures it owns or
 * belongs to as an ACTIVE member, and the pending invitations sent to its own
 * address. Nothing of another team is read.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  const [ventures, invitations] = await Promise.all([
    listOwnVentures(member.accountId),
    listOwnInvitations(member.accountId),
  ])
  return (
    <WorkspaceShell active="projects" member={member}>
      <ProjectsView ventures={ventures} invitations={invitations} />
    </WorkspaceShell>
  )
}
