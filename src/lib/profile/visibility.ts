import { ApiError } from '@/lib/api/errors'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { writeAudit } from '@/lib/audit/audit'

/**
 * Profile visibility — GET/PUT /me/visibility (05 §4.5; DEC-WF01-S07-D2/D4/D8).
 *
 * P0 freezes one group, PROFILE_DISCOVERY (display name, avatar, headline,
 * bio, domain and region — DEC-WF01-S07-D2A), settable to NETWORK_ONLY or
 * PRIVATE. Storage is the existing profile_visibility_settings row:
 * `default_level` (NETWORK_ONLY) plus a `group_overrides` map of group code →
 * level holding only departures from the default. No row means every group
 * is at the default. Visibility is never consent: nothing here touches
 * consent_records.
 */

export const VISIBILITY_GROUPS = ['PROFILE_DISCOVERY'] as const
export type VisibilityGroup = (typeof VISIBILITY_GROUPS)[number]

export type VisibilityLevel =
  'PUBLIC' | 'NETWORK_ONLY' | 'PROGRAMME_ACCESS' | 'GRANTED_ACCESS' | 'PRIVATE'

/** The P0 subset each group may take (D2). PUBLIC is not offered in P0. */
export const ALLOWED_LEVELS: Record<VisibilityGroup, readonly VisibilityLevel[]> = {
  PROFILE_DISCOVERY: ['NETWORK_ONLY', 'PRIVATE'],
}

export const DEFAULT_LEVEL: VisibilityLevel = 'NETWORK_ONLY'

export type VisibilityDTO = { groups: { group_code: VisibilityGroup; level: VisibilityLevel }[] }

type SettingsRow = { default_level: VisibilityLevel; group_overrides: Record<string, string> }

function effective(row: SettingsRow | undefined): Record<VisibilityGroup, VisibilityLevel> {
  const out = {} as Record<VisibilityGroup, VisibilityLevel>
  for (const group of VISIBILITY_GROUPS) {
    out[group] =
      (row?.group_overrides?.[group] as VisibilityLevel | undefined) ??
      row?.default_level ??
      DEFAULT_LEVEL
  }
  return out
}

async function readSettings(exec: Executor, profileId: string): Promise<SettingsRow | undefined> {
  const [row] = await exec<SettingsRow>(
    `SELECT default_level::text AS default_level, group_overrides
       FROM profile_visibility_settings WHERE profile_id = $1`,
    [profileId],
  )
  return row
}

const toDTO = (levels: Record<VisibilityGroup, VisibilityLevel>): VisibilityDTO => ({
  groups: VISIBILITY_GROUPS.map((group_code) => ({ group_code, level: levels[group_code] })),
})

/** Effective level of every P0 group for the account's own profile. */
export async function getVisibility(accountId: string): Promise<VisibilityDTO> {
  const [profile] = await query<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  return toDTO(effective(profile ? await readSettings(query, profile.id) : undefined))
}

/** Effective PROFILE_DISCOVERY of the profile owned by an account (media authorisation, D5). */
export async function discoveryLevelOf(ownerAccountId: string): Promise<VisibilityLevel> {
  const [profile] = await query<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [ownerAccountId],
  )
  return effective(profile ? await readSettings(query, profile.id) : undefined).PROFILE_DISCOVERY
}

/**
 * Effective PROFILE_DISCOVERY of many profiles in one read (WF03-S03 ops lists).
 * Same rule as `discoveryLevelOf`: override, then default level, then
 * NETWORK_ONLY when no settings row exists.
 */
export async function discoveryLevelsOf(
  exec: Executor,
  profileIds: readonly string[],
): Promise<Map<string, VisibilityLevel>> {
  const rows = profileIds.length
    ? await exec<SettingsRow & { profile_id: string }>(
        `SELECT profile_id::text, default_level::text AS default_level, group_overrides
           FROM profile_visibility_settings WHERE profile_id = ANY($1::uuid[])`,
        [profileIds],
      )
    : []
  const byId = new Map(rows.map((r) => [r.profile_id, r]))
  return new Map(profileIds.map((id) => [id, effective(byId.get(id)).PROFILE_DISCOVERY]))
}

const invalid = (reason: string) =>
  new ApiError('VISIBILITY_VALIDATION_FAILED', 422, 'Unsupported visibility setting.', {
    groups: reason,
  })

/** Validates `{ groups: [{ group_code, level }] }` against the P0 allowlist. */
export function parseVisibility(body: unknown): Map<VisibilityGroup, VisibilityLevel> {
  const groups = (body as { groups?: unknown } | null)?.groups
  if (!Array.isArray(groups) || groups.length === 0) throw invalid('invalid')
  const out = new Map<VisibilityGroup, VisibilityLevel>()
  for (const entry of groups) {
    const { group_code, level } = (entry ?? {}) as { group_code?: unknown; level?: unknown }
    if (!(VISIBILITY_GROUPS as readonly unknown[]).includes(group_code)) {
      throw invalid('unknown_group')
    }
    const group = group_code as VisibilityGroup
    if (!(ALLOWED_LEVELS[group] as readonly unknown[]).includes(level)) {
      throw invalid('unsupported_level')
    }
    if (out.has(group)) throw invalid('duplicate_group')
    out.set(group, level as VisibilityLevel)
  }
  return out
}

/**
 * PUT /me/visibility for the session's own profile. Overrides equal to the
 * default are removed rather than stored (D4). A change writes
 * PROFILE_VISIBILITY_CHANGED with the group levels before and after.
 */
export async function putVisibility(
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<VisibilityDTO> {
  const requested = parseVisibility(body)

  return withTransaction(async (exec) => {
    const [profile] = await exec<{ id: string }>(
      `INSERT INTO individual_profiles (account_id) VALUES ($1)
       ON CONFLICT (account_id) DO UPDATE SET updated_at = individual_profiles.updated_at
       RETURNING id::text`,
      [accountId],
    )
    const current = await readSettings(exec, profile!.id)
    const before = effective(current)
    const defaultLevel = current?.default_level ?? DEFAULT_LEVEL
    const overrides: Record<string, string> = { ...(current?.group_overrides ?? {}) }
    for (const [group, level] of requested) {
      if (level === defaultLevel) delete overrides[group]
      else overrides[group] = level
    }
    await exec(
      `INSERT INTO profile_visibility_settings (profile_id, group_overrides)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (profile_id) DO UPDATE
         SET group_overrides = EXCLUDED.group_overrides, updated_at = now()`,
      [profile!.id, JSON.stringify(overrides)],
    )
    const after = effective({ default_level: defaultLevel, group_overrides: overrides })
    if (VISIBILITY_GROUPS.some((g) => before[g] !== after[g])) {
      await writeAudit(exec, {
        actorAccountId: accountId,
        action: 'PROFILE_VISIBILITY_CHANGED',
        resourceType: 'individual_profile',
        resourceId: profile!.id,
        before,
        after,
        requestId,
      })
    }
    return toDTO(after)
  })
}
