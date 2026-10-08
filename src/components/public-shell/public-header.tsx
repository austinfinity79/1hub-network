'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { emitNavEvent, type NavMenuKey } from '@/lib/analytics/nav-events'
import { PUBLIC_ROUTES } from '@/lib/public/routes'
import type { PublicViewer } from '@/lib/public/viewer'

import { HubLogo } from './hub-logo'
import { aboutMenu, PROGRAMME_MENU, type NavGroup, type NavItem } from './nav-menus'
import { ArrowUpRight, NavText, NOT_YET } from './public-action'
import styles from './public-header.module.css'

/**
 * DEMO-HOME-ABOUT-01 / THAO-01 — the one global header of every public page
 * (nav N1: DM01, DM02; Thảo §A "Thanh điều hướng"): HUB symbol · Giới thiệu ▾ ·
 * Chương trình ▾ · Sản phẩm · Nhân tài · Tin tức, then VI | EN and the
 * visitor's own entry (guest: Đăng nhập / Tạo tài khoản; signed in: Việc của
 * tôi, bell, avatar).
 *
 * S2-NAV-DROPDOWN-V2-01 (Feedback Sprint 2 lần 3, NAV-DD-01 → 16):
 * - only Giới thiệu and Chương trình have a menu; their trigger opens / closes
 *   it and never navigates. Sản phẩm, Nhân tài, Tin tức stay direct links.
 * - one menu at a time; desktop pointer: open after 150 ms over the trigger,
 *   close 250 ms after leaving trigger + menu (one hover area, no flicker);
 *   closes on choice, outside click, Escape (focus back on the trigger), route
 *   change, or when the other menu opens.
 * - keyboard: the trigger is a button (Enter / Space), ArrowDown opens and
 *   enters the menu; Tab walks the entries and leaving the menu closes it.
 * - below 1024 px the menus are expandable groups of the ☰ panel (no hover).
 * - an entry pointing at the page already open scrolls (to its section or the
 *   top) without reloading; anchors keep a shareable hash.
 * - nav_menu_open / nav_menu_select are raised (lib/analytics/nav-events).
 * N0 / N2 pages use their own shells: they never render this header, so they
 * have no menu. VI | EN: VI is current, EN is shown unavailable.
 */

export type PublicSection = 'home' | 'about' | 'products' | 'talents' | 'programmes' | 'news'

const OPEN_DELAY = 150
const CLOSE_DELAY = 250

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
      <path d="M0 0h6L3 4z" fill="currentColor" />
    </svg>
  )
}

/** Desktop pointer that hovers (the ☰ panel never opens on hover). */
function useHoverMenus(): boolean {
  const [hover, setHover] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
    const sync = () => setHover(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return hover
}

function MenuEntry({
  item,
  menu,
  onDone,
}: {
  item: NavItem
  menu: NavMenuKey
  onDone: () => void
}) {
  const body = (
    <>
      <span className={styles.menuLabel}>
        {item.label}
        {item.kind === 'external' ? <ArrowUpRight className={styles.menuArrow} /> : null}
        {item.kind === 'external' ? <span className={styles.srOnly}> (mở tab mới)</span> : null}
      </span>
      {item.description ? <span className={styles.menuText}>{item.description}</span> : null}
    </>
  )
  if (item.kind === 'none' || !item.href)
    return (
      <span
        className={styles.menuItem}
        aria-disabled="true"
        title={NOT_YET}
        data-nav-item={item.code}
        data-nav-kind="none"
      >
        {body}
      </span>
    )
  const select = () =>
    emitNavEvent({
      name: 'nav_menu_select',
      menu,
      item: item.code,
      type: item.kind as 'page' | 'anchor' | 'external',
      href: item.href!,
    })
  if (item.kind === 'external')
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.menuItem}
        data-nav-item={item.code}
        data-nav-kind="external"
        onClick={() => {
          select()
          onDone()
        }}
      >
        {body}
      </a>
    )
  const href = item.href
  return (
    <Link
      href={href}
      className={styles.menuItem}
      data-nav-item={item.code}
      data-nav-kind={item.kind}
      onClick={(e) => {
        select()
        onDone()
        // The page already open: scroll (to the section, else the top), no reload.
        const url = new URL(href, window.location.href)
        if (url.pathname !== window.location.pathname) return
        e.preventDefault()
        const target = url.hash
          ? document.getElementById(decodeURIComponent(url.hash.slice(1)))
          : null
        if (url.hash) {
          if (window.location.hash !== url.hash) window.history.pushState(null, '', url.hash)
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          if (window.location.hash) window.history.pushState(null, '', url.pathname + url.search)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }}
    >
      {body}
    </Link>
  )
}

