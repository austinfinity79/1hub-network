'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Arrow, Cta, type Action } from '../landing/landing-parts'

import {
  ACTIVITIES,
  ACTIVITY_FILTERS,
  HUBS,
  HUMANS,
  KIND_LABEL,
  MILESTONES,
  PLACES,
  type ActivityKind,
  type HubCode,
} from './about-data'
import { dust, outward, ring } from './about-geometry'
import { Photo } from './about-parts'
import styles from './about.module.css'

/**
 * Client pieces of /about. Hydration rule: the first client render equals
 * the server render (fixed initial state, no window/Date/random reads during
 * render). Motion is switched on only after mount, through data attributes,
 * and never when the visitor prefers reduced motion.
 */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Reveal-on-scroll for every `[data-reveal]` element of the page. Renders nothing. */
export function AboutMotion() {
  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const root = document.querySelector<HTMLElement>('[data-screen="PUBLIC-ABOUT"]')
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    // Anything already on screen stays visible: only below-the-fold elements animate.
    const fold = window.innerHeight
    for (const el of targets) if (el.getBoundingClientRect().top < fold) el.dataset.in = '1'
    // A clipped-shut element ("open") has no visible area, so an observer on it
    // would never fire: watch its parent instead and reveal the child from there.
    const watched = new Map<Element, HTMLElement[]>()
    for (const el of targets) {
      if (el.dataset.in) continue
      const anchor = el.dataset.reveal === 'open' && el.parentElement ? el.parentElement : el
      watched.set(anchor, [...(watched.get(anchor) ?? []), el])
    }
    root.dataset.motion = 'on'
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          for (const el of watched.get(e.target) ?? []) el.dataset.in = '1'
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    )
    for (const anchor of watched.keys()) io.observe(anchor)
    return () => io.disconnect()
  }, [])
  return null
}

/* ---------------------------------------------------------------- 05 diagram */

const ORG = { x: 350, y: 350 }
const ORG_R = 197
const MARKERS: HubCode[] = ['HN', 'DN', 'THPT']

function panelRegion(region: string): string {
  return region.replace(/^TP\. /, '')
}

