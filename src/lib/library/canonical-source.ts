import { query, type Executor } from '@/lib/db/client'
import { isAssetId } from '@/lib/media/avatar-storage'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import type { StartupStage } from './startup-adapter'

/**
 * WF06-PROD-02 — canonical read path of the Library (DEC-W6P-D02 / D03 / D04),
 * direct reads of the WF02 venture and WF01 profile records, server side only.
 *
 * - Startups: ventures `type STARTUP`, `status ACTIVE`, `visibility PUBLIC` (the
 *   owner published them, DEC-PDF-D1). The predicate is in SQL; nothing hidden
 *   is loaded and filtered later.
 * - Founders: the owner of such a venture, shown only to a NETWORK viewer
 *   (signed-in member) and only while the owner's PROFILE_DISCOVERY allows it
 *   (`discoveryLevelsOf` + `projectDiscovery`, the WF01 / WF02 rule); account
 *   and profile ACTIVE. A guest gets none (P0 has no public profile).
 * - Rows carry the canonical venture id only for server use; the Library
 *   items built from them (`library-data.ts`) expose an opaque key, never a
 *   UUID, slug or owner id.
 * - Reads no programme, application or other workflow data.
 */

/** The internal list cap: the Library never holds more than the external feed allows. */
export const CANONICAL_CAP = 1000

export type VocabRef = { id: string; label: string }
export type StageRef = VocabRef & { code: StartupStage }

export type CanonicalStartupRow = {
  ventureId: string
  name: string
  summary: string | null
  stage: StageRef | null
  region: VocabRef | null
  domains: VocabRef[]
}

export type CanonicalFounderRow = {
  profileId: string
  displayName: string
  avatarUrl: string | null
  ventures: Array<{
    ventureId: string
    name: string
    roleLabel: string | null
    stage: StageRef | null
  }>
  domainIds: string[]
}

export type LibraryViewer = 'GUEST' | 'NETWORK'

/** The canonical predicate of a Library startup (DEC-W6P-D02). */
const PUBLIC_STARTUP = `p.type = 'STARTUP' AND p.status = 'ACTIVE' AND p.visibility = 'PUBLIC'`

type StartupSql = {
  id: string
  name: string
  summary: string | null
  stage_id: string | null
  stage_code: string | null
  stage_label: string | null
  region_id: string | null
  region_label: string | null
  domains: VocabRef[]
  owner_profile_id: string
  owner_role_label: string | null
}

async function publicStartupRows(exec: Executor): Promise<StartupSql[]> {
  // The capped page is chosen first, then labelled: domains are read per row
  // through the project_domains key, never aggregated for the whole table.
  const rows = await exec<StartupSql>(
    `WITH page AS (
       SELECT p.id, p.name, p.summary, p.stage_id, p.region_id, p.owner_profile_id, p.owner_role_label
         FROM projects p
        WHERE ${PUBLIC_STARTUP}
        ORDER BY p.name, p.id
        LIMIT ${CANONICAL_CAP})
     SELECT p.id::text, p.name, p.summary,
            s.id::text AS stage_id, s.slug AS stage_code, s.label AS stage_label,
            r.id::text AS region_id, r.label AS region_label,
            COALESCE(dm.domains, '[]'::json) AS domains,
            p.owner_profile_id::text, p.owner_role_label
       FROM page p
       LEFT JOIN vocabulary_items s ON s.id = p.stage_id AND s.type_code = 'VENTURE_STAGE'
       LEFT JOIN vocabulary_items r ON r.id = p.region_id AND r.type_code = 'REGION'
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('id', d.id::text, 'label', d.label)
                         ORDER BY d.sort_order, d.label) AS domains
           FROM project_domains pd
           JOIN vocabulary_items d ON d.id = pd.vocabulary_item_id AND d.type_code = 'DOMAIN'
          WHERE pd.project_id = p.id) dm ON true
      ORDER BY p.name, p.id`,
  )
  // Fail loud: past the cap the Library would silently miss ventures (PROD-03 moves paging to SQL).
  if (rows.length >= CANONICAL_CAP) console.warn('library canonical startup cap reached')
  return rows
}

