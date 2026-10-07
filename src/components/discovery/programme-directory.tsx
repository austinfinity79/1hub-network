'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'

import { PARAM, matchesQuery } from '@/lib/public/discovery-query'
import { PROGRAMME_SORTS, type ProgrammeSort } from '@/lib/public/discovery-sorts'
import { readProgrammeView, type ProgrammeView } from '@/lib/public/discovery-views'
import type { DirectoryProgramme } from '@/lib/public/programme-directory'
import {
  KINDS,
  PHASES,
  type ProgrammeKind,
  type ProgrammePhase,
} from '@/lib/public/programme-phase'

import { PublicAction } from '@/components/public-shell/public-action'

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
 * THAO-05 DIR0 — `/programmes` (DM06 "Chương trình, cuộc thi"), the public
 * programme list (DEC-THAO-DIR-D1). Rows come projected from the server
 * (PUBLISHED and CLOSED only); this view searches, filters by phase, type and
 * host, sorts and mirrors everything in the address (`?q=`, `?trang-thai=`,
 * `?loai=`, `?don-vi=`, `?sap-xep=`). No public detail page exists: a card
 * opens the member apply entry when the server offered one, else it is
 * READ_ONLY.
 */

const PAGE = 9

type ProgrammeInitial = ProgrammeView

const PHASE_RANK: Record<ProgrammePhase, number> = { 'dang-mo': 0, 'sap-toi': 1, 'da-ket-thuc': 2 }
const PHASE_LABEL = Object.fromEntries(PHASES.map((p) => [p.key, p.label])) as Record<
  ProgrammePhase,
  string
>
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label])) as Record<
  ProgrammeKind,
  string
>

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

