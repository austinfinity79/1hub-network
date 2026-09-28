import type {
  Category,
  LibraryFounder,
  LibraryStartup,
  StartupDirectory,
} from '@/lib/library/startup-adapter'
import { STAGES, fold } from '@/lib/library/startup-adapter'

import {
  AREA_LABEL,
  DOMAIN_LABEL,
  FACETS,
  PROBLEMS,
  STAGE_LABEL,
  type Problem,
} from './library-data'

/**
 * TASK 22-PREVIEW-LIBRARY-FIX — one view model for the three Library tabs, so
 * the directory, facets, chips, sort and cards render the same way whatever
 * the source (DEC-L15-D7): "Bài toán" = DEMO FIXTURE (library-data.ts),
 * "Startup" and "Nhà sáng lập" = startup.json through the adapter.
 */

export type Entity = 'PROBLEM' | 'STARTUP' | 'FOUNDER'
export type Tone = 'coral' | 'wine' | 'ember' | 'ash' | 'red' | 'smoke'

export type Item = {
  id: string
  tone: Tone
  /** Top-left label next to the round mark (organisation, domain or startup). */
  head: string
  /** Letters inside the round mark; empty for the demo problems (drawn blank). */
  mark: string
  pill: string | null
  title: string
  prize: string | null
  summary: string | null
  meta: string[]
  cta: { label: string; href: string | null }
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
  source: 'DEMO' | 'REMOTE'
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
const TONES: Tone[] = ['coral', 'wine', 'ember', 'ash', 'red', 'smoke']
const NO_STAGE = 'NONE'
const STAGE_RANK: Record<string, number> = {
  'Scale-up': 0,
  Growth: 1,
  MVP: 2,
  Prototype: 3,
  Ideation: 4,
}
const STAGE_ORDER: Record<Problem['stage'], number> = {
  OPEN: 0,
  JUDGING: 1,
  UPCOMING: 2,
  ANNOUNCED: 3,
}

/** Stable tone from an id, so a card keeps its colour through filters. */
function toneOf(id: string): Tone {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]!
}

const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

const domainGroup = (values: string[]): Group => ({
  key: 'domain',
  title: 'LĨNH VỰC',
  values: values.map((v) => ({ value: v, label: CATEGORY_LABEL[v as Category] })),
})

export function problemTab(): TabModel {
  const items = PROBLEMS.map<Item>((p) => ({
    id: p.id,
    tone: p.tone,
    head: p.org,
    mark: '',
    pill: STAGE_LABEL[p.stage],
    title: p.title,
    prize: p.prize ?? '–',
    summary: p.summary,
    meta: [p.time, p.teams],
    cta: { label: p.stage === 'UPCOMING' ? 'Theo dõi bài toán' : 'Xem bài toán', href: null },
    facets: { domain: p.domains, stage: [p.stage], area: [p.area] },
    text: fold([p.title, p.org, p.summary, ...p.domains.map((d) => DOMAIN_LABEL[d])].join(' ')),
    sort: {
      rank: STAGE_ORDER[p.stage],
      days: p.daysLeft ?? 999,
      prize: p.prize ? Number.parseInt(p.prize, 10) : -1,
      name: p.title,
    },
  }))
  return {
    entity: 'PROBLEM',
    noun: 'bài toán',
    items,
    source: 'DEMO',
    groups: [
      domainGroup(FACETS.domain),
      {
        key: 'stage',
        title: 'GIAI ĐOẠN',
        values: FACETS.stage.map((v) => ({ value: v, label: STAGE_LABEL[v] })),
      },
      {
        key: 'area',
        title: 'ĐỊA BÀN',
        values: FACETS.area.map((v) => ({ value: v, label: AREA_LABEL[v] })),
      },
    ],
    sorts: [
      { key: 'DEADLINE', label: 'Sắp hết hạn' },
      { key: 'PRIZE', label: 'Giải thưởng cao nhất' },
    ],
  }
}

function startupItem(s: LibraryStartup): Item {
  const stage = s.stage ?? NO_STAGE
  return {
    id: s.id,
    tone: toneOf(s.id),
    head: s.domains[0] ?? CATEGORY_LABEL[s.categories[0]!],
    mark: initials(s.name),
    pill: s.stage,
    title: s.name,
    prize: null,
    summary: s.tagline,
    meta: [...s.domains.slice(0, 2), `${s.memberCount} thành viên`],
    cta: { label: 'Xem startup', href: s.website },
    facets: { domain: s.categories, stage: [stage] },
    text: fold([s.name, s.tagline ?? '', ...s.domains].join(' ')),
    sort: { rank: STAGE_RANK[stage] ?? 5, days: 0, prize: 0, name: s.name },
  }
}

function founderItem(f: LibraryFounder): Item {
  const first = f.startups[0]!
  const more = f.startups.length > 1 ? ` +${f.startups.length - 1}` : ''
  const short = f.role.split(/[,&(/]/)[0]!.trim()
  return {
    id: f.id,
    tone: toneOf(f.id),
    head: `${first.name}${more}`,
    mark: initials(f.name),
    pill: short.length <= 18 ? short : 'Nhà sáng lập',
    title: f.name,
    prize: null,
    summary: `${f.role} · ${f.startups.map((s) => s.name).join(', ')}`,
    meta: f.categories.slice(0, 2).map((c) => CATEGORY_LABEL[c]),
    cta: { label: 'Xem startup', href: first.website },
    facets: { domain: f.categories },
    text: fold([f.name, f.role, ...f.startups.map((s) => s.name)].join(' ')),
    sort: { rank: 0, days: 0, prize: 0, name: f.name },
  }
}

export function startupTab(dir: StartupDirectory): TabModel {
  const base = {
    entity: 'STARTUP' as const,
    noun: 'startup',
    source: 'REMOTE' as const,
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
          ...[...STAGES].reverse().map((s) => ({ value: s, label: s })),
          { value: NO_STAGE, label: 'Chưa cập nhật' },
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
    source: 'REMOTE',
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
  // "Sắp hết hạn": open problems by days left, then judging, upcoming, announced.
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
