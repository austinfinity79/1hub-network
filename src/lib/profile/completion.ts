import { query, type Executor } from '@/lib/db/client'
import { isValidAvatar } from '@/lib/media/avatar-storage'

/**
 * Profile completion — the ONE authoritative calculation (Data Freeze D3).
 *
 * Ten canonical groups, ten points each; completion_percent = groups × 10.
 * Group 3 is HEADLINE. The stale NETWORK_CONTEXT in the API example is not a
 * group (RESOLVED_BY_PRECEDENCE, DEC-WF01-S06 record). Intent, membership,
 * leadership, consent and visibility never count. The client never submits a
 * percent; /session, /me/profile and /me/profile/completion all call this.
 */

export const COMPLETION_GROUPS = [
  'DISPLAY_NAME',
  'AVATAR',
  'HEADLINE',
  'REGION',
  'BIO',
  'DOMAIN',
  'SKILLS',
  'EXPERIENCE',
  'DEVELOPMENT_GOAL',
  'CURRENT_NEED',
] as const

export type CompletionGroup = (typeof COMPLETION_GROUPS)[number]

export const GROUP_WEIGHT = 10

/** Everything the groups depend on, read once per calculation. */
export type CompletionFacts = {
  display_name: string | null
  avatar_valid: boolean
  headline: string | null
  /** A REGION item is linked; archived still counts (Freeze:209). */
  region_valid: boolean
  bio: string | null
  domain_count: number
  skill_count: number
  experience_count: number
  no_experience_yet: boolean
  development_goal: string | null
  current_need: string | null
}

export type ProfileCompletion = {
  percent: number
  completed_groups: number
  total_groups: number
  groups: { code: CompletionGroup; complete: boolean; weight: number }[]
}

const filled = (value: string | null) => Boolean(value && value.trim())

export function computeCompletion(facts: CompletionFacts | null): ProfileCompletion {
  const done: Record<CompletionGroup, boolean> = {
    DISPLAY_NAME: filled(facts?.display_name ?? null),
    AVATAR: Boolean(facts?.avatar_valid),
    HEADLINE: filled(facts?.headline ?? null),
    REGION: Boolean(facts?.region_valid),
    BIO: filled(facts?.bio ?? null),
    DOMAIN: (facts?.domain_count ?? 0) >= 1,
    SKILLS: (facts?.skill_count ?? 0) >= 1,
    EXPERIENCE: (facts?.experience_count ?? 0) >= 1 || Boolean(facts?.no_experience_yet),
    DEVELOPMENT_GOAL: filled(facts?.development_goal ?? null),
    CURRENT_NEED: filled(facts?.current_need ?? null),
  }
  const groups = COMPLETION_GROUPS.map((code) => ({
    code,
    complete: done[code],
    weight: GROUP_WEIGHT,
  }))
  const completed = groups.filter((g) => g.complete).length
  return {
    percent: completed * GROUP_WEIGHT,
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
    `SELECT p.display_name, p.avatar_asset_id, p.headline, p.bio,
            p.development_goal, p.current_need, p.no_experience_yet,
            EXISTS (SELECT 1 FROM vocabulary_items v
                     WHERE v.id = p.region_vocab_id AND v.type_code = 'REGION') AS region_valid,
            (SELECT count(*) FROM profile_domains d JOIN vocabulary_items v ON v.id = d.vocab_id
              WHERE d.profile_id = p.id AND v.type_code = 'DOMAIN')::int AS domain_count,
            (SELECT count(*) FROM profile_skills s JOIN vocabulary_items v ON v.id = s.vocab_id
              WHERE s.profile_id = p.id AND v.type_code = 'SKILL')::int AS skill_count,
            (SELECT count(*) FROM profile_experience e WHERE e.profile_id = p.id)::int
              AS experience_count
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
