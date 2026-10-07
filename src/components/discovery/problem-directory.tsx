'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'

import { PARAM, matchesQuery } from '@/lib/public/discovery-query'
import { PROBLEM_SORTS, type ProblemSort } from '@/lib/public/discovery-sorts'
import { readProblemView, type ProblemView } from '@/lib/public/discovery-views'
import { PROBLEM_STAGES as STAGES } from '@/lib/library/problem-adapter'
import type { DirectoryProblem } from '@/lib/public/problem-directory'

import {
  ActiveFilters,
  CheckOption,
  EmptyState,
  MoreButton,
  SortSelect,
  useAddress,
  type ActiveFilter,
  useAddressView,
} from './discovery-parts'
import styles from './discovery.module.css'

/**
 * THAO-05 DIR1 — `/problems` (DEC-THAO-DIR-D2). No frame exists for this
 * surface: it reuses the discovery layout of DM06 / DM08 and the Library's
 * own facets for this dataset (Lĩnh vực · Giai đoạn · Địa bàn, values as the
 * file writes them, DEC-L15-D9) and orders. State mirrors in the address
 * (`?q=`, `?linh-vuc=`, `?giai-doan=`, `?dia-ban=`, `?sap-xep=`). Cards are
 * READ_ONLY: no detail page, no programme link.
 */

const PAGE = 9

type ProblemInitial = ProblemView

const STAGE_RANK = new Map(STAGES.map((s, i) => [s.value as string, i]))
const STAGE_LABEL = new Map(STAGES.map((s) => [s.value as string, s.label]))

const toggle = (list: string[], v: string) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

/** Values of one facet with their record counts, most frequent first. */
function facet(rows: DirectoryProblem[], pick: (p: DirectoryProblem) => string[]) {
  const counts = new Map<string, number>()
  for (const r of rows) for (const v of pick(r)) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts]
    .map(([value, n]) => ({ value, n }))
    .sort((a, b) => b.n - a.n || a.value.localeCompare(b.value, 'vi'))
}

