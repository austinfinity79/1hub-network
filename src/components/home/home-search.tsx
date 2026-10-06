'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { libraryHref } from '@/lib/library/query'
import { PUBLIC_ROUTES } from '@/lib/public/routes'

import { NOT_YET } from '@/components/public-shell/public-action'

import styles from './home.module.css'

/**
 * DM01 hero search (Thảo: "chọn phạm vi Tất cả / Chương trình / Sản phẩm /
 * Nhân tài; gợi ý tự chạy trong ô, nhấn Tab để dùng").
 *
 * - Tất cả searches the existing Library (`/library?q=`).
 * - Sản phẩm searches the product directory once it ships, the Library until then.
 * - Chương trình and Nhân tài have no searchable screen yet: drawn, not selectable.
 * - The suggestion types itself into the empty field; Tab on an empty field
 *   takes it, any other Tab moves focus as usual. Reduced motion shows it whole.
 * No search backend, ranking or recommendation is added.
 */

type Scope = 'ALL' | 'PROGRAMMES' | 'PRODUCTS' | 'TALENTS'

const SCOPES: Array<{ key: Scope; label: string; live: boolean }> = [
  { key: 'ALL', label: 'Tất cả', live: true },
  { key: 'PROGRAMMES', label: 'Chương trình', live: false },
  { key: 'PRODUCTS', label: 'Sản phẩm', live: true },
  { key: 'TALENTS', label: 'Nhân tài', live: false },
]

function hrefFor(scope: Scope, keyword: string): string | null {
  const q = keyword.trim()
  if (!q) return null
  if (scope === 'PRODUCTS' && PUBLIC_ROUTES.products)
    return `${PUBLIC_ROUTES.products}?q=${encodeURIComponent(q.slice(0, 120))}`
  return libraryHref(q)
}

export function HomeSearch({ suggestions }: { suggestions: readonly string[] }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [scope, setScope] = useState<Scope>('ALL')
  const [value, setValue] = useState('')
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(suggestions[0] ?? '')
  const suggestion = suggestions[index] ?? ''

  useEffect(() => {
    if (value || suggestions.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(suggestion)
      return
    }
    let n = 0
    setTyped('')
    const timer = window.setInterval(() => {
      n += 1
      setTyped(suggestion.slice(0, n))
      if (n >= suggestion.length + 24) {
        window.clearInterval(timer)
        setIndex((i) => (i + 1) % suggestions.length)
      }
    }, 70)
    return () => window.clearInterval(timer)
  }, [suggestion, suggestions.length, value])

  function submit(e: FormEvent) {
    e.preventDefault()
    const href = hrefFor(scope, input.current?.value ?? '')
    if (!href) {
      input.current?.focus()
      return
    }
    router.push(href)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && !e.shiftKey && !value && suggestion) {
      e.preventDefault()
      setValue(suggestion)
    }
  }

  return (
    <form className={styles.search} role="search" onSubmit={submit} data-search="hero">
      <div className={styles.scopes} role="radiogroup" aria-label="Phạm vi tìm kiếm">
        {SCOPES.map((s) =>
          s.live ? (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={scope === s.key}
              className={`${styles.scope} ${scope === s.key ? styles.scopeOn : ''}`}
              onClick={() => setScope(s.key)}
            >
              {s.label}
            </button>
          ) : (
            <span
              key={s.key}
              className={styles.scope}
              aria-disabled="true"
              title={NOT_YET}
              data-scope-kind="INERT"
            >
              {s.label}
            </span>
          ),
        )}
      </div>
      <input
        ref={input}
        className={styles.searchInput}
        type="search"
        name="q"
        maxLength={120}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder={typed}
        aria-label="Tìm chương trình, sản phẩm, nhân tài"
        autoComplete="off"
      />
      <span className={styles.caret} aria-hidden="true" />
      <button type="submit" className={styles.searchGo} aria-label="Tìm kiếm">
        <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true">
          <path d="M0.5 6h12M7.5 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </form>
  )
}
