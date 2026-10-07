import Image from 'next/image'

import type { HomeStartup } from '@/lib/public/home-data'
import { PUBLIC_ROUTES } from '@/lib/public/routes'
import type { PublicShellData } from '@/lib/public/shell-data'

import { ArrowRight, PublicAction } from '@/components/public-shell/public-action'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'

import {
  HOME_SEARCH_SUGGESTIONS,
  HOME_TICKER,
  NEWS,
  PROGRAMME_CARDS,
  PROGRAMME_FILTERS,
  PROGRAMME_UPDATES,
} from './home-content'
import { HeroSlider } from './hero-slider'
import { InvestorCarousel, ProductGrid, SectorList } from './home-products'
import { HomeSearch } from './home-search'
import styles from './home.module.css'

/**
 * DEMO-HOME-ABOUT-01 — Homepage v2, a full rebuild against the PO frame DM01
 * (design-reference/final/demo-0710, docs/demo-0710). `/` stays public for
 * every visitor with the visitor's own entry (DEC-H1-D1).
 *
 * Live: the product blocks (canonical published startups, the demo fixture
 * adds pitch, round and headline numbers, DEMO STATE ONLY) and the entry.
 * Read-only presentation: the ticker, programme updates, programme cards and
 * news (no public programme or news source in P0). Every call to action is a
 * real destination or visual-only (PublicAction).
 */
