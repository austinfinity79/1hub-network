import { notFound } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { can, require as requireCapability } from '@/lib/authz/authorize'
import type { Capability } from '@/lib/authz/matrix'
import { query } from '@/lib/db/client'
import { isAssetId, readAssetMeta } from '@/lib/media/avatar-storage'
import { toSourceType, type SourceType } from '@/lib/network/network'
import { canSeeDiscovery, projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { OPS_ORGANIZATION_TYPES, type OrganizationRefDTO } from './organizations'

/**
 * WF03-S04 — member detail for organization operations
 * (API 05 §8.3 `GET …/members/{profileId}`, DEC-WF03-G3/G4/G5/G6).
 *
 * The person's relationship with THIS organization: every CommunityMembership
 * and LeadershipRecord row (history kept, nothing merged), identity only
 * through the PROFILE_DISCOVERY projection for a network viewer (no ops
 * bypass), and the consent summary operations need (API §8.3): whether the
 * person's discovery card is visible — read-only, never content. Nothing else:
 * no email, account, bio, consent records, RoleAssignment or audit data.
 *
 * Reachable only for a person related to the organization; anyone else is the
 * same 404, so the route cannot probe profiles.
 */

export type MembershipRecordDTO = {
  id: string
  state: string
  source_type: SourceType | null
  requested_at: string
  started_at: string | null
  ended_at: string | null
}

export type LeadershipRecordDTO = {
  id: string
  title: string
  state: string
  started_at: string
  ended_at: string | null
}

export type OpsMemberDetailDTO = {
  organization: OrganizationRefDTO
  profile_id: string
  profile: { display_name?: string; avatar_url?: string; headline?: string } | null
  /** The open membership (PENDING_APPROVAL / ACTIVE), else the latest one. */
  membership: MembershipRecordDTO | null
  memberships: MembershipRecordDTO[]
  leadership: LeadershipRecordDTO[]
  consent_summary: { discovery_visible: boolean }
  /** The actor's mutation capabilities here (display only; every call re-authorizes). */
  permissions: Capability[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

export async function operationalOrganization(orgId: string): Promise<OrganizationRefDTO> {
  if (!UUID.test(orgId)) throw notFound()
  const [org] = await query<OrganizationRefDTO>(
    `SELECT id::text, slug, name, type::text AS type FROM organizations
      WHERE id = $1 AND type::text = ANY($2::text[])`,
    [orgId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!org) throw notFound()
  return org
}

export async function getMemberDetail(
  accountId: string,
  orgId: string,
  profileId: string,
): Promise<OpsMemberDetailDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'member:read', { scopeType: 'ORGANIZATION', scopeId: orgId })
  const org = await operationalOrganization(orgId)
  if (!UUID.test(profileId)) throw notFound()

  const memberships = await query<{
    id: string
    state: string
    source: string | null
    created_at: Date
    started_at: Date | null
    ended_at: Date | null
  }>(
    `SELECT id::text, state::text AS state, source, created_at, started_at, ended_at
       FROM community_memberships
      WHERE organization_id = $1 AND profile_id = $2
      ORDER BY created_at DESC, id`,
    [org.id, profileId],
  )
  const leadership = await query<{
    id: string
    title: string
    state: string
    started_at: Date
    ended_at: Date | null
  }>(
    `SELECT id::text, role_label AS title, state::text AS state, started_at, ended_at
       FROM leadership_records
      WHERE organization_id = $1 AND profile_id = $2
      ORDER BY started_at DESC, id`,
    [org.id, profileId],
  )
  if (memberships.length === 0 && leadership.length === 0) throw notFound()

  const [p] = await query<{
    account_id: string
    display_name: string | null
    avatar_asset_id: string | null
    headline: string | null
  }>(
    `SELECT account_id::text, display_name, avatar_asset_id, headline
       FROM individual_profiles WHERE id = $1`,
    [profileId],
  )
  if (!p) throw notFound()
  const level = (await discoveryLevelsOf(query, [profileId])).get(profileId) ?? 'NETWORK_ONLY'
  const projected = projectDiscovery(
    {
      profile_id: profileId,
      display_name: p.display_name,
      avatar_asset_id: null,
      headline: p.headline,
      bio: null,
      domain_ids: [],
      region_id: null,
    },
    level,
    'NETWORK',
  )
  let profile: OpsMemberDetailDTO['profile'] = null
  if (projected) {
    profile = {}
    if (projected.display_name) profile.display_name = projected.display_name
    if (projected.headline) profile.headline = projected.headline
    if (isAssetId(p.avatar_asset_id)) {
      const meta = await readAssetMeta(p.avatar_asset_id)
      if (meta?.owner_account_id === p.account_id) {
        profile.avatar_url = `/media/assets/${p.avatar_asset_id}`
      }
    }
  }

  const records: MembershipRecordDTO[] = memberships.map((m) => ({
    id: m.id,
    state: m.state,
    source_type: toSourceType(m.source),
    requested_at: iso(m.created_at)!,
    started_at: iso(m.started_at),
    ended_at: iso(m.ended_at),
  }))
  const current =
    records.find((m) => m.state === 'PENDING_APPROVAL' || m.state === 'ACTIVE') ??
    records[0] ??
    null

  const permissions: Capability[] = []
  for (const c of ['membership:confirm', 'leadership:manage'] as const) {
    if (await can(actor, c, { scopeType: 'ORGANIZATION', scopeId: org.id })) permissions.push(c)
  }
  return {
    organization: org,
    profile_id: profileId,
    profile,
    membership: current,
    memberships: records,
    leadership: leadership.map((l) => ({
      id: l.id,
      title: l.title,
      state: l.state,
      started_at: iso(l.started_at)!,
      ended_at: iso(l.ended_at),
    })),
    consent_summary: { discovery_visible: canSeeDiscovery(level, 'NETWORK') },
    permissions,
  }
}
