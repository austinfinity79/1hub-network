import { describe, expect, it } from 'vitest'

import { describeUserAgent } from './submit'
import { feedbackRoute, feedbackSurface } from './surfaces'

/** S1-UAT-02 — where "Góp ý" is offered and what a route records (FB-01, US-X.01). */

describe('feedbackSurface', () => {
  it.each([
    ['/', { screen: 'HOME', workflow: 'PUBLIC' }],
    ['/about', { screen: 'ABOUT', workflow: 'PUBLIC' }],
    ['/library', { screen: 'LIBRARY', workflow: 'PUBLIC' }],
    ['/auth', { screen: 'WF01-S01', workflow: 'WF01' }],
    ['/auth/reset-password', { screen: 'WF01-S11', workflow: 'WF01' }],
    ['/onboarding', { screen: 'WF01-S09', workflow: 'WF01', step: 'Bắt đầu' }],
    ['/onboarding/purpose', { screen: 'WF01-S05', workflow: 'WF01', step: 'Bước 3/4' }],
    ['/onboarding/complete/', { screen: 'WF01-S08', workflow: 'WF01', step: 'Hoàn tất' }],
    ['/me', { screen: 'WF02-S01', workflow: 'WF02' }],
    ['/me/settings', { screen: 'WF02-S07', workflow: 'WF02' }],
    ['/projects', { screen: 'WF02-S08', workflow: 'WF02' }],
    ['/projects/new', { screen: 'WF02-S05', workflow: 'WF02' }],
    ['/projects/abc/team', { screen: 'WF02-S06', workflow: 'WF02' }],
  ])('%s → %j', (path, surface) => {
    expect(feedbackSurface(path)).toEqual(surface)
  })

  it('is not offered on WF03 / ops / admin, the demo, the legal reader or look-alike paths', () => {
    for (const path of [
      '/organizations/hub',
      '/ops/network',
      '/ops/admin/feedback',
      '/demo/projects',
      '/projects/abc/applications/def',
      '/projects/abc/applications/def/review',
      '/legal/terms',
      '/mezzanine',
      '/projectsx',
      '/authority',
    ]) {
      expect(feedbackSurface(path), path).toBeNull()
    }
  })
})

describe('feedbackRoute', () => {
  it('keeps the path only', () => {
    expect(feedbackRoute('/auth/reset-password#token=abc')).toBe('/auth/reset-password')
    expect(feedbackRoute('/auth?redirect=/projects/new&token=x')).toBe('/auth')
  })

  it('refuses anything that is not a same-origin path', () => {
    for (const bad of [
      'https://x.vn/',
      '//x.vn',
      'javascript:alert(1)',
      '/a b',
      '/a\\b',
      1,
      null,
    ]) {
      expect(feedbackRoute(bad), String(bad)).toBeNull()
    }
  })
})

describe('describeUserAgent', () => {
  it('reads browser, OS and device coarsely', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
      ),
    ).toEqual({ browser: 'Edge', os: 'Windows', device: 'desktop' })
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'Android', device: 'mobile' })
  })
})
