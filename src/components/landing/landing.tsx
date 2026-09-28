import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'

import { INERT_REASONS } from '@/lib/member/nav'

import { Events, Pipeline, Programmes } from './landing-activities'
import { Community } from './landing-community'
import { AllInOne, Closing, Network } from './landing-network'
import { Arrow, Cta, type Action } from './landing-parts'
import { Opportunities, Pain, Solution } from './landing-story'
import styles from './landing.module.css'

/**
 * TASK 22.1 — the corrected public homepage (H1), `/` for every visitor
 * (DEC-P0-LANDING-D1, reference `design-reference/final/revision/H1`).
 *
 * Typography is Space Grotesk where the corrected reference uses it
 * (DEC-HD-12); mono labels keep the approved IBM Plex Mono.
 *
 * TASK 22-HOMEPAGE-FINAL-ALIGN (DEC-H1-R2): content and order follow the latest
 * Homepage export, with the PO removals applied. Illustrative cards and the
 * partner matrix carry a visible "Dữ liệu minh hoạ" label. Every call to
 * action goes to a real destination or is inert with a reason (see
 * `landing-parts.tsx`). Nothing here reads member, count or private data.
 */

const FUTURE = INERT_REASONS.FUTURE

export type LandingLinks = {
  /** The visitor's own entry point: /auth for a guest, the onboarding resolver's route otherwise. */
  entry: string
  /** The PUBLISHED HUB's public page, or null when none exists. */
  network: string | null
}

function entryLabel(entry: LandingEntry): string | null {
  if (entry.kind === 'GUEST') return null
  return entry.onboarded ? 'Vào tài khoản của tôi' : 'Tiếp tục thiết lập tài khoản'
}

