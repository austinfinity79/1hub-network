'use client'

import { useEffect, useMemo, useState } from 'react'

import { PUBLIC_ROUTES } from '@/lib/public/routes'

import { ArrowRight, PublicAction } from '@/components/public-shell/public-action'

import styles from './home.module.css'

/**
 * S2-HOME-TALENT-SECTION-01 — "Nhân tài" (Figma 889:6350, HOME.33–36): one
 * person featured over their own picture, the next people as portrait cards
 * that rotate every 6 s (arrows, progress, pause; no autoplay under reduced
 * motion), domain chips from the people shown.
 *
 * Privacy (NETWORK_ONLY): `people` is the canonical talent directory
 * (listTalents) and reaches this component only for a signed-in NETWORK
 * viewer; a guest gets `null` from the server and sees the section shell with
 * the sign-in entry — no name, picture or count. Fields without a source in
 * the directory (update line, "Mời vào đội", verified / status tags) are not
 * drawn.
 */

export type HomeTalent = {
  key: string
  name: string
  initials: string
  avatarUrl: string | null
  headline: string | null
  region: string | null
  domains: string[]
  /** The existing talent detail route, else null (READ_ONLY). */
  href: string | null
}

const ROTATE_MS = 6_000
const RAIL = 6

function Portrait({ person, className }: { person: HomeTalent; className?: string }) {
  return person.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- authorised media route
    <img className={className} src={person.avatarUrl} alt="" data-talent-avatar="" />
  ) : (
    <span className={`${className ?? ''} ${styles.talentInitials}`} aria-hidden="true">
      {person.initials}
    </span>
  )
}

function Gate({ entry }: { entry: string | null }) {
  return (
    <div className={styles.talentGate} data-state="talent-gate">
      <p>
        Hồ sơ nhân tài chỉ hiển thị trong mạng lưới, cho thành viên đã đăng nhập, theo lựa chọn hiển
        thị của từng người.
      </p>
      <PublicAction href={entry} className={styles.talentPrimary} cta="home-talent-sign-in">
        Đăng nhập để xem
      </PublicAction>
    </div>
  )
}

