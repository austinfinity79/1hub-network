import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'
import type { LibraryInitial } from '@/lib/library/library-bodies'

import { Cta, NavLabel } from '../landing/landing-parts'
import { LibraryBrowser } from './library-client'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — the public Library, `/library`, for every
 * visitor (DEC-L15-D1). Reference: "L15 · DIR1 · Thư viện" (1440 × 2470),
 * rebuilt as HTML/CSS; the reference PNG stays a QA source.
 *
 * WF06-PROD-04: every tab shows its Library API (API §25, DEC-W6P): "Bài toán"
 * the supplied problem file, "Startup" the published canonical startups plus
 * the remaining external directory records, "Nhà sáng lập" the visible owners
 * of those startups, for signed-in members only. No data source is named on the
 * page. Header items with no destination are plain labels, and a card action
 * with no destination is not drawn (PO decisions, Alpha interaction gap fix
 * 30/09); "Góp ý" is hidden for Alpha. `?q=` from the homepage search opens the
 * page with that keyword applied.
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
        <NavLabel>Chương trình</NavLabel>
        <NavLabel>Sự kiện</NavLabel>
        <NavLabel>Tin tức</NavLabel>
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

export function Library({ entry, initial }: { entry: LandingEntry; initial: LibraryInitial }) {
  return (
    <div className={styles.page} data-screen="PUBLIC-LIBRARY" data-entry={entry.kind}>
      <LibraryBrowser
        header={<LibraryHeader entry={entry} />}
        initial={initial}
        signInHref={entry.kind === 'GUEST' ? entry.href : '/auth'}
      />
    </div>
  )
}
