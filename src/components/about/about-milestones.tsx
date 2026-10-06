'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import type { Milestone } from './about-data'
import styles from './about.module.css'

/**
 * DM02 "Dấu ấn phát triển" — a horizontal, draggable timeline by year (Thảo:
 * keep every photo, one card per year with picture, short title and impact).
 * The S1-UAT-08A milestones and photos are reused verbatim. The left panel
 * counts the places present by the selected year (DM02 "8 HUB đã có mặt" for
 * 2024) and marks the places it added. The year rail and a horizontal scroll
 * or drag both move the selection. DM02 shows 2024 selected.
 */

const DEFAULT_YEAR_INDEX = 2

export function AboutMilestones({
  milestones,
  places,
}: {
  milestones: Milestone[]
  places: Array<{ place: string; year: string }>
}) {
  const [at, setAt] = useState(Math.min(DEFAULT_YEAR_INDEX, milestones.length - 1))
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const current = milestones[at]!
  const order = (y: string) => milestones.findIndex((m) => m.year === y)
  const present = places.filter((p) => order(p.year) <= order(current.year))
  const added = new Set(current.places)

  const ready = useRef(false)
  /** A card's scroll position inside the track. */
  const offsetOf = (el: HTMLElement, card: HTMLElement) =>
    card.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft
  useEffect(() => {
    const el = track.current
    const card = el?.children[at] as HTMLElement | undefined
    if (!el || !card) return
    const left = offsetOf(el, card)
    if (!ready.current) {
      // The first position is instant, and scroll events before it are not a choice.
      el.scrollLeft = left
      window.requestAnimationFrame(() => {
        ready.current = true
      })
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' })
  }, [at])

  // A resize (rotation, a full-page capture) keeps the selected card in place.
  useEffect(() => {
    const keep = () => {
      const el = track.current
      const card = el?.children[at] as HTMLElement | undefined
      if (el && card) el.scrollLeft = offsetOf(el, card)
    }
    window.addEventListener('resize', keep)
    return () => window.removeEventListener('resize', keep)
  }, [at])

  function onScroll() {
    const el = track.current
    if (!el || drag.current || !ready.current) return
    const cards = [...el.children] as HTMLElement[]
    const gaps = cards.map((c) => Math.abs(offsetOf(el, c) - el.scrollLeft))
    const best = gaps.indexOf(Math.min(...gaps))
    if (best !== at && gaps[best]! < 40) setAt(best)
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineSide}>
        <p className={styles.timelineYear}>{current.when}</p>
        <p className={styles.timelineCount}>{present.length}</p>
        <p className={styles.timelineCountLabel}>HUB đã có mặt</p>
        <ul className={styles.placeChips} role="list">
          {places.map((p) => {
            const state = added.has(p.place)
              ? styles.placeNew
              : order(p.year) <= order(current.year)
                ? styles.placeOld
                : styles.placeLater
            return (
              <li key={p.place} className={`${styles.placeChip} ${state}`}>
                {p.place}
              </li>
            )
          })}
        </ul>
        <div className={styles.timelineProgress} aria-hidden="true">
          <span style={{ width: `${((at + 1) / milestones.length) * 100}%` }} />
        </div>
      </div>
      <div className={styles.timelineMain}>
        <div
          ref={track}
          className={styles.timelineTrack}
          onScroll={onScroll}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse') return
            drag.current = { x: e.clientX, left: track.current?.scrollLeft ?? 0 }
          }}
          onPointerMove={(e) => {
            if (!drag.current || !track.current) return
            track.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
          }}
          onPointerUp={() => {
            drag.current = null
            onScroll()
          }}
          onPointerLeave={() => {
            drag.current = null
          }}
        >
          {milestones.map((m, i) => (
            <article
              key={m.when}
              className={`${styles.milestone} ${i === at ? styles.milestoneOn : ''}`}
              data-milestone={m.when}
            >
              <div className={`${styles.milestoneArt} ${styles[`tone_${m.tone}`]}`}>
                {m.photo ? (
                  <Image
                    src={m.photo.src}
                    alt={m.photo.alt}
                    fill
                    sizes="440px"
                    draggable={false}
                    style={{ objectFit: 'cover' }}
                  />
                ) : null}
              </div>
              <p className={styles.milestoneYear}>{m.when}</p>
              {m.badge ? <p className={styles.milestoneBadge}>{m.badge}</p> : null}
              <p className={styles.milestoneText}>{m.title}</p>
              {m.items ? (
                <ul className={styles.milestoneItems} role="list">
                  {m.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              ) : null}
              {m.places.length ? (
                <ul className={styles.milestonePlaces} role="list">
                  {m.places.map((p) => (
                    <li key={p}>+ {p}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
        <div className={styles.yearRail} role="tablist" aria-label="Năm">
          {milestones.map((m, i) => (
            <button
              key={m.when}
              type="button"
              role="tab"
              aria-selected={i === at}
              className={`${styles.yearBtn} ${i === at ? styles.yearBtnOn : ''}`}
              onClick={() => setAt(i)}
            >
              {m.when}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