export function ProgrammeDirectory({
  programmes,
  initial,
}: {
  programmes: DirectoryProgramme[]
  initial: ProgrammeInitial
}) {
  const address = useAddress('/programmes')
  const [draft, setDraft] = useState(initial.q)
  const [q, setQ] = useState(initial.q)
  const [phases, setPhases] = useState(initial.phases)
  const [kinds, setKinds] = useState(initial.kinds)
  const [hosts, setHosts] = useState(initial.hosts)
  const [sort, setSort] = useState(initial.sort)
  const [shown, setShown] = useState(PAGE)

  const hostList = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of programmes) if (p.host) seen.set(p.host.slug, p.host.name)
    return [...seen]
      .map(([slug, name]) => ({
        slug,
        name,
        n: programmes.filter((p) => p.host?.slug === slug).length,
      }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'vi'))
  }, [programmes])

  useAddressView(
    initial,
    (p) =>
      readProgrammeView(
        p,
        hostList.map((h) => h.slug),
      ),
    (v) => {
      setDraft(v.q)
      setQ(v.q)
      setPhases(v.phases)
      setKinds(v.kinds)
      setHosts(v.hosts)
      setSort(v.sort)
    },
  )

  function sync(next: Partial<ProgrammeInitial>) {
    const s = { q, phases, kinds, hosts, sort, ...next }
    const params = new URLSearchParams()
    if (s.q) params.set(PARAM.q, s.q)
    for (const v of s.phases) params.append('trang-thai', v)
    for (const v of s.kinds) params.append('loai', v)
    for (const v of s.hosts) params.append('don-vi', v)
    if (s.sort !== 'sap-dien-ra') params.set(PARAM.sort, s.sort)
    address(params)
  }

  const results = useMemo(() => {
    const list = programmes.filter(
      (p) =>
        matchesQuery(p.text, q) &&
        (!phases.length || phases.includes(p.phase)) &&
        (!kinds.length || kinds.includes(p.kind)) &&
        (!hosts.length || (p.host !== null && hosts.includes(p.host.slug))),
    )
    const byName = (a: DirectoryProgramme, b: DirectoryProgramme) =>
      a.name.localeCompare(b.name, 'vi') || a.slug.localeCompare(b.slug)
    const start = (p: DirectoryProgramme) => p.startsAt ?? '9999'
    const by: Record<ProgrammeSort, (a: DirectoryProgramme, b: DirectoryProgramme) => number> = {
      'sap-dien-ra': (a, b) =>
        PHASE_RANK[a.phase] - PHASE_RANK[b.phase] ||
        start(a).localeCompare(start(b)) ||
        byName(a, b),
      'moi-nhat': (a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? '') || byName(a, b),
      'ten-a-z': byName,
    }
    return [...list].sort(by[sort])
  }, [programmes, q, phases, kinds, hosts, sort])

  const count = (phase: ProgrammePhase) => programmes.filter((p) => p.phase === phase).length

  const setAndSync = <K extends keyof ProgrammeInitial>(key: K, value: ProgrammeInitial[K]) => {
    if (key === 'phases') setPhases(value as ProgrammePhase[])
    if (key === 'kinds') setKinds(value as ProgrammeKind[])
    if (key === 'hosts') setHosts(value as string[])
    setShown(PAGE)
    sync({ [key]: value } as Partial<ProgrammeInitial>)
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
    setPhases([])
    setKinds([])
    setHosts([])
    setShown(PAGE)
    sync({ q: '', phases: [], kinds: [], hosts: [] })
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
    ...phases.map((p) => ({
      key: `p-${p}`,
      label: PHASE_LABEL[p],
      remove: () => setAndSync('phases', toggle(phases, p)),
    })),
    ...kinds.map((k) => ({
      key: `k-${k}`,
      label: KIND_LABEL[k],
      remove: () => setAndSync('kinds', toggle(kinds, k)),
    })),
    ...hosts.map((h) => ({
      key: `h-${h}`,
      label: hostList.find((x) => x.slug === h)?.name ?? h,
      remove: () => setAndSync('hosts', toggle(hosts, h)),
    })),
  ]

  return (
    <>
      <section className={styles.hero} data-section="directory-hero">
        <p className={styles.eyebrow}>CHƯƠNG TRÌNH</p>
        <h1 className={styles.title} data-pixel="data">
          <span className={styles.count}>{count('dang-mo')}</span> chương trình đang mở
        </h1>
        <form
          className={styles.search}
          role="search"
          aria-label="Tìm chương trình"
          onSubmit={search}
        >
          <span className={styles.scope}>
            Chương trình
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
            placeholder="Tìm theo tên chương trình hoặc đơn vị chủ quản..."
            aria-label="Từ khoá"
            autoComplete="off"
          />
          <button type="submit" className={styles.go}>
            Tìm kiếm
          </button>
        </form>
        <div className={styles.quick}>
          <span>Tìm nhanh:</span>
          {PHASES.slice(0, 2).map((p) => (
            <button
              key={p.key}
              type="button"
              className={styles.quickChip}
              aria-pressed={phases.includes(p.key)}
              onClick={() => setAndSync('phases', toggle(phases, p.key))}
            >
              {p.label}
            </button>
          ))}
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={styles.quickChip}
              aria-pressed={kinds.includes(k.key)}
              onClick={() => setAndSync('kinds', toggle(kinds, k.key))}
            >
              {k.label}
            </button>
          ))}
          <Link href="/problems" className={styles.quickChip} data-cta="to-problems">
            Bài toán →
          </Link>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt data-pixel="data">{count('sap-toi')}</dt>
            <dd>chương trình sắp tới</dd>
          </div>
          <div>
            <dt data-pixel="data">{count('da-ket-thuc')}</dt>
            <dd>chương trình đã kết thúc</dd>
          </div>
          <div>
            <dt data-pixel="data">{hostList.length}</dt>
            <dd>đơn vị chủ quản</dd>
          </div>
        </dl>
      </section>

      <div className={styles.body} data-section="directory">
        <aside className={styles.rail} aria-label="Bộ lọc">
          <fieldset className={styles.group}>
            <legend>TRẠNG THÁI</legend>
            {PHASES.map((p) => (
              <CheckOption
                key={p.key}
                label={p.label}
                count={count(p.key)}
                checked={phases.includes(p.key)}
                onChange={() => setAndSync('phases', toggle(phases, p.key))}
              />
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend>LOẠI</legend>
            {KINDS.map((k) => (
              <CheckOption
                key={k.key}
                label={k.label}
                count={programmes.filter((p) => p.kind === k.key).length}
                checked={kinds.includes(k.key)}
                onChange={() => setAndSync('kinds', toggle(kinds, k.key))}
              />
            ))}
          </fieldset>
          {hostList.length ? (
            <fieldset className={styles.group}>
              <legend>ĐƠN VỊ CHỦ QUẢN</legend>
              {hostList.map((h) => (
                <CheckOption
                  key={h.slug}
                  label={h.name}
                  count={h.n}
                  checked={hosts.includes(h.slug)}
                  onChange={() => setAndSync('hosts', toggle(hosts, h.slug))}
                />
              ))}
            </fieldset>
          ) : null}
        </aside>

        <div className={styles.results}>
          <div className={styles.bar}>
            <ActiveFilters items={active} onClear={clearAll} />
            <SortSelect
              value={sort}
              options={PROGRAMME_SORTS}
              onChange={(next) => {
                setSort(next)
                sync({ sort: next })
              }}
            />
          </div>
          <p className={styles.srCount} aria-live="polite">
            {results.length} chương trình
          </p>
          {results.length === 0 ? (
            <EmptyState
              text={
                programmes.length
                  ? 'Không có chương trình phù hợp với bộ lọc.'
                  : 'Chưa có chương trình công khai.'
              }
              onClear={clearAll}
            />
          ) : (
            <ul className={styles.grid} role="list">
              {results.slice(0, shown).map((p) => (
                <li key={p.slug} className={styles.progCard} data-programme={p.phase}>
                  <div className={styles.progHead}>
                    {/* An unpublished host is not named, and nothing replaces it. */}
                    <span className={styles.progHost}>
                      {p.host ? (
                        <>
                          <span aria-hidden="true" />
                          {p.host.name}
                        </>
                      ) : null}
                    </span>
                    <span className={styles.progPhase}>{PHASE_LABEL[p.phase]}</span>
                  </div>
                  <h2 className={styles.progName}>{p.name}</h2>
                  {p.summary ? <p className={styles.progSummary}>{p.summary}</p> : null}
                  <ul className={styles.progTags} role="list">
                    {p.timeline ? <li>{p.timeline}</li> : null}
                    <li>{KIND_LABEL[p.kind]}</li>
                  </ul>
                  <PublicAction
                    href={p.applyHref}
                    className={styles.progCta}
                    cta={p.applyHref ? 'programme-apply' : 'programme-view'}
                    label={p.applyHref ? `Đăng ký tham gia ${p.name}` : 'Xem chương trình'}
                  >
                    {p.applyHref ? 'Đăng ký tham gia' : 'Xem chương trình'}
                  </PublicAction>
                </li>
              ))}
            </ul>
          )}
          <MoreButton
            hidden={results.length - shown}
            noun="chương trình"
            onMore={() => setShown((n) => n + PAGE)}
          />
        </div>
      </div>
    </>
  )
}
