'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ArrowRight, PublicAction } from '@/components/public-shell/public-action'

import { MAP_H, MAP_W } from './about-map-geo'
import { AboutCarousel } from './about-carousel'
import styles from './about.module.css'

/** Hit area of a map marker (px), as drawn by `.marker`. */
const MARKER = 22

/**
 * DM02 "Quy mô cộng đồng" map and DM03 HUB popup (Thảo: hover a HUB point for
 * a quick card, click it for a short popup with a CTA to its HUB / Chapter
 * page; the whole territory of Viet Nam including Hoàng Sa and Trường Sa;
 * "Xem thêm" opens the full HUB / Chapter / CLB list).
 *
 * Everything shown is canonical: catalogue units and CLB counts, the
 * S1-UAT-08A board people. The frame's sample numbers (members, events,
 * projects) have no source and are not drawn.
 */

export type MapPoint = { x: number; y: number } | null

export type MapHub = {
  slug: string
  code: string
  short: string
  place: string
  since: string
  initials: string
  /** The chapter's approved logo (HUB_LOGOS), else null: the initials are drawn. */
  logo: string | null
  world: MapPoint
  vietnam: MapPoint
  board: Array<{ name: string; title: string | null; photo: string | null; initials: string }>
  /** Each CLB with its public page. */
  clubs: Array<{ name: string; href: string }>
  href: string
}

export type MapArchipelago = { name: string; world: MapPoint; vietnam: MapPoint }

export type CatalogueGroup = {
  name: string
  href: string
  clubs: Array<{ name: string; href: string }>
}

function Avatar({
  person,
  className,
}: {
  person: { name: string; photo: string | null; initials: string }
  className?: string
}) {
  return (
    <span className={className} aria-hidden="true">
      {person.photo ? (
        <Image src={person.photo} alt="" width={64} height={64} sizes="64px" />
      ) : (
        person.initials
      )}
    </span>
  )
}

