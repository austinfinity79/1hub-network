'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { Cta } from '../landing/landing-parts'
import {
  AREA_LABEL,
  DOMAIN_LABEL,
  FACETS,
  PROBLEMS,
  QUICK,
  STAGE_LABEL,
  facetCount,
  matches,
  sortProblems,
  type Area,
  type Domain,
  type Filters,
  type Problem,
  type SortKey,
  type Stage,
} from './library-data'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY — the interactive part of /library: the hero search,
 * the entity tabs and the "Bài toán" directory. Search, quick filters, facets,
 * chips and sorting all run in the browser on the labelled demo fixture
 * (DEC-L15-D2); nothing is sent to the server.
 */

type Entity = 'PROBLEM' | 'STARTUP' | 'FOUNDER'

const ENTITIES: Array<{ key: Entity; label: string }> = [
  { key: 'PROBLEM', label: 'Bài toán' },
  { key: 'STARTUP', label: 'Startup' },
  { key: 'FOUNDER', label: 'Nhà sáng lập' },
]

const PLACEHOLDER: Record<Entity, string> = {
  PROBLEM: 'Tìm theo tên bài toán, lĩnh vực, doanh nghiệp đặt bài…',
  STARTUP: 'Danh bạ Startup chưa có trong phiên bản này',
  FOUNDER: 'Danh bạ Nhà sáng lập chưa có trong phiên bản này',
}

const PAGE_SIZE = 9
const NONE: Filters = { domain: [], stage: [], area: [] }
const OPEN_COUNT = PROBLEMS.filter((p) => p.stage === 'OPEN').length

const GROUPS: Array<{
  key: keyof Filters
  title: string
  values: string[]
  label: (v: string) => string
}> = [
  {
    key: 'domain',
    title: 'LĨNH VỰC',
    values: FACETS.domain,
    label: (v) => DOMAIN_LABEL[v as Domain],
  },
  {
    key: 'stage',
    title: 'GIAI ĐOẠN',
    values: FACETS.stage,
    label: (v) => STAGE_LABEL[v as Stage],
  },
  { key: 'area', title: 'ĐỊA BÀN', values: FACETS.area, label: (v) => AREA_LABEL[v as Area] },
]

function chipLabel(group: keyof Filters, value: string): string {
  if (group === 'domain') return DOMAIN_LABEL[value as Domain]
  if (group === 'stage') return STAGE_LABEL[value as Stage]
  return AREA_LABEL[value as Area]
}

