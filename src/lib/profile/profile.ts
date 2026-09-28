import { trackCompletionChange } from '@/lib/analytics/analytics'
import { ApiError } from '@/lib/api/errors'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { assetUrl } from '@/lib/media/avatar-storage'
import { assertSelectable, type VocabularyStatus } from '@/lib/vocabulary/vocabulary'

import { computeCompletion, loadCompletionFacts } from './completion'

/**
 * Own profile — GET/PATCH /me/profile (05 §4.3). Maps WF01-S06 and WF02-S02.
 * Returns a DTO, never the row. The account comes from the session only, so a
 * caller can read or change nothing but its own profile.
 *
 * PATCH is partial. WF01-S06 uses display_name, headline, region_id, bio,
 * domain_ids and skill_ids; WF02-S02 also sends development_goal,
 * current_need (05 §4.3 example), experience, no_experience_yet (DEC-WF02-H1)
 * and links (DEC-WF02-H2), shaped by DEC-WF02-S02-D1..D3. Anything else,
 * completion_percent and status included, is refused rather than ignored, so
 * no client can write status, avatar or completion through it.
 *
 * Four-stage onboarding (DEC-L1R-D4): stage 1 adds full_name, country_id and
 * phone; stage 2 adds specialization_ids and the period and description of an
 * experience record. `phone` is private: it is returned here, to its owner,
 * and by no other read model.
 */

export const PATCH_FIELDS = [
  'full_name',
  'display_name',
  'headline',
  'country_id',
  'region_id',
  'phone',
  'bio',
  'domain_ids',
  'specialization_ids',
  'skill_ids',
  'development_goal',
  'current_need',
  'experience',
  'no_experience_yet',
  'links',
] as const

/**
 * ACC-07 "Đã chọn n/5": at most five specialisations. Domains ("chọn nhiều")
 * and skills have no business limit on the board; theirs are technical bounds.
 * This replaces DEC-WF01-S06-D4, the limit of five over DOMAIN + SKILL together.
 */
export const MAX_SPECIALIZATIONS = 5
export const MAX_DOMAINS = 40
export const MAX_SKILLS = 30

/**
 * Provisional TECHNICAL bounds against oversized payloads; not business
 * policy (no length is frozen in the Data SOT or API contract).
 */
export const TEXT_LIMITS = {
  full_name: 200,
  display_name: 200,
  headline: 200,
  bio: 2000,
  development_goal: 2000,
  current_need: 2000,
} as const

/** Provisional TECHNICAL bounds for the list fields (DEC-WF02-S02-D1/D3). */
export const LIST_LIMITS = {
  experience: 20,
  experience_text: 200,
  experience_description: 2000,
  links: 5,
  link_url: 500,
  link_label: 100,
} as const

type Ref = { id: string; label: string; status: VocabularyStatus }

/** `started_on` / `ended_on` are months, "YYYY-MM"; no end with a start means current. */
export type ExperienceDTO = {
  id: string
  title: string
  organization_name: string | null
  started_on: string | null
  ended_on: string | null
  description: string | null
}

export type OwnProfileDTO = {
  id: string | null
  status: string
  full_name: string | null
  display_name: string | null
  headline: string | null
  avatar: { asset_id: string; url: string } | null
  country: Ref | null
  region: Ref | null
  /** Private: only this DTO, read by the owner, carries it. */
  phone: string | null
  bio: string | null
  domains: Ref[]
  specializations: Ref[]
  skills: Ref[]
  education: { id: string; institution: string; programme: string | null }[]
  experience: ExperienceDTO[]
  /** Explicit NO_EXPERIENCE_YET (Freeze §D3 group 8), additive for WF02-S02. */
  no_experience_yet: boolean
  development_goal: string | null
  current_need: string | null
  links: { id: string; label: string | null; url: string }[]
  completion: { percent: number; completed_groups: number; total_groups: number }
}

type ProfileRow = {
  id: string
  status: string
  full_name: string | null
  display_name: string | null
  headline: string | null
  avatar_asset_id: string | null
  country_vocab_id: string | null
  region_vocab_id: string | null
  phone: string | null
  bio: string | null
  development_goal: string | null
  current_need: string | null
  no_experience_yet: boolean
}

