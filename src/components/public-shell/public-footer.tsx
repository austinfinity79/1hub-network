import { ECOSYSTEM_LINKS, PUBLIC_ROUTES } from '@/lib/public/routes'
import type { LegalLink } from '@/lib/public/shell-data'

import { ArrowUpRight, NOT_YET, NavText, PublicAction } from './public-action'
import styles from './public-footer.module.css'

/**
 * DEMO-HOME-ABOUT-01 — the shared public footer (Thảo §A "Footer": two link
 * columns; DM01 and DM02 draw two variants of the same footer).
 *
 * - Column 1: Giới thiệu and the external pages iHUB Ventures, VNV, 1Hub.
 * - Column 2: Chương trình · Sản phẩm · Nhân tài · Tin tức. Each is a link
 *   once its screen exists, plain text until then.
 * - "Nhận bản tin" has no subscription backend: the field and the button are
 *   drawn and inert (no fake success).
 * - `home` (DM01) puts the form under the columns and draws a smaller
 *   wordmark; `about` (DM02) wraps the tagline, puts the form under it and
 *   adds the contact e-mail, as plain text (contacts are text, no mailto:).
 */
export function PublicFooter({
  variant,
  legal,
}: {
  variant: 'home' | 'about'
  legal: LegalLink[]
}) {
  const explore: Array<{ label: string; href: string | null }> = [
    { label: 'Chương trình', href: PUBLIC_ROUTES.programmes },
    { label: 'Sản phẩm', href: PUBLIC_ROUTES.products },
    { label: 'Nhân tài', href: PUBLIC_ROUTES.talents },
    { label: 'Tin tức', href: PUBLIC_ROUTES.news },
  ]
  const external = [
    { label: 'iHUB Ventures', href: ECOSYSTEM_LINKS.ihubVentures },
    { label: 'VNV', href: ECOSYSTEM_LINKS.vnv },
    { label: '1Hub', href: ECOSYSTEM_LINKS.oneHub },
  ]
  return (
    <footer className={`${styles.footer} ${styles[variant]}`} data-shell="public-footer">
      <div className={styles.grid}>
        <div className={styles.brand}>
          <p className={styles.name}>HUB NETWORK</p>
          <p className={styles.tagline}>
            Mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số.
          </p>
          <div className={styles.form} role="group" aria-label="Nhận bản tin">
            <input
              className={styles.email}
              type="email"
              placeholder="Email của bạn"
              aria-label="Email của bạn"
              disabled
              title={NOT_YET}
            />
            <span className={styles.subscribe} aria-disabled="true" title={NOT_YET}>
              Nhận bản tin
            </span>
          </div>
        </div>
        <ul className={styles.column} role="list">
          <li>
            <PublicAction href={PUBLIC_ROUTES.about} className={styles.link}>
              Giới thiệu
            </PublicAction>
          </li>
          {external.map((item) => (
            <li key={item.label}>
              <PublicAction href={item.href} className={styles.link}>
                {item.label}
                <ArrowUpRight className={styles.external} />
              </PublicAction>
            </li>
          ))}
        </ul>
        <ul className={styles.column} role="list">
          {explore.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <PublicAction href={item.href} className={styles.link}>
                  {item.label}
                </PublicAction>
              ) : (
                <NavText className={styles.link}>{item.label}</NavText>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.wordmark} aria-hidden="true">
        HUB NETWORK
      </p>
      <div className={styles.bottom}>
        <p>
          © 2026 HUB Network
          {variant === 'about' ? (
            <>
              {' · '}
              <span>global@1hub.network</span>
            </>
          ) : null}
        </p>
        <p className={styles.legal}>
          {legal.map((l, i) => (
            <span key={l.href}>
              {i > 0 ? ' · ' : null}
              <a href={l.href}>{l.label}</a>
            </span>
          ))}
        </p>
      </div>
    </footer>
  )
}
