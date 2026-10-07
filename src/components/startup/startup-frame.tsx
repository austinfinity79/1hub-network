import Link from 'next/link'
import type { ReactNode } from 'react'

import { PublicAction } from '@/components/public-shell/public-action'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import { STAGE_SHORT, type StartupPage } from '@/lib/public/directory-data'
import { PUBLIC_ROUTES } from '@/lib/public/routes'
import type { PublicShellData } from '@/lib/public/shell-data'

import { FollowButton } from './follow-button'
import styles from './startup.module.css'

/**
 * THAO-06 — the frame shared by the three tabs of `/products/[slug]`
 * (DEC-THAO-SP-D10: the DM10 / SP1 language for Chỉ số and Cập nhật too):
 * header card, Follow (D4), the inert "Đề nghị kết nối" (D5 deferred), tabs as
 * real links, then the tab's own content and the public footer.
 */

export type StartupTab = 'overview' | 'metrics' | 'updates'

const TABS: Array<{ key: StartupTab; label: string; path: string }> = [
  { key: 'overview', label: 'Tổng quan', path: '' },
  { key: 'metrics', label: 'Chỉ số', path: '/metrics' },
  { key: 'updates', label: 'Cập nhật', path: '/updates' },
]

export function initials(name: string, pick: 'first-two' | 'first-last'): string {
  const words = name.trim().split(/\s+/)
  const letters =
    words.length < 2
      ? name.slice(0, 2)
      : pick === 'first-two'
        ? words[0]!.charAt(0) + words[1]!.charAt(0)
        : words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)
  return letters.toLocaleUpperCase('vi')
}

export function StartupFrame({
  shell,
  startup,
  tab,
  following,
  children,
}: {
  shell: PublicShellData
  startup: StartupPage
  tab: StartupTab
  following: boolean
  children: ReactNode
}) {
  const guest = shell.viewer.kind === 'GUEST'
  const o = startup.overview
  const base = `${PUBLIC_ROUTES.products}/${startup.slug}`
  const meta = [
    startup.since ? `Từ ${startup.since}` : null,
    startup.round,
    startup.region?.replace(/^TP\. /, ''),
  ].filter(Boolean)
  return (
    <div
      className={styles.page}
      data-screen="DEMO-STARTUP"
      data-revision="DM10"
      data-tab={tab}
      data-startup={startup.slug}
      data-entry={shell.viewer.kind}
    >
      <PublicHeader viewer={shell.viewer} current="products" tone="light" />
      <main className={styles.main}>
        <Link href={PUBLIC_ROUTES.products ?? '/'} className={styles.back} data-cta="back">
          ← Sản phẩm
        </Link>

        <section className={styles.head} aria-labelledby="startup-name">
          <div className={styles.headTop}>
            {startup.logo ? (
              // The startup's public logo; initials when it has none.
              <span className={`${styles.logo} ${styles.logoImage}`} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- public logo of the media route */}
                <img src={startup.logo} alt="" width={72} height={72} data-logo="" />
              </span>
            ) : (
              <span className={styles.logo} aria-hidden="true">
                {initials(startup.name, 'first-two')}
              </span>
            )}
            <div className={styles.identity}>
              <div className={styles.nameRow}>
                <h1 id="startup-name">{startup.name}</h1>
                {startup.domains[0] ? (
                  <span className={styles.domain}>{startup.domains[0]}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.side}>
              {startup.stage ? (
                <span className={styles.status}>
                  {startup.stage === 'PILOT' ? 'Đang pilot' : STAGE_SHORT[startup.stage]}
                </span>
              ) : null}
              {meta.length ? <p className={styles.meta}>{meta.join(' · ')}</p> : null}
              <div className={styles.actions}>
                <FollowButton slug={startup.slug} guest={guest} initial={following} />
                {/* DEC-THAO-SP-D5: Connect is deferred; the drawn control stays inert. */}
                <PublicAction
                  href={guest ? '/auth' : null}
                  className={styles.connect}
                  cta="connect"
                >
                  Đề nghị kết nối
                </PublicAction>
              </div>
            </div>
          </div>
          <div className={styles.pitch}>
            <p className={styles.eyebrow}>{o ? o.focus : startup.domains.join(' · ')}</p>
            <p className={styles.tagline}>{o ? o.tagline : (startup.summary ?? startup.name)}</p>
          </div>
        </section>

        <nav className={styles.tabs} aria-label="Hồ sơ sản phẩm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`${base}${t.path}`}
              className={t.key === tab ? styles.tabOn : styles.tab}
              aria-current={t.key === tab ? 'page' : undefined}
              data-tab-link={t.key}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {children}
      </main>
      {/* THAO-02: the one public footer, as on every public page. */}
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
