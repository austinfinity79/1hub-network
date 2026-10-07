import { fold } from '@/lib/library/startup-adapter'

/**
 * THAO-05 — the shared discovery contract of the public directories
 * (DEC-THAO-DIR): `/programmes`, `/problems`, `/products`, `/talents`.
 *
 * Pure and client-safe. Every directory receives its rows already projected
 * by the server (the visibility boundary); this module only reads and writes
 * the address and matches rows against it, so a view can be refreshed,
 * shared and navigated back to. Location follows DEC-THAO-DIR-D6:
 * `?quoc-gia=<COUNTRY slug>&tinh=<REGION slug>`, canonical vocabulary only.
 */

export type SearchParams = Record<string, string | string[] | undefined>

export const PARAM = { q: 'q', country: 'quoc-gia', region: 'tinh', sort: 'sap-xep' } as const

/** Every value of a repeated parameter, in the order given. */
export const many = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v : v ? [v] : []

/** The first value of a parameter, trimmed; `max` caps free text. */
export const one = (v: string | string[] | undefined, max = 120): string =>
  (many(v)[0] ?? '').trim().slice(0, max)

/** Accent- and case-insensitive search key (the Library's `fold`). */
export const searchKey = fold

/** Every word of `q` must appear in `text` (already folded). */
export function matchesQuery(text: string, q: string): boolean {
  return searchKey(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => text.includes(t))
}

export type Country = { slug: string; label: string }
export type Region = { slug: string; label: string; country: string }
export type Places = { countries: Country[]; regions: Region[] }

/**
 * The location a view asks for. `invalid` marks a slug that is not in the
 * catalogue or a region outside the chosen country: the directory then shows
 * its controlled empty state, never a guess.
 */
export type Location = { country: string | null; region: string | null; invalid: boolean }

export const NO_LOCATION: Location = { country: null, region: null, invalid: false }

export function readLocation(params: SearchParams, places: Places): Location {
  const country = one(params[PARAM.country], 60) || null
  const rawRegion = one(params[PARAM.region], 60) || null
  if (!country && !rawRegion) return NO_LOCATION
  // DEMO-DIR2-01 wrote the province label (`?tinh=Đồng Tháp`); it is read once
  // and the address is rewritten with the slug.
  const region = rawRegion
    ? (places.regions.find((r) => r.slug === rawRegion || r.label === rawRegion) ?? null)
    : null
  const knownCountry = country ? places.countries.some((c) => c.slug === country) : true
  if (!knownCountry || (rawRegion && !region)) {
    return { country, region: rawRegion, invalid: true }
  }
  if (region && country && region.country !== country) {
    return { country, region: region.slug, invalid: true }
  }
  // `tinh` alone implies its country.
  return {
    country: country ?? region?.country ?? null,
    region: region?.slug ?? null,
    invalid: false,
  }
}

/** True when a row placed at (country, region) passes the location filter. */
export function matchesLocation(
  loc: Location,
  row: { country: string | null; region: string | null },
): boolean {
  if (loc.invalid) return false
  if (loc.country && row.country !== loc.country) return false
  if (loc.region && row.region !== loc.region) return false
  return true
}

/** Appends the location parameters, country first (deterministic order). */
export function writeLocation(params: URLSearchParams, loc: Location): void {
  if (loc.country) params.set(PARAM.country, loc.country)
  if (loc.region) params.set(PARAM.region, loc.region)
}

/** `base?query`, or `base` alone when nothing is set. */
export function href(base: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${base}?${query}` : base
}
