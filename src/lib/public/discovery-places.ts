import { query } from '@/lib/db/client'

import type { Places } from './discovery-query'

/**
 * THAO-05 — the canonical location hierarchy of the discovery filters
 * (DEC-THAO-DIR-D6): COUNTRY → REGION (tỉnh / thành, `metadata.country`) of
 * the Sprint 1 catalogue (S1_APPENDIX_E). ACTIVE items only; nothing is added.
 */
export async function loadPlaces(): Promise<Places> {
  const rows = await query<{
    type_code: string
    slug: string
    label: string
    country: string | null
  }>(
    `SELECT type_code, slug, label, metadata->>'country' AS country
       FROM vocabulary_items
      WHERE type_code IN ('REGION', 'COUNTRY') AND status = 'ACTIVE'
        AND metadata->>'catalog' = 'S1_APPENDIX_E'
      ORDER BY type_code, sort_order, label`,
  )
  const countries = rows
    .filter((r) => r.type_code === 'COUNTRY')
    .map((r) => ({ slug: r.slug, label: r.label }))
  const known = new Set(countries.map((c) => c.slug))
  const regions = rows
    .filter((r) => r.type_code === 'REGION' && r.country !== null && known.has(r.country))
    .map((r) => ({ slug: r.slug, label: r.label, country: r.country! }))
  return { countries, regions }
}
