import type { ReactNode } from 'react'

import styles from './editor-header.module.css'

/**
 * Editor header shared by the WF02 editors (S02 profile, S05 venture).
 *
 * Evidence: the approved WF02-S02 and WF02-S05 references draw the same band
 * (84px + 1px rule, title and status on the left, actions right-aligned at
 * y 20–61), so it is shared rather than repeated. Values measured at
 * 1440x900 DPR1 and local to this component.
 */
export function EditorHeader({
  title,
  status,
  actions,
}: {
  title: ReactNode
  status: ReactNode
  actions: ReactNode
}) {
  return (
    <header className={styles.header} data-shell="editor-header">
      <div>
        <p className={`type-body-md weight-medium ${styles.title}`}>{title}</p>
        <p className={`type-meta-xs ${styles.status}`} data-status>
          {status}
        </p>
      </div>
      <div className={styles.actions}>{actions}</div>
    </header>
  )
}
