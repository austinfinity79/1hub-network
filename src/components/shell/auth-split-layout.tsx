import type { ReactNode } from 'react'

import styles from './auth-split-layout.module.css'
import { HomeLink } from '@/components/shell/home-link'

/**
 * Brand panel plus content column for the auth screens AUTH1 (/auth) and
 * AUTH2 (/auth/check-email). TASK 22.2 follows the corrected L1 reference
 * (design-reference/final/revision/L1): wordmark and one headline; the
 * previous panel's figures and footnotes are gone with the revision. Static by
 * contract (WF01-S01 reads no data).
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-shell="auth-split">
      <aside className={styles.brand} aria-label="HUB NETWORK">
        <p className={styles.wordmark}>
          <HomeLink>HUB NETWORK</HomeLink>
        </p>
        <p className={styles.headline}>
          <span>Đồng hành cùng</span>
          <span>cộng đồng đổi mới sáng</span>
          <span>tạo Việt Nam</span>
        </p>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  )
}
