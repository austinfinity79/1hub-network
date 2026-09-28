import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'

import { Cta } from '../landing/landing-parts'
import { LibraryBrowser } from './library-client'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY — the public Library, `/library`, for every visitor
 * (DEC-L15-D1). Reference: L2-15 Thu vien.zip (Hero 16_9, Thanh tab, Thân,
 * Nút góp ý · nổi), rebuilt as HTML/CSS; the reference PNGs stay QA sources.
 *
 * A static demo surface: the "Bài toán" directory runs on a labelled fixture
 * (DEC-L15-D2), Startup and Nhà sáng lập are "Sắp có" (DEC-L15-D3), and no
 * API or database is read beyond the visitor's own entry point. Destinations
 * outside the preview are inert with a reason (`Cta`, DEC-P0-SHELL-D2).
 */

function entryLabel(entry: LandingEntry): string {
  if (entry.kind === 'GUEST') return 'Đăng nhập'
  return entry.onboarded ? 'Vào tài khoản của tôi' : 'Tiếp tục thiết lập tài khoản'
}

function LibraryHeader({ entry }: { entry: LandingEntry }) {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand} aria-label="HUB NETWORK — trang chủ">
        HUB NETWORK
      </Link>
      <nav className={styles.nav} aria-label="Thư viện">
        <Link href="/library" className={styles.navActive} aria-current="page">
          Thư viện
        </Link>
        <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Chương trình">
          Chương trình
        </Cta>
        <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Sự kiện">
          Sự kiện
        </Cta>
        <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Tin tức">
          Tin tức
        </Cta>
      </nav>
      <div className={styles.barRight}>
        <Cta action={{ inert: 'FUTURE' }} label="VN · EN" className={styles.lang}>
          VN · EN
        </Cta>
        <Link href={entry.href} className={styles.login} data-cta="login">
          {entryLabel(entry)}
        </Link>
      </div>
    </header>
  )
}

export function Library({ entry }: { entry: LandingEntry }) {
  return (
    <div className={styles.page} data-screen="PUBLIC-LIBRARY" data-entry={entry.kind}>
      <LibraryBrowser header={<LibraryHeader entry={entry} />} />
      <div className={styles.feedback} data-anchor="feedback">
        <Cta action={{ inert: 'NO_P0_SCREEN' }} label="Góp ý" className={styles.feedbackPill}>
          <span className={styles.feedbackIcon} aria-hidden="true">
            !
          </span>
          Góp ý
        </Cta>
      </div>
    </div>
  )
}
