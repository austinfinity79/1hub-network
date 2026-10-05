import { notFound } from 'next/navigation'

import { WorkspaceShell } from '@/components/shell/workspace-shell'
import { isApiError } from '@/lib/api/errors'
import { requireMember } from '@/lib/member/guard'
import { getOwnInvitation, getTeam } from '@/lib/venture/team'

import { TeamInvitation } from '../../team-invitation'
import { TeamView } from '../../team-view'

/**
 * WF02-S06 — /projects/:id/team, the venture team. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S06__project-team__1440x900.png
 *
 * Guest → /auth; onboarding not done → its resolver step. The team is read
 * with the rule of GET /ventures/{id}/team: owner (manages) or ACTIVE member
 * (read-only). A signed-in recipient of a pending invitation to this venture
 * sees only that invitation, to accept or decline (DEC-WF02-S06-G2), inside
 * the workspace shell (FB-14). Anyone
 * else gets the same 404.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember()
  const { id } = await params
  try {
    return <TeamView team={await getTeam(member.accountId, id)} />
  } catch (error) {
    if (!isApiError(error) || error.status !== 404) throw error
  }
  const invitation = await getOwnInvitation(member.accountId, id)
  if (!invitation) notFound()
  // FB-14 (S1-UAT-07): the invitation sits in the workspace frame, as ME7 does.
  return (
    <WorkspaceShell active="projects" member={member}>
      <TeamInvitation invitation={invitation} />
    </WorkspaceShell>
  )
}
