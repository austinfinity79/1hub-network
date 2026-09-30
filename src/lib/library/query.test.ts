import { describe, expect, it } from 'vitest'

import { LIBRARY_QUERY_MAX, libraryHref, libraryQuery } from './query'

describe('Library keyword in the address (homepage search → /library?q=)', () => {
  it('reads the first value, trimmed, capped like the search field', () => {
    expect(libraryQuery(undefined)).toBe('')
    expect(libraryQuery('   ')).toBe('')
    expect(libraryQuery('  giao thông ')).toBe('giao thông')
    expect(libraryQuery(['AI', 'y tế'])).toBe('AI')
    expect(libraryQuery('x'.repeat(200))).toHaveLength(LIBRARY_QUERY_MAX)
  })

  it('builds an encoded Library address, and none for an empty keyword', () => {
    expect(libraryHref('')).toBeNull()
    expect(libraryHref('   ')).toBeNull()
    expect(libraryHref(' giao thông & đô thị ')).toBe(
      '/library?q=giao%20th%C3%B4ng%20%26%20%C4%91%C3%B4%20th%E1%BB%8B',
    )
    expect(libraryHref('<script>')).toBe('/library?q=%3Cscript%3E')
  })
})
