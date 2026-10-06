import { query } from '@/lib/db/client'
import { DEMO_FOUNDERS, demoFounder, founderHref, type DemoFounder } from '@/lib/demo-0710/founders'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { STAGE_SHORT, listDirectoryStartups } from './directory-data'

/**
 * DEMO-SP1-FOUNDER-01 — the public Founder Profile (DM13, `/talents/[handle]`).
 *
 * Only an allow-listed demo founder renders (DEMO-D5, DEMO-D13 PUBLIC VIEW);
 * any other handle is null → 404. The canonical fields pass through the WF02
 * discovery projection (`projectDiscovery`, a field whitelist) at the
 * profile's own PROFILE_DISCOVERY level: a demo profile set to PRIVATE is not
 * shown either. E-mail, phone, account, ids, consent, applications and every
 * non-discovery field never leave the server. Ventures are the canonical
 * published startups (DEC-W6P-D02) the profile is an ACTIVE member of.
 */

export type FounderVenture = {
  name: string
  href: string
  role: string | null
  stage: string | null
  region: string | null
  domains: string[]
  summary: string | null
}

export type FounderPage = {
  handle: string
  name: string
  headline: string | null
  bio: string | null
  region: string | null
  ventures: FounderVenture[]
  /** Other allow-listed founders (DM13 "Nhà sáng lập khác"). */
  others: Array<{ name: string; href: string; line: string | null }>
  demo: Omit<DemoFounder, 'profileId'>
}

type Person = {
  id: string
  display_name: string | null
  headline: string | null
  bio: string | null
  region_vocab_id: string | null
  region_label: string | null
}

/** Allow-listed, ACTIVE, discovery-visible demo profiles, projected field by field. */
async function visiblePeople(profileIds: string[]) {
  const rows = await query<Person>(
    `SELECT ip.id::text, ip.display_name, ip.headline, ip.bio, ip.region_vocab_id::text,
            r.label AS region_label
       FROM individual_profiles ip
       JOIN user_accounts ua ON ua.id = ip.account_id
       LEFT JOIN vocabulary_items r ON r.id = ip.region_vocab_id
      WHERE ip.id = ANY($1::uuid[]) AND ip.status = 'ACTIVE' AND ua.status = 'ACTIVE'`,
    [profileIds],
  )
  const levels = await discoveryLevelsOf(
    query,
    rows.map((r) => r.id),
  )
  const out = new Map<string, { name: string; headline?: string; bio?: string; region?: string }>()
  for (const r of rows) {
    const card = projectDiscovery(
      {
        profile_id: r.id,
        display_name: r.display_name,
        avatar_asset_id: null,
        headline: r.headline,
        bio: r.bio,
        domain_ids: [],
        region_id: r.region_vocab_id,
      },
      levels.get(r.id) ?? 'NETWORK_ONLY',
      // DEMO-D13: the allow-listed fictional founders are shown as the
      // network sees them; the profile's own level still applies.
      'NETWORK',
    )
    if (!card?.display_name) continue
    out.set(r.id, {
      name: card.display_name,
      headline: card.headline,
      bio: card.bio,
      region: card.region_id ? (r.region_label ?? undefined) : undefined,
    })
  }
  return out
}

/** ACTIVE memberships of published startups, per profile. */
async function venturesOf(profileIds: string[]) {
  const [startups, members] = await Promise.all([
    listDirectoryStartups(),
    query<{ profile_id: string; slug: string; role: string | null }>(
      `SELECT pm.profile_id::text, p.slug, pm.role_label AS role
         FROM project_members pm JOIN projects p ON p.id = pm.project_id
        WHERE pm.profile_id = ANY($1::uuid[]) AND pm.state = 'ACTIVE'
        ORDER BY pm.joined_at, pm.id`,
      [profileIds],
    ),
  ])
  const bySlug = new Map(startups.map((s) => [s.slug, s]))
  const out = new Map<string, FounderVenture[]>()
  for (const m of members) {
    const s = bySlug.get(m.slug)
    if (!s) continue
    const list = out.get(m.profile_id) ?? []
    list.push({
      name: s.name,
      href: s.href,
      role: m.role,
      stage: s.stage ? STAGE_SHORT[s.stage] : null,
      region: s.region,
      domains: s.domains,
      summary: s.summary,
    })
    out.set(m.profile_id, list)
  }
  return out
}

export async function findDemoFounder(handle: string): Promise<FounderPage | null> {
  const demo = demoFounder(handle)
  if (!demo) return null
  const ids = Object.values(DEMO_FOUNDERS).map((f) => f.profileId)
  const [people, ventures] = await Promise.all([visiblePeople(ids), venturesOf(ids)])
  const person = people.get(demo.profileId)
  if (!person) return null
  const others = Object.values(DEMO_FOUNDERS)
    .filter((f) => f.profileId !== demo.profileId && people.has(f.profileId))
    .map((f) => {
      const v = ventures.get(f.profileId)?.[0]
      return {
        name: people.get(f.profileId)!.name,
        href: founderHref(f.profileId)!,
        line: v ? [v.name, v.role].filter(Boolean).join(' · ') : null,
      }
    })
  // Everything but the profile id, which never leaves the server.
  const presentation: FounderPage['demo'] = {
    identityVerifiedDemo: demo.identityVerifiedDemo,
    hubRole: demo.hubRole,
    badges: demo.badges,
    tags: demo.tags,
    experience: demo.experience,
    education: demo.education,
    expertise: demo.expertise,
    certificates: demo.certificates,
  }
  return {
    handle,
    name: person.name,
    headline: person.headline ?? null,
    bio: person.bio ?? null,
    region: person.region ?? null,
    ventures: ventures.get(demo.profileId) ?? [],
    others,
    demo: presentation,
  }
}
