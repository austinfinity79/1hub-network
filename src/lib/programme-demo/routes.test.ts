import { describe, expect, it } from 'vitest'

import { FROZEN_ROUTES } from '@/lib/routes'

import { SETUP_STEPS, demoRoutes, isSetupStep, nextSetupStep, previousSetupStep } from './routes'

describe('WF04 demo route map', () => {
  it('builds the audit-frozen paths', () => {
    const id = 'd4000000-0000-0000-0000-000000000002'
    expect([
      demoRoutes.list(),
      demoRoutes.create(),
      demoRoutes.detail(id),
      ...SETUP_STEPS.map((s) => demoRoutes.setup(id, s)),
    ]).toEqual([
      '/demo/programmes',
      '/demo/programmes/new',
      `/demo/programmes/${id}`,
      `/demo/programmes/${id}/setup/basic`,
      `/demo/programmes/${id}/setup/journey`,
      `/demo/programmes/${id}/setup/events`,
      `/demo/programmes/${id}/setup/registration`,
      `/demo/programmes/${id}/setup/team`,
      `/demo/programmes/${id}/setup/review`,
    ])
    expect(demoRoutes.detail('a/b')).toBe('/demo/programmes/a%2Fb')
  })

  it('orders setup steps back and next', () => {
    expect(nextSetupStep('basic')).toBe('journey')
    expect(nextSetupStep('review')).toBeNull()
    expect(previousSetupStep('basic')).toBeNull()
    expect(previousSetupStep('review')).toBe('team')
    expect(isSetupStep('journey')).toBe(true)
    expect(isSetupStep('judging')).toBe(false)
  })

  it('never reuses a WF01–WF03 contract route (WF03-S05 stays its own FUTURE route)', () => {
    for (const r of FROZEN_ROUTES) expect(r.contractRoute.startsWith('/demo')).toBe(false)
    expect(FROZEN_ROUTES.find((r) => r.screenId === 'WF03-S05')?.contractRoute).toBe(
      '/ops/org/:orgId/programmes',
    )
  })
})
