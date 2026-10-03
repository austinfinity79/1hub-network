import { QUICK_CATEGORIES } from '@/components/library/library-model'

import { vocabularyForLibrary, type LibraryViewer } from './canonical-source'
import { EXTERNAL_CATEGORY_DOMAIN_SLUG } from './external-domain-map'
import {
  founderDTO,
  libraryList,
  normalizeKeyword,
  startupDTO,
  type FounderDTO,
  type StartupDTO,
} from './library-api'
import { PAGE_DEFAULT } from './library-data'
import {
  listLibraryFounders,
  listLibraryProblems,
  listLibraryStartups,
  type FounderQuery,
  type LibraryProblemItem,
  type ProblemQuery,
  type StartupQuery,
} from './library-service'

/**
 * WF06-PROD-03 / 04 — the answers of `GET /api/v1/library/*` (API §25), built
 * once here for the routes and for the first render of `/library`, so the page
 * starts from exactly what the API returns: no second data path, no fixture.
 */

type ListBody<T> = { items: T[]; page: { next_cursor: string | null; limit: number } }
type Count = { count: number }
export type DomainFacet = { id: string; label: string } & Count
export type StageFacet = { id: string; code: string; label: string } & Count
export type TextFacet = { value: string; label: string } & Count

export type StartupsBody = ListBody<StartupDTO> & {
  total: number
  facets: { domain: DomainFacet[]; stage: StageFacet[] }
  degraded: boolean
}
export type FoundersBody = ListBody<FounderDTO> & {
  total: number
  facets: { domain: DomainFacet[] }
  restricted: boolean
}
export type ProblemsBody = ListBody<LibraryProblemItem> & {
  total: number
  facets: Record<'domain' | 'stage' | 'area', TextFacet[]>
}

type Limited = { limit: number }

export async function startupsBody(query: StartupQuery & Limited): Promise<StartupsBody> {
  const result = await listLibraryStartups(query)
  return libraryList(
    result.items.map(startupDTO),
    { nextCursor: result.nextCursor, limit: query.limit },
    {
      total: result.total,
      facets: {
        domain: result.facets.domain.map(({ id, label, count }) => ({ id, label, count })),
        stage: result.facets.stage.map(({ id, code, label, count }) => ({
          id,
          code,
          label,
          count,
        })),
      },
      degraded: result.external !== 'ok',
    },
  )
}

export async function foundersBody(
  viewer: LibraryViewer,
  query: FounderQuery & Limited,
): Promise<FoundersBody> {
  const result = await listLibraryFounders(viewer, query)
  return libraryList(
    result.items.map(founderDTO),
    { nextCursor: result.nextCursor, limit: query.limit },
    {
      total: result.total,
      facets: {
        domain: result.facets.domain.map(({ id, label, count }) => ({ id, label, count })),
      },
      restricted: result.restricted,
    },
  )
}

export function problemsBody(query: ProblemQuery & Limited): ProblemsBody {
  const result = listLibraryProblems(query)
  return libraryList(
    result.items,
    { nextCursor: result.nextCursor, limit: query.limit },
    { total: result.total, facets: result.facets },
  )
}

export type LibraryTabs = {
  PROBLEM: ProblemsBody | null
  STARTUP: StartupsBody | null
  FOUNDER: FoundersBody | null
}

/** What `/library` renders first: the first page of each tab, as the API answers it. */
export type LibraryInitial = {
  /** The keyword the bodies were read with (normalised as the API does). */
  q: string
  bodies: LibraryTabs
  /** Unfiltered totals for the hero metrics and tab counts; null = unknown or not shown. */
  totals: Record<keyof LibraryTabs, number | null>
  openProblems: number | null
  /** "Tìm nhanh" for Startup / Nhà sáng lập: DOMAIN items of the reviewed category map. */
  quickDomains: Array<{ value: string; label: string }>
}

async function safely<T>(run: () => Promise<T> | T): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    // Class only: a tab that cannot be read renders its error state, never a 5xx.
    console.error('library first read failed', (error as Error).name ?? 'Error')
    return null
  }
}

export async function libraryInitial(viewer: LibraryViewer, raw: string): Promise<LibraryInitial> {
  const q = normalizeKeyword(raw)
  const page = { q: q || undefined, limit: PAGE_DEFAULT }
  const all = { limit: 1 }
  const [problems, startups, founders, vocab] = await Promise.all([
    safely(() => problemsBody(page)),
    safely(() => startupsBody(page)),
    safely(() => foundersBody(viewer, page)),
    safely(() => vocabularyForLibrary()),
  ])
  const [allProblems, allStartups, allFounders] = q
    ? await Promise.all([
        safely(() => problemsBody(all)),
        safely(() => startupsBody(all)),
        safely(() => foundersBody(viewer, all)),
      ])
    : [problems, startups, founders]
  const quickDomains = QUICK_CATEGORIES.flatMap((category) => {
    const slug = EXTERNAL_CATEGORY_DOMAIN_SLUG[category]
    const domain = slug ? vocab?.domainsBySlug.get(slug) : undefined
    return domain ? [{ value: domain.id, label: domain.label }] : []
  })
  return {
    q,
    bodies: { PROBLEM: problems, STARTUP: startups, FOUNDER: founders },
    totals: {
      PROBLEM: allProblems?.total ?? null,
      STARTUP: allStartups?.total ?? null,
      FOUNDER: allFounders && !allFounders.restricted ? allFounders.total : null,
    },
    openProblems: allProblems?.facets.stage.find((s) => s.value === 'dang_mo_nop')?.count ?? null,
    quickDomains,
  }
}
