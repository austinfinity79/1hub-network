import { requireOpsOrg } from '@/lib/ops/guard'
import { listOrganizationEvents } from '@/lib/ops/events'

import { EventManagement } from './event-management'

/**
 * WF03-S07 — /ops/org/:orgId/events, standalone Event management.
 * Production-internal. The approved S07 bitmap is a WF04 collage and not
 * business authority (DEC-WF03-G2); since TASK 22.4 the list follows the
 * corrected L23 CHP4 subset:
 * design-reference/final/revision/L3/L23__chapter-events__SOURCE.png
 *
 * The page checks `event:manage` for exactly this organization and reads the
 * standalone events on the server; every create / edit / publish / cancel
 * calls §8.6, which authorizes, validates the lifecycle and audits again.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ create?: string | string[] }>
}) {
  const { orgId } = await params
  const { create } = await searchParams
  const { accountId, organization } = await requireOpsOrg(orgId, 'event:manage')
  const initial = await listOrganizationEvents(accountId, organization.id)
  return (
    <EventManagement organization={organization} initial={initial} initialCreate={create === '1'} />
  )
}