export function OrgDiagram() {
  const [active, setActive] = useState<HubCode>('HN')
  const nodes = useMemo(() => ring(ORG.x, ORG.y, ORG_R, HUBS.length), [])
  const specks = useMemo(() => dust(ORG.x, ORG.y, 282, 345, 150, 5), [])
  const hub = HUBS.find((h) => h.code === active) ?? HUBS[0]!

  return (
    <div className={styles.orgStage}>
      <svg
        className={styles.orgSvg}
        viewBox="0 0 700 700"
        data-reveal="draw"
        aria-label="Sơ đồ HUB Tổng và 13 HUB thành viên"
        role="group"
      >
        <g className={styles.orgDust}>
          {specks.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} />
          ))}
        </g>
        <circle cx={ORG.x} cy={ORG.y} r={ORG_R + 70} className={styles.orgOrbit} />
        <circle cx={ORG.x} cy={ORG.y} r={ORG_R} className={styles.orgOrbitInner} />
        {HUBS.map((h, i) => {
          const n = nodes[i]!
          const on = h.code === active
          const fan = [-44, -26, -9, 9, 26, 44].map((deg, k) =>
            outward(ORG, n, 62 + (k % 2) * 10, deg),
          )
          return (
            <g key={h.code} className={on ? styles.orgFanOn : styles.orgFan}>
              {fan.map((p, k) => (
                <g key={k}>
                  <line x1={n.x} y1={n.y} x2={p.x} y2={p.y} className={styles.orgDraw} />
                  <circle cx={p.x} cy={p.y} r={3} />
                </g>
              ))}
            </g>
          )
        })}
        {HUBS.map((h, i) => {
          const n = nodes[i]!
          const on = h.code === active
          return (
            <line
              key={`s${h.code}`}
              x1={ORG.x}
              y1={ORG.y}
              x2={n.x}
              y2={n.y}
              className={`${styles.orgDraw} ${on ? styles.orgSpokeOn : styles.orgSpoke}`}
            />
          )
        })}
        {HUBS.map((h, i) => {
          if (!MARKERS.includes(h.code)) return null
          const n = nodes[i]!
          return (
            <circle
              key={`m${h.code}`}
              cx={ORG.x + (n.x - ORG.x) * 0.56}
              cy={ORG.y + (n.y - ORG.y) * 0.56}
              r={10}
              className={styles.orgMarker}
            />
          )
        })}
        {HUBS.map((h, i) => {
          const n = nodes[i]!
          const lx = ORG.x + (n.x - ORG.x) * 0.8
          const ly = ORG.y + (n.y - ORG.y) * 0.8
          return (
            <text
              key={`t${h.code}`}
              x={lx}
              y={ly + 16}
              className={styles.orgRegion}
              textAnchor="middle"
            >
              {h.region}
            </text>
          )
        })}
        <circle cx={ORG.x} cy={ORG.y} r={63} className={styles.orgCore} />
        <text x={ORG.x} y={ORG.y - 1} className={styles.orgCoreTitle} textAnchor="middle">
          HUB Tổng
        </text>
        <text x={ORG.x} y={ORG.y + 21} className={styles.orgCoreSub} textAnchor="middle">
          HUB NETWORK
        </text>
        {HUBS.map((h, i) => {
          const n = nodes[i]!
          const on = h.code === active
          return (
            <g
              key={`n${h.code}`}
              className={styles.orgNodeHit}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`HUB ${h.region}`}
              onPointerEnter={() => setActive(h.code)}
              onFocus={() => setActive(h.code)}
              onClick={() => setActive(h.code)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActive(h.code)
                }
              }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={20}
                className={on ? styles.orgNodeOn : h.dashed ? styles.orgNodeDashed : styles.orgNode}
              />
              <text
                x={n.x}
                y={n.y + 4}
                className={on ? styles.orgNodeTextOn : styles.orgNodeText}
                textAnchor="middle"
              >
                {h.short}
              </text>
            </g>
          )
        })}
      </svg>

      <aside className={styles.orgPanel} aria-live="polite">
        <div className={styles.orgPanelPhoto}>
          <Photo
            caption={`ẢNH · CHÂN DUNG · TRƯỞNG HUB ${panelRegion(hub.region)}`}
            tone="warm"
            photo={hub.lead?.photo ?? null}
            sizes="300px"
          />
        </div>
        <p className={styles.orgPanelRole}>TRƯỞNG HUB</p>
        {hub.lead ? <p className={styles.orgPanelName}>{hub.lead.name}</p> : null}
        <dl className={styles.orgPanelFacts}>
          <dt>HUB</dt>
          <dd>{hub.short}</dd>
          <dt>KHU VỰC</dt>
          <dd>{hub.region}</dd>
          <dt>TỪ NĂM</dt>
          <dd>{hub.since}</dd>
          <dt>THÀNH VIÊN</dt>
          <dd>—</dd>
          <dt>CÂU LẠC BỘ</dt>
          <dd>—</dd>
        </dl>
        <p className={styles.orgPanelLead}>
          <span className={styles.orgPanelAvatar} aria-hidden="true" />
          Trưởng câu lạc bộ
        </p>
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------ Humans of HUB */

const HUMAN_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CURRENT', label: 'Nhiệm kỳ hiện tại' },
  { key: 'PAST', label: 'Các thế hệ trước' },
] as const

