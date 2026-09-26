import { notFound } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { require as requireCapability } from '@/lib/authz/authorize'
import { query } from '@/lib/db/client'
import { isAssetId, readAssetMeta } from '@/lib/media/avatar-storage'
import { toSourceType, type SourceType } from '@/lib/network/network'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { OPS_ORGANIZATION_TYPES } from './organizations'

/**
 * WF03-S03 — organization members, a read-only relationship view
 * (API 05 §8.3, DEC-WF03-G3/G4/G5/G6).
 *
 * One row per person related to the organization through a CommunityMembership
 * and/or a LeadershipRecord. The records stay separate: the row carries the
 * person's open membership (else the latest), in its frozen state with its
 * provenance, and the person's ACTIVE leadership titles. Nothing is merged,
 * promoted or inferred, and no RoleAssignment or capability is read.
 *
 * Identity comes only through the PROFILE_DISCOVERY projection for a NETWORK
 * viewer, exactly as for any other signed-in member (G4: ops gets no
 * visibility bypass, PLATFORM_ADMIN included). A PRIVATE profile appears with
 * `profile: null` — the relationship facts stay, the identity does not. Search
 * matches visible names only, so it cannot probe hidden ones. Never returned:
 * email, phone, account id, bio, consent content, audit data, metadata.
 */

export const MEMBERSHIP_STATES = [
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'ALUMNI',
  'WITHDRAWN',
  'REJECTED',
] as const
export const LEADERSHIP_STATES = ['ACTIVE', 'ALUMNI', 'REVOKED'] as const

export type OpsMemberSummaryDTO = {
  profile_id: string
  /** Null when PROFILE_DISCOVERY hides the person from a network viewer. */
  profile: { display_name?: string; avatar_url?: string; headline?: string } | null
  membership: { state: string; source_type: SourceType | null; since: string | null } | null
  /** ACTIVE leadership titles only; display text, never a permission (G6). */
  leadership: { title: string; state: string }[]
}

export type MemberListParams = {
  q?: string
  membership_status?: string
  leadership_status?: string
  cursor?: string
  limit: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type MembershipRow = {
  profile_id: string
  state: string
  source: string | null
  started_at: Date | null
  created_at: Date
}

const day = (value: Date | null) =>
  value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value) : null

/** Opaque offset cursor; an unusable one starts from the first page (parseListQuery convention). */
const encodeCursor = (offset: number) =>
  Buffer.from(JSON.stringify({ o: offset })).toString('base64url')
function decodeCursor(raw: string | undefined): number {
  if (!raw) return 0
  try {
    const { o } = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { o: unknown }
    return Number.isInteger(o) && (o as number) >= 0 ? (o as number) : 0
  } catch {
    return 0
  }
}