const stageOf = (r: StartupSql): StageRef | null =>
  r.stage_id && r.stage_code && r.stage_label
    ? { id: r.stage_id, code: r.stage_code as StartupStage, label: r.stage_label }
    : null

/** The published startups every viewer may see, with their stage, region and domain labels. */
export async function listPublicStartups(exec: Executor = query): Promise<CanonicalStartupRow[]> {
  return (await publicStartupRows(exec)).map((r) => ({
    ventureId: r.id,
    name: r.name,
    summary: r.summary,
    stage: stageOf(r),
    region: r.region_id && r.region_label ? { id: r.region_id, label: r.region_label } : null,
    domains: r.domains,
  }))
}

/**
 * The owners of published startups whose discovery card the viewer may see
 * (DEC-W6P-D03). A guest gets an empty list; a hidden owner is omitted, never
 * replaced by an initial, a placeholder or an id.
 */
export async function listVisibleFounders(
  viewer: LibraryViewer,
  exec: Executor = query,
): Promise<CanonicalFounderRow[]> {
  if (viewer !== 'NETWORK') return []
  const startups = await publicStartupRows(exec)
  const ownerIds = [...new Set(startups.map((s) => s.owner_profile_id))]
  if (ownerIds.length === 0) return []
  const people = await exec<{
    id: string
    display_name: string | null
    avatar_asset_id: string | null
  }>(
    `SELECT ip.id::text, ip.display_name, ip.avatar_asset_id
       FROM individual_profiles ip
       JOIN user_accounts ua ON ua.id = ip.account_id
      WHERE ip.id = ANY($1::uuid[]) AND ip.status = 'ACTIVE' AND ua.status = 'ACTIVE'`,
    [ownerIds],
  )
  const levels = await discoveryLevelsOf(
    exec,
    people.map((p) => p.id),
  )
  const founders: CanonicalFounderRow[] = []
  for (const person of people) {
    const card = projectDiscovery(
      {
        profile_id: person.id,
        display_name: person.display_name,
        avatar_asset_id: isAssetId(person.avatar_asset_id) ? person.avatar_asset_id : null,
        headline: null,
        bio: null,
        domain_ids: [],
        region_id: null,
      },
      levels.get(person.id) ?? 'NETWORK_ONLY',
      'NETWORK',
    )
    if (!card?.display_name) continue
    const owned = startups.filter((s) => s.owner_profile_id === person.id)
    founders.push({
      profileId: person.id,
      displayName: card.display_name,
      avatarUrl: card.avatar_url ?? null,
      ventures: owned.map((s) => ({
        ventureId: s.id,
        name: s.name,
        roleLabel: s.owner_role_label,
        stage: stageOf(s),
      })),
      domainIds: [...new Set(owned.flatMap((s) => s.domains.map((d) => d.id)))],
    })
  }
  return founders
}

/** ACTIVE DOMAIN items by slug and VENTURE_STAGE items by code, for mapping external records. */
export async function vocabularyForLibrary(exec: Executor = query): Promise<{
  domainsBySlug: Map<string, VocabRef>
  stagesByCode: Map<StartupStage, StageRef>
}> {
  const rows = await exec<{ type_code: string; id: string; slug: string; label: string }>(
    `SELECT type_code, id::text, slug, label FROM vocabulary_items
      WHERE status = 'ACTIVE' AND type_code IN ('DOMAIN', 'VENTURE_STAGE')`,
  )
  const domainsBySlug = new Map<string, VocabRef>()
  const stagesByCode = new Map<StartupStage, StageRef>()
  for (const r of rows) {
    if (r.type_code === 'DOMAIN') domainsBySlug.set(r.slug, { id: r.id, label: r.label })
    else
      stagesByCode.set(r.slug as StartupStage, {
        id: r.id,
        code: r.slug as StartupStage,
        label: r.label,
      })
  }
  return { domainsBySlug, stagesByCode }
}
