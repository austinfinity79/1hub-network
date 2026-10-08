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
 * programme list (DEC-THAO-DIR-D1). Rows are the source-backed programmes
 * (PROGRAMME-PRESENTATION-DATA-01); this view searches, filters by phase,
 * sorts and mirrors everything in the address (`?q=`, `?trang-thai=`,
 * `?sap-xep=`). S2-PROGRAMME-EVENT-CONTENT-01 removed the type ("Loại") and
 * host ("Đơn vị chủ quản") filters. No public detail page exists: a card
 * opens the member apply entry when the server offered one, else it is
 * READ_ONLY.
 */

const PAGE = 9

type ProgrammeInitial = ProgrammeView

const PHASE_RANK: Record<ProgrammePhase, number> = {
  'dang-mo': 0,
  'sap-toi': 1,
  'sap-cong-bo': 2,
  'da-ket-thuc': 3,
}
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
  const [sort, setSort] = useState(initial.sort)
  const [shown, setShown] = useState(PAGE)

  useAddressView(initial, readProgrammeView, (v) => {
    setDraft(v.q)
    setQ(v.q)
    setPhases(v.phases)
    setSort(v.sort)
  })

  function sync(next: Partial<ProgrammeInitial>) {
    const s = { q, phases, sort, ...next }
    const params = new URLSearchParams()
    if (s.q) params.set(PARAM.q, s.q)
    for (const v of s.phases) params.append('trang-thai', v)
    if (s.sort !== 'sap-dien-ra') params.set(PARAM.sort, s.sort)
    address(params)
  }

  const results = useMemo(() => {
    const list = programmes.filter(
      (p) => matchesQuery(p.text, q) && (!phases.length || phases.includes(p.phase)),
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
  }, [programmes, q, phases, sort])

  const count = (phase: ProgrammePhase) => programmes.filter((p) => p.phase === phase).length

  const setAndSync = <K extends keyof ProgrammeInitial>(key: K, value: ProgrammeInitial[K]) => {
    if (key === 'phases') setPhases(value as ProgrammePhase[])
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
    setShown(PAGE)
    sync({ q: '', phases: [] })
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
  ]

  return (
    <>
      <section className={styles.hero} data-section="directory-hero">
        <p className={styles.eyebrow}>CHƯƠNG TRÌNH</p>
        {/* S2-PROGRAMME-CATALOG-REFRESH-01: the PO's line; no counter. */}
        <h1 className={`${styles.title} ${styles.titleLong}`}>
          các cuộc thi khởi nghiệp, chương trình đổi mới sáng tạo trong mạng lưới
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
          <Link href="/problems" className={styles.quickChip} data-cta="to-problems">
            Bài toán →
          </Link>
        </div>
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
                  {/* The approved cover only; without one the card keeps its plain ground. */}
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static approved cover
                    <img
                      className={styles.progArt}
                      src={p.image}
                      alt=""
                      loading="lazy"
                      data-programme-cover=""
                    />
                  ) : null}
                  <div className={styles.progHead}>
                    {/* An unpublished host is not named, and nothing replaces it. */}
                    <span className={styles.progHost} title={p.hosts.join(' · ') || undefined}>
                      {p.hosts.length ? (
                        <>
                          <span aria-hidden="true" />
                          <b>{p.hosts.join(' · ')}</b>
                        </>
                      ) : null}
                    </span>
                    <span className={styles.progPhase}>{PHASE_LABEL[p.phase]}</span>
                  </div>
                  <h2 className={styles.progName}>{p.name}</h2>
                  {p.summary ? <p className={styles.progSummary}>{p.summary}</p> : null}
                  <ul className={styles.progTags} role="list">
                    {p.timeline ? <li>{p.timeline}</li> : null}
                    {p.kind ? <li>{KIND_LABEL[p.kind]}</li> : null}
                    {p.domain ? <li data-programme-domain="">{p.domain}</li> : null}
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
