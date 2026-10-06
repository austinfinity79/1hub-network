import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import type { LandingEntry } from '@/lib/landing/entry'
import type { LibraryInitial } from '@/lib/library/library-bodies'
import type { PublicShellData } from '@/lib/public/shell-data'

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
 * page. A card action with no destination is not drawn (PO decisions, Alpha
 * interaction gap fix 30/09); "Góp ý" is hidden for Alpha. `?q=` from the
 * homepage search opens the page with that keyword applied.
 *
 * THAO-01-FIX (DEC-THAO-NAV-D5): the header is the shared public header, as on
 * every public page; the former L15 bar ("Thư viện", Chương trình, Sự kiện,
 * Tin tức) is gone. Its 101 px slot is kept, so the hero below is unchanged.
 * THAO-02: the page ends with the one public footer.
 */

export function Library({
  entry,
  shell,
  initial,
}: {
  entry: LandingEntry
  shell: PublicShellData
  initial: LibraryInitial
}) {
  return (
    <div className={styles.page} data-screen="PUBLIC-LIBRARY" data-entry={entry.kind}>
      <LibraryBrowser
        header={
          <div className={styles.shell}>
            <PublicHeader viewer={shell.viewer} />
          </div>
        }
        initial={initial}
        signInHref={entry.kind === 'GUEST' ? entry.href : '/auth'}
      />
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