export function Home({ shell, startups }: { shell: PublicShellData; startups: HomeStartup[] }) {
  const { viewer } = shell
  return (
    <div
      className={styles.page}
      data-screen="P0-LANDING"
      data-revision="DM01"
      data-entry={viewer.kind}
    >
      <section className={styles.hero} data-section="hero">
        <PublicHeader viewer={viewer} current="home" />
        {/* HOMEPAGE-HERO-SLIDER-01: the six approved stills replace the video
            placeholder (video cancelled); the search cluster follows the frame. */}
        <HeroSlider />
        <h1 className={styles.srOnly}>
          HUB Network — chương trình, sản phẩm và nhân tài đổi mới sáng tạo
        </h1>
        <div className={styles.heroSearch}>
          <HomeSearch suggestions={HOME_SEARCH_SUGGESTIONS} />
          <div className={styles.intents}>
            <PublicAction
              href={null}
              className={`${styles.intent} ${styles.intentCoral}`}
              cta="organise"
            >
              Tổ chức chương trình <ArrowRight />
            </PublicAction>
            <PublicAction href={null} className={styles.intent} cta="fundraise">
              Gọi vốn <ArrowRight />
            </PublicAction>
            <PublicAction href={viewer.entry} className={styles.intent} cta="primary">
              Tham gia cộng đồng HUB Network <ArrowRight />
            </PublicAction>
          </div>
        </div>
      </section>

      <div className={styles.ticker} aria-label="Chương trình tiêu biểu" data-section="ticker">
        <div className={styles.tickerTrack}>
          {[0, 1].map((copy) => (
            <p key={copy} className={styles.tickerRow} aria-hidden={copy === 1 ? true : undefined}>
              {HOME_TICKER.map((name) => (
                // The refreshed programme names are data, not the frame's sample (DEMO-D8).
                <span key={name} className={styles.tickerItem} data-pixel="data">
                  {name}
                  <svg
                    className={styles.star}
                    viewBox="0 0 20 20"
                    width="20"
                    height="20"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 0C10.9 5.6 14.4 9.1 20 10C14.4 10.9 10.9 14.4 10 20C9.1 14.4 5.6 10.9 0 10C5.6 9.1 9.1 5.6 10 0Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>

      <section className={styles.highlights} data-section="highlights" aria-labelledby="home-week">
        <h2 id="home-week" className={styles.weekTitle}>
          Nổi bật tuần này
        </h2>
        <div className={styles.feeds}>
          <div className={styles.feed} data-block="programme-updates">
            <div className={styles.feedHead}>
              <h3>Cập nhật chương trình</h3>
              <PublicAction href={PUBLIC_ROUTES.programmes} className={styles.feedAll}>
                Xem tất cả
              </PublicAction>
            </div>
            <ul className={styles.feedList} role="list">
              {PROGRAMME_UPDATES.map((u) => (
                <li key={u.title} className={styles.feedRow}>
                  <span className={styles.feedMark} aria-hidden="true">
                    {u.code}
                  </span>
                  <div className={styles.feedText}>
                    <p className={styles.feedTitle}>{u.title}</p>
                    <p className={styles.feedMeta}>{u.meta}</p>
                  </div>
                  <span className={`${styles.tag} ${styles[`tag_${u.tone}`]}`}>{u.tag}</span>
                </li>
              ))}
            </ul>
          </div>
          <SectorList startups={startups} />
        </div>
      </section>

      <section
        className={styles.programmes}
        data-section="programmes"
        aria-labelledby="home-programmes"
      >
        <div className={styles.programmesHead}>
          <h2 id="home-programmes" className={styles.programmesTitle}>
            Chương trình đổi mới sáng tạo
          </h2>
          <div className={styles.programmeFilters}>
            {/* PUBLIC-CONTENT-PUBLISH-01: no phase is highlighted; the cards carry
                the sheet's own status ("Sắp công bố"), not a derived phase. */}
            {PROGRAMME_FILTERS.map((f) => (
              <span key={f} className={styles.darkChip} aria-disabled="true">
                {f}
              </span>
            ))}
          </div>
          <PublicAction
            href={PUBLIC_ROUTES.programmes}
            className={styles.coralCta}
            cta="all-programmes"
          >
            Xem tất cả chương trình <ArrowRight />
          </PublicAction>
        </div>
        <ul className={styles.programmeCards} role="list">
          {PROGRAMME_CARDS.map((p) => (
            <li key={p.title} className={styles.programmeCard} data-programme={p.code}>
              <div
                className={`${styles.programmeArt} ${styles[`art_${p.tone}`]} ${p.image ? styles.artImage : ''}`}
                data-pixel="data"
              >
                {p.image ? (
                  <Image
                    src={p.image.src}
                    alt={p.image.alt}
                    fill
                    sizes="(max-width: 720px) 90vw, (max-width: 1180px) 45vw, 320px"
                  />
                ) : null}
                <div className={styles.programmeChips}>
                  <span className={styles.whiteChip}>{p.kind}</span>
                  <span className={p.statusTone === 'coral' ? styles.coralChip : styles.softChip}>
                    {p.status}
                  </span>
                </div>
                {p.image ? null : (
                  <span className={styles.programmeLogo} aria-hidden="true">
                    {p.code}
                  </span>
                )}
              </div>
              <h3 className={styles.programmeName} data-pixel="data">
                {p.title}
              </h3>
              <p className={styles.programmeText} data-pixel="data">
                {p.description}
              </p>
              <dl className={styles.programmeMeta} data-pixel="data">
                {(
                  [
                    ['THỜI GIAN', p.period, ''],
                    ['GIẢI THƯỞNG', p.prize, styles.prize],
                    ['CHỦ QUẢN', p.owner, ''],
                    ['QUY MÔ', p.scale, ''],
                  ] as const
                )
                  // A field the source leaves empty is not drawn.
                  .filter(([, value]) => value)
                  .map(([label, value, className]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className={className || undefined}>{value}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.ventures}>
        <InvestorCarousel startups={startups} total={startups.length} />
        <ProductGrid startups={startups} />
      </div>

      <section className={styles.news} data-section="news" aria-labelledby="home-news">
        <p className={styles.eyebrow}>TIN TỨC</p>
        <div className={styles.newsHead}>
          <h2 id="home-news" className={styles.newsTitle}>
            Cập nhật về hệ sinh thái
            <br />
            đổi mới sáng tạo Việt Nam
          </h2>
          <PublicAction href={PUBLIC_ROUTES.news} className={styles.newsAll}>
            Xem tất cả tin tức <ArrowRight />
          </PublicAction>
        </div>
        <ul className={styles.newsCards} role="list">
          {NEWS.map((n) => (
            <li key={n.title} className={styles.newsCard}>
              <div
                className={`${styles.newsArt} ${styles[`news_${n.tone}`]} ${n.image ? styles.artImage : ''}`}
                aria-hidden="true"
              >
                {n.image ? (
                  <Image
                    src={n.image.src}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 90vw, (max-width: 1180px) 45vw, 420px"
                  />
                ) : null}
              </div>
              <span className={styles.newsTag}>{n.tag}</span>
              <h3 className={styles.newsName}>{n.title}</h3>
              <p className={styles.newsDate}>{n.date}</p>
            </li>
          ))}
        </ul>
      </section>

      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
