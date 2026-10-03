import { describe, expect, it } from 'vitest'

import { externalDomains } from './external-domain-map'
import { categorise } from './startup-adapter'

/** WF06-PROD-02 (DEC-W6P-D02) — external category → canonical DOMAIN map. */

const EDTECH = { id: 'd-edtech', label: 'Giáo dục' }
const FINTECH = { id: 'd-fintech', label: 'Tài chính' }
const domains = new Map([
  ['edtech', EDTECH],
  ['fintech', FINTECH],
])

describe('externalDomains', () => {
  it('maps a category only to an ACTIVE DOMAIN with exactly the reviewed slug', () => {
    expect(externalDomains(['EDU'], domains)).toEqual([EDTECH])
    expect(externalDomains(['FINTECH', 'EDU'], domains)).toEqual([FINTECH, EDTECH])
  })

  it('leaves a category without a DOMAIN in this database inert (no guess, no creation)', () => {
    expect(externalDomains(['AGRI', 'HEALTH'], domains)).toEqual([])
    expect(externalDomains(['EDU'], new Map())).toEqual([])
  })

  it('never maps IT or OTHER, and returns each DOMAIN once', () => {
    expect(externalDomains(['IT', 'OTHER'], domains)).toEqual([])
    expect(externalDomains(['EDU', 'EDU'], domains)).toEqual([EDTECH])
  })

  it('takes the categories the adapter derives from the feed text', () => {
    expect(externalDomains(categorise(['EdTech', 'Giáo dục']), domains)).toEqual([EDTECH])
  })
})
