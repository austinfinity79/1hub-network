'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import type { DirectoryPlace, DirectoryStartup } from '@/lib/public/directory-data'
import type { StartupStage } from '@/lib/library/startup-adapter'

import { PublicAction } from '@/components/public-shell/public-action'

import styles from './directory.module.css'

/**
 * DEMO-DIR2-01 — DM08 "Sản phẩm" directory body: hero count, search and quick
 * chips, the filter rail (Lĩnh vực · Giai đoạn · Khu vực), active filters,
 * sort, cards and "Xem thêm". Everything filters the canonical published
 * startups the server passed in; the state is mirrored in the address
 * (`?q=`, `?linh-vuc=`, `?giai-doan=`, `?tinh=`) so a view can be shared and
 * the homepage search lands here. Deterministic: the same inputs give the
 * same list. No ranking or recommendation.
 */

const PAGE = 9

const QUICK = ['Đang gọi vốn', 'Tìm pilot', 'Logistics', 'AgriTech', 'AI'] as const

type Sort = 'activity' | 'newest' | 'name'
const SORTS: Array<{ key: Sort; label: string }> = [
  { key: 'activity', label: 'Hoạt động' },
  { key: 'newest', label: 'Mới nhất' },
  { key: 'name', label: 'Tên A–Z' },
]

export type DirectoryInitial = {
  q: string
  domains: string[]
  stages: StartupStage[]
  province: string | null
}

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

function Check({ on }: { on: boolean }) {
  return <span className={`${styles.box} ${on ? styles.boxOn : ''}`} aria-hidden="true" />
}

