import { describe, expect, it } from 'vitest'

import {
  initialLocation,
  LOCATION_MESSAGES,
  locationBody,
  locationErrors,
  locationLabel,
  OTHER,
  withCountry,
  type LocationValue,
} from './location'

/** US-01.07 (S1-UAT-03): the location rule every location form follows. */

const COUNTRIES = [
  { id: 'vn', label: 'Việt Nam', vietnam: true },
  { id: 'sg', label: 'Singapore' },
]
const REGIONS = [{ id: 'hn', label: 'TP. Hà Nội' }]

const value = (over: Partial<LocationValue>): LocationValue => ({
  country: '',
  countryText: '',
  region: '',
  regionText: '',
  ...over,
})

describe('initialLocation', () => {
  it('a listed country and province select them; a typed name shows as "Khác" + its text', () => {
    expect(
      initialLocation({ country: COUNTRIES[0]!, region: REGIONS[0]! }, COUNTRIES, REGIONS),
    ).toEqual(value({ country: 'vn', region: 'hn' }))
    expect(
      initialLocation(
        { country: COUNTRIES[0]!, region: { id: 'x', label: 'Côn Đảo' } },
        COUNTRIES,
        REGIONS,
      ),
    ).toEqual(value({ country: 'vn', region: OTHER, regionText: 'Côn Đảo' }))
    expect(
      initialLocation(
        { country: { id: 'th', label: 'Thái Lan' }, region: { id: 'b', label: 'Bangkok' } },
        COUNTRIES,
        REGIONS,
      ),
    ).toEqual(value({ country: OTHER, countryText: 'Thái Lan', regionText: 'Bangkok' }))
    expect(
      initialLocation(
        { country: COUNTRIES[1]!, region: { id: 'j', label: 'Jurong' } },
        COUNTRIES,
        REGIONS,
      ),
    ).toEqual(value({ country: 'sg', regionText: 'Jurong' }))
  })
})

describe('withCountry', () => {
  it('a new country clears the chosen or typed province (US-01.07)', () => {
    expect(withCountry(value({ country: 'vn', region: 'hn' }), 'sg')).toEqual(
      value({ country: 'sg' }),
    )
    expect(withCountry(value({ country: 'sg', regionText: 'Jurong' }), OTHER)).toEqual(
      value({ country: OTHER }),
    )
    const same = value({ country: 'vn', region: 'hn' })
    expect(withCountry(same, 'vn')).toBe(same)
  })
})

describe('locationErrors', () => {
  it('names what blocks "Tiếp tục"', () => {
    expect(locationErrors(value({}), COUNTRIES)).toEqual({
      country: LOCATION_MESSAGES.country,
      region: LOCATION_MESSAGES.region,
    })
    expect(locationErrors(value({ country: 'vn' }), COUNTRIES)).toEqual({
      region: LOCATION_MESSAGES.region,
    })
    expect(locationErrors(value({ country: 'vn', region: OTHER }), COUNTRIES)).toEqual({
      region: LOCATION_MESSAGES.regionText,
    })
    expect(locationErrors(value({ country: OTHER, regionText: 'X' }), COUNTRIES)).toEqual({
      country: LOCATION_MESSAGES.countryText,
    })
    expect(locationErrors(value({ country: 'sg', regionText: 'x'.repeat(61) }), COUNTRIES)).toEqual(
      {
        region: LOCATION_MESSAGES.tooLong,
      },
    )
    expect(locationErrors(value({ country: 'sg', regionText: 'Jurong' }), COUNTRIES)).toEqual({})
  })
})

describe('locationBody', () => {
  it('ids for listed choices, typed text otherwise', () => {
    expect(locationBody(value({ country: 'vn', region: 'hn' }), COUNTRIES)).toEqual({
      country_id: 'vn',
      region_id: 'hn',
    })
    expect(
      locationBody(value({ country: 'vn', region: OTHER, regionText: ' Côn Đảo ' }), COUNTRIES),
    ).toEqual({
      country_id: 'vn',
      locality: 'Côn Đảo',
    })
    expect(
      locationBody(
        value({ country: OTHER, countryText: 'Lào', regionText: 'Viêng Chăn' }),
        COUNTRIES,
      ),
    ).toEqual({
      country: 'Lào',
      locality: 'Viêng Chăn',
    })
    // An unfinished part is sent as null ("Lưu và hoàn tất sau").
    expect(locationBody(value({ country: 'sg' }), COUNTRIES)).toEqual({
      country_id: 'sg',
      region_id: null,
    })
  })

  it('labels the place, then the country', () => {
    expect(
      locationLabel({
        country: { id: 'sg', label: 'Singapore' },
        region: { id: 'j', label: 'Jurong' },
      }),
    ).toBe('Jurong, Singapore')
    expect(locationLabel({ country: null, region: null })).toBeNull()
  })
})
