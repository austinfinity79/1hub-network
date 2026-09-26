import { requireOpsOrg } from '@/lib/ops/guard'

import { MemberList } from './member-list'

/**
 * WF03-S03 — /ops/org/:orgId/members, organization members. Production-internal.
 * Approved baseline: design-reference/final/WF03/WF03-S03__member-account-list__1440x900.png
 *
 * A read-only relationship view (DEC-WF03-G3), not account administration. The
 * page checks `member:read` for exactly this organization; the rows come from
 * GET /ops/organizations/{orgId}/members, which authorizes again and applies
 * PROFILE_DISCOVERY on the server (G4).
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { organization } = await requireOpsOrg(orgId, 'member:read')
  return <MemberList organization={organization} />
}
