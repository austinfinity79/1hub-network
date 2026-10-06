'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { ECOSYSTEM_LINKS, PUBLIC_ROUTES } from '@/lib/public/routes'
import type { PublicViewer } from '@/lib/public/viewer'

import { HubLogo } from './hub-logo'
import { ArrowUpRight, NavText, PublicAction } from './public-action'
import styles from './public-header.module.css'

/**
 * DEMO-HOME-ABOUT-01 — the shared header of the new public surfaces (DM01,
 * DM02; Thảo §A "Thanh điều hướng"): HUB symbol · Giới thiệu ▾ · Chương
 * trình ▾ · Sản phẩm · Nhân tài · Tin tức, then VI | EN and the visitor's
 * own entry (guest: Đăng nhập / Tạo tài khoản; signed in: Việc của tôi, bell,
 * avatar).
 *
 * - "Giới thiệu" opens the About page; its menu also lists the external pages
 *   of footer column 1 (Thảo: "cột 1 là Giới thiệu và các trang ngoài").
 * - "Chương trình ▾" lists 2.1 Chương trình, cuộc thi and 2.2 Sự kiện.
 * - An entry whose screen is not built yet is plain text (PUBLIC_ROUTES).
 * - VI | EN stays inert: no EN content is supplied.
 * - Below 1024 px the nav collapses into one disclosure panel.
 */

export type PublicSection = 'home' | 'about' | 'products' | 'talents' | 'programmes' | 'news'

type MenuItem = { label: string; href: string | null; external?: boolean }

const ABOUT_MENU: MenuItem[] = [
  { label: 'Về HUB Network', href: PUBLIC_ROUTES.about },
  { label: 'iHUB Ventures', href: ECOSYSTEM_LINKS.ihubVentures, external: true },
  { label: 'VNV', href: ECOSYSTEM_LINKS.vnv, external: true },
  { label: '1Hub', href: ECOSYSTEM_LINKS.oneHub, external: true },
]

const PROGRAMME_MENU: MenuItem[] = [
  { label: 'Chương trình, cuộc thi', href: PUBLIC_ROUTES.programmes },
  { label: 'Sự kiện', href: PUBLIC_ROUTES.events },
]

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
      <path d="M0 0h6L3 4z" fill="currentColor" />
    </svg>
  )
}

function MenuList({ items, id }: { items: MenuItem[]; id: string }) {
  return (
    <ul className={styles.menu} id={id} role="list">
      {items.map((item) => (
        <li key={item.label}>
          <PublicAction href={item.href} className={styles.menuItem}>
            {item.label}
            {item.external ? <ArrowUpRight className={styles.menuArrow} /> : null}
          </PublicAction>
        </li>
      ))}
    </ul>
  )
}

function Dropdown({
  label,
  href,
  items,
  current,
  name,
}: {
  label: string
  href: string | null
  items: MenuItem[]
  current: boolean
  name: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <div
      ref={ref}
      className={`${styles.dropdown} ${open ? styles.dropdownOpen : ''}`}
      data-nav={name}
      onMouseLeave={() => setOpen(false)}
    >
      {href ? (
        <Link
          href={href}
          className={`${styles.navItem} ${current ? styles.current : ''}`}
          aria-current={current ? 'page' : undefined}
          onMouseEnter={() => setOpen(true)}
        >
          {label}
        </Link>
      ) : (
        <span className={styles.navItem} onMouseEnter={() => setOpen(true)}>
          {label}
        </span>
      )}
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Mở menu ${label}`}
        // Hover may already have opened it: a click (or Enter) opens, Escape / outside / leave close.
        onClick={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
      >
        <Chevron />
      </button>
      {open ? <MenuList items={items} id={id} /> : null}
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
}: {
  viewer: PublicViewer
  current?: PublicSection
  tone?: 'dark' | 'light'
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const panelId = useId()
  return (
    <header
      className={`${styles.header} ${tone === 'light' ? styles.light : styles.dark}`}
      data-shell="public"
      data-viewer={viewer.kind}
    >
      <Link href="/" className={styles.logo} aria-label="HUB Network — trang chủ" data-cta="logo">
        <HubLogo />
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
      >
        <nav className={styles.nav} aria-label="Điều hướng chính">
          <Dropdown
            name="about"
            label="Giới thiệu"
            href={PUBLIC_ROUTES.about}
            items={ABOUT_MENU}
            current={current === 'about'}
          />
          <Dropdown
            name="programmes"
            label="Chương trình"
            href={null}
            items={PROGRAMME_MENU}
            current={current === 'programmes'}
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
          <span className={styles.lang} aria-disabled="true" title="Bản tiếng Anh — sắp có">
            VI | EN
          </span>
          <Account viewer={viewer} />
        </div>
      </div>
    </header>
  )
}
