import {
  facetCount,
  matches,
  problemTab,
  sortItems,
  type Filters,
} from '@/components/library/library-model'

import {
  listPublicStartups,
  listVisibleFounders,
  vocabularyForLibrary,
  type LibraryViewer,
  type StageRef,
  type VocabRef,
} from './canonical-source'
import {
  facetCounts,
  filterEntries,
  founderEntries,
  LibraryQueryError,
  mergeStartups,
  opaqueKey,
  paginate,
  sortFounders,
  sortStartups,
  type LibraryFounderItem,
  type LibraryStartupItem,
  type StartupSort,
} from './library-data'
import { LIBRARY_PROBLEMS } from './problem-source'
import { loadStartupDirectory } from './startup-source'

/**
 * WF06-PROD-02 / 03 — the Library read services behind `GET /api/v1/library/*`.
 * Each reads canonical data server side (visibility in SQL), adds the
 * TEMPORARY_EXTERNAL remainder where the frozen contract keeps one, then
 * filters, sorts, counts facets and pages (DEC-W6P-D02 – D04). Filter ids must
 * be ACTIVE vocabulary items (`LibraryQueryError` otherwise). Read-only.
 */

type Page = { cursor?: string; limit?: number }

export type StartupQuery = Page & {
  q?: string
  domainIds?: string[]
  stageIds?: string[]
  sort?: StartupSort
}

export type FounderQuery = Page & { q?: string; domainIds?: string[] }

export type Counted<T> = T & { count: number }

function knownIds(field: string, ids: readonly string[] | undefined, known: Iterable<VocabRef>) {
  const allowed = new Set([...known].map((v) => v.id))
  if (ids?.some((id) => !allowed.has(id))) throw new LibraryQueryError(field, 'unknown')
}

/** Startups: canonical PUBLIC ones plus external records with no canonical equivalent. */
export async function listLibraryStartups(query: StartupQuery = {}): Promise<{
  items: LibraryStartupItem[]
  nextCursor: string | null
  total: number
  facets: { domain: Counted<VocabRef>[]; stage: Counted<StageRef>[] }
  external: 'ok' | 'unavailable'
}> {
  const [canonical, vocab, directory] = await Promise.all([
    listPublicStartups(),
    vocabularyForLibrary(),
    loadStartupDirectory(),
  ])
  knownIds('domain_id', query.domainIds, vocab.domainsBySlug.values())
  knownIds('stage_id', query.stageIds, vocab.stagesByCode.values())
  const external = directory.status === 'ok' ? directory.startups : []
  const entries = mergeStartups(canonical, external, vocab)
  const sorted = sortStartups(filterEntries(entries, query), query.sort ?? 'STAGE')
  return {
    ...paginate(sorted, query.cursor, query.limit),
    total: sorted.length,
    facets: {
      domain: facetCounts(entries, query, 'domain', [...vocab.domainsBySlug.values()]),
      stage: facetCounts(entries, query, 'stage', [...vocab.stagesByCode.values()]),
    },
    external: directory.status === 'ok' ? 'ok' : 'unavailable',
  }
}

/**
 * Founders: canonical owners only (external founders are never shown,
 * DEC-W6P-D03). A guest gets `restricted: true` and no item, before any read.
 */
export async function listLibraryFounders(
  viewer: LibraryViewer,
  query: FounderQuery = {},
): Promise<{
  items: LibraryFounderItem[]
  nextCursor: string | null
  total: number
  facets: { domain: Counted<VocabRef>[] }
  restricted: boolean
}> {
  if (viewer !== 'NETWORK') {
    return { items: [], nextCursor: null, total: 0, facets: { domain: [] }, restricted: true }
  }
  const [founders, vocab] = await Promise.all([listVisibleFounders(viewer), vocabularyForLibrary()])
  knownIds('domain_id', query.domainIds, vocab.domainsBySlug.values())
  const entries = founderEntries(founders)
  const sorted = sortFounders(filterEntries(entries, query))
  return {
    ...paginate(sorted, query.cursor, query.limit),
    total: sorted.length,
    facets: { domain: facetCounts(entries, query, 'domain', [...vocab.domainsBySlug.values()]) },
    restricted: false,
  }
}

export type ProblemSort = 'DEADLINE' | 'PRIZE'
export type ProblemGroup = 'domain' | 'stage' | 'area'
export type ProblemQuery = Page & {
  q?: string
  values?: Partial<Record<ProblemGroup, string[]>>
  sort?: ProblemSort
}

export type LibraryProblemItem = {
  key: string
  title: string
  summary: string | null
  org: string | null
  stage: { code: string; label: string | null }
  prize: string | null
  time: string | null
  teams: string | null
  domains: string[]
  areas: string[]
  cover: number | null
}

type ProblemFacets = Record<ProblemGroup, Array<{ value: string; label: string; count: number }>>

const PROBLEM_TAB = problemTab(LIBRARY_PROBLEMS)
const PROBLEMS_BY_ID = new Map(LIBRARY_PROBLEMS.map((p) => [p.id, p]))

/**
 * "Bài toán": the TEMPORARY_EXTERNAL file, filtered, sorted and counted by the
 * page's own rules (`matches`, `sortItems`, `facetCount`). Its facet values are
 * the file's own text, not canonical ids: a value the file does not hold
 * matches nothing (as a quick chip does on the page today). The file's ids and
 * challenge references stay here.
 */
export function listLibraryProblems(query: ProblemQuery = {}): {
  items: LibraryProblemItem[]
  nextCursor: string | null
  total: number
  facets: ProblemFacets
} {
  const filters: Filters = {}
  for (const group of PROBLEM_TAB.groups) {
    const values = query.values?.[group.key as ProblemGroup] ?? []
    if (values.length) filters[group.key] = values
  }
  const all = PROBLEM_TAB.items ?? []
  const q = query.q ?? ''
  const sorted = sortItems(
    all.filter((i) => matches(i, q, filters)),
    query.sort ?? 'DEADLINE',
  )
  const page = paginate(sorted, query.cursor, query.limit)
  const facets = Object.fromEntries(
    PROBLEM_TAB.groups.map((g) => [
      g.key,
      g.values.map((v) => ({ ...v, count: facetCount(all, q, filters, g.key, v.value) })),
    ]),
  ) as ProblemFacets
  return {
    items: page.items.map((i) => {
      const p = PROBLEMS_BY_ID.get(i.id)!
      return {
        key: opaqueKey('problem', p.id),
        title: p.title,
        summary: p.summary,
        org: p.org,
        stage: { code: p.stage, label: p.stageLabel },
        prize: p.prize,
        time: p.time,
        teams: p.teams,
        domains: p.domains,
        areas: p.areas,
        cover: p.cover,
      }
    }),
    nextCursor: page.nextCursor,
    total: sorted.length,
    facets,
  }
}
