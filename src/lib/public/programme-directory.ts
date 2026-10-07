import { query } from '@/lib/db/client'
import { applicationRoutes } from '@/lib/application/routes'
import type { LibraryViewer } from '@/lib/library/canonical-source'
import { fold } from '@/lib/library/startup-adapter'

import { phaseOf, type ProgrammeKind, type ProgrammePhase } from './programme-phase'

/**
 * THAO-05 DIR0 — the public projection of the Programme aggregate for
 * `/programmes` (DEC-THAO-DIR-D1, a narrow override of DEC-W4P-D10).
 *
 * - Visible: PUBLISHED and CLOSED; DRAFT (and the deferred ARCHIVED) never
 *   leave the server.
 * - Fields: name, type, summary, the owning organisation's public name (when
 *   that organisation is PUBLISHED), dates and a derived phase. Nothing else:
 *   no id, no metadata (journey, challenge problems), no registration form.
 * - Phase is presentation only and never written back (DEC-W4P-D11 unchanged):
 *   Đã kết thúc = CLOSED or `ends_at` passed; Sắp tới = PUBLISHED with
 *   `starts_at` in the future; Đang mở = PUBLISHED otherwise.
 * - The card's one destination is the existing L5 entry
 *   `/programmes/[programmeId]/apply`, offered only to a signed-in NETWORK
 *   viewer, for a PUBLISHED programme that has its registration form and has
 *   not ended (the apply contract's own conditions); otherwise READ_ONLY.
 *   The programme id therefore reaches that viewer only, inside that link.
 */

export type DirectoryProgramme = {
  /** The public slug: React key and nothing more (no detail route). */
  slug: string
  name: string
  kind: ProgrammeKind
  summary: string | null
  host: { slug: string; name: string } | null
  phase: ProgrammePhase
  /** "dd/mm/yyyy – dd/mm/yyyy" in Viet Nam time, or null without dates. */
  timeline: string | null
  /** ISO start, for ordering only; null sorts last. */
  startsAt: string | null
  /** The L5 entry for an eligible viewer, else null (READ_ONLY). */
  applyHref: string | null
  /** Folded search text: name, summary, host, type. */
  text: string
}

const DAY = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function timelineOf(startsAt: Date | null, endsAt: Date | null): string | null {
  if (startsAt && endsAt) return `${DAY.format(startsAt)} – ${DAY.format(endsAt)}`
  if (startsAt) return `Từ ${DAY.format(startsAt)}`
  if (endsAt) return `Đến ${DAY.format(endsAt)}`
  return null
}

type Row = {
  id: string
  slug: string
  name: string
  summary: string | null
  type: 'PROGRAMME' | 'CHALLENGE'
  status: 'PUBLISHED' | 'CLOSED'
  starts_at: Date | null
  ends_at: Date | null
  host_slug: string | null
  host_name: string | null
  has_form: boolean
}

export async function listPublicProgrammes(
  viewer: LibraryViewer,
  now: Date = new Date(),
): Promise<DirectoryProgramme[]> {
  const rows = await query<Row>(
    `SELECT p.id::text, p.slug, p.name, p.summary, p.programme_type::text AS type,
            p.status::text AS status, p.starts_at, p.ends_at,
            CASE WHEN o.status = 'PUBLISHED' THEN o.slug END AS host_slug,
            CASE WHEN o.status = 'PUBLISHED' THEN o.name END AS host_name,
            (f.programme_id IS NOT NULL) AS has_form
       FROM programmes p
       JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN programme_application_forms f ON f.programme_id = p.id
      WHERE p.status IN ('PUBLISHED', 'CLOSED')
      ORDER BY p.name, p.slug`,
  )
  return rows.map((r) => {
    const startsAt = r.starts_at ? new Date(r.starts_at) : null
    const endsAt = r.ends_at ? new Date(r.ends_at) : null
    const phase = phaseOf(r.status, startsAt, endsAt, now)
    const kind: ProgrammeKind = r.type === 'CHALLENGE' ? 'challenge' : 'programme'
    const host = r.host_slug && r.host_name ? { slug: r.host_slug, name: r.host_name } : null
    const eligible =
      viewer === 'NETWORK' && r.status === 'PUBLISHED' && r.has_form && phase !== 'da-ket-thuc'
    return {
      slug: r.slug,
      name: r.name,
      kind,
      summary: r.summary,
      host,
      phase,
      timeline: timelineOf(startsAt, endsAt),
      startsAt: startsAt?.toISOString() ?? null,
      applyHref: eligible ? applicationRoutes.apply(r.id) : null,
      text: fold([r.name, r.summary, host?.name, kind].filter(Boolean).join(' ')),
    }
  })
}
