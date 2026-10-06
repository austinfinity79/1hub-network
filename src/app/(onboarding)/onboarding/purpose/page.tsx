import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { requireOnboardingStage } from '@/lib/onboarding/guard'
import { getDeclaredRoles, listHubCatalog } from '@/lib/onboarding/roles'

import { ACTION_SLOT_ID } from '../parts'
import { RoleForm } from './role-form'

/**
 * ACC-08 — /onboarding/purpose, stage 3 of 4. Next: ACC-09 /onboarding/privacy.
 * Reference: design-reference/final/revision/L1/ACC-08__onboarding-role__SOURCE.png
 * Decisions DEC-L1R-D3, D5; S1-UAT-03 (DEC-S1O). The route is the one WF01-S05 used.
 *
 * The units offered are the canonical catalogue (HUB Network Tổng, the 13
 * Chapters, the CLBs under their Chapter; Appendix E), in its order; the PUT
 * re-validates every row.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { accountId } = await requireOnboardingStage('ROLE')

  const [declared, catalog] = await Promise.all([getDeclaredRoles(accountId), listHubCatalog()])

  return (
    <OnboardingShell stage={3} caption="BƯỚC 3/4 · VAI TRÒ" action={<div id={ACTION_SLOT_ID} />}>
      <RoleForm
        initial={{ roles: declared.roles, claims: declared.hub_claims }}
        catalog={catalog}
      />
    </OnboardingShell>
  )
}
