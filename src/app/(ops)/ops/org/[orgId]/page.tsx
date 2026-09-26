import { requireOpsOrg } from '@/lib/ops/guard'

import { OrganizationDashboard } from './organization-dashboard'

/**
 * WF03-S02 — /ops/org/:orgId, organization dashboard. Production-internal.
 * Approved baseline: design-reference/final/WF03/WF03-S02__unit-dashboard__1440x900.png
 *
 * The page checks `org:read` for exactly this organization (the layout's check
 * is not relied on); the dashboard numbers come from
 * GET /ops/organizations/{orgId}/dashboard, which authorizes again.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { organization } = await requireOpsOrg(orgId, 'org:read')
  return <OrganizationDashboard organization={organization} />
}
