import { createHash } from 'node:crypto'

import type {
  CanonicalFounderRow,
  CanonicalStartupRow,
  StageRef,
  VocabRef,
} from './canonical-source'
import { externalDomains } from './external-domain-map'
import { LIBRARY_QUERY_MAX } from './query'
import { fold, STAGE_LABEL, type LibraryStartup, type StartupStage } from './startup-adapter'

/**
 * WF06-PROD-02 — the Library's data rules, pure (no I/O): canonical rows and
 * the TEMPORARY_EXTERNAL remainder become one list (DEC-W6P-D02), then the
 * frozen filters, the existing deterministic sorts and an opaque page cursor
 * apply (DEC-W6P-D04). Items carry provenance and no id, slug or owner id.
 * No score, ranking, personalisation or founder-name search exists here.
 * WF06-PROD-03: a filter group takes several values (any of them, as the
 * existing facets do), and facet counts follow the same rule as the page's.
 */

export type Provenance = 'CANONICAL' | 'TEMPORARY_EXTERNAL'

export type LibraryStartupItem = {
  key: string
  provenance: Provenance
  name: string
  summary: string | null
  stage: { code: StartupStage; label: string } | null
  /** Canonical DOMAIN items (the facet values; ids are vocabulary ids, not records). */
  domains: VocabRef[]
  /** Labels as shown on the card: canonical labels, or the external text as written. */
  domainLabels: string[]
  region: string | null
  /** External records only (canonical ventures have no website field). */
  website: string | null
  memberCount: number | null
}

export type LibraryFounderItem = {
  key: string
  displayName: string
  avatarUrl: string | null
  ventures: Array<{
    name: string
    roleLabel: string | null
    stage: { code: StartupStage; label: string } | null
  }>
  domainIds: string[]
}

/** An item with its server-side search text and filter values (never serialised). */
export type LibraryEntry<T> = { item: T; text: string; stageId: string | null; domainIds: string[] }

export type StartupSort = 'STAGE' | 'NAME'
export const PAGE_DEFAULT = 9
export const PAGE_MAX = 50

/** "Giai đoạn phát triển": the most advanced stage first, then no stage (DEC-2909-L2H2). */
const STAGE_ORDER: StartupStage[] = ['GROWTH', 'SELLING', 'PILOT', 'MVP', 'IDEA']

/** A stable, non-reversible key for a record; no id or source slug leaves the server. */
export function opaqueKey(
  kind: 'venture' | 'founder' | 'external' | 'problem',
  id: string,
): string {
  return createHash('sha256').update(`wf06:${kind}:${id}`).digest('hex').slice(0, 16)
}

export type LibraryVocabulary = {
  domainsBySlug: ReadonlyMap<string, VocabRef>
  stagesByCode: ReadonlyMap<StartupStage, StageRef>
}

function canonicalEntry(row: CanonicalStartupRow): LibraryEntry<LibraryStartupItem> {
  const labels = row.domains.map((d) => d.label)
  return {
    item: {
      key: opaqueKey('venture', row.ventureId),
      provenance: 'CANONICAL',
      name: row.name,
      summary: row.summary,
      stage: row.stage ? { code: row.stage.code, label: row.stage.label } : null,
      domains: row.domains,
      domainLabels: labels,
      region: row.region?.label ?? null,
      website: null,
      memberCount: null,
    },
    text: fold([row.name, row.summary ?? '', ...labels].join(' ')),
    stageId: row.stage?.id ?? null,
    domainIds: row.domains.map((d) => d.id),
  }
}

function externalEntry(
  s: LibraryStartup,
  vocab: LibraryVocabulary,
): LibraryEntry<LibraryStartupItem> {
  const stage = s.stage ? vocab.stagesByCode.get(s.stage) : undefined
  const domains = externalDomains(s.categories, vocab.domainsBySlug)
  return {
    item: {
      key: opaqueKey('external', s.id),
      provenance: 'TEMPORARY_EXTERNAL',
      name: s.name,
      summary: s.tagline,
      stage: s.stage ? { code: s.stage, label: stage?.label ?? STAGE_LABEL[s.stage] } : null,
      domains,
      domainLabels: s.domains,
      region: null,
      website: s.website,
      memberCount: s.memberCount,
    },
    // Founder names are never searchable (DEC-W6P-D03).
    text: fold([s.name, s.tagline ?? '', s.product ?? '', ...s.domains].join(' ')),
    stageId: stage?.id ?? null,
    domainIds: domains.map((d) => d.id),
  }
}

/**
 * Canonical startups, then the external records without a canonical equivalent:
 * an external record is suppressed when a canonical startup has the same folded
 * name, and a repeated external name keeps its first record only.
 */
export function mergeStartups(
  canonical: readonly CanonicalStartupRow[],
  external: readonly LibraryStartup[],
  vocab: LibraryVocabulary,
): LibraryEntry<LibraryStartupItem>[] {
  const seen = new Set(canonical.map((c) => fold(c.name)))
  const out = canonical.map(canonicalEntry)
  for (const s of external) {
    const name = fold(s.name)
    if (seen.has(name)) continue
    seen.add(name)
    out.push(externalEntry(s, vocab))
  }
  return out
}

