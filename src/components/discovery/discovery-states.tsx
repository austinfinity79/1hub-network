import { PageSkeleton } from '@/components/public-shell/page-skeleton'

import styles from './discovery.module.css'

/**
 * THAO-05 — server-rendered states shared by the public directories:
 * the route's loading view and the error view with a retry. "Thử lại" is a
 * plain link to the same address (works without JavaScript); the page never
 * answers 5xx for a failed read.
 */

/** PAGE-TRANSITION-SKELETON-01: the shared directory skeleton (hero, rail, cards). */
export function DiscoveryLoading({ eyebrow }: { eyebrow: string }) {
  return <PageSkeleton kind="directory" eyebrow={eyebrow} />
}

export function DiscoveryError({ noun, retryHref }: { noun: string; retryHref: string }) {
  return (
    <div className={styles.empty} data-state="error" role="alert">
      <p>Chưa tải được danh sách {noun}. Vui lòng thử lại.</p>
      <a href={retryHref} className={styles.clear}>
        Thử lại
      </a>
    </div>
  )
}