export function LibraryBrowser({ header }: { header: ReactNode }) {
  const [entity, setEntity] = useState<Entity>('PROBLEM')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(NONE)
  const [sort, setSort] = useState<SortKey>('DEADLINE')
  const [shown, setShown] = useState(PAGE_SIZE)
  const results = useRef<HTMLDivElement>(null)
  const tabIds = useId()

  const list = useMemo(
    () =>
      sortProblems(
        PROBLEMS.filter((p) => matches(p, query, filters)),
        sort,
      ),
    [query, filters, sort],
  )
  const active = [
    ...filters.domain.map((v) => ['domain', v] as const),
    ...filters.stage.map((v) => ['stage', v] as const),
    ...filters.area.map((v) => ['area', v] as const),
  ]

  const toggle = (group: keyof Filters, value: string) => {
    setShown(PAGE_SIZE)
    setFilters((f) => {
      const cur = f[group] as string[]
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      return { ...f, [group]: next }
    })
  }
  const clearAll = () => {
    setFilters(NONE)
    setQuery('')
    setDraft('')
    setShown(PAGE_SIZE)
  }
  const pick = (next: Entity) => {
    setEntity(next)
    if (next !== 'PROBLEM') setDraft('')
  }
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = (i + (e.key === 'ArrowRight' ? 1 : ENTITIES.length - 1)) % ENTITIES.length
    pick(ENTITIES[n]!.key)
    document.getElementById(`${tabIds}-tab-${ENTITIES[n]!.key}`)?.focus()
  }

  return (
    <>
      <section className={styles.hero} data-section="hero" aria-labelledby="library-title">
        {header}
        <p className={styles.eyebrow}>THƯ VIỆN HUB NETWORK</p>
        <h1 id="library-title" className={styles.title}>
          Bài toán đang mở, những đội đang giải, <br />
          và những người đứng sau.
        </h1>
        <form
          className={styles.search}
          role="search"
          aria-label="Tìm trong thư viện"
          data-anchor="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (entity !== 'PROBLEM') return
            setQuery(draft)
            setShown(PAGE_SIZE)
            results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          <label className={styles.entity}>
            <span className={styles.entityLabel} aria-hidden="true">
              {ENTITIES.find((x) => x.key === entity)!.label}
              <span className={styles.entityDot} />
            </span>
            <select
              aria-label="Tìm trong"
              value={entity}
              onChange={(e) => pick(e.target.value as Entity)}
            >
              {ENTITIES.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <input
            className={styles.query}
            type="search"
            aria-label="Từ khoá"
            placeholder={PLACEHOLDER[entity]}
            value={draft}
            disabled={entity !== 'PROBLEM'}
            onChange={(e) => {
              setDraft(e.target.value)
              if (e.target.value === '') setQuery('')
            }}
          />
          <button type="submit" className={styles.searchButton} disabled={entity !== 'PROBLEM'}>
            Tìm kiếm
          </button>
        </form>
        <div className={styles.quick} role="group" aria-label="Tìm nhanh theo lĩnh vực">
          <span className={styles.quickLabel}>Tìm nhanh:</span>
          {QUICK.map((d) => (
            <button
              key={d}
              type="button"
              className={styles.quickChip}
              aria-pressed={filters.domain.includes(d)}
              onClick={() => {
                pick('PROBLEM')
                toggle('domain', d)
              }}
            >
              {DOMAIN_LABEL[d]}
            </button>
          ))}
        </div>
        <dl className={styles.metrics} data-anchor="metrics">
          <div>
            <dt>bài toán đang mở</dt>
            <dd>{OPEN_COUNT}</dd>
          </div>
          <div>
            <dt>startup</dt>
            <dd className={styles.metricSoon}>Sắp có</dd>
          </div>
          <div>
            <dt>nhà sáng lập</dt>
            <dd className={styles.metricSoon}>Sắp có</dd>
          </div>
        </dl>
        <p className={styles.metricsNote}>Số liệu minh hoạ từ dữ liệu demo</p>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Loại hồ sơ" data-anchor="tabs">
        {ENTITIES.map((x, i) => (
          <button
            key={x.key}
            id={`${tabIds}-tab-${x.key}`}
            type="button"
            role="tab"
            aria-selected={entity === x.key}
            aria-controls={`${tabIds}-panel`}
            tabIndex={entity === x.key ? 0 : -1}
            className={styles.tab}
            onClick={() => pick(x.key)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {x.label}
            <span className={styles.tabCount}>
              {x.key === 'PROBLEM' ? PROBLEMS.length : 'Sắp có'}
            </span>
          </button>
        ))}
      </div>

      <div
        id={`${tabIds}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabIds}-tab-${entity}`}
        className={styles.body}
        ref={results}
        data-section="directory"
      >
        {entity === 'PROBLEM' ? (
          <Directory
            list={list}
            query={query}
            filters={filters}
            active={active}
            sort={sort}
            shown={shown}
            onToggle={toggle}
            onClear={clearAll}
            onSort={(s) => setSort(s)}
            onMore={() => setShown((n) => n + PAGE_SIZE)}
          />
        ) : (
          <div className={styles.soon} data-anchor="coming-soon">
            <p className={styles.soonTitle}>Sắp có</p>
            <p className={styles.soonText}>
              {entity === 'STARTUP'
                ? 'Danh bạ Startup chưa có trong phiên bản này.'
                : 'Danh bạ Nhà sáng lập chưa có trong phiên bản này.'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

function Directory({
  list,
  query,
  filters,
  active,
  sort,
  shown,
  onToggle,
  onClear,
  onSort,
  onMore,
}: {
  list: Problem[]
  query: string
  filters: Filters
  active: ReadonlyArray<readonly [keyof Filters, string]>
  sort: SortKey
  shown: number
  onToggle: (group: keyof Filters, value: string) => void
  onClear: () => void
  onSort: (s: SortKey) => void
  onMore: () => void
}) {
  const visible = list.slice(0, shown)
  const rest = list.length - visible.length
  return (
    <div className={styles.directory}>
      <aside className={styles.facets} aria-label="Bộ lọc" data-anchor="facets">
        {GROUPS.map((g) => (
          <fieldset key={g.key} className={styles.facetGroup}>
            <legend className={styles.facetTitle}>{g.title}</legend>
            {g.values.map((v) => (
              <label key={v} className={styles.facet}>
                <input
                  type="checkbox"
                  checked={(filters[g.key] as string[]).includes(v)}
                  onChange={() => onToggle(g.key, v)}
                />
                <span className={styles.facetLabel}>{g.label(v)}</span>
                <span className={styles.facetCount}>{facetCount(query, filters, g.key, v)}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </aside>

      <div className={styles.results}>
        <div className={styles.resultsBar} data-anchor="chips">
          {active.length || query ? (
            <div className={styles.chips}>
              <span className={styles.chipsLabel}>Đang lọc:</span>
              {query ? <span className={styles.chip}>“{query}”</span> : null}
              {active.map(([group, value]) => (
                <button
                  key={`${group}-${value}`}
                  type="button"
                  className={styles.chip}
                  aria-label={`Bỏ lọc ${chipLabel(group, value)}`}
                  onClick={() => onToggle(group, value)}
                >
                  {chipLabel(group, value)} ×
                </button>
              ))}
              <button type="button" className={styles.clear} onClick={onClear}>
                Xoá tất cả
              </button>
            </div>
          ) : (
            <span className={styles.demoTag}>Dữ liệu minh hoạ</span>
          )}
          <p className={styles.count} aria-live="polite">
            {list.length} bài toán
          </p>
          <label className={styles.sort}>
            Sắp xếp:
            <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
              <option value="DEADLINE">Sắp hết hạn</option>
              <option value="PRIZE">Giải thưởng cao nhất</option>
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <div className={styles.empty} data-anchor="empty">
            <p className={styles.emptyTitle}>Không có bài toán nào khớp bộ lọc.</p>
            <button type="button" className={styles.clearLight} onClick={onClear}>
              Xoá tất cả bộ lọc
            </button>
          </div>
        ) : (
          <ul className={styles.grid} data-anchor="grid">
            {visible.map((p) => (
              <li key={p.id} className={`${styles.card} ${styles[`card_${p.tone}`]}`}>
                <article aria-labelledby={`problem-${p.id}`}>
                  <div className={styles.cardHead}>
                    <span className={styles.orgDot} aria-hidden="true" />
                    <span className={styles.org}>{p.org}</span>
                    <span className={styles.stage}>{STAGE_LABEL[p.stage]}</span>
                  </div>
                  <div className={styles.cardMain}>
                    <h2 id={`problem-${p.id}`} className={styles.cardTitle}>
                      {p.title}
                    </h2>
                    <span className={styles.prize}>{p.prize ?? '–'}</span>
                  </div>
                  <p className={styles.summary}>{p.summary}</p>
                  <p className={styles.meta}>
                    <span>{p.time}</span>
                    <span>{p.teams}</span>
                  </p>
                  <Cta
                    action={{ inert: 'NO_P0_SCREEN' }}
                    label={p.stage === 'UPCOMING' ? 'Theo dõi bài toán' : 'Xem bài toán'}
                    className={styles.cardCta}
                  >
                    {p.stage === 'UPCOMING' ? 'Theo dõi bài toán' : 'Xem bài toán'}
                  </Cta>
                </article>
              </li>
            ))}
          </ul>
        )}

        {rest > 0 ? (
          <button type="button" className={styles.more} onClick={onMore}>
            Xem thêm {rest} bài toán
          </button>
        ) : null}
      </div>
    </div>
  )
}
