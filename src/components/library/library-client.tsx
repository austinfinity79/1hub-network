'use client'

import { useRouter } from 'next/navigation'
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import type { LibraryProblem } from '@/lib/library/problem-adapter'
import { LIBRARY_QUERY_MAX } from '@/lib/library/query'
import type { StartupDirectory } from '@/lib/library/startup-adapter'

import {
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
 * problem dataset, "Startup" and "Nhà sáng lập" on startup.json, both read by
 * the server (DEC-L15-D7, LIBRARY DATA UPDATE); the page names no source.
 * Search, facets, chips, sort and paging run in the browser; every data string
 * is rendered as text, never as HTML.
 */

const ENTITIES: Array<{ key: Entity; label: string }> = [
  { key: 'PROBLEM', label: 'Bài toán' },
  { key: 'STARTUP', label: 'Startup' },
  { key: 'FOUNDER', label: 'Nhà sáng lập' },
]

const PLACEHOLDER: Record<Entity, string> = {
  PROBLEM: 'Tìm theo tên bài toán, lĩnh vực, doanh nghiệp đặt bài…',
  STARTUP: 'Tìm theo tên startup, sản phẩm, lĩnh vực hoặc nhà sáng lập…',
  FOUNDER: 'Tìm theo tên nhà sáng lập, vai trò, startup…',
}

const PAGE_SIZE = 9
const EMPTY: Record<Entity, Filters> = { PROBLEM: {}, STARTUP: {}, FOUNDER: {} }

export function LibraryBrowser({
  header,
  problems,
  directory,
  initialQuery,
}: {
  header: ReactNode
  problems: LibraryProblem[]
  directory: StartupDirectory
  /** The keyword from `?q=`, applied as a submitted search on the first tab. */
  initialQuery: string
}) {
  const tabs = useMemo<Record<Entity, TabModel>>(
    () => ({
      PROBLEM: problemTab(problems),
      STARTUP: startupTab(directory),
      FOUNDER: founderTab(directory),
    }),
    [problems, directory],
  )
  const openCount = problems.filter((p) => p.stage === 'dang_mo_nop').length
  const [entity, setEntity] = useState<Entity>('PROBLEM')
  const [draft, setDraft] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
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
            maxLength={LIBRARY_QUERY_MAX}
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
          {tab.quick.map((d) => (
            <button
              key={d.value}
              type="button"
              className={styles.quickChip}
              aria-pressed={(current.domain ?? []).includes(d.value)}
              onClick={() => toggle('domain', d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <dl className={styles.metrics} data-anchor="metrics">
          <div>
            <dt>bài toán đang mở</dt>
            <dd>{openCount}</dd>
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
        Danh bạ tạm thời chưa phản hồi. Vui lòng thử lại sau ít phút.
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
              {/* Display only (PO P3 cleanup): the keyword is not removable here. */}
              {query ? (
                <span className={`${styles.chip} ${styles.chipStatic}`}>“{query}”</span>
              ) : null}
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
          ) : null}
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
            {visible.map((item) =>
              item.kind === 'PROBLEM' ? (
                <Card key={item.id} item={item} />
              ) : (
                <ProfileCard key={item.id} item={item} />
              ),
            )}
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
        {/* PO decision (30/09): a card action with no destination is not drawn. */}
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
        ) : null}
      </article>
    </li>
  )
}

/** Opens the record's own website in a new tab; without one it is plain content, not a control. */
function OutLink({
  href,
  label,
  title,
  className,
  children,
}: {
  href: string | null
  label: string
  title: string
  className: string | undefined
  children: ReactNode
}) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={className}
      aria-label={`${label} ${title} (mở trang ngoài)`}
    >
      {children}
    </a>
  )
}

/** DEC-L15-D11 / D12: the white Startup and Nhà sáng lập card (L15b, L15c). */
function ProfileCard({ item }: { item: Item }) {
  const titleId = `card-${item.id}`
  return (
    <li className={styles.pcard} data-kind={item.kind}>
      <article aria-labelledby={titleId}>
        <div className={styles.pcardHead}>
          <span
            className={`${styles.pcardMark} ${styles[`mark_${item.tone}`]}`}
            data-round={item.kind === 'FOUNDER'}
            aria-hidden="true"
          >
            {item.mark}
          </span>
          <div className={styles.pcardWho}>
            <h2 id={titleId} className={styles.pcardName}>
              {item.title}
            </h2>
            {item.sub ? <p className={styles.pcardSub}>{item.sub}</p> : null}
          </div>
          {item.pill ? <span className={styles.pcardStage}>{item.pill}</span> : null}
        </div>
        {item.summary ? <p className={styles.pcardSummary}>{item.summary}</p> : null}
        {item.chips.length ? (
          <p className={styles.pcardChips}>
            {item.chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </p>
        ) : null}
        {item.row ? (
          <OutLink
            href={item.row.href}
            label="Xem startup"
            title={item.row.name}
            className={styles.pcardRow}
          >
            <span className={`${styles.pcardRowMark} ${styles.mark_coral}`} aria-hidden="true">
              {item.row.mark}
            </span>
            <span className={styles.pcardRowName}>{item.row.name}</span>
            {item.row.note ? <span className={styles.pcardRowNote}>{item.row.note}</span> : null}
          </OutLink>
        ) : null}
        {/* PO decision (30/09): no profile page, follow or connection exists for a
            directory record, so only the record's own website is offered. */}
        {item.cta.href ? (
          <div className={styles.pcardActions}>
            <OutLink
              href={item.cta.href}
              label={item.cta.label}
              title={item.title}
              className={styles.pcardPrimary}
            >
              {item.cta.label}
            </OutLink>
          </div>
        ) : null}
      </article>
    </li>
  )
}