export async function listOrganizationMembers(
  accountId: string,
  orgId: string,
  params: MemberListParams,
): Promise<{ items: OpsMemberSummaryDTO[]; nextCursor: string | null }> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'member:read', { scopeType: 'ORGANIZATION', scopeId: orgId })
  if (!UUID.test(orgId)) throw notFound()
  const [org] = await query<{ id: string }>(
    `SELECT id::text FROM organizations WHERE id = $1 AND type::text = ANY($2::text[])`,
    [orgId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!org) throw notFound()

  // The open membership (PENDING_APPROVAL / ACTIVE, unique per person) wins,
  // otherwise the most recent one: one membership fact per person.
  const memberships = await query<MembershipRow>(
    `SELECT DISTINCT ON (profile_id)
            profile_id::text, state::text AS state, source, started_at, created_at
       FROM community_memberships
      WHERE organization_id = $1
      ORDER BY profile_id, (state IN ('PENDING_APPROVAL', 'ACTIVE')) DESC, created_at DESC, id`,
    [org.id],
  )
  const leadership = await query<{ profile_id: string; title: string; state: string }>(
    `SELECT profile_id::text, role_label AS title, state::text AS state
       FROM leadership_records
      WHERE organization_id = $1 AND state = 'ACTIVE'
      ORDER BY started_at, id`,
    [org.id],
  )
  // A person tied only by closed leadership still appears (history is kept).
  const closedLeaders = await query<{ profile_id: string; state: string }>(
    `SELECT DISTINCT profile_id::text, state::text AS state FROM leadership_records
      WHERE organization_id = $1 AND state <> 'ACTIVE'`,
    [org.id],
  )
  const leadershipStates = new Map<string, Set<string>>()
  for (const l of [...leadership, ...closedLeaders]) {
    leadershipStates.set(
      l.profile_id,
      (leadershipStates.get(l.profile_id) ?? new Set()).add(l.state),
    )
  }
  const people = [
    ...new Set([
      ...memberships.map((m) => m.profile_id),
      ...leadership.map((l) => l.profile_id),
      ...closedLeaders.map((l) => l.profile_id),
    ]),
  ]
  if (people.length === 0) return { items: [], nextCursor: null }

  const profiles = await query<{
    id: string
    account_id: string
    display_name: string | null
    avatar_asset_id: string | null
    headline: string | null
  }>(
    `SELECT id::text, account_id::text, display_name, avatar_asset_id, headline
       FROM individual_profiles WHERE id = ANY($1::uuid[])`,
    [people],
  )
  const levels = await discoveryLevelsOf(query, people)
  const byProfile = new Map(profiles.map((p) => [p.id, p]))
  const membershipOf = new Map(memberships.map((m) => [m.profile_id, m]))
  const titlesOf = new Map<string, { title: string; state: string }[]>()
  for (const l of leadership) {
    titlesOf.set(l.profile_id, [
      ...(titlesOf.get(l.profile_id) ?? []),
      { title: l.title, state: l.state },
    ])
  }

  const rows: OpsMemberSummaryDTO[] = []
  for (const id of people) {
    const p = byProfile.get(id)
    if (!p) continue
    const projected = projectDiscovery(
      {
        profile_id: p.id,
        display_name: p.display_name,
        avatar_asset_id: null,
        headline: p.headline,
        bio: null,
        domain_ids: [],
        region_id: null,
      },
      levels.get(id) ?? 'NETWORK_ONLY',
      'NETWORK',
    )
    let profile: OpsMemberSummaryDTO['profile'] = null
    if (projected) {
      profile = {}
      if (projected.display_name) profile.display_name = projected.display_name
      if (projected.headline) profile.headline = projected.headline
      // Only a stored avatar of this owner, served by the authorised media route.
      if (isAssetId(p.avatar_asset_id)) {
        const meta = await readAssetMeta(p.avatar_asset_id)
        if (meta?.owner_account_id === p.account_id) {
          profile.avatar_url = `/media/assets/${p.avatar_asset_id}`
        }
      }
    }
    const m = membershipOf.get(id)
    rows.push({
      profile_id: id,
      profile,
      membership: m
        ? {
            state: m.state,
            source_type: toSourceType(m.source),
            since: day(
              m.state === 'PENDING_APPROVAL' ? m.created_at : (m.started_at ?? m.created_at),
            ),
          }
        : null,
      leadership: titlesOf.get(id) ?? [],
    })
  }

  // Filters (API §8.3). Unknown values match nothing; search sees visible names only.
  const q = params.q?.trim().toLowerCase().slice(0, 100) || null
  const filtered = rows.filter((r) => {
    if (params.membership_status && r.membership?.state !== params.membership_status) return false
    if (
      params.leadership_status &&
      !leadershipStates.get(r.profile_id)?.has(params.leadership_status)
    )
      return false
    if (q && !r.profile?.display_name?.toLowerCase().includes(q)) return false
    return true
  })
  // Alphabetical by visible name; hidden identities last; profile id breaks ties.
  filtered.sort((a, b) => {
    const na = a.profile?.display_name
    const nb = b.profile?.display_name
    if (na && nb) return na.localeCompare(nb, 'vi') || a.profile_id.localeCompare(b.profile_id)
    if (na || nb) return na ? -1 : 1
    return a.profile_id.localeCompare(b.profile_id)
  })

  const offset = decodeCursor(params.cursor)
  const page = filtered.slice(offset, offset + params.limit)
  return {
    items: page,
    nextCursor:
      offset + params.limit < filtered.length ? encodeCursor(offset + params.limit) : null,
  }
}
