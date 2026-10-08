'use client'

import { useEffect, useState } from 'react'

import {
  NO_LOCATION,
  href,
  type Location,
  type Places,
  type SearchParams,
} from '@/lib/public/discovery-query'
import { paramsOf } from '@/lib/public/discovery-views'

import styles from './discovery.module.css'

/**
 * THAO-05 — the parts every public directory shares (DEC-THAO-DIR): filter
 * checkboxes, the Khu vực group, the "Đang lọc" bar, sort, empty state and
 * "Xem thêm". Markup and classes are DM08's (DEMO-DIR2-01), so `/products`
 * renders exactly as before and the other directories follow the same frames.
 * They only present state; the rows were projected by the server.
 */

const VIETNAM = 'vn'

/**
 * Writes the view to the address without a new history entry, a scroll jump
 * or a server round trip: the list is already on the page, so only the
 * address follows it (Next keeps its router in step with `history`). A
 * refresh or a shared link reads the same parameters on the server.
 */
export function useAddress(base: string): (params: URLSearchParams) => void {
  return (params) => window.history.replaceState(null, '', href(base, params))
}

/**
 * On arrival, applies the view the address names when it differs from the
 * server's first render: Back returns to an address this view wrote with
 * `useAddress`, while Next may restore the page it first rendered.
 */
export function useAddressView<V>(
  initial: V,
  read: (params: SearchParams) => V,
  apply: (view: V) => void,
): void {
  useEffect(() => {
    const view = read(paramsOf(window.location.search))
    if (JSON.stringify(view) !== JSON.stringify(initial)) apply(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [])
}

export function Check({ on }: { on: boolean }) {
  return <span className={`${styles.box} ${on ? styles.boxOn : ''}`} aria-hidden="true" />
}

export function CheckOption({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className={styles.option}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <Check on={checked} />
      <span className={styles.optionLabel}>{label}</span>
      <span className={styles.optionCount}>{count}</span>
    </label>
  )
}

/** Where a row sits, by canonical slugs (null when unknown). */
export type Placed = { country: string | null; region: string | null }

/**
 * DM08 "KHU VỰC": Việt Nam with its tỉnh / thành, Quốc tế with its country
 * (DEC-THAO-DIR-D6). Ticking Quốc tế opens the country list; the filter applies
 * once a country is chosen, so the address always names a real country.
 */
export function LocationGroup({
  places,
  rows,
  value,
  onChange,
}: {
  places: Places
  rows: Placed[]
  value: Location
  onChange: (next: Location) => void
}) {
  const vietnam = value.country === VIETNAM && !value.invalid
  const [abroad, setAbroad] = useState(Boolean(value.country && value.country !== VIETNAM))
  const domestic = places.regions.filter((r) => r.country === VIETNAM)
  const foreign = places.countries.filter((c) => c.slug !== VIETNAM)
  const vnLabel = places.countries.find((c) => c.slug === VIETNAM)?.label ?? 'Việt Nam'
  return (
    <fieldset className={styles.group}>
      <legend>KHU VỰC</legend>
      <CheckOption
        label={vnLabel}
        count={rows.filter((r) => r.country === VIETNAM).length}
        checked={vietnam}
        onChange={() => {
          setAbroad(false)
          onChange(vietnam ? NO_LOCATION : { country: VIETNAM, region: null, invalid: false })
        }}
      />
      <label className={styles.select}>
        <span>Tỉnh/thành:</span>
        <select
          value={vietnam ? (value.region ?? '') : ''}
          disabled={!vietnam}
          onChange={(e) =>
            onChange({ country: VIETNAM, region: e.target.value || null, invalid: false })
          }
        >
          <option value="">Tất cả</option>
          {domestic.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <CheckOption
        label="Quốc tế"
        count={rows.filter((r) => r.country !== null && r.country !== VIETNAM).length}
        checked={abroad}
        onChange={() => {
          const next = !abroad
          setAbroad(next)
          if (next ? vietnam : value.country && value.country !== VIETNAM) onChange(NO_LOCATION)
        }}
      />
      <label className={styles.select}>
        <span>Quốc gia:</span>
        <select
          value={abroad && value.country !== VIETNAM ? (value.country ?? '') : ''}
          disabled={!abroad}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { country: e.target.value, region: null, invalid: false }
                : NO_LOCATION,
            )
          }
        >
          <option value="">Tất cả</option>
          {foreign.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

/** The label of the chosen place for the "Đang lọc" bar, or null when none. */
export function locationLabel(places: Places, loc: Location): string | null {
  if (loc.invalid) return 'Khu vực không hợp lệ'
  if (loc.region) return places.regions.find((r) => r.slug === loc.region)?.label ?? null
  if (loc.country) return places.countries.find((c) => c.slug === loc.country)?.label ?? null
  return null
}

export type ActiveFilter = { key: string; label: string; remove: () => void }

export function ActiveFilters({ items, onClear }: { items: ActiveFilter[]; onClear: () => void }) {
  return (
    <div className={styles.active} aria-live="polite">
      <span>Đang lọc:</span>
      {items.length ? (
        <>
          {items.map((a) => (
            <button
              key={a.key}
              type="button"
              className={styles.activeChip}
              onClick={a.remove}
              aria-label={`Bỏ lọc ${a.label}`}
            >
              {a.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className={styles.clear} onClick={onClear}>
            Xoá tất cả
          </button>
        </>
      ) : (
        <span className={styles.none}>không có</span>
      )}
    </div>
  )
}

export function SortSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: ReadonlyArray<{ key: T; label: string }>
  onChange: (next: T) => void
}) {
  return (
    <label className={styles.sort}>
      Sắp xếp:
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function EmptyState({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <div className={styles.empty} data-state="empty">
      <p>{text}</p>
      <button type="button" className={styles.clear} onClick={onClear}>
        Xoá tất cả bộ lọc
      </button>
    </div>
  )
}

export function MoreButton({
  hidden,
  noun,
  onMore,
  label,
}: {
  hidden: number
  noun: string
  onMore: () => void
  /** A fixed label in place of "Xem thêm {n} {noun}" (S2-COPY-QUICKFIX-01: /products). */
  label?: string
}) {
  return hidden > 0 ? (
    <button type="button" className={styles.more} onClick={onMore}>
      {label ?? `Xem thêm ${hidden} ${noun}`}
    </button>
  ) : null
}
