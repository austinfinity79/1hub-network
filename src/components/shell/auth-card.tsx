import type { ReactNode } from 'react'

import { Surface } from '@/components/ui'

import styles from './auth-card.module.css'

/** Card used by the auth screens (WF01-S01, WF01-S02); see the stylesheet for evidence. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.card}>
      <Surface as="section">{children}</Surface>
    </div>
  )
}
