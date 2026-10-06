import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { getAccountEmail, getAccountSignupName } from '@/lib/auth/account'
import { requireOnboardingStage } from '@/lib/onboarding/guard'
import { initialLocation, VIETNAM_SLUG } from '@/lib/profile/location'
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
 * REGION; the canonical catalogue of S1-UAT-03): the ACTIVE items, plus the
 * profile's own item when it is ARCHIVED, so a stored choice stays visible. A
 * typed name (UNNORMALIZED) shows as "Khác" with its text (US-01.07). The
 * e-mail is the account's own, read on the server.
 */
export const dynamic = 'force-dynamic'

type Ref = { id: string; label: string; slug?: string; status?: string }

/**
 * ACTIVE items (Việt Nam marked; slugs stay on the server), then the
 * profile's own item when it is ARCHIVED (not a typed name).
 */
const withKept = (active: Ref[], kept: Ref | null) => [
  ...active.map(({ id, label, slug }) => ({
    id,
    label,
    ...(slug === VIETNAM_SLUG ? { vietnam: true } : {}),
  })),
  ...(kept && kept.status === 'ARCHIVED' && !active.some((a) => a.id === kept.id)
    ? [{ id: kept.id, label: kept.label }]
    : []),
]

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { accountId } = await requireOnboardingStage('BASIC')
  // "Sửa" on stage 4 returns there after "Tiếp tục" (US-01.12).
  const fromReview = (await searchParams).from === 'review'

  const [profile, countries, regions, email, signupName] = await Promise.all([
    getOwnProfile(accountId),
    listActiveItems(['COUNTRY']),
    listActiveItems(['REGION']),
    getAccountEmail(accountId),
    getAccountSignupName(accountId),
  ])
  const countryOptions = withKept(countries, profile.country)
  const regionOptions = withKept(regions, profile.region)

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
          location: initialLocation(profile, countryOptions, regionOptions),
          phone: profile.phone ?? '',
          avatar_url: profile.avatar?.url ?? null,
        }}
        email={email ?? ''}
        countries={countryOptions}
        regions={regionOptions}
        next={fromReview ? '/onboarding/privacy' : '/onboarding/capability'}
      />
    </OnboardingShell>
  )
}