export function HomeTalents({
  people,
  entry,
}: {
  people: HomeTalent[] | null
  entry: string | null
}) {
  const [domain, setDomain] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const domains = useMemo(() => {
    const n = new Map<string, number>()
    for (const p of people ?? []) for (const d of p.domains) n.set(d, (n.get(d) ?? 0) + 1)
    return [...n]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
      .slice(0, 4)
      .map(([d]) => d)
  }, [people])

  const list = useMemo(
    () => (people ?? []).filter((p) => !domain || p.domains.includes(domain)),
    [people, domain],
  )
  const count = list.length
  const at = count ? index % count : 0

  useEffect(() => {
    if (paused || reduced || count < 2) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS)
    return () => window.clearTimeout(t)
  }, [index, paused, reduced, count])

  const featured = list[at] ?? null
  const rail = count
    ? Array.from({ length: Math.min(RAIL, count - 1) }, (_, k) => (at + 1 + k) % count)
    : []
  const go = (step: number) => setIndex((i) => (count ? (i + step + count) % count : 0))
  const pick = (d: string | null) => {
    setDomain(d)
    setIndex(0)
  }

  return (
    <section
      className={styles.talents}
      data-section="talents"
      data-viewer={people ? 'NETWORK' : 'GUEST'}
      aria-labelledby="home-talents"
    >
      {featured?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- authorised media route
        <img key={featured.key} className={styles.talentBackdrop} src={featured.avatarUrl} alt="" />
      ) : null}
      <span className={styles.talentShade} aria-hidden="true" />
      <div className={styles.talentInner}>
        <div className={styles.talentHead}>
          <div>
            <p className={styles.talentEyebrow}>NHÂN TÀI</p>
            <h2 id="home-talents" className={styles.talentTitle}>
              Nhân tài sẵn sàng tham gia đội của bạn
            </h2>
          </div>
          {people && domains.length ? (
            <div className={styles.talentChips} role="group" aria-label="Lĩnh vực">
              {[null, ...domains].map((d) => (
                <button
                  key={d ?? 'all'}
                  type="button"
                  className={`${styles.talentChip} ${domain === d ? styles.talentChipOn : ''}`}
                  aria-pressed={domain === d}
                  onClick={() => pick(d)}
                >
                  {d ?? 'Tất cả'}
                </button>
              ))}
            </div>
          ) : null}
          <PublicAction
            href={PUBLIC_ROUTES.talents}
            className={styles.talentAll}
            cta="home-talents-all"
          >
            Xem tất cả nhân tài <ArrowRight />
          </PublicAction>
        </div>

        {!people ? (
          <Gate entry={entry} />
        ) : !featured ? (
          <p className={styles.talentEmpty}>Chưa có nhân tài trong lĩnh vực này.</p>
        ) : (
          <div className={styles.talentStage}>
            <div
              className={styles.talentFeature}
              data-talent-featured={featured.key}
              aria-live="polite"
            >
              <span className={styles.talentRule} aria-hidden="true" />
              {featured.headline || featured.region ? (
                <p className={styles.talentRole}>
                  {[featured.headline, featured.region].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              <h3 className={styles.talentName}>{featured.name}</h3>
              {featured.domains.length ? (
                <ul className={styles.talentTags} role="list">
                  {featured.domains.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
              {featured.href ? (
                <PublicAction
                  href={featured.href}
                  className={styles.talentPrimary}
                  cta="home-talent-profile"
                >
                  Xem hồ sơ
                </PublicAction>
              ) : null}
            </div>
            <div className={styles.talentSide}>
              <ul className={styles.talentRail} role="list">
                {rail.map((i) => {
                  const p = list[i]!
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        className={styles.talentCard}
                        onClick={() => setIndex(i)}
                        aria-label={`Xem ${p.name}`}
                        data-talent={p.key}
                      >
                        <Portrait person={p} className={styles.talentPhoto} />
                        <span className={styles.talentCardText}>
                          {p.headline || p.region ? (
                            <small>{[p.headline, p.region].filter(Boolean).join(' · ')}</small>
                          ) : null}
                          <b>{p.name}</b>
                          {p.domains.length ? <em>{p.domains.slice(0, 2).join(' · ')}</em> : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {count > 1 ? (
                <div className={styles.talentNav}>
                  <button
                    type="button"
                    className={styles.talentRound}
                    aria-label="Nhân tài trước"
                    onClick={() => go(-1)}
                  >
                    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true">
                      <path
                        d="M13.5 6h-12M6.5 1l-5 5 5 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={styles.talentRound}
                    aria-label="Nhân tài tiếp theo"
                    onClick={() => go(1)}
                  >
                    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true">
                      <path
                        d="M0.5 6h12M7.5 1l5 5-5 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </button>
                  <span
                    className={styles.talentProgress}
                    role="progressbar"
                    aria-label="Vị trí"
                    aria-valuemin={1}
                    aria-valuemax={count}
                    aria-valuenow={at + 1}
                  >
                    <span style={{ width: `${((at + 1) / count) * 100}%` }} />
                  </span>
                  {reduced ? null : (
                    <button
                      type="button"
                      className={styles.talentPause}
                      aria-label={paused ? 'Tiếp tục tự chuyển' : 'Tạm dừng tự chuyển'}
                      aria-pressed={paused}
                      onClick={() => setPaused((v) => !v)}
                    >
                      {paused ? (
                        <svg viewBox="0 0 10 12" width="10" height="12" aria-hidden="true">
                          <path d="M1 1l8 5-8 5z" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 10 12" width="10" height="12" aria-hidden="true">
                          <path d="M1 1h3v10H1zM6 1h3v10H6z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
