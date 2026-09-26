import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { getOnboardingState } from '@/lib/onboarding/state'
import { getOwnProfile } from '@/lib/profile/profile'
import { listActiveItems } from '@/lib/vocabulary/vocabulary'

import { ProfileForm, type ExpertiseOption } from './profile-form'

/**
 * WF01-S06 — /onboarding/profile. Next: WF01-S07 /onboarding/privacy.
 * Approved baseline: design-reference/final/WF01/WF01-S06__onboarding-profile__1440x900.png
 * Decisions DEC-WF01-S06-D1..D6.
 *
 * Same server guard as S05: no session → /auth; completed onboarding → /me.
 * Vocabulary comes from the database (never a literal list). The header has
 * no action: S06 has no skip (D5).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  if (state.completed) redirect('/me')

  const [profile, regions, active] = await Promise.all([
    getOwnProfile(session.accountId),
    listActiveItems(['REGION']),
    listActiveItems(['DOMAIN', 'SKILL']),
  ])

  // D1: one picker over DOMAIN + SKILL; each option keeps its canonical type.
  // Already-linked archived items stay visible (and selected) but are never offered anew.
  const linked: ExpertiseOption[] = [
    ...profile.domains.map((d) => ({ id: d.id, label: d.label, type: 'DOMAIN' as const })),
    ...profile.skills.map((s) => ({ id: s.id, label: s.label, type: 'SKILL' as const })),
  ]
  const linkedIds = new Set(linked.map((o) => o.id))
  const options: ExpertiseOption[] = [
    ...linked,
    ...active
      .filter((item) => !linkedIds.has(item.id))
      .map((item) => ({ id: item.id, label: item.label, type: item.type as 'DOMAIN' | 'SKILL' })),
  ]
  const regionOptions = regions.map((r) => ({ id: r.id, label: r.label }))
  if (profile.region && !regionOptions.some((r) => r.id === profile.region!.id)) {
    regionOptions.unshift({ id: profile.region.id, label: profile.region.label })
  }

  return (
    <OnboardingShell currentStep={2}>
      <ProfileForm
        initial={{
          display_name: profile.display_name ?? '',
          headline: profile.headline ?? '',
          region_id: profile.region?.id ?? '',
          bio: profile.bio ?? '',
          avatar_url: profile.avatar?.url ?? null,
          expertise: [...linkedIds],
        }}
        regions={regionOptions}
        expertise={options}
      />
    </OnboardingShell>
  )
}
