import type { VisibilityLevel } from './visibility'

/**
 * WF02-T00 — network projection of an IndividualProfile (PROFILE_DISCOVERY).
 *
 * The one place that decides which discovery fields another viewer may see,
 * for later WF02 surfaces. It is a pure whitelist: the output is built field by
 * field from the D2A list, so any other property on the input (email, phone,
 * account, metadata) can never pass through. Hidden fields are ABSENT, not
 * null (05 §11.4).
 *
 * P0 rules (DEC-WF01-S07-D2/D2A/D5, DEC-WF02-H3):
 * - the OWNER sees every discovery field;
 * - a signed-in NETWORK viewer sees them only while PROFILE_DISCOVERY is
 *   NETWORK_ONLY (or wider, matching the media rule); PRIVATE hides them all;
 * - a GUEST sees nothing: P0 has no public profile, and PUBLIC is not offered.
 *
 * No route uses this yet (`GET /profiles/{id}` stays unimplemented); WF06 owns
 * directory and matching.
 */

export type ViewerRelation = 'OWNER' | 'NETWORK' | 'GUEST'

/** The PROFILE_DISCOVERY fields (DEC-WF01-S07-D2A). */
export type DiscoverySource = {
  profile_id: string
  display_name: string | null
  avatar_asset_id: string | null
  headline: string | null
  bio: string | null
  domain_ids: readonly string[]
  region_id: string | null
}

export type DiscoveryProjection = {
  profile_id: string
  display_name?: string
  avatar_url?: string
  headline?: string
  bio?: string
  domain_ids?: string[]
  region_id?: string
}

const WIDE_ENOUGH: readonly VisibilityLevel[] = ['NETWORK_ONLY', 'PUBLIC']

export function canSeeDiscovery(level: VisibilityLevel, viewer: ViewerRelation): boolean {
  if (viewer === 'OWNER') return true
  if (viewer === 'GUEST') return false
  return WIDE_ENOUGH.includes(level)
}

/** Null when the viewer may not see the profile's discovery card at all. */
export function projectDiscovery(
  source: DiscoverySource,
  level: VisibilityLevel,
  viewer: ViewerRelation,
): DiscoveryProjection | null {
  if (!canSeeDiscovery(level, viewer)) return null

  const out: DiscoveryProjection = { profile_id: source.profile_id }
  if (source.display_name) out.display_name = source.display_name
  // Served through the authorised media route only (DEC-WF01-S07-D5).
  if (source.avatar_asset_id) out.avatar_url = `/media/assets/${source.avatar_asset_id}`
  if (source.headline) out.headline = source.headline
  if (source.bio) out.bio = source.bio
  if (source.domain_ids.length > 0) out.domain_ids = [...source.domain_ids]
  if (source.region_id) out.region_id = source.region_id
  return out
}
