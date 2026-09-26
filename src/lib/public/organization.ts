import { notFound } from '@/lib/api/errors'
import { query } from '@/lib/db/client'
import { childrenOf, parentsOf } from '@/lib/ops/hierarchy'
import { OPS_ORGANIZATION_TYPES } from '@/lib/ops/organizations'

/**
 * WF03-S09 — public organization projection (API 05 §8.5
 * `GET /organizations/by-slug/{slug}`, DEC-WF03-G9/G10/G13, DEC-WF03-S09-D1..D4).
 *
 * One projection for every caller: a guest and a signed-in member get the same
 * DTO (no richer view on login, no ops data). Only PUBLISHED HUB / CHAPTER /
 * CLB organizations exist here; anything else is the same 404, so hidden
 * records cannot be probed.
 *
 * Content: name, type, description; the canonical parent and direct children
 * (G9 reader, PUBLISHED ones only); aggregate counts with named queries; the
 * organization's upcoming PUBLISHED standalone events (never DRAFT, cancelled
 * or programme-linked). No person is rendered: PROFILE_DISCOVERY is never
 * visible to a guest (DEC-WF01-S07-D2), so membership and leadership never
 * surface an IndividualProfile here. No ids of accounts or profiles, no
 * metadata, no membership state or provenance.
 */

export type PublicOrganizationRef = { slug: string; name: string; type: string }

export type PublicEventDTO = {
  name: string
  summary: string | null
  starts_at: string | null
  ends_at: string | null
  location_text: string | null
}

export type PublicOrganizationDTO = PublicOrganizationRef & {
  description: string | null
  parent: PublicOrganizationRef | null
  children: Array<
    PublicOrganizationRef & { stats: { active_members: number; public_events: number } }
  >
  /**
   * - active_members  community_memberships  state = ACTIVE
   * - public_events   events                 programme_id IS NULL AND status = PUBLISHED
   * - children        organization_relationships  ACTIVE PARENT children that are PUBLISHED
   */
  stats: { active_members: number; public_events: number; children: number }
  upcoming_events: PublicEventDTO[]
}

const UPCOMING_LIMIT = 6

type OrgRow = PublicOrganizationRef & { id: string; description: string | null }

async function publishedOrgs(ids: string[]): Promise<Map<string, OrgRow>> {
  if (ids.length === 0) return new Map()
  const rows = await query<OrgRow>(
    `SELECT id::text, slug, name, type::text AS type, description FROM organizations
      WHERE id = ANY($1::uuid[]) AND status = 'PUBLISHED' AND type::text = ANY($2::text[])`,
    [ids, [...OPS_ORGANIZATION_TYPES]],
  )
  return new Map(rows.map((r) => [r.id, r]))
}

async function counts(ids: string[]) {
  const rows = await query<{ id: string; members: number; events: number }>(
    `SELECT o.id::text,
            (SELECT count(*)::int FROM community_memberships m
              WHERE m.organization_id = o.id AND m.state = 'ACTIVE') AS members,
            (SELECT count(*)::int FROM events e
              WHERE e.organization_id = o.id AND e.programme_id IS NULL AND e.status = 'PUBLISHED') AS events
       FROM organizations o WHERE o.id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, { active_members: r.members, public_events: r.events }]))
}

const ref = (o: OrgRow): PublicOrganizationRef => ({ slug: o.slug, name: o.name, type: o.type })
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null)

export async function getPublicOrganization(slug: string): Promise<PublicOrganizationDTO> {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) throw notFound()
  const [org] = await query<OrgRow>(
    `SELECT id::text, slug, name, type::text AS type, description FROM organizations
      WHERE slug = $1 AND status = 'PUBLISHED' AND type::text = ANY($2::text[])`,
    [slug, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!org) throw notFound()

  const link = (await parentsOf(query, [org.id])).get(org.id)
  const parentId = link?.kind === 'PARENT' ? link.parentId : null
  const childIds = await childrenOf(query, org.id)
  const visible = await publishedOrgs([...(parentId ? [parentId] : []), ...childIds])
  const children = childIds
    .map((id) => visible.get(id))
    .filter((c): c is OrgRow => Boolean(c))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const stats = await counts([org.id, ...children.map((c) => c.id)])

  const events = await query<{
    name: string
    summary: string | null
    starts_at: Date | null
    ends_at: Date | null
    location_text: string | null
  }>(
    `SELECT name, summary, starts_at, ends_at, location_text FROM events
      WHERE organization_id = $1 AND programme_id IS NULL AND status = 'PUBLISHED'
        AND COALESCE(ends_at, starts_at) >= now()
      ORDER BY starts_at ASC, id
      LIMIT $2`,
    [org.id, UPCOMING_LIMIT],
  )

  const own = stats.get(org.id) ?? { active_members: 0, public_events: 0 }
  return {
    ...ref(org),
    description: org.description,
    parent: parentId && visible.get(parentId) ? ref(visible.get(parentId)!) : null,
    children: children.map((c) => ({
      ...ref(c),
      stats: stats.get(c.id) ?? { active_members: 0, public_events: 0 },
    })),
    stats: { ...own, children: children.length },
    upcoming_events: events.map((e) => ({
      name: e.name,
      summary: e.summary,
      starts_at: iso(e.starts_at),
      ends_at: iso(e.ends_at),
      location_text: e.location_text,
    })),
  }
}