function HubPopup({ hub, onClose }: { hub: MapHub; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-popup-title"
        data-popup={hub.slug}
      >
        <div className={styles.popupBody}>
          <p className={styles.popupEyebrow}>HUB KHU VỰC</p>
          <h3 id="hub-popup-title" className={styles.popupTitle}>
            {hub.short}
          </h3>
          <p className={styles.popupLede}>
            {hub.place} · từ {hub.since}
          </p>
          <button
            ref={close}
            type="button"
            className={styles.popupClose}
            aria-label="Đóng"
            onClick={onClose}
          >
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <dl className={styles.popupStats}>
            <div>
              <dt>{hub.clubs.length}</dt>
              <dd>CLB trực thuộc</dd>
            </div>
            <div>
              <dt>{hub.board.length}</dt>
              <dd>thành viên Ban điều hành</dd>
            </div>
            <div>
              <dt>{hub.since}</dt>
              <dd>năm có mặt</dd>
            </div>
          </dl>
          {hub.board.length ? (
            <>
              <h4 className={styles.popupHeading}>Thành viên</h4>
              <ul className={styles.popupRow} role="list">
                {hub.board.map((p) => (
                  <li key={p.name} className={styles.personCard}>
                    <Avatar person={p} className={styles.personAvatar} />
                    <p className={styles.personName}>{p.name}</p>
                    <p className={styles.personRole}>{p.title ?? 'Chờ cập nhật'}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {hub.clubs.length ? (
            <>
              <h4 className={styles.popupHeading}>Câu lạc bộ trực thuộc</h4>
              <ul className={styles.popupRow} role="list">
                {hub.clubs.map((c) => (
                  <li key={c.href} className={styles.clubCard}>
                    <span className={styles.clubTag}>CLB</span>
                    <p className={styles.clubName}>
                      <PublicAction href={c.href} className={styles.unitLink}>
                        {c.name}
                      </PublicAction>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className={styles.popupFoot}>
          <PublicAction href={hub.href} className={styles.coralBtn} cta="hub-detail">
            Xem chi tiết HUB Chapter <ArrowRight />
          </PublicAction>
        </div>
      </div>
    </div>
  )
}

export function AboutMap({
  hubs,
  archipelagos,
  catalogue,
}: {
  hubs: MapHub[]
  archipelagos: MapArchipelago[]
  catalogue: CatalogueGroup[]
}) {
  const [view, setView] = useState<'world' | 'vietnam'>('world')
  const [hover, setHover] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const closePopup = useCallback(() => setOpen(null), [])
  const opened = hubs.find((h) => h.slug === open) ?? null
  const hovered = hubs.find((h) => h.slug === hover) ?? null
  const at = (p: MapPoint) => (p ? { left: `${p.x}%`, top: `${p.y}%` } : undefined)
  const pointOf = (h: MapHub) => (view === 'world' ? h.world : h.vietnam)
  // THAO-04: at world scale Quảng Ninh sits 4.5 px from Hà Nội and covered its
  // marker. Positions stay as drawn (presentation only); a HUB whose marker
  // overlaps a later HUB's is lifted above it, so the earlier one stays
  // clickable. The later one is reached in the Việt Nam view, by chip or Tab.
  const lifted = (h: MapHub) => {
    const p = pointOf(h)
    return hubs.some((o) => {
      const q = pointOf(o)
      return (
        p &&
        q &&
        o.since > h.since &&
        Math.hypot(((p.x - q.x) * MAP_W) / 100, ((p.y - q.y) * MAP_H) / 100) < MARKER
      )
    })
  }
  return (
    <>
      <div className={styles.map} data-map-view={view}>
        <div className={styles.mapTabs} role="tablist" aria-label="Chế độ bản đồ">
          {(['world', 'vietnam'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`${styles.mapTab} ${view === v ? styles.mapTabOn : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'world' ? 'Thế giới' : 'Việt Nam'}
            </button>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static vector map */}
        <img
          className={styles.mapImage}
          src={view === 'world' ? '/about/map-world.svg' : '/about/map-vietnam.svg'}
          alt={
            view === 'world'
              ? 'Bản đồ thế giới với các HUB Khu vực của HUB Network'
              : 'Bản đồ Việt Nam, gồm quần đảo Hoàng Sa và Trường Sa, với các HUB Khu vực trong nước'
          }
          width={1312}
          height={640}
        />
        {archipelagos.map((a) => {
          const p = view === 'world' ? a.world : a.vietnam
          return p ? (
            <span key={a.name} className={styles.islands} style={at(p)} data-archipelago={a.name}>
              <span className={styles.islandDots} aria-hidden="true" />
              <span className={styles.islandName}>{a.name}</span>
            </span>
          ) : null
        })}
        {hubs.map((h) => {
          const p = pointOf(h)
          return p ? (
            <button
              key={h.slug}
              type="button"
              className={styles.marker}
              style={{ ...at(p), ...(lifted(h) ? { zIndex: 2 } : null) }}
              aria-label={`${h.short} — mở giới thiệu`}
              data-marker={h.code}
              onMouseEnter={() => setHover(h.slug)}
              onMouseLeave={() => setHover((s) => (s === h.slug ? null : s))}
              onFocus={() => setHover(h.slug)}
              onBlur={() => setHover((s) => (s === h.slug ? null : s))}
              onClick={() => setOpen(h.slug)}
            />
          ) : null
        })}
        {hovered && pointOf(hovered) ? (
          <span
            className={styles.quick}
            style={at(pointOf(hovered))}
            aria-hidden="true"
            data-quick={hovered.code}
          >
            {/* S2-ABOUT-MAP-HUB-LOGOS-01: the approved logo (HUB_LOGOS, exact
                mapping only); a HUB without one keeps its initials. */}
            {hovered.logo ? (
              <span className={`${styles.quickMark} ${styles.quickLogo}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 256 px static logo */}
                <img
                  src={hovered.logo}
                  alt=""
                  width={56}
                  height={56}
                  data-quick-logo={hovered.code}
                />
              </span>
            ) : (
              <span className={styles.quickMark}>{hovered.initials}</span>
            )}
            {hovered.short}
          </span>
        ) : null}
      </div>

      <AboutCarousel hubSlugs={hubs.map((h) => h.slug)} onOpenHub={setOpen} />

      <ul className={styles.hubChips} role="list" aria-label="HUB Khu vực">
        {hubs.map((h) => (
          <li key={h.slug}>
            <button type="button" className={styles.hubChip} onClick={() => setOpen(h.slug)}>
              {h.logo ? (
                <span className={`${styles.hubChipMark} ${styles.hubChipLogo}`} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 256 px static logo */}
                  <img src={h.logo} alt="" width={72} height={72} data-hub-logo={h.code} />
                </span>
              ) : (
                <span className={styles.hubChipMark} aria-hidden="true">
                  {h.initials || h.code}
                </span>
              )}
              <span>{h.short}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.lineBtn}
        aria-expanded={all}
        aria-controls="about-network-list"
        onClick={() => setAll((v) => !v)}
      >
        {all ? 'Thu gọn' : 'Xem thêm'} <ArrowRight />
      </button>
      {all ? (
        <div id="about-network-list" className={styles.networkList}>
          {catalogue.map((g) => (
            <section key={g.href}>
              <h4>
                <PublicAction href={g.href} className={styles.unitLink}>
                  {g.name}
                </PublicAction>
              </h4>
              {g.clubs.length ? (
                <ul role="list">
                  {g.clubs.map((c) => (
                    <li key={c.href}>
                      <PublicAction href={c.href} className={styles.unitLink}>
                        {c.name}
                      </PublicAction>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Chưa có CLB trực thuộc trong danh mục.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
      {opened ? <HubPopup hub={opened} onClose={closePopup} /> : null}
    </>
  )
}
