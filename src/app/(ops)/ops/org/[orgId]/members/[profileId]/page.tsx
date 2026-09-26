import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { requireOpsOrg } from '@/lib/ops/guard'
import { getMemberDetail, type OpsMemberDetailDTO } from '@/lib/ops/member-detail'

import { MemberDetail } from './member-detail'

/**
 * WF03-S04 — /ops/org/:orgId/members/:profileId, membership review and
 * leadership operations. Production-internal.
 * Approved baseline: design-reference/final/WF03/WF03-S04__member-account-detail__1440x900.png
 *
 * The page checks `member:read` for exactly this organization; the detail comes
 * from GET /ops/organizations/{orgId}/members/{profileId}, and every action
 * calls an API that authorizes, checks lifecycle and audits again on the server.
 * A person with no membership or leadership record here is the same 404 as an
 * out-of-scope organization, so the route cannot probe profiles.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string; profileId: string }>
}) {
  const { orgId, profileId } = await params
  const { accountId, organization } = await requireOpsOrg(orgId, 'member:read')
  let initial: OpsMemberDetailDTO
  try {
    initial = await getMemberDetail(accountId, organization.id, profileId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  return <MemberDetail organization={organization} profileId={profileId} initial={initial} />
}
