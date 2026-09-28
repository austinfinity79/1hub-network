'use client'

import { useRouter } from 'next/navigation'
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import type { StartupDirectory } from '@/lib/library/startup-adapter'

import { Cta } from '../landing/landing-parts'
import { PROBLEMS, QUICK } from './library-data'
import {
  CATEGORY_LABEL,
  facetCount,
  founderTab,
  matches,
  problemTab,
  sortItems,
  startupTab,
  type Entity,
  type Filters,
  type Item,
  type SortOption,
  type TabModel,
} from './library-model'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — the interactive part of /library: the hero
 * search, the entity tabs and the directory (DEC-L15). "Bài toán" runs on the
 * labelled DEMO FIXTURE; "Startup" and "Nhà sáng lập" on startup.json as read
 * by the server (DEC-L15-D7). Search, facets, chips, sort and paging run in
 * the browser; every remote string is rendered as text, never as HTML.
 */

const ENTITIES: Array<{ key: Entity; label: string }> = [
  { key: 'PROBLEM', label: 'Bài toán' },
  { key: 'STARTUP', label: 'Startup' },
  { key: 'FOUNDER', label: 'Nhà sáng lập' },
]

const PLACEHOLDER: Record<Entity, string> = {
  PROBLEM: 'Tìm theo tên bài toán, lĩnh vực, doanh nghiệp đặt bài…',
  STARTUP: 'Tìm theo tên startup, lĩnh vực, mô tả…',
  FOUNDER: 'Tìm theo tên nhà sáng lập, vai trò, startup…',
}

const PAGE_SIZE = 9
const OPEN_COUNT = PROBLEMS.filter((p) => p.stage === 'OPEN').length
const EMPTY: Record<Entity, Filters> = { PROBLEM: {}, STARTUP: {}, FOUNDER: {} }

export function LibraryBrowser({
  header,
  directory,
}: {
  header: ReactNode
  directory: StartupDirectory
}) {
  const tabs = useMemo<Record<Entity, TabModel>>(
    () => ({
      PROBLEM: problemTab(),
      STARTUP: startupTab(directory),
      FOUNDER: founderTab(directory),
    }),
    [directory],
  )
  const [entity, setEntity] = useState<Entity>('PROBLEM')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<Entity, Filters>>(EMPTY)
  const [sorts, setSorts] = useState<Record<Entity, SortOption['key']>>({
    PROBLEM: 'DEADLINE',
    STARTUP: 'STAGE',
    FOUNDER: 'NAME',
  })
  const [shown, setShown] = useState(PAGE_SIZE)
  const results = useRef<HTMLDivElement>(null)
  const tabIds = useId()

  const tab = tabs[entity]
  const current = filters[entity]
  const list = useMemo(
    () =>
      tab.items
        ? sortItems(
            tab.items.filter((i) => matches(i, query, current)),
            sorts[entity],
          )
        : null,
    [tab, query, current, sorts, entity],
  )

  const toggle = (group: string, value: string, target: Entity = entity) => {
    setShown(PAGE_SIZE)
    setFilters((all) => {
      const f = all[target]
      const cur = f[group] ?? []
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      return { ...all, [target]: { ...f, [group]: next } }
    })
  }
  const clearAll = () => {
    setFilters((all) => ({ ...all, [entity]: {} }))
    setQuery('')
    setDraft('')
    setShown(PAGE_SIZE)
  }
  const pick = (next: Entity) => {
    setEntity(next)
    setShown(PAGE_SIZE)
  }
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = (i + (e.key === 'ArrowRight' ? 1 : ENTITIES.length - 1)) % ENTITIES.length
    pick(ENTITIES[n]!.key)
    document.getElementById(`${tabIds}-tab-${ENTITIES[n]!.key}`)?.focus()
  }
  const count = (e: Entity) => tabs[e].items?.length ?? '–'

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
            maxLength={120}
            onChange={(e) => {
              setDraft(e.target.value)
              if (e.target.value === '') setQuery('')
            }}
          />
          <button type="submit" className={styles.searchButton}>
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
              aria-pressed={(current.domain ?? []).includes(d)}
              onClick={() => toggle('domain', d)}
            >
              {CATEGORY_LABEL[d]}
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
            <dd>{count('STARTUP')}</dd>
          </div>
          <div>
            <dt>nhà sáng lập</dt>
            <dd>{count('FOUNDER')}</dd>
          </div>
        </dl>
        <p className={styles.metricsNote}>
          Bài toán: dữ liệu minh hoạ · Startup, nhà sáng lập: startup.1hub.cloud
        </p>
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
            <span className={styles.tabCount}>{count(x.key)}</span>
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
        data-tab={entity}
      >
        {list ? (
          <Directory
            tab={tab}
            list={list}
            query={query}
            filters={current}
            sort={sorts[entity]}
            shown={shown}
            onToggle={toggle}
            onClear={clearAll}
            onSort={(s) => setSorts((all) => ({ ...all, [entity]: s }))}
            onMore={() => setShown((n) => n + PAGE_SIZE)}
          />
        ) : (
          <SourceError />
        )}
      </div>
    </>
  )
}

