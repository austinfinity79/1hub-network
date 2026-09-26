import { requireOpsOrg } from '@/lib/ops/guard'
import { getOrganizationProfile } from '@/lib/ops/organization-profile'

import { OrganizationProfile } from './organization-profile'

/**
 * WF03-S06 — /ops/org/:orgId/profile, organization profile / detail.
 * Production-internal. Approved baseline:
 * design-reference/final/WF03/WF03-S06__unit-content-profile-management__1440x900.png
 *
 * The page checks `org:manage` for exactly this organization (screen contract
 * scope, DEC-WF03-C1) and reads the canonical profile on the server; saving
 * calls PATCH /ops/organizations/{orgId}/profile, which authorizes, validates
 * and audits again. Hierarchy is shown read-only; it is managed in S08.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { accountId, organization } = await requireOpsOrg(orgId, 'org:manage')
  const initial = await getOrganizationProfile(accountId, organization.id)
  return <OrganizationProfile initial={initial} />
}
