'use client'

import { useRouter } from 'next/navigation'
import { useRef, type ReactNode } from 'react'

import { LIBRARY_QUERY_MAX, libraryHref } from '@/lib/library/query'

import styles from './landing.module.css'

/**
 * The homepage hero search (PO decision, Alpha interaction gap fix 30/09): a
 * keyword opens the public Library at `/library?q=<keyword>`, where the
 * Library's own search applies it. No global, AI or matching search and no
 * request of its own. An empty keyword navigates nowhere. Without script the
 * form still sends `q` to `/library` by GET.
 */
export function HeroSearch({ arrow }: { arrow: ReactNode }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  return (
    <form
      className={styles.search}
      role="search"
      aria-label="Tìm trong Thư viện"
      action="/library"
      method="get"
      data-cta="hero-search"
      onSubmit={(e) => {
        e.preventDefault()
        const href = libraryHref(input.current?.value ?? '')
        if (!href) {
          input.current?.focus()
          return
        }
        router.push(href)
      }}
    >
      <span className={styles.searchLabel} aria-hidden="true">
        TÌM
      </span>
      <input
        ref={input}
        className={styles.searchInput}
        type="search"
        name="q"
        maxLength={LIBRARY_QUERY_MAX}
        aria-label="Tìm kiếm chương trình, sự kiện"
        placeholder="Tìm kiếm chương trình, sự kiện"
      />
      <button className={styles.searchButton} type="submit" aria-label="Tìm kiếm">
        {arrow}
      </button>
    </form>
  )
}
