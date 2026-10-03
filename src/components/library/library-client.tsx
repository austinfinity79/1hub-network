'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import type { LibraryInitial } from '@/lib/library/library-bodies'
import { LIBRARY_QUERY_MAX } from '@/lib/library/query'

import {
  cardsOf,
  groupsOf,
  libraryUrl,
  PROBLEM_QUICK,
  TABS,
  type Card,
  type CountedGroup,
  type Entity,
  type Filters,
  type SortOption,
  type TabBody,
} from './library-model'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) / WF06-PROD-04 — the interactive part of
 * /library: the hero search, the entity tabs and the directory (DEC-L15). Every
 * tab shows the answer of its Library API (`GET /api/v1/library/*`, API §25):
 * the first page comes with the page (read by the server exactly as the API
 * answers), and a keyword, filter or sort change asks the API again; "Xem thêm"
 * asks for the next page by its cursor. Nothing is filtered, sorted, paged or
 * hidden in the browser, and nothing is kept beyond this page view. Every data
 * string is rendered as text, never as HTML.
 */

const ENTITIES: Array<{ key: Entity; label: string }> = [
  { key: 'PROBLEM', label: 'Bài toán' },
  { key: 'STARTUP', label: 'Startup' },
  { key: 'FOUNDER', label: 'Nhà sáng lập' },
]

/** What each search runs on (founder names are not searchable in Startup, DEC-W6P-D03). */
const PLACEHOLDER: Record<Entity, string> = {
  PROBLEM: 'Tìm theo tên bài toán, lĩnh vực, doanh nghiệp đặt bài…',
  STARTUP: 'Tìm theo tên startup, sản phẩm hoặc lĩnh vực…',
  FOUNDER: 'Tìm theo tên nhà sáng lập hoặc startup…',
}

const DEFAULT_SORT: Record<Entity, SortOption['key']> = {
  PROBLEM: 'DEADLINE',
  STARTUP: 'STAGE',
  FOUNDER: 'NAME',
}
const EMPTY: Record<Entity, Filters> = { PROBLEM: {}, STARTUP: {}, FOUNDER: {} }

type TabState = {
  /** The request (without cursor) these cards answer. */
  key: string
  status: 'ready' | 'loading' | 'error'
  cards: Card[]
  total: number
  next: string | null
  groups: CountedGroup[]
  /** Founders for a guest: no rows, the sign-in state instead (DEC-W6P-D03). */
  restricted: boolean
  more: 'idle' | 'loading' | 'error'
}

function stateOf(entity: Entity, key: string, body: TabBody | null): TabState {
  if (!body) {
    return {
      key,
      status: 'error',
      cards: [],
      total: 0,
      next: null,
      groups: [],
      restricted: false,
      more: 'idle',
    }
  }
  return {
    key,
    status: 'ready',
    cards: cardsOf(entity, body),
    total: body.total,
    next: body.page.next_cursor,
    groups: groupsOf(entity, body),
    restricted: 'restricted' in body && body.restricted,
    more: 'idle',
  }
}

async function read(url: string, signal?: AbortSignal): Promise<TabBody> {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  // Any refusal or fault is the tab's error state; the answer itself is never shown.
  if (!response.ok) throw new Error(`library ${response.status}`)
  return (await response.json()) as TabBody
}

