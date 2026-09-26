import { describe, expect, it } from 'vitest'

import { canSeeDiscovery, projectDiscovery, type DiscoverySource } from './projection'

const SOURCE: DiscoverySource = {
  profile_id: 'p1',
  display_name: 'Đặng Kim Chi',
  avatar_asset_id: 'asset_0123456789abcdef0123456789abcdef',
  headline: 'Founder',
  bio: 'Bio',
  domain_ids: ['d1'],
  region_id: 'r1',
}

describe('PROFILE_DISCOVERY projection (WF02-T00)', () => {
  it('the owner always sees every discovery field', () => {
    expect(projectDiscovery(SOURCE, 'PRIVATE', 'OWNER')).toEqual({
      profile_id: 'p1',
      display_name: 'Đặng Kim Chi',
      avatar_url: '/media/assets/asset_0123456789abcdef0123456789abcdef',
      headline: 'Founder',
      bio: 'Bio',
      domain_ids: ['d1'],
      region_id: 'r1',
    })
  })

  it('a network viewer sees the card only while NETWORK_ONLY', () => {
    expect(projectDiscovery(SOURCE, 'NETWORK_ONLY', 'NETWORK')?.display_name).toBe('Đặng Kim Chi')
    expect(projectDiscovery(SOURCE, 'PRIVATE', 'NETWORK')).toBeNull()
    expect(projectDiscovery(SOURCE, 'PROGRAMME_ACCESS', 'NETWORK')).toBeNull()
    expect(projectDiscovery(SOURCE, 'GRANTED_ACCESS', 'NETWORK')).toBeNull()
  })

  it('a guest never sees a profile in P0, whatever the level', () => {
    for (const level of ['PUBLIC', 'NETWORK_ONLY', 'PRIVATE'] as const) {
      expect(canSeeDiscovery(level, 'GUEST')).toBe(false)
      expect(projectDiscovery(SOURCE, level, 'GUEST')).toBeNull()
    }
  })

  it('never passes through fields outside the whitelist', () => {
    const leaky = {
      ...SOURCE,
      email: 'chi@example.test',
      phone: '0900000000',
      account_id: 'a1',
      metadata: { x: 1 },
    } as DiscoverySource
    const out = projectDiscovery(leaky, 'NETWORK_ONLY', 'NETWORK')!
    expect(Object.keys(out).sort()).toEqual(
      [
        'avatar_url',
        'bio',
        'display_name',
        'domain_ids',
        'headline',
        'profile_id',
        'region_id',
      ].sort(),
    )
  })

  it('omits empty fields instead of sending null placeholders', () => {
    const out = projectDiscovery(
      { ...SOURCE, avatar_asset_id: null, bio: null, domain_ids: [], region_id: null },
      'NETWORK_ONLY',
      'NETWORK',
    )
    expect(out).toEqual({ profile_id: 'p1', display_name: 'Đặng Kim Chi', headline: 'Founder' })
  })
})
