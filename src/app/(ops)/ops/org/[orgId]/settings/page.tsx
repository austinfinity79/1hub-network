import { requireOpsOrg } from '@/lib/ops/guard'
import { getOrganizationRelationships } from '@/lib/ops/relationships'

import { OrganizationRelationships } from './organization-relationships'

/**
 * WF03-S08 — /ops/org/:orgId/settings, organization settings / relationships.
 * Production-internal. Approved baseline:
 * design-reference/final/WF03/WF03-S08__unit-settings-relationships__1440x900.png
 *
 * The page checks `org:manage_relationship` for exactly this organization
 * (screen contract scope) and reads the canonical relationships on the server;
 * every create / change / close calls §8.7, which authorizes both organizations,
 * re-validates the type matrix, the one-parent invariant and cycles, and audits.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { accountId, organization } = await requireOpsOrg(orgId, 'org:manage_relationship')
  const initial = await getOrganizationRelationships(accountId, organization.id)
  return <OrganizationRelationships initial={initial} />
}