export function founderEntries(
  rows: readonly CanonicalFounderRow[],
): LibraryEntry<LibraryFounderItem>[] {
  return rows.map((f) => ({
    item: {
      key: opaqueKey('founder', f.profileId),
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      ventures: f.ventures.map((v) => ({
        name: v.name,
        roleLabel: v.roleLabel,
        stage: v.stage ? { code: v.stage.code, label: v.stage.label } : null,
      })),
      domainIds: f.domainIds,
    },
    text: fold([f.displayName, ...f.ventures.map((v) => v.name)].join(' ')),
    stageId: null,
    domainIds: f.domainIds,
  }))
}

export type LibraryFilter = {
  q?: string
  /** Any of these DOMAIN ids; none means no domain filter. */
  domainIds?: readonly string[]
  /** Any of these VENTURE_STAGE ids; none means no stage filter. */
  stageIds?: readonly string[]
}

const keywordWords = (q: string | undefined) =>
  fold((q ?? '').slice(0, LIBRARY_QUERY_MAX))
    .split(/\s+/)
    .filter(Boolean)

const inDomains = (e: LibraryEntry<unknown>, ids?: readonly string[]) =>
  !ids?.length || e.domainIds.some((id) => ids.includes(id))
const inStages = (e: LibraryEntry<unknown>, ids?: readonly string[]) =>
  !ids?.length || (e.stageId !== null && ids.includes(e.stageId))

/**
 * Every word of the keyword must appear (the existing Library rule); within a
 * filter group any value matches, and the groups combine (as the page's facets).
 */
export function filterEntries<T>(
  entries: readonly LibraryEntry<T>[],
  filter: LibraryFilter,
): LibraryEntry<T>[] {
  const words = keywordWords(filter.q)
  return entries.filter(
    (e) =>
      inDomains(e, filter.domainIds) &&
      inStages(e, filter.stageIds) &&
      words.every((w) => e.text.includes(w)),
  )
}

/**
 * Results each value of a group would give with the keyword and the OTHER
 * group's filter applied (the page's `facetCount` rule); every listed value is
 * returned, in the order given, zero counts included.
 */
export function facetCounts<V extends { id: string }>(
  entries: readonly LibraryEntry<unknown>[],
  filter: LibraryFilter,
  group: 'domain' | 'stage',
  values: readonly V[],
): Array<V & { count: number }> {
  const words = keywordWords(filter.q)
  const base = entries.filter(
    (e) =>
      words.every((w) => e.text.includes(w)) &&
      (group === 'domain' ? inStages(e, filter.stageIds) : inDomains(e, filter.domainIds)),
  )
  const has = (e: LibraryEntry<unknown>, id: string) =>
    group === 'domain' ? e.domainIds.includes(id) : e.stageId === id
  return values.map((v) => ({ ...v, count: base.filter((e) => has(e, v.id)).length }))
}

const byName = (a: string, b: string) => a.localeCompare(b, 'vi')
const stageRank = (item: LibraryStartupItem) =>
  item.stage ? STAGE_ORDER.indexOf(item.stage.code) : STAGE_ORDER.length

/** The existing sorts, made total: provenance (canonical first) and key break ties. */
export function sortStartups(
  entries: readonly LibraryEntry<LibraryStartupItem>[],
  sort: StartupSort,
): LibraryStartupItem[] {
  return entries
    .map((e) => e.item)
    .sort(
      (a, b) =>
        (sort === 'STAGE' ? stageRank(a) - stageRank(b) : 0) ||
        byName(a.name, b.name) ||
        (a.provenance === b.provenance ? 0 : a.provenance === 'CANONICAL' ? -1 : 1) ||
        a.key.localeCompare(b.key),
    )
}

export function sortFounders(
  entries: readonly LibraryEntry<LibraryFounderItem>[],
): LibraryFounderItem[] {
  return entries
    .map((e) => e.item)
    .sort((a, b) => byName(a.displayName, b.displayName) || a.key.localeCompare(b.key))
}

/** A query value the Library cannot serve: malformed, or not a value it holds. */
export class LibraryQueryError extends Error {
  constructor(
    readonly field: string,
    readonly reason: 'invalid' | 'unknown' = 'invalid',
  ) {
    super(`Invalid ${field}`)
  }
}

const encodeCursor = (offset: number) => Buffer.from(`o:${offset}`).toString('base64url')

function decodeCursor(cursor: string): number {
  const text = Buffer.from(cursor, 'base64url').toString()
  const match = /^o:(\d{1,6})$/.exec(text)
  if (!match || encodeCursor(Number(match[1])) !== cursor)
    throw new LibraryQueryError('cursor', 'invalid')
  return Number(match[1])
}

/** One page: limit 9 by default, at most 50; an opaque cursor; never the whole list. */
export function paginate<T>(
  items: readonly T[],
  cursor?: string,
  limit?: number,
): { items: T[]; nextCursor: string | null } {
  const size = Number.isInteger(limit) && limit! >= 1 ? Math.min(limit!, PAGE_MAX) : PAGE_DEFAULT
  const offset = cursor ? decodeCursor(cursor) : 0
  const page = items.slice(offset, offset + size)
  const next = offset + size
  return { items: page, nextCursor: next < items.length ? encodeCursor(next) : null }
}
