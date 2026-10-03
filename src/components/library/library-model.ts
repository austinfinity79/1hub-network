import type { FounderDTO, StartupDTO } from '@/lib/library/library-api'
import type { FoundersBody, ProblemsBody, StartupsBody } from '@/lib/library/library-bodies'
import type { LibraryProblemItem } from '@/lib/library/library-service'
import { PROBLEM_STAGES, type LibraryProblem } from '@/lib/library/problem-adapter'
import type { Category } from '@/lib/library/startup-adapter'
import { fold } from '@/lib/library/startup-adapter'

/**
 * TASK 22-PREVIEW-LIBRARY-FIX / WF06-PROD-04 — the Library's view model. The
 * page draws the answers of `GET /api/v1/library/*` (API §25): `problemCard`,
 * `startupCard` and `founderCard` turn their items into the L15 / L15b / L15c
 * cards, `groupsOf` their facets, and `libraryUrl` builds the one request per
 * tab state. `problemTab`, `matches`, `sortItems` and `facetCount` are the
 * problem file's rules, run on the server by the problems service. Visibility
 * is never decided here. The UI names no data source.
 */

export type Entity = 'PROBLEM' | 'STARTUP' | 'FOUNDER'
export type Tone = 'coral' | 'wine' | 'ember' | 'ash' | 'red' | 'smoke'

/** What a card draws. */
export type Card = {
  id: string
  /** PROBLEM draws the dark L15 card; STARTUP and FOUNDER the white L15b / L15c card. */
  kind: Entity
  tone: Tone
  /** Top-left label next to the round mark (organisation, domain or startup). */
  head: string
  /** Letters inside the round mark; empty for problems (drawn blank). */
  mark: string
  pill: string | null
  title: string
  prize: string | null
  summary: string | null
  meta: string[]
  /** White card: the line under the name ("N thành viên", "role · startup"). */
  sub: string | null
  /** White card: grey chips under the summary. */
  chips: string[]
  /** Founder card: the startup row. */
  row: { mark: string; name: string; note: string | null; href: string | null } | null
  cta: { label: string; href: string | null }
}

/** A problem record with its filter values and sort keys (server side). */
export type Item = Card & {
  facets: Record<string, string[]>
  /** Folded text the search runs on. */
  text: string
  sort: { rank: number; days: number; prize: number; name: string }
}

export type Group = { key: string; title: string; values: Array<{ value: string; label: string }> }
export type CountedGroup = {
  key: string
  title: string
  values: Array<{ value: string; label: string; count: number }>
}
export type SortOption = { key: 'DEADLINE' | 'PRIZE' | 'STAGE' | 'NAME'; label: string }

export type TabModel = {
  entity: Entity
  noun: string
  items: Item[] | null
  groups: Group[]
  sorts: SortOption[]
  /** "Tìm nhanh" chips under the search bar; each toggles a domain filter value. */
  quick: Array<{ value: string; label: string }>
}

export type Filters = Record<string, string[]>

export const CATEGORY_LABEL: Record<Category, string> = {
  LOGISTICS: 'Logistics',
  FINTECH: 'Tài chính số',
  HEALTH: 'Y tế',
  AGRI: 'Nông nghiệp',
  EDU: 'Giáo dục',
  AI: 'AI',
  ENV: 'Môi trường & năng lượng',
  IT: 'CNTT & dữ liệu',
  OTHER: 'Khác',
}

/** Also the problem cover bands 1–6 (`bia_dai_mau_id`), in the pack's card order. */
const TONES: Tone[] = ['coral', 'wine', 'ember', 'ash', 'red', 'smoke']
/** The "Tìm nhanh" categories, in the L15 order. */
export const QUICK_CATEGORIES: Category[] = ['LOGISTICS', 'FINTECH', 'AGRI', 'AI', 'HEALTH']
/** "Sắp hết hạn": open problems first, then judging, upcoming, announced. */
const PROBLEM_RANK: Record<string, number> = {
  dang_mo_nop: 0,
  dang_cham: 1,
  sap_dien_ra: 2,
  cong_bo: 3,
}
/** Problems without a deadline (or a numeric prize) sort after the rest, in dataset order. */
const LAST = Number.MAX_SAFE_INTEGER
/** The page size of every tab ("Xem thêm" adds one more page). */
export const PAGE_SIZE = 9

