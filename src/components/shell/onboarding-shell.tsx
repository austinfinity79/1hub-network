import type { ReactNode } from 'react'

import styles from './onboarding-shell.module.css'

/** WF01 onboarding steps shown in the header (S05 Purpose, S06 Profile, S07 Privacy). */
const STEPS = ['Vai trò', 'Thông tin', 'Quyền riêng tư'] as const

type Props = {
  /** 1-based index of the current step; 4 = onboarding finished, all steps done (WF01-S08). */
  currentStep: 1 | 2 | 3 | 4
  /** Right-hand header action; each screen supplies its own. */
  action?: ReactNode
  children: ReactNode
}

/**
 * Header + canvas shared by the onboarding screens (WF01-S05..S08 references
 * share the header band). Built for WF01-S05; the stepper is presentation only
 * and never gates navigation. Steps before the current one show as done
 * (WF01-S06..S08 references: dark disc with a check).
 */
export function OnboardingShell({ currentStep, action, children }: Props) {
  return (
    <div className={styles.root} data-shell="onboarding">
      <header className={styles.header}>
        <p className={`type-section-sm ${styles.wordmark}`}>HUB NETWORK</p>
        <ol className={`type-meta-xs ${styles.steps}`} aria-label="Các bước khởi tạo">
          {STEPS.map((label, i) => {
            const current = i + 1 === currentStep
            const done = i + 1 < currentStep
            return (
              <li
                key={label}
                className={`${styles.step} ${current ? `${styles.stepCurrent} weight-medium` : ''} ${done ? styles.stepDone : ''}`}
                aria-current={current ? 'step' : undefined}
              >
                <span className={`type-meta-xs weight-semibold ${styles.stepNumber}`}>
                  {done ? (
                    // Deterministic inline SVG, not a font glyph (DEC-WF01-S03-ICON).
                    <svg viewBox="0 0 22 22" aria-hidden="true" focusable="false">
                      <path d="M6.5 11.5l3 3 6-6.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {done ? <span className={styles.srOnly}>Đã xong: </span> : null}
                {label}
              </li>
            )
          })}
        </ol>
        <div className={styles.action}>{action}</div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
