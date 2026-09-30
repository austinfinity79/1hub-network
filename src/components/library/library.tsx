import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'
import type { LibraryProblem } from '@/lib/library/problem-adapter'
import type { StartupDirectory } from '@/lib/library/startup-adapter'

import { Cta, NavLabel } from '../landing/landing-parts'
import { LibraryBrowser } from './library-client'
import styles from './library.module.css'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — the public Library, `/library`, for every
 * visitor (DEC-L15-D1). Reference: "L15 · DIR1 · Thư viện" (1440 × 2470),
 * rebuilt as HTML/CSS; the reference PNG stays a QA source.
 *
 * "Bài toán" shows the supplied problem dataset (LIBRARY DATA UPDATE, replacing
 * the DEC-L15-D2 demo fixture); "Startup" and "Nhà sáng lập" show the public
 * startup.json directory read by the server (DEC-L15-D7). No data source is
 * named on the page. No API or database of ours is read beyond the visitor's
 * own entry point. Header items with no destination are plain labels, and a
 * card action with no destination is not drawn (PO decisions, Alpha
 * interaction gap fix 30/09); "Góp ý" is hidden for Alpha. `?q=` from the
 * homepage search opens the page with that keyword applied.
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

export function Library({
  entry,
  problems,
  directory,
  query = '',
}: {
  entry: LandingEntry
  problems: LibraryProblem[]
  directory: StartupDirectory
  /** The keyword the page opens with (`?q=`, homepage search); empty for none. */
  query?: string
}) {
  return (
    <div className={styles.page} data-screen="PUBLIC-LIBRARY" data-entry={entry.kind}>
      <LibraryBrowser
        header={<LibraryHeader entry={entry} />}
        problems={problems}
        directory={directory}
        initialQuery={query}
      />
    </div>
  )
}
