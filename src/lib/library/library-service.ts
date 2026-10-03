import {
  listPublicStartups,
  listVisibleFounders,
  vocabularyForLibrary,
  type LibraryViewer,
} from './canonical-source'
import {
  filterEntries,
  founderEntries,
  mergeStartups,
  paginate,
  sortFounders,
  sortStartups,
  type LibraryFounderItem,
  type LibraryStartupItem,
  type StartupSort,
} from './library-data'
import { loadStartupDirectory } from './startup-source'

/**
 * WF06-PROD-02 — the Library read services the WF06-PROD-03 API will call.
 * Each reads canonical data server side (visibility in SQL), adds the
 * TEMPORARY_EXTERNAL remainder where the frozen contract keeps one, then
 * filters, sorts and pages (DEC-W6P-D02 – D04). Read-only; no HTTP here.
 */

export type StartupQuery = {
  q?: string
  domainId?: string
  stageId?: string
  sort?: StartupSort
  cursor?: string
  limit?: number
}

/** Startups: canonical PUBLIC ones plus external records with no canonical equivalent. */
export async function listLibraryStartups(query: StartupQuery = {}): Promise<{
  items: LibraryStartupItem[]
  nextCursor: string | null
  total: number
  external: 'ok' | 'unavailable'
}> {
  const [canonical, vocab, directory] = await Promise.all([
    listPublicStartups(),
    vocabularyForLibrary(),
    loadStartupDirectory(),
  ])
  const external = directory.status === 'ok' ? directory.startups : []
  const matched = filterEntries(mergeStartups(canonical, external, vocab), query)
  const sorted = sortStartups(matched, query.sort ?? 'STAGE')
  return {
    ...paginate(sorted, query.cursor, query.limit),
    total: sorted.length,
    external: directory.status === 'ok' ? 'ok' : 'unavailable',
  }
}

/**
 * Founders: canonical owners only (external founders are never shown,
 * DEC-W6P-D03). A guest gets `restricted: true` and no item.
 */
export async function listLibraryFounders(
  viewer: LibraryViewer,
  query: Omit<StartupQuery, 'stageId' | 'sort'> = {},
): Promise<{
  items: LibraryFounderItem[]
  nextCursor: string | null
  total: number
  restricted: boolean
}> {
  if (viewer !== 'NETWORK') return { items: [], nextCursor: null, total: 0, restricted: true }
  const sorted = sortFounders(
    filterEntries(founderEntries(await listVisibleFounders(viewer)), query),
  )
  return { ...paginate(sorted, query.cursor, query.limit), total: sorted.length, restricted: false }
}