function Dropdown({
  name,
  label,
  groups,
  current,
  open,
  hover,
  pointer,
  onOpen,
  onClose,
}: {
  name: NavMenuKey
  label: string
  groups: NavGroup[]
  current: boolean
  open: boolean
  hover: boolean
  /** True while a pointer press is in progress (its click decides, not the blur). */
  pointer: { current: boolean }
  onOpen: (via: 'hover' | 'click' | 'keyboard') => void
  onClose: () => void
}) {
  const id = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | null>(null)
  // Opened by the pointer: the click that usually follows keeps it open.
  const byHover = useRef(false)
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
      trigger.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden) }))
  return (
    <div
      ref={wrap}
      className={`${styles.dropdown} ${open ? styles.dropdownOpen : ''}`}
      data-nav={name}
      data-menu-open={open ? 'true' : undefined}
      onMouseEnter={() => {
        if (!hover) return
        clear()
        if (!open)
          timer.current = window.setTimeout(() => {
            byHover.current = true
            onOpen('hover')
          }, OPEN_DELAY)
      }}
      onMouseLeave={() => {
        if (!hover) return
        clear()
        if (open) timer.current = window.setTimeout(onClose, CLOSE_DELAY)
      }}
      onBlur={(e) => {
        // Focus leaving trigger + menu closes it (focus is never trapped). A
        // pointer press is left to its click: closing on its blur would reflow
        // the ☰ panel under the pointer before the click lands (THAO-01).
        if (pointer.current) return
        if (open && !wrap.current?.contains(e.relatedTarget as Node | null)) onClose()
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`${styles.trigger} ${styles.navItem} ${current ? styles.current : ''}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Mở menu ${label}`}
        aria-current={current ? 'page' : undefined}
        onClick={(e) => {
          clear()
          if (open && byHover.current) {
            byHover.current = false
            return
          }
          byHover.current = false
          // detail 0: Enter / Space on the button.
          if (open) onClose()
          else onOpen(e.detail === 0 ? 'keyboard' : 'click')
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown') return
          e.preventDefault()
          if (!open) onOpen('keyboard')
          window.requestAnimationFrame(() =>
            wrap.current?.querySelector<HTMLElement>('a[data-nav-item]')?.focus(),
          )
        }}
      >
        {label}
        <Chevron />
      </button>
      {open ? (
        <div
          id={id}
          className={`${styles.menuPanel} ${visible.length > 1 ? styles.menuPanelWide : ''}`}
          data-menu={name}
        >
          {visible.map((g, i) => (
            <div
              key={g.title ?? i}
              className={`${styles.menuGroup} ${g.tint ? styles.menuGroupTint : ''}`}
            >
              {g.title ? <p className={styles.menuGroupTitle}>{g.title}</p> : null}
              <ul role="list" className={styles.menuList}>
                {g.items.map((item) => (
                  <li key={item.code}>
                    <MenuEntry item={item} menu={name} onDone={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NavEntry({
  label,
  href,
  current,
  name,
}: {
  label: string
  href: string | null
  current: boolean
  name: string
}) {
  if (!href)
    return (
      <span data-nav={name} className={styles.navSlot}>
        <NavText className={styles.navItem}>{label}</NavText>
      </span>
    )
  return (
    <span data-nav={name} className={styles.navSlot}>
      <Link
        href={href}
        className={`${styles.navItem} ${current ? styles.current : ''}`}
        aria-current={current ? 'page' : undefined}
      >
        {label}
      </Link>
    </span>
  )
}

function Bell() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M10 2.5a5 5 0 0 0-5 5v3.2L3.6 13.4h12.8L15 10.7V7.5a5 5 0 0 0-5-5zM8 15.5a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Account({ viewer }: { viewer: PublicViewer }) {
  if (viewer.kind === 'GUEST')
    return (
      <>
        <Link href={viewer.entry} className={styles.login} data-cta="login">
          Đăng nhập
        </Link>
        <Link href={viewer.entry} className={styles.signup} data-cta="primary-bar">
          Tạo tài khoản
        </Link>
      </>
    )
  return (
    <>
      <Link href={viewer.entry} className={styles.login} data-cta="primary-bar">
        Việc của tôi
      </Link>
      <span className={styles.bell} aria-disabled="true" title="Thông báo — sắp có" data-cta="bell">
        <Bell />
      </span>
      <Link
        href={viewer.entry}
        className={styles.avatar}
        data-cta="avatar"
        aria-label="Tài khoản của tôi"
      >
        {viewer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the member's own uploaded avatar
          <img src={viewer.avatarUrl} alt="" width={32} height={32} />
        ) : (
          <span aria-hidden="true">{viewer.initials}</span>
        )}
        <Chevron />
      </Link>
    </>
  )
}

export function PublicHeader({
  viewer,
  current,
  tone = 'dark',
  clubCount = null,
}: {
  viewer: PublicViewer
  current?: PublicSection
  tone?: 'dark' | 'light'
  /** The canonical CLB count ("Hơn {n} CLB"); null: no count, no description. */
  clubCount?: number | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<NavMenuKey | null>(null)
  const panelId = useId()
  const hover = useHoverMenus()
  const nav = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const pointer = useRef(false)
  // Each menu closes only itself: a late close timer never shuts the other one.
  const closeAbout = useCallback(() => setOpenMenu((m) => (m === 'about' ? null : m)), [])
  const closeProgrammes = useCallback(() => setOpenMenu((m) => (m === 'programmes' ? null : m)), [])
  const openOne = (menu: NavMenuKey) => (via: 'hover' | 'click' | 'keyboard') => {
    setOpenMenu(menu)
    emitNavEvent({ name: 'nav_menu_open', menu, via })
  }
  useEffect(() => {
    const down = () => (pointer.current = true)
    const up = () => window.setTimeout(() => (pointer.current = false), 0)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
    }
  }, [])
  // A completed navigation closes every menu and the panel.
  useEffect(() => {
    setOpenMenu(null)
    setMenuOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  useEffect(() => {
    if (!openMenu) return
    // THAO-01: dismiss on `click`, not `mousedown` (the ☰ panel reflows on close).
    const outside = (e: MouseEvent) => {
      if (!nav.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('click', outside)
    return () => document.removeEventListener('click', outside)
  }, [openMenu])
  return (
    <header
      className={`${styles.header} ${tone === 'light' ? styles.light : styles.dark}`}
      data-shell="public"
      data-viewer={viewer.kind}
    >
      <Link href="/" className={styles.logo} aria-label="HUB Network — trang chủ" data-cta="logo">
        {tone === 'light' ? (
          // The approved logo is white on transparency; on the light header it
          // would vanish and may not be recoloured: the drawn symbol stays here.
          <HubLogo />
        ) : (
          // HOME-LOGO-HOTFIX-01: the PO's approved artwork, unmodified
          // (HUB_Network_FINAL_white_transparent.png, 2048², transparent).
          <Image
            className={styles.logoImage}
            src="/brand/hub-network-logo-white.png"
            alt=""
            width={44}
            height={44}
            priority
            data-logo="brand"
          />
        )}
      </Link>
      <button
        type="button"
        className={styles.burger}
        aria-expanded={menuOpen}
        aria-controls={panelId}
        aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>
      <div
        id={panelId}
        className={`${styles.panel} ${menuOpen ? styles.panelOpen : ''}`}
        data-open={menuOpen}
        // THAO-01: any link in the panel closes it, the current page's link included.
        onClick={(e) => (e.target as Element).closest('a') && setMenuOpen(false)}
      >
        <nav ref={nav} className={styles.nav} aria-label="Điều hướng chính">
          {/* S2-NAV-DROPDOWN-V2-01: Giới thiệu and Chương trình are menus. */}
          <Dropdown
            name="about"
            label="Giới thiệu"
            groups={aboutMenu(clubCount)}
            current={current === 'about'}
            open={openMenu === 'about'}
            hover={hover}
            pointer={pointer}
            onOpen={openOne('about')}
            onClose={closeAbout}
          />
          <Dropdown
            name="programmes"
            label="Chương trình"
            groups={PROGRAMME_MENU}
            current={current === 'programmes'}
            open={openMenu === 'programmes'}
            hover={hover}
            pointer={pointer}
            onOpen={openOne('programmes')}
            onClose={closeProgrammes}
          />
          <NavEntry
            name="products"
            label="Sản phẩm"
            href={PUBLIC_ROUTES.products}
            current={current === 'products'}
          />
          <NavEntry
            name="talents"
            label="Nhân tài"
            href={PUBLIC_ROUTES.talents}
            current={current === 'talents'}
          />
          <NavEntry
            name="news"
            label="Tin tức"
            href={PUBLIC_ROUTES.news}
            current={current === 'news'}
          />
        </nav>
        <div className={styles.right}>
          {/* THAO-01: Vietnamese is the only language of the product; no EN
              content exists, so EN is shown unavailable, never as a switch. */}
          <span className={styles.lang} role="group" aria-label="Ngôn ngữ" data-lang="vi">
            <span aria-current="true">VI</span> <span aria-hidden="true">|</span>{' '}
            <span aria-disabled="true" title="Bản tiếng Anh — sắp có">
              EN
            </span>
          </span>
          <Account viewer={viewer} />
        </div>
      </div>
    </header>
  )
}
