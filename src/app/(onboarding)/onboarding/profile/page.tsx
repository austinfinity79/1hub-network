import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { getAccountEmail, getAccountSignupName } from '@/lib/auth/account'
import { requireOnboardingStage } from '@/lib/onboarding/guard'
import { getOwnProfile } from '@/lib/profile/profile'
import { listActiveItems } from '@/lib/vocabulary/vocabulary'

import { ACTION_SLOT_ID } from '../parts'
import { BasicForm } from './basic-form'

/**
 * ACC-06 — /onboarding/profile, stage 1 of 4. Next: ACC-07 /onboarding/capability.
 * Reference: design-reference/final/revision/L1/ACC-06__onboarding-basic__SOURCE.png
 * Decisions DEC-L1R-D3, D4. The route is the one WF01-S06 used.
 *
 * Countries and provinces come from the controlled vocabulary (COUNTRY,
 * REGION): the ACTIVE items plus the profile's own item when it is no longer
 * active, so a stored choice stays visible. The e-mail is the account's own,
 * read on the server.
 */
export const dynamic = 'force-dynamic'

type Ref = { id: string; label: string }

/** ACTIVE items, then the profile's own item when it is no longer active. */
const withKept = (active: Ref[], kept: Ref | null) => [
  ...active.map(({ id, label }) => ({ id, label })),
  ...(kept && !active.some((a) => a.id === kept.id) ? [{ id: kept.id, label: kept.label }] : []),
]

export default async function Page() {
  const { accountId } = await requireOnboardingStage('BASIC')

  const [profile, countries, regions, email, signupName] = await Promise.all([
    getOwnProfile(accountId),
    listActiveItems(['COUNTRY']),
    listActiveItems(['REGION']),
    getAccountEmail(accountId),
    getAccountSignupName(accountId),
  ])

  return (
    <OnboardingShell
      stage={1}
      caption="BƯỚC 1/4 · THÔNG TIN CƠ BẢN"
      action={<div id={ACTION_SLOT_ID} />}
    >
      <BasicForm
        initial={{
          // S1-UAT-01: the sign-up name prefills an empty full name; never overrides.
          // The display name stays empty so it keeps defaulting to the full name.
          full_name: profile.full_name ?? signupName ?? '',
          display_name: profile.display_name ?? '',
          headline: profile.headline ?? '',
          bio: profile.bio ?? '',
          country_id: profile.country?.id ?? '',
          region_id: profile.region?.id ?? '',
          phone: profile.phone ?? '',
          avatar_url: profile.avatar?.url ?? null,
        }}
        email={email ?? ''}
        countries={withKept(countries, profile.country)}
        regions={withKept(regions, profile.region)}
      />
    </OnboardingShell>
  )
}