export function LibraryBrowser({
  header,
  initial,
  signInHref,
}: {
  header: ReactNode
  initial: LibraryInitial
  /** Where the founder tab's sign-in action leads (the page's own login entry). */
  signInHref: string
}) {
  const [entity, setEntity] = useState<Entity>('PROBLEM')
  const [draft, setDraft] = useState(initial.q)
  const [query, setQuery] = useState(initial.q)
  const [filters, setFilters] = useState<Record<Entity, Filters>>(EMPTY)
  const [sorts, setSorts] = useState<Record<Entity, SortOption['key']>>(DEFAULT_SORT)
  const [tabs, setTabs] = useState<Record<Entity, TabState>>(() => {
    const first = (e: Entity) => libraryUrl(e, { q: initial.q, filters: {}, sort: DEFAULT_SORT[e] })
    return {
      PROBLEM: stateOf('PROBLEM', first('PROBLEM'), initial.bodies.PROBLEM),
      STARTUP: stateOf('STARTUP', first('STARTUP'), initial.bodies.STARTUP),
      FOUNDER: stateOf('FOUNDER', first('FOUNDER'), initial.bodies.FOUNDER),
    }
  })
  const pending = useRef<Partial<Record<Entity, AbortController>>>({})
  const results = useRef<HTMLDivElement>(null)
  const tabIds = useId()

  const current = filters[entity]
  const wanted = libraryUrl(entity, { q: query, filters: current, sort: sorts[entity] })
  const loaded = tabs[entity]
  // A state whose answer has not arrived is loading from its first render (no stale "ready").
  const tab: TabState = loaded.key === wanted ? loaded : { ...loaded, status: 'loading' }

  /** Asks the API for page 1 of a tab state; a newer request supersedes an older one. */
  const load = useCallback((target: Entity, url: string) => {
    pending.current[target]?.abort()
    const control = new AbortController()
    pending.current[target] = control
    setTabs((all) => ({ ...all, [target]: { ...all[target], key: url, status: 'loading' } }))
    read(url, control.signal).then(
      (body) => {
        if (!control.signal.aborted)
          setTabs((all) => ({ ...all, [target]: stateOf(target, url, body) }))
      },
      () => {
        if (!control.signal.aborted)
          setTabs((all) => ({ ...all, [target]: { ...all[target], status: 'error' } }))
      },
    )
  }, [])

  useEffect(() => {
    if (loaded.key !== wanted) load(entity, wanted)
  }, [entity, wanted, loaded.key, load])

  useEffect(() => {
    const controls = pending.current
    return () => Object.values(controls).forEach((c) => c?.abort())
  }, [])

  const loadMore = () => {
    const from = tabs[entity]
    if (!from.next || from.more === 'loading') return
    const target = entity
    const url = new URL(from.key, window.location.origin)
    url.searchParams.set('cursor', from.next)
    setTabs((all) => ({ ...all, [target]: { ...all[target], more: 'loading' } }))
    read(`${url.pathname}${url.search}`).then(
      (body) =>
        setTabs((all) => {
          const now = all[target]
          if (now.key !== from.key) return all
          const seen = new Set(now.cards.map((c) => c.id))
          const added = cardsOf(target, body).filter((c) => !seen.has(c.id))
          return {
            ...all,
            [target]: {
              ...now,
              cards: [...now.cards, ...added],
              total: body.total,
              next: body.page.next_cursor,
              more: 'idle',
            },
          }
        }),
      () =>
        setTabs((all) =>
          all[target].key === from.key
            ? { ...all, [target]: { ...all[target], more: 'error' } }
            : all,
        ),
    )
  }

  const toggle = (group: string, value: string) => {
    setFilters((all) => {
      const f = all[entity]
      const cur = f[group] ?? []
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      return { ...all, [entity]: { ...f, [group]: next } }
    })
  }
  const clearAll = () => {
    setFilters((all) => ({ ...all, [entity]: {} }))
    setQuery('')
    setDraft('')
  }
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = (i + (e.key === 'ArrowRight' ? 1 : ENTITIES.length - 1)) % ENTITIES.length
    setEntity(ENTITIES[n]!.key)
    document.getElementById(`${tabIds}-tab-${ENTITIES[n]!.key}`)?.focus()
  }
  /** Unfiltered totals from the page's first read; "–" when unknown or not shown. */
  const count = (e: Entity) => initial.totals[e] ?? '–'
  const quick = entity === 'PROBLEM' ? PROBLEM_QUICK : tab.restricted ? [] : initial.quickDomains

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
              onChange={(e) => setEntity(e.target.value as Entity)}
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
        {/* Without a chip the row keeps its place, hidden, so the page does not jump. */}
        <div
          className={styles.quick}
          role="group"
          aria-label="Tìm nhanh theo lĩnh vực"
          data-empty={quick.length === 0}
          aria-hidden={quick.length === 0 || undefined}
        >
          <span className={styles.quickLabel}>Tìm nhanh:</span>
          {quick.map((d) => (
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
            <dd>{initial.openProblems ?? '–'}</dd>
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
            onClick={() => setEntity(x.key)}
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
        data-state={tab.restricted ? 'restricted' : tab.status}
      >
        {tab.restricted ? (
          <SignInState href={signInHref} />
        ) : tab.status === 'error' ? (
          <SourceError onRetry={() => load(entity, wanted)} />
        ) : (
          <Directory
            entity={entity}
            tab={tab}
            query={query}
            filters={current}
            sort={sorts[entity]}
            quick={quick}
            onToggle={toggle}
            onClear={clearAll}
            onSort={(s) => setSorts((all) => ({ ...all, [entity]: s }))}
            onMore={loadMore}
          />
        )}
      </div>
    </>
  )
}

function SourceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.soon} data-anchor="source-error" role="status">
      <p className={styles.soonTitle}>Chưa tải được danh bạ</p>
      <p className={styles.soonText}>
        Danh bạ tạm thời chưa phản hồi. Vui lòng thử lại sau ít phút.
      </p>
      <button type="button" className={styles.more} onClick={onRetry}>
        Thử lại
      </button>
    </div>
  )
}

