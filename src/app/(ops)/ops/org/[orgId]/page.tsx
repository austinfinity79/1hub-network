import { requireOpsOrg } from '@/lib/ops/guard'

import { OrganizationDashboard } from './organization-dashboard'

/**
 * WF03-S02 — /ops/org/:orgId, organization dashboard. Production-internal.
 * Reference (TASK 22.4, L20 CHP1 subset): design-reference/final/revision/L3/L20__chapter-dashboard__SOURCE.png
 *
 * The page checks `org:read` for exactly this organization (the layout's check
 * is not relied on); the dashboard numbers come from
 * GET /ops/organizations/{orgId}/dashboard, which authorizes again.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { organization, capabilities } = await requireOpsOrg(orgId, 'org:read')
  return (
    <OrganizationDashboard
      organization={organization}
      canManageEvents={capabilities.includes('event:manage')}
    />
  )
}
