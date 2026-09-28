import { requireOpsOrg } from '@/lib/ops/guard'

import { MemberList } from './member-list'

/**
 * WF03-S03 — /ops/org/:orgId/members, organization members. Production-internal.
 * Reference (TASK 22.4, L26 CHP7 subset): design-reference/final/revision/L3/L26__chapter-members__SOURCE.png
 *
 * A relationship view (DEC-WF03-G3), not account administration; a pending
 * request can be reviewed in place with the S04 call (DEC-L3-D4). The page
 * checks `member:read` for exactly this organization; the rows come from
 * GET /ops/organizations/{orgId}/members, which authorizes again and applies
 * PROFILE_DISCOVERY on the server (G4).
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { organization, capabilities } = await requireOpsOrg(orgId, 'member:read')
  return (
    <MemberList
      organization={organization}
      canReview={capabilities.includes('membership:confirm')}
    />
  )
}
