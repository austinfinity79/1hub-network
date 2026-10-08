import { query } from '@/lib/db/client'
import { founderHref } from '@/lib/demo-0710/founders'
import { startupOverview, type StartupOverview } from '@/lib/demo-0710/startup-overview'
import { demoVenture } from '@/lib/demo-0710/ventures'
import { listPublicStartups, type CanonicalStartupRow } from '@/lib/library/canonical-source'
import type { StartupStage } from '@/lib/library/startup-adapter'
import { assetUrl, isAssetId } from '@/lib/media/avatar-storage'
import { canSeeDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { productDetailHref } from './product-detail'
import { PUBLIC_ROUTES } from './routes'

/**
 * DEMO-DIR2-01 — the Product / Startup directory (DM08, `/products`) and the
 * startup page it opens (`/products/[slug]`).
 *
 * Rows are the canonical published startups only: the Library predicate
 * (type STARTUP, status ACTIVE, visibility PUBLIC, DEC-W6P-D02) read through
 * `listPublicStartups`; no second model, no read-model store. The canonical
 * slug is the public key of the detail route. The demo fixture adds the
 * states DM08 counts (fundraising, paying customers, portfolio) for the demo
 * ventures only (DEMO STATE ONLY): any other venture is false / null there, so
 * no real record depends on it (THAO-05). No owner, member, id or application
 * data reaches the page.
 *
 * THAO-05: each row also carries its canonical place (REGION slug and its
 * country, DEC-THAO-DIR-D6) for the shared location filter.
 */

/** Short stage names of DM08 for the canonical VENTURE_STAGE codes (migration 012). */
export const STAGE_SHORT: Record<StartupStage, string> = {
  IDEA: 'Ý tưởng',
  MVP: 'MVP',
  PILOT: 'Pilot',
  SELLING: 'Đang bán',
  GROWTH: 'Tăng trưởng',
}

export const STAGE_ORDER: StartupStage[] = ['IDEA', 'MVP', 'PILOT', 'SELLING', 'GROWTH']

export type DirectoryStartup = {
  slug: string
  name: string
  summary: string | null
  stage: StartupStage | null
  region: string | null
  /** REGION slug and its COUNTRY slug (`metadata.country`), for the location filter. */
  regionSlug: string | null
  country: string | null
  domains: string[]
  fundraising: boolean
  payingCustomers: boolean
  portfolio: string | null
  /** Search text: name, summary, domains, stage, place, demo state. */
  text: string
  /** The current public logo (`/media/assets/:id`), else null: initials. */
  logo: string | null
  /** Sort keys (ISO), "Hoạt động" and "Mới nhất". */
  updatedAt: string
  createdAt: string
  href: string
  /** S2-PRODUCT-CATALOG-CLEANUP-01: the detail a catalogue card may open, else null (no link). */
  detailHref: string | null
}

type Meta = {
  id: string
  slug: string
  created_at: string
  updated_at: string
  region_slug: string | null
  country: string | null
  logo_asset_id: string | null
}

function shape(row: CanonicalStartupRow, meta: Meta): DirectoryStartup {
  const demo = demoVenture(row.ventureId)
  const fundraising = demo?.badge === 'GỌI VỐN'
  const stage = row.stage?.code ?? null
  return {
    slug: meta.slug,
    name: row.name,
    summary: row.summary,
    stage,
    region: row.region?.label ?? null,
    regionSlug: meta.region_slug,
    country: meta.country,
    domains: row.domains.map((d) => d.label),
    fundraising,
    payingCustomers: demo?.payingCustomers ?? false,
    portfolio: demo?.portfolio ?? null,
    text: [
      row.name,
      row.summary,
      ...row.domains.map((d) => d.label),
      stage ? STAGE_SHORT[stage] : null,
      row.stage?.label,
      row.region?.label,
      fundraising ? 'Đang gọi vốn' : null,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('vi'),
    logo: isAssetId(meta.logo_asset_id) ? assetUrl(meta.logo_asset_id) : null,
    updatedAt: meta.updated_at,
    createdAt: meta.created_at,
    href: `${PUBLIC_ROUTES.products}/${meta.slug}`,
    detailHref: productDetailHref(meta.slug),
  }
}

async function metaOf(ids: string[]): Promise<Map<string, Meta>> {
  const rows = await query<Meta>(
    `SELECT p.id::text, p.slug, p.created_at::text, p.updated_at::text, p.logo_asset_id,
            r.slug AS region_slug, r.metadata->>'country' AS country
       FROM projects p
       LEFT JOIN vocabulary_items r ON r.id = p.region_id AND r.type_code = 'REGION'
      WHERE p.id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, r]))
}

export async function listDirectoryStartups(): Promise<DirectoryStartup[]> {
  const rows = await listPublicStartups()
  const meta = await metaOf(rows.map((r) => r.ventureId))
  return rows.flatMap((r) => {
    const m = meta.get(r.ventureId)
    return m ? [shape(r, m)] : []
  })
}

export type StartupPage = DirectoryStartup & {
  stageLabel: string | null
  since: string | null
  round: string | null
  /**
   * Team of a demo venture (its canonical ACTIVE members); empty for any
   * other venture. `href` is the founder page of an allow-listed demo
   * founder (DEMO-D5), null otherwise (plain text).
   */
  team: Array<{ name: string; role: string | null; href: string | null }>
  /**
   * THAO-06 (DEC-THAO-SP-D1): true when a real venture's team exists but is not
   * shown to this viewer (a guest): the page invites sign-in, names nobody.
   */
  teamGated: boolean
  /** DM10 Tổng quan content of a demo venture (DEMO STATE ONLY), else null. */
  overview: StartupOverview | null
}

/**
 * One published startup by its canonical slug, or null (unknown, private, draft).
 *
 * Team (THAO-06, DEC-THAO-SP-D1): the demo ventures keep their fictional team
 * for everyone (DEMO_DATA_CONTRACT). A real venture's owner and ACTIVE members
 * are shown to a signed-in NETWORK viewer only, through PROFILE_DISCOVERY
 * (NETWORK_ONLY; PRIVATE, inactive or nameless people are left out); a guest
 * sees no name. No profile id leaves the server.
 */
export async function findPublicStartup(
  slug: string,
  viewer: 'GUEST' | 'NETWORK' = 'GUEST',
): Promise<StartupPage | null> {
  const rows = await listPublicStartups()
  const meta = await metaOf(rows.map((r) => r.ventureId))
  const row = rows.find((r) => meta.get(r.ventureId)?.slug === slug)
  if (!row) return null
  const demo = demoVenture(row.ventureId)
  const people =
    demo || viewer === 'NETWORK'
      ? await query<{ profile_id: string; name: string | null; role: string | null }>(
          `SELECT * FROM (
             SELECT ip.id::text AS profile_id, ip.display_name AS name, p.owner_role_label AS role,
                    0 AS rank, p.created_at AS since, ip.id::text AS tie
               FROM projects p
               JOIN individual_profiles ip ON ip.id = p.owner_profile_id AND ip.status = 'ACTIVE'
               JOIN user_accounts ua ON ua.id = ip.account_id AND ua.status = 'ACTIVE'
              WHERE p.id = $1 AND $2::boolean
             UNION ALL
             SELECT pm.profile_id::text, ip.display_name, pm.role_label, 1, pm.joined_at, pm.id::text
               FROM project_members pm
               JOIN individual_profiles ip ON ip.id = pm.profile_id AND ip.status = 'ACTIVE'
               JOIN user_accounts ua ON ua.id = ip.account_id AND ua.status = 'ACTIVE'
              WHERE pm.project_id = $1 AND pm.state = 'ACTIVE'
                AND (NOT $2::boolean OR pm.profile_id <> (SELECT owner_profile_id FROM projects WHERE id = $1))
           ) t ORDER BY rank, since, tie`,
          // The demo ventures list their seeded members only, as before.
          [row.ventureId, !demo],
        )
      : []
  // A member whose PROFILE_DISCOVERY is PRIVATE is not listed (WF02 rule);
  // the profile id stays here: only the name, role and founder route leave.
  const levels = await discoveryLevelsOf(
    query,
    people.map((m) => m.profile_id),
  )
  const visible = (m: { profile_id: string; name: string | null }) =>
    Boolean(m.name) && canSeeDiscovery(levels.get(m.profile_id) ?? 'NETWORK_ONLY', 'NETWORK')
  const profileTeam = people
    .filter((m): m is { profile_id: string; name: string; role: string | null } => visible(m))
    .map((m) => ({ name: m.name, role: m.role, href: founderHref(m.profile_id) }))
  // S2-SMART-CAMPUS-DETAIL-ENRICH-01: a venture whose approved source lists its
  // team shows that list (to the same viewers as the canonical team): a listed
  // person with a visible profile is that member (link); one without a profile
  // is plain text; one whose profile hides discovery is left out.
  const overview = startupOverview(row.ventureId)
  const hidden = new Set(people.filter((m) => m.name && !visible(m)).map((m) => m.name))
  const team =
    overview?.team && (demo || viewer === 'NETWORK')
      ? [
          ...overview.team
            .filter((s) => !hidden.has(s.name))
            .map(
              (s) =>
                profileTeam.find((m) => m.name === s.name) ?? {
                  name: s.name,
                  role: s.role,
                  href: null,
                },
            ),
          ...profileTeam.filter((m) => !overview.team!.some((s) => s.name === m.name)),
        ]
      : profileTeam
  return {
    ...shape(row, meta.get(row.ventureId)!),
    stageLabel: row.stage?.label ?? null,
    since: demo?.since ?? null,
    round: demo?.round ?? null,
    team,
    teamGated: !demo && viewer !== 'NETWORK',
    overview,
  }
}