export function HumansStrip({ later }: { later: Action }) {
  const [tab, setTab] = useState<(typeof HUMAN_TABS)[number]['key']>('ALL')
  const shown = HUMANS.filter((h) => tab === 'ALL' || h.term === tab)
  return (
    <>
      <div className={styles.humansHead}>
        <div>
          <h2 className={`${styles.humansTitle} ${styles.onDark}`}>Humans of HUB</h2>
          <p className={styles.humansLede}>Khám phá thành viên HUB Network qua các thế hệ</p>
        </div>
        <Cta action={later} label="Xem tất cả" className={styles.btnLineLight}>
          Xem tất cả <Arrow />
        </Cta>
      </div>
      <div className={styles.tabs} role="group" aria-label="Lọc theo nhiệm kỳ">
        {HUMAN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? styles.tabOnCoral : styles.tabDark}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul className={styles.humansRow}>
        {shown.length === 0 ? <li className={styles.pending}>Chờ cập nhật</li> : null}
        {shown.map((h, i) => (
          <li key={h.photo.src} className={styles.human}>
            <div className={styles.humanPhoto}>
              <Photo
                caption={`ẢNH · CHÂN DUNG · ${h.name.toUpperCase()}`}
                tone={i % 2 ? 'warm' : 'deep'}
                photo={h.photo}
                sizes="270px"
              />
            </div>
            <p className={styles.humanRole}>VAI TRÒ · CHỜ CẬP NHẬT</p>
            <p className={styles.humanName}>{h.name}</p>
            <p className={styles.humanTerm}>NHIỆM KỲ · CHỜ CẬP NHẬT</p>
            <Cta action={later} label="Xem thêm" className={styles.humanMore}>
              Xem thêm →
            </Cta>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---------------------------------------------------------------- 06 timeline */

export function TimelineTrack() {
  const [active, setActive] = useState(0)
  const items = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    for (const el of items.current) if (el) io.observe(el)
    return () => io.disconnect()
  }, [])

  const reached = MILESTONES.slice(0, active + 1)
  const reachedPlaces = new Set(reached.flatMap((m) => m.places))
  const nowPlaces = new Set(MILESTONES[active]!.places)
  const current = MILESTONES[active]!

  return (
    <div className={styles.tl}>
      <aside className={styles.tlAside} aria-live="polite">
        <p className={styles.tlYear}>{current.year}</p>
        <p className={styles.tlStep}>
          MỐC {String(active + 1).padStart(2, '0')} / {String(MILESTONES.length).padStart(2, '0')}
        </p>
        <p className={styles.tlCount}>
          <span className={styles.tlCountNo}>{reachedPlaces.size}</span>
          <span className={styles.tlCountLabel}>HUB ĐÃ CÓ MẶT</span>
        </p>
        <ul className={styles.tlChips}>
          {PLACES.map((p) => (
            <li
              key={p}
              className={
                nowPlaces.has(p)
                  ? styles.chipNow
                  : reachedPlaces.has(p)
                    ? styles.chipPast
                    : styles.chipLater
              }
            >
              {p}
            </li>
          ))}
        </ul>
      </aside>
      <ol className={styles.tlList}>
        {MILESTONES.map((m, i) => {
          const state = i < active ? 'past' : i === active ? 'now' : 'later'
          return (
            <li
              key={m.when}
              ref={(el) => {
                items.current[i] = el
              }}
              data-index={i}
              data-state={state}
              className={styles.tlItem}
            >
              <span className={styles.tlDot} aria-hidden="true" />
              <p className={styles.tlWhen}>{m.when}</p>
              <h3 className={`${styles.tlTitle} ${m.badge ? styles.tlTitleLong : ''}`}>
                {m.title}
              </h3>
              {m.badge ? <p className={styles.tlBadge}>{m.badge}</p> : null}
              {m.items ? (
                <ol className={styles.tlItems}>
                  {m.items.map((t, k) => (
                    <li key={k}>
                      <span>0{k + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className={styles.tlPhoto}>
                <Photo
                  caption={m.caption}
                  tone={i <= 2 ? m.tone : i === 3 ? 'pale' : 'mauve'}
                  photo={m.photo}
                  sizes="(max-width: 1279px) 100vw, 700px"
                />
              </div>
              {m.places.length ? (
                <p className={styles.tlPlaces}>
                  {m.places.map((p) => (
                    <span key={p}>+ {p.toUpperCase()}</span>
                  ))}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------------------------------------------------------- 07 activities */

export function ActivitiesStrip({ later }: { later: Action }) {
  const [kind, setKind] = useState<'ALL' | ActivityKind>('ALL')
  const [progress, setProgress] = useState({ ratio: 0, canPrev: false, canNext: false })
  const track = useRef<HTMLDivElement>(null)
  const shown = ACTIVITIES.filter((a) => kind === 'ALL' || a.kind === kind)

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress({
      ratio: max > 0 ? el.scrollLeft / max : 1,
      canPrev: el.scrollLeft > 4,
      canNext: el.scrollLeft < max - 4,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = track.current
    if (!el) return
    el.scrollTo({ left: 0 })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, kind])

  // Mouse drag to scroll (touch and trackpads scroll natively).
  useEffect(() => {
    const el = track.current
    if (!el) return
    let startX = 0
    let startLeft = 0
    let dragging = false
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      dragging = true
      startX = e.clientX
      startLeft = el.scrollLeft
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      el.scrollLeft = startLeft - (e.clientX - startX)
    }
    const up = () => {
      dragging = false
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const step = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector('li')
    const w = card ? card.getBoundingClientRect().width + 18 : 420
    el.scrollBy({ left: dir * w, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return (
    <>
      <div className={styles.tabs} role="group" aria-label="Lọc theo loại hoạt động">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={kind === f.key ? styles.tabOnInk : styles.tabLight}
            aria-pressed={kind === f.key}
            onClick={() => setKind(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div
        className={styles.strip}
        ref={track}
        onScroll={measure}
        tabIndex={0}
        aria-label="Danh sách hoạt động"
      >
        <ul className={styles.stripRow}>
          {shown.length === 0 ? <li className={styles.pendingInk}>Chờ cập nhật</li> : null}
          {shown.map((a) => (
            <li key={a.title} className={styles.activity}>
              <div className={styles.activityBanner}>
                <Photo caption={a.banner} tone={a.tone} rounded={false} />
                <span className={styles.activityKind}>{KIND_LABEL[a.kind]}</span>
              </div>
              <div className={styles.activityBody}>
                <h3 className={styles.activityTitle}>{a.title}</h3>
                <dl className={styles.activityFacts}>
                  <dt>THỜI GIAN</dt>
                  <dd className={a.time ? '' : styles.muted}>{a.time ?? 'Chờ cập nhật'}</dd>
                  <dt>ĐƠN VỊ TỔ CHỨC</dt>
                  <dd>{a.organiser}</dd>
                  <dt>VAI TRÒ HUB</dt>
                  <dd className={styles.muted}>Chủ trì / phối hợp · chờ xác nhận</dd>
                </dl>
                <Cta action={later} label={`Xem thêm — ${a.title}`} className={styles.activityMore}>
                  Xem thêm →
                </Cta>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.stripFoot}>
        <span className={styles.stripHint}>KÉO HOẶC VUỐT ĐỂ XEM THÊM</span>
        <span className={styles.stripBar} aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.max(progress.ratio, 0.02)})` }} />
        </span>
        <button
          type="button"
          className={styles.stripBtn}
          onClick={() => step(-1)}
          disabled={!progress.canPrev}
          aria-label="Hoạt động trước"
        >
          <Arrow className={styles.flip} />
        </button>
        <button
          type="button"
          className={styles.stripBtn}
          onClick={() => step(1)}
          disabled={!progress.canNext}
          aria-label="Hoạt động tiếp theo"
        >
          <Arrow />
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------- 08 closing */

/** Final section: a light glow that follows the pointer and a magnetic main button. */
export function ClosingGlow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    const magnet = el.querySelector<HTMLElement>('[data-cta="about-join-closing"]')
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--gx', `${e.clientX - r.left}px`)
        el.style.setProperty('--gy', `${e.clientY - r.top}px`)
        if (magnet) {
          const b = magnet.getBoundingClientRect()
          const dx = e.clientX - (b.left + b.width / 2)
          const dy = e.clientY - (b.top + b.height / 2)
          const near = Math.hypot(dx, dy) < 140
          magnet.style.transform = near ? `translate(${dx * 0.18}px, ${dy * 0.25}px)` : ''
        }
      })
    }
    const onLeave = () => {
      if (magnet) magnet.style.transform = ''
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <section
      ref={ref}
      className={styles.closing}
      data-section="closing"
      aria-label="Tham gia HUB Network"
    >
      {children}
    </section>
  )
}
