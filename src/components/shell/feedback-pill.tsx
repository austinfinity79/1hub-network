import { Inert } from '@/components/onboarding/inert'

import styles from './feedback-pill.module.css'

/**
 * "Góp ý", the pill every frame of the L2 board draws at the lower right
 * (BA row 93). No feedback endpoint is approved for this build, so it is drawn
 * and inert with its reason (PO answer D-F1, DEC-L2R-D11).
 */
export function FeedbackPill() {
  return (
    <div className={styles.feedback} data-anchor="feedback">
      <Inert reason="NO_P0_SCREEN" label="Góp ý" className={styles.pill}>
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        Góp ý
      </Inert>
    </div>
  )
}
