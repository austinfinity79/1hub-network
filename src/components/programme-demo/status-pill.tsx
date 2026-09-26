import { STATUS_LABEL } from '@/lib/programme-demo/copy'
import { EVENT_STATUS_LABEL } from '@/lib/programme-demo/event-time'
import type { ProgrammeDemoStatus } from '@/lib/programme-demo/types'

import styles from './status-pill.module.css'

function Pill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`weight-medium ${styles.pill}`} data-status={status}>
      {label}
    </span>
  )
}

/** WF04 — the demo lifecycle state as an ADM5 pill (shared by the list and later screens). */
export function ProgrammeStatusPill({ status }: { status: ProgrammeDemoStatus }) {
  return <Pill status={status} label={STATUS_LABEL[status]} />
}

/** WF04-S04 — a canonical Event state, with the WF03-S07 wording. */
export function EventStatusPill({ status }: { status: string }) {
  return <Pill status={status} label={EVENT_STATUS_LABEL[status] ?? status} />
}
