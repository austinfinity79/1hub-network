import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OnboardingState } from '@/lib/onboarding/state'

/**
 * P0-LANDING (DEC-P0-LANDING-D1) — `/` renders the homepage and no longer
 * redirects; the entry decision M0-ENTRY-01 made moved into the primary call
 * to action: guest → /auth, otherwise wherever the canonical resolver's
 * routeFor() says. The resolver is mocked (its matrix is proven by
 * resume.db-test.ts); routeFor stays the real one, so no step mapping is
 * duplicated here.
 */

const mocks = vi.hoisted(() => ({
  session: null as { accountId: string } | null,
  state: null as OnboardingState | null,
  token: vi.fn(),
}))

vi.mock('@/lib/auth/sessions', () => ({
  resolveSession: async (token: string | undefined) => (mocks.token(token), mocks.session),
}))
vi.mock('@/lib/onboarding/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/onboarding/state')>()
  return { ...actual, getOnboardingState: async () => mocks.state }
})

const { landingEntry } = await import('./entry')

describe('P0-LANDING entry (the homepage primary CTA)', () => {
  beforeEach(() => {
    mocks.session = { accountId: 'a1' }
  })

  it('a guest (no valid session) is sent to /auth', async () => {
    mocks.session = null
    expect(await landingEntry(undefined)).toEqual({ kind: 'GUEST', href: '/auth' })
  })

  it.each([
    ['INTRO', '/onboarding'],
    ['BASIC', '/onboarding/profile'],
    ['CAPABILITY', '/onboarding/capability'],
    ['ROLE', '/onboarding/purpose'],
    ['REVIEW', '/onboarding/privacy'],
  ] as const)('%s → %s (the resolver’s step)', async (step, route) => {
    mocks.state = { completed: false, current_step: step, intent: null }
    expect(await landingEntry('opaque')).toEqual({ kind: 'MEMBER', href: route, onboarded: false })
  })

  it('a completed member goes to /me', async () => {
    mocks.state = { completed: true, current_step: null, intent: null }
    expect(await landingEntry('opaque')).toEqual({ kind: 'MEMBER', href: '/me', onboarded: true })
  })

  it('passes the session token through unchanged', async () => {
    mocks.state = { completed: true, current_step: null, intent: null }
    await landingEntry('opaque-token')
    expect(mocks.token).toHaveBeenCalledWith('opaque-token')
  })
})