export function Directory({
  startups,
  provinces,
  countries,
  stageShort,
  stageOrder,
  guest,
  initial,
}: {
  startups: DirectoryStartup[]
  provinces: DirectoryPlace[]
  countries: DirectoryPlace[]
  stageShort: Record<StartupStage, string>
  stageOrder: StartupStage[]
  guest: boolean
  initial: DirectoryInitial
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(initial.q)
  const [q, setQ] = useState(initial.q)
  const [domains, setDomains] = useState<string[]>(initial.domains)
  const [stages, setStages] = useState<StartupStage[]>(initial.stages)
  const [vietnam, setVietnam] = useState(Boolean(initial.province))
  const [abroad, setAbroad] = useState(false)
  const [province, setProvince] = useState<string | null>(initial.province)
  const [country, setCountry] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('activity')
  const [shown, setShown] = useState(PAGE)

  const domainList = useMemo(
    () =>
      [...new Set(startups.flatMap((s) => s.domains))]
        .map((d) => ({ d, n: startups.filter((s) => s.domains.includes(d)).length }))
        .sort((a, b) => b.n - a.n || a.d.localeCompare(b.d, 'vi')),
    [startups],
  )
  const regionLabels = new Set(provinces.map((p) => p.label))
  const inVietnam = (s: DirectoryStartup) => Boolean(s.region && regionLabels.has(s.region))

  function sync(next: Partial<DirectoryInitial>) {
    const state = { q, domains, stages, province, ...next }
    const params = new URLSearchParams()
    if (state.q) params.set('q', state.q)
    for (const d of state.domains) params.append('linh-vuc', d)
    for (const s of state.stages) params.append('giai-doan', s)
    if (state.province) params.set('tinh', state.province)
    const query = params.toString()
    router.replace(query ? `/products?${query}` : '/products', { scroll: false })
  }

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean)
    const list = startups.filter(
      (s) =>
        terms.every((t) => s.text.includes(t)) &&
        (!domains.length || domains.some((d) => s.domains.includes(d))) &&
        (!stages.length || (s.stage !== null && stages.includes(s.stage))) &&
        (!vietnam || inVietnam(s)) &&
        (!vietnam || !province || s.region === province) &&
        // A canonical venture keeps a Vietnamese province only: none is abroad yet.
        !abroad,
    )
    const by: Record<Sort, (a: DirectoryStartup, b: DirectoryStartup) => number> = {
      activity: (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'vi'),
      newest: (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, 'vi'),
      name: (a, b) => a.name.localeCompare(b.name, 'vi'),
    }
    return [...list].sort(by[sort])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inVietnam derives from provinces
  }, [startups, q, domains, stages, vietnam, abroad, province, sort, provinces])

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
  const clearAll = () => {
    setDraft('')
    setQ('')
    setDomains([])
    setStages([])
    setVietnam(false)
    setAbroad(false)
    setProvince(null)
    setCountry(null)
    setShown(PAGE)
    sync({ q: '', domains: [], stages: [], province: null })
  }

  const active: Array<{ key: string; label: string; remove: () => void }> = [
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
    ...(vietnam && province
      ? [
          {
            key: 'p',
            label: province,
            remove: () => {
              setProvince(null)
              sync({ province: null })
            },
          },
        ]
      : []),
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
            placeholder="Tìm theo tên sản phẩm, lĩnh vực hoặc nhà sáng lập..."
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
              <label key={d} className={styles.option}>
                <input
                  type="checkbox"
                  checked={domains.includes(d)}
                  onChange={() => toggleDomain(d)}
                />
                <Check on={domains.includes(d)} />
                <span className={styles.optionLabel}>{d}</span>
                <span className={styles.optionCount}>{n}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend>GIAI ĐOẠN</legend>
            {stageOrder.map((s) => (
              <label key={s} className={styles.option}>
                <input
                  type="checkbox"
                  checked={stages.includes(s)}
                  onChange={() => toggleStage(s)}
                />
                <Check on={stages.includes(s)} />
                <span className={styles.optionLabel}>{stageShort[s]}</span>
                <span className={styles.optionCount}>
                  {startups.filter((x) => x.stage === s).length}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend>KHU VỰC</legend>
            <label className={styles.option}>
              <input
                type="checkbox"
                checked={vietnam}
                onChange={() => {
                  setVietnam((v) => !v)
                  setProvince(null)
                  sync({ province: null })
                }}
              />
              <Check on={vietnam} />
              <span className={styles.optionLabel}>Việt Nam</span>
              <span className={styles.optionCount}>{startups.filter(inVietnam).length}</span>
            </label>
            <label className={styles.select}>
              <span>Tỉnh/thành:</span>
              <select
                value={province ?? ''}
                disabled={!vietnam}
                onChange={(e) => {
                  const value = e.target.value || null
                  setProvince(value)
                  sync({ province: value })
                }}
              >
                <option value="">Tất cả</option>
                {provinces.map((p) => (
                  <option key={p.slug} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.option}>
              <input type="checkbox" checked={abroad} onChange={() => setAbroad((v) => !v)} />
              <Check on={abroad} />
              <span className={styles.optionLabel}>Quốc tế</span>
              <span className={styles.optionCount}>0</span>
            </label>
            <label className={styles.select}>
              <span>Quốc gia:</span>
              <select
                value={country ?? ''}
                disabled={!abroad}
                onChange={(e) => setCountry(e.target.value || null)}
              >
                <option value="">Tất cả</option>
                {countries.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </aside>

        <div className={styles.results}>
          <div className={styles.bar}>
            <div className={styles.active} aria-live="polite">
              <span>Đang lọc:</span>
              {active.length ? (
                <>
                  {active.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      className={styles.activeChip}
                      onClick={a.remove}
                      aria-label={`Bỏ lọc ${a.label}`}
                    >
                      {a.label} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <button type="button" className={styles.clear} onClick={clearAll}>
                    Xoá tất cả
                  </button>
                </>
              ) : (
                <span className={styles.none}>không có</span>
              )}
            </div>
            <label className={styles.sort}>
              Sắp xếp:
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={styles.srCount} aria-live="polite">
            {results.length} sản phẩm
          </p>
          {results.length === 0 ? (
            <div className={styles.empty} data-state="empty">
              <p>Không có sản phẩm phù hợp với bộ lọc.</p>
              <button type="button" className={styles.clear} onClick={clearAll}>
                Xoá tất cả bộ lọc
              </button>
            </div>
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
                    <PublicAction
                      href={guest ? '/auth' : null}
                      className={styles.follow}
                      cta="follow"
                      label="Theo dõi"
                    >
                      Theo dõi
                    </PublicAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {results.length > shown ? (
            <button type="button" className={styles.more} onClick={() => setShown((n) => n + PAGE)}>
              Xem thêm {results.length - shown} sản phẩm
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}
