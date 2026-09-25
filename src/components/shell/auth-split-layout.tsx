import type { ReactNode } from 'react'

import styles from './auth-split-layout.module.css'

/**
 * WF01-S01 — brand panel plus content column for the auth screens.
 *
 * Built for WF01-S01; WF01-S02's approved baseline shows the identical panel,
 * so it is shared rather than screen-local. Copy is the approved baseline text,
 * verbatim. It is static by contract: WF01-S01 reads no data (Screen Contract
 * `reads: []`), so the figures are presentation copy, not live counts.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-shell="auth-split">
      <aside className={styles.brand} aria-label="HUB NETWORK">
        <p className={`type-subtitle ${styles.wordmark}`}>HUB NETWORK</p>

        <div className={styles.pitch}>
          <p className={`type-display ${styles.headline}`}>
            <span>Bài toán thật</span>
            <span>từ đơn vị đang trả tiền</span>
            <span>để giải nó</span>
          </p>
          {/* Line breaks are part of the approved composition, as in the headline. */}
          <p className={`type-body-sm ${styles.muted} ${styles.pitchNote}`}>
            <span>12 bài toán đang mở · 9 doanh nghiệp và 3 sở ngành ·</span>
            <span>1,4 tỷ ngân sách thử nghiệm</span>
          </p>
        </div>

        <div className={`type-meta-xs ${styles.muted} ${styles.footnote}`}>
          <p>Không đăng nhập vẫn đọc được toàn bộ đề bài.</p>
          <p>Đăng nhập để nộp giải pháp, xem hồ sơ startup và dự sự kiện.</p>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  )
}
