'use client'

import Link from 'next/link'

import { PUBLIC_ROUTES } from '@/lib/public/routes'

import styles from './about.module.css'

/**
 * S2-ABOUT-HUB-CAROUSEL-01 — "Dải HUB Khu vực" (Figma 880:4401): two rows of
 * the PO's pictures (about-carousel-hub-images.zip, manifest.json, sha256
 * 23e54fd0…), running in opposite directions and stopping under the pointer
 * or keyboard focus; still and scrollable under reduced motion.
 * - Row 1, to the left: the eight HUB covers (manifest labels / alts); a card
 *   opens the existing HUB popup of the map (ABT1.09).
 * - Row 2, to the right: the six community-activity pictures; a card opens
 *   /events (EV1). No per-event mapping exists, none is made.
 * WebP first, the supplied JPG as fallback (<picture>).
 */

type Cover = {
  file: string
  label: string
  alt: string
  slug: string
  width: number
  height: number
}
type Activity = { file: string; alt: string; width: number; height: number }

/** Manifest "hang_1_hub", in order; `slug` is the HUB the label names. */
export const HUB_COVERS: readonly Cover[] = [
  {
    file: '01-ha-noi',
    label: 'Hà Nội',
    alt: 'Ảnh bìa HUB Hà Nội',
    slug: 'hub-network-ha-noi',
    width: 760,
    height: 304,
  },
  {
    file: '02-tp-ho-chi-minh',
    label: 'TP. Hồ Chí Minh',
    alt: 'Ảnh bìa HUB TP. Hồ Chí Minh',
    slug: 'hub-network-ho-chi-minh',
    width: 760,
    height: 304,
  },
  {
    file: '03-da-nang',
    label: 'Đà Nẵng',
    alt: 'Ảnh bìa HUB Đà Nẵng',
    slug: 'hub-network-da-nang',
    width: 760,
    height: 304,
  },
  {
    file: '04-singapore',
    label: 'Singapore',
    alt: 'Ảnh bìa HUB Singapore',
    slug: 'hub-network-singapore',
    width: 760,
    height: 304,
  },
  {
    file: '05-trung-quoc',
    label: 'Trung Quốc',
    alt: 'Ảnh bìa HUB Trung Quốc',
    slug: 'hub-network-trung-quoc-china',
    width: 760,
    height: 304,
  },
  {
    file: '06-uc',
    label: 'Úc',
    alt: 'Ảnh bìa HUB Úc',
    slug: 'hub-network-uc-australia',
    width: 760,
    height: 304,
  },
  {
    file: '07-vuong-quoc-anh',
    label: 'Vương quốc Anh',
    alt: 'Ảnh bìa HUB Vương quốc Anh',
    slug: 'hub-network-vuong-quoc-anh-uk',
    width: 760,
    height: 304,
  },
  {
    file: '08-hoa-ky',
    label: 'Hoa Kỳ',
    alt: 'Ảnh bìa HUB Hoa Kỳ',
    slug: 'hub-network-hoa-ky-usa',
    width: 760,
    height: 304,
  },
]

/** Manifest "hang_2_hoat_dong", in order. */
export const ACTIVITY_PICTURES: readonly Activity[] = [
  { file: '01-hoat-dong', alt: 'Hoạt động của cộng đồng HUB Network', width: 620, height: 413 },
  { file: '02-hoat-dong', alt: 'Hoạt động của cộng đồng HUB Network', width: 620, height: 413 },
  { file: '03-hoat-dong', alt: 'Hoạt động của cộng đồng HUB Network', width: 620, height: 413 },
  { file: '04-hoat-dong', alt: 'Hoạt động của cộng đồng HUB Network', width: 620, height: 413 },
  { file: '05-hoat-dong', alt: 'Hoạt động của cộng đồng HUB Network', width: 620, height: 348 },
  { file: '06-hoat-dong', alt: 'Hoạt động của cộng đồng HUB Network', width: 620, height: 348 },
]

export const HUB_CAROUSEL_QUOTE = 'Mỗi HUB được dựng nên bởi những người sáng lập ở địa phương đó.'

function Picture({
  base,
  alt,
  width,
  height,
}: {
  base: string
  alt: string
  width: number
  height: number
}) {
  return (
    <picture>
      <source type="image/webp" srcSet={`${base}.webp`} />
      <img
        src={`${base}.jpg`}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}

export function AboutCarousel({
  hubSlugs,
  onOpenHub,
}: {
  /** The HUBs of the map: a cover whose HUB is not there is drawn, not clickable. */
  hubSlugs: readonly string[]
  onOpenHub: (slug: string) => void
}) {
  return (
    <div className={styles.carousel} data-block="hub-carousel">
      <p className={styles.carouselQuote}>{HUB_CAROUSEL_QUOTE}</p>
      <div className={styles.marquee} data-row="hubs" data-direction="left">
        <ul className={`${styles.marqueeTrack} ${styles.toLeft}`} role="list">
          {[0, 1].map((copy) =>
            HUB_COVERS.map((c) => {
              const known = hubSlugs.includes(c.slug)
              const body = (
                <>
                  <Picture
                    base={`/about/carousel/hubs/${c.file}`}
                    alt={copy ? '' : c.alt}
                    width={c.width}
                    height={c.height}
                  />
                  <span className={styles.coverLabel}>{c.label}</span>
                </>
              )
              return (
                <li
                  key={`${copy}-${c.file}`}
                  className={styles.coverItem}
                  aria-hidden={copy ? true : undefined}
                  data-cover={copy ? undefined : c.slug}
                >
                  {known ? (
                    <button
                      type="button"
                      className={styles.coverCard}
                      tabIndex={copy ? -1 : undefined}
                      aria-label={`${c.label} — mở giới thiệu HUB`}
                      onClick={() => onOpenHub(c.slug)}
                    >
                      {body}
                    </button>
                  ) : (
                    <span className={styles.coverCard}>{body}</span>
                  )}
                </li>
              )
            }),
          )}
        </ul>
      </div>
      <div className={styles.marquee} data-row="activities" data-direction="right">
        <ul className={`${styles.marqueeTrack} ${styles.toRight}`} role="list">
          {[0, 1].map((copy) =>
            ACTIVITY_PICTURES.map((a) => (
              <li
                key={`${copy}-${a.file}`}
                className={styles.activityItem}
                aria-hidden={copy ? true : undefined}
                data-activity={copy ? undefined : a.file}
              >
                {PUBLIC_ROUTES.events ? (
                  <Link
                    href={PUBLIC_ROUTES.events}
                    className={styles.activityCard}
                    tabIndex={copy ? -1 : undefined}
                    aria-label={copy ? undefined : `${a.alt} — xem lịch sự kiện`}
                    data-cta={copy ? undefined : 'about-activity'}
                  >
                    <Picture
                      base={`/about/carousel/activities/${a.file}`}
                      alt={copy ? '' : a.alt}
                      width={a.width}
                      height={a.height}
                    />
                  </Link>
                ) : (
                  <span className={styles.activityCard}>
                    <Picture
                      base={`/about/carousel/activities/${a.file}`}
                      alt={copy ? '' : a.alt}
                      width={a.width}
                      height={a.height}
                    />
                  </span>
                )}
              </li>
            )),
          )}
        </ul>
      </div>
    </div>
  )
}
