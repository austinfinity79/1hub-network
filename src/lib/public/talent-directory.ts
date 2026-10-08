import { query } from '@/lib/db/client'
import { founderHref } from '@/lib/demo-0710/founders'
import type { LibraryViewer } from '@/lib/library/canonical-source'
import { opaqueKey } from '@/lib/library/library-data'
import { fold } from '@/lib/library/startup-adapter'
import { isAssetId } from '@/lib/media/avatar-storage'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { STAGE_SHORT } from './directory-data'
import { PUBLIC_ROUTES } from './routes'

/**
 * THAO-05 DIR3 — `/talents` (DEC-THAO-DIR-D3, D4).
 *
 * - A GUEST gets nothing: this module returns null before any person is
 *   read, so no name, avatar, card or count leaves the server.
 * - A NETWORK viewer (live session of an ACTIVE account, the Library rule)
 *   gets every ACTIVE profile of an ACTIVE account whose PROFILE_DISCOVERY
 *   card it may see (`projectDiscovery`, NETWORK_ONLY; PRIVATE is dropped),
 *   with the projection's fields only: display name, avatar (authorised media
 *   route), headline, domains, region. No bio, phone, e-mail, full name,
 *   skills or specialisations (D4), no id: the card key is opaque.
 * - Country is not a card field; it is carried for the country filter only
 *   (D4): the profile's country, else its region's.
 * - Ventures: the person's PUBLIC + ACTIVE startups (the DEC-W6P-D02
 *   predicate), linking to their public page.
 * - Detail: only an allow-listed demo founder links to `/talents/[handle]`;
 *   every real-person card is READ_ONLY.
 */

export type TalentCard = {
  key: string
  name: string
  initials: string
  avatarUrl: string | null
  headline: string | null
  domains: string[]
  region: string | null
  regionSlug: string | null
  country: string | null
  ventures: Array<{ name: string; href: string; stage: string | null }>
  /** `/talents/[handle]` for an allow-listed demo founder, else null (READ_ONLY). */
  href: string | null
  /** S2-TALENT-DIRECTORY-CLEANUP-01: shown first (the PO's lead talent). */
  pinned: boolean
  text: string
}

type ProfileRow = {
  id: string
  display_name: string | null
  avatar_asset_id: string | null
  headline: string | null
  region_id: string | null
  region_slug: string | null
  region_label: string | null
  region_country: string | null
  country_slug: string | null
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/)
  const first = words[0]?.charAt(0) ?? ''
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return (first + last).toLocaleUpperCase('vi')
}

/**
 * S2-TALENT-DIRECTORY-CLEANUP-01 — the directory shows real, source-backed
 * people only. These nine profiles are seed / demo personas absent from every
 * sheet of the Sprint 1 workbook (3 seed accounts, 6 fictional DEMO-0710
 * founders and team): they stay in the data (founder pages, demo teams) but
 * are never listed here.
 */
export const NON_REAL_TALENT_PROFILE_IDS: readonly string[] = [
  '40000000-0000-0000-0000-000000000001', // Demo Member
  '40000000-0000-0000-0000-000000000002', // Demo Leader
  '40000000-0000-0000-0000-000000000005', // Demo Pending
  'de710000-0000-0000-0000-0000000000b1', // Đặng Kim Chi (DEMO-0710)
  'de710000-0000-0000-0000-0000000000b2', // Nguyễn Minh Anh (DEMO-0710)
  'de710000-0000-0000-0000-0000000000b3', // Phạm Quốc Việt (DEMO-0710)
  'de710000-0000-0000-0000-0000000000b4', // Trần Hạnh (DEMO-0710)
  'de710000-0000-0000-0000-0000000000b5', // Lý Gia Bảo (DEMO-0710)
  'de710000-0000-0000-0000-0000000000b6', // Võ Thanh Hà (DEMO-0710)
]

/** The lead talent, first in the directory: Vũ Tuấn Anh (TALENT-TUAN-ANH-MEMBER-ACCOUNT-01). */
export const PINNED_TALENT_PROFILE_ID = '7a1e0000-0000-4000-8000-0000000000b1'

