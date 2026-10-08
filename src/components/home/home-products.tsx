'use client'

import { useMemo, useState, type CSSProperties } from 'react'

import type { HomeStartup } from '@/lib/public/home-data'
import { HIGHLIGHT_PRODUCT_SLUG } from '@/lib/public/product-detail'
import { PUBLIC_ROUTES } from '@/lib/public/routes'

import { ArrowRight, PublicAction } from '@/components/public-shell/public-action'

import { HIGHLIGHT_PRODUCT_LOGOS } from './home-content'
import styles from './home.module.css'

/**
 * DM01 live product blocks. The domain chips are the canonical domains of the
 * listed startups (not the drawn sample sectors) and filter in place; counts
 * are live. A product links to its page once the product directory ships.
 */

function domainsOf(startups: HomeStartup[]): string[] {
  return [...new Set(startups.flatMap((s) => s.domains))].sort((x, y) => x.localeCompare(y, 'vi'))
}

/** Drawn order: a startup with a status chip first, then by name. */
function featured(startups: HomeStartup[]): HomeStartup[] {
  return [...startups].sort(
    (x, y) => Number(!x.badge) - Number(!y.badge) || x.name.localeCompare(y.name, 'vi'),
  )
}

function Mark({
  startup,
  className,
  text = startup.mark,
}: {
  startup: HomeStartup
  className?: string
  text?: string
}) {
  // The startup's public logo when it has one; its initials otherwise.
  if (startup.logo)
    return (
      <span className={`${className ?? ''} ${styles.markImage}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- public logo of the media route */}
        <img src={startup.logo} alt="" data-logo="" />
      </span>
    )
  return (
    <span className={className} aria-hidden="true">
      {text}
    </span>
  )
}

/** S2-HOME-HIGHLIGHTS-ASSETS-01: the highlight mark when the startup has no public logo. */
function withHighlightLogo(s: HomeStartup): HomeStartup {
  const logo = s.slug ? HIGHLIGHT_PRODUCT_LOGOS[s.slug] : undefined
  return s.logo || !logo ? s : { ...s, logo }
}

/** "Sản phẩm theo ngành": one sector at a time, three rows. */
export function SectorList({ startups }: { startups: HomeStartup[] }) {
  const sectors = useMemo(() => domainsOf(startups), [startups])
  const [sector, setSector] = useState(sectors[0] ?? null)
  const rows = featured(startups)
    .filter((s) => !sector || s.domains.includes(sector))
    .slice(0, 3)
  return (
    <div className={styles.feed} data-block="sectors">
      <div className={styles.feedHead}>
        <h3>Sản phẩm theo ngành</h3>
        <PublicAction href={PUBLIC_ROUTES.products} className={styles.feedAll}>
          Xem tất cả
        </PublicAction>
      </div>
      {sectors.length ? (
        <div className={styles.sectorChips} role="tablist" aria-label="Ngành">
          {sectors.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={sector === d}
              className={`${styles.sectorChip} ${sector === d ? styles.sectorOn : ''}`}
              onClick={() => setSector(d)}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}
      <ul className={styles.feedList} role="list">
        {rows.map((s) => (
          <li key={s.key} className={styles.feedRow}>
            <Mark startup={withHighlightLogo(s)} className={styles.feedMark} />
            <div className={styles.feedText}>
              {/* A product without an approved detail is plain text (no link, no hint). */}
              {s.href ? (
                <PublicAction href={s.href} className={styles.feedTitle}>
                  {s.name}
                </PublicAction>
              ) : (
                <span className={styles.feedTitle}>{s.name}</span>
              )}
              <p className={styles.feedMeta}>{[s.short, s.round].filter(Boolean).join(' · ')}</p>
            </div>
            {s.badge ? (
              <span
                className={`${styles.tag} ${s.badge === 'GỌI VỐN' ? styles.tagGreen : styles.tagRed}`}
              >
                {s.badge}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className={styles.empty}>Chưa có sản phẩm công khai.</p> : null}
    </div>
  )
}

/**
 * "Startup sẵn sàng gặp nhà đầu tư": one card at a time, the next one peeking
 * at the right edge (THAO-03-V2). With a single fundraising startup there is
 * no next pitch to show, and none is invented: the glimpse is the product
 * directory (a real route), so the row still reads as a carousel.
 */
export function InvestorCarousel({ startups, total }: { startups: HomeStartup[]; total: number }) {
  // S2-PRODUCT-CATALOG-CLEANUP-01: the highlighted product (Smart Campus) first,
  // then the demo pitch(es), then the refreshed homepage list in its order.
  const lead = startups.filter((s) => s.slug === HIGHLIGHT_PRODUCT_SLUG)
  const ready = [
    ...lead,
    ...startups.filter((s) => s.investorReady && !lead.includes(s)),
    ...startups
      .filter((s) => !s.investorReady && s.featured !== null && !lead.includes(s))
      .sort((a, b) => a.featured! - b.featured!),
  ]
  const [at, setAt] = useState(0)
  const count = ready.length
  const go = (d: number) => setAt((i) => (count ? (i + d + count) % count : 0))
  return (
    <section className={styles.investors} data-section="investors" aria-labelledby="home-investors">
      <div className={styles.investorsSide}>
        <h2 id="home-investors" className={styles.investorsTitle}>
          Startup sẵn sàng
          <br />
          gặp nhà đầu tư
        </h2>
        <div className={styles.investorsNav}>
          <button
            type="button"
            className={styles.roundBtn}
            aria-label="Startup trước"
            onClick={() => go(-1)}
            disabled={count < 2}
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
            className={styles.roundBtn}
            aria-label="Startup tiếp theo"
            onClick={() => go(1)}
            disabled={count < 2}
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
        </div>
      </div>
      <div className={styles.investorsTrack}>
        {count === 0 ? (
          <p className={styles.empty}>Chưa có startup công khai đang gọi vốn.</p>
        ) : (
          [0, 1].slice(0, Math.min(count, 2)).map((offset) => {
            const s = ready[(at + offset) % count]!
            return (
              <article
                key={`${s.key}-${offset}`}
                className={offset === 0 ? styles.pitch : styles.pitchPeek}
                aria-hidden={offset === 0 ? undefined : true}
              >
                <div className={styles.pitchArt}>
                  {s.logo ? (
                    <span className={styles.pitchLogo} aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element -- public logo of the media route */}
                      <img src={s.logo} alt="" data-logo="" />
                    </span>
                  ) : null}
                  <span>{s.name}</span>
                </div>
                {offset === 0 ? (
                  <div className={styles.pitchBody}>
                    <div className={styles.pitchTags}>
                      {s.domains.slice(0, 1).map((d) => (
                        <span key={d} className={styles.pill}>
                          {d.toLocaleUpperCase('vi')}
                        </span>
                      ))}
                      {s.round ? (
                        <span className={`${styles.pill} ${styles.pillRed}`}>
                          {s.round.toLocaleUpperCase('vi')}
                        </span>
                      ) : null}
                      {/* Only a startup recorded as fundraising carries the chip. */}
                      {s.badge === 'GỌI VỐN' ? (
                        <span className={`${styles.pill} ${styles.pillGreen}`}>ĐANG GỌI VỐN</span>
                      ) : null}
                    </div>
                    <h3 className={styles.pitchName}>{s.name}</h3>
                    <p className={styles.pitchText}>{s.summary}</p>
                    {s.href ? (
                      <PublicAction href={s.href} className={styles.pitchLink}>
                        Xem sản phẩm <ArrowRight />
                      </PublicAction>
                    ) : null}
                    {s.headline.length ? (
                      <dl className={styles.pitchStats}>
                        {s.headline.map((h) => (
                          <div key={h.label}>
                            <dt>{h.value}</dt>
                            <dd>{h.label}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })
        )}
        {count === 1 ? (
          <PublicAction
            href={PUBLIC_ROUTES.products}
            className={`${styles.pitchPeek} ${styles.pitchMore}`}
            cta="investors-more"
            label={`Xem tất cả ${total} sản phẩm`}
          >
            <span className={styles.pitchArt}>
              <span>Tất cả sản phẩm</span>
            </span>
          </PublicAction>
        ) : null}
      </div>
    </section>
  )
}

/** "Tất cả sản phẩm trong mạng lưới": live count, domain filter, tiles. */
export function ProductGrid({ startups }: { startups: HomeStartup[] }) {
  const domains = useMemo(() => domainsOf(startups), [startups])
  const [domain, setDomain] = useState<string | null>(null)
  const tiles = featured(startups).filter((s) => !domain || s.domains.includes(domain))
  return (
    <section className={styles.catalogue} data-section="all-products" aria-labelledby="home-all">
      <div className={styles.catalogueHead}>
        <h2 id="home-all" className={styles.catalogueTitle}>
          Tất cả sản phẩm trong mạng lưới <span className={styles.count}>{startups.length}</span>
        </h2>
        <div className={styles.catalogueChips} role="tablist" aria-label="Lĩnh vực">
          {[null, ...domains].map((d) => (
            <button
              key={d ?? 'all'}
              type="button"
              role="tab"
              aria-selected={domain === d}
              className={`${styles.lineChip} ${domain === d ? styles.lineChipOn : ''}`}
              onClick={() => setDomain(d)}
            >
              {d ?? 'Tất cả'}
            </button>
          ))}
        </div>
        <PublicAction href={PUBLIC_ROUTES.products} className={styles.darkCta} cta="all-products">
          Xem tất cả sản phẩm <ArrowRight />
        </PublicAction>
      </div>
      <ul
        className={styles.tiles}
        role="list"
        // THAO-03-V2: at least four 300 px columns, so a short list spans the
        // section like the frame instead of leaving its right half empty; a long
        // one flows into two rows that scroll sideways.
        style={{ '--cols': Math.max(4, Math.ceil(tiles.length / 2)) } as CSSProperties}
      >
        {tiles.map((s) => (
          <li key={s.key} className={styles.tile}>
            <Mark startup={s} className={styles.tileMark} text={s.tile} />
            <div>
              {s.href ? (
                <PublicAction href={s.href} className={styles.tileName}>
                  {s.name}
                </PublicAction>
              ) : (
                <span className={styles.tileName}>{s.name}</span>
              )}
              <p className={styles.tileMeta}>
                {[s.domains[0], s.round ?? s.stage].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