/** The tabs' fixed parts: noun, sorts (the API's own keys) and facet titles (DEC-L15). */
export const TABS: Record<
  Entity,
  { noun: string; sorts: SortOption[]; titles: Record<string, string> }
> = {
  PROBLEM: {
    noun: 'bài toán',
    sorts: [
      { key: 'DEADLINE', label: 'Sắp hết hạn' },
      { key: 'PRIZE', label: 'Giải thưởng cao nhất' },
    ],
    titles: { domain: 'LĨNH VỰC', stage: 'GIAI ĐOẠN', area: 'ĐỊA BÀN' },
  },
  STARTUP: {
    noun: 'startup',
    sorts: [
      { key: 'STAGE', label: 'Giai đoạn phát triển' },
      { key: 'NAME', label: 'Tên A–Z' },
    ],
    titles: { domain: 'LĨNH VỰC', stage: 'GIAI ĐOẠN' },
  },
  FOUNDER: {
    noun: 'nhà sáng lập',
    sorts: [{ key: 'NAME', label: 'Tên A–Z' }],
    titles: { domain: 'LĨNH VỰC' },
  },
}

/** "Tìm nhanh" on Bài toán: the category labels, matched to the problem tags as text. */
export const PROBLEM_QUICK = QUICK_CATEGORIES.map((c) => ({
  value: CATEGORY_LABEL[c],
  label: CATEGORY_LABEL[c],
}))

/** Stable tone from a key, so a card keeps its colour through filters. */
function toneOf(id: string): Tone {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]!
}

const words = (name: string) =>
  name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * Startup mark as drawn in L15b: two words give their first letters ("Kho Lạnh" → KL),
 * CamelCase its capitals ("LogiSense" → LS), else the first two letters ("Tracely" → Tr).
 */
function startupMark(name: string): string {
  const [first = '', second] = words(name)
  if (second) return `${first[0]}${second[0]}`.toUpperCase()
  const caps = [...first].filter((c) => /\p{Lu}/u.test(c))
  if (caps.length >= 2 && caps.length < first.length) return caps.slice(0, 2).join('')
  return `${first.slice(0, 1).toUpperCase()}${first.slice(1, 2).toLowerCase()}`
}

/** Person mark as drawn in L15c: the last two names ("Đặng Kim Chi" → KC). */
function personMark(name: string): string {
  const w = words(name)
  if (w.length === 1) return w[0]!.slice(0, 2).toUpperCase()
  return w
    .slice(-2)
    .map((x) => x[0]!.toUpperCase())
    .join('')
}

/** Values of one facet in the loaded records: most frequent first, then A–Z. */
function valuesOf(lists: string[][]): Array<{ value: string; label: string }> {
  const counts = new Map<string, number>()
  for (const list of lists) for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'vi'))
    .map(([value]) => ({ value, label: value }))
}

const problemTone = (cover: number | null, id: string): Tone =>
  cover && cover >= 1 && cover <= TONES.length ? TONES[cover - 1]! : toneOf(id)
const problemCta = (stage: string) => ({
  label: stage === 'sap_dien_ra' ? 'Theo dõi bài toán' : 'Xem bài toán',
  href: null,
})