export function Landing({
  entry,
  hubSlug,
  legal,
}: {
  entry: LandingEntry
  hubSlug: string | null
  legal: Array<{ href: string; label: string }>
}) {
  const links: LandingLinks = {
    entry: entry.href,
    network: hubSlug ? `/organizations/${hubSlug}` : null,
  }
  const member = entryLabel(entry)
  const network: Action = links.network ? { href: links.network } : { inert: 'NO_P0_SCREEN' }

  return (
    <div
      className={styles.page}
      data-screen="P0-LANDING"
      data-revision="H1"
      data-entry={entry.kind}
    >
      <div className={styles.hero} data-section="hero">
        <header className={styles.bar}>
          <Link href="/" className={styles.brand} aria-label="HUB NETWORK — trang chủ">
            HUB NETWORK
          </Link>
          <nav className={styles.nav} aria-label="Trang chủ">
            <Cta action={{ href: '/about' }} label="Về HUB Network">
              Về HUB Network
            </Cta>
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Chương trình">
              Chương trình
            </Cta>
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Sự kiện">
              Sự kiện
            </Cta>
            <Cta action={{ href: '/library' }} label="Mạng lưới đổi mới sáng tạo" cta="network-bar">
              Mạng lưới đổi mới sáng tạo
            </Cta>
          </nav>
          <div className={styles.barRight}>
            <Cta action={{ inert: 'FUTURE' }} label="VI | EN" className={styles.lang}>
              VI | EN
            </Cta>
            {member ? null : (
              <Link href={links.entry} className={styles.login} data-cta="login">
                Đăng nhập
              </Link>
            )}
            <Link href={links.entry} className={styles.barPill} data-cta="primary-bar">
              {member ?? 'Tạo tài khoản'}
            </Link>
          </div>
        </header>

        <main className={styles.heroMain}>
          <h1 className={styles.heroTitle}>
            Nền tảng kết nối
            <br />
            những hành trình đổi mới sáng tạo
          </h1>
          <div className={styles.heroSide}>
            <p className={styles.heroLede}>
              Nơi những nhà sáng lập và giải pháp đổi mới sáng tạo tiềm năng được tìm thấy và kết
              nối với đúng cơ hội.
            </p>
            <div className={`${styles.search} ${styles.inert}`} role="search" title={FUTURE}>
              <span className={styles.searchLabel} aria-hidden="true">
                TÌM
              </span>
              <input
                className={styles.searchInput}
                type="search"
                disabled
                aria-disabled="true"
                title={FUTURE}
                data-cta-kind="INERT"
                aria-label={`Tìm kiếm chương trình, sự kiện — ${FUTURE}`}
                placeholder="Tìm kiếm chương trình, sự kiện"
              />
              <button
                className={styles.searchButton}
                type="button"
                disabled
                aria-disabled="true"
                title={FUTURE}
                data-cta-kind="INERT"
                aria-label={`Tìm kiếm — ${FUTURE}`}
              >
                <Arrow />
              </button>
            </div>
            <div className={styles.heroActions}>
              <Link href="/projects/new" className={styles.heroPrimary} data-cta="startup">
                Tạo hồ sơ startup của bạn <Arrow />
              </Link>
              <a href="#co-hoi" className={styles.heroGhost} data-cta="opportunities">
                Khám phá cơ hội
              </a>
            </div>
          </div>
          <p className={styles.wordmark}>1hub.network</p>
        </main>
      </div>

      <div className={styles.strip} data-section="strip" aria-label="Hành trình">
        {['Đăng ký', 'Xác thực', 'Đánh giá', 'Cố vấn', 'Thử nghiệm'].map((step) => (
          <span key={step} className={styles.stripItem}>
            {step}
            <svg
              className={styles.stripArrow}
              viewBox="0 0 25 18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M0 9h23.5M16 1l7.5 8-7.5 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
          </span>
        ))}
      </div>

      <Pain />
      <Solution />
      <Opportunities />
      <Events />
      <Programmes />
      <Pipeline />
      <AllInOne links={links} memberLabel={member} />
      <Network />
      <Community />
      <Closing network={network} />

      <footer className={styles.footer} data-section="footer">
        <div className={styles.footerTop}>
          <div className={styles.footerAbout}>
            <p className={styles.footerBrand}>1hub.network</p>
            <p className={styles.footerText}>
              Nền tảng vận hành chương trình đổi mới sáng tạo và kết nối dữ liệu nhà sáng lập,
              startup.
            </p>
          </div>
          <FooterColumn title="KHÁM PHÁ">
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Chương trình">
              Chương trình
            </Cta>
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Sự kiện">
              Sự kiện
            </Cta>
          </FooterColumn>
          <FooterColumn title="MẠNG LƯỚI ĐMST">
            <Cta action={{ inert: 'FUTURE' }} label="Giải pháp & Startup">
              Giải pháp &amp; Startup
            </Cta>
            <Cta action={{ inert: 'FUTURE' }} label="Nhà sáng lập & Nhà đổi mới sáng tạo">
              Nhà sáng lập &amp; Nhà đổi mới sáng tạo
            </Cta>
          </FooterColumn>
          <FooterColumn title="GIẢI PHÁP CHO TỔ CHỨC">
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Triển khai chương trình">
              Triển khai chương trình
            </Cta>
            <Cta action={{ inert: 'FUTURE' }} label="Đăng bài toán">
              Đăng bài toán
            </Cta>
            <Cta action={network} label="Khám phá mạng lưới" cta="network-footer">
              Khám phá mạng lưới
            </Cta>
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Kết nối hợp tác">
              Kết nối hợp tác
            </Cta>
          </FooterColumn>
          <FooterColumn title="THÔNG TIN" wide>
            <Cta action={{ href: '/about' }} label="Về HUB Network">
              Về HUB Network
            </Cta>
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Câu hỏi thường gặp">
              Câu hỏi thường gặp
            </Cta>
            {legal.map((l) => (
              <Link key={l.href} href={l.href} data-cta="legal">
                {l.label}
              </Link>
            ))}
          </FooterColumn>
          <FooterColumn title="LIÊN HỆ">
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="global@1hub.network">
              global@1hub.network
            </Cta>
            <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Mạng xã hội">
              Mạng xã hội
            </Cta>
          </FooterColumn>
        </div>
        <p className={styles.footerWordmark} aria-hidden="true">
          HUB NETWORK
        </p>
        <div className={styles.footerBottom}>
          <span>© 2026 HUB Network</span>
          <span>1hub.network</span>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({
  title,
  wide,
  children,
}: {
  title: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <nav className={`${styles.footerCol} ${wide ? styles.footerColWide : ''}`} aria-label={title}>
      <p className={styles.footerLabel}>{title}</p>
      {children}
    </nav>
  )
}
