import { ProfileShell } from '@/components/shell/workspace-shell'
import { requireMember } from '@/lib/member/guard'
import { getOwnNetwork } from '@/lib/network/network'
import { getProfileCompletion } from '@/lib/profile/completion'
import { VIETNAM_SLUG } from '@/lib/profile/location'
import { getOwnProfile } from '@/lib/profile/profile'
import { listOwnVentures } from '@/lib/venture/venture'
import { listActiveItems } from '@/lib/vocabulary/vocabulary'

import { currentMonth, monthsBetween } from './profile-model'
import { ProfileOwn } from './profile-own'

/**
 * WF02-S01 — /me, "Hồ sơ của tôi" (FP1-OWN of the L1 board). Production.
 * Reference: design-reference/final/revision/L2/FP1-OWN__my-profile__SOURCE.png
 * Decisions DEC-L2R-D1..D3, D11.
 *
 * Guest → /auth; onboarding not done → its resolver step. Everything is the
 * session account's own, read on the server: the canonical profile, the
 * server's completion, the ventures it owns or belongs to, its ACTIVE
 * leadership titles, and the vocabulary the in-place dialogs offer (ACTIVE
 * countries and regions plus the profile's own archived ones; ACTIVE domain and
 * specialisation labels as tag suggestions). Sections the board draws
 * without a data source are not drawn (D-P1).
 */
export const dynamic = 'force-dynamic'

type Ref = { id: string; label: string; slug?: string; status?: string }

const withKept = (active: Ref[], kept: Ref[]) => [
  // Việt Nam is marked for the location rule (US-01.07); slugs stay on the server.
  ...active.map(({ id, label, slug }) => ({
    id,
    label,
    ...(slug === VIETNAM_SLUG ? { vietnam: true } : {}),
  })),
  // An ARCHIVED choice stays offered; a typed name (UNNORMALIZED) shows as "Khác" (US-01.07).
  ...kept
    .filter((k) => k.status === 'ARCHIVED' && !active.some((a) => a.id === k.id))
    .map(({ id, label }) => ({ id, label })),
]

export default async function Page() {
  const member = await requireMember()
  const [profile, completion, ventures, network, vocabulary] = await Promise.all([
    getOwnProfile(member.accountId),
    getProfileCompletion(member.accountId),
    listOwnVentures(member.accountId),
    getOwnNetwork(member.accountId),
    listActiveItems(['COUNTRY', 'REGION', 'DOMAIN', 'SPECIALIZATION']),
  ])
  const of = (type: string) => vocabulary.filter((item) => item.type === type)
  // The current month on the server, so the page and its client agree (no hydration drift).
  const now = currentMonth()

  return (
    <ProfileShell member={member}>
      <ProfileOwn
        profile={profile}
        completion={{
          percent: completion.percent,
          missing: completion.groups.filter((g) => !g.complete).map((g) => g.code),
        }}
        ventures={ventures}
        positions={network.leadership
          .filter((l) => l.status === 'ACTIVE')
          .map((l) => `${l.title} · ${l.organization.name}`)}
        durations={profile.experience.map((e) =>
          e.started_on ? monthsBetween(e.started_on, e.ended_on ?? now) : null,
        )}
        options={{
          countries: withKept(of('COUNTRY'), profile.country ? [profile.country] : []),
          regions: withKept(of('REGION'), profile.region ? [profile.region] : []),
          // FB-09: catalogue labels the tag fields suggest; the profile keeps its own tags.
          domains: of('DOMAIN').map((item) => item.label),
          specializations: of('SPECIALIZATION').map((item) => item.label),
        }}
      />
    </ProfileShell>
  )
}
