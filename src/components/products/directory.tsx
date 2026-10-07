'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import type { DirectoryStartup } from '@/lib/public/directory-data'
import {
  NO_LOCATION,
  PARAM,
  matchesLocation,
  writeLocation,
  type Location,
  type Places,
} from '@/lib/public/discovery-query'
import { PRODUCT_SORTS, type ProductSort } from '@/lib/public/discovery-sorts'
import { readProductView, type ProductView } from '@/lib/public/discovery-views'
import type { StartupStage } from '@/lib/library/startup-adapter'

import {
  ActiveFilters,
  CheckOption,
  EmptyState,
  LocationGroup,
  MoreButton,
  SortSelect,
  locationLabel,
  useAddress,
  type ActiveFilter,
  useAddressView,
} from '@/components/discovery/discovery-parts'
import styles from '@/components/discovery/discovery.module.css'
import { FollowButton } from '@/components/startup/follow-button'

const FOLLOW_LOOK = { follow: styles.follow!, following: styles.following! }

const PLACEHOLDER = 'Tìm theo tên sản phẩm, lĩnh vực hoặc nhà sáng lập...'
const PLACEHOLDER_SHORT = 'Tìm theo tên sản phẩm, lĩnh vực...'

/**
 * DEMO-DIR2-01 / THAO-05 — DM08 "Sản phẩm" directory body: hero count, search
 * and quick chips, the filter rail (Lĩnh vực · Giai đoạn · Khu vực), active
 * filters, sort, cards and "Xem thêm". Everything filters the canonical
 * published startups the server passed in; the state is mirrored in the
 * address (`?q=`, `?linh-vuc=`, `?giai-doan=`, `?quoc-gia=`, `?tinh=`,
 * `?sap-xep=`, DEC-THAO-DIR) so a view can be refreshed, shared and reached
 * with Back. Deterministic: the same inputs give the same list. No ranking or
 * recommendation.
 */

const PAGE = 9

const QUICK = ['Đang gọi vốn', 'Tìm pilot', 'Logistics', 'AgriTech', 'AI'] as const

export type DirectoryInitial = ProductView

const norm = (s: string) => s.trim().toLocaleLowerCase('vi')

/** A quick chip searches its own words; "Tìm pilot" means the Pilot stage. */
const quickTerm = (chip: string) => (chip === 'Tìm pilot' ? 'pilot' : chip)

/** DM08 logo letters: two capitals ("LS"), word initials ("KL"), else the first two letters ("Tr"). */
function cardMark(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return (words[0]!.charAt(0) + words[1]!.charAt(0)).toLocaleUpperCase('vi')
  const caps = name.match(/\p{Lu}/gu) ?? []
  return caps.length >= 2 ? caps.slice(0, 2).join('') : name.slice(0, 2)
}

