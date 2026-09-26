import { STATUS_LABEL } from '@/lib/programme-demo/copy'
import type { ProgrammeDemoStatus } from '@/lib/programme-demo/types'

import styles from './status-pill.module.css'

/** WF04 — the demo lifecycle state as an ADM5 pill (shared by the list and later screens). */
export function ProgrammeStatusPill({ status }: { status: ProgrammeDemoStatus }) {
  return (
    <span className={`weight-medium ${styles.pill}`} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  )
}
