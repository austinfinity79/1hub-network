import { query, type Executor } from '@/lib/db/client'
import { isValidAvatar } from '@/lib/media/avatar-storage'

/**
 * Profile completion — the ONE authoritative calculation.
 *
 * Sprint 1 (FB-10, US-01.12, Appendix B "Độ hoàn thiện"; DEC-S1P) replaces the
 * ten groups of Data Freeze D3 with TWELVE equal items, in this order: Ảnh hồ
 * sơ · Họ và tên · Vai trò hiện tại · Giới thiệu ngắn · Vị trí · Lĩnh vực quan
 * tâm · Chuyên môn · Vai trò trong hệ sinh thái · Kinh nghiệm · LinkedIn ·
 * Website/Portfolio · Số điện thoại. Skills, development goal and current
 * need no longer count; education is a suggestion only and never counts
 * (Appendix C). percent = round(complete × 100 / 12). The client never submits
 * a percent; /session, /me/profile, /me/profile/completion, onboarding and the
 * avatar route all call this.
 */

export const COMPLETION_GROUPS = [
  'AVATAR',
  'FULL_NAME',
  'HEADLINE',
  'BIO',
  'LOCATION',
  'DOMAIN',
  'SPECIALIZATION',
  'ECOSYSTEM_ROLE',
  'EXPERIENCE',
  'LINKEDIN',
  'WEBSITE',
  'PHONE',
] as const

export type CompletionGroup = (typeof COMPLETION_GROUPS)[number]

/** Each item's equal share of 100, for display (12 × 8.33). */
export const GROUP_WEIGHT = Math.round((100 / COMPLETION_GROUPS.length) * 100) / 100

/** Everything the items depend on, read once per calculation. */
export type CompletionFacts = {
  full_name: string | null
  avatar_valid: boolean
  headline: string | null
  bio: string | null
  /** "Vị trí": a REGION (tỉnh/thành) item is linked; archived still counts (Freeze:209). */
  region_valid: boolean
  /** Any linked DOMAIN item: canonical or the member's own unnormalised tag. */
  domain_count: number
  specialization_count: number
  /** Self-declared ecosystem roles (stage 3; never a permission). */
  declared_role_count: number
  experience_count: number
  /** Explicit "chưa có kinh nghiệm" still answers the item (Freeze §D3 group 8). */
  no_experience_yet: boolean
  /** Profile links, by URL: a linkedin.com link is LinkedIn, any other one a website. */
  link_urls: string[]
  phone: string | null
}

export type ProfileCompletion = {
  percent: number
  completed_groups: number
  total_groups: number
  groups: { code: CompletionGroup; complete: boolean; weight: number }[]
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim())

/** linkedin.com or any subdomain of it, by host; never by the free-text label. */
export function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'linkedin.com' || host.endsWith('.linkedin.com')
  } catch {
    return false
  }
}

export function computeCompletion(facts: CompletionFacts | null): ProfileCompletion {
  const links = facts?.link_urls ?? []
  const done: Record<CompletionGroup, boolean> = {
    AVATAR: Boolean(facts?.avatar_valid),
    FULL_NAME: filled(facts?.full_name),
    HEADLINE: filled(facts?.headline),
    BIO: filled(facts?.bio),
    LOCATION: Boolean(facts?.region_valid),
    DOMAIN: (facts?.domain_count ?? 0) >= 1,
    SPECIALIZATION: (facts?.specialization_count ?? 0) >= 1,
    ECOSYSTEM_ROLE: (facts?.declared_role_count ?? 0) >= 1,
    EXPERIENCE: (facts?.experience_count ?? 0) >= 1 || Boolean(facts?.no_experience_yet),
    LINKEDIN: links.some(isLinkedInUrl),
    WEBSITE: links.some((url) => !isLinkedInUrl(url)),
    PHONE: filled(facts?.phone),
  }
  const groups = COMPLETION_GROUPS.map((code) => ({
    code,
    complete: done[code],
    weight: GROUP_WEIGHT,
  }))
  const completed = groups.filter((g) => g.complete).length
  return {
    percent: Math.round((completed * 100) / COMPLETION_GROUPS.length),
    completed_groups: completed,
    total_groups: COMPLETION_GROUPS.length,
    groups,
  }
}

type FactsRow = Omit<CompletionFacts, 'avatar_valid'> & { avatar_asset_id: string | null }

/** Null when the account has no profile yet (NOT_CREATED). */
export async function loadCompletionFacts(
  accountId: string,
  exec: Executor = query,
): Promise<CompletionFacts | null> {
  const [row] = await exec<FactsRow>(
    `SELECT p.full_name, p.avatar_asset_id, p.headline, p.bio, p.phone, p.no_experience_yet,
            EXISTS (SELECT 1 FROM vocabulary_items v
                     WHERE v.id = p.region_vocab_id AND v.type_code = 'REGION') AS region_valid,
            (SELECT count(*) FROM profile_domains d JOIN vocabulary_items v ON v.id = d.vocab_id
              WHERE d.profile_id = p.id AND v.type_code = 'DOMAIN')::int AS domain_count,
            (SELECT count(*) FROM profile_specializations s
               JOIN vocabulary_items v ON v.id = s.vocab_id
              WHERE s.profile_id = p.id AND v.type_code = 'SPECIALIZATION')::int
              AS specialization_count,
            (SELECT count(*) FROM profile_declared_roles r WHERE r.profile_id = p.id)::int
              AS declared_role_count,
            (SELECT count(*) FROM profile_experience e WHERE e.profile_id = p.id)::int
              AS experience_count,
            COALESCE((SELECT array_agg(l.url ORDER BY l.sort_order) FROM profile_links l
                       WHERE l.profile_id = p.id), '{}') AS link_urls
       FROM individual_profiles p WHERE p.account_id = $1`,
    [accountId],
  )
  if (!row) return null
  const { avatar_asset_id, ...rest } = row
  return { ...rest, avatar_valid: await isValidAvatar(avatar_asset_id, accountId) }
}

export async function getProfileCompletion(accountId: string): Promise<ProfileCompletion> {
  return computeCompletion(await loadCompletionFacts(accountId))
}
