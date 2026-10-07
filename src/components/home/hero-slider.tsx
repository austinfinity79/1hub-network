'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

import styles from './home.module.css'

/**
 * HOMEPAGE-HERO-SLIDER-01 — the homepage hero: the PO's six still artworks
 * (hero-still-01 … 06.png, 1920 × 1080, unmodified in public/home/hero), each a
 * complete composition shown whole in one 16:9 frame. No text is rebuilt or
 * laid over them. 01 → 06 → 01, one slide every 10 s; previous / next change
 * at once and restart the 10 s. A single timeout per shown slide: it is
 * replaced on every change and cleared on unmount, so timers never pile up.
 */

export const HERO_INTERVAL_MS = 10_000

/** Alt text: the slide number and the label printed on the artwork itself. */
export const HERO_SLIDES = [
  { src: '/home/hero/hero-still-01.png', label: 'Dành cho đơn vị tổ chức' },
  { src: '/home/hero/hero-still-02.png', label: 'Dành cho startup và nhân tài' },
  { src: '/home/hero/hero-still-03.png', label: 'Kết nối' },
  { src: '/home/hero/hero-still-04.png', label: 'Nguồn lực' },
  { src: '/home/hero/hero-still-05.png', label: 'Ba lớp kết nối trong hệ sinh thái' },
  { src: '/home/hero/hero-still-06.png', label: 'Mạng lưới HUB Network' },
] as const

const pad = (n: number) => String(n).padStart(2, '0')

export function HeroSlider() {
  const [index, setIndex] = useState(0)
  const count = HERO_SLIDES.length

  // One timer for the slide on screen; any change (auto or manual) replaces it.
  useEffect(() => {
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), HERO_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [index, count])

  const go = (step: number) => setIndex((i) => (i + step + count) % count)

  return (
    <div
      className={styles.heroSlider}
      role="region"
      aria-roledescription="carousel"
      aria-label="HUB Network"
      data-section="hero-slider"
    >
      {/* The stage: a bounded 16:9 frame sized by the space the hero leaves
          (not by the PNG), and the counter row under it. */}
      <div className={styles.heroStage}>
        <div className={styles.heroFrame}>
          {HERO_SLIDES.map((s, i) => (
            <div
              key={s.src}
              className={`${styles.heroSlide} ${i === index ? styles.heroSlideOn : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${pad(i + 1)} / ${pad(count)}`}
              aria-hidden={i === index ? undefined : true}
              data-slide={pad(i + 1)}
              data-active={i === index ? 'true' : undefined}
            >
              <Image
                src={s.src}
                alt={`Slide ${i + 1}/${count}: ${s.label}`}
                fill
                sizes="(max-width: 1023px) 100vw, 1100px"
                quality={90}
                priority={i === 0}
              />
            </div>
          ))}
        </div>
        <div className={styles.heroMeta}>
          {/* Desktop: the arrows sit on the hero's sides, around the frame;
              narrow screens: in this row. */}
          <button
            type="button"
            className={`${styles.heroArrow} ${styles.heroPrev}`}
            aria-label="Previous slide"
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
          <p className={styles.heroCount} data-hero-indicator="">
            <b>{pad(index + 1)}</b> / {pad(count)}
          </p>
          <span className={styles.heroBars} aria-hidden="true">
            {HERO_SLIDES.map((s, i) => (
              <span key={s.src} className={i === index ? styles.heroBarOn : undefined} />
            ))}
          </span>
          <button
            type="button"
            className={`${styles.heroArrow} ${styles.heroNext}`}
            aria-label="Next slide"
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
        </div>
      </div>
    </div>
  )
}