/** The problem file as filterable records (server side: the problems service). */
export function problemTab(problems: LibraryProblem[]): TabModel {
  const items = problems.map<Item>((p) => ({
    id: p.id,
    kind: 'PROBLEM',
    tone: problemTone(p.cover, p.id),
    head: p.org ?? '',
    mark: '',
    pill: p.stageLabel,
    title: p.title,
    prize: p.prize,
    summary: p.summary,
    meta: [p.time, p.teams].filter((m): m is string => m !== null),
    sub: null,
    chips: [],
    row: null,
    cta: problemCta(p.stage),
    facets: { domain: p.domains, stage: [p.stage], area: p.areas },
    text: fold([p.title, p.shortTitle ?? '', p.summary ?? '', p.org ?? '', ...p.domains].join(' ')),
    sort: {
      rank: PROBLEM_RANK[p.stage] ?? PROBLEM_STAGES.length,
      days: p.deadline ?? LAST,
      prize: p.prizeValue ?? -1,
      name: p.title,
    },
  }))
  const known = new Set<string>(PROBLEM_STAGES.map((s) => s.value))
  const extraStages = problems.filter((p) => !known.has(p.stage))
  return {
    entity: 'PROBLEM',
    noun: TABS.PROBLEM.noun,
    items,
    groups: [
      { key: 'domain', title: 'LĨNH VỰC', values: valuesOf(problems.map((p) => p.domains)) },
      {
        key: 'stage',
        title: 'GIAI ĐOẠN',
        values: [
          ...PROBLEM_STAGES,
          ...[...new Map(extraStages.map((p) => [p.stage, p.stageLabel ?? p.stage]))].map(
            ([value, label]) => ({ value, label }),
          ),
        ],
      },
      { key: 'area', title: 'ĐỊA BÀN', values: valuesOf(problems.map((p) => p.areas)) },
    ],
    sorts: TABS.PROBLEM.sorts,
    quick: PROBLEM_QUICK,
  }
}

/** A problem from the API: the dark L15 card; no destination, so no action is drawn. */
export function problemCard(p: LibraryProblemItem): Card {
  return {
    id: p.key,
    kind: 'PROBLEM',
    tone: problemTone(p.cover, p.key),
    head: p.org ?? '',
    mark: '',
    pill: p.stage.label,
    title: p.title,
    prize: p.prize,
    summary: p.summary,
    meta: [p.time, p.teams].filter((m): m is string => m !== null),
    sub: null,
    chips: [],
    row: null,
    cta: problemCta(p.stage.code),
  }
}

/**
 * DEC-L15-D11: the white Startup card. A canonical startup has no website or
 * member count, so its card draws neither (no dead "Xem hồ sơ").
 */
export function startupCard(s: StartupDTO): Card {
  return {
    id: s.key,
    kind: 'STARTUP',
    tone: toneOf(s.key),
    head: s.name,
    mark: startupMark(s.name),
    pill: s.stage?.label ?? null,
    title: s.name,
    prize: null,
    summary: s.summary,
    meta: [],
    sub: s.member_count === null ? null : `${s.member_count} thành viên`,
    chips: s.domain_labels.slice(0, 3),
    row: null,
    // The D7 card link: the startup's own website, or nothing without one.
    cta: { label: 'Xem hồ sơ', href: s.website },
  }
}

/**
 * DEC-L15-D12 / DEC-W6P-D03: the white founder card — a visible owner's name,
 * "role · startup" and the startup row. Only what the API returns is drawn; a
 * hidden founder is simply not in the answer.
 */