export async function listTalents(viewer: LibraryViewer): Promise<TalentCard[] | null> {
  if (viewer !== 'NETWORK') return null
  const people = await query<ProfileRow>(
    `SELECT ip.id::text, ip.display_name, ip.avatar_asset_id, ip.headline,
            r.id::text AS region_id, r.slug AS region_slug, r.label AS region_label,
            r.metadata->>'country' AS region_country, c.slug AS country_slug
       FROM individual_profiles ip
       JOIN user_accounts ua ON ua.id = ip.account_id
       LEFT JOIN vocabulary_items r ON r.id = ip.region_vocab_id AND r.type_code = 'REGION'
       LEFT JOIN vocabulary_items c ON c.id = ip.country_vocab_id AND c.type_code = 'COUNTRY'
      WHERE ip.status = 'ACTIVE' AND ua.status = 'ACTIVE' AND NOT (ip.id = ANY($1::uuid[]))`,
    [NON_REAL_TALENT_PROFILE_IDS],
  )
  if (people.length === 0) return []
  const ids = people.map((p) => p.id)
  const [levels, domainRows, ventureRows] = await Promise.all([
    discoveryLevelsOf(query, ids),
    query<{ profile_id: string; id: string; label: string }>(
      `SELECT pd.profile_id::text, v.id::text, v.label
         FROM profile_domains pd
         JOIN vocabulary_items v ON v.id = pd.vocab_id AND v.type_code = 'DOMAIN'
        WHERE pd.profile_id = ANY($1::uuid[])
        ORDER BY v.sort_order, v.label`,
      [ids],
    ),
    query<{ owner: string; slug: string; name: string; stage: string | null }>(
      `SELECT p.owner_profile_id::text AS owner, p.slug, p.name, s.slug AS stage
         FROM projects p
         LEFT JOIN vocabulary_items s ON s.id = p.stage_id AND s.type_code = 'VENTURE_STAGE'
        WHERE p.type = 'STARTUP' AND p.status = 'ACTIVE' AND p.visibility = 'PUBLIC'
          AND p.owner_profile_id = ANY($1::uuid[])
        ORDER BY p.name, p.slug`,
      [ids],
    ),
  ])
  const cards: TalentCard[] = []
  for (const p of people) {
    const card = projectDiscovery(
      {
        profile_id: p.id,
        display_name: p.display_name,
        avatar_asset_id: isAssetId(p.avatar_asset_id) ? p.avatar_asset_id : null,
        headline: p.headline,
        bio: null,
        domain_ids: domainRows.filter((d) => d.profile_id === p.id).map((d) => d.id),
        region_id: p.region_id,
      },
      levels.get(p.id) ?? 'NETWORK_ONLY',
      'NETWORK',
    )
    if (!card?.display_name) continue
    const domains = domainRows
      .filter((d) => card.domain_ids?.includes(d.id) && d.profile_id === p.id)
      .map((d) => d.label)
    const region = card.region_id ? p.region_label : null
    const ventures = ventureRows
      .filter((v) => v.owner === p.id)
      .map((v) => ({
        name: v.name,
        href: `${PUBLIC_ROUTES.products}/${v.slug}`,
        stage: v.stage
          ? (STAGE_SHORT[v.stage.toUpperCase() as keyof typeof STAGE_SHORT] ?? null)
          : null,
      }))
    cards.push({
      key: opaqueKey('founder', p.id),
      name: card.display_name,
      initials: initialsOf(card.display_name),
      avatarUrl: card.avatar_url ?? null,
      headline: card.headline ?? null,
      domains,
      region,
      regionSlug: card.region_id ? p.region_slug : null,
      country: p.country_slug ?? (card.region_id ? p.region_country : null),
      ventures,
      href: founderHref(p.id),
      pinned: p.id === PINNED_TALENT_PROFILE_ID,
      text: fold(
        [card.display_name, card.headline, region, ...domains, ...ventures.map((v) => v.name)]
          .filter(Boolean)
          .join(' '),
      ),
    })
  }
  return cards
}
