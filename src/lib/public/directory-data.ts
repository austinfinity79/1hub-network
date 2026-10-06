import { query } from '@/lib/db/client'
import { founderHref } from '@/lib/demo-0710/founders'
import { startupOverview, type StartupOverview } from '@/lib/demo-0710/startup-overview'
import { demoVenture } from '@/lib/demo-0710/ventures'
import { listPublicStartups, type CanonicalStartupRow } from '@/lib/library/canonical-source'
import type { StartupStage } from '@/lib/library/startup-adapter'
import { canSeeDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

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
 * ventures only (DEMO STATE ONLY). No owner, member, id or application data
 * reaches the page.
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
  domains: string[]
  fundraising: boolean
  payingCustomers: boolean
  portfolio: string | null
  /** Search text: name, summary, domains, stage, place, demo state. */
  text: string
  /** Sort keys (ISO), "Hoạt động" and "Mới nhất". */
  updatedAt: string
  createdAt: string
  href: string
}

export type DirectoryPlace = { slug: string; label: string }

type Meta = { id: string; slug: string; created_at: string; updated_at: string }

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
    updatedAt: meta.updated_at,
    createdAt: meta.created_at,
    href: `${PUBLIC_ROUTES.products}/${meta.slug}`,
  }
}

async function metaOf(ids: string[]): Promise<Map<string, Meta>> {
  const rows = await query<Meta>(
    `SELECT id::text, slug, created_at::text, updated_at::text FROM projects WHERE id = ANY($1::uuid[])`,
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

/** The provinces and countries of the Sprint 1 catalogue, for the "Khu vực" filter. */
export async function listDirectoryPlaces(): Promise<{
  provinces: DirectoryPlace[]
  countries: DirectoryPlace[]
}> {
  const rows = await query<{ type_code: string; slug: string; label: string }>(
    `SELECT type_code, slug, label FROM vocabulary_items
      WHERE type_code IN ('REGION', 'COUNTRY') AND status = 'ACTIVE'
        AND metadata->>'catalog' = 'S1_APPENDIX_E'
      ORDER BY type_code, sort_order, label`,
  )
  const pick = (type: string) =>
    rows.filter((r) => r.type_code === type).map((r) => ({ slug: r.slug, label: r.label }))
  return { provinces: pick('REGION'), countries: pick('COUNTRY').filter((c) => c.slug !== 'vn') }
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
  /** DM10 Tổng quan content of a demo venture (DEMO STATE ONLY), else null. */
  overview: StartupOverview | null
}

/** One published startup by its canonical slug, or null (unknown, private, draft). */
export async function findPublicStartup(slug: string): Promise<StartupPage | null> {
  const rows = await listPublicStartups()
  const meta = await metaOf(rows.map((r) => r.ventureId))
  const row = rows.find((r) => meta.get(r.ventureId)?.slug === slug)
  if (!row) return null
  const demo = demoVenture(row.ventureId)
  // Team names only for the demo ventures (fictional people, DEMO_DATA_CONTRACT);
  // a real venture's members are not published by this page.
  const members = demo
    ? await query<{ profile_id: string; name: string; role: string | null }>(
        `SELECT pm.profile_id::text, ip.display_name AS name, pm.role_label AS role
           FROM project_members pm
           JOIN individual_profiles ip ON ip.id = pm.profile_id AND ip.status = 'ACTIVE'
          WHERE pm.project_id = $1 AND pm.state = 'ACTIVE'
          ORDER BY pm.joined_at, pm.id`,
        [row.ventureId],
      )
    : []
  // A member whose PROFILE_DISCOVERY is PRIVATE is not listed (WF02 rule);
  // the profile id stays here: only the name, role and founder route leave.
  const levels = await discoveryLevelsOf(
    query,
    members.map((m) => m.profile_id),
  )
  const team = members
    .filter((m) => canSeeDiscovery(levels.get(m.profile_id) ?? 'NETWORK_ONLY', 'NETWORK'))
    .map((m) => ({ name: m.name, role: m.role, href: founderHref(m.profile_id) }))
  return {
    ...shape(row, meta.get(row.ventureId)!),
    stageLabel: row.stage?.label ?? null,
    since: demo?.since ?? null,
    round: demo?.round ?? null,
    team,
    overview: startupOverview(row.ventureId),
  }
}
