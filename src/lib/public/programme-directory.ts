import { PROGRAMME_CARDS } from '@/components/home/home-content'
import { fold } from '@/lib/library/startup-adapter'

import { PAST_PROGRAMMES } from './programme-event-source'

import type { ProgrammeKind, ProgrammePhase } from './programme-phase'

/**
 * PROGRAMME-PRESENTATION-DATA-01 — `/programmes` lists the approved,
 * source-backed programmes only: the refreshed workbook's programmes that the
 * homepage already shows (`PROGRAMME_CARDS`, one source for both pages). The
 * deployed programme rows are fixtures (Internal Alpha, "(demo)", a sample
 * chapter) and are no longer projected publicly.
 *
 * Every field is the sheet's value; an empty one stays empty: no dates (so no
 * timeline and no derived phase), the sheet's own status ("Sắp công bố") as
 * the phase, the "Chủ quản" text as the host, and no apply entry (no
 * programme record behind the row), so each card is READ_ONLY.
 *
 * S2-PROGRAMME-EVENT-CONTENT-01: the cards carry their approved cover (the
 * homepage covers, the same Drive files the programme sheet links), and the
 * sheet's finished programmes ("Đã kết thúc") follow, with their own cover
 * and organisers; they have no type and no dates in the source, so none is
 * shown. The type and host filters are gone (Sprint 2 feedback).
 */

export type DirectoryProgramme = {
  /** The public slug: React key and nothing more (no detail route). */
  slug: string
  name: string
  /** The sheet's "Tag phân loại"; null where the source has none. */
  kind: ProgrammeKind | null
  summary: string | null
  /** "Chủ quản" / "Đơn vị tổ chức", one organiser per entry. */
  hosts: string[]
  /** The approved 16:9 cover, or null (never a stand-in). */
  image: string | null
  phase: ProgrammePhase
  /** "dd/mm/yyyy – dd/mm/yyyy" in Viet Nam time, or null without dates. */
  timeline: string | null
  /** ISO start, for ordering only; null sorts last. */
  startsAt: string | null
  /** The L5 entry for an eligible viewer, else null (READ_ONLY). */
  applyHref: string | null
  /** Folded search text: name, summary, organisers, type. */
  text: string
}

const slugOf = (text: string) =>
  fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The sheet's "Tag phân loại" → the directory type ("Cuộc thi" is a challenge). */
const KIND_OF: Record<string, ProgrammeKind> = {
  'Cuộc thi': 'challenge',
  'Chương trình': 'programme',
}

/** The sheet's "Trạng thái", as written → its phase key. */
const PHASE_OF: Record<string, ProgrammePhase> = {
  'Sắp công bố': 'sap-cong-bo',
  'Đã kết thúc': 'da-ket-thuc',
}

export function listPublicProgrammes(): DirectoryProgramme[] {
  const current = PROGRAMME_CARDS.flatMap((c) => {
    const kind = KIND_OF[c.kind]
    const phase = PHASE_OF[c.status]
    // A row whose type or status has no directory value is left out, never guessed.
    if (!kind || !phase) return []
    const hosts = c.owner ? [c.owner] : []
    return [
      {
        slug: slugOf(c.title),
        name: c.title,
        kind,
        summary: c.description,
        hosts,
        image: c.image?.src ?? null,
        phase,
        timeline: c.period,
        startsAt: null,
        applyHref: null,
        text: fold([c.title, c.description, ...hosts, kind].filter(Boolean).join(' ')),
      },
    ]
  })
  const past = PAST_PROGRAMMES.map((p): DirectoryProgramme => ({
    slug: p.slug,
    name: p.title,
    kind: null,
    summary: p.description,
    hosts: p.owners,
    image: p.image,
    phase: 'da-ket-thuc',
    timeline: null,
    startsAt: null,
    applyHref: null,
    text: fold([p.title, p.description, ...p.owners].filter(Boolean).join(' ')),
  }))
  return [...current, ...past]
}
