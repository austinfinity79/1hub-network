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
 * Suggestions are the controlled vocabulary's ACTIVE labels; the fields hold
 * the profile's own tags, whatever their status (FB-09, S1-UAT-05).
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { accountId } = await requireOnboardingStage('CAPABILITY')
  // "Sửa" on stage 4 returns there after "Tiếp tục" (US-01.12).
  const fromReview = (await searchParams).from === 'review'

  const [profile, catalogue] = await Promise.all([
    getOwnProfile(accountId),
    listActiveItems(['DOMAIN', 'SPECIALIZATION']),
  ])
  // FB-09: ACTIVE catalogue labels are suggestions only; the profile's own tags
  // (canonical, archived or "chưa chuẩn hóa") are its current values.
  const labels = (type: string) => catalogue.filter((i) => i.type === type).map((i) => i.label)

  return (
    <OnboardingShell
      stage={2}
      caption="BƯỚC 2/4 · LĨNH VỰC VÀ CHUYÊN MÔN"
      action={<div id={ACTION_SLOT_ID} />}
    >
      <CapabilityForm
        initial={{
          domains: profile.domains.map((d) => d.label),
          specializations: profile.specializations.map((s) => s.label),
          experience: profile.experience.map((e) => ({
            title: e.title,
            organization_name: e.organization_name ?? '',
            started_on: e.started_on ?? '',
            ended_on: e.ended_on ?? '',
            description: e.description ?? '',
            employment_type: e.employment_type ?? '',
            location: e.location ?? '',
          })),
          no_experience_yet: profile.no_experience_yet,
          links: profile.links.map(({ label, url }) => ({ label, url })),
        }}
        domainOptions={labels('DOMAIN')}
        specializationOptions={labels('SPECIALIZATION')}
        next={fromReview ? '/onboarding/privacy' : '/onboarding/purpose'}
      />
    </OnboardingShell>
  )
}