function SourceError() {
  const router = useRouter()
  return (
    <div className={styles.soon} data-anchor="source-error" role="status">
      <p className={styles.soonTitle}>Chưa tải được danh bạ</p>
      <p className={styles.soonText}>
        Nguồn startup.1hub.cloud đang không phản hồi. Vui lòng thử lại sau ít phút.
      </p>
      <button type="button" className={styles.more} onClick={() => router.refresh()}>
        Thử lại
      </button>
    </div>
  )
}

function Directory({
  tab,
  list,
  query,
  filters,
  sort,
  shown,
  onToggle,
  onClear,
  onSort,
  onMore,
}: {
  tab: TabModel
  list: Item[]
  query: string
  filters: Filters
  sort: SortOption['key']
  shown: number
  onToggle: (group: string, value: string) => void
  onClear: () => void
  onSort: (s: SortOption['key']) => void
  onMore: () => void
}) {
  const [open, setOpen] = useState(false)
  const all = tab.items ?? []
  const visible = list.slice(0, shown)
  const rest = list.length - visible.length
  const labels = new Map(
    tab.groups.flatMap((g) => g.values.map((v) => [`${g.key}:${v.value}`, v.label])),
  )
  const active = Object.entries(filters).flatMap(([g, vs]) => vs.map((v) => [g, v] as const))
  return (
    <div className={styles.directory}>
      <button
        type="button"
        className={styles.facetToggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Bộ lọc{active.length ? ` (${active.length})` : ''}
      </button>
      <aside className={styles.facets} aria-label="Bộ lọc" data-anchor="facets" data-open={open}>
        {tab.groups.map((g) => (
          <fieldset key={g.key} className={styles.facetGroup}>
            <legend className={styles.facetTitle}>{g.title}</legend>
            {g.values.map((v) => {
              const n = facetCount(all, query, filters, g.key, v.value)
              return (
                <label key={v.value} className={styles.facet} data-empty={n === 0}>
                  <input
                    type="checkbox"
                    checked={(filters[g.key] ?? []).includes(v.value)}
                    onChange={() => onToggle(g.key, v.value)}
                  />
                  <span className={styles.facetLabel}>{v.label}</span>
                  <span className={styles.facetCount}>{n}</span>
                </label>
              )
            })}
          </fieldset>
        ))}
        <p className={styles.facetNote}>
          Bộ lọc không có kết quả vẫn hiện, kèm số 0 — để biết nó tồn tại mà đang rỗng.
        </p>
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
                  aria-label={`Bỏ lọc ${labels.get(`${group}:${value}`)}`}
                  onClick={() => onToggle(group, value)}
                >
                  {labels.get(`${group}:${value}`)} ×
                </button>
              ))}
              <button type="button" className={styles.clear} onClick={onClear}>
                Xoá tất cả
              </button>
            </div>
          ) : (
            <span className={styles.demoTag}>
              {tab.source === 'DEMO' ? 'Dữ liệu minh hoạ' : 'Nguồn: startup.1hub.cloud'}
            </span>
          )}
          <p className={styles.count} aria-live="polite">
            {list.length} {tab.noun}
          </p>
          <label className={styles.sort}>
            Sắp xếp:
            <span className={styles.sortValue}>
              {tab.sorts.find((s) => s.key === sort)!.label}
              <select
                aria-label="Sắp xếp"
                value={sort}
                onChange={(e) => onSort(e.target.value as SortOption['key'])}
              >
                {tab.sorts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        {visible.length === 0 ? (
          <div className={styles.empty} data-anchor="empty">
            <p className={styles.emptyTitle}>Không có {tab.noun} nào khớp bộ lọc.</p>
            <button type="button" className={styles.clearLight} onClick={onClear}>
              Xoá tất cả bộ lọc
            </button>
          </div>
        ) : (
          <ul className={styles.grid} data-anchor="grid">
            {visible.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </ul>
        )}

        {rest > 0 ? (
          <button type="button" className={styles.more} onClick={onMore} data-anchor="more">
            Xem thêm {rest} {tab.noun}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Card({ item }: { item: Item }) {
  const titleId = `card-${item.id}`
  return (
    <li className={`${styles.card} ${styles[`card_${item.tone}`]}`}>
      <article aria-labelledby={titleId}>
        <div className={styles.cardHead}>
          <span className={styles.orgDot} aria-hidden="true">
            {item.mark}
          </span>
          <span className={styles.org}>{item.head}</span>
          {item.pill ? <span className={styles.stage}>{item.pill}</span> : null}
        </div>
        <div className={styles.cardMain}>
          <h2 id={titleId} className={styles.cardTitle}>
            {item.title}
          </h2>
          {item.prize ? <span className={styles.prize}>{item.prize}</span> : null}
        </div>
        {item.summary ? <p className={styles.summary}>{item.summary}</p> : null}
        <p className={styles.meta}>
          {item.meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </p>
        {item.cta.href ? (
          <a
            href={item.cta.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={styles.cardCta}
            aria-label={`${item.cta.label} ${item.title} (mở trang ngoài)`}
          >
            {item.cta.label}
          </a>
        ) : (
          <Cta action={{ inert: 'NO_P0_SCREEN' }} label={item.cta.label} className={styles.cardCta}>
            {item.cta.label}
          </Cta>
        )}
      </article>
    </li>
  )
}
