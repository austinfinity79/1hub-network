import { requireOpsOrg } from '@/lib/ops/guard'
import { listOrganizationEvents } from '@/lib/ops/events'

import { EventManagement } from './event-management'

/**
 * WF03-S07 — /ops/org/:orgId/events, standalone Event management.
 * Production-internal. The approved S07 bitmap is a WF04 collage and not
 * business authority (DEC-WF03-G2); the screen is built from approved WF03
 * primitives (OpsShell, S08 header / cards / table / form).
 *
 * The page checks `event:manage` for exactly this organization and reads the
 * standalone events on the server; every create / edit / publish / cancel
 * calls §8.6, which authorizes, validates the lifecycle and audits again.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { accountId, organization } = await requireOpsOrg(orgId, 'event:manage')
  const initial = await listOrganizationEvents(accountId, organization.id)
  return <EventManagement organization={organization} initial={initial} />
}
