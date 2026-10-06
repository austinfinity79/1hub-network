/**
 * US-01.07 location (FB-06, FB-07; S1-UAT-03, DEC-S1O) — the one rule every
 * form that edits a member's location follows (onboarding stage 1, the /me
 * dialog, the profile editor). Pure: no I/O, safe in client components.
 *
 * Quốc gia/Khu vực: the ten COUNTRY items of the canonical catalogue
 * (db/seed/catalog_sprint1.sql, Appendix E) plus "Khác", which asks for the
 * country's name. Tỉnh/Thành phố: for Việt Nam the REGION list (four pinned,
 * then A–Z) plus "Khác", which asks for the place's name; for any other
 * country a free-text place name. Typed names are at most 60 characters and
 * are stored as UNNORMALIZED vocabulary items, as FB-09 stores typed tags
 * (`resolveTags`). Changing the country clears the province.
 */

/** The catalogue slug of Việt Nam (migration 010, catalog_sprint1.sql). */
export const VIETNAM_SLUG = 'vn'

/** FB-07: a typed place name is at most 60 characters; the country name likewise. */
export const LOCATION_TEXT_MAX = 60

/** The value of the "Khác" choice in both selects; never a vocabulary id. */
export const OTHER = 'OTHER'

export const OTHER_LABEL = 'Khác'

/** A choice; `vietnam` marks Việt Nam, the one country with a province list. */
export type LocationOption = { id: string; label: string; vietnam?: boolean }

type StoredRef = { id: string; label: string; status?: string } | null

export type LocationValue = {
  /** A COUNTRY id, OTHER, or '' (not chosen). */
  country: string
  /** The typed country name when `country` is OTHER. */
  countryText: string
  /** For Việt Nam: a REGION id, OTHER, or ''. Unused for other countries. */
  region: string
  /** The typed place name: Việt Nam + "Khác", or any other country. */
  regionText: string
}

export const LOCATION_MESSAGES = {
  country: 'Vui lòng chọn quốc gia hoặc khu vực.',
  countryText: 'Vui lòng nhập tên quốc gia.',
  region: 'Vui lòng chọn tỉnh/thành phố.',
  regionText: 'Vui lòng nhập tên địa phương.',
  tooLong: `Tối đa ${LOCATION_TEXT_MAX} ký tự.`,
} as const

const isListed = (options: LocationOption[], ref: StoredRef) =>
  Boolean(ref && options.some((o) => o.id === ref.id))

/** Whether the chosen country is Việt Nam (the only one with a province list). */
export function isVietnam(value: LocationValue, countries: LocationOption[]): boolean {
  return countries.find((c) => c.id === value.country)?.vietnam === true
}

/**
 * The form state for a stored location. A stored item that is not in the
 * offered list (a typed, UNNORMALIZED name) shows as "Khác" + its text.
 */
export function initialLocation(
  stored: { country: StoredRef; region: StoredRef },
  countries: LocationOption[],
  regions: LocationOption[],
): LocationValue {
  const { country, region } = stored
  const value: LocationValue = {
    country: !country ? '' : isListed(countries, country) ? country.id : OTHER,
    countryText: country && !isListed(countries, country) ? country.label : '',
    region: '',
    regionText: '',
  }
  if (!region) return value
  if (isVietnam(value, countries)) {
    if (isListed(regions, region)) value.region = region.id
    else {
      value.region = OTHER
      value.regionText = region.label
    }
  } else {
    value.regionText = region.label
  }
  return value
}

/** US-01.07 "Đổi Quốc gia/Khu vực → Tỉnh/Thành phố đã chọn hoặc đã gõ bị xóa". */
export function withCountry(value: LocationValue, country: string): LocationValue {
  if (country === value.country) return value
  return {
    country,
    countryText: country === OTHER ? value.countryText : '',
    region: '',
    regionText: '',
  }
}

/** Missing or over-long parts, keyed by the part that shows the message. */
export function locationErrors(
  value: LocationValue,
  countries: LocationOption[],
): Partial<Record<'country' | 'region', string>> {
  const errors: Partial<Record<'country' | 'region', string>> = {}
  const countryText = value.countryText.trim()
  if (!value.country) errors.country = LOCATION_MESSAGES.country
  else if (value.country === OTHER && !countryText) errors.country = LOCATION_MESSAGES.countryText
  else if (value.country === OTHER && countryText.length > LOCATION_TEXT_MAX)
    errors.country = LOCATION_MESSAGES.tooLong

  const regionText = value.regionText.trim()
  const typed = !isVietnam(value, countries) || value.region === OTHER
  // With no country the province is locked, and still required.
  if (!value.country) errors.region = LOCATION_MESSAGES.region
  else if (isVietnam(value, countries) && !value.region) errors.region = LOCATION_MESSAGES.region
  else if (typed && !regionText) errors.region = LOCATION_MESSAGES.regionText
  else if (typed && regionText.length > LOCATION_TEXT_MAX) errors.region = LOCATION_MESSAGES.tooLong
  return errors
}

/**
 * The PATCH /me/profile fields for a location: an id for a listed choice, the
 * typed text otherwise (`country`, `locality`). An unfinished part is sent as
 * null, so "Lưu và hoàn tất sau" keeps what is complete.
 */
export function locationBody(
  value: LocationValue,
  countries: LocationOption[],
): Record<string, string | null> {
  const body: Record<string, string | null> = {}
  const countryText = value.countryText.trim()
  if (value.country === OTHER) {
    if (countryText) body.country = countryText
    else body.country_id = null
  } else {
    body.country_id = value.country || null
  }
  const regionText = value.regionText.trim()
  const typed = !isVietnam(value, countries) || value.region === OTHER
  if (value.country && typed) {
    if (regionText) body.locality = regionText
    else body.region_id = null
  } else {
    body.region_id = value.region && value.region !== OTHER ? value.region : null
  }
  return body
}

/** "Jurong, Singapore": the place, then the country, as the review shows it. */
export function locationLabel(stored: { country: StoredRef; region: StoredRef }): string | null {
  return [stored.region?.label, stored.country?.label].filter(Boolean).join(', ') || null
}