export function ProblemDirectory({
  problems,
  initial,
}: {
  problems: DirectoryProblem[]
  initial: ProblemInitial
}) {
  const address = useAddress('/problems')
  const [draft, setDraft] = useState(initial.q)
  const [q, setQ] = useState(initial.q)
  const [domains, setDomains] = useState(initial.domains)
  const [stages, setStages] = useState(initial.stages)
  const [areas, setAreas] = useState(initial.areas)
  const [sort, setSort] = useState(initial.sort)
  const [shown, setShown] = useState(PAGE)

  const domainList = useMemo(() => facet(problems, (p) => p.domains), [problems])
  const areaList = useMemo(() => facet(problems, (p) => p.areas), [problems])
  const orgCount = useMemo(
    () => new Set(problems.map((p) => p.org).filter(Boolean)).size,
    [problems],
  )

  useAddressView(
    initial,
    (p) =>
      readProblemView(p, {
        domains: domainList.map((d) => d.value),
        areas: areaList.map((a) => a.value),
      }),
    (v) => {
      setDraft(v.q)
      setQ(v.q)
      setDomains(v.domains)
      setStages(v.stages)
      setAreas(v.areas)
      setSort(v.sort)
    },
  )

  function sync(next: Partial<ProblemInitial>) {
    const s = { q, domains, stages, areas, sort, ...next }
    const params = new URLSearchParams()
    if (s.q) params.set(PARAM.q, s.q)
    for (const v of s.domains) params.append('linh-vuc', v)
    for (const v of s.stages) params.append('giai-doan', v)
    for (const v of s.areas) params.append('dia-ban', v)
    if (s.sort !== 'sap-het-han') params.set(PARAM.sort, s.sort)
    address(params)
  }

  const results = useMemo(() => {
    const list = problems.filter(
      (p) =>
        matchesQuery(p.text, q) &&
        (!domains.length || domains.some((d) => p.domains.includes(d))) &&
        (!stages.length || stages.includes(p.stage)) &&
        (!areas.length || areas.some((a) => p.areas.includes(a))),
    )
    const by: Record<ProblemSort, (a: DirectoryProblem, b: DirectoryProblem) => number> = {
      // The Library's "Sắp hết hạn": stage, then deadline (none last), then the file order.
      'sap-het-han': (a, b) =>
        (STAGE_RANK.get(a.stage) ?? 99) - (STAGE_RANK.get(b.stage) ?? 99) ||
        (a.deadline ?? Infinity) - (b.deadline ?? Infinity) ||
        a.order - b.order,
      'giai-thuong': (a, b) => (b.prizeValue ?? -1) - (a.prizeValue ?? -1) || a.order - b.order,
      'ten-a-z': (a, b) => a.title.localeCompare(b.title, 'vi') || a.order - b.order,
    }
    return [...list].sort(by[sort])
  }, [problems, q, domains, stages, areas, sort])

  const pick = (key: 'domains' | 'stages' | 'areas', list: string[], v: string) => {
    const next = toggle(list, v)
    if (key === 'domains') setDomains(next)
    if (key === 'stages') setStages(next)
    if (key === 'areas') setAreas(next)
    setShown(PAGE)
    sync({ [key]: next })
  }

  function search(e: FormEvent) {
    e.preventDefault()
    setQ(draft.trim())
    setShown(PAGE)
    sync({ q: draft.trim() })
  }

  const clearAll = () => {
    setDraft('')
    setQ('')
    setDomains([])
    setStages([])
    setAreas([])
    setShown(PAGE)
    sync({ q: '', domains: [], stages: [], areas: [] })
  }

  const active: ActiveFilter[] = [
    ...(q
      ? [
          {
            key: 'q',
            label: `“${q}”`,
            remove: () => {
              setDraft('')
              setQ('')
              sync({ q: '' })
            },
          },
        ]
      : []),
    ...domains.map((d) => ({
      key: `d-${d}`,
      label: d,
      remove: () => pick('domains', domains, d),
    })),
    ...stages.map((s) => ({
      key: `s-${s}`,
      label: STAGE_LABEL.get(s) ?? s,
      remove: () => pick('stages', stages, s),
    })),
    ...areas.map((a) => ({ key: `a-${a}`, label: a, remove: () => pick('areas', areas, a) })),
  ]

  return (
    <>
      <section className={styles.hero} data-section="directory-hero">
        <p className={styles.eyebrow}>BÀI TOÁN</p>
        <h1 className={styles.title} data-pixel="data">
          <span className={styles.count}>{problems.length}</span> bài toán trong mạng lưới
        </h1>
        <form className={styles.search} role="search" aria-label="Tìm bài toán" onSubmit={search}>
          <span className={styles.scope}>
            Bài toán
            <svg viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
              <path d="M0 0h6L3 4z" fill="currentColor" />
            </svg>
          </span>
          <input
            className={styles.input}
            type="search"
            name="q"
            maxLength={120}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tìm theo tên bài toán, lĩnh vực hoặc đơn vị đặt bài..."
            aria-label="Từ khoá"
            autoComplete="off"
          />
          <button type="submit" className={styles.go}>
            Tìm kiếm
          </button>
        </form>
        <div className={styles.quick}>
          <span>Tìm nhanh:</span>
          {domainList.slice(0, 4).map((d) => (
            <button
              key={d.value}
              type="button"
              className={styles.quickChip}
              aria-pressed={domains.includes(d.value)}
              onClick={() => pick('domains', domains, d.value)}
            >
              {d.value}
            </button>
          ))}
          <Link href="/programmes" className={styles.quickChip} data-cta="to-programmes">
            Chương trình →
          </Link>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt data-pixel="data">{orgCount}</dt>
            <dd>đơn vị đặt bài</dd>
          </div>
          <div>
            <dt data-pixel="data">{domainList.length}</dt>
            <dd>lĩnh vực</dd>
          </div>
          <div>
            <dt data-pixel="data">{problems.filter((p) => p.stage === 'dang_mo_nop').length}</dt>
            <dd>đang mở nộp giải pháp</dd>
          </div>
        </dl>
      </section>

      <div className={styles.body} data-section="directory">
        <aside className={styles.rail} aria-label="Bộ lọc">
          <fieldset className={styles.group}>
            <legend>LĨNH VỰC</legend>
            {domainList.map((d) => (
              <CheckOption
                key={d.value}
                label={d.value}
                count={d.n}
                checked={domains.includes(d.value)}
                onChange={() => pick('domains', domains, d.value)}
              />
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend>GIAI ĐOẠN</legend>
            {STAGES.map((s) => (
              <CheckOption
                key={s.value}
                label={s.label}
                count={problems.filter((p) => p.stage === s.value).length}
                checked={stages.includes(s.value)}
                onChange={() => pick('stages', stages, s.value)}
              />
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend>ĐỊA BÀN</legend>
            {areaList.map((a) => (
              <CheckOption
                key={a.value}
                label={a.value}
                count={a.n}
                checked={areas.includes(a.value)}
                onChange={() => pick('areas', areas, a.value)}
              />
            ))}
          </fieldset>
        </aside>

        <div className={styles.results}>
          <div className={styles.bar}>
            <ActiveFilters items={active} onClear={clearAll} />
            <SortSelect
              value={sort}
              options={PROBLEM_SORTS}
              onChange={(next) => {
                setSort(next)
                sync({ sort: next })
              }}
            />
          </div>
          <p className={styles.srCount} aria-live="polite">
            {results.length} bài toán
          </p>
          {results.length === 0 ? (
            <EmptyState
              text={
                problems.length
                  ? 'Không có bài toán phù hợp với bộ lọc.'
                  : 'Chưa có bài toán công khai.'
              }
              onClear={clearAll}
            />
          ) : (
            <ul className={styles.grid} role="list">
              {results.slice(0, shown).map((p) => (
                <li key={p.key} className={styles.card} data-problem={p.stage}>
                  <span className={styles.band} data-cover={p.cover ?? 1} aria-hidden="true" />
                  <div className={styles.problemHead}>
                    <span className={styles.problemOrg}>{p.org}</span>
                    {p.stageLabel ? <span className={styles.stage}>{p.stageLabel}</span> : null}
                  </div>
                  <h2 className={styles.problemTitle}>{p.title}</h2>
                  {p.summary ? <p className={styles.summary}>{p.summary}</p> : null}
                  <ul className={styles.tags} role="list">
                    {p.time ? <li>{p.time}</li> : null}
                    {p.prize ? <li>{p.prize}</li> : null}
                    {p.teams ? <li>{p.teams}</li> : null}
                    {p.domains.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <MoreButton
            hidden={results.length - shown}
            noun="bài toán"
            onMore={() => setShown((n) => n + PAGE)}
          />
        </div>
      </div>
    </>
  )
}
