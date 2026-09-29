import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { requireOnboardingStage } from '@/lib/onboarding/guard'
import { getOwnProfile } from '@/lib/profile/profile'
import { listActiveItems } from '@/lib/vocabulary/vocabulary'

import { ACTION_SLOT_ID } from '../parts'
import { CapabilityForm } from './capability-form'

/**
 * ACC-07 — /onboarding/capability, stage 2 of 4. Next: ACC-08 /onboarding/purpose.
 * Reference: design-reference/final/revision/L1/ACC-07__onboarding-capability__SOURCE.png
 * Decisions DEC-L1R-D3, D4.
 *
 * Every list is the controlled vocabulary's ACTIVE items plus what the profile
 * already holds, so an archived item that is selected stays visible.
 */
export const dynamic = 'force-dynamic'

type Ref = { id: string; label: string }

/** ACTIVE items, then the profile's own items that are no longer active. */
const withKept = (active: Ref[], kept: Ref[]) => [
  ...active.map(({ id, label }) => ({ id, label })),
  ...kept
    .filter((item) => !active.some((a) => a.id === item.id))
    .map(({ id, label }) => ({ id, label })),
]

export default async function Page() {
  const { accountId } = await requireOnboardingStage('CAPABILITY')

  const [profile, domains, specializations, skills] = await Promise.all([
    getOwnProfile(accountId),
    listActiveItems(['DOMAIN']),
    listActiveItems(['SPECIALIZATION']),
    listActiveItems(['SKILL']),
  ])

  return (
    <OnboardingShell
      stage={2}
      caption="BƯỚC 2/4 · LĨNH VỰC VÀ CHUYÊN MÔN"
      action={<div id={ACTION_SLOT_ID} />}
    >
      <CapabilityForm
        initial={{
          domain_ids: profile.domains.map((d) => d.id),
          specialization_ids: profile.specializations.map((s) => s.id),
          skill_ids: profile.skills.map((s) => s.id),
          experience: profile.experience.map((e) => ({
            title: e.title,
            organization_name: e.organization_name ?? '',
            started_on: e.started_on ?? '',
            ended_on: e.ended_on ?? '',
            description: e.description ?? '',
          })),
          no_experience_yet: profile.no_experience_yet,
          links: profile.links.map(({ label, url }) => ({ label, url })),
        }}
        domains={withKept(domains, profile.domains)}
        specializations={withKept(specializations, profile.specializations)}
        skills={withKept(skills, profile.skills)}
      />
    </OnboardingShell>
  )
}
