'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { PageSkeleton, type SkeletonKind } from './page-skeleton'
import styles from './page-skeleton.module.css'

/**
 * PAGE-TRANSITION-SKELETON-01 — the skeleton of the primary routes that cannot
 * use a route `loading.tsx`: a loading boundary streams a 200 before the page
 * runs, so `notFound()` (hidden startups, NETWORK_ONLY founders for a guest)
 * would no longer answer 404, and the homepage hero preload would leave
 * <head>. Here the skeleton exists only on the client, during a client
 * navigation: a same-origin link click towards one of these routes shows it
 * over the page until the address changes. Server responses, status codes,
 * direct loads, reloads and Back / Forward are untouched. The directories keep
 * their route `loading.tsx` (DiscoveryLoading), so nothing loads twice.
 */

export function skeletonFor(pathname: string): SkeletonKind | null {
  if (pathname === '/') return 'home'
  if (pathname === '/about') return 'about'
  if (/^\/products\/[^/]+(\/(metrics|updates))?$/.test(pathname)) return 'startup'
  if (/^\/talents\/[^/]+$/.test(pathname)) return 'founder'
  return null
}

/** The startup a path belongs to: its tabs are a local switch, not a page change. */
const startupOf = (pathname: string) => /^\/products\/([^/]+)/.exec(pathname)?.[1] ?? null

/** A navigation that never lands (network error) does not keep the skeleton. */
const GIVE_UP_MS = 10_000

export function RouteSkeleton() {
  const pathname = usePathname()
  const [kind, setKind] = useState<SkeletonKind | null>(null)

  // Arrival (or any address change) ends the skeleton.
  useEffect(() => setKind(null), [pathname])

  useEffect(() => {
    // Capture phase: next/link prevents the default in its own handler.
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]')
      if (!(a instanceof HTMLAnchorElement)) return
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      const here = startupOf(window.location.pathname)
      if (here && here === startupOf(url.pathname)) return
      const next = skeletonFor(url.pathname)
      if (next) setKind(next)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    if (!kind) return
    const timer = window.setTimeout(() => setKind(null), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [kind])

  if (!kind) return null
  return (
    <div className={styles.overlay}>
      <PageSkeleton kind={kind} />
    </div>
  )
}
