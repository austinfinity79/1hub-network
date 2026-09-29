import { PROBLEM_STAGES, type LibraryProblem } from '@/lib/library/problem-adapter'
import type {
  Category,
  LibraryFounder,
  LibraryStartup,
  StartupDirectory,
} from '@/lib/library/startup-adapter'
import { STAGE_LABEL, STAGES, fold } from '@/lib/library/startup-adapter'

/**
 * TASK 22-PREVIEW-LIBRARY-FIX — one view model for the three Library tabs, so
 * the directory, facets, chips, sort and cards render the same way whatever
 * the source (DEC-L15-D7): "Bài toán" = the problem dataset (problem-adapter,
 * LIBRARY DATA UPDATE), "Startup" and "Nhà sáng lập" = startup.json through
 * the adapter. The UI names no data source.
 */

export type Entity = 'PROBLEM' | 'STARTUP' | 'FOUNDER'
export type Tone = 'coral' | 'wine' | 'ember' | 'ash' | 'red' | 'smoke'

export type Item = {
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
  /** White card: the outlined second button (inert: no follow / connect contract). */
  secondary: string | null
  facets: Record<string, string[]>
  /** Folded text the search runs on. */
  text: string
  sort: { rank: number; days: number; prize: number; name: string }
}

export type Group = { key: string; title: string; values: Array<{ value: string; label: string }> }
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

const CATEGORY_ORDER: Category[] = [
  'LOGISTICS',
  'FINTECH',
  'HEALTH',
  'AGRI',
  'EDU',
  'AI',
  'ENV',
  'IT',
  'OTHER',
]
/** Also the problem cover bands 1–6 (`bia_dai_mau_id`), in the pack's card order. */
const TONES: Tone[] = ['coral', 'wine', 'ember', 'ash', 'red', 'smoke']
const QUICK: Category[] = ['LOGISTICS', 'FINTECH', 'AGRI', 'AI', 'HEALTH']
const NO_STAGE = 'NONE'
/** "Giai đoạn phát triển": the most advanced stage first (DEC-2909-L2H2). */
const STAGE_RANK: Record<string, number> = {
  GROWTH: 0,
  SELLING: 1,
  PILOT: 2,
  MVP: 3,
  IDEA: 4,
}
/** "Sắp hết hạn": open problems first, then judging, upcoming, announced. */
const PROBLEM_RANK: Record<string, number> = {
  dang_mo_nop: 0,
  dang_cham: 1,
  sap_dien_ra: 2,
  cong_bo: 3,
}
/** Problems without a deadline (or a numeric prize) sort after the rest, in dataset order. */
const LAST = Number.MAX_SAFE_INTEGER

/** Stable tone from an id, so a card keeps its colour through filters. */
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

const domainGroup = (values: string[]): Group => ({
  key: 'domain',
  title: 'LĨNH VỰC',
  values: values.map((v) => ({ value: v, label: CATEGORY_LABEL[v as Category] })),
})

/** Values of one facet in the loaded records: most frequent first, then A–Z. */
function valuesOf(lists: string[][]): Array<{ value: string; label: string }> {
  const counts = new Map<string, number>()
  for (const list of lists) for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'vi'))
    .map(([value]) => ({ value, label: value }))
}

export function problemTab(problems: LibraryProblem[]): TabModel {
  const items = problems.map<Item>((p) => ({
    id: p.id,
    kind: 'PROBLEM',
    tone: p.cover && p.cover >= 1 && p.cover <= TONES.length ? TONES[p.cover - 1]! : toneOf(p.id),
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
    secondary: null,
    cta: {
      label: p.stage === 'sap_dien_ra' ? 'Theo dõi bài toán' : 'Xem bài toán',
      href: null,
    },
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
    noun: 'bài toán',
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
    sorts: [
      { key: 'DEADLINE', label: 'Sắp hết hạn' },
      { key: 'PRIZE', label: 'Giải thưởng cao nhất' },
    ],
    // Same chips as the other tabs, matched to the problem tags by their label.
    quick: QUICK.map((c) => ({ value: CATEGORY_LABEL[c], label: CATEGORY_LABEL[c] })),
  }
}

const categoryQuick = QUICK.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))

/** DEC-L15-D11: only what startup.json holds; no verified mark, city, needs or programmes. */
function startupItem(s: LibraryStartup): Item {
  const stage = s.stage ?? NO_STAGE
  return {
    id: s.id,
    kind: 'STARTUP',
    tone: toneOf(s.id),
    head: s.name,
    mark: startupMark(s.name),
    pill: s.stage ? STAGE_LABEL[s.stage] : null,
    title: s.name,
    prize: null,
    summary: s.tagline,
    meta: [],
    sub: `${s.memberCount} thành viên`,
    chips: s.domains.slice(0, 3),
    row: null,
    // The D7 card link: the startup's own website, or inert without one.
    cta: { label: 'Xem hồ sơ', href: s.website },
    secondary: 'Theo dõi',
    facets: { domain: s.categories, stage: [stage] },
    text: fold(
      [s.name, s.tagline ?? '', s.product ?? '', ...s.domains, ...s.founderNames].join(' '),
    ),
    sort: { rank: STAGE_RANK[stage] ?? 5, days: 0, prize: 0, name: s.name },
  }
}

/** DEC-L15-D12: name, role and startup only; founders are not accounts. */
function founderItem(f: LibraryFounder): Item {
  const first = f.startups[0]!
  const more = f.startups.length > 1 ? ` +${f.startups.length - 1}` : ''
  const short = f.role.split(/[,&(/]/)[0]!.trim()
  return {
    id: f.id,
    kind: 'FOUNDER',
    tone: toneOf(f.id),
    head: `${first.name}${more}`,
    mark: personMark(f.name),
    pill: null,
    title: f.name,
    prize: null,
    summary: null,
    meta: [],
    sub: `${short.length <= 24 ? short : 'Nhà sáng lập'} · ${first.name}`,
    chips: [],
    row: {
      mark: startupMark(first.name),
      name: `${first.name}${more}`,
      note: first.stage ? STAGE_LABEL[first.stage] : null,
      href: first.website,
    },
    cta: { label: 'Xem hồ sơ', href: null },
    secondary: 'Kết nối',
    facets: { domain: f.categories },
    text: fold([f.name, f.role, ...f.startups.map((s) => s.name)].join(' ')),
    sort: { rank: 0, days: 0, prize: 0, name: f.name },
  }
}

export function startupTab(dir: StartupDirectory): TabModel {
  const base = {
    entity: 'STARTUP' as const,
    noun: 'startup',
    quick: categoryQuick,
    sorts: [
      { key: 'STAGE' as const, label: 'Giai đoạn phát triển' },
      { key: 'NAME' as const, label: 'Tên A–Z' },
    ],
    groups: [
      domainGroup(CATEGORY_ORDER),
      {
        key: 'stage',
        title: 'GIAI ĐOẠN',
        values: [
          ...STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
          // No or unmapped source value: counted under no stage (DEC-2909-L2H2).
          { value: NO_STAGE, label: 'Chưa xác định' },
        ],
      },
    ],
  }
  return { ...base, items: dir.status === 'ok' ? dir.startups.map(startupItem) : null }
}

export function founderTab(dir: StartupDirectory): TabModel {
  return {
    entity: 'FOUNDER',
    noun: 'nhà sáng lập',
    quick: categoryQuick,
    sorts: [{ key: 'NAME', label: 'Tên A–Z' }],
    groups: [domainGroup(CATEGORY_ORDER)],
    items: dir.status === 'ok' ? dir.founders.map(founderItem) : null,
  }
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
