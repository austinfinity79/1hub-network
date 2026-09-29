import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { listRequestableOrganizations } from '@/lib/network/membership-request'
import { requireOnboardingStage } from '@/lib/onboarding/guard'
import { getDeclaredRoles } from '@/lib/onboarding/roles'

import { ACTION_SLOT_ID } from '../parts'
import { RoleForm } from './role-form'

/**
 * ACC-08 — /onboarding/purpose, stage 3 of 4. Next: ACC-09 /onboarding/privacy.
 * Reference: design-reference/final/revision/L1/ACC-08__onboarding-role__SOURCE.png
 * Decisions DEC-L1R-D3, D5. The route is the one WF01-S05 used.
 *
 * The units offered are the requestable ones (HUB, CHAPTER, CLB, PUBLISHED),
 * the same predicate the membership request uses; the PUT re-validates.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { accountId } = await requireOnboardingStage('ROLE')

  const [declared, units] = await Promise.all([
    getDeclaredRoles(accountId),
    listRequestableOrganizations(),
  ])

  return (
    <OnboardingShell stage={3} caption="BƯỚC 3/4 · VAI TRÒ" action={<div id={ACTION_SLOT_ID} />}>
      <RoleForm
        initial={{
          roles: declared.roles,
          claims: declared.hub_claims.map((c) => ({
            organization_id: c.organization.id,
            position: c.position ?? '',
            period: c.period ?? '',
          })),
        }}
        units={units.map((u) => ({ id: u.id, label: u.name }))}
      />
    </OnboardingShell>
  )
}
