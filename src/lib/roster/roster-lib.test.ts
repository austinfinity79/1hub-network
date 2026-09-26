import { describe, expect, it } from 'vitest'

import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email'

import * as roster from '../../../scripts/roster-lib.mjs'

/** GAP-ROSTER — the importer's pure rules, no database. */

describe('roster matching key', () => {
  it('normalizes exactly like authentication, so roster and sign-in agree', () => {
    for (const input of [
      '  Leader@Example.ORG ',
      'MEMBER@example.test',
      'a.b+tag@Sub.Example.test',
      '\tx@y.vn\n',
      'no-at-sign',
      'double@@example.test',
    ]) {
      expect(roster.normalizeEmail(input), input).toBe(normalizeEmail(input))
      expect(roster.isPlausibleEmail(input), input).toBe(isPlausibleEmail(input))
    }
  })

  it('masks addresses in reports', () => {
    expect(roster.maskEmail(' Leader@Example.org')).toBe('l***@example.org')
  })
})

describe('roster CSV', () => {
  it('parses quotes, doubled quotes, CRLF and a BOM', () => {
    expect(roster.parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })

  it('requires the frozen template header exactly', () => {
    expect(roster.ROSTER_HEADER).toEqual([
      'email',
      'organization_slug',
      'membership_state',
      'leadership_role_label',
      'source_batch',
    ])
    expect(roster.validateShape('email,org\n').errors).toHaveLength(1)
  })

  it('treats an identical normalized row as a duplicate, not a second relationship', () => {
    const shape = roster.validateShape(
      [
        roster.ROSTER_HEADER.join(','),
        'a@example.test,chapter-01,ACTIVE,,b1',
        ' A@EXAMPLE.test ,chapter-01,ACTIVE,,b1',
      ].join('\n'),
    )
    expect(shape).toMatchObject({ errors: [], duplicates: 1 })
    expect(shape.rows).toHaveLength(1)
  })
})
