'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'

import {
  NO_LOCATION,
  PARAM,
  matchesLocation,
  matchesQuery,
  writeLocation,
  type Location,
  type Places,
} from '@/lib/public/discovery-query'
import { TALENT_SORTS, type TalentSort } from '@/lib/public/discovery-sorts'
import { readTalentView, type TalentView } from '@/lib/public/discovery-views'
import type { TalentCard } from '@/lib/public/talent-directory'

import { PublicAction } from '@/components/public-shell/public-action'

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
} from './discovery-parts'
import styles from './discovery.module.css'

/**
 * THAO-05 DIR3 — `/talents` for a signed-in member (DM09, DEC-THAO-DIR-D3/D4).
 * The cards are the server's PROFILE_DISCOVERY projection at NETWORK_ONLY;
 * this view searches them and filters by domain and place only (no skills or
 * specialisations). State mirrors in the address (`?q=`, `?linh-vuc=`,
 * `?quoc-gia=`, `?tinh=`, `?sap-xep=`). A real person's card has no detail
 * page (READ_ONLY); an allow-listed demo founder opens `/talents/[handle]`.
 */

const PAGE = 9

type TalentInitial = TalentView

const toggle = (list: string[], v: string) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

export function TalentDirectory({
  talents,
  places,
  initial,
}: {
  talents: TalentCard[]
  places: Places
  initial: TalentInitial
}) {
  const address = useAddress('/talents')
  const [draft, setDraft] = useState(initial.q)
  const [q, setQ] = useState(initial.q)
  const [domains, setDomains] = useState(initial.domains)
  const [location, setLocation] = useState(initial.location)
  const [sort, setSort] = useState(initial.sort)
  const [shown, setShown] = useState(PAGE)

  const domainList = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of talents) for (const d of t.domains) counts.set(d, (counts.get(d) ?? 0) + 1)
    return [...counts]
      .map(([d, n]) => ({ d, n }))
      .sort((a, b) => b.n - a.n || a.d.localeCompare(b.d, 'vi'))
  }, [talents])
  const placed = useMemo(
    () => talents.map((t) => ({ country: t.country, region: t.regionSlug })),
    [talents],
  )

  useAddressView(
    initial,
    (p) => readTalentView(p, { domains: domainList.map((x) => x.d), places }),
    (v) => {
      setDraft(v.q)
      setQ(v.q)
      setDomains(v.domains)
      setLocation(v.location)
      setSort(v.sort)
    },
  )

  function sync(next: Partial<TalentInitial>) {
    const s = { q, domains, location, sort, ...next }
    const params = new URLSearchParams()
    if (s.q) params.set(PARAM.q, s.q)
    for (const d of s.domains) params.append('linh-vuc', d)
    if (!s.location.invalid) writeLocation(params, s.location)
    if (s.sort !== 'ten-a-z') params.set(PARAM.sort, s.sort)
    address(params)
  }

  const results = useMemo(() => {
    const list = talents.filter(
      (t) =>
        matchesQuery(t.text, q) &&
        (!domains.length || domains.some((d) => t.domains.includes(d))) &&
        matchesLocation(location, { country: t.country, region: t.regionSlug }),
    )
    const byName = (a: TalentCard, b: TalentCard) =>
      a.name.localeCompare(b.name, 'vi') || a.key.localeCompare(b.key)
    const by: Record<TalentSort, (a: TalentCard, b: TalentCard) => number> = {
      'ten-a-z': byName,
      'co-san-pham': (a, b) =>
        Number(!a.ventures.length) - Number(!b.ventures.length) || byName(a, b),
    }
    // A pinned card (S2-TALENT-DIRECTORY-CLEANUP-01) leads under every sort.
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || by[sort](a, b))
  }, [talents, q, domains, location, sort])

  function search(e: FormEvent) {
    e.preventDefault()
    setQ(draft.trim())
    setShown(PAGE)
    sync({ q: draft.trim() })
  }
  const pickDomain = (d: string) => {
    const next = toggle(domains, d)
    setDomains(next)
    setShown(PAGE)
    sync({ domains: next })
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
    setLocation(NO_LOCATION)
    setShown(PAGE)
    sync({ q: '', domains: [], location: NO_LOCATION })
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
    ...domains.map((d) => ({ key: `d-${d}`, label: d, remove: () => pickDomain(d) })),
    ...(where ? [{ key: 'p', label: where, remove: () => place(NO_LOCATION) }] : []),
  ]

  return (
    <>
      <section className={styles.hero} data-section="directory-hero">
        <p className={styles.eyebrow}>NHÂN TÀI</p>
        {/* S2-TALENT-DIRECTORY-CLEANUP-01: the PO's wording, no count. */}
        <h1 className={styles.title}>các nhân tài trong mạng lưới</h1>
        <form className={styles.search} role="search" aria-label="Tìm nhân tài" onSubmit={search}>
          <span className={styles.scope}>
            Nhân tài
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
            placeholder="Tìm theo tên, lĩnh vực hoặc tỉnh/thành..."
            aria-label="Từ khoá"
            autoComplete="off"
          />
          <button type="submit" className={styles.go}>
            Tìm kiếm
          </button>
        </form>
        <div className={styles.quick}>
          <span>Tìm nhanh:</span>
          {domainList.slice(0, 4).map(({ d }) => (
            <button
              key={d}
              type="button"
              className={styles.quickChip}
              aria-pressed={domains.includes(d)}
              onClick={() => pickDomain(d)}
            >
              {d}
            </button>
          ))}
        </div>
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
                onChange={() => pickDomain(d)}
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
              options={TALENT_SORTS}
              onChange={(next) => {
                setSort(next)
                sync({ sort: next })
              }}
            />
          </div>
          <p className={styles.srCount} aria-live="polite">
            {results.length} nhân tài
          </p>
          {results.length === 0 ? (
            <EmptyState
              text={
                location.invalid
                  ? 'Khu vực không có trong danh mục, hoặc tỉnh/thành không thuộc quốc gia đã chọn.'
                  : 'Không có nhân tài phù hợp với bộ lọc.'
              }
              onClear={clearAll}
            />
          ) : (
            <ul className={styles.grid} role="list">
              {results.slice(0, shown).map((t) => (
                <li key={t.key} className={styles.card} data-talent="">
                  <div className={styles.cardHead}>
                    <span className={styles.avatar} aria-hidden="true">
                      {t.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- authorised media route
                        <img src={t.avatarUrl} alt="" width={52} height={52} />
                      ) : (
                        t.initials
                      )}
                    </span>
                    <div className={styles.cardName}>
                      <h2>{t.name}</h2>
                      {t.headline ? <p className={styles.headline}>{t.headline}</p> : null}
                      {t.region ? <p>{t.region.replace(/^TP\. /, '')}</p> : null}
                    </div>
                  </div>
                  <ul className={styles.tags} role="list">
                    {t.domains.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  {t.ventures.length ? (
                    <ul className={styles.ventures} role="list">
                      {t.ventures.map((v) => (
                        <li key={v.href}>
                          <Link href={v.href}>{v.name}</Link>
                          {v.stage ? <span>{v.stage}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className={styles.actions}>
                    <PublicAction
                      href={t.href}
                      className={styles.view}
                      cta={t.href ? 'talent-profile' : 'talent-profile-readonly'}
                      label="Xem hồ sơ"
                    >
                      Xem hồ sơ
                    </PublicAction>
                    <PublicAction
                      href={null}
                      className={styles.follow}
                      cta="connect"
                      label="Kết nối"
                    >
                      Kết nối
                    </PublicAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <MoreButton
            hidden={results.length - shown}
            noun="nhân tài"
            onMore={() => setShown((n) => n + PAGE)}
          />
        </div>
      </div>
    </>
  )
}