export function Directory({
  startups,
  places,
  stageShort,
  stageOrder,
  guest,
  followed,
  initial,
}: {
  startups: DirectoryStartup[]
  places: Places
  stageShort: Record<StartupStage, string>
  stageOrder: StartupStage[]
  guest: boolean
  /** Slugs the viewer follows (their own state only; THAO-M3-QA-01). */
  followed: string[]
  initial: DirectoryInitial
}) {
  const address = useAddress('/products')
  const [draft, setDraft] = useState(initial.q)
  // QA-B-06: below 1024 px the DM08 placeholder does not fit the field; a
  // shorter one is set after hydration (same first render on server and client).
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER)
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 1023px)')
    const apply = () => setPlaceholder(narrow.matches ? PLACEHOLDER_SHORT : PLACEHOLDER)
    apply()
    narrow.addEventListener('change', apply)
    return () => narrow.removeEventListener('change', apply)
  }, [])
  const [q, setQ] = useState(initial.q)
  const [domains, setDomains] = useState<string[]>(initial.domains)
  const [stages, setStages] = useState<StartupStage[]>(initial.stages)
  const [location, setLocation] = useState<Location>(initial.location)
  const [sort, setSort] = useState<ProductSort>(initial.sort)
  const [shown, setShown] = useState(PAGE)

  const domainList = useMemo(
    () =>
      [...new Set(startups.flatMap((s) => s.domains))]
        .map((d) => ({ d, n: startups.filter((s) => s.domains.includes(d)).length }))
        .sort((a, b) => b.n - a.n || a.d.localeCompare(b.d, 'vi')),
    [startups],
  )
  const placed = useMemo(
    () => startups.map((s) => ({ country: s.country, region: s.regionSlug })),
    [startups],
  )

  useAddressView(
    initial,
    (p) => readProductView(p, { domains: domainList.map((x) => x.d), stages: stageOrder, places }),
    (v) => {
      setDraft(v.q)
      setQ(v.q)
      setDomains(v.domains)
      setStages(v.stages)
      setLocation(v.location)
      setSort(v.sort)
    },
  )

  function sync(next: Partial<DirectoryInitial>) {
    const state = { q, domains, stages, location, sort, ...next }
    const params = new URLSearchParams()
    if (state.q) params.set(PARAM.q, state.q)
    for (const d of state.domains) params.append('linh-vuc', d)
    for (const s of state.stages) params.append('giai-doan', s)
    if (!state.location.invalid) writeLocation(params, state.location)
    if (state.sort !== 'hoat-dong') params.set(PARAM.sort, state.sort)
    address(params)
  }

  // A legacy `?tinh=<label>` (DEMO-DIR2-01) arrives normalised: rewrite the
  // address once with the canonical slugs.
  useEffect(() => {
    if (initial.location.region && !initial.location.invalid) sync({})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [])

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean)
    const list = startups.filter(
      (s) =>
        terms.every((t) => s.text.includes(t)) &&
        (!domains.length || domains.some((d) => s.domains.includes(d))) &&
        (!stages.length || (s.stage !== null && stages.includes(s.stage))) &&
        matchesLocation(location, { country: s.country, region: s.regionSlug }),
    )
    const by: Record<ProductSort, (a: DirectoryStartup, b: DirectoryStartup) => number> = {
      'hoat-dong': (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'vi'),
      'moi-nhat': (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, 'vi'),
      'ten-a-z': (a, b) => a.name.localeCompare(b.name, 'vi') || a.slug.localeCompare(b.slug),
    }
    return [...list].sort(by[sort])
  }, [startups, q, domains, stages, location, sort])

  // DEMO STATE ONLY counters: only the demo ventures carry these states.
  const fundraising = startups.filter((s) => s.fundraising).length
  const paying = startups.filter((s) => s.payingCustomers).length
  const portfolio = startups.filter((s) => s.portfolio === 'iHUB Ventures').length

  function search(e: FormEvent) {
    e.preventDefault()
    setQ(draft.trim())
    setShown(PAGE)
    sync({ q: draft.trim() })
  }

  function quick(chip: string) {
    const term = quickTerm(chip)
    setDraft(term)
    setQ(term)
    setShown(PAGE)
    sync({ q: term })
  }

  const toggleDomain = (d: string) => {
    const next = domains.includes(d) ? domains.filter((x) => x !== d) : [...domains, d]
    setDomains(next)
    setShown(PAGE)
    sync({ domains: next })
  }
  const toggleStage = (s: StartupStage) => {
    const next = stages.includes(s) ? stages.filter((x) => x !== s) : [...stages, s]
    setStages(next)
    setShown(PAGE)
    sync({ stages: next })
  }
  const place = (next: Location) => {
    setLocation(next)
    setShown(PAGE)
    sync({ location: next })
  }
  const clearAll = () => {
    setDraft('')
    setQ('')
    setDomains([])
    setStages([])
    setLocation(NO_LOCATION)
    setShown(PAGE)
    sync({ q: '', domains: [], stages: [], location: NO_LOCATION })
  }

  const where = locationLabel(places, location)
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
    ...domains.map((d) => ({ key: `d-${d}`, label: d, remove: () => toggleDomain(d) })),
    ...stages.map((s) => ({ key: `s-${s}`, label: stageShort[s], remove: () => toggleStage(s) })),
    ...(where ? [{ key: 'p', label: where, remove: () => place(NO_LOCATION) }] : []),
  ]

  return (
    <>
      <section className={styles.hero} data-section="directory-hero">
        <p className={styles.eyebrow}>SẢN PHẨM</p>
        {/* The count is live (INTENTIONAL-DATA in pixel QA). */}
        <h1 className={styles.title} data-pixel="data">
          <span className={styles.count}>{startups.length}</span> sản phẩm trong mạng lưới
        </h1>
        <form className={styles.search} role="search" aria-label="Tìm sản phẩm" onSubmit={search}>
          <span className={styles.scope}>
            Sản phẩm
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
            placeholder={placeholder}
            aria-label="Từ khoá"
            autoComplete="off"
          />
          <button type="submit" className={styles.go}>
            Tìm kiếm
          </button>
        </form>
        <div className={styles.quick}>
          <span>Tìm nhanh:</span>
          {QUICK.map((c) => (
            <button key={c} type="button" className={styles.quickChip} onClick={() => quick(c)}>
              {c}
            </button>
          ))}
        </div>
        <dl className={styles.stats}>
          <div>
            <dt data-pixel="data">{fundraising}</dt>
            <dd>sản phẩm đang gọi vốn</dd>
          </div>
          <div>
            <dt data-pixel="data">{paying}</dt>
            <dd>có khách hàng trả phí</dd>
          </div>
          <div>
            <dt data-pixel="data">{portfolio}</dt>
            <dd>trong danh mục iHUB Ventures</dd>
          </div>
        </dl>
      </section>

      <div className={styles.body} data-section="directory">
        <aside className={styles.rail} aria-label="Bộ lọc">
          <fieldset className={styles.group}>
            <legend>LĨNH VỰC</legend>
            {domainList.map(({ d, n }) => (
              <CheckOption
                key={d}
                label={d}
                count={n}
                checked={domains.includes(d)}
                onChange={() => toggleDomain(d)}
              />
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend>GIAI ĐOẠN</legend>
            {stageOrder.map((s) => (
              <CheckOption
                key={s}
                label={stageShort[s]}
                count={startups.filter((x) => x.stage === s).length}
                checked={stages.includes(s)}
                onChange={() => toggleStage(s)}
              />
            ))}
          </fieldset>
          <LocationGroup places={places} rows={placed} value={location} onChange={place} />
        </aside>

        <div className={styles.results}>
          <div className={styles.bar}>
            <ActiveFilters items={active} onClear={clearAll} />
            <SortSelect
              value={sort}
              options={PRODUCT_SORTS}
              onChange={(next) => {
                setSort(next)
                sync({ sort: next })
              }}
            />
          </div>
          <p className={styles.srCount} aria-live="polite">
            {results.length} sản phẩm
          </p>
          {results.length === 0 ? (
            <EmptyState
              text={
                location.invalid
                  ? 'Khu vực không có trong danh mục, hoặc tỉnh/thành không thuộc quốc gia đã chọn.'
                  : 'Không có sản phẩm phù hợp với bộ lọc.'
              }
              onClear={clearAll}
            />
          ) : (
            <ul className={styles.grid} role="list">
              {results.slice(0, shown).map((s) => (
                <li key={s.slug} className={styles.card} data-startup={s.slug}>
                  <div className={styles.cardHead}>
                    <span className={styles.logo} aria-hidden="true">
                      {cardMark(s.name)}
                    </span>
                    <div className={styles.cardName}>
                      <h2>{s.name}</h2>
                      {s.region ? <p>{s.region.replace(/^TP\. /, '')}</p> : null}
                    </div>
                    {s.stage ? <span className={styles.stage}>{stageShort[s.stage]}</span> : null}
                  </div>
                  {s.summary ? <p className={styles.summary}>{s.summary}</p> : null}
                  <ul className={styles.tags} role="list">
                    {s.domains.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <div className={styles.actions}>
                    <Link href={s.href} className={styles.view} data-cta="view-startup">
                      Xem hồ sơ
                    </Link>
                    {/* Follow v1 (DEC-THAO-SP-D4): guest → /auth, a member follows. */}
                    <FollowButton
                      slug={s.slug}
                      guest={guest}
                      initial={followed.includes(s.slug)}
                      look={FOLLOW_LOOK}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <MoreButton
            hidden={results.length - shown}
            noun="sản phẩm"
            onMore={() => setShown((n) => n + PAGE)}
          />
        </div>
      </div>
    </>
  )
}
