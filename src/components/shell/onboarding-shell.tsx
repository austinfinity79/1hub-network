import type { ReactNode } from 'react'

import { HomeLink } from '@/components/shell/home-link'

import styles from './onboarding-shell.module.css'

/** The four stages of the onboarding flow (BA workbook row 56), in order. */
const STAGES = 4

type Props = {
  /** 0 = the intro (ACC-05, no progress), 1–4 = the current stage, 5 = all done (ACC-10). */
  stage: 0 | 1 | 2 | 3 | 4 | 5
  /** Mono caption above the bars, e.g. "BƯỚC 1/4 · THÔNG TIN CƠ BẢN". */
  caption?: string
  /** Right-hand header action; each screen supplies its own. */
  action?: ReactNode
  children: ReactNode
}

/**
 * Header + canvas shared by the onboarding screens ACC-05 … ACC-10 of the L1
 * board (DEC-L1R-D7): wordmark, a caption over four progress bars, and one
 * action. The bars are presentation only and never gate navigation; the page
 * guards do. "Góp ý" is hidden for Alpha (PO decision 30/09; no feedback channel).
 */
export function OnboardingShell({ stage, caption, action, children }: Props) {
  return (
    <div className={styles.root} data-shell="onboarding">
      <header className={styles.header} data-intro={stage === 0 ? 'true' : undefined}>
        <p className={styles.wordmark}>
          <HomeLink>HUB NETWORK</HomeLink>
        </p>
        {stage > 0 ? (
          <div className={styles.progress}>
            <p className={styles.caption}>{caption}</p>
            <ol
              className={styles.bars}
              aria-label={stage > STAGES ? 'Đã xong cả 4 bước' : `Bước ${stage} trong ${STAGES}`}
            >
              {Array.from({ length: STAGES }, (_, i) => {
                const state = i + 1 < stage ? 'done' : i + 1 === stage ? 'current' : 'todo'
                return (
                  <li
                    key={i}
                    className={styles.bar}
                    data-state={state}
                    aria-current={state === 'current' ? 'step' : undefined}
                  />
                )
              })}
            </ol>
          </div>
        ) : null}
        <div className={styles.action}>{action}</div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
