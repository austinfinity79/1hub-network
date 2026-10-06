import { query, type Executor } from '@/lib/db/client'

/**
 * DEMO-HOME-ABOUT-01 — the canonical HUB catalogue as About v2 shows it
 * (DM02 map and chips, DM03 popup, DM04 / DM05 tabs). Read from the Sprint 1
 * catalogue rows (S1-UAT-03, `metadata.catalog_order`, PUBLISHED, ACTIVE
 * PARENT relationships): every rendered count comes from here, never from the
 * frame's sample numbers (CANONICAL DATA WINS, DEMO-HOME-ABOUT-01 §4).
 * Public data only: names and slugs of published units.
 */

export type AboutClub = { slug: string; name: string }
export type AboutChapter = { slug: string; name: string; order: number; clubs: AboutClub[] }
export type AboutNetwork = { chapters: AboutChapter[]; clubCount: number }

export async function loadAboutNetwork(exec: Executor = query): Promise<AboutNetwork> {
  const rows = await exec<{
    id: string
    slug: string
    name: string
    type: string
    ord: number
    parent_id: string | null
  }>(
    `SELECT o.id::text, o.slug, o.name, o.type::text AS type,
            (o.metadata->>'catalog_order')::int AS ord,
            r.source_org_id::text AS parent_id
       FROM organizations o
       LEFT JOIN organization_relationships r
              ON r.target_org_id = o.id AND r.relationship_type = 'PARENT' AND r.state = 'ACTIVE'
      WHERE o.status = 'PUBLISHED' AND o.type::text IN ('CHAPTER', 'CLB')
        AND o.metadata ? 'catalog_order'
      ORDER BY (o.metadata->>'catalog_order')::int, o.name, o.id`,
  )
  const chapters: AboutChapter[] = rows
    .filter((r) => r.type === 'CHAPTER')
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      order: r.ord,
      clubs: rows
        .filter((c) => c.type === 'CLB' && c.parent_id === r.id)
        .map((c) => ({ slug: c.slug, name: c.name })),
    }))
  return { chapters, clubCount: chapters.reduce((n, c) => n + c.clubs.length, 0) }
}
