import type { ReactNode } from 'react'

import styles from './onboarding-shell.module.css'

/** WF01 onboarding steps shown in the header (S05 Purpose, S06 Profile, S07 Privacy). */
const STEPS = ['Vai trò', 'Thông tin', 'Quyền riêng tư'] as const

type Props = {
  /** 1-based index of the current step. */
  currentStep: 1 | 2 | 3
  /** Right-hand header action; each screen supplies its own. */
  action?: ReactNode
  children: ReactNode
}

/**
 * Header + canvas shared by the onboarding screens (WF01-S05..S08 references
 * share the header band). Built for WF01-S05; the stepper is presentation only
 * and never gates navigation.
 */
export function OnboardingShell({ currentStep, action, children }: Props) {
  return (
    <div className={styles.root} data-shell="onboarding">
      <header className={styles.header}>
        <p className={`type-section-sm ${styles.wordmark}`}>HUB NETWORK</p>
        <ol className={`type-meta-xs ${styles.steps}`} aria-label="Các bước khởi tạo">
          {STEPS.map((label, i) => {
            const current = i + 1 === currentStep
            return (
              <li
                key={label}
                className={`${styles.step} ${current ? `${styles.stepCurrent} weight-medium` : ''}`}
                aria-current={current ? 'step' : undefined}
              >
                <span className={`type-meta-xs weight-semibold ${styles.stepNumber}`}>{i + 1}</span>
                {label}
              </li>
            )
          })}
        </ol>
        <div>{action}</div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
