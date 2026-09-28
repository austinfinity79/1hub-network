import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'
import type { StartupDirectory } from '@/lib/library/startup-adapter'

import { Cta } from '../landing/landing-parts'
import { LibraryBrowser } from './library-client'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — the public Library, `/library`, for every
 * visitor (DEC-L15-D1). Reference: "L15 · DIR1 · Thư viện" (1440 × 2470),
 * rebuilt as HTML/CSS; the reference PNG stays a QA source.
 *
 * "Bài toán" runs on a labelled DEMO FIXTURE (DEC-L15-D2); "Startup" and "Nhà
 * sáng lập" show the public startup.json directory read by the server
 * (DEC-L15-D7). No API or database of ours is read beyond the visitor's own
 * entry point. Destinations outside the preview are inert with a reason
 * (`Cta`, DEC-P0-SHELL-D2).
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

export function Library({
  entry,
  directory,
}: {
  entry: LandingEntry
  directory: StartupDirectory
}) {
  return (
    <div className={styles.page} data-screen="PUBLIC-LIBRARY" data-entry={entry.kind}>
      <LibraryBrowser header={<LibraryHeader entry={entry} />} directory={directory} />
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
