import { query } from '@/lib/db/client'
import { demoVenture } from '@/lib/demo-0710/ventures'
import { listPublicStartups } from '@/lib/library/canonical-source'

import { PUBLIC_ROUTES } from './routes'

/**
 * DEMO-HOME-ABOUT-01 — the live product blocks of Homepage v2 (DM01 "Sản
 * phẩm theo ngành", "Startup sẵn sàng gặp nhà đầu tư", "Tất cả sản phẩm
 * trong mạng lưới"). The rows are the canonical published startups (the
 * Library predicate, DEC-W6P-D02); the demo fixture only adds the one-line
 * pitch, round, chip and headline numbers it has (DEMO STATE ONLY). Counts
 * are live (DEMO_DATA_CONTRACT "Counts"). No id, slug or owner reaches the
 * page beyond the product link, and the link stays null until DM08 ships.
 */

export type HomeStartup = {
  key: string
  name: string
  /** Initials of the list rows ("TR", "LS", "KL"). */
  mark: string
  /** First two letters of the tiles ("TR", "LO", "KH"). */
  tile: string
  summary: string | null
  short: string | null
  round: string | null
  badge: string | null
  investorReady: boolean
  headline: Array<{ value: string; label: string }>
  stage: string | null
  region: string | null
  domains: string[]
  href: string | null
}

/** Capitals of a CamelCase name, else the first letter of each word, else its first two letters. */
export function markOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1)
    return words
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('')
      .toLocaleUpperCase('vi')
  const caps = (words[0] ?? '').match(/\p{Lu}/gu) ?? []
  if (caps.length >= 2) return caps.slice(0, 2).join('')
  return tileOf(name)
}

export function tileOf(name: string): string {
  return name.replace(/\s+/g, '').slice(0, 2).toLocaleUpperCase('vi')
}

export async function listHomeStartups(): Promise<HomeStartup[]> {
  const rows = await listPublicStartups()
  const slugs = new Map(
    (
      await query<{ id: string; slug: string }>(
        'SELECT id::text, slug FROM projects WHERE id = ANY($1::uuid[])',
        [rows.map((r) => r.ventureId)],
      )
    ).map((r) => [r.id, r.slug]),
  )
  return rows.map((r, i) => {
    const demo = demoVenture(r.ventureId)
    const slug = slugs.get(r.ventureId)
    return {
      key: `s${i}`,
      name: r.name,
      mark: markOf(r.name),
      tile: tileOf(r.name),
      summary: r.summary,
      short: demo?.short ?? r.summary,
      round: demo?.round ?? null,
      badge: demo?.badge ?? null,
      investorReady: demo?.investorReady ?? false,
      headline: demo?.headline ?? [],
      stage: r.stage?.label ?? null,
      region: r.region?.label ?? null,
      domains: r.domains.map((d) => d.label),
      href: PUBLIC_ROUTES.products && slug ? `${PUBLIC_ROUTES.products}/${slug}` : null,
    }
  })
}