/** DEC-W6P-D03: founders are shown to signed-in members only; a guest sees no name. */
function SignInState({ href }: { href: string }) {
  return (
    <div className={styles.soon} data-anchor="sign-in">
      <p className={styles.soonTitle}>Đăng nhập để xem nhà sáng lập</p>
      <p className={styles.soonText}>
        Thông tin nhà sáng lập chỉ dành cho thành viên đã đăng nhập.
      </p>
      <a href={href} className={styles.more}>
        Đăng nhập
      </a>
    </div>
  )
}

function Directory({
  entity,
  tab,
  query,
  filters,
  sort,
  quick,
  onToggle,
  onClear,
  onSort,
  onMore,
}: {
  entity: Entity
  tab: TabState
  query: string
  filters: Filters
  sort: SortOption['key']
  quick: Array<{ value: string; label: string }>
  onToggle: (group: string, value: string) => void
  onClear: () => void
  onSort: (s: SortOption['key']) => void
  onMore: () => void
}) {
  const [open, setOpen] = useState(false)
  const meta = TABS[entity]
  const loading = tab.status === 'loading'
  const rest = tab.total - tab.cards.length
  const labels = new Map([
    ...quick.map((v) => [`domain:${v.value}`, v.label] as const),
    ...tab.groups.flatMap((g) => g.values.map((v) => [`${g.key}:${v.value}`, v.label] as const)),
  ])
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
            {g.values.map((v) => (
              <label key={v.value} className={styles.facet} data-empty={v.count === 0}>
                <input
                  type="checkbox"
                  checked={(filters[g.key] ?? []).includes(v.value)}
                  onChange={() => onToggle(g.key, v.value)}
                />
                <span className={styles.facetLabel}>{v.label}</span>
                <span className={styles.facetCount}>{v.count}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <p className={styles.facetNote}>
          Bộ lọc không có kết quả vẫn hiện, kèm số 0 — để biết nó tồn tại mà đang rỗng.
        </p>
      </aside>

      <div className={styles.results} aria-busy={loading}>
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
                  aria-label={`Bỏ lọc ${labels.get(`${group}:${value}`) ?? value}`}
                  onClick={() => onToggle(group, value)}
                >
                  {labels.get(`${group}:${value}`) ?? value} ×
                </button>
              ))}
              <button type="button" className={styles.clear} onClick={onClear}>
                Xoá tất cả
              </button>
            </div>
          ) : null}
          <p className={styles.count} aria-live="polite">
            {loading ? 'Đang tải…' : `${tab.total} ${meta.noun}`}
          </p>
          <label className={styles.sort}>
            Sắp xếp:
            <span className={styles.sortValue}>
              {meta.sorts.find((s) => s.key === sort)!.label}
              <select
                aria-label="Sắp xếp"
                value={sort}
                onChange={(e) => onSort(e.target.value as SortOption['key'])}
              >
                {meta.sorts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        {tab.cards.length === 0 ? (
          loading ? (
            <div className={styles.empty} data-anchor="loading">
              <p className={styles.soonText}>Đang tải…</p>
            </div>
          ) : (
            <div className={styles.empty} data-anchor="empty">
              <p className={styles.emptyTitle}>Không có {meta.noun} nào khớp bộ lọc.</p>
              <button type="button" className={styles.clearLight} onClick={onClear}>
                Xoá tất cả bộ lọc
              </button>
            </div>
          )
        ) : (
          <ul className={styles.grid} data-anchor="grid" data-loading={loading}>
            {tab.cards.map((card) =>
              card.kind === 'PROBLEM' ? (
                <ProblemCard key={card.id} card={card} />
              ) : (
                <ProfileCard key={card.id} card={card} />
              ),
            )}
          </ul>
        )}

        {rest > 0 && !loading ? (
          <button
            type="button"
            className={styles.more}
            onClick={onMore}
            disabled={tab.more === 'loading'}
            data-anchor="more"
          >
            {tab.more === 'error'
              ? `Chưa tải được, thử lại (${rest} ${meta.noun})`
              : `Xem thêm ${rest} ${meta.noun}`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ProblemCard({ card }: { card: Card }) {
  const titleId = useId()
  return (
    <li className={`${styles.card} ${styles[`card_${card.tone}`]}`}>
      <article aria-labelledby={titleId}>
        <div className={styles.cardHead}>
          <span className={styles.orgDot} aria-hidden="true">
            {card.mark}
          </span>
          <span className={styles.org}>{card.head}</span>
          {card.pill ? <span className={styles.stage}>{card.pill}</span> : null}
        </div>
        <div className={styles.cardMain}>
          <h2 id={titleId} className={styles.cardTitle}>
            {card.title}
          </h2>
          {card.prize ? <span className={styles.prize}>{card.prize}</span> : null}
        </div>
        {card.summary ? <p className={styles.summary}>{card.summary}</p> : null}
        <p className={styles.meta}>
          {card.meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </p>
        {/* PO decision (30/09): a card action with no destination is not drawn. */}
        {card.cta.href ? (
          <a
            href={card.cta.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={styles.cardCta}
            aria-label={`${card.cta.label} ${card.title} (mở trang ngoài)`}
          >
            {card.cta.label}
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
function ProfileCard({ card }: { card: Card }) {
  const titleId = useId()
  return (
    <li className={styles.pcard} data-kind={card.kind}>
      <article aria-labelledby={titleId}>
        <div className={styles.pcardHead}>
          <span
            className={`${styles.pcardMark} ${styles[`mark_${card.tone}`]}`}
            data-round={card.kind === 'FOUNDER'}
            aria-hidden="true"
          >
            {card.mark}
          </span>
          <div className={styles.pcardWho}>
            <h2 id={titleId} className={styles.pcardName}>
              {card.title}
            </h2>
            {card.sub ? <p className={styles.pcardSub}>{card.sub}</p> : null}
          </div>
          {card.pill ? <span className={styles.pcardStage}>{card.pill}</span> : null}
        </div>
        {card.summary ? <p className={styles.pcardSummary}>{card.summary}</p> : null}
        {card.chips.length ? (
          <p className={styles.pcardChips}>
            {card.chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </p>
        ) : null}
        {card.row ? (
          <OutLink
            href={card.row.href}
            label="Xem startup"
            title={card.row.name}
            className={styles.pcardRow}
          >
            <span className={`${styles.pcardRowMark} ${styles.mark_coral}`} aria-hidden="true">
              {card.row.mark}
            </span>
            <span className={styles.pcardRowName}>{card.row.name}</span>
            {card.row.note ? <span className={styles.pcardRowNote}>{card.row.note}</span> : null}
          </OutLink>
        ) : null}
        {/* PO decision (30/09): no profile page, follow or connection exists for a
            directory record, so only the record's own website is offered. */}
        {card.cta.href ? (
          <div className={styles.pcardActions}>
            <OutLink
              href={card.cta.href}
              label={card.cta.label}
              title={card.title}
              className={styles.pcardPrimary}
            >
              {card.cta.label}
            </OutLink>
          </div>
        ) : null}
      </article>
    </li>
  )
}
