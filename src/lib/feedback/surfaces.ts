import { FROZEN_ROUTES } from '@/lib/routes'

/**
 * S1-UAT-02 (FB-01, US-X.01) — where "Góp ý" is offered, and what a submission
 * records about the place it was sent from. Browser-safe; the SERVER calls the
 * same function on the route it received, so screen / workflow / step are
 * derived, never taken from the client.
 *
 * Surfaces (US-X.01 acceptance: public pages, sign-in / sign-up, the four
 * onboarding stages and completion, Hồ sơ của tôi, Cài đặt, Dự án & startup,
 * PRJ1–PRJ3): the homepage, /about, /library, every /auth*, /onboarding* and
 * /me* route, and the WF02 project screens of the frozen manifest (ME7
 * /projects, PRJ1 /projects/new and edit, team). Not the WF05 application
 * screens under /projects/{id}/applications, not WF03 / ops / admin (HD-11: no
 * floating "Góp ý"), not the demo or legal reader.
 */

export type FeedbackSurface = {
  /** Frozen screen id when the route is one, else a stable surface name. */
  screen: string
  workflow: 'PUBLIC' | 'WF01' | 'WF02'
  /** Onboarding stage as the screen shows it ("Bước 3/4"), when there is one. */
  step?: string
}

const PUBLIC: Record<string, string> = { '/': 'HOME', '/about': 'ABOUT', '/library': 'LIBRARY' }

/** The onboarding stage captions (ACC-05 … ACC-10, DEC-L1R-D3). */
const STEPS: Record<string, string> = {
  '/onboarding': 'Bắt đầu',
  '/onboarding/profile': 'Bước 1/4',
  '/onboarding/capability': 'Bước 2/4',
  '/onboarding/purpose': 'Bước 3/4',
  '/onboarding/privacy': 'Bước 4/4',
  '/onboarding/complete': 'Hoàn tất',
}

const PATTERNS = FROZEN_ROUTES.map((route) => ({
  screenId: route.screenId,
  regex: new RegExp(`^${route.pattern.replace(/\[[^\]]+\]/g, '[^/]+')}$`),
}))

const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

/** The surface for a pathname (no query, no hash), or null where "Góp ý" is not offered. */
export function feedbackSurface(pathname: string): FeedbackSurface | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (PUBLIC[path]) return { screen: PUBLIC[path]!, workflow: 'PUBLIC' }
  const workflow =
    within(path, '/auth') || within(path, '/onboarding')
      ? 'WF01'
      : within(path, '/me') || within(path, '/projects')
        ? 'WF02'
        : null
  if (!workflow) return null
  const screen = PATTERNS.find((p) => p.regex.test(path))?.screenId
  // Under /projects only the WF02 screens themselves; deeper routes belong to WF05.
  if (within(path, '/projects') && !screen?.startsWith('WF02-')) return null
  if (!screen) return { workflow, screen: workflow, ...(STEPS[path] ? { step: STEPS[path] } : {}) }
  const step = STEPS[path]
  return step ? { screen, workflow, step } : { screen, workflow }
}

/**
 * Only a same-origin path is ever recorded: the query and the fragment are
 * dropped (they may carry a reset or sign-in token, a `redirect`, a search),
 * and anything that is not a plain path is refused.
 */
export function feedbackRoute(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null
  const path = value.split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/') || path.startsWith('//') || /[\s\\]/.test(path)) return null
  return path
}