export function founderCard(f: FounderDTO): Card {
  const [first, ...others] = f.ventures
  const venture = first?.name ?? ''
  const more = others.length ? ` +${others.length}` : ''
  const role = (first?.role_label ?? '').split(/[,&(/]/)[0]!.trim()
  return {
    id: f.key,
    kind: 'FOUNDER',
    tone: toneOf(f.key),
    head: `${venture}${more}`,
    mark: personMark(f.display_name),
    pill: null,
    title: f.display_name,
    prize: null,
    summary: null,
    meta: [],
    sub: `${role && role.length <= 24 ? role : 'Nhà sáng lập'} · ${venture}`,
    chips: [],
    row: first
      ? {
          mark: startupMark(venture),
          name: `${venture}${more}`,
          note: first.stage?.label ?? null,
          href: null,
        }
      : null,
    cta: { label: 'Xem hồ sơ', href: null },
  }
}

export type TabBody = ProblemsBody | StartupsBody | FoundersBody

/** The cards of one answer. */
export function cardsOf(entity: Entity, body: TabBody): Card[] {
  if (entity === 'PROBLEM') return (body as ProblemsBody).items.map(problemCard)
  if (entity === 'STARTUP') return (body as StartupsBody).items.map(startupCard)
  return (body as FoundersBody).items.map(founderCard)
}

/** The facet groups of one answer, with the API's counts (zero values kept). */
export function groupsOf(entity: Entity, body: TabBody): CountedGroup[] {
  const titles = TABS[entity].titles
  if (entity === 'PROBLEM') {
    const f = (body as ProblemsBody).facets
    return (['domain', 'stage', 'area'] as const).map((key) => ({
      key,
      title: titles[key]!,
      values: f[key],
    }))
  }
  const ids = (values: Array<{ id: string; label: string; count: number }>) =>
    values.map(({ id, label, count }) => ({ value: id, label, count }))
  if (entity === 'STARTUP') {
    const f = (body as StartupsBody).facets
    return [
      { key: 'domain', title: titles.domain!, values: ids(f.domain) },
      { key: 'stage', title: titles.stage!, values: ids(f.stage) },
    ]
  }
  return [
    { key: 'domain', title: titles.domain!, values: ids((body as FoundersBody).facets.domain) },
  ]
}

export type TabQuery = { q: string; filters: Filters; sort: SortOption['key'] }

const ROUTE: Record<Entity, string> = {
  PROBLEM: '/api/v1/library/problems',
  STARTUP: '/api/v1/library/startups',
  FOUNDER: '/api/v1/library/founders',
}
/** Facet group → API parameter: vocabulary ids for canonical tabs, file text for problems. */
const PARAM: Record<Entity, Record<string, string>> = {
  PROBLEM: { domain: 'domain', stage: 'stage', area: 'area' },
  STARTUP: { domain: 'domain_id', stage: 'stage_id' },
  FOUNDER: { domain: 'domain_id' },
}

/**
 * The request for a tab state: parameters in a fixed order, so the same state
 * is always the same URL (it also keys the loaded answer). No id of a record.
 */
export function libraryUrl(entity: Entity, query: TabQuery, cursor?: string): string {
  const params = new URLSearchParams()
  const q = query.q.trim()
  if (q) params.set('q', q)
  for (const group of Object.keys(PARAM[entity]).sort()) {
    for (const value of [...(query.filters[group] ?? [])].sort()) {
      params.append(PARAM[entity][group]!, value)
    }
  }
  params.set('sort', query.sort)
  if (cursor) params.set('cursor', cursor)
  params.set('limit', String(PAGE_SIZE))
  return `${ROUTE[entity]}?${params}`
}

export function matches(item: Item, query: string, filters: Filters): boolean {
  for (const [group, values] of Object.entries(filters)) {
    if (values.length && !(item.facets[group] ?? []).some((v) => values.includes(v))) return false
  }
  const q = fold(query)
  return !q || q.split(/\s+/).every((word) => item.text.includes(word))
}

export function sortItems(items: Item[], key: SortOption['key']): Item[] {
  const out = [...items]
  const byName = (a: Item, b: Item) => a.sort.name.localeCompare(b.sort.name, 'vi')
  if (key === 'PRIZE') return out.sort((a, b) => b.sort.prize - a.sort.prize)
  if (key === 'NAME') return out.sort(byName)
  if (key === 'STAGE') return out.sort((a, b) => a.sort.rank - b.sort.rank || byName(a, b))
  // "Sắp hết hạn": by stage, then the nearest deadline; ties keep the dataset order.
  return out.sort((a, b) => a.sort.rank - b.sort.rank || a.sort.days - b.sort.days)
}

/** Results a facet value would give with the other groups' filters applied. */
export function facetCount(
  items: Item[],
  query: string,
  filters: Filters,
  group: string,
  value: string,
) {
  const probe = { ...filters, [group]: [value] }
  return items.filter((i) => matches(i, query, probe)).length
}