async function refs(exec: Executor, table: string, profileId: string): Promise<Ref[]> {
  return exec<Ref>(
    `SELECT v.id::text, v.label, v.status::text AS status
       FROM ${table} r JOIN vocabulary_items v ON v.id = r.vocab_id
      WHERE r.profile_id = $1 ORDER BY v.sort_order, v.label`,
    [profileId],
  )
}

export async function getOwnProfile(
  accountId: string,
  exec: Executor = query,
): Promise<OwnProfileDTO> {
  const facts = await loadCompletionFacts(accountId, exec)
  const { percent, completed_groups, total_groups } = computeCompletion(facts)
  const completion = { percent, completed_groups, total_groups }

  const [row] = await exec<ProfileRow>(
    `SELECT id::text, status::text AS status, full_name, display_name, headline, avatar_asset_id,
            country_vocab_id::text, region_vocab_id::text, phone, bio, development_goal,
            current_need, no_experience_yet
       FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  if (!row) {
    return {
      id: null,
      status: 'NOT_CREATED',
      full_name: null,
      display_name: null,
      headline: null,
      avatar: null,
      country: null,
      region: null,
      phone: null,
      bio: null,
      domains: [],
      specializations: [],
      skills: [],
      education: [],
      experience: [],
      no_experience_yet: false,
      development_goal: null,
      current_need: null,
      links: [],
      completion,
    }
  }

  const item = async (id: string | null): Promise<Ref | null> => {
    if (!id) return null
    const [ref] = await exec<Ref>(
      `SELECT id::text, label, status::text AS status FROM vocabulary_items WHERE id = $1`,
      [id],
    )
    return ref ?? null
  }
  return {
    id: row.id,
    status: row.status,
    full_name: row.full_name,
    display_name: row.display_name,
    headline: row.headline,
    // Only a stored, owned asset is surfaced; the URL is derived, never stored.
    avatar:
      row.avatar_asset_id && facts?.avatar_valid
        ? { asset_id: row.avatar_asset_id, url: assetUrl(row.avatar_asset_id) }
        : null,
    country: await item(row.country_vocab_id),
    region: await item(row.region_vocab_id),
    phone: row.phone,
    bio: row.bio,
    domains: await refs(exec, 'profile_domains', row.id),
    specializations: await refs(exec, 'profile_specializations', row.id),
    skills: await refs(exec, 'profile_skills', row.id),
    education: await exec(
      `SELECT id::text, institution, programme FROM profile_education
        WHERE profile_id = $1 ORDER BY sort_order, created_at`,
      [row.id],
    ),
    experience: await exec<ExperienceDTO>(
      `SELECT id::text, title, organization_name, to_char(started_on, 'YYYY-MM') AS started_on,
              to_char(ended_on, 'YYYY-MM') AS ended_on, description
         FROM profile_experience
        WHERE profile_id = $1 ORDER BY sort_order, created_at`,
      [row.id],
    ),
    no_experience_yet: row.no_experience_yet,
    development_goal: row.development_goal,
    current_need: row.current_need,
    links: await exec(
      `SELECT id::text, label, url FROM profile_links
        WHERE profile_id = $1 ORDER BY sort_order, created_at`,
      [row.id],
    ),
    completion,
  }
}

const invalid = (field: string, reason: string, message = 'Profile validation failed.') =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, message, { [field]: reason })

type ExperiencePatch = {
  title: string
  organization_name: string | null
  /** Present only when the request carried the key; absent keys keep stored values. */
  started_on?: string | null
  ended_on?: string | null
  description?: string | null
}

type Patch = {
  full_name?: string | null
  display_name?: string | null
  headline?: string | null
  bio?: string | null
  development_goal?: string | null
  current_need?: string | null
  phone?: string | null
  country_id?: string | null
  region_id?: string | null
  domain_ids?: string[]
  specialization_ids?: string[]
  skill_ids?: string[]
  experience?: ExperiencePatch[]
  no_experience_yet?: boolean
  links?: { url: string; label: string | null }[]
}

/** Optional text inside a list item: trimmed, blank → null, bounded. */
function itemText(field: string, value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw invalid(field, 'invalid')
  const text = value.trim()
  if (text.length > max) throw invalid(field, 'too_long')
  return text || null
}

/** A month, "YYYY-MM", stored as its first day; null clears it. */
function month(field: string, value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(value)) {
    throw invalid(field, 'invalid_month')
  }
  return value
}

/** Digits with an optional leading "+", separators dropped; 8 to 15 digits (E.164 length). */
function phoneNumber(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw invalid('phone', 'invalid')
  const text = value.trim()
  if (!text) return null
  if (!/^\+?[\d\s().-]+$/.test(text)) throw invalid('phone', 'invalid')
  const digits = text.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) throw invalid('phone', 'invalid')
  return (text.startsWith('+') ? '+' : '') + digits
}

/** Only absolute http(s) URLs are stored (DEC-WF02-S02-D3). */
function linkUrl(value: unknown): string {
  if (typeof value !== 'string') throw invalid('links', 'invalid')
  const text = value.trim()
  if (!text || text.length > LIST_LIMITS.link_url) throw invalid('links', 'invalid_url')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw invalid('links', 'invalid_url')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw invalid('links', 'invalid_url')
  return text
}

const EXPERIENCE_KEYS = ['title', 'organization_name', 'started_on', 'ended_on', 'description']

/** Shape validation; no database access, so nothing can be half-written. */
export function parsePatch(body: unknown): Patch {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'invalid')
  }
  const input = body as Record<string, unknown>
  if ('completion_percent' in input) throw invalid('completion_percent', 'not_accepted')
  for (const key of Object.keys(input)) {
    if (!(PATCH_FIELDS as readonly string[]).includes(key)) throw invalid(key, 'not_supported')
  }

  const patch: Patch = {}
  for (const key of [
    'full_name',
    'display_name',
    'headline',
    'bio',
    'development_goal',
    'current_need',
  ] as const) {
    if (!(key in input)) continue
    const value = input[key]
    if (value !== null && typeof value !== 'string') throw invalid(key, 'invalid')
    const text = value?.trim() || null
    if (text && text.length > TEXT_LIMITS[key]) throw invalid(key, 'too_long')
    patch[key] = text
  }
  if ('phone' in input) patch.phone = phoneNumber(input.phone)
  for (const key of ['country_id', 'region_id'] as const) {
    if (!(key in input)) continue
    const value = input[key]
    if (value !== null && typeof value !== 'string') throw invalid(key, 'invalid')
    patch[key] = value || null
  }
  for (const key of ['domain_ids', 'specialization_ids', 'skill_ids'] as const) {
    if (!(key in input)) continue
    const value = input[key]
    if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
      throw invalid(key, 'invalid')
    }
    patch[key] = [...new Set(value.map((id) => id.toLowerCase()))]
  }
  if ('experience' in input) {
    const value = input.experience
    if (!Array.isArray(value)) throw invalid('experience', 'invalid')
    if (value.length > LIST_LIMITS.experience) throw invalid('experience', 'too_many')
    patch.experience = value.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw invalid('experience', 'invalid')
      }
      const entry = item as Record<string, unknown>
      for (const k of Object.keys(entry)) {
        if (!EXPERIENCE_KEYS.includes(k)) throw invalid('experience', 'invalid')
      }
      const title = itemText('experience', entry.title, LIST_LIMITS.experience_text)
      if (!title) throw invalid('experience', 'title_required')
      const record: ExperiencePatch = {
        title,
        organization_name: itemText(
          'experience',
          entry.organization_name,
          LIST_LIMITS.experience_text,
        ),
      }
      if ('started_on' in entry) record.started_on = month('experience', entry.started_on)
      if ('ended_on' in entry) record.ended_on = month('experience', entry.ended_on)
      if ('description' in entry) {
        record.description = itemText(
          'experience',
          entry.description,
          LIST_LIMITS.experience_description,
        )
      }
      // "YYYY-MM" compares as text; an end needs a start and cannot precede it.
      if (record.ended_on && (!record.started_on || record.ended_on < record.started_on)) {
        throw invalid('experience', 'invalid_period')
      }
      return record
    })
  }
  if ('no_experience_yet' in input) {
    if (typeof input.no_experience_yet !== 'boolean') throw invalid('no_experience_yet', 'invalid')
    patch.no_experience_yet = input.no_experience_yet
  }
  if ('links' in input) {
    const value = input.links
    if (!Array.isArray(value)) throw invalid('links', 'invalid')
    if (value.length > LIST_LIMITS.links) throw invalid('links', 'too_many')
    patch.links = value.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw invalid('links', 'invalid')
      }
      const entry = item as Record<string, unknown>
      for (const k of Object.keys(entry)) {
        if (k !== 'url' && k !== 'label') throw invalid('links', 'invalid')
      }
      return {
        url: linkUrl(entry.url),
        label: itemText('links', entry.label, LIST_LIMITS.link_label),
      }
    })
  }
  return patch
}

/**
 * Applies a partial update atomically: scalars and both relations commit
 * together or not at all, and every vocabulary id is checked before the first
 * write. Never changes status or onboarding completion (DEC-WF01-S06-D2).
 */
export async function updateOwnProfile(accountId: string, body: unknown): Promise<OwnProfileDTO> {
  const patch = parsePatch(body)

  return withTransaction(async (exec) => {
    const [current] = await exec<{
      id: string
      status: string
      country_vocab_id: string | null
      region_vocab_id: string | null
      onboarded: boolean
      no_experience_yet: boolean
      experience_count: number
    }>(
      `SELECT id::text, status::text AS status, country_vocab_id::text, region_vocab_id::text,
              onboarding_completed_at IS NOT NULL AS onboarded, no_experience_yet,
              (SELECT count(*)::int FROM profile_experience e WHERE e.profile_id = p.id) AS experience_count
         FROM individual_profiles p WHERE account_id = $1 FOR UPDATE`,
      [accountId],
    )
    const before = computeCompletion(await loadCompletionFacts(accountId, exec)).percent
    if (current?.status === 'DEACTIVATED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'Profile is deactivated.')
    }
    // DEC-WF02-S02-D4: an ACTIVE profile keeps its activation minimum (Freeze §D3).
    if (current?.status === 'ACTIVE') {
      if ('display_name' in patch && !patch.display_name) throw invalid('display_name', 'required')
      if ('region_id' in patch && !patch.region_id) throw invalid('region_id', 'required')
    }
    const linked = async (table: string) =>
      current
        ? (
            await exec<{ id: string }>(
              `SELECT vocab_id::text AS id FROM ${table} WHERE profile_id = $1`,
              [current.id],
            )
          ).map((r) => r.id)
        : []
    const domains = await linked('profile_domains')
    const specializations = await linked('profile_specializations')
    const skills = await linked('profile_skills')

    if (patch.country_id) {
      const keep = new Set(current?.country_vocab_id ? [current.country_vocab_id] : [])
      await assertSelectable(exec, 'country_id', 'COUNTRY', [patch.country_id.toLowerCase()], keep)
    }
    if (patch.region_id) {
      const keep = new Set(current?.region_vocab_id ? [current.region_vocab_id] : [])
      await assertSelectable(exec, 'region_id', 'REGION', [patch.region_id.toLowerCase()], keep)
    }
    if (patch.domain_ids) {
      await assertSelectable(exec, 'domain_ids', 'DOMAIN', patch.domain_ids, new Set(domains))
    }
    if (patch.specialization_ids) {
      await assertSelectable(
        exec,
        'specialization_ids',
        'SPECIALIZATION',
        patch.specialization_ids,
        new Set(specializations),
      )
    }
    if (patch.skill_ids) {
      await assertSelectable(exec, 'skill_ids', 'SKILL', patch.skill_ids, new Set(skills))
    }
    for (const [field, max] of [
      ['domain_ids', MAX_DOMAINS],
      ['specialization_ids', MAX_SPECIALIZATIONS],
      ['skill_ids', MAX_SKILLS],
    ] as const) {
      if ((patch[field]?.length ?? 0) > max) throw invalid(field, 'too_many')
    }

    // DEC-WF02-S02-D1: experience records and NO_EXPERIENCE_YET never coexist.
    const experienceAfter = patch.experience?.length ?? current?.experience_count ?? 0
    const noneAfter = patch.no_experience_yet ?? current?.no_experience_yet ?? false
    if (experienceAfter > 0 && noneAfter) {
      throw invalid('no_experience_yet', 'conflicts_with_experience')
    }

    // All checks passed: write. A new account gets its DRAFT profile here.
    const [profile] = current
      ? [current]
      : await exec<{ id: string }>(
          `INSERT INTO individual_profiles (account_id) VALUES ($1)
           ON CONFLICT (account_id) DO UPDATE SET updated_at = now()
           RETURNING id::text`,
          [accountId],
        )
    const columns: string[] = []
    const values: unknown[] = []
    const set = (column: string, value: unknown) => {
      values.push(value)
      columns.push(`${column} = $${values.length + 1}`)
    }
    if ('full_name' in patch) set('full_name', patch.full_name)
    if ('display_name' in patch) set('display_name', patch.display_name)
    if ('phone' in patch) set('phone', patch.phone)
    if ('headline' in patch) set('headline', patch.headline)
    if ('bio' in patch) set('bio', patch.bio)
    if ('development_goal' in patch) set('development_goal', patch.development_goal)
    if ('current_need' in patch) set('current_need', patch.current_need)
    if ('no_experience_yet' in patch) set('no_experience_yet', patch.no_experience_yet)
    if ('country_id' in patch) set('country_vocab_id', patch.country_id?.toLowerCase() ?? null)
    if ('region_id' in patch) set('region_vocab_id', patch.region_id?.toLowerCase() ?? null)
    await exec(
      `UPDATE individual_profiles SET ${[...columns, 'updated_at = now()'].join(', ')}
        WHERE id = $1`,
      [profile!.id, ...values],
    )
    for (const [table, ids] of [
      ['profile_domains', patch.domain_ids],
      ['profile_specializations', patch.specialization_ids],
      ['profile_skills', patch.skill_ids],
    ] as const) {
      if (!ids) continue
      await exec(
        `DELETE FROM ${table} WHERE profile_id = $1 AND NOT (vocab_id = ANY($2::uuid[]))`,
        [profile!.id, ids],
      )
      await exec(
        `INSERT INTO ${table} (profile_id, vocab_id)
         SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [profile!.id, ids],
      )
    }
    // Lists are replaced as a whole, in the given order.
    if (patch.experience) {
      // A record sent without period or description (the WF02-S02 editor) keeps
      // what the same title and organisation already stored.
      const stored = await exec<{
        title: string
        organization_name: string | null
        started_on: string | null
        ended_on: string | null
        description: string | null
      }>(
        `SELECT title, organization_name, to_char(started_on, 'YYYY-MM') AS started_on,
                to_char(ended_on, 'YYYY-MM') AS ended_on, description
           FROM profile_experience WHERE profile_id = $1 ORDER BY sort_order, created_at`,
        [profile!.id],
      )
      await exec('DELETE FROM profile_experience WHERE profile_id = $1', [profile!.id])
      for (const [i, item] of patch.experience.entries()) {
        const kept = stored.find(
          (row) => row.title === item.title && row.organization_name === item.organization_name,
        )
        const pick = <K extends 'started_on' | 'ended_on' | 'description'>(key: K) =>
          key in item ? (item[key] ?? null) : (kept?.[key] ?? null)
        await exec(
          `INSERT INTO profile_experience
             (profile_id, title, organization_name, started_on, ended_on, description, sort_order)
           VALUES ($1, $2, $3, to_date($4, 'YYYY-MM'), to_date($5, 'YYYY-MM'), $6, $7)`,
          [
            profile!.id,
            item.title,
            item.organization_name,
            pick('started_on'),
            pick('ended_on'),
            pick('description'),
            i,
          ],
        )
      }
    }
    if (patch.links) {
      await exec('DELETE FROM profile_links WHERE profile_id = $1', [profile!.id])
      for (const [i, item] of patch.links.entries()) {
        await exec(
          `INSERT INTO profile_links (profile_id, label, url, sort_order) VALUES ($1, $2, $3, $4)`,
          [profile!.id, item.label, item.url, i],
        )
      }
    }
    const dto = await getOwnProfile(accountId, exec)
    await trackCompletionChange(exec, {
      accountId,
      profileId: profile!.id,
      from: before,
      to: dto.completion.percent,
      onboarded: current?.onboarded ?? false,
    })
    return dto
  })
}
