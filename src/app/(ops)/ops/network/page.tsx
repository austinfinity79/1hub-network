import { requireOps } from '@/lib/ops/guard'

import { OrganizationList } from './organization-list'

/**
 * WF03-S01 — /ops/network, ops organization selector / list. Production-internal.
 * Approved baseline: design-reference/final/WF03/WF03-S01__chapter-selector-members__1440x900.png
 *
 * Lists the operational organizations in the actor's exact scope through
 * GET /ops/organizations (DEC-WF03-G11). Selecting one opens its ops context
 * (`/ops/org/:orgId`); that route authorizes on its own. The page repeats the
 * scope check rather than relying on the layout (DEC-WF03-T00-D3).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireOps()
  return <OrganizationList />
}
