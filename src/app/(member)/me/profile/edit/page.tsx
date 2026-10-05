import { requireMember } from '@/lib/member/guard'
import { getOwnProfile } from '@/lib/profile/profile'
import { getVisibility } from '@/lib/profile/visibility'
import { listActiveItems } from '@/lib/vocabulary/vocabulary'

import { ProfileEditor } from './profile-editor'

/**
 * WF02-S02 — /me/profile/edit, Individual Profile Edit. Production.
 * Approved baseline: design-reference/final/WF02/WF02-S02__individual-profile-edit__1440x900.png
 * Decisions DEC-WF02-H1/H2/H3, DEC-WF02-S02-D1..D7.
 *
 * Guest → /auth; onboarding not done → its resolver step (DEC-WF02-T00-D1).
 * The approved screen has its own editor header, not the member shell.
 * Domain suggestions are the ACTIVE catalogue labels; the field holds the
 * profile's own domain tags, whatever their status (FB-09, S1-UAT-05).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()
  const [profile, regions, active, visibility] = await Promise.all([
    getOwnProfile(member.accountId),
    listActiveItems(['REGION']),
    listActiveItems(['DOMAIN']),
    getVisibility(member.accountId),
  ])

  const regionOptions = regions.map((r) => ({ id: r.id, label: r.label }))
  if (profile.region && !regionOptions.some((r) => r.id === profile.region!.id)) {
    regionOptions.unshift({ id: profile.region.id, label: profile.region.label })
  }
  const discovery =
    visibility.groups.find((g) => g.group_code === 'PROFILE_DISCOVERY')?.level ?? 'NETWORK_ONLY'

  return (
    <ProfileEditor
      initial={{
        display_name: profile.display_name ?? '',
        headline: profile.headline ?? '',
        region_id: profile.region?.id ?? '',
        bio: profile.bio ?? '',
        domains: profile.domains.map((d) => d.label),
        experience: profile.experience.map((e) => ({
          title: e.title,
          organization_name: e.organization_name ?? '',
        })),
        no_experience_yet: profile.no_experience_yet,
        development_goal: profile.development_goal ?? '',
        current_need: profile.current_need ?? '',
        links: profile.links.map((l) => l.url),
        avatar_url: profile.avatar?.url ?? null,
      }}
      regions={regionOptions}
      domainOptions={active.map((item) => item.label)}
      discoverable={discovery !== 'PRIVATE'}
    />
  )
}
