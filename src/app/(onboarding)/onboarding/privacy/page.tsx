import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { getLegalState } from '@/lib/legal/legal'
import { getOnboardingState } from '@/lib/onboarding/state'
import { getOwnProfile } from '@/lib/profile/profile'
import { getVisibility } from '@/lib/profile/visibility'

import { PrivacyForm } from './privacy-form'

/**
 * WF01-S07 — /onboarding/privacy. Next: WF01-S08 /onboarding/complete.
 * Approved baseline: design-reference/final/WF01/WF01-S07__onboarding-privacy__1440x900.png
 * Decisions DEC-WF01-S07-D1..D8.
 *
 * Same server guard as S05/S06. Current legal documents, the account's
 * acceptance state and the PROFILE_DISCOVERY level are read on the server, so
 * no version or default is a client constant. No header action: S07 has no
 * skip (D6). S07 never completes onboarding or activates the profile.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  if (state.completed) redirect('/me')

  const [profile, legal, visibility] = await Promise.all([
    getOwnProfile(session.accountId),
    getLegalState(session.accountId),
    getVisibility(session.accountId),
  ])
  const discovery = visibility.groups.find((g) => g.group_code === 'PROFILE_DISCOVERY')!.level

  return (
    <OnboardingShell currentStep={3}>
      <PrivacyForm
        // ON when members can find the card (NETWORK_ONLY, or a wider legacy level).
        initialDiscovery={discovery === 'NETWORK_ONLY' || discovery === 'PUBLIC'}
        initialLegal={legal}
        card={{
          display_name: profile.display_name,
          headline: profile.headline,
          region: profile.region?.label ?? null,
          avatar_url: profile.avatar?.url ?? null,
          domains: profile.domains.map((d) => d.label),
        }}
      />
    </OnboardingShell>
  )
}
