import Link from 'next/link'
import type { ReactNode } from 'react'

import styles from './editor-header.module.css'

/**
 * Editor header shared by the WF02 editors (S02 profile, S05 venture) and the
 * S06 team page. S06 draws the same band 2px shorter (82px + rule), passed in
 * as `className` by that screen.
 *
 * Evidence: the approved WF02-S02 and WF02-S05 references draw the same band
 * (84px + 1px rule, title and status on the left, actions right-aligned at
 * y 20–61), so it is shared rather than repeated. Values measured at
 * 1440x900 DPR1 and local to this component.
 *
 * P0-SHELL (DEC-P0-SHELL-D4): the editors render outside the member shell, so
 * the header carries a way back ("← Tài khoản của tôi" by default) at the
 * start of the actions group; the title block does not move.
 */
const BACK = { href: '/me', label: 'Tài khoản của tôi' } as const
export function EditorHeader({
  title,
  status,
  actions,
  className,
  back = BACK,
}: {
  title: ReactNode
  status: ReactNode
  actions: ReactNode
  className?: string
  back?: { href: string; label: string }
}) {
  return (
    <header
      className={className ? `${styles.header} ${className}` : styles.header}
      data-shell="editor-header"
    >
      <div>
        <p className={`type-body-md weight-medium ${styles.title}`}>{title}</p>
        <p className={`type-meta-xs ${styles.status}`} data-status>
          {status}
        </p>
      </div>
      <div className={styles.actions}>
        <Link href={back.href} className={`type-body-sm ${styles.back}`} data-nav="editor-back">
          ← {back.label}
        </Link>
        {actions}
      </div>
    </header>
  )
}
