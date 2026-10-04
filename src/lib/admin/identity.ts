import type { Executor } from '@/lib/db/client'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

/**
 * Display names as a network viewer sees them (PROFILE_DISCOVERY; no ops bypass,
 * the WF03 rule): a hidden profile is null. Never an e-mail, phone or full name.
 */
export async function discoveryNames(
  exec: Executor,
  profileIds: readonly (string | null)[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(profileIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map()
  const rows = await exec<{ id: string; display_name: string | null }>(
    `SELECT id::text, display_name FROM individual_profiles WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  const levels = await discoveryLevelsOf(exec, ids)
  return new Map(
    rows.map((r) => [
      r.id,
      projectDiscovery(
        {
          profile_id: r.id,
          display_name: r.display_name,
          avatar_asset_id: null,
          headline: null,
          bio: null,
          domain_ids: [],
          region_id: null,
        },
        levels.get(r.id) ?? 'NETWORK_ONLY',
        'NETWORK',
      )?.display_name ?? null,
    ]),
  )
}
