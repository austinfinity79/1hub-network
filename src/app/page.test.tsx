import { describe, expect, it } from 'vitest'

import BootstrapPage from './page'

describe('M0-T01 bootstrap', () => {
  it('exposes the root route as a React component', () => {
    expect(typeof BootstrapPage).toBe('function')
  })

  it('renders without throwing', () => {
    expect(() => BootstrapPage()).not.toThrow()
  })
})
