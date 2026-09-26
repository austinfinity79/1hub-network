import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import type { OnboardingState } from '@/lib/onboarding/state'

/**
 * M0-ENTRY-01 — `/` only redirects: guest → /auth, otherwise wherever the
 * canonical resolver's routeFor() says. The resolver itself is mocked here
 * (its matrix is proven by resume.db-test.ts); routeFor stays the real one,
 * so no step mapping is duplicated in the root route.
 */

const mocks = vi.hoisted(() => ({
  session: null as { accountId: string } | null,
  state: null as OnboardingState | null,
  cookie: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (mocks.cookie(name), { value: 'opaque-token' }) }),
}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`)
  },
}))
vi.mock('@/lib/auth/sessions', () => ({ resolveSession: async () => mocks.session }))
vi.mock('@/lib/onboarding/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/onboarding/state')>()
  return { ...actual, getOnboardingState: async () => mocks.state }
})

const { default: RootEntry } = await import('./page')

const redirectOf = async () => {
  try {
    await RootEntry()
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('root rendered instead of redirecting')
}

describe('M0-ENTRY-01 root entry', () => {
  beforeEach(() => {
    mocks.session = { accountId: 'a1' }
  })

  it('a guest (no valid session) goes to /auth', async () => {
    mocks.session = null
    expect(await redirectOf()).toBe('REDIRECT /auth')
  })

  it.each([
    ['PURPOSE', '/onboarding/purpose'],
    ['PROFILE', '/onboarding/profile'],
    ['PRIVACY', '/onboarding/privacy'],
    ['COMPLETE', '/onboarding/complete'],
  ] as const)('%s → %s (the resolver’s step)', async (step, route) => {
    mocks.state = { completed: false, current_step: step, intent: null }
    expect(await redirectOf()).toBe(`REDIRECT ${route}`)
  })

  it('a completed member goes to /me', async () => {
    mocks.state = { completed: true, current_step: null, intent: null }
    expect(await redirectOf()).toBe('REDIRECT /me')
  })

  it('reads the session cookie by its configured name', async () => {
    mocks.state = { completed: true, current_step: null, intent: null }
    await redirectOf()
    expect(mocks.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME)
  })
})
