import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { getLegalState } from '@/lib/legal/legal'
import { requireOnboardingStage } from '@/lib/onboarding/guard'
import { getDeclaredRoles } from '@/lib/onboarding/roles'
import { getProfileCompletion, type CompletionGroup } from '@/lib/profile/completion'
import { getOwnProfile } from '@/lib/profile/profile'
import { getVisibility } from '@/lib/profile/visibility'

import { ACTION_SLOT_ID } from '../parts'
import { ROLE_COPY } from '../role-copy'
import { ReviewForm, type ReviewPart } from './review-form'

/**
 * ACC-09 — /onboarding/privacy, stage 4 of 4. Next: ACC-10 /onboarding/complete.
 * Reference: design-reference/final/revision/L1/ACC-09__onboarding-review__SOURCE.png
 * Decisions DEC-L1R-D3, D6. The route is the one WF01-S07 used: this screen
 * replaces it (the board's own note), keeping its two duties, visibility and
 * consent, as two separate controls.
 *
 * Everything shown is read on the server: the three stages as stored, the
 * authoritative completion, the current legal documents and the account's
 * acceptance state, and the PROFILE_DISCOVERY level.
 */
export const dynamic = 'force-dynamic'

/** The completion groups by the name the screens give their fields. */
const GROUP_LABELS: Record<CompletionGroup, string> = {
  DISPLAY_NAME: 'Tên hiển thị',
  AVATAR: 'Ảnh hồ sơ',
  HEADLINE: 'Vai trò hiện tại',
  REGION: 'Tỉnh/Thành phố',
  BIO: 'Giới thiệu ngắn',
  DOMAIN: 'Lĩnh vực quan tâm',
  SKILLS: 'Kỹ năng',
  EXPERIENCE: 'Kinh nghiệm nổi bật',
  DEVELOPMENT_GOAL: 'Mục tiêu phát triển',
  CURRENT_NEED: 'Nhu cầu hiện tại',
}

const joined = (labels: string[]) => (labels.length > 0 ? labels.join(' · ') : null)

export default async function Page() {
  const { accountId } = await requireOnboardingStage('REVIEW')

  const [profile, declared, legal, visibility, completion] = await Promise.all([
    getOwnProfile(accountId),
    getDeclaredRoles(accountId),
    getLegalState(accountId),
    getVisibility(accountId),
    getProfileCompletion(accountId),
  ])
  const discovery = visibility.groups.find((g) => g.group_code === 'PROFILE_DISCOVERY')!.level

  const parts: ReviewPart[] = [
    {
      title: 'Thông tin cơ bản',
      href: '/onboarding/profile',
      rows: [
        { label: 'Họ và tên', value: profile.full_name, empty: 'Chưa có' },
        { label: 'Tên hiển thị', value: profile.display_name, empty: 'Chưa có' },
        { label: 'Vai trò hiện tại', value: profile.headline, empty: 'Chưa có' },
        {
          label: 'Vị trí',
          value: [profile.region?.label, profile.country?.label].filter(Boolean).join(', ') || null,
          empty: 'Chưa có',
        },
        { label: 'Ảnh hồ sơ', value: profile.avatar ? 'Đã tải lên' : null, empty: 'Chưa có' },
        {
          label: 'Số điện thoại',
          value: profile.phone ? `${profile.phone} · riêng tư` : null,
          empty: 'Chưa thêm · riêng tư',
        },
      ],
    },
    {
      title: 'Lĩnh vực và chuyên môn',
      href: '/onboarding/capability',
      rows: [
        {
          label: 'Lĩnh vực',
          value: joined(profile.domains.map((d) => d.label)),
          empty: 'Chưa chọn',
        },
        {
          label: 'Chuyên môn',
          value: joined(profile.specializations.map((s) => s.label)),
          empty: 'Chưa chọn',
        },
        { label: 'Kỹ năng', value: joined(profile.skills.map((s) => s.label)), empty: 'Chưa chọn' },
        {
          label: 'Kinh nghiệm',
          value: profile.experience.length > 0 ? `${profile.experience.length} mục` : null,
          empty: 'Chưa có',
        },
        {
          label: 'Liên kết',
          value: joined(profile.links.map((l) => l.label ?? l.url)),
          empty: 'Chưa có',
        },
      ],
    },
    {
      title: 'Vai trò',
      href: '/onboarding/purpose',
      rows: [
        {
          label: 'Vai trò',
          value: joined(
            ROLE_COPY.filter((r) => declared.roles.includes(r.code)).map((r) => r.short),
          ),
          empty: 'Chưa chọn',
        },
        // Shown only when a unit was named; the position stays "Chờ xác minh".
        ...(declared.hub_claims.length > 0
          ? [
              {
                label: 'Vị trí tại HUB',
                value: declared.hub_claims
                  .map(
                    (c) =>
                      `${[c.position, c.organization.name].filter(Boolean).join(' · ')} — Chờ xác minh`,
                  )
                  .join('; '),
                empty: '',
              },
            ]
          : []),
      ],
    },
  ]

  return (
    <OnboardingShell
      stage={4}
      caption="BƯỚC 4/4 · RÀ SOÁT VÀ HOÀN TẤT"
      action={<div id={ACTION_SLOT_ID} />}
    >
      <ReviewForm
        parts={parts}
        // The card of ACC-09. Roles are the member's own declaration, shown as text:
        // the HUB role reads "Chờ xác minh" once a unit is named, "Tự khai" before.
        preview={{
          display_name: profile.display_name ?? '',
          line: [profile.headline, profile.region?.label].filter(Boolean).join(' · '),
          avatar_url: profile.avatar?.url ?? null,
          roles: ROLE_COPY.filter((r) => declared.roles.includes(r.code)).map((r) =>
            r.code === 'HUB_MEMBER'
              ? {
                  label: `Thành viên HUB · ${declared.hub_claims.length > 0 ? 'Chờ xác minh' : 'Tự khai'}`,
                  pending: true,
                }
              : { label: r.short, pending: false },
          ),
          domains: profile.domains.map((d) => d.label),
        }}
        completion={{
          percent: completion.percent,
          missing: completion.groups.filter((g) => !g.complete).map((g) => GROUP_LABELS[g.code]),
        }}
        // ON when members can find the card (NETWORK_ONLY, or a wider legacy level).
        initialDiscovery={discovery === 'NETWORK_ONLY' || discovery === 'PUBLIC'}
        initialLegal={legal}
      />
    </OnboardingShell>
  )
}
