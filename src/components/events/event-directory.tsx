'use client'

import { useState } from 'react'

import {
  PAST_EVENTS,
  UPCOMING_EVENTS,
  type PastEvent,
  type UpcomingEvent,
} from '@/lib/public/programme-event-source'

import styles from './events.module.css'

/**
 * S2-PROGRAMME-EVENT-CONTENT-01 — DM07 "Sự kiện" with the sheet's rows only.
 * The first upcoming row is the featured block (the sheet's "Thông tin khác"
 * belongs to it alone); the others group by the month their day/month names;
 * past events follow, newest first. A field the sheet leaves empty is not
 * drawn, and no registration / calendar action exists (no link in source).
 *
 * S2-EVENT-REDESIGN-01: presentation only (PO reference DIR2.2 "Sự kiện");
 * the segmented bar jumps to the two existing sections (no new filter).
 */

const PAST_PAGE = 9

/** "29/10" → day "29", month "10" (the source gives no year). */
function dayMonth(date: string): { day: string; month: string } | null {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(date.trim())
  return m ? { day: m[1]!.padStart(2, '0'), month: String(Number(m[2])) } : null
}

/** "17/50 người đã đăng ký" → its two numbers, for the bar; else null. */
function filled(info: string | null): number | null {
  const m = info ? /^(\d+)\s*\/\s*(\d+)/.exec(info) : null
  if (!m) return null
  const [a, b] = [Number(m[1]), Number(m[2])]
  return b > 0 && a <= b ? a / b : null
}

const join = (parts: Array<string | null>) => parts.filter(Boolean).join(' · ')

function DateBadge({ date, large = false }: { date: string; large?: boolean }) {
  const dm = dayMonth(date)
  if (!dm) return null
  return (
    <span className={large ? styles.badgeLarge : styles.badge} data-event-date={date}>
      <b>{dm.day}</b>
      <small>THG {dm.month}</small>
    </span>
  )
}

function Cover({ src, className }: { src: string | null; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- static approved picture
    <img className={className} src={src} alt="" loading="lazy" data-event-cover="" />
  ) : null
}

function Featured({ event }: { event: UpcomingEvent }) {
  const share = filled(event.info)
  return (
    <article className={styles.featured} data-event={event.slug} data-block="featured">
      <div className={styles.featuredArt}>
        <Cover src={event.image} className={styles.featuredImg} />
        <span className={styles.flag}>
          {join(['NỔI BẬT', event.hubRole?.toLocaleUpperCase('vi') ?? null])}
        </span>
      </div>
      <div className={styles.featuredBody}>
        <div className={styles.when}>
          <DateBadge date={event.date} large />
          <p>
            {event.time ? <b>{event.time}</b> : null}
            {event.venue ? <span>{event.venue}</span> : null}
          </p>
        </div>
        <h2 className={styles.featuredName}>{event.name}</h2>
        {event.organizer ? <p className={styles.featuredMeta}>{event.organizer}</p> : null}
        {event.info ? (
          <div className={styles.fill}>
            <p>
              <span>{event.info}</span>
              {event.status ? <em className={styles.statusTag}>{event.status}</em> : null}
            </p>
            {share !== null ? (
              <span className={styles.track} aria-hidden="true">
                <span style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
            ) : null}
          </div>
        ) : event.status ? (
          <p className={styles.state}>{join([event.status, event.seats])}</p>
        ) : null}
      </div>
    </article>
  )
}

function UpcomingCard({ event }: { event: UpcomingEvent }) {
  return (
    <li className={styles.card} data-event={event.slug}>
      <div className={styles.cardArt}>
        <Cover src={event.image} className={styles.cardImg} />
        <DateBadge date={event.date} />
      </div>
      <div className={styles.cardBody}>
        {event.hubRole ? <p className={styles.kicker}>{event.hubRole}</p> : null}
        <h3 className={styles.cardName}>{event.name}</h3>
        <p className={styles.cardMeta}>{join([event.organizer, event.time])}</p>
        {event.venue ? <p className={styles.cardPlace}>{event.venue}</p> : null}
        <p className={styles.cardFoot}>
          {event.seats ? <em>{event.seats}</em> : null}
          {event.status ? <span className={styles.statusTag}>{event.status}</span> : null}
        </p>
      </div>
    </li>
  )
}

function PastCard({ event }: { event: PastEvent }) {
  return (
    <li className={styles.past} data-event={event.slug}>
      <Cover src={event.image} className={styles.pastImg} />
      <div>
        <h3 className={styles.pastName}>{event.name}</h3>
        <p className={styles.cardMeta}>{join([event.organizer, event.date])}</p>
        {event.venue ? <p className={styles.pastPlace}>{event.venue}</p> : null}
      </div>
    </li>
  )
}

export function EventDirectory() {
  const [featured, ...rest] = UPCOMING_EVENTS
  const months = new Map<string, UpcomingEvent[]>()
  for (const e of rest) {
    const key = dayMonth(e.date)?.month ?? ''
    months.set(key, [...(months.get(key) ?? []), e])
  }
  const past = [...PAST_EVENTS].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? '') || 0)
  const [shown, setShown] = useState(PAST_PAGE)
  return (
    <main className={styles.main} data-section="events">
      <header className={styles.head}>
        <h1 className={styles.title}>Sự kiện</h1>
      </header>

      {featured ? <Featured event={featured} /> : null}

      <nav className={styles.segments} aria-label="Phần sự kiện">
        <a href="#ev-upcoming" className={styles.segmentOn} data-cta="events-upcoming">
          Sắp diễn ra · {UPCOMING_EVENTS.length}
        </a>
        <a href="#ev-past" className={styles.segment} data-cta="events-past">
          Đã diễn ra · {past.length}
        </a>
      </nav>

      <section aria-labelledby="ev-upcoming" data-block="upcoming">
        <h2 id="ev-upcoming" className={styles.srOnly}>
          Sắp diễn ra
        </h2>
        {[...months].map(([month, list]) => (
          <div key={month} className={styles.month}>
            {month ? <p className={styles.monthLabel}>THÁNG {month}</p> : null}
            <ul className={styles.grid} role="list">
              {list.map((e) => (
                <UpcomingCard key={e.slug} event={e} />
              ))}
            </ul>
          </div>
        ))}
        {UPCOMING_EVENTS.length === 0 ? (
          <p className={styles.empty}>Chưa có sự kiện sắp tới.</p>
        ) : null}
      </section>

      <section className={styles.recent} aria-labelledby="ev-past" data-block="past">
        <p className={styles.kicker}>ĐÃ DIỄN RA</p>
        <h2 id="ev-past" className={styles.recentTitle}>
          Các buổi sự kiện đã tổ chức <span>{past.length}</span>
        </h2>
        <ul className={styles.pastGrid} role="list">
          {past.slice(0, shown).map((e) => (
            <PastCard key={e.slug} event={e} />
          ))}
        </ul>
        {past.length > shown ? (
          <button
            type="button"
            className={styles.more}
            onClick={() => setShown((n) => n + PAST_PAGE)}
          >
            Xem thêm {past.length - shown} sự kiện
          </button>
        ) : null}
      </section>
    </main>
  )
}
