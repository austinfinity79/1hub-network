'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Arrow } from './landing-parts'
import styles from './activities.module.css'

/**
 * Horizontal card rail of the homepage: drag, swipe or use the two buttons.
 * `rest` is the share of the rule the reference draws filled before any
 * scrolling; the fill grows from there to the full rule at the end.
 */
export function Rail({
  label,
  rest,
  children,
}: {
  label: string
  rest: number
  children: ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ ratio: 0, canPrev: false, canNext: true })

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setState({
      ratio: max > 0 ? Math.min(1, el.scrollLeft / max) : 1,
      canPrev: el.scrollLeft > 4,
      canNext: el.scrollLeft < max - 4,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = track.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  // Mouse drag to scroll (touch and trackpads scroll natively).
  useEffect(() => {
    const el = track.current
    if (!el) return
    let startX = 0
    let startLeft = 0
    let dragging = false
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      dragging = true
      startX = e.clientX
      startLeft = el.scrollLeft
    }
    const move = (e: PointerEvent) => {
      if (dragging) el.scrollLeft = startLeft - (e.clientX - startX)
    }
    const up = () => {
      dragging = false
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const step = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector('li')
    const width = card ? card.getBoundingClientRect().width + 24 : 504
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * width, behavior: calm ? 'auto' : 'smooth' })
  }

  return (
    <>
      <div
        className={styles.track}
        ref={track}
        onScroll={measure}
        tabIndex={0}
        role="group"
        aria-label={label}
      >
        <ul className={styles.row}>{children}</ul>
      </div>
      <div className={styles.foot}>
        <span className={styles.hint}>KÉO HOẶC VUỐT ĐỂ XEM THÊM</span>
        <span className={styles.rule} aria-hidden="true">
          <span style={{ transform: `scaleX(${rest + (1 - rest) * state.ratio})` }} />
        </span>
        <button
          type="button"
          className={styles.railButton}
          onClick={() => step(-1)}
          disabled={!state.canPrev}
          aria-label={`${label} — trước`}
        >
          <Arrow className={styles.flip} />
        </button>
        <button
          type="button"
          className={styles.railButton}
          onClick={() => step(1)}
          disabled={!state.canNext}
          aria-label={`${label} — tiếp theo`}
        >
          <Arrow />
        </button>
      </div>
    </>
  )
}
